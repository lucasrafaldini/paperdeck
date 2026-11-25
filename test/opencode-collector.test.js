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

test('findOpencodeProcess only matches the OpenCode executable, not paths in other commands', () => {
  const { findOpencodeProcess } = require('../backend/collectors/opencode');
  // Shells, editors or this repo's collector file mention "opencode" but are not it.
  const unrelated = [
    '/bin/zsh /bin/zsh -c grep opencode backend/collectors/opencode.js',
    'cat cat /Users/me/.local/share/opencode/opencode',
    '/Applications/Code.app/Contents/MacOS/Electron /Applications/Code.app/Contents/MacOS/Electron --file opencode.json',
  ].join('\n');
  assert.deepEqual(findOpencodeProcess(unrelated), { running: false, model: null });

  assert.deepEqual(
    findOpencodeProcess('/opt/homebrew/bin/opencode /opt/homebrew/bin/opencode --model ollama/qwen3'),
    { running: true, model: 'ollama/qwen3' },
  );
  assert.equal(findOpencodeProcess('node node /usr/local/lib/node_modules/opencode-ai/bin/opencode').running, true);
  assert.equal(findOpencodeProcess('').running, false);
});
