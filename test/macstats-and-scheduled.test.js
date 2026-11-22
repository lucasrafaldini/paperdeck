const assert = require('node:assert/strict');
const { test } = require('node:test');
const macstats = require('../backend/collectors/macstats');
const { createServer } = require('../backend/server');

test('macstats collector returns valid macOS metrics', async () => {
  const data = await macstats.collect();
  assert.equal(data.tool, 'macstats');
  assert.equal(data.label, 'Mac Stats');
  assert.equal(typeof data.cpuPct, 'number');
  assert.ok(data.cpuPct >= 0 && data.cpuPct <= 100);
  assert.equal(typeof data.memPct, 'number');
  assert.ok(data.memPct >= 0 && data.memPct <= 100);
  assert.equal(typeof data.diskPct, 'number');
  assert.ok(data.diskPct >= 0 && data.diskPct <= 100);
  assert.ok(data.uptime);
  assert.ok(data.diskTotalGb === 0 || data.diskUsedGb <= data.diskTotalGb);
  assert.equal(typeof data.osRelease, 'string');
  if (process.platform !== 'darwin') assert.doesNotMatch(data.osRelease, /^macOS/);
});

test('macstats parseDfOutput counts the whole APFS container as used', () => {
  // Volume de dados do APFS: o container é compartilhado, então usado = total − disponível.
  const df = [
    'Filesystem     1024-blocks      Used Available Capacity iused     ifree %iused  Mounted on',
    '/dev/disk3s5     239362496 191900568  22933236    90% 2153127 229332360    1%   /System/Volumes/Data',
  ].join('\n');
  const disk = macstats.parseDfOutput(df);
  assert.equal(disk.totalGb, 228);
  assert.equal(disk.freeGb, 22);
  assert.equal(disk.usedGb, 206);
  assert.equal(disk.pct, 90);

  assert.deepEqual(macstats.parseDfOutput(''), { totalGb: 0, usedGb: 0, freeGb: 0, pct: 0 });
  assert.deepEqual(macstats.parseDfOutput('Filesystem 1024-blocks Used Available'), {
    totalGb: 0, usedGb: 0, freeGb: 0, pct: 0,
  });
});

test('scheduled notifications flow (schedule, list, cancel)', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Schedule a notification
    const schedTime = Date.now() + 600000;
    const postRes = await fetch(`${baseUrl}/api/notify/scheduled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Teste de agendamento',
        scheduledFor: schedTime,
        durationSec: 900,
      }),
    });
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.ok(postData.ok);
    assert.equal(postData.item.message, 'Teste de agendamento');
    const itemId = postData.item.id;

    // 2. List scheduled notifications
    const getRes = await fetch(`${baseUrl}/api/notify/scheduled`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(Array.isArray(getData.scheduledNotifications));
    assert.ok(getData.scheduledNotifications.some((n) => n.id === itemId));

    // 3. Cancel scheduled notification
    const delRes = await fetch(`${baseUrl}/api/notify/scheduled`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
    });
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.ok(delData.ok);
    assert.ok(!delData.scheduledNotifications.some((n) => n.id === itemId));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
