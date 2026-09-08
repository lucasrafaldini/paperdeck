// Configuração local do Dashboard (widgets ativos, notificações, etc.)
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'out', 'dashboard-config.json');

const DEFAULT_CONFIG = {
  activeWidgets: ['claude', 'omnirouter'],
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
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
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
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { readConfig, writeConfig };
