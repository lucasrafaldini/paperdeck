const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const originalFetch = global.fetch;
const originalDateNow = Date.now;

function writeCredentials(homeDir) {
  const file = path.join(homeDir, '.claude', '.credentials.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ claudeAiOauth: { accessToken: 'test-token' } }));
}

function usagePayload(nowMs, fiveHourOffsetMs, sevenDayOffsetMs) {
  return {
    five_hour: {
      utilization: 42,
      resets_at: new Date(nowMs + fiveHourOffsetMs).toISOString(),
    },
    seven_day: {
      utilization: 7,
      resets_at: new Date(nowMs + sevenDayOffsetMs).toISOString(),
    },
  };
}

function loadCollectorForHome(homeDir) {
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  const modulePath = require.resolve('../backend/collectors/claude');
  delete require.cache[modulePath];
  return require('../backend/collectors/claude');
}

afterEach(() => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  global.fetch = originalFetch;
  Date.now = originalDateNow;
  const modulePath = require.resolve('../backend/collectors/claude');
  delete require.cache[modulePath];
});

test('claude collector drops cached five hour window after reset', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-claude-'));
  const startMs = Date.parse('2026-06-30T04:00:00.000Z');
  let nowMs = startMs;
  let fetchCalls = 0;

  try {
    writeCredentials(homeDir);
    Date.now = () => nowMs;
    global.fetch = async () => {
      fetchCalls += 1;
      return {
        ok: true,
        json: async () => usagePayload(startMs, 60_000, 7 * 24 * 60 * 60 * 1000),
      };
    };

    const collector = loadCollectorForHome(homeDir);
    const live = await collector.collect();
    assert.equal(live.confidence, 'live');
    assert.deepEqual(live.windows.map((window) => window.name), ['5h', '7d']);

    nowMs = startMs + 120_000;
    const cached = await collector.collect();
    assert.equal(cached.confidence, 'cached');
    assert.deepEqual(cached.windows, [
      { name: '7d', pct: 7, resets_at: new Date(startMs + 7 * 24 * 60 * 60 * 1000).toISOString() },
    ]);
    assert.equal(fetchCalls, 1);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('claude collector marks cached limits stale after all windows expire', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-claude-'));
  const startMs = Date.parse('2026-06-30T04:00:00.000Z');
  let nowMs = startMs;
  let fetchCalls = 0;

  try {
    writeCredentials(homeDir);
    Date.now = () => nowMs;
    global.fetch = async () => {
      fetchCalls += 1;
      if (fetchCalls > 1) throw new Error('network down');
      return {
        ok: true,
        json: async () => usagePayload(startMs, 60_000, 120_000),
      };
    };

    const collector = loadCollectorForHome(homeDir);
    await collector.collect();

    nowMs = startMs + 181_000;
    const stale = await collector.collect();
    assert.equal(stale.confidence, 'stale');
    assert.deepEqual(stale.windows, []);
    assert.equal(stale.noteKey, 'claudeStale');
    assert.equal(stale.staleSince, new Date(startMs + 120_000).toISOString());
    assert.equal(stale.error, 'network down');
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('claude collector calculates 5h and 7d resets from desktop history', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-claude-'));
  const historyPath = path.join(homeDir, 'Library', 'Application Support', 'Claude', 'plan-usage-history.json');
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });

  const t0 = Date.parse('2026-09-01T12:00:00.000Z');
  const samples = [
    { t: t0, org: 'test-org', u: { fh: 0, sd: 0 } },
    { t: t0 + 3600_000, org: 'test-org', u: { fh: 20, sd: 10 } },
    { t: t0 + 7200_000, org: 'test-org', u: { fh: 45, sd: 15 } }
  ];
  fs.writeFileSync(historyPath, JSON.stringify({ samples }));

  try {
    Date.now = () => t0 + 7200_000;
    const collector = loadCollectorForHome(homeDir);
    const res = await collector.collect();

    assert.equal(res.tool, 'claude');
    assert.equal(res.windows.length, 2);
    const w5h = res.windows.find(w => w.name === '5h');
    const w7d = res.windows.find(w => w.name === '7d');

    assert.ok(w5h && w5h.resets_at, '5h should have resets_at');
    assert.ok(w7d && w7d.resets_at, '7d should have resets_at');
    assert.equal(w5h.pct, 45);
    assert.equal(w7d.pct, 15);
    // 5h window started at t0 + 3600_000 -> resets at t0 + 3600_000 + 5h
    assert.equal(w5h.resets_at, new Date(t0 + 3600_000 + 5 * 3600_000).toISOString());
    // 7d window started at t0 -> resets at t0 + 7 * 24 * 3600_000
    assert.equal(w7d.resets_at, new Date(t0 + 7 * 24 * 3600_000).toISOString());
    assert.ok(Array.isArray(res.historyPoints), 'historyPoints should be an array');
    assert.equal(res.historyPoints.length, 7);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

