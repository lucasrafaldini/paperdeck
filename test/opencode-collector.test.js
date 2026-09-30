const assert = require('node:assert/strict');
const { test } = require('node:test');
const opencode = require('../backend/collectors/opencode');

test('opencode collector handles missing database gracefully', async () => {
  const data = await opencode.collect('/tmp/nonexistent-opencode-' + Date.now() + '.db');
  assert.equal(data.tool, 'opencode');
  assert.equal(data.label, 'OpenCode');
  assert.equal(data.confidence, 'idle');
  assert.equal(data.status, 'Inativo');
  assert.equal(data.totalSessions, 0);
  assert.equal(data.totalMessages, 0);
  assert.equal(data.totalTokens, 0);
  assert.ok(data.error);
});

test('opencode collector returns valid payload when database exists', async () => {
  const data = await opencode.collect();
  assert.equal(data.tool, 'opencode');
  assert.equal(data.label, 'OpenCode');
  assert.ok(['live', 'idle'].includes(data.confidence));
  assert.equal(typeof data.totalSessions, 'number');
  assert.equal(typeof data.totalMessages, 'number');
  assert.equal(typeof data.totalTokens, 'number');
  assert.equal(typeof data.inputTokens, 'number');
  assert.equal(typeof data.outputTokens, 'number');
  assert.equal(typeof data.cacheReadTokens, 'number');
  assert.ok(Array.isArray(data.historyPoints));
  assert.equal(data.historyPoints.length, 7);
  assert.ok(Array.isArray(data.topModels));
});
