#!/usr/bin/env node
// Kindle network discovery helper.
//
// Scans the host's local IPv4 /24 subnet(s) for hosts with the SSH port open,
// grabs the SSH identification banner, resolves a reverse-DNS hostname and
// flags the ones that look like a jailbroken Kindle (Dropbear SSH / "kindle"
// hostname). No credentials are used — confirmation happens later via kssh.
//
// Usage:
//   node scripts/kdiscover.js [port]

const net = require('net');
const os = require('os');
const dns = require('dns').promises;

// A Kindle runs a Dropbear SSH server, so its banner carries "dropbear"; some
// setups also expose a "kindle" hostname over mDNS/DNS.
function isLikelyKindle({ banner, hostname } = {}) {
  const b = String(banner || '').toLowerCase();
  const h = String(hostname || '').toLowerCase();
  return b.includes('dropbear') || h.includes('kindle');
}

// Private IPv4 interfaces on this host. We assume a /24 (the common home case)
// and key each subnet by its first three octets.
function localSubnets() {
  const interfaces = os.networkInterfaces();
  const seen = new Set();
  const subnets = [];
  for (const list of Object.values(interfaces)) {
    for (const info of list || []) {
      const family = typeof info.family === 'string' ? info.family : info.family === 4 ? 'IPv4' : 'IPv6';
      if (family !== 'IPv4' || info.internal) continue;
      const base = info.address.split('.').slice(0, 3).join('.');
      if (seen.has(base)) continue;
      seen.add(base);
      subnets.push({ address: info.address, base });
    }
  }
  return subnets;
}

// Every usable host address in a /24, skipping the host's own address.
function enumerateHosts(base, selfAddress) {
  const hosts = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${base}.${i}`;
    if (ip !== selfAddress) hosts.push(ip);
  }
  return hosts;
}

// Probe a single host: resolve to the open port plus its SSH banner, or null.
function probeHost(ip, port = 22, { connectTimeout = 700, bannerTimeout = 500 } = {}) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;
    let banner = '';
    let settled = false;
    let bannerTimer = null;

    const finish = (open) => {
      if (settled) return;
      settled = true;
      if (bannerTimer) clearTimeout(bannerTimer);
      socket.destroy();
      // Servers like Dropbear send KEXINIT bytes right after the ident line;
      // keep only the printable "SSH-2.0-..." identification.
      const ident = banner.split(/\r?\n/)[0].replace(/[^\x20-\x7e]/g, '').trim();
      resolve(open ? { ip, port, banner: ident || null } : null);
    };

    socket.setTimeout(connectTimeout);
    socket.once('connect', () => {
      connected = true;
      socket.setTimeout(0);
      // Give the server a short moment to send its SSH identification string.
      bannerTimer = setTimeout(() => finish(true), bannerTimeout);
    });
    socket.once('data', (chunk) => {
      banner += chunk.toString('utf8');
      finish(true);
    });
    socket.once('timeout', () => finish(connected));
    socket.once('error', () => finish(false));
    socket.connect(port, ip);
  });
}

// Probe many hosts with a bounded worker pool to keep sockets in check.
async function scanHosts(hosts, port, { concurrency = 48, ...timeouts } = {}) {
  const results = [];
  let index = 0;
  const worker = async () => {
    while (index < hosts.length) {
      const ip = hosts[index++];
      const open = await probeHost(ip, port, timeouts);
      if (open) results.push(open);
    }
  };
  const pool = Array.from({ length: Math.min(concurrency, hosts.length || 1) }, worker);
  await Promise.all(pool);
  return results;
}

function ipToSortKey(ip) {
  return ip.split('.').reduce((acc, octet) => acc * 256 + (Number.parseInt(octet, 10) || 0), 0);
}

// Likely Kindles first, then ascending by IP.
function rankCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (a.likelyKindle !== b.likelyKindle) return a.likelyKindle ? -1 : 1;
    return ipToSortKey(a.ip) - ipToSortKey(b.ip);
  });
}

async function scanForKindles({ port = 22, concurrency, connectTimeout, bannerTimeout } = {}) {
  const scannedAt = new Date().toISOString();
  const subnets = localSubnets();
  if (subnets.length === 0) {
    return { scannedAt, subnets: [], candidates: [], error: 'no-network' };
  }

  const hosts = [];
  for (const subnet of subnets) hosts.push(...enumerateHosts(subnet.base, subnet.address));

  const open = await scanHosts(hosts, port, { concurrency, connectTimeout, bannerTimeout });

  const candidates = await Promise.all(
    open.map(async (entry) => {
      let hostname = null;
      try {
        const names = await dns.reverse(entry.ip);
        hostname = names?.[0] || null;
      } catch {
        hostname = null;
      }
      return {
        ip: entry.ip,
        port: entry.port,
        banner: entry.banner,
        hostname,
        likelyKindle: isLikelyKindle({ banner: entry.banner, hostname }),
      };
    }),
  );

  return {
    scannedAt,
    subnets: subnets.map((subnet) => `${subnet.base}.0/24`),
    candidates: rankCandidates(candidates),
  };
}

if (require.main === module) {
  const port = Number.parseInt(process.argv[2] || '22', 10) || 22;
  scanForKindles({ port })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(`kdiscover: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  enumerateHosts,
  isLikelyKindle,
  localSubnets,
  probeHost,
  rankCandidates,
  scanForKindles,
  scanHosts,
};
