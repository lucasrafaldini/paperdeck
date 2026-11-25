const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const script = fs.readFileSync(path.join(__dirname, '..', 'kindle', 'dash-loop.sh'), 'utf8');

function extractFunction(name) {
  const start = script.indexOf(`${name}() {`);
  assert.notEqual(start, -1, `${name} not found in dash-loop.sh`);
  const end = script.indexOf('\n}\n', start);
  return script.slice(start, end + 2);
}

test('dash-loop scan_subnet finds the backend anywhere in the /24', async () => {
  let pings = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/api/ping') pings += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const program = `${extractFunction('scan_subnet')}\nscan_subnet 127.0.0 127.0.0.99 ${port}\n`;
    const output = await new Promise((resolve, reject) => {
      execFile('sh', ['-c', program], { timeout: 30000 }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
    assert.match(output, /^127\.0\.0\.\d+$/);
    assert.ok(pings > 0, 'backend should have been pinged');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
