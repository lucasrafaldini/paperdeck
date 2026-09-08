#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const IMAGE = path.join(OUT, 'dash.png');
const PROFILE = '/tmp/ff_headless';

const FIREFOX_PATHS = [
  process.env.FIREFOX,
  '/Applications/Firefox.app/Contents/MacOS/firefox',
  '/usr/local/bin/firefox',
];

function findFirefox() {
  const found = FIREFOX_PATHS.filter(Boolean).find((p) => fs.existsSync(p));
  if (!found) throw new Error('Firefox not found');
  return found;
}

async function renderOnce(options = {}) {
  const port = options.port || 8787;
  const width = options.width || 600;
  const height = options.height || 800;
  const firefox = findFirefox();

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PROFILE, { recursive: true });

  const tempImage = path.join(OUT, `dash-${process.pid}-${Date.now()}.png`);
  const url = `http://127.0.0.1:${port}/render?device=kt3`;

  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--no-remote',
      '--profile', PROFILE,
      `--screenshot=${tempImage}`,
      `--window-size=${width},${height}`,
      url,
    ];

    const child = spawn(firefox, args, { stdio: 'ignore' });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Firefox render timed out'));
    }, 15000);

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(tempImage) && fs.statSync(tempImage).size > 0) {
        fs.renameSync(tempImage, IMAGE);
        resolve(IMAGE);
      } else {
        try { fs.unlinkSync(tempImage); } catch {}
        reject(new Error(`Firefox exited with code ${code}`));
      }
    });
  });
}

if (require.main === module) {
  renderOnce()
    .then((p) => console.log('Rendered successfully to', p))
    .catch((err) => { console.error('Render failed:', err); process.exit(1); });
}

module.exports = { renderOnce };
