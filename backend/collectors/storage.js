// Coletor de armazenamento: lista dinamicamente os drives montados (disco
// interno, SSDs, HDs, NVMes, pendrives e cartões) com tipo, uso e espaço livre.
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CACHE_TTL_MS = 20000;
const MAC_DATA_VOLUME = '/System/Volumes/Data';
let cache = { at: 0, data: null };

// Tipos de drive expostos ao dashboard.
const KINDS = ['nvme', 'ssd', 'hdd', 'flash', 'sd', 'network', 'unknown'];

function run(cmd, timeout = 4000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? '' : String(stdout || ''));
    });
  });
}

function toGb(bytes) {
  return Math.round((Number(bytes) || 0) / 1024 / 1024 / 1024);
}

// Decide o tipo do drive a partir do barramento e do que o SO sabe dele.
// Pontes USB (SATA/NVMe → USB) muitas vezes não informam se é SSD, então o
// nome do modelo serve de desempate.
function classifyDrive(info = {}) {
  const bus = String(info.bus || '').toLowerCase();
  const name = String(info.model || '').toLowerCase();
  const sizeGb = toGb(info.sizeBytes);

  if (info.network) return 'network';
  if (/secure digital|\bsd\b|sdcard|mmc/.test(bus)) return 'sd';
  if (/nvme|pci|apple fabric/.test(bus) || /nvme/.test(name)) return 'nvme';
  if (info.removableMedia === true) return 'flash';
  if (/cruzer|datatraveler|flash drive|usb disk|usb flash|jumpdrive|pendrive|thumb/.test(name)) return 'flash';
  if (info.solidState === true) {
    if (/thunderbolt/.test(bus)) return 'nvme';
    return 'ssd';
  }
  if (info.solidState === false) {
    // Pendrives baratos costumam se apresentar como disco "rotativo" e pequeno.
    if (/usb/.test(bus) && sizeGb > 0 && sizeGb <= 256 && !/hdd|hard|disk drive/.test(name)) return 'flash';
    return 'hdd';
  }
  if (/hdd|hard ?drive|hard ?disk|seagate|hgst|barracuda|my passport|elements|expansion/.test(name)) return 'hdd';
  if (/ssd|solid|samsung t[579]|extreme portable/.test(name)) return 'ssd';
  if (/usb/.test(bus) && sizeGb > 0 && sizeGb <= 128) return 'flash';
  return 'unknown';
}

function buildDrive({ id, name, mount, kind, bus, internal, model, totalBytes, freeBytes, fsType }) {
  const total = Math.max(0, Number(totalBytes) || 0);
  const free = Math.max(0, Math.min(total, Number(freeBytes) || 0));
  const used = Math.max(0, total - free);
  return {
    id: String(id || mount || name),
    name: String(name || mount || '?'),
    mount: String(mount || ''),
    kind: KINDS.includes(kind) ? kind : 'unknown',
    bus: bus ? String(bus) : '',
    internal: Boolean(internal),
    model: model ? String(model).trim() : '',
    fsType: fsType ? String(fsType) : '',
    totalGb: toGb(total),
    usedGb: toGb(used),
    freeGb: toGb(free),
    pct: total > 0 ? Math.max(0, Math.min(100, Math.round((used / total) * 100))) : 0,
  };
}

// ---------------------------------------------------------------- macOS ----

// `df -kl` → lista de { device, totalKb, availKb, mount }.
function parseDfList(stdout) {
  const lines = String(stdout || '').trim().split('\n').slice(1);
  const rows = [];
  for (const line of lines) {
    const m = line.match(/^(\/dev\/\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+\S+\s+(?:\d+\s+\d+\s+\S+\s+)?(\/.*)$/);
    if (!m) continue;
    rows.push({
      device: m[1],
      totalKb: Number.parseInt(m[2], 10) || 0,
      availKb: Number.parseInt(m[4], 10) || 0,
      mount: m[5].trim(),
    });
  }
  return rows;
}

// Só o que interessa ao usuário: o volume de dados do disco interno e o que
// estiver montado em /Volumes (exceto volumes de sistema).
function isUserMacMount(mount, hasDataVolume) {
  if (mount === MAC_DATA_VOLUME) return true;
  if (mount === '/') return !hasDataVolume;
  if (!mount.startsWith('/Volumes/')) return false;
  const base = path.basename(mount);
  return !/^(Recovery|Preboot|VM|Update|xarts|iSCPreboot|Hardware)$/i.test(base) && !base.startsWith('.');
}

async function diskutilInfo(target) {
  const out = await run(`diskutil info -plist "${target}" | plutil -convert json -o - -`, 4000);
  try {
    return out ? JSON.parse(out) : null;
  } catch {
    return null;
  }
}

function wholeDiskOf(identifier) {
  const m = String(identifier || '').match(/^(disk\d+)/);
  return m ? m[1] : '';
}

async function collectMac() {
  const rows = parseDfList(await run('df -kl'));
  const hasDataVolume = rows.some((r) => r.mount === MAC_DATA_VOLUME);
  const userRows = rows.filter((r) => isUserMacMount(r.mount, hasDataVolume));

  const [rootInfo, ...volumeInfos] = await Promise.all([
    diskutilInfo('/'),
    ...userRows.map((r) => diskutilInfo(r.device)),
  ]);

  // Para volumes APFS o disco físico é o "physical store" do container.
  const physicalIds = new Set();
  volumeInfos.forEach((info) => {
    if (!info) return;
    const store = Array.isArray(info.APFSPhysicalStores) && info.APFSPhysicalStores[0]
      ? info.APFSPhysicalStores[0].APFSPhysicalStore
      : info.ParentWholeDisk;
    const whole = wholeDiskOf(store);
    if (whole) physicalIds.add(whole);
  });
  const physicalList = [...physicalIds];
  const physicalInfos = await Promise.all(physicalList.map((id) => diskutilInfo(id)));
  const physical = new Map(physicalList.map((id, i) => [id, physicalInfos[i]]));

  const drives = [];
  const seenContainers = new Set();
  userRows.forEach((row, i) => {
    const info = volumeInfos[i] || {};
    // Vários volumes APFS no mesmo container dividem o espaço: mostra um só.
    const containerKey = info.FilesystemType === 'apfs' && info.ParentWholeDisk ? info.ParentWholeDisk : row.device;
    if (seenContainers.has(containerKey)) return;
    seenContainers.add(containerKey);

    const store = Array.isArray(info.APFSPhysicalStores) && info.APFSPhysicalStores[0]
      ? info.APFSPhysicalStores[0].APFSPhysicalStore
      : info.ParentWholeDisk;
    const phys = physical.get(wholeDiskOf(store)) || {};
    const solidState = typeof info.SolidState === 'boolean' ? info.SolidState
      : (typeof phys.SolidState === 'boolean' ? phys.SolidState : undefined);
    const model = phys.MediaName || info.MediaName || '';
    const bus = info.BusProtocol || phys.BusProtocol || '';
    const isSystem = row.mount === MAC_DATA_VOLUME || row.mount === '/';

    drives.push(buildDrive({
      id: row.device,
      name: isSystem ? ((rootInfo && rootInfo.VolumeName) || 'Macintosh HD') : (info.VolumeName || path.basename(row.mount)),
      mount: isSystem ? '/' : row.mount,
      kind: classifyDrive({
        bus,
        model: [model, phys.IORegistryEntryName].filter(Boolean).join(' '),
        solidState,
        removableMedia: info.RemovableMedia === true || phys.RemovableMedia === true,
        sizeBytes: phys.Size || phys.TotalSize || row.totalKb * 1024,
      }),
      bus,
      internal: info.Internal === true,
      model,
      fsType: info.FilesystemType || '',
      totalBytes: row.totalKb * 1024,
      freeBytes: row.availKb * 1024,
    }));
  });
  return drives;
}

// ---------------------------------------------------------------- Linux ----

function flattenLsblk(devices, parent = null, out = []) {
  for (const dev of devices || []) {
    const disk = dev.type === 'disk' ? dev : parent;
    out.push({ dev, disk });
    if (Array.isArray(dev.children)) flattenLsblk(dev.children, disk, out);
  }
  return out;
}

function isUserLinuxMount(mount) {
  if (!mount) return false;
  if (mount === '/' || mount === '/home') return true;
  return /^\/(mnt|media|run\/media)\//.test(mount);
}

function parseLsblk(json) {
  let parsed;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return [];
  }
  const drives = [];
  for (const { dev, disk } of flattenLsblk(parsed && parsed.blockdevices)) {
    const mounts = Array.isArray(dev.mountpoints) ? dev.mountpoints : [dev.mountpoint];
    const mount = mounts.find(isUserLinuxMount);
    if (!mount || dev.type === 'loop') continue;
    const src = disk || dev;
    const tran = String(src.tran || '').toLowerCase();
    const rota = src.rota === true || src.rota === '1' || src.rota === 1;
    const rm = src.rm === true || src.rm === '1' || src.rm === 1;
    drives.push(buildDrive({
      id: dev.path || dev.name,
      name: dev.label || (mount === '/' ? 'Sistema' : path.basename(mount)),
      mount,
      kind: classifyDrive({
        bus: tran || (/^nvme/.test(String(src.name)) ? 'nvme' : /^mmcblk/.test(String(src.name)) ? 'mmc' : ''),
        model: src.model || '',
        solidState: !rota,
        removableMedia: rm && tran === 'usb',
        sizeBytes: Number(src.size) || 0,
      }),
      bus: tran,
      internal: !rm && tran !== 'usb',
      model: src.model || '',
      fsType: dev.fstype || '',
      totalBytes: Number(dev.fssize) || Number(dev.size) || 0,
      freeBytes: Number(dev.fsavail) || 0,
    }));
  }
  return drives;
}

async function collectLinux() {
  const out = await run('lsblk -J -b -o NAME,PATH,SIZE,TYPE,ROTA,TRAN,RM,MOUNTPOINTS,FSAVAIL,FSSIZE,FSTYPE,MODEL,LABEL');
  return parseLsblk(out);
}

// -------------------------------------------------------------- Windows ----

const WIN_BUS = { 3: 'ATA', 7: 'USB', 8: 'RAID', 10: 'SAS', 11: 'SATA', 12: 'SD', 13: 'MMC', 17: 'NVMe' };
const WIN_MEDIA = { 3: 'HDD', 4: 'SSD', 5: 'SCM' };

const WIN_SCRIPT = [
  '$ErrorActionPreference="SilentlyContinue";',
  '$pds=@(Get-PhysicalDisk);',
  'Get-Volume | Where-Object { $_.DriveLetter -and $_.Size -gt 0 } | ForEach-Object {',
  '$v=$_; $p=Get-Partition -DriveLetter $v.DriveLetter | Select-Object -First 1;',
  '$d=$null; $pd=$null; if ($p) { $d=Get-Disk -Number $p.DiskNumber; $pd=$pds | Where-Object { [string]$_.DeviceId -eq [string]$p.DiskNumber } | Select-Object -First 1 };',
  '[pscustomobject]@{ letter=[string]$v.DriveLetter; label=$v.FileSystemLabel; size=$v.Size; free=$v.SizeRemaining;',
  'driveType=[string]$v.DriveType; fs=$v.FileSystem; bus=[string]$d.BusType; media=[string]$pd.MediaType; model=$d.FriendlyName }',
  '} | ConvertTo-Json -Compress',
].join(' ');

function parseWindowsVolumes(json) {
  let list;
  try {
    list = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) list = list ? [list] : [];
  return list.map((v) => {
    const bus = WIN_BUS[v.bus] || String(v.bus || '');
    const media = WIN_MEDIA[v.media] || String(v.media || '');
    const driveType = String(v.driveType || '');
    const mount = `${v.letter}:\\`;
    return buildDrive({
      id: mount,
      name: v.label ? `${v.label} (${v.letter}:)` : `${v.letter}:`,
      mount,
      kind: classifyDrive({
        bus,
        model: v.model || '',
        solidState: /ssd|scm/i.test(media) ? true : (/hdd/i.test(media) ? false : undefined),
        removableMedia: /removable/i.test(driveType) || driveType === '2',
        network: /network/i.test(driveType) || driveType === '4',
        sizeBytes: Number(v.size) || 0,
      }),
      bus,
      internal: !/usb|sd|mmc/i.test(bus) && !/removable/i.test(driveType),
      model: v.model || '',
      fsType: v.fs || '',
      totalBytes: Number(v.size) || 0,
      freeBytes: Number(v.free) || 0,
    });
  });
}

async function collectWindows() {
  const encoded = Buffer.from(WIN_SCRIPT, 'utf16le').toString('base64');
  const out = await run(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, 10000);
  return parseWindowsVolumes(out);
}

// --------------------------------------------------------------- comum ----

function sortDrives(drives) {
  // Interno primeiro, depois externos por tamanho.
  return [...drives].sort((a, b) => {
    if (a.internal !== b.internal) return a.internal ? -1 : 1;
    if (a.mount === '/' || a.mount === 'C:\\') return -1;
    if (b.mount === '/' || b.mount === 'C:\\') return 1;
    return b.totalGb - a.totalGb;
  });
}

async function collectDrives(platform = process.platform) {
  if (platform === 'darwin') return collectMac();
  if (platform === 'win32') return collectWindows();
  if (platform === 'linux' && fs.existsSync('/sys/block')) return collectLinux();
  return [];
}

async function collect() {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL_MS) return cache.data;

  try {
    const drives = sortDrives((await collectDrives()).filter((d) => d.totalGb > 0));
    const totalGb = drives.reduce((acc, d) => acc + d.totalGb, 0);
    const usedGb = drives.reduce((acc, d) => acc + d.usedGb, 0);
    cache = {
      at: now,
      data: {
        tool: 'storage',
        label: 'Storage',
        labelKey: 'storageTitle',
        confidence: drives.length > 0 ? 'live' : 'error',
        error: drives.length > 0 ? undefined : 'no drives detected',
        drives,
        driveCount: drives.length,
        externalCount: drives.filter((d) => !d.internal).length,
        totalGb,
        usedGb,
        freeGb: Math.max(0, totalGb - usedGb),
        updatedAt: new Date(now).toISOString(),
      },
    };
    return cache.data;
  } catch (err) {
    return {
      tool: 'storage',
      label: 'Storage',
      labelKey: 'storageTitle',
      confidence: 'error',
      error: err && err.message ? err.message : String(err),
      drives: [],
    };
  }
}

module.exports = {
  collect,
  classifyDrive,
  parseDfList,
  parseLsblk,
  parseWindowsVolumes,
  isUserMacMount,
};
