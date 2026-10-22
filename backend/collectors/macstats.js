// Coletor de estatísticas do macOS: espaço de todos os discos conectados,
// temperatura do chip/SSD, modelo e uptime.
//
// O dashboard do Kindle só atualiza a cada poucos minutos, então métricas
// instantâneas (CPU/RAM) não diziam nada; disco e temperatura mudam devagar.
//
// Disco: `df -k /` no APFS mede só o volume de sistema selado (~13 GB), não o
// que está ocupado de verdade. Usamos o container APFS inteiro (total - livre,
// já que todos os volumes dividem o espaço) em bytes decimais, como o Finder.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const CACHE_TTL_MS = 30000;
const MAX_DISKS = 6;

let cachedStats = null;
let cacheTime = 0;
let inFlight = null;
let hardwareCache = null;

function run(command, args, timeout = 4000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      resolve(error ? '' : String(stdout || ''));
    });
  });
}

// Linhas do `df -k -l`; o ponto de montagem é tudo após a coluna %iused, então
// nomes com espaço continuam inteiros. Só "/" e "/Volumes/*" são discos do
// usuário — o resto (/System/Volumes/*) é infraestrutura do APFS.
function parseDfMounts(stdout) {
  const mounts = [];
  for (const line of String(stdout || '').split('\n')) {
    const match = line.match(/^(\/dev\/\S+)\s+\d+\s+\d+\s+\d+\s+\d+%\s+\d+\s+\d+\s+\d+%\s+(.+)$/);
    if (!match) continue;
    const mount = match[2].trim();
    if (mount === '/' || mount.startsWith('/Volumes/')) mounts.push({ device: match[1], mount });
  }
  return mounts;
}

// Converte o `diskutil info -plist` (já em JSON) num disco, ou null se não for
// um disco que faça sentido mostrar (imagem .dmg, tamanho zerado...).
function diskFromInfo(info, mount) {
  if (!info || typeof info !== 'object') return null;
  if (info.BusProtocol === 'Disk Image') return null;

  const isApfs = info.FilesystemType === 'apfs' && Number(info.APFSContainerSize) > 0;
  const totalBytes = Number(isApfs ? info.APFSContainerSize : info.TotalSize) || 0;
  const freeBytes = Number(isApfs ? info.APFSContainerFree : (info.FreeSpace || info.AvailableSpace)) || 0;
  if (totalBytes <= 0) return null;

  const usedBytes = Math.max(0, totalBytes - freeBytes);
  return {
    name: info.VolumeName || path.basename(mount) || mount,
    mount,
    internal: info.Internal === true,
    filesystem: info.FilesystemType || null,
    container: isApfs ? info.APFSContainerReference || null : null,
    totalBytes,
    usedBytes,
    freeBytes,
    pct: Math.max(0, Math.min(100, Math.round((usedBytes / totalBytes) * 100))),
  };
}

// Volumes do mesmo container APFS dividem o espaço (ex.: "Recovery" junto do
// "Macintosh HD"): mostra um por container. Interno primeiro, depois por nome.
function dedupeDisks(disks) {
  const seen = new Set();
  const unique = [];
  // "/" primeiro, para o disco de inicialização nunca aparecer como "Recovery".
  const ordered = disks.filter(Boolean).sort((a, b) => (b.mount === '/') - (a.mount === '/'));
  for (const disk of ordered) {
    const key = disk.container ? `apfs:${disk.container}` : `mount:${disk.mount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(disk);
  }
  return unique.sort((a, b) => {
    if (a.internal !== b.internal) return a.internal ? -1 : 1;
    if (a.mount === '/' || b.mount === '/') return a.mount === '/' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function diskInfo(mount) {
  // O mount vai como argumento posicional do sh, nunca interpolado.
  const json = await run('/bin/sh', ['-c', 'diskutil info -plist "$1" | plutil -convert json -o - -', 'sh', mount]);
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getDisks() {
  const mounts = parseDfMounts(await run('df', ['-k', '-l']));
  const disks = await Promise.all(mounts.map(async ({ mount }) => diskFromInfo(await diskInfo(mount), mount)));
  return dedupeDisks(disks).slice(0, MAX_DISKS);
}

function temperatureHelperPath() {
  const candidates = [
    process.env.PAPERDECK_TEMP_BIN,
    process.resourcesPath && path.join(process.resourcesPath, 'bin', 'paperdeck-temp'),
    path.join(__dirname, '..', '..', 'build', 'bin', 'paperdeck-temp'),
  ].filter(Boolean);
  return candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }) || null;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// "tdie" são os sensores do die do SoC (média = temperatura média do chip);
// "NAND" é o SSD interno; "tcal" é constante de calibração e fica de fora.
function summarizeTemperatures(sensors) {
  if (!Array.isArray(sensors)) return null;
  const valid = sensors.filter((s) => s && typeof s.name === 'string' && Number.isFinite(s.c));
  const die = valid.filter((s) => /tdie/i.test(s.name)).map((s) => s.c);
  const soc = die.length ? die : valid.filter((s) => !/tcal|nand/i.test(s.name)).map((s) => s.c);
  const ssd = valid.filter((s) => /nand/i.test(s.name)).map((s) => s.c);
  if (!soc.length && !ssd.length) return null;
  return {
    socAvgC: soc.length ? Math.round(average(soc)) : null,
    socMaxC: soc.length ? Math.round(Math.max(...soc)) : null,
    ssdC: ssd.length ? Math.round(average(ssd)) : null,
  };
}

async function getTemperature() {
  if (process.platform !== 'darwin') return null;
  const helper = temperatureHelperPath();
  if (!helper) return null;
  try {
    return summarizeTemperatures(JSON.parse(await run(helper, [], 4000)));
  } catch {
    return null;
  }
}

// Nome comercial ("Mac mini · Apple M4") não muda: busca uma vez só.
async function getHardware() {
  if (hardwareCache) return hardwareCache;
  let model = '';
  let chip = '';
  try {
    const data = JSON.parse(await run('system_profiler', ['SPHardwareDataType', '-json'], 8000));
    const hw = data && data.SPHardwareDataType && data.SPHardwareDataType[0];
    if (hw) {
      model = hw.machine_name || '';
      chip = hw.chip_type || hw.cpu_type || '';
    }
  } catch {}
  if (!model) model = (await run('sysctl', ['-n', 'hw.model'], 1500)).trim() || os.arch();
  // os.release() é a versão do kernel Darwin, não a do macOS.
  const version = (await run('sw_vers', ['-productVersion'], 1500)).trim();
  hardwareCache = { model, chip, osRelease: version ? `macOS ${version}` : `Darwin ${os.release()}` };
  return hardwareCache;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function gather() {
  const [disks, temperature, hardware] = await Promise.all([
    getDisks().catch(() => []),
    getTemperature().catch(() => null),
    getHardware().catch(() => ({ model: os.arch(), chip: '', osRelease: `Darwin ${os.release()}` })),
  ]);
  return {
    tool: 'macstats',
    label: 'Mac Stats',
    confidence: 'live',
    disks,
    temperature,
    model: hardware.model,
    chip: hardware.chip,
    osRelease: hardware.osRelease,
    uptime: formatUptime(os.uptime()),
    updatedAt: new Date().toISOString(),
  };
}

async function collect() {
  const now = Date.now();
  if (cachedStats && now - cacheTime < CACHE_TTL_MS) return cachedStats;
  if (!inFlight) {
    inFlight = gather()
      .then((stats) => {
        cachedStats = stats;
        cacheTime = Date.now();
        return stats;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

module.exports = {
  collect,
  dedupeDisks,
  diskFromInfo,
  formatUptime,
  parseDfMounts,
  summarizeTemperatures,
};
