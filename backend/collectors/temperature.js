// Leitura de temperatura sem sudo e sem dependências nativas.
// - macOS (Apple Silicon): sensores HID do SoC via JXA (osascript).
// - macOS (qualquer): estado térmico do sistema (NSProcessInfo.thermalState).
// - Linux: /sys/class/thermal e /sys/class/hwmon.
// - Windows: sem leitura confiável sem privilégios → retorna null.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const CACHE_TTL_MS = 15000;
let cache = { at: 0, data: null };

const THERMAL_STATES = ['nominal', 'fair', 'serious', 'critical'];

// Expressão JXA: devolve JSON { sensors: [[nome, °C], ...], thermal: 0..3 }.
const MAC_JXA = `
(function () {
  ObjC.import('Foundation');
  var out = { sensors: [], thermal: -1 };
  try { out.thermal = Number($.NSProcessInfo.processInfo.thermalState); } catch (e) {}
  try {
    ObjC.import('IOKit');
    ObjC.bindFunction('IOHIDEventSystemClientCreate', ['id', ['void*']]);
    ObjC.bindFunction('IOHIDEventSystemClientSetMatching', ['int', ['id', 'id']]);
    ObjC.bindFunction('IOHIDEventSystemClientCopyServices', ['id', ['id']]);
    ObjC.bindFunction('IOHIDServiceClientCopyProperty', ['id', ['id', 'id']]);
    ObjC.bindFunction('IOHIDServiceClientCopyEvent', ['id', ['id', 'long long', 'int', 'long long']]);
    ObjC.bindFunction('IOHIDEventGetFloatValue', ['double', ['id', 'int']]);
    var client = $.IOHIDEventSystemClientCreate(null);
    $.IOHIDEventSystemClientSetMatching(client, $.NSDictionary.dictionaryWithDictionary({ PrimaryUsagePage: 0xff00, PrimaryUsage: 5 }));
    var services = $.IOHIDEventSystemClientCopyServices(client);
    var n = services && !services.isNil() ? services.count : 0;
    for (var i = 0; i < n; i++) {
      var s = services.objectAtIndex(i);
      var ev = $.IOHIDServiceClientCopyEvent(s, 15, 0, 0);
      if (!ev || ev.isNil()) continue;
      var name = $.IOHIDServiceClientCopyProperty(s, $('Product'));
      out.sensors.push([name && !name.isNil() ? ObjC.unwrap(name) : '', $.IOHIDEventGetFloatValue(ev, 15 << 16)]);
    }
  } catch (e) {}
  return JSON.stringify(out);
})()
`;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function plausible(c) {
  return Number.isFinite(c) && c > 5 && c < 125;
}

function avg(list) {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

// Agrupa os sensores do SoC em CPU / SSD / bateria.
function summarizeMacSensors(sensors) {
  const valid = (sensors || []).filter((s) => Array.isArray(s) && plausible(Number(s[1])));
  const pick = (re) => valid.filter(([name]) => re.test(String(name))).map(([, c]) => Number(c));

  let cpu = pick(/tdie|pACC|eACC|CPU|SOC MTR/i);
  if (!cpu.length) cpu = pick(/PMU|die|soc/i);
  const ssd = pick(/NAND/i);
  const battery = pick(/battery|gas gauge/i);

  return {
    cpuTempC: cpu.length ? round1(avg(cpu)) : null,
    cpuTempMaxC: cpu.length ? round1(Math.max(...cpu)) : null,
    ssdTempC: ssd.length ? round1(Math.max(...ssd)) : null,
    batteryTempC: battery.length ? round1(avg(battery)) : null,
    sensorCount: valid.length,
  };
}

function parseMacOutput(stdout) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(stdout || '').trim());
  } catch {
    parsed = null;
  }
  const summary = summarizeMacSensors(parsed && parsed.sensors);
  const t = parsed ? Number(parsed.thermal) : -1;
  return { ...summary, thermalState: THERMAL_STATES[t] || null };
}

function readMac() {
  return new Promise((resolve) => {
    execFile('osascript', ['-l', 'JavaScript', '-e', MAC_JXA], { timeout: 3000 }, (err, stdout) => {
      resolve(parseMacOutput(err ? '' : stdout));
    });
  });
}

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}

// Linux: zonas térmicas e hwmon (coretemp, k10temp, cpu_thermal, nvme...).
function readLinux(root = '/sys/class') {
  const cpu = [];
  const ssd = [];
  try {
    const zonesDir = path.join(root, 'thermal');
    for (const zone of fs.existsSync(zonesDir) ? fs.readdirSync(zonesDir) : []) {
      if (!zone.startsWith('thermal_zone')) continue;
      const type = readFileSafe(path.join(zonesDir, zone, 'type'));
      const c = Number(readFileSafe(path.join(zonesDir, zone, 'temp'))) / 1000;
      if (plausible(c) && /x86_pkg|cpu|soc|coretemp|k10temp|acpitz|package/i.test(type)) cpu.push(c);
    }
    const hwmonDir = path.join(root, 'hwmon');
    for (const hw of fs.existsSync(hwmonDir) ? fs.readdirSync(hwmonDir) : []) {
      const base = path.join(hwmonDir, hw);
      const name = readFileSafe(path.join(base, 'name'));
      const c = Number(readFileSafe(path.join(base, 'temp1_input'))) / 1000;
      if (!plausible(c)) continue;
      if (/coretemp|k10temp|zenpower|cpu_thermal|soc_thermal/i.test(name)) cpu.push(c);
      else if (/nvme|drivetemp/i.test(name)) ssd.push(c);
    }
  } catch {}
  return {
    cpuTempC: cpu.length ? round1(Math.max(...cpu)) : null,
    cpuTempMaxC: cpu.length ? round1(Math.max(...cpu)) : null,
    ssdTempC: ssd.length ? round1(Math.max(...ssd)) : null,
    batteryTempC: null,
    sensorCount: cpu.length + ssd.length,
    thermalState: null,
  };
}

const EMPTY = {
  cpuTempC: null,
  cpuTempMaxC: null,
  ssdTempC: null,
  batteryTempC: null,
  sensorCount: 0,
  thermalState: null,
};

async function readTemperatures(platform = process.platform) {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL_MS) return cache.data;
  let data = EMPTY;
  try {
    if (platform === 'darwin') data = await readMac();
    else if (platform === 'linux') data = readLinux();
  } catch {
    data = EMPTY;
  }
  cache = { at: now, data };
  return data;
}

module.exports = {
  readTemperatures,
  summarizeMacSensors,
  parseMacOutput,
  readLinux,
};
