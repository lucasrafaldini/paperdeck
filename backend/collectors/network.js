// Coletor de rede: velocidade de download/upload em tempo real, interface
// ativa, IP local, velocidade do link e totais desde o boot.
//
// A velocidade vem dos contadores de bytes da interface. Um amostrador leve
// (a cada 2 s, `unref`, sem bloquear o processo) mantém a janela recente; ele
// liga no primeiro `collect()` e desliga sozinho após 10 min sem leituras.
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

const SAMPLE_INTERVAL_MS = 2000;
const IDLE_STOP_MS = 10 * 60 * 1000;
const BUCKET_MS = 30 * 1000;
const HISTORY_BUCKETS = 20; // 10 min de histórico em blocos de 30 s
const CURRENT_WINDOW_MS = 6000;
const META_TTL_MS = 60 * 1000;

const state = {
  timer: null,
  lastCollectAt: 0,
  iface: null,
  samples: [], // { t, rx, tx } — janela curta para a velocidade atual
  buckets: [], // { start, rxBytes, txBytes, ms, peakRx }
  meta: { at: 0, data: null },
};

function run(cmd, timeout = 2000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? '' : String(stdout || ''));
    });
  });
}

// ------------------------------------------------------------ parsers ----

// `netstat -ibn`: soma a primeira linha <Link#> de cada interface.
function parseNetstatIbn(stdout) {
  const counters = {};
  const lines = String(stdout || '').trim().split('\n');
  const header = (lines.shift() || '').trim().split(/\s+/);
  const iIbytes = header.indexOf('Ibytes');
  const iObytes = header.indexOf('Obytes');
  if (iIbytes < 0 || iObytes < 0) return counters;
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    if (!/^<Link#\d+>$/.test(cols[2] || '')) continue;
    // Linhas <Link#> sem endereço MAC têm uma coluna a menos.
    const shift = /^([0-9a-f]{1,2}:){5}[0-9a-f]{1,2}$/i.test(cols[3] || '') ? 0 : -1;
    const rx = Number(cols[iIbytes + shift]);
    const tx = Number(cols[iObytes + shift]);
    if (Number.isFinite(rx) && Number.isFinite(tx) && !counters[cols[0]]) {
      counters[cols[0]] = { rx, tx };
    }
  }
  return counters;
}

// /proc/net/dev (Linux).
function parseProcNetDev(text) {
  const counters = {};
  for (const line of String(text || '').split('\n').slice(2)) {
    const m = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (!m) continue;
    const cols = m[2].trim().split(/\s+/).map(Number);
    if (cols.length >= 9) counters[m[1].trim()] = { rx: cols[0], tx: cols[8] };
  }
  return counters;
}

// `netstat -e` (Windows): só tem o total de todas as interfaces.
function parseNetstatE(stdout) {
  const m = String(stdout || '').match(/^\s*Bytes\s+(\d+)\s+(\d+)/m);
  return m ? { '*': { rx: Number(m[1]), tx: Number(m[2]) } } : {};
}

// ------------------------------------------------------ interface ativa ----

function firstExternalIpv4(ifaceName) {
  const all = os.networkInterfaces();
  const pick = (name) => (all[name] || []).find((a) => (a.family === 'IPv4' || a.family === 4) && !a.internal);
  if (ifaceName && pick(ifaceName)) return { name: ifaceName, address: pick(ifaceName).address };
  for (const name of Object.keys(all)) {
    const a = pick(name);
    if (a) return { name, address: a.address };
  }
  return { name: ifaceName || '', address: '' };
}

function guessKindFromName(name) {
  const n = String(name || '').toLowerCase();
  if (/^(wl|wlan|wi-?fi|airport)/.test(n) || /wi-?fi|wireless/.test(n)) return 'wifi';
  if (/^(en|eth|em|eno|enp|ethernet)/.test(n) || /ethernet/.test(n)) return 'ethernet';
  if (/^(utun|tun|tap|wg|ppp|ipsec)/.test(n)) return 'vpn';
  return 'other';
}

// `networksetup -listallhardwareports` → { en0: 'Wi-Fi' | 'Ethernet' | ... }.
function parseHardwarePorts(stdout) {
  const map = {};
  let port = null;
  for (const line of String(stdout || '').split('\n')) {
    const p = line.match(/^Hardware Port:\s*(.+)$/);
    if (p) port = p[1].trim();
    const d = line.match(/^Device:\s*(\S+)/);
    if (d && port) map[d[1]] = port;
  }
  return map;
}

// `ifconfig <if>` → velocidade negociada do link em Mbps (só cabo).
function parseIfconfigMedia(stdout) {
  const m = String(stdout || '').match(/media:.*?\((\d+)(G?)base/i);
  if (!m) return null;
  return Number(m[1]) * (m[2] ? 1000 : 1);
}

async function detectPrimaryInterface(platform) {
  if (platform === 'darwin') {
    const out = await run('route -n get default');
    const m = out.match(/interface:\s*(\S+)/);
    return m ? m[1] : '';
  }
  if (platform === 'linux') {
    const out = await run('ip route show default');
    const m = out.match(/\bdev\s+(\S+)/);
    return m ? m[1] : '';
  }
  return '';
}

async function readMeta(platform = process.platform) {
  const now = Date.now();
  if (state.meta.data && now - state.meta.at < META_TTL_MS) return state.meta.data;

  const primary = await detectPrimaryInterface(platform);
  const { name, address } = firstExternalIpv4(primary);
  let kind = guessKindFromName(name);
  let portName = '';
  let linkMbps = null;

  if (platform === 'darwin' && name) {
    const [ports, ifconfig] = await Promise.all([
      run('networksetup -listallhardwareports'),
      run(`ifconfig ${name.replace(/[^\w.-]/g, '')}`),
    ]);
    portName = parseHardwarePorts(ports)[name] || '';
    if (/wi-?fi|airport/i.test(portName)) kind = 'wifi';
    else if (/ethernet|thunderbolt|usb/i.test(portName)) kind = 'ethernet';
    linkMbps = parseIfconfigMedia(ifconfig);
  } else if (platform === 'linux' && name) {
    const speed = Number(readFileSafe(`/sys/class/net/${name}/speed`));
    if (Number.isFinite(speed) && speed > 0) linkMbps = speed;
    if (fs.existsSync(`/sys/class/net/${name}/wireless`)) kind = 'wifi';
  }

  const data = { iface: name, portName, kind, ipv4: address, linkMbps };
  state.meta = { at: now, data };
  return data;
}

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}

async function readCounters(platform = process.platform) {
  if (platform === 'darwin') return parseNetstatIbn(await run('netstat -ibn'));
  if (platform === 'linux') return parseProcNetDev(readFileSafe('/proc/net/dev'));
  if (platform === 'win32') return parseNetstatE(await run('netstat -e', 4000));
  return {};
}

// ------------------------------------------------------------ amostras ----

function addSample(sample) {
  const prev = state.samples[state.samples.length - 1];
  state.samples.push(sample);
  const cutoff = sample.t - Math.max(CURRENT_WINDOW_MS, SAMPLE_INTERVAL_MS * 2) - 1000;
  while (state.samples.length > 2 && state.samples[0].t < cutoff) state.samples.shift();
  if (!prev) return;

  const dt = sample.t - prev.t;
  const drx = sample.rx - prev.rx;
  const dtx = sample.tx - prev.tx;
  // Contador zerado/reiniciado (troca de interface, sleep): descarta o delta.
  if (dt <= 0 || drx < 0 || dtx < 0) return;

  const start = Math.floor(sample.t / BUCKET_MS) * BUCKET_MS;
  let bucket = state.buckets[state.buckets.length - 1];
  if (!bucket || bucket.start !== start) {
    bucket = { start, rxBytes: 0, txBytes: 0, ms: 0, peakRx: 0 };
    state.buckets.push(bucket);
    while (state.buckets.length > HISTORY_BUCKETS) state.buckets.shift();
  }
  bucket.rxBytes += drx;
  bucket.txBytes += dtx;
  bucket.ms += dt;
  bucket.peakRx = Math.max(bucket.peakRx, (drx * 1000) / dt);
}

async function sampleOnce() {
  const meta = await readMeta();
  const counters = await readCounters();
  const key = counters[meta.iface] ? meta.iface : (counters['*'] ? '*' : '');
  if (!key) return;
  if (state.iface !== key) {
    state.iface = key;
    state.samples = [];
    state.buckets = [];
  }
  addSample({ t: Date.now(), rx: counters[key].rx, tx: counters[key].tx });
}

function ensureSampler() {
  state.lastCollectAt = Date.now();
  if (state.timer) return;
  state.timer = setInterval(() => {
    if (Date.now() - state.lastCollectAt > IDLE_STOP_MS) {
      clearInterval(state.timer);
      state.timer = null;
      return;
    }
    sampleOnce().catch(() => {});
  }, SAMPLE_INTERVAL_MS);
  if (typeof state.timer.unref === 'function') state.timer.unref();
}

function stopSampler() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

function resetState() {
  stopSampler();
  state.iface = null;
  state.samples = [];
  state.buckets = [];
  state.meta = { at: 0, data: null };
}

// Velocidade atual em bytes/s sobre a janela curta de amostras.
function currentRates(samples = state.samples) {
  if (samples.length < 2) return null;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (const s of samples) {
    if (last.t - s.t <= CURRENT_WINDOW_MS) {
      first = s;
      break;
    }
  }
  if (first === last) first = samples[samples.length - 2];
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return null;
  return {
    rxBps: Math.max(0, (last.rx - first.rx) / dt),
    txBps: Math.max(0, (last.tx - first.tx) / dt),
  };
}

function historySummary(buckets = state.buckets) {
  const history = buckets.map((b) => (b.ms > 0 ? Math.round((b.rxBytes * 1000) / b.ms) : 0));
  const uploadHistory = buckets.map((b) => (b.ms > 0 ? Math.round((b.txBytes * 1000) / b.ms) : 0));
  const peak = buckets.reduce((m, b) => Math.max(m, b.peakRx), 0);
  const totalMs = buckets.reduce((m, b) => m + b.ms, 0);
  const totalRx = buckets.reduce((m, b) => m + b.rxBytes, 0);
  return {
    downloadHistoryBps: history,
    uploadHistoryBps: uploadHistory,
    peakDownloadBps: Math.round(peak),
    avgDownloadBps: totalMs > 0 ? Math.round((totalRx * 1000) / totalMs) : 0,
    historyWindowSec: Math.round(totalMs / 1000),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collect() {
  try {
    ensureSampler();
    // Primeira leitura: precisa de duas amostras para ter velocidade.
    if (state.samples.length < 2) {
      await sampleOnce();
      await wait(1000);
      await sampleOnce();
    }
    const meta = await readMeta();
    const rates = currentRates();
    const last = state.samples[state.samples.length - 1];

    return {
      tool: 'network',
      label: 'Network',
      labelKey: 'networkTitle',
      confidence: last ? 'live' : 'error',
      error: last ? undefined : 'no network counters',
      iface: meta.iface || (state.iface === '*' ? '' : state.iface) || '',
      portName: meta.portName,
      kind: meta.kind,
      ipv4: meta.ipv4,
      linkMbps: meta.linkMbps,
      downloadBps: rates ? Math.round(rates.rxBps) : 0,
      uploadBps: rates ? Math.round(rates.txBps) : 0,
      totalRxBytes: last ? last.rx : 0,
      totalTxBytes: last ? last.tx : 0,
      ...historySummary(),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      tool: 'network',
      label: 'Network',
      labelKey: 'networkTitle',
      confidence: 'error',
      error: err && err.message ? err.message : String(err),
    };
  }
}

module.exports = {
  collect,
  parseNetstatIbn,
  parseProcNetDev,
  parseNetstatE,
  parseHardwarePorts,
  parseIfconfigMedia,
  guessKindFromName,
  currentRates,
  historySummary,
  // Para testes.
  _addSample: addSample,
  _state: state,
  _reset: resetState,
  stopSampler,
};
