import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import { app, safeStorage } from 'electron'
import type { DashboardConfig, KindleDevice, LanguagePreference } from '../shared/types'
import { positiveInt } from './constants'
import { applyLanguagePreference, normalizeLanguagePreference, text } from './i18n'
import { configPath, defaultDashboardUrl } from './paths'

export interface StoredDashboardConfig {
  dashboardUrl: string
  language: LanguagePreference
  kindleFullRefreshEvery: number
  kindleIp: string
  kindlePasswordEncoding?: 'plain' | 'safeStorage'
  kindlePasswordEncrypted?: string
  kindlePasswordPlain?: string
  kindlePort: number
  kindleRefreshInterval: number
  kindleUser: string
  kindleWifiRetryEvery: number
  pictureInPicture: boolean
  pictureInPictureScale: number
  setupComplete: boolean
  kindleDevices?: KindleDevice[]
  activeKindleId?: string
}

// Multiplicadores de tamanho oferecidos na UI para a janela PiP.
export const PIP_SCALES = [1, 1.25, 1.5, 1.75, 2]
const DEFAULT_PIP_SCALE = 1.5

function normalizePipScale(raw: unknown): number {
  const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''))
  return PIP_SCALES.includes(value) ? value : DEFAULT_PIP_SCALE
}

let dashboardConfig: StoredDashboardConfig | null = null

export function currentConfig(): StoredDashboardConfig | null {
  return dashboardConfig
}

function defaultStoredConfig(): StoredDashboardConfig {
  const defaultDevices: KindleDevice[] = [
    {
      id: 'kindle-1',
      name: 'Kindle Principal (Mesa)',
      ip: '192.168.0.40',
      port: 22,
      user: 'root',
      notes: 'Kindle Touch 3 (KT3)',
    },
  ]

  return {
    dashboardUrl: defaultDashboardUrl(),
    language: 'system',
    kindleFullRefreshEvery: 20,
    kindleIp: '192.168.0.40',
    kindlePort: 22,
    kindleRefreshInterval: 180,
    kindleUser: 'root',
    kindleWifiRetryEvery: 3,
    pictureInPicture: false,
    pictureInPictureScale: DEFAULT_PIP_SCALE,
    setupComplete: true,
    kindleDevices: defaultDevices,
    activeKindleId: 'kindle-1',
  }
}

export function decryptPassword(config: StoredDashboardConfig): string {
  if (config.kindlePasswordEncoding === 'safeStorage' && config.kindlePasswordEncrypted) {
    return safeStorage.decryptString(Buffer.from(config.kindlePasswordEncrypted, 'base64'))
  }
  return config.kindlePasswordPlain ?? ''
}

function encryptedPasswordFields(password: string): Partial<StoredDashboardConfig> {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      kindlePasswordEncrypted: safeStorage.encryptString(password).toString('base64'),
      kindlePasswordEncoding: 'safeStorage',
      kindlePasswordPlain: undefined,
    }
  }

  return {
    kindlePasswordEncoding: 'plain',
    kindlePasswordEncrypted: undefined,
    kindlePasswordPlain: password,
  }
}

function hasSavedPassword(config: StoredDashboardConfig): boolean {
  return Boolean(config.kindlePasswordEncrypted || config.kindlePasswordPlain)
}

export function publicConfig(config: StoredDashboardConfig): DashboardConfig {
  return {
    dashboardUrl: config.dashboardUrl,
    kindleFullRefreshEvery: config.kindleFullRefreshEvery,
    kindleIp: config.kindleIp,
    kindlePasswordSaved: hasSavedPassword(config),
    kindlePort: config.kindlePort,
    kindleRefreshInterval: config.kindleRefreshInterval,
    kindleUser: config.kindleUser,
    kindleWifiRetryEvery: config.kindleWifiRetryEvery,
    language: config.language,
    pictureInPicture: config.pictureInPicture,
    pictureInPictureScale: config.pictureInPictureScale,
    setupComplete: config.setupComplete,
    kindleDevices: config.kindleDevices,
    activeKindleId: config.activeKindleId,
  }
}

export async function loadConfig(): Promise<StoredDashboardConfig> {
  if (dashboardConfig) return dashboardConfig

  const defaults = defaultStoredConfig()
  try {
    const raw = JSON.parse(await fs.readFile(configPath(), 'utf8')) as Partial<StoredDashboardConfig>
    const kindleIp = typeof raw.kindleIp === 'string' && raw.kindleIp.trim() ? raw.kindleIp.trim() : defaults.kindleIp
    const kindleUser = typeof raw.kindleUser === 'string' && raw.kindleUser.trim() ? raw.kindleUser.trim() : defaults.kindleUser
    const kindlePort = positiveInt(String(raw.kindlePort ?? ''), defaults.kindlePort)
    const kindleDevices: KindleDevice[] = Array.isArray(raw.kindleDevices) && raw.kindleDevices.length > 0
      ? raw.kindleDevices
      : [
          {
            id: 'kindle-1',
            name: 'Kindle Principal (Mesa)',
            ip: kindleIp,
            port: kindlePort,
            user: kindleUser,
            notes: 'Kindle Touch 3 (KT3)',
          },
        ]
    const activeKindleId = typeof raw.activeKindleId === 'string' && raw.activeKindleId ? raw.activeKindleId : kindleDevices[0].id

    dashboardConfig = {
      ...defaults,
      dashboardUrl: typeof raw.dashboardUrl === 'string' ? raw.dashboardUrl : defaults.dashboardUrl,
      language: normalizeLanguagePreference(raw.language),
      kindleFullRefreshEvery: positiveInt(String(raw.kindleFullRefreshEvery ?? ''), defaults.kindleFullRefreshEvery),
      kindleIp,
      kindlePasswordEncoding: raw.kindlePasswordEncoding,
      kindlePasswordEncrypted: typeof raw.kindlePasswordEncrypted === 'string' ? raw.kindlePasswordEncrypted : undefined,
      kindlePasswordPlain: typeof raw.kindlePasswordPlain === 'string' ? raw.kindlePasswordPlain : undefined,
      kindlePort,
      kindleRefreshInterval: positiveInt(String(raw.kindleRefreshInterval ?? ''), defaults.kindleRefreshInterval),
      kindleUser,
      kindleWifiRetryEvery: positiveInt(String(raw.kindleWifiRetryEvery ?? ''), defaults.kindleWifiRetryEvery),
      pictureInPicture: raw.pictureInPicture === true,
      pictureInPictureScale: normalizePipScale(raw.pictureInPictureScale),
      setupComplete: true,
      kindleDevices,
      activeKindleId,
    }
  } catch {
    dashboardConfig = defaults
  }

  return dashboardConfig
}

export async function writeConfig(config: StoredDashboardConfig): Promise<void> {
  dashboardConfig = config
  await fs.mkdir(dirname(configPath()), { recursive: true })
  await fs.writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function recordInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(text('configInvalid'))
  }
  return value as Record<string, unknown>
}

function requiredString(input: Record<string, unknown>, key: string, maxLength: number): string {
  const value = input[key]
  if (typeof value !== 'string') throw new Error(text('configText', { field: key }))
  const trimmed = value.trim()
  if (!trimmed) throw new Error(text('configRequired', { field: key }))
  if (trimmed.length > maxLength) throw new Error(text('configTooLong', { field: key }))
  return trimmed
}

function numberField(input: Record<string, unknown>, key: string, fallback: number, max = 65535): number {
  const value = typeof input[key] === 'number' ? (input[key] as number) : Number.parseInt(String(input[key] ?? ''), 10)
  if (!Number.isInteger(value) || value <= 0 || value > max) return fallback
  return value
}

function normalizedDashboardUrl(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(text('dashboardUrlProtocol'))
  }
  return url.toString()
}

export async function saveConfig(raw: unknown): Promise<DashboardConfig> {
  const input = recordInput(raw)
  const previous = await loadConfig()
  const password = typeof input.kindlePassword === 'string' ? input.kindlePassword : ''

  const rawIp = typeof input.kindleIp === 'string' ? input.kindleIp.trim() : ''
  const kindleIp = rawIp || previous.kindleIp || '192.168.0.40'

  const rawUser = typeof input.kindleUser === 'string' ? input.kindleUser.trim() : ''
  const kindleUser = rawUser || previous.kindleUser || 'root'

  const kindlePort = numberField(input, 'kindlePort', previous.kindlePort || 22)

  let kindleDevices = Array.isArray(input.kindleDevices) && input.kindleDevices.length > 0
    ? (input.kindleDevices as KindleDevice[])
    : (previous.kindleDevices || [
        {
          id: 'kindle-1',
          name: 'Kindle Principal (Mesa)',
          ip: kindleIp,
          port: kindlePort,
          user: kindleUser,
          notes: 'Kindle Touch 3 (KT3)',
        },
      ])

  const activeKindleId = typeof input.activeKindleId === 'string' && input.activeKindleId
    ? input.activeKindleId
    : (previous.activeKindleId || kindleDevices[0].id)

  // Sincroniza o dispositivo ativo com o IP, porta e usuário definidos
  const activeIdx = kindleDevices.findIndex((d) => d.id === activeKindleId)
  if (activeIdx !== -1) {
    kindleDevices[activeIdx] = {
      ...kindleDevices[activeIdx],
      ip: kindleIp,
      port: kindlePort,
      user: kindleUser,
    }
  }

  const next: StoredDashboardConfig = {
    ...previous,
    dashboardUrl: normalizedDashboardUrl(requiredString(input, 'dashboardUrl', 500)),
    kindleFullRefreshEvery: numberField(input, 'kindleFullRefreshEvery', previous.kindleFullRefreshEvery, 1000),
    kindleIp,
    kindlePort,
    kindleRefreshInterval: numberField(input, 'kindleRefreshInterval', previous.kindleRefreshInterval, 86400),
    kindleUser,
    kindleWifiRetryEvery: numberField(input, 'kindleWifiRetryEvery', previous.kindleWifiRetryEvery, 1000),
    setupComplete: true,
    kindleDevices,
    activeKindleId,
  }

  if (password) Object.assign(next, encryptedPasswordFields(password))

  await writeConfig(next)
  return publicConfig(next)
}

export async function setLanguage(raw: unknown): Promise<DashboardConfig> {
  const previous = await loadConfig()
  const next: StoredDashboardConfig = {
    ...previous,
    language: normalizeLanguagePreference(raw),
  }
  await writeConfig(next)
  applyLanguagePreference(next.language)
  return publicConfig(next)
}

export async function setPictureInPicture(enabled: unknown): Promise<DashboardConfig> {
  const previous = await loadConfig()
  const next: StoredDashboardConfig = {
    ...previous,
    pictureInPicture: enabled === true,
  }
  await writeConfig(next)
  return publicConfig(next)
}

export async function setPictureInPictureScale(scale: unknown): Promise<DashboardConfig> {
  const previous = await loadConfig()
  const next: StoredDashboardConfig = {
    ...previous,
    pictureInPictureScale: normalizePipScale(scale),
  }
  await writeConfig(next)
  return publicConfig(next)
}
