#!/usr/bin/env node
// Backend do Kindle Dashboard.
// - Serve a API JSON normalizada, o render HTML->PNG e o PNG/loop para o Kindle.
// - CORS aberto (Access-Control-Allow-Origin: *).
//
// Sem dependências externas (só core Node). Inicia com: node backend/server.js
// Bind em 0.0.0.0 para ficar acessível na LAN.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const collectors = require('./collectors');
const preflight = require('./preflight');

const PORT = parseInt(process.env.PORT || '8787', 10);
const LOCALES_DIR = path.resolve(__dirname, '..', 'locales');
const configMgr = require('./config');

function getKindleStatusFile() {
  if (process.env.DASHBOARD_DATA_DIR) return path.join(process.env.DASHBOARD_DATA_DIR, 'kindle-status.json');
  if (/app\.asar/.test(__dirname)) {
    return path.join(os.homedir(), 'Library', 'Application Support', 'com.alexi.kindle-dashboard', 'kindle-status.json');
  }
  return path.join(__dirname, '..', 'out', 'kindle-status.json');
}

let kindleStatus = { battery: null, isCharging: false, lastSeen: null, clientIp: null, devices: {} };
try {
  const statusFile = getKindleStatusFile();
  if (fs.existsSync(statusFile)) {
    kindleStatus = { ...kindleStatus, ...JSON.parse(fs.readFileSync(statusFile, 'utf8')) };
    if (!kindleStatus.devices) kindleStatus.devices = {};
  }
} catch {}

function saveKindleStatus() {
  try {
    const statusFile = getKindleStatusFile();
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(statusFile, JSON.stringify(kindleStatus), 'utf8');
  } catch {}
}

let activeNotification = null;

function checkScheduledQueue() {
  const currentCfg = configMgr.readConfig();
  const list = currentCfg.scheduledNotifications || [];
  if (!list || list.length === 0) return;
  const now = Date.now();
  const due = [];
  const remaining = [];
  for (const item of list) {
    if (item.scheduledFor <= now) {
      due.push(item);
    } else {
      remaining.push(item);
    }
  }
  if (due.length > 0) {
    const latest = due[due.length - 1];
    activeNotification = {
      message: latest.message,
      expiresAt: now + (latest.durationSec * 1000),
      createdAt: new Date().toISOString(),
    };
    configMgr.writeConfig({ scheduledNotifications: remaining });
  }
}

setInterval(checkScheduledQueue, 5000).unref();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// --- payload mock no formato normalizado (tarefa 3.4). Coletores reais entram na Fase 3. ---
function mockUsage() {
  const now = Date.now();
  return {
    updatedAt: new Date(now).toISOString(),
    source: 'mock',
    tools: [
      {
        tool: 'claude',
        label: 'Claude Code',
        windows: [
          { name: '5h', pct: 30.0, resets_at: '2026-06-14T21:40:00Z' },
          { name: '7d', pct: 3.0, resets_at: '2026-06-20T12:00:00Z' },
        ],
        extra: { used_credits: 3038, monthly_limit: 11000, currency: 'BRL', pct: 27.6, current_balance: 1245 },
        confidence: 'mock',
      },
      {
        tool: 'codex',
        label: 'OpenAI Codex',
        windows: [
          { name: '5h', pct: 33, resets_at: '2026-06-14T21:51:33Z' },
          { name: '7d', pct: 5, resets_at: '2026-06-21T12:00:00Z' },
        ],
        tokens: { total: 5155314 },
        confidence: 'mock',
      },
    ],
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// i18n para a render HTML: devolve só os namespaces que o navegador precisa.
// Valida o código de idioma (evita path traversal) e cai para `en` se faltar.
function readLocaleI18n(lang) {
  const safe = /^[A-Za-z-]{2,12}$/.test(lang) ? lang : 'en';
  try {
    const data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${safe}.json`), 'utf8'));
    return { meta: data.meta || {}, dashboard: data.dashboard || {} };
  } catch {
    return safe === 'en' ? { meta: {}, dashboard: {} } : readLocaleI18n('en');
  }
}

function createServer(deps = {}) {
  const collectAll = deps.collectAll || collectors.collectAll;
  const checkAll = deps.checkAll || preflight.checkAll;
  const dashImagePath = deps.dashImagePath || path.join(__dirname, '..', 'out', 'dash.png');

  return http.createServer((req, res) => {
    const requestUrl = req.url || '/';
    const [url] = requestUrl.split('?');
    const clientIp = req.socket.remoteAddress?.replace(/^.*:/, '') || req.socket.remoteAddress;
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${url} from ${clientIp}`);
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (url === '/api/ping') {
      return send(res, 200, JSON.stringify({ ok: true, t: Date.now() }), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/auth') {
      return send(res, 200, JSON.stringify({ checkedAt: new Date().toISOString(), sources: checkAll() }), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/i18n') {
      const lang = new URLSearchParams(requestUrl.split('?')[1] || '').get('lang') || 'en';
      return send(res, 200, JSON.stringify(readLocaleI18n(lang)), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/usage') {
      if (/[?&]mock=1/.test(requestUrl)) {
        return send(res, 200, JSON.stringify(mockUsage()), { 'Content-Type': MIME['.json'] });
      }
      return collectAll()
        .then((data) => send(res, 200, JSON.stringify(data), { 'Content-Type': MIME['.json'] }))
        .catch((error) => send(res, 500, JSON.stringify({ error: String(error) }), { 'Content-Type': MIME['.json'] }));
    }
    if (url === '/api/kindle') {
      return send(res, 200, JSON.stringify(kindleStatus), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/config') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const next = configMgr.writeConfig(parsed);
            send(res, 200, JSON.stringify(next), { 'Content-Type': MIME['.json'] });
          } catch (e) {
            send(res, 400, JSON.stringify({ error: String(e.message || e) }), { 'Content-Type': MIME['.json'] });
          }
        });
        return;
      }
      return send(res, 200, JSON.stringify(configMgr.readConfig()), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/notify') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const msg = String(parsed.message || '').trim();
            const durationSec = Number.parseInt(parsed.durationSec || '300', 10);
            if (!msg) {
              activeNotification = null;
            } else {
              activeNotification = {
                message: msg,
                expiresAt: Date.now() + (durationSec * 1000),
                createdAt: new Date().toISOString(),
              };
            }
            send(res, 200, JSON.stringify({ ok: true, notification: activeNotification }), { 'Content-Type': MIME['.json'] });
          } catch (e) {
            send(res, 400, JSON.stringify({ error: String(e.message || e) }), { 'Content-Type': MIME['.json'] });
          }
        });
        return;
      }
      if (req.method === 'DELETE') {
        activeNotification = null;
        return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': MIME['.json'] });
      }
      checkScheduledQueue();
      if (activeNotification && activeNotification.expiresAt && Date.now() > activeNotification.expiresAt) {
        activeNotification = null;
      }
      return send(res, 200, JSON.stringify({ notification: activeNotification }), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/notify/scheduled') {
      const cfg = configMgr.readConfig();
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const msg = String(parsed.message || '').trim();
            const scheduledFor = Number.parseInt(parsed.scheduledFor, 10);
            const durationSec = Number.parseInt(parsed.durationSec || '300', 10);
            if (!msg || !scheduledFor) {
              return send(res, 400, JSON.stringify({ error: 'message and scheduledFor required' }), { 'Content-Type': MIME['.json'] });
            }
            const newItem = {
              id: 'sched_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              message: msg,
              durationSec,
              scheduledFor,
              createdAt: new Date().toISOString(),
            };
            const list = Array.isArray(cfg.scheduledNotifications) ? [...cfg.scheduledNotifications, newItem] : [newItem];
            configMgr.writeConfig({ scheduledNotifications: list });
            send(res, 200, JSON.stringify({ ok: true, item: newItem, scheduledNotifications: list }), { 'Content-Type': MIME['.json'] });
          } catch (e) {
            send(res, 400, JSON.stringify({ error: String(e.message || e) }), { 'Content-Type': MIME['.json'] });
          }
        });
        return;
      }
      if (req.method === 'DELETE') {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const q = new URLSearchParams(requestUrl.split('?')[1] || '');
            const targetId = parsed.id || q.get('id');
            const list = (cfg.scheduledNotifications || []).filter((item) => item.id !== targetId);
            configMgr.writeConfig({ scheduledNotifications: list });
            send(res, 200, JSON.stringify({ ok: true, scheduledNotifications: list }), { 'Content-Type': MIME['.json'] });
          } catch (e) {
            send(res, 400, JSON.stringify({ error: String(e.message || e) }), { 'Content-Type': MIME['.json'] });
          }
        });
        return;
      }
      return send(res, 200, JSON.stringify({ scheduledNotifications: cfg.scheduledNotifications || [] }), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/render') {
      return fs.readFile(path.join(__dirname, '..', 'render', 'dashboard.html'), 'utf8', (error, html) => {
        if (error) return send(res, 404, 'no render');
        const lang = new URLSearchParams(requestUrl.split('?')[1] || '').get('lang') || 'en';
        const localeData = readLocaleI18n(lang);
        checkScheduledQueue();
        if (activeNotification && activeNotification.expiresAt && Date.now() > activeNotification.expiresAt) {
          activeNotification = null;
        }
        const currentCfg = configMgr.readConfig();
        return collectAll()
          .then((data) => {
            const payload = {
              ...data,
              kindleStatus,
              notification: activeNotification ? activeNotification.message : null,
              widgetOptions: currentCfg.widgetOptions,
              layout: currentCfg.layout,
            };
            const script = `<script>window.__INITIAL_DATA__ = ${JSON.stringify(payload)}; window.__INITIAL_I18N__ = ${JSON.stringify(localeData)};</script>`;
            send(res, 200, html.replace('<!--__INJECT__-->', script), { 'Content-Type': MIME['.html'] });
          })
          .catch(() => {
            send(res, 200, html, { 'Content-Type': MIME['.html'] });
          });
      });
    }
    if (url === '/dash.png') {
      const q = new URLSearchParams(requestUrl.split('?')[1] || '');
      const bat = q.get('bat');
      if (bat !== null && bat !== '') {
        const battery = Number.parseInt(bat, 10);
        const isCharging = q.get('chg') === '1';
        kindleStatus.battery = battery;
        kindleStatus.isCharging = isCharging;
        kindleStatus.lastSeen = Date.now();
        kindleStatus.clientIp = clientIp;
        if (!kindleStatus.devices) kindleStatus.devices = {};
        kindleStatus.devices[clientIp] = {
          clientIp,
          battery,
          isCharging,
          lastSeen: Date.now(),
        };
        saveKindleStatus();
      }
      const now = new Date();
      const localHour = now.getHours();
      const isNight = (localHour >= 1 && localHour < 10) ? '1' : '0';
      let sleepSecs = 180;
      if (isNight === '1') {
        const target10 = new Date(now);
        target10.setHours(10, 0, 0, 0);
        const diffSecs = Math.max(60, Math.round((target10.getTime() - now.getTime()) / 1000));
        sleepSecs = Math.min(3600, diffSecs);
      }
      return fs.readFile(dashImagePath, (error, data) =>
        error ? send(res, 404, 'no png') : send(res, 200, data, {
          'Content-Type': MIME['.png'],
          'X-Kindle-Night': isNight,
          'X-Kindle-Sleep': String(sleepSecs),
          'X-Kindle-Interval': '180',
        }));
    }
    if (url.startsWith('/kindle/')) {
      const root = path.resolve(__dirname, '..', 'kindle');
      const file = path.resolve(root, url.slice('/kindle/'.length));
      if (!isInside(root, file)) return send(res, 403, 'forbidden');
      return fs.readFile(file, (error, data) =>
        error ? send(res, 404, 'no file') : send(res, 200, data, { 'Content-Type': 'text/plain; charset=utf-8' }));
    }
    return send(res, 404, JSON.stringify({ error: 'not found' }), { 'Content-Type': MIME['.json'] });
  });
}

function start() {
  const server = createServer();

  server.listen(PORT, '0.0.0.0', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : PORT;
    console.log(`backend on http://0.0.0.0:${port}`);
    console.log(`  API usage:  http://<PC_IP>:${port}/api/usage`);
    console.log(`  auth:       http://<PC_IP>:${port}/api/auth`);
    console.log(`  PNG:        http://<PC_IP>:${port}/dash.png`);
    preflight.printReport(preflight.checkAll());
  });

  const shutdown = (signal) => {
    console.log(`received ${signal}; shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('unhandled rejection', reason);
    process.exit(1);
  });
  process.on('uncaughtException', (error) => {
    console.error('uncaught exception', error);
    process.exit(1);
  });

  return server;
}

function getKindleStatus() {
  return { ...kindleStatus };
}

function setKindleStatus(patch) {
  kindleStatus = { ...kindleStatus, ...patch };
  saveKindleStatus();
  return kindleStatus;
}

function getActiveNotification() {
  if (activeNotification && activeNotification.expiresAt && Date.now() > activeNotification.expiresAt) {
    activeNotification = null;
  }
  return activeNotification;
}

function setActiveNotification(notification) {
  activeNotification = notification;
  return activeNotification;
}

if (require.main === module) start();

module.exports = {
  createServer,
  mockUsage,
  start,
  getKindleStatus,
  setKindleStatus,
  getActiveNotification,
  setActiveNotification,
};
