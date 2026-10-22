const assert = require('node:assert/strict');
const { test } = require('node:test');
const macstats = require('../backend/collectors/macstats');
const { createServer } = require('../backend/server');

test('macstats collector returns disks, temperature and system info', async () => {
  const data = await macstats.collect();
  assert.equal(data.tool, 'macstats');
  assert.equal(data.label, 'Mac Stats');
  assert.ok(Array.isArray(data.disks));
  for (const disk of data.disks) {
    assert.equal(typeof disk.name, 'string');
    assert.ok(disk.totalBytes > 0);
    assert.ok(disk.usedBytes >= 0 && disk.usedBytes <= disk.totalBytes);
    assert.ok(disk.pct >= 0 && disk.pct <= 100);
  }
  if (process.platform === 'darwin') {
    assert.ok(data.disks.some((disk) => disk.mount === '/'), 'the startup disk is listed');
  }
  // Temperature is optional (needs the native helper and sensors).
  assert.ok(data.temperature === null || typeof data.temperature === 'object');
  assert.equal(data.cpuPct, undefined);
  assert.ok(data.uptime);
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
