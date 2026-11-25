const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const network = require('../backend/collectors/network');
const temperature = require('../backend/collectors/temperature');

after(() => network.stopSampler());

test('parseNetstatIbn reads byte counters from the <Link#> row', () => {
  const out = [
    'Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll',
    'lo0        16384 <Link#1>                         72605     0  372848036    72605     0  372848036     0',
    'lo0        16384 127           127.0.0.1          72605     -  372848036    72605     -  372848036     -',
    'en0        1500  <Link#7>    aa:bb:cc:dd:ee:ff  3103406     0 4339641987   572097     0  142377925     0',
    'en0        1500  fe80::1     fe80::1%en0        3103406     - 4339641987   572097     -  142377925     -',
  ].join('\n');
  assert.deepEqual(network.parseNetstatIbn(out), {
    lo0: { rx: 372848036, tx: 372848036 },
    en0: { rx: 4339641987, tx: 142377925 },
  });
});

test('parseProcNetDev and parseNetstatE read Linux and Windows counters', () => {
  const proc = [
    'Inter-|   Receive                                                |  Transmit',
    ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
    '    lo:  1000      10    0    0    0     0          0         0     1000      10    0    0    0     0       0          0',
    '  eth0: 987654321 1000  0    0    0     0          0         0  12345678   900    0    0    0     0       0          0',
  ].join('\n');
  assert.deepEqual(network.parseProcNetDev(proc).eth0, { rx: 987654321, tx: 12345678 });

  const win = 'Interface Statistics\n\n                           Received            Sent\n\nBytes                    1234567890       98765432\nUnicast packets             100             200\n';
  assert.deepEqual(network.parseNetstatE(win), { '*': { rx: 1234567890, tx: 98765432 } });
});

test('interface helpers detect port type and link speed', () => {
  const ports = 'Hardware Port: Ethernet\nDevice: en0\nEthernet Address: aa\n\nHardware Port: Wi-Fi\nDevice: en1\n';
  assert.deepEqual(network.parseHardwarePorts(ports), { en0: 'Ethernet', en1: 'Wi-Fi' });
  assert.equal(network.parseIfconfigMedia('\tmedia: autoselect (1000baseT <full-duplex>)'), 1000);
  assert.equal(network.parseIfconfigMedia('\tmedia: autoselect (10GbaseT <full-duplex>)'), 10000);
  assert.equal(network.parseIfconfigMedia('\tmedia: autoselect'), null);
  assert.equal(network.guessKindFromName('wlan0'), 'wifi');
  assert.equal(network.guessKindFromName('Wi-Fi'), 'wifi');
  assert.equal(network.guessKindFromName('enp3s0'), 'ethernet');
  assert.equal(network.guessKindFromName('utun3'), 'vpn');
});

test('speed comes from counter deltas and the 10-minute history', () => {
  network._reset();
  const t0 = 1_700_000_010_000;
  // 12,5 MB/s de download (100 Mbps) e 0,25 MB/s de upload, amostras a cada 2 s.
  for (let i = 0; i <= 5; i++) {
    network._addSample({ t: t0 + i * 2000, rx: 1e9 + i * 25e6, tx: 5e8 + i * 0.5e6 });
  }
  const rates = network.currentRates();
  assert.equal(Math.round(rates.rxBps), 12_500_000);
  assert.equal(Math.round(rates.txBps), 250_000);

  const summary = network.historySummary();
  assert.ok(summary.downloadHistoryBps.length >= 1);
  assert.equal(summary.peakDownloadBps, 12_500_000);
  assert.equal(summary.avgDownloadBps, 12_500_000);

  // Contador reiniciado (sleep/troca de interface) não gera velocidade negativa.
  network._addSample({ t: t0 + 12000, rx: 10, tx: 10 });
  assert.ok(network.historySummary().peakDownloadBps <= 12_500_000);
  network._reset();
});

test('network collector returns live rates in the dashboard shape', async () => {
  const data = await network.collect();
  assert.equal(data.tool, 'network');
  assert.equal(data.labelKey, 'networkTitle');
  if (data.confidence === 'live') {
    assert.equal(typeof data.downloadBps, 'number');
    assert.ok(data.downloadBps >= 0);
    assert.ok(data.uploadBps >= 0);
    assert.ok(Array.isArray(data.downloadHistoryBps));
  }
  network.stopSampler();
});

test('temperature summarizes Apple Silicon sensors and thermal state', () => {
  const out = JSON.stringify({
    thermal: 1,
    sensors: [
      ['PMU tdie1', 50], ['PMU tdie2', 60], ['PMU2 tdie3', 70],
      ['NAND CH0 temp', 45], ['PMU tcal', 51.8], ['bogus', -20], ['broken', 400],
    ],
  });
  const parsed = temperature.parseMacOutput(out);
  assert.equal(parsed.cpuTempC, 60);
  assert.equal(parsed.cpuTempMaxC, 70);
  assert.equal(parsed.ssdTempC, 45);
  assert.equal(parsed.thermalState, 'fair');
  assert.equal(parsed.sensorCount, 5);

  const empty = temperature.parseMacOutput('');
  assert.equal(empty.cpuTempC, null);
  assert.equal(empty.thermalState, null);
});
