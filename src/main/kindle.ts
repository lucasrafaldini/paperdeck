import type {
  KindleConnectResult,
  KindleConnectionTarget,
  KindleDevice,
  KindleInstallResult,
  KindleScriptStatus,
  KindleStatus,
} from '../shared/types'
import {
  kindleAutostartModule,
  ksshModule,
  type SshClient,
  type SshOptions,
} from './backend-bridge'
import {
  type StoredDashboardConfig,
  decryptPassword,
  encryptedPasswordFields,
  loadConfig,
  publicConfig,
  writeConfig,
} from './config'
import { text } from './i18n'

function sshOptions(config: StoredDashboardConfig): SshOptions {
  const password = decryptPassword(config)

  return {
    host: config.kindleIp || '',
    password: password || undefined,
    port: config.kindlePort || 22,
    username: config.kindleUser || 'root',
  }
}

function kindleEnvironment(config: StoredDashboardConfig): Record<string, string> {
  return {
    DASHBOARD_URL: config.dashboardUrl,
    KINDLE_FULL_REFRESH_EVERY: String(config.kindleFullRefreshEvery),
    KINDLE_REFRESH_INTERVAL: String(config.kindleRefreshInterval),
    KINDLE_WIFI_RETRY_EVERY: String(config.kindleWifiRetryEvery),
  }
}

function parseKeyValueOutput(output: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf('=')
    if (index > 0) fields[line.slice(0, index)] = line.slice(index + 1)
  }
  return fields
}

function boolField(fields: Record<string, string>, key: string): boolean {
  return fields[key] === 'yes'
}

// Translate raw ssh2/socket errors into something a person can act on.
export function friendlySshError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const code = (error as NodeJS.ErrnoException | null)?.code ?? ''
  const lower = raw.toLowerCase()
  if (lower.includes('authentication') || lower.includes('auth fail')) return text('sshAuthFailed')
  if (lower.includes('kindle_pw or ssh key')) return text('sshNoCredentials')
  if (code === 'ECONNREFUSED' || lower.includes('econnrefused')) return text('sshRefused')
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || lower.includes('unreach')) return text('sshUnreachable')
  if (code === 'ETIMEDOUT' || lower.includes('timed out') || lower.includes('timeout')) return text('sshTimeout')
  if (lower.includes('kindle_ip is required')) return text('sshNoHost')
  return raw
}

async function probeKindle(options: SshOptions): Promise<KindleStatus> {
  const checkedAt = new Date().toISOString()
  let client: SshClient | null = null

  try {
    client = await ksshModule().connect(options)
    const result = await ksshModule().execCommand(client, `
PATH=/sbin:/usr/sbin:/bin:/usr/bin
export PATH
yn() { if "$@" >/dev/null 2>&1; then echo yes; else echo no; fi; }
MODEL="$(cat /etc/prettyversion.txt 2>/dev/null || uname -a)"
echo "model=$MODEL"
echo "path=$PATH"
echo "fbink=$(yn command -v fbink)"
echo "initctl=$(yn command -v initctl)"
echo "mntroot=$(yn command -v mntroot)"
echo "mntus=$(yn test -d /mnt/us)"
echo "hotfix=$(yn test -f /etc/upstart/kmc.conf)"
`)

    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`)
    }

    const fields = parseKeyValueOutput(result.stdout)
    const fbink = boolField(fields, 'fbink')
    const initctl = boolField(fields, 'initctl')
    const mntroot = boolField(fields, 'mntroot')
    const mntus = boolField(fields, 'mntus')
    const hotfix = boolField(fields, 'hotfix')
    const jailbroken = fbink && initctl && mntroot && mntus
    const canInstall = jailbroken && hotfix
    const missing = [
      !fbink && 'fbink',
      !initctl && 'initctl',
      !mntroot && 'mntroot',
      !mntus && '/mnt/us',
      !hotfix && 'hotfix/Upstart',
    ].filter(Boolean).join(', ')
    const detail = canInstall
      ? text('verifyReady')
      : text('verifyMissing', { missing, path: fields.path || 'unknown' })

    return {
      canInstall,
      checkedAt,
      connected: true,
      detail,
      fbink,
      hotfix,
      initctl,
      jailbroken,
      mntroot,
      mntus,
      model: fields.model || null,
    }
  } catch (error) {
    return {
      canInstall: false,
      checkedAt,
      connected: false,
      detail: text('verifyFail', { message: friendlySshError(error) }),
      fbink: false,
      hotfix: false,
      initctl: false,
      jailbroken: false,
      mntroot: false,
      mntus: false,
      model: null,
    }
  } finally {
    client?.end()
  }
}

export async function checkKindle(): Promise<KindleStatus> {
  return probeKindle(sshOptions(await loadConfig()))
}

// Test SSH against an arbitrary target and, only when it answers, save it as
// the active Kindle (adding it to the device list or updating the match).
export async function connectKindle(target: KindleConnectionTarget): Promise<KindleConnectResult> {
  const config = await loadConfig()
  const ip = String(target.ip || '').trim()
  const port = Number.isInteger(target.port) && target.port > 0 && target.port <= 65535 ? target.port : 22
  const user = String(target.user || '').trim() || 'root'
  const typedPassword = typeof target.password === 'string' ? target.password : ''
  const savedPassword = ip === config.kindleIp ? decryptPassword(config) : ''
  const password = typedPassword || savedPassword

  const status = await probeKindle({
    host: ip,
    password: password || undefined,
    port,
    readyTimeout: 8000,
    retries: 2,
    username: user,
  })
  if (!status.connected) return { status, config: null }

  const devices = (config.kindleDevices ?? []).filter((device) => device.ip)
  const existing = devices.find((device) => device.ip === ip)
  const device: KindleDevice = {
    ...(existing ?? {}),
    id: existing?.id ?? `k_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: target.name?.trim() || existing?.name || 'Kindle',
    ip,
    port,
    user,
  }
  const kindleDevices = existing
    ? devices.map((item) => (item.id === device.id ? device : item))
    : [...devices, device]

  const next = {
    ...config,
    kindleDevices,
    activeKindleId: device.id,
    kindleIp: ip,
    kindlePort: port,
    kindleUser: user,
    ...(typedPassword ? encryptedPasswordFields(typedPassword) : {}),
  }
  await writeConfig(next)
  return { status, config: publicConfig(next) }
}

export async function installKindle(): Promise<KindleInstallResult> {
  const config = await loadConfig()
  const status = await checkKindle()
  if (!status.canInstall) throw new Error(status.detail)

  const result = await kindleAutostartModule().runAction('install', {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || text('installFailed', { code: String(result.code) }))

  const next = { ...config, setupComplete: true }
  await writeConfig(next)

  return {
    config: publicConfig(next),
    output: result.output,
    status: result.status,
  }
}

export async function uninstallKindle(): Promise<KindleInstallResult> {
  const config = await loadConfig()

  const result = await kindleAutostartModule().runAction('uninstall', {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || text('uninstallFailed', { code: String(result.code) }))

  const next = { ...config, setupComplete: false }
  await writeConfig(next)

  return {
    config: publicConfig(next),
    output: result.output,
    status: result.status,
  }
}

export async function manageKindleScript(action: 'status' | 'start' | 'stop'): Promise<KindleScriptStatus> {
  const config = await loadConfig()
  const result = await kindleAutostartModule().runAction(action, {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || text('scriptActionFailed', { code: String(result.code) }))
  return result.status
}
