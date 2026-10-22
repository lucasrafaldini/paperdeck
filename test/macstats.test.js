const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  dedupeDisks,
  diskFromInfo,
  parseDfMounts,
  summarizeTemperatures,
} = require('../backend/collectors/macstats');

const DF_OUTPUT = `Filesystem     1024-blocks      Used Available Capacity iused      ifree %iused  Mounted on
/dev/disk3s1s1   239362496  13338452  26955032    34%  484019  269550320    0%   /
/dev/disk3s6     239362496   2097308  26955032     8%       2  269550320    0%   /System/Volumes/VM
/dev/disk3s5     239362496 184672272  26955032    88% 2260845  269550320    1%   /System/Volumes/Data
/dev/disk12s1    243993744  41271920 202587376    17%  192669 2025873760    0%   /Volumes/Fast SSD
/dev/disk6s1     976729216 646720256 330008960    67%       1          0  100%   /Volumes/Backup
/dev/disk3s3     239362496   1486224  26955032     6%      63  269550320    0%   /Volumes/Recovery
`;

test('parseDfMounts keeps / and /Volumes/* (with spaces) and skips system volumes', () => {
  assert.deepEqual(
    parseDfMounts(DF_OUTPUT).map((entry) => entry.mount),
    ['/', '/Volumes/Fast SSD', '/Volumes/Backup', '/Volumes/Recovery'],
  );
});

test('diskFromInfo uses the whole APFS container, not the sealed system volume', () => {
  // `df /` reported 13 GB used here; the container is ~89% full.
  const disk = diskFromInfo({
    VolumeName: 'Macintosh HD',
    Internal: true,
    FilesystemType: 'apfs',
    APFSContainerReference: 'disk3',
    APFSContainerSize: 245107195904,
    APFSContainerFree: 27595571200,
    BusProtocol: 'Apple Fabric',
  }, '/');
  assert.equal(disk.name, 'Macintosh HD');
  assert.equal(disk.usedBytes, 245107195904 - 27595571200);
  assert.equal(disk.pct, 89);
});

test('diskFromInfo handles non-APFS volumes and ignores disk images', () => {
  const exfat = diskFromInfo({ VolumeName: 'Backup', FilesystemType: 'exfat', TotalSize: 1000170717184, FreeSpace: 337929175040 }, '/Volumes/Backup');
  assert.equal(exfat.pct, 66);
  assert.equal(exfat.container, null);
  assert.equal(diskFromInfo({ VolumeName: 'Installer', BusProtocol: 'Disk Image', TotalSize: 1e9, FreeSpace: 0 }, '/Volumes/Installer'), null);
  assert.equal(diskFromInfo(null, '/Volumes/Gone'), null);
});

test('dedupeDisks shows one entry per APFS container, startup disk first', () => {
  const disks = dedupeDisks([
    { name: 'Backup', mount: '/Volumes/Backup', internal: false, container: null },
    { name: 'Recovery', mount: '/Volumes/Recovery', internal: true, container: 'disk3' },
    { name: 'Macintosh HD', mount: '/', internal: true, container: 'disk3' },
    { name: 'Archive', mount: '/Volumes/Archive', internal: false, container: 'disk8' },
  ]);
  // Recovery shares the startup container; even listed first it must not
  // replace or duplicate "Macintosh HD".
  assert.deepEqual(disks.map((disk) => disk.name), ['Macintosh HD', 'Archive', 'Backup']);
});

test('summarizeTemperatures averages SoC die sensors and reports the SSD', () => {
  const summary = summarizeTemperatures([
    { name: 'PMU tdie1', c: 50 },
    { name: 'PMU2 tdie3', c: 60 },
    { name: 'PMU tcal', c: 51.8 },
    { name: 'NAND CH0 temp', c: 41.4 },
  ]);
  assert.deepEqual(summary, { socAvgC: 55, socMaxC: 60, ssdC: 41 });
  assert.equal(summarizeTemperatures([]), null);
  assert.equal(summarizeTemperatures('garbage'), null);
});
