import { execFile } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import { PORT } from './constants'

const execFileAsync = promisify(execFile)

let cachedAppCommit =
  process.env.APP_COMMIT?.trim() ||
  process.env.GIT_COMMIT?.trim() ||
  process.env.SOURCE_VERSION?.trim() ||
  ''

export function appAssetPath(name: string): string {
  if (app.isPackaged) return join(process.resourcesPath, name)
  const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
  return join(root, 'build', name)
}

export function runtimeOutputPath(): string {
  if (app.isPackaged) return join(app.getPath('userData'), 'runtime', 'dash.png')
  const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
  return join(root, 'out', 'dash.png')
}

export function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/

function isPrivateIpv4(address: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)
}

// Non-loopback IPv4 addresses this machine currently owns (Wi-Fi, Ethernet, VPN).
export function localIpv4Addresses(): string[] {
  const addresses: string[] = []
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')) {
        addresses.push(entry.address)
      }
    }
  }
  return addresses
}

// Best address for the Kindle to reach us: same /24 as the Kindle when known,
// then any private LAN address (skipping VPN-ish ranges), then anything.
export function preferredLanAddress(nearIp?: string, addresses = localIpv4Addresses()): string | null {
  const prefix = nearIp && IPV4_LITERAL.test(nearIp) ? nearIp.split('.').slice(0, 3).join('.') : null
  return (
    (prefix ? addresses.find((address) => address.startsWith(`${prefix}.`)) : undefined) ??
    addresses.find(isPrivateIpv4) ??
    addresses[0] ??
    null
  )
}

export function defaultDashboardUrl(nearIp?: string): string {
  const address = preferredLanAddress(nearIp)
  return `http://${address ?? '127.0.0.1'}:${PORT}/dash.png`
}

// When the Mac's IP changes (DHCP), an IP-literal dashboard URL goes stale and
// the Kindle can no longer fetch the image. Returns a corrected URL, or null
// when nothing should change (hostnames and still-valid IPs are left alone).
export function healedDashboardUrl(url: string, nearIp?: string, addresses = localIpv4Addresses()): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname
  if (!IPV4_LITERAL.test(host) || host.startsWith('127.')) return null
  if (addresses.includes(host)) return null
  const replacement = preferredLanAddress(nearIp, addresses)
  if (!replacement) return null
  parsed.hostname = replacement
  return parsed.toString()
}

export async function appCommitHash(): Promise<string> {
  if (cachedAppCommit) return cachedAppCommit.slice(0, 7)

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: app.getAppPath(),
      windowsHide: true,
    })
    cachedAppCommit = stdout.trim()
  } catch {
    cachedAppCommit = 'build'
  }

  return cachedAppCommit
}
