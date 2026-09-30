const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const antigravity = require('../backend/collectors/antigravity');

test('parseWindows extracts 5h and 7d limits from Language Server response', () => {
  const mockQuota = {
    groups: [
      {
        displayName: 'Gemini Models',
        buckets: [
          {
            bucketId: 'gemini-5h',
            window: '5h',
            remainingFraction: 0.85,
            resetTime: '2026-09-14T20:00:00Z',
          },
          {
            bucketId: 'gemini-weekly',
            window: 'weekly',
            remainingFraction: 0.60,
            resetTime: '2026-09-20T12:00:00Z',
          },
        ],
      },
    ],
  };

  const windows = antigravity.parseWindows(mockQuota);
  assert.equal(windows.length, 2);

  const w5h = windows.find((w) => w.name === '5h');
  assert.ok(w5h);
  assert.equal(w5h.pct, 15); // 1 - 0.85 = 15%
  assert.equal(w5h.resets_at, '2026-09-14T20:00:00Z');

  const w7d = windows.find((w) => w.name === '7d');
  assert.ok(w7d);
  assert.equal(w7d.pct, 40); // 1 - 0.60 = 40%
  assert.equal(w7d.resets_at, '2026-09-20T12:00:00Z');
});

test('countLinesFast accurately counts line breaks in files', () => {
  const tmpFile = path.join(os.tmpdir(), `agy-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'line1\nline2\nline3\n');
  try {
    assert.equal(antigravity.countLinesFast(tmpFile), 3);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

test('antigravity collector collects data without ReferenceError', async () => {
  const data = await antigravity.collect();
  assert.equal(data.tool, 'antigravity');
  assert.equal(data.label, 'Antigravity AI');
  assert.notEqual(data.confidence, 'error');
  assert.ok(Array.isArray(data.windows));
  assert.ok(Array.isArray(data.historyPoints));
  assert.equal(data.historyPoints.length, 7);
  assert.equal(typeof data.totalConversations, 'number');
  assert.equal(typeof data.totalBrainProjects, 'number');
  assert.equal(typeof data.activeSessionSteps, 'number');
});
