// Coletor Antigravity — lê métricas reais da API do Language Server local e arquivos do Brain.
const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const AGY_DIR = path.join(os.homedir(), '.gemini', 'antigravity');
const CACHE_TTL_MS = 20000; // 20s cache

let cache = { at: 0, data: null };
let lastKnownPort = null;
let lastKnownCsrf = null;

function countLinesFast(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(64 * 1024);
    let count = 0;
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 10) count++;
      }
    }
    fs.closeSync(fd);
    return count;
  } catch {
    return 0;
  }
}

function discoverServer() {
  try {
    const ps = execSync('ps aux | grep "language_server.*--csrf_token" | grep -v grep', { encoding: 'utf8' });
    const lines = ps.split('\n').filter((l) => l.includes('language_server') && l.includes('--csrf_token'));
    if (!lines.length) return null;

    for (const line of lines) {
      const matchCsrf = line.match(/--csrf_token\s+([a-f0-9-]+)/);
      const cols = line.trim().split(/\s+/);
      const pid = cols[1];
      if (!pid || !matchCsrf) continue;
      const csrf = matchCsrf[1];

      try {
        const lsof = execSync(`lsof -Pan -p ${pid} -i | grep LISTEN`, { encoding: 'utf8' });
        const ports = [];
        for (const l of lsof.split('\n')) {
          const m = l.match(/:(\d+)\s+\(LISTEN\)/);
          if (m) {
            const p = parseInt(m[1], 10);
            if (!ports.includes(p)) ports.push(p);
          }
        }
        if (ports.length > 0) {
          return { pid, csrf, ports };
        }
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}

function queryQuotaEndpoint(port, csrf) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '127.0.0.1',
      port,
      path: '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
      method: 'POST',
      rejectUnauthorized: false,
      timeout: 1200,
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': csrf,
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed && parsed.response && parsed.response.groups) {
            resolve(parsed.response);
          } else {
            reject(new Error('no groups in response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write('{}');
    req.end();
  });
}

async function fetchLiveQuota() {
  if (lastKnownPort && lastKnownCsrf) {
    try {
      return await queryQuotaEndpoint(lastKnownPort, lastKnownCsrf);
    } catch {
      lastKnownPort = null;
      lastKnownCsrf = null;
    }
  }

  const info = discoverServer();
  if (!info) return null;

  lastKnownCsrf = info.csrf;
  for (const port of info.ports) {
    try {
      const res = await queryQuotaEndpoint(port, info.csrf);
      lastKnownPort = port;
      return res;
    } catch {}
  }
  return null;
}

function parseWindows(quotaData) {
  const windows = [];
  if (!quotaData || !Array.isArray(quotaData.groups) || quotaData.groups.length === 0) {
    return windows;
  }

  // Grupo principal Gemini Models
  const geminiGroup = quotaData.groups.find((g) => /gemini/i.test(g.displayName)) || quotaData.groups[0];
  const buckets = geminiGroup.buckets || [];
  const b5h = buckets.find((b) => b.window === '5h');
  const bWeekly = buckets.find((b) => b.window === 'weekly');

  if (b5h) {
    const remaining = typeof b5h.remainingFraction === 'number' ? b5h.remainingFraction : 1;
    const usedPct = Math.max(0, Math.min(100, Math.round((1 - remaining) * 100)));
    windows.push({
      name: '5h',
      pct: usedPct,
      resets_at: b5h.resetTime || null,
    });
  }

  if (bWeekly) {
    const remaining = typeof bWeekly.remainingFraction === 'number' ? bWeekly.remainingFraction : 1;
    const usedPct = Math.max(0, Math.min(100, Math.round((1 - remaining) * 100)));
    windows.push({
      name: '7d',
      pct: usedPct,
      resets_at: bWeekly.resetTime || null,
    });
  }

  return windows;
}

async function collect() {
  const now = Date.now();
  if (cache.data && (now - cache.at < CACHE_TTL_MS)) {
    return cache.data;
  }

  try {
    const quotaData = await fetchLiveQuota();

    // Lê dados complementares de sessões e projetos locais
    const convDir = path.join(AGY_DIR, 'conversations');
    let totalConversations = 0;
    let recentConversations = [];
    let latestConvId = null;
    let stats = [];

    if (fs.existsSync(convDir)) {
      const files = fs.readdirSync(convDir).filter((f) => f.endsWith('.db'));
      totalConversations = files.length;

      stats = files.map((f) => {
        try {
          const stat = fs.statSync(path.join(convDir, f));
          return { id: f.replace('.db', ''), mtime: stat.mtimeMs };
        } catch {
          return { id: f.replace('.db', ''), mtime: 0 };
        }
      });
      stats.sort((a, b) => b.mtime - a.mtime);
      if (stats.length > 0) latestConvId = stats[0].id;

      recentConversations = stats.slice(0, 3).map((s) => ({
        id: s.id.slice(0, 8),
        timeAgoMin: Math.max(0, Math.round((now - s.mtime) / 60000)),
      }));
    }

    const historyPoints = [0, 0, 0, 0, 0, 0, 0];
    if (stats.length > 0) {
      const todayStart = new Date(now).setHours(0, 0, 0, 0);
      const dayMs = 24 * 3600 * 1000;
      for (let idx = 0; idx < 7; idx++) {
        const dayStart = todayStart - (6 - idx) * dayMs;
        const dayEnd = dayStart + dayMs;
        historyPoints[idx] = stats.filter((s) => s.mtime >= dayStart && s.mtime < dayEnd).length;
      }
    }

    const brainDir = path.join(AGY_DIR, 'brain');
    let totalBrainProjects = 0;
    let activeSessionSteps = 0;

    if (fs.existsSync(brainDir)) {
      const entries = fs.readdirSync(brainDir, { withFileTypes: true });
      totalBrainProjects = entries.filter((e) => e.isDirectory()).length;

      if (latestConvId) {
        const transcriptPath = path.join(brainDir, latestConvId, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcriptPath)) {
          activeSessionSteps = countLinesFast(transcriptPath);
        }
      }
    }

    const windows = parseWindows(quotaData);
    const isRecentlyActive = recentConversations.length > 0 && recentConversations[0].timeAgoMin <= 15;
    const status = isRecentlyActive ? 'Ativo' : 'Ocioso';

    const result = {
      tool: 'antigravity',
      label: 'Antigravity AI',
      confidence: quotaData ? 'live' : 'idle',
      windows,
      totalConversations,
      totalBrainProjects,
      activeSessionSteps,
      recentConversations,
      historyPoints,
      status,
    };

    cache = { at: now, data: result };
    return result;
  } catch (error) {
    return {
      tool: 'antigravity',
      label: 'Antigravity AI',
      confidence: 'error',
      windows: [],
      error: String(error.message || error),
    };
  }
}

module.exports = {
  collect,
  parseWindows,
  countLinesFast,
};
