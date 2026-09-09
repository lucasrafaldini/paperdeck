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

const DEFAULT_WIDGET_OPTIONS = {
  claude: {
    bar5h: true,
    bar7d: true,
    resets: true,
    history7d: false,
    statusPill: true,
  },
  antigravity: {
    bar5h: true,
    bar7d: true,
    resets: true,
    statsGrid: true,
    historyChart: false,
  },
  omnirouter: {
    statGrid: true,
    topModels: true,
    pieChart: false,
    historyChart: false,
  },
  macstats: {
    cpuBar: true,
    ramBar: true,
    diskBar: true,
    uptime: true,
    sysInfo: true,
  },
  chaosmachine: {
    loadAvg: true,
    ram: true,
    uptime: true,
  },
  applemusic: {
    nowPlaying: true,
    progressBar: true,
    album: true,
  },
  tamagotchi: {
    showSprite: true,
    showBars: true,
    showStatus: true,
  },
  sitescraper: {
    showDate: true,
    maxItems: 3,
  },
};

const AVAILABLE_WIDGETS = [
  { id: 'claude', name: 'Claude' },
  { id: 'omnirouter', name: 'Omni Router' },
  { id: 'antigravity', name: 'Antigravity AI' },
  { id: 'macstats', name: 'Mac System Stats' },
  { id: 'tamagotchi', name: 'Mascote Virtual (Tamagotchi)' },
  { id: 'sitescraper', name: 'Monitor de Sites (Web Scraper / RSS)' },
  { id: 'applemusic', name: 'Apple Music' },
  { id: 'chaosmachine', name: 'Chaos Machine (Linux)' },
  { id: 'codex', name: 'OpenAI Codex' },
];

const DEFAULT_CONFIG = {
  activeWidgets: ['claude', 'antigravity', 'omnirouter'],
  availableWidgets: AVAILABLE_WIDGETS,
  widgetOptions: DEFAULT_WIDGET_OPTIONS,
  customSites: [],
  layout: {
    mode: 'preset',
    blocks: [
      { id: 'b_claude', tool: 'claude', width: 'half', height: 'standard' },
      { id: 'b_antigravity', tool: 'antigravity', width: 'half', height: 'standard' },
      { id: 'b_omnirouter', tool: 'omnirouter', width: 'half', height: 'tall' },
    ],
  },
  scheduledNotifications: [],
};

function readConfig() {
  try {
    const file = getConfigFile();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        availableWidgets: AVAILABLE_WIDGETS,
        widgetOptions: {
          ...DEFAULT_WIDGET_OPTIONS,
          ...(parsed.widgetOptions || {}),
        },
        customSites: Array.isArray(parsed.customSites) ? parsed.customSites : [],
        layout: parsed.layout || DEFAULT_CONFIG.layout,
        scheduledNotifications: Array.isArray(parsed.scheduledNotifications) ? parsed.scheduledNotifications : [],
      };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

function writeConfig(patch) {
  const current = readConfig();
  const next = {
    ...current,
    ...patch,
    availableWidgets: AVAILABLE_WIDGETS,
  };
  const file = getConfigFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = {
  readConfig,
  writeConfig,
  getDataDir,
  DEFAULT_WIDGET_OPTIONS,
  AVAILABLE_WIDGETS,
};

