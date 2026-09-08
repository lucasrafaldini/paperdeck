// Configuração local do Dashboard (widgets ativos, notificações, etc.)
const fs = require('fs');
const os = require('os');
const path = require('path');

function getDataDir() {
  if (process.env.DASHBOARD_DATA_DIR) return process.env.DASHBOARD_DATA_DIR;
  if (/app\.asar/.test(__dirname)) {
    return path.join(os.homedir(), 'Library', 'Application Support', 'com.alexi.kindle-dashboard');
  }
  return path.join(__dirname, '..', 'out');
}

function getConfigFile() {
  return path.join(getDataDir(), 'dashboard-config.json');
}

const DEFAULT_CONFIG = {
  activeWidgets: ['claude', 'antigravity', 'omnirouter'],
  availableWidgets: [
    { id: 'claude', name: 'Claude' },
    { id: 'omnirouter', name: 'Omni Router' },
    { id: 'codex', name: 'OpenAI Codex' },
    { id: 'applemusic', name: 'Apple Music' },
    { id: 'antigravity', name: 'Antigravity AI' },
    { id: 'chaosmachine', name: 'Chaos Machine (Linux)' },
  ],
};

function readConfig() {
  try {
    const file = getConfigFile();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        availableWidgets: DEFAULT_CONFIG.availableWidgets,
      };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

function writeConfig(patch) {
  const current = readConfig();
  const next = { ...current, ...patch, availableWidgets: DEFAULT_CONFIG.availableWidgets };
  const file = getConfigFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { readConfig, writeConfig };
