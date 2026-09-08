// Coletor Antigravity — lê métricas de agentes, sessões e tarefas do Antigravity local.
const fs = require('fs');
const os = require('os');
const path = require('path');

const AGY_DIR = path.join(os.homedir(), '.gemini', 'antigravity');
const CACHE_TTL_MS = 20000; // 20s cache para não reler arquivos em toda requisição

let cache = { at: 0, data: null };

async function collect() {
  const now = Date.now();
  if (cache.data && (now - cache.at < CACHE_TTL_MS)) {
    return cache.data;
  }

  try {
    if (!fs.existsSync(AGY_DIR)) {
      return {
        tool: 'antigravity',
        label: 'Antigravity AI',
        confidence: 'idle',
        windows: [],
        totalConversations: 0,
        totalBrainProjects: 0,
        activeSessionSteps: 0,
        recentConversations: [],
        status: 'Offline',
      };
    }

    const convDir = path.join(AGY_DIR, 'conversations');
    let totalConversations = 0;
    let recentConversations = [];
    let latestConvId = null;

    if (fs.existsSync(convDir)) {
      const files = fs.readdirSync(convDir).filter((f) => f.endsWith('.db'));
      totalConversations = files.length;

      const stats = files.map((f) => {
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

    const brainDir = path.join(AGY_DIR, 'brain');
    let totalBrainProjects = 0;
    let activeSessionSteps = 0;

    const fiveHoursAgo = now - 5 * 3600 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    let steps5h = 0;
    let steps7d = 0;
    let earliest5h = null;
    let earliest7d = null;

    if (fs.existsSync(brainDir)) {
      const entries = fs.readdirSync(brainDir, { withFileTypes: true });
      totalBrainProjects = entries.filter((e) => e.isDirectory()).length;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const transcriptPath = path.join(brainDir, entry.name, '.system_generated', 'logs', 'transcript.jsonl');
        if (!fs.existsSync(transcriptPath)) continue;

        try {
          const content = fs.readFileSync(transcriptPath, 'utf8');
          const lines = content.trim().split('\n');

          if (latestConvId && entry.name === latestConvId) {
            activeSessionSteps = lines.filter(Boolean).length;
          }

          for (const line of lines) {
            if (!line) continue;
            const item = JSON.parse(line);
            if (item.created_at) {
              const t = new Date(item.created_at).getTime();
              if (t >= fiveHoursAgo) {
                steps5h++;
                if (!earliest5h || t < earliest5h) earliest5h = t;
              }
              if (t >= sevenDaysAgo) {
                steps7d++;
                if (!earliest7d || t < earliest7d) earliest7d = t;
              }
            }
          }
        } catch {}
      }
    }

    const limit5h = Number.parseInt(process.env.ANTIGRAVITY_5H_LIMIT || '50', 10);
    const limit7d = Number.parseInt(process.env.ANTIGRAVITY_7D_LIMIT || '5000', 10);

    const pct5h = Math.min(100, Math.max(0, Math.round((steps5h / limit5h) * 100)));
    const pct7d = Math.min(100, Math.max(0, Math.round((steps7d / limit7d) * 100)));

    const reset5hIso = earliest5h ? new Date(earliest5h + 5 * 3600 * 1000).toISOString() : new Date(now + 3600 * 1000).toISOString();
    const reset7dIso = earliest7d ? new Date(earliest7d + 7 * 24 * 3600 * 1000).toISOString() : new Date(now + 24 * 3600 * 1000).toISOString();

    const isRecentlyActive = recentConversations.length > 0 && recentConversations[0].timeAgoMin <= 15;
    const status = isRecentlyActive ? 'Ativo' : 'Ocioso';

    const result = {
      tool: 'antigravity',
      label: 'Antigravity AI',
      confidence: 'live',
      windows: [
        { name: '5h', pct: pct5h, resets_at: reset5hIso },
        { name: '7d', pct: pct7d, resets_at: reset7dIso },
      ],
      steps5h,
      steps7d,
      totalConversations,
      totalBrainProjects,
      activeSessionSteps,
      recentConversations,
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

module.exports = { collect };
