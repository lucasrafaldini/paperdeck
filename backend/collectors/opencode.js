// Coletor do OpenCode local — extrai métricas de sessões, mensagens, tokens e modelos do SQLite local.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const OPENCODE_DIR = path.join(os.homedir(), '.local', 'share', 'opencode');
const OPENCODE_DB = path.join(OPENCODE_DIR, 'opencode.db');
const OPENCODE_CONFIG = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
const CACHE_TTL_MS = 15000; // 15s cache

let cache = { at: 0, data: null };

function checkProcessRunning() {
  try {
    const ps = execSync('ps aux | grep "[o]pencode"', { encoding: 'utf8', timeout: 800 });
    const lines = ps.trim().split('\n').filter(Boolean);
    if (lines.length > 0) {
      const matchModel = lines[0].match(/--model\s+([^\s]+)/);
      return { running: true, model: matchModel ? matchModel[1] : null };
    }
  } catch {}
  return { running: false, model: null };
}

function readLocalConfig() {
  try {
    if (fs.existsSync(OPENCODE_CONFIG)) {
      return JSON.parse(fs.readFileSync(OPENCODE_CONFIG, 'utf8'));
    }
  } catch {}
  return null;
}

function querySql(dbPath, sql) {
  const sanitized = sql.replace(/"/g, '\\"');
  return execSync(`sqlite3 "${dbPath}" "${sanitized}"`, { encoding: 'utf8', timeout: 1500 }).trim();
}

async function collect(customDbPath) {
  const now = Date.now();
  if (!customDbPath && cache.data && (now - cache.at < CACHE_TTL_MS)) {
    return cache.data;
  }

  const dbPath = customDbPath || OPENCODE_DB;

  if (!fs.existsSync(dbPath)) {
    return {
      tool: 'opencode',
      label: 'OpenCode',
      confidence: 'idle',
      status: 'Inativo',
      model: 'Não instalado',
      totalSessions: 0,
      totalMessages: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      totalCost: 0,
      activeSession: null,
      historyPoints: [0, 0, 0, 0, 0, 0, 0],
      topModels: [],
      error: 'Base do OpenCode não encontrada (~/.local/share/opencode/opencode.db)',
    };
  }

  try {
    const procInfo = checkProcessRunning();
    const configData = readLocalConfig();

    let defaultModel = configData?.model || 'Ollama Local';
    if (procInfo.running && procInfo.model) {
      defaultModel = procInfo.model;
    }

    // 1. Contagens gerais
    let sessCount = 0;
    try {
      sessCount = parseInt(querySql(dbPath, 'SELECT count(*) FROM session;'), 10) || 0;
    } catch {}

    let msgCount = 0;
    try {
      msgCount = parseInt(querySql(dbPath, 'SELECT count(*) FROM message;'), 10) || 0;
    } catch {}

    // 2. Tokens & custo
    let inp = 0;
    let out = 0;
    let cacheTokens = 0;
    let cost = 0;

    try {
      const tokensRaw = querySql(dbPath, `
        SELECT 
          coalesce(sum(json_extract(data, '$.tokens.input')), 0),
          coalesce(sum(json_extract(data, '$.tokens.output')), 0),
          coalesce(sum(json_extract(data, '$.tokens.cache.read')), 0),
          coalesce(sum(json_extract(data, '$.cost')), 0)
        FROM message;
      `);
      if (tokensRaw) {
        const parts = tokensRaw.split('|').map((v) => Number(v) || 0);
        inp = parts[0] || 0;
        out = parts[1] || 0;
        cacheTokens = parts[2] || 0;
        cost = parts[3] || 0;
      }
    } catch {}

    // 3. Última sessão
    let latestSessTitle = null;
    try {
      latestSessTitle = querySql(dbPath, 'SELECT title FROM session ORDER BY time_updated DESC LIMIT 1;') || null;
    } catch {}

    // 4. Histórico 7 dias (mensagens criadas por dia)
    const historyPoints = [0, 0, 0, 0, 0, 0, 0];
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    const dayMs = 24 * 3600 * 1000;

    for (let idx = 0; idx < 7; idx++) {
      const dayStart = todayStart - (6 - idx) * dayMs;
      const dayEnd = dayStart + dayMs;
      try {
        const dayRes = querySql(dbPath, `SELECT count(*) FROM message WHERE time_created >= ${dayStart} AND time_created < ${dayEnd};`);
        historyPoints[idx] = parseInt(dayRes || '0', 10) || 0;
      } catch {}
    }

    // 5. Modelos mais usados
    const topModels = [];
    try {
      const modelsRaw = querySql(dbPath, `
        SELECT json_extract(data, '$.modelID') as m, count(*) as cnt 
        FROM message 
        WHERE json_extract(data, '$.modelID') IS NOT NULL 
        GROUP BY m 
        ORDER BY cnt DESC 
        LIMIT 3;
      `);
      if (modelsRaw) {
        for (const line of modelsRaw.split('\n').filter(Boolean)) {
          const [mName, cnt] = line.split('|');
          if (mName) {
            topModels.push({ name: mName, count: parseInt(cnt || '0', 10) });
          }
        }
      }
    } catch {}

    const totalTokens = inp + out + cacheTokens;
    const status = procInfo.running ? 'Ativo' : 'Ocioso';

    const result = {
      tool: 'opencode',
      label: 'OpenCode',
      confidence: 'live',
      status,
      model: defaultModel,
      totalSessions: sessCount,
      totalMessages: msgCount,
      totalTokens,
      inputTokens: inp,
      outputTokens: out,
      cacheReadTokens: cacheTokens,
      totalCost: cost,
      activeSession: latestSessTitle,
      historyPoints,
      topModels,
    };

    if (!customDbPath) {
      cache = { at: now, data: result };
    }
    return result;
  } catch (error) {
    return {
      tool: 'opencode',
      label: 'OpenCode',
      confidence: 'error',
      status: 'Erro',
      model: 'Desconhecido',
      totalSessions: 0,
      totalMessages: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      totalCost: 0,
      activeSession: null,
      historyPoints: [0, 0, 0, 0, 0, 0, 0],
      topModels: [],
      error: String(error.message || error),
    };
  }
}

module.exports = {
  collect,
  querySql,
  OPENCODE_DB,
  OPENCODE_CONFIG,
};
