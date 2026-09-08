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
        activeTasks: 0,
        recentConversations: [],
      };
    }

    const convDir = path.join(AGY_DIR, 'conversations');
    let totalConversations = 0;
    let recentConversations = [];

    if (fs.existsSync(convDir)) {
      const entries = fs.readdirSync(convDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory());
      totalConversations = dirs.length;

      // Obter as 3 mais recentes por mtime
      const stats = dirs.map((d) => {
        try {
          const stat = fs.statSync(path.join(convDir, d.name));
          return { id: d.name, mtime: stat.mtimeMs };
        } catch {
          return { id: d.name, mtime: 0 };
        }
      });
      stats.sort((a, b) => b.mtime - a.mtime);
      recentConversations = stats.slice(0, 3).map((s) => ({
        id: s.id.slice(0, 8),
        timeAgoMin: Math.max(0, Math.round((Date.now() - s.mtime) / 60000)),
      }));
    }

    const brainDir = path.join(AGY_DIR, 'brain');
    let totalBrainProjects = 0;
    if (fs.existsSync(brainDir)) {
      totalBrainProjects = fs.readdirSync(brainDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    }

    return {
      tool: 'antigravity',
      label: 'Antigravity AI',
      confidence: 'live',
      totalConversations,
      totalBrainProjects,
      recentConversations,
      status: 'Operacional',
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
