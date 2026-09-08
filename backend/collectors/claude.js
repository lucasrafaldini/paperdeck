// Coletor Claude — endpoint OAuth oficial (validado na Fase 0.1).
// Lê o accessToken de ~/.claude/.credentials.json A CADA chamada (token rotaciona,
// a própria CLI renova). Min 180s entre chamadas reais (risco de 429) — cacheia o resto.
const fs = require('fs');
const os = require('os');
const path = require('path');

const CREDS = path.join(os.homedir(), '.claude', '.credentials.json');
const DESKTOP_HISTORY = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'plan-usage-history.json');
const URL = 'https://api.anthropic.com/api/oauth/usage';
const UA = process.env.CLAUDE_UA || 'claude-cli/1.0.0 (external, cli)';
const MIN_INTERVAL = 180000;
const REQUEST_TIMEOUT_MS = 7000;
const STALE_NOTE_KEY = 'claudeStale';

let cache = { at: 0, data: null };
let lastAttempt = 0; // gate: nunca bate no endpoint mais de 1x/MIN_INTERVAL (mesmo em erro → evita 429)

function computeDesktopResets(samples, now = Date.now()) {
  if (!samples || !samples.length) return { reset5h: null, reset7d: null };
  const last = samples[samples.length - 1];
  const fh = last && last.u ? Number(last.u.fh || 0) : 0;

  // 1. Ciclo semanal 7d
  let last7dResetTime = null;
  for (let i = samples.length - 1; i >= 1; i--) {
    const prev = samples[i - 1].u ? Number(samples[i - 1].u.sd || 0) : 0;
    const curr = samples[i].u ? Number(samples[i].u.sd || 0) : 0;
    if (curr === 0 || curr < prev - 15) {
      last7dResetTime = samples[i].t;
      break;
    }
  }
  if (!last7dResetTime) {
    last7dResetTime = samples[0].t;
  }
  const WEEK_MS = 7 * 24 * 3600 * 1000;
  let target7d = last7dResetTime + WEEK_MS;
  while (target7d <= now) {
    target7d += WEEK_MS;
  }
  const reset7d = new Date(target7d).toISOString();

  // 2. Ciclo de 5 horas
  const FIVE_H_MS = 5 * 3600 * 1000;
  let reset5h = null;
  if (fh > 0) {
    let start5h = last.t;
    for (let i = samples.length - 1; i >= 0; i--) {
      const uFh = samples[i].u ? Number(samples[i].u.fh || 0) : 0;
      if (uFh > 0) {
        start5h = samples[i].t;
      } else {
        break;
      }
    }
    let target5h = start5h + FIVE_H_MS;
    while (target5h <= now) {
      target5h += FIVE_H_MS;
    }
    reset5h = new Date(target5h).toISOString();
  } else {
    let last0Time = last.t;
    for (let i = samples.length - 1; i >= 1; i--) {
      const prev = samples[i - 1].u ? Number(samples[i - 1].u.fh || 0) : 0;
      const curr = samples[i].u ? Number(samples[i].u.fh || 0) : 0;
      if (prev > 0 && curr === 0) {
        last0Time = samples[i].t;
        break;
      }
    }
    let target5h = last0Time + FIVE_H_MS;
    while (target5h <= now) {
      target5h += FIVE_H_MS;
    }
    reset5h = new Date(target5h).toISOString();
  }

  return { reset5h, reset7d };
}

function readDesktopHistory() {
  if (!fs.existsSync(DESKTOP_HISTORY)) return null;
  try {
    const raw = fs.readFileSync(DESKTOP_HISTORY, 'utf8');
    const parsed = JSON.parse(raw);
    const samples = Array.isArray(parsed.samples) ? parsed.samples : [];
    if (!samples.length) return null;
    const last = samples[samples.length - 1];
    if (!last || !last.u) return null;
    const resets = computeDesktopResets(samples);
    return {
      tool: 'claude',
      label: 'Claude',
      windows: [
        { name: '5h', pct: Number(last.u.fh || 0), resets_at: resets.reset5h },
        { name: '7d', pct: Number(last.u.sd || 0), resets_at: resets.reset7d }
      ],
      confidence: 'live',
      updatedAt: new Date(last.t || Date.now()).toISOString()
    };
  } catch {
    return null;
  }
}

function readToken() {
  if (!fs.existsSync(CREDS)) {
    throw new Error('Não autenticado: execute `claude` no Mac');
  }
  const c = JSON.parse(fs.readFileSync(CREDS, 'utf8'));
  if (!c.claudeAiOauth || !c.claudeAiOauth.accessToken) throw new Error('sem accessToken');
  return c.claudeAiOauth.accessToken;
}

function shape(u) {
  const tool = { tool: 'claude', label: 'Claude Code', windows: [], confidence: 'live' };
  if (u.five_hour) tool.windows.push({ name: '5h', pct: u.five_hour.utilization, resets_at: u.five_hour.resets_at });
  if (u.seven_day) tool.windows.push({ name: '7d', pct: u.seven_day.utilization, resets_at: u.seven_day.resets_at });
  if (u.extra_usage && u.extra_usage.is_enabled) {
    const spend = u.spend && u.spend.enabled ? u.spend : null;
    tool.extra = {
      used_credits: spend ? spend.used.amount_minor : u.extra_usage.used_credits,
      monthly_limit: spend ? spend.limit.amount_minor : u.extra_usage.monthly_limit,
      currency: u.extra_usage.currency,
      pct: spend ? spend.percent : u.extra_usage.utilization,
      current_balance: null,
    };
  }
  return tool;
}

function resetMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function withoutExpiredWindows(tool, now = Date.now()) {
  const windows = Array.isArray(tool.windows) ? tool.windows : [];
  const liveWindows = windows.filter((window) => {
    const resetAt = resetMs(window.resets_at);
    return resetAt == null || resetAt > now;
  });
  if (liveWindows.length === windows.length) return tool;

  const next = { ...tool, windows: liveWindows };
  if (!liveWindows.length && windows.length) {
    const staleSince = Math.max(...windows.map((window) => resetMs(window.resets_at) || 0));
    next.confidence = 'stale';
    next.staleSince = staleSince ? new Date(staleSince).toISOString() : null;
    next.noteKey = STALE_NOTE_KEY;
  }
  return next;
}

async function collect() {
  const now = Date.now();
  if (cache.data && now - cache.at < MIN_INTERVAL) {
    return withoutExpiredWindows({ ...cache.data, confidence: 'cached' }, now);
  }
  // gate de segurança: não repetir a chamada real antes de MIN_INTERVAL, nem em erro
  if (now - lastAttempt < MIN_INTERVAL) {
    if (cache.data) return withoutExpiredWindows({ ...cache.data, confidence: 'stale' }, now);
    return { tool: 'claude', label: 'Claude Code', windows: [], confidence: 'cooldown',
             error: 'aguardando intervalo (≥180s) antes de tentar de novo' };
  }
  const desktop = readDesktopHistory();
  if (desktop && !fs.existsSync(CREDS)) {
    return desktop;
  }

  lastAttempt = now;
  try {
    const token = readToken();
    const res = await fetch(URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: 'Bearer ' + token,
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': UA,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = withoutExpiredWindows(shape(await res.json()), now);
    cache = { at: now, data };
    return data;
  } catch (e) {
    if (cache.data) return withoutExpiredWindows({ ...cache.data, confidence: 'stale', error: String(e.message || e) }, now);
    return { tool: 'claude', label: 'Claude Code', windows: [], confidence: 'error', error: String(e.message || e) };
  }
}

module.exports = { collect };
