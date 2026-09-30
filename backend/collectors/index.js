// Orquestrador dos coletores — roda os coletores em paralelo, isolados.
// Coleta apenas os coletores ativos conforme backend/config.js.
const claude = require('./claude');
const omnirouter = require('./omnirouter');
const codex = require('./codex');
const applemusic = require('./applemusic');
const antigravity = require('./antigravity');
const chaosmachine = require('./chaosmachine');
const macstats = require('./macstats');
const tamagotchi = require('./tamagotchi');
const sitescraper = require('./sitescraper');
const opencode = require('./opencode');
const { readConfig } = require('../config');

const REGISTRY = {
  claude,
  omnirouter,
  codex,
  applemusic,
  antigravity,
  chaosmachine,
  macstats,
  tamagotchi,
  sitescraper,
  opencode,
};

async function collectAll(requestedWidgets) {
  const config = readConfig();
  const active = Array.isArray(requestedWidgets) && requestedWidgets.length > 0
    ? requestedWidgets
    : (config.activeWidgets || ['claude', 'omnirouter']);

  const entries = active.map((id) => ({ id, collector: REGISTRY[id] })).filter((e) => e.collector);

  const results = await Promise.allSettled(entries.map((e) => e.collector.collect()));
  const tools = results.map((r, i) => {
    const id = entries[i].id;
    if (r.status === 'fulfilled') return r.value;
    return { tool: id, label: id, confidence: 'error', error: String(r.reason) };
  });

  return {
    updatedAt: new Date().toISOString(),
    source: 'live',
    tools,
    dashboardTitle: config.dashboardTitle || 'PaperDeck',
  };
}

module.exports = { collectAll, REGISTRY };
