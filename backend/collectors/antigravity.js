// Coletor Antigravity — lê métricas de agentes, sessões e tarefas do Antigravity local.
const fs = require('fs');
const os = require('os');
const path = require('path');

const AGY_DIR = path.join(os.homedir(), '.gemini', 'antigravity');

async function collect() {
  try {
    if (!fs.existsSync(AGY_DIR)) {
      return {
        tool: 'antigravity',
        label: 'Antigravity AI',
        confidence: 'idle',
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
        timeAgoMin: Math.max(0, Math.round((Date.now() - s.mtime) / 60000)),
      }));
    }

    const brainDir = path.join(AGY_DIR, 'brain');
    let totalBrainProjects = 0;
    let activeSessionSteps = 0;

    if (fs.existsSync(brainDir)) {
      totalBrainProjects = fs.readdirSync(brainDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;

      if (latestConvId) {
        const transcriptPath = path.join(brainDir, latestConvId, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcriptPath)) {
          try {
            const content = fs.readFileSync(transcriptPath, 'utf8');
            activeSessionSteps = content.trim().split('\n').filter(Boolean).length;
          } catch {}
        }
      }
    }

    const isRecentlyActive = recentConversations.length > 0 && recentConversations[0].timeAgoMin <= 15;
    const status = isRecentlyActive ? 'Ativo' : 'Ocioso';

    return {
      tool: 'antigravity',
      label: 'Antigravity AI',
      confidence: 'live',
      totalConversations,
      totalBrainProjects,
      activeSessionSteps,
      recentConversations,
      status,
    };
  } catch (error) {
    return {
      tool: 'antigravity',
      label: 'Antigravity AI',
      confidence: 'error',
      error: String(error.message || error),
    };
  }
}

module.exports = { collect };
