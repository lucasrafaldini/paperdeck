const assert = require('node:assert/strict');
const { test } = require('node:test');
const storage = require('../backend/collectors/storage');

const GB = 1024 * 1024 * 1024;

test('classifyDrive tells NVMe, SSD, HDD, USB stick and SD card apart', () => {
  const c = storage.classifyDrive;
  // Disco interno de Mac Apple Silicon / NVMe PCIe.
  assert.equal(c({ bus: 'Apple Fabric', solidState: true }), 'nvme');
  assert.equal(c({ bus: 'PCI-Express', solidState: true }), 'nvme');
  assert.equal(c({ bus: 'nvme' }), 'nvme');
  // Gaveta USB com NVMe identificada pelo nome do modelo.
  assert.equal(c({ bus: 'USB', solidState: true, model: 'Samsung NVMe enclosure' }), 'nvme');
  // SSD SATA externo via USB.
  assert.equal(c({ bus: 'USB', solidState: true, model: 'SDSSDH3 1T00' }), 'ssd');
  assert.equal(c({ bus: 'SATA', solidState: true }), 'ssd');
  // HD externo cuja ponte USB não informa SolidState: decide pelo nome.
  assert.equal(c({ bus: 'USB', model: 'Ext. HDD Innostor Ext. HDD Media', sizeBytes: 500 * GB }), 'hdd');
  assert.equal(c({ bus: 'SATA', solidState: false, sizeBytes: 2000 * GB }), 'hdd');
  // Pendrive: mídia removível, ou pequeno e "rotativo" via USB.
  assert.equal(c({ bus: 'USB', removableMedia: true, sizeBytes: 32 * GB }), 'flash');
  assert.equal(c({ bus: 'USB', solidState: false, sizeBytes: 64 * GB }), 'flash');
  assert.equal(c({ bus: 'USB', model: 'SanDisk Cruzer Blade' }), 'flash');
  // Cartão SD.
  assert.equal(c({ bus: 'Secure Digital', removableMedia: true }), 'sd');
  assert.equal(c({ bus: 'mmc' }), 'sd');
  // Rede e desconhecido.
  assert.equal(c({ network: true }), 'network');
  assert.equal(c({ bus: 'USB', sizeBytes: 1000 * GB }), 'unknown');
});

test('parseDfList keeps device, sizes and mount points with spaces', () => {
  const df = [
    'Filesystem     1024-blocks      Used Available Capacity iused      ifree %iused  Mounted on',
    '/dev/disk3s1s1   239362496  13437648  20934800    40%  486811  209348000    0%   /',
    '/dev/disk3s5     239362496 192850384  20934800    91% 2166751  209348000    1%   /System/Volumes/Data',
    '/dev/disk6s1     976729216 665452928 311276288    69%       1          0  100%   /Volumes/My Backup',
    'map auto_home            0         0         0   100%       0          0     -   /System/Volumes/Data/home',
  ].join('\n');
  const rows = storage.parseDfList(df);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], { device: '/dev/disk6s1', totalKb: 976729216, availKb: 311276288, mount: '/Volumes/My Backup' });
});

test('isUserMacMount hides system volumes and keeps external ones', () => {
  assert.equal(storage.isUserMacMount('/System/Volumes/Data', true), true);
  assert.equal(storage.isUserMacMount('/', true), false);
  assert.equal(storage.isUserMacMount('/', false), true);
  assert.equal(storage.isUserMacMount('/Volumes/Backup', true), true);
  assert.equal(storage.isUserMacMount('/Volumes/Recovery', true), false);
  assert.equal(storage.isUserMacMount('/System/Volumes/Preboot', true), false);
});

test('parseLsblk maps Linux NVMe, SATA HDD and USB stick mounts', () => {
  const lsblk = {
    blockdevices: [
      {
        name: 'nvme0n1', path: '/dev/nvme0n1', size: 512 * GB, type: 'disk', rota: false, tran: 'nvme', rm: false, model: 'WD SN770',
        children: [
          { name: 'nvme0n1p2', path: '/dev/nvme0n1p2', size: 500 * GB, type: 'part', mountpoints: ['/'], fsavail: 100 * GB, fssize: 490 * GB, fstype: 'ext4' },
          { name: 'nvme0n1p1', path: '/dev/nvme0n1p1', size: 1 * GB, type: 'part', mountpoints: ['/boot/efi'], fsavail: GB / 2, fssize: GB },
        ],
      },
      {
        name: 'sda', path: '/dev/sda', size: 2000 * GB, type: 'disk', rota: true, tran: 'sata', rm: false, model: 'ST2000DM008',
        children: [{ name: 'sda1', path: '/dev/sda1', type: 'part', mountpoints: ['/mnt/data'], fsavail: 1500 * GB, fssize: 1800 * GB, label: 'data' }],
      },
      {
        name: 'sdb', path: '/dev/sdb', size: 32 * GB, type: 'disk', rota: true, tran: 'usb', rm: true, model: 'Flash Disk',
        children: [{ name: 'sdb1', path: '/dev/sdb1', type: 'part', mountpoints: ['/media/user/PEN'], fsavail: 30 * GB, fssize: 31 * GB, label: 'PEN' }],
      },
      { name: 'loop0', type: 'loop', mountpoints: ['/snap/core/1'] },
    ],
  };
  const drives = storage.parseLsblk(JSON.stringify(lsblk));
  assert.deepEqual(drives.map((d) => [d.mount, d.kind, d.internal]), [
    ['/', 'nvme', true],
    ['/mnt/data', 'hdd', true],
    ['/media/user/PEN', 'flash', false],
  ]);
  assert.equal(drives[0].totalGb, 490);
  assert.equal(drives[0].freeGb, 100);
  assert.equal(drives[0].usedGb, 390);
  assert.equal(drives[0].pct, 80);
  assert.deepEqual(storage.parseLsblk('not json'), []);
});

test('parseWindowsVolumes handles numeric and string bus/media types', () => {
  const json = JSON.stringify([
    { letter: 'C', label: 'Windows', size: 1000 * GB, free: 400 * GB, driveType: 'Fixed', fs: 'NTFS', bus: '17', media: '4', model: 'Samsung SSD 980' },
    { letter: 'D', label: 'Dados', size: 2000 * GB, free: 1000 * GB, driveType: 'Fixed', fs: 'NTFS', bus: 'SATA', media: 'HDD', model: 'WDC WD20' },
    { letter: 'E', label: '', size: 16 * GB, free: 8 * GB, driveType: 'Removable', fs: 'FAT32', bus: 'USB', media: '', model: 'USB Flash' },
  ]);
  const drives = storage.parseWindowsVolumes(json);
  assert.deepEqual(drives.map((d) => [d.name, d.kind, d.internal]), [
    ['Windows (C:)', 'nvme', true],
    ['Dados (D:)', 'hdd', true],
    ['E:', 'flash', false],
  ]);
  // Um único volume vem como objeto, não array.
  assert.equal(storage.parseWindowsVolumes(JSON.stringify({ letter: 'C', size: GB, free: 0, bus: 'NVMe' })).length, 1);
  assert.deepEqual(storage.parseWindowsVolumes(''), []);
});

test('storage collector returns a drive list in the dashboard shape', async () => {
  const data = await storage.collect();
  assert.equal(data.tool, 'storage');
  assert.equal(data.labelKey, 'storageTitle');
  assert.ok(Array.isArray(data.drives));
  for (const d of data.drives) {
    assert.ok(d.name);
    assert.ok(['nvme', 'ssd', 'hdd', 'flash', 'sd', 'network', 'unknown'].includes(d.kind));
    assert.ok(d.usedGb <= d.totalGb);
    assert.ok(d.pct >= 0 && d.pct <= 100);
  }
  if (process.platform === 'darwin') {
    assert.ok(data.drives.length >= 1, 'internal disk should be listed');
    assert.equal(data.drives[0].internal, true);
  }
});
