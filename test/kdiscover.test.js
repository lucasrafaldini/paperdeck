const assert = require('node:assert/strict');
const net = require('node:net');
const { test } = require('node:test');
const {
  enumerateHosts,
  isLikelyKindle,
  rankCandidates,
  probeHost,
} = require('../scripts/kdiscover');

test('enumerateHosts covers .1 through .254 and skips the host itself', () => {
  const hosts = enumerateHosts('192.0.2', '192.0.2.10');
  assert.equal(hosts.length, 253);
  assert.equal(hosts[0], '192.0.2.1');
  assert.equal(hosts[hosts.length - 1], '192.0.2.254');
  assert.ok(!hosts.includes('192.0.2.10'));
});

test('isLikelyKindle matches Dropbear banners and kindle hostnames', () => {
  assert.ok(isLikelyKindle({ banner: 'SSH-2.0-dropbear_2012.55' }));
  assert.ok(isLikelyKindle({ hostname: 'kindle.local' }));
  assert.ok(!isLikelyKindle({ banner: 'SSH-2.0-OpenSSH_9.6', hostname: 'nas.local' }));
  assert.ok(!isLikelyKindle({}));
});

test('rankCandidates puts likely Kindles first, then sorts by IP', () => {
  const ranked = rankCandidates([
    { ip: '192.0.2.50', likelyKindle: false },
    { ip: '192.0.2.30', likelyKindle: true },
    { ip: '192.0.2.9', likelyKindle: false },
    { ip: '192.0.2.200', likelyKindle: true },
  ]);
  assert.deepEqual(
    ranked.map((c) => c.ip),
    ['192.0.2.30', '192.0.2.200', '192.0.2.9', '192.0.2.50'],
  );
});

test('probeHost returns the banner for an open port and null for a closed one', async () => {
  const server = net.createServer((socket) => {
    // Dropbear sends KEXINIT binary right after the ident line in one chunk.
    socket.write(Buffer.concat([Buffer.from('SSH-2.0-dropbear_2020.81\r\n'), Buffer.from([0, 0, 1, 0xfc, 8, 0x14, 0x32])]));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const open = await probeHost('127.0.0.1', port, { connectTimeout: 1000, bannerTimeout: 500 });
    assert.ok(open);
    assert.equal(open.ip, '127.0.0.1');
    assert.equal(open.port, port);
    assert.equal(open.banner, 'SSH-2.0-dropbear_2020.81');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // Nothing is listening on this throwaway port now that the server is closed.
  const closed = await probeHost('127.0.0.1', port, { connectTimeout: 800, bannerTimeout: 300 });
  assert.equal(closed, null);
});
