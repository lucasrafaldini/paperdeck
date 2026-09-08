// Coletor SSH Chaos Machine — monitora o servidor Linux remoto via SSH.
const { exec } = require('child_process');

function queryRemoteHost(host = 'linux', timeoutMs = 2500) {
  return new Promise((resolve) => {
    const cmd = `ssh -o ConnectTimeout=2 -o BatchMode=yes -o StrictHostKeyChecking=no ${host} "uptime; free -m | grep Mem" 2>/dev/null`;
    exec(cmd, { timeout: timeoutMs }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve({ online: false, host });
        return;
      }
      const lines = stdout.trim().split('\n');
      const uptimeLine = lines[0] || '';
      const memLine = lines[1] || '';

      let loadAvg = '';
      const loadMatch = uptimeLine.match(/load average:\s*([0-9.,\s]+)/i);
      if (loadMatch) loadAvg = loadMatch[1].trim();

      let uptime = '';
      const upMatch = uptimeLine.match(/up\s+([^,]+)/i);
      if (upMatch) uptime = upMatch[1].trim();

      let memTotal = 0;
      let memUsed = 0;
      let memPct = 0;
      const memParts = memLine.split(/\s+/).filter(Boolean);
      if (memParts.length >= 3) {
        memTotal = Number.parseInt(memParts[1], 10) || 0;
        memUsed = Number.parseInt(memParts[2], 10) || 0;
        if (memTotal > 0) memPct = Math.round((memUsed / memTotal) * 100);
      }

      resolve({
        online: true,
        host,
        uptime,
        loadAvg,
        memTotal,
        memUsed,
        memPct,
      });
    });
  });
}

async function collect() {
  const host = process.env.CHAOS_MACHINE_HOST || 'linux';
  const data = await queryRemoteHost(host);
  if (!data.online) {
    return {
      tool: 'chaosmachine',
      label: 'Chaos Machine',
      confidence: 'idle',
      state: 'offline',
      host,
      loadAvg: '-',
      memPct: 0,
      note: 'Servidor offline / inacessível',
    };
  }

  return {
    tool: 'chaosmachine',
    label: 'Chaos Machine',
    confidence: 'live',
    state: 'online',
    host: data.host,
    uptime: data.uptime,
    loadAvg: data.loadAvg,
    memTotal: data.memTotal,
    memUsed: data.memUsed,
    memPct: data.memPct,
  };
}

module.exports = { collect };
