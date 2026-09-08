// Coletor de estatísticas do macOS (CPU, RAM, Disco, Uptime)
const os = require('os');
const { exec } = require('child_process');

let lastCpuSample = null;
let lastCpuPct = 0;
let cachedStats = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5000;

function getCpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function computeCpuPct() {
  const current = getCpuSnapshot();
  if (!lastCpuSample) {
    lastCpuSample = current;
    return 0;
  }
  const idleDiff = current.idle - lastCpuSample.idle;
  const totalDiff = current.total - lastCpuSample.total;
  lastCpuSample = current;
  if (totalDiff <= 0) return lastCpuPct;
  const pct = Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 100)));
  lastCpuPct = pct;
  return pct;
}

function getVmStatMemory() {
  return new Promise((resolve) => {
    exec('vm_stat', { timeout: 1500 }, (err, stdout) => {
      const totalMem = os.totalmem();
      const totalGb = (totalMem / 1024 / 1024 / 1024).toFixed(1);
      if (err || !stdout) {
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        resolve({
          memPct: Math.round((usedMem / totalMem) * 100),
          memTotalGb: totalGb,
          memUsedGb: (usedMem / 1024 / 1024 / 1024).toFixed(1),
        });
        return;
      }
      let pageSize = 4096;
      const psMatch = stdout.match(/page size of (\d+) bytes/i);
      if (psMatch) pageSize = Number.parseInt(psMatch[1], 10);

      function parsePages(key) {
        const match = stdout.match(new RegExp(`${key}:\\s+(\\d+)`, 'i'));
        return match ? Number.parseInt(match[1], 10) : 0;
      }

      const active = parsePages('Pages active');
      const wired = parsePages('Pages wired down');
      const compressor = parsePages('Pages occupied by compressor');
      const usedBytes = (active + wired + compressor) * pageSize;
      const usedGb = (usedBytes / 1024 / 1024 / 1024).toFixed(1);
      const pct = Math.max(0, Math.min(100, Math.round((usedBytes / totalMem) * 100)));

      resolve({
        memPct: pct,
        memTotalGb: totalGb,
        memUsedGb: usedGb,
      });
    });
  });
}

function getDiskUsage() {
  return new Promise((resolve) => {
    exec('df -k /', { timeout: 1500 }, (err, stdout) => {
      if (err || !stdout) {
        resolve({ totalGb: 0, usedGb: 0, freeGb: 0, pct: 0 });
        return;
      }
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) {
        resolve({ totalGb: 0, usedGb: 0, freeGb: 0, pct: 0 });
        return;
      }
      const parts = lines[1].split(/\s+/);
      const totalKb = Number.parseInt(parts[1], 10) || 0;
      const usedKb = Number.parseInt(parts[2], 10) || 0;
      const freeKb = Number.parseInt(parts[3], 10) || 0;
      const pctStr = parts[4] || '0%';
      const pct = Number.parseInt(pctStr.replace('%', ''), 10) || 0;
      resolve({
        totalGb: Math.round(totalKb / 1024 / 1024),
        usedGb: Math.round(usedKb / 1024 / 1024),
        freeGb: Math.round(freeKb / 1024 / 1024),
        pct,
      });
    });
  });
}

function getMacModel() {
  return new Promise((resolve) => {
    exec('sysctl -n hw.model', { timeout: 1000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(os.arch());
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function collect() {
  const now = Date.now();
  if (cachedStats && now - cacheTime < CACHE_TTL_MS) {
    return cachedStats;
  }

  const cpuPct = computeCpuPct();
  const mem = await getVmStatMemory();
  const disk = await getDiskUsage();
  const model = await getMacModel();
  const uptime = formatUptime(os.uptime());

  cachedStats = {
    tool: 'macstats',
    label: 'Mac Stats',
    confidence: 'live',
    cpuPct,
    memPct: mem.memPct,
    memTotalGb: mem.memTotalGb,
    memUsedGb: mem.memUsedGb,
    diskPct: disk.pct,
    diskUsedGb: disk.usedGb,
    diskTotalGb: disk.totalGb,
    uptime,
    model,
    osRelease: `macOS ${os.release()}`,
    cores: os.cpus().length,
  };
  cacheTime = now;
  return cachedStats;
}

module.exports = { collect };
