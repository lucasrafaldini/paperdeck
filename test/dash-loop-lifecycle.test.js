const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const SOURCE = path.join(__dirname, '..', 'kindle', 'dash-loop.sh');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-loop-'));
  fs.copyFileSync(SOURCE, path.join(dir, 'dash-loop.sh'));
  return dir;
}

function startLoop(dir) {
  // Port 9 refuses connections, so every cycle fails fast and then naps.
  const child = spawn('sh', [path.join(dir, 'dash-loop.sh')], {
    env: {
      ...process.env,
      DASH_DIR: dir,
      PC: 'http://127.0.0.1:9/dash.png',
      INTERVAL: '30',
      WIFI_RETRY_EVERY: '100',
    },
    stdio: 'ignore',
  });
  child.exited = new Promise((resolve) => child.once('exit', () => resolve(true)));
  return child;
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return predicate();
}

function readPid(dir) {
  try {
    return fs.readFileSync(path.join(dir, 'dash-loop.pid'), 'utf8').trim();
  } catch {
    return '';
  }
}

function within(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(false), ms))]);
}

test('dash-loop exits promptly on TERM and removes its own PID file', async () => {
  const dir = sandbox();
  const loop = startLoop(dir);
  try {
    assert.ok(await waitFor(() => readPid(dir) === String(loop.pid), 5000), 'loop should record its PID');
    loop.kill('SIGTERM');
    assert.equal(await within(loop.exited, 4000), true, 'loop must exit instead of ignoring TERM');
    assert.equal(readPid(dir), '');
  } finally {
    loop.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('starting a new dash-loop replaces the running one instead of stacking', async () => {
  const dir = sandbox();
  const first = startLoop(dir);
  let second;
  try {
    assert.ok(await waitFor(() => readPid(dir) === String(first.pid), 5000));
    second = startLoop(dir);
    assert.equal(await within(first.exited, 8000), true, 'previous loop should be stopped');
    assert.ok(await waitFor(() => readPid(dir) === String(second.pid), 5000), 'new loop owns the PID file');
  } finally {
    first.kill('SIGKILL');
    second?.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
