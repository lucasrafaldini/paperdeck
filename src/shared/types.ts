// A BCP-47-ish language code backed by a file in `locales/`. Kept as a string so
// contributors can add a language by dropping in a JSON file — no code changes.
export type SupportedLanguage = string

export type LanguagePreference = SupportedLanguage | 'system'

export interface RuntimeInfo {
  appCommit: string
  appVersion: string
  baseUrl: string
  configured: boolean
  imageUrl: string
  lastRender: RenderResult | null
  outputPath: string
  renderIntervalSeconds: number
  systemLanguage: SupportedLanguage
}

export interface RenderResult {
  outputPath: string
  updatedAt: string
}

export interface KindleDevice {
  id: string
  name: string
  ip: string
  port: number
  user: string
  notes?: string
  battery?: number | null
  isCharging?: boolean
  lastSeen?: number | null
}

export interface DashboardConfig {
  dashboardUrl: string
  kindleFullRefreshEvery: number
  kindleIp: string
  kindlePasswordSaved: boolean
  kindlePort: number
  kindleRefreshInterval: number
  kindleUser: string
  kindleWifiRetryEvery: number
  language: LanguagePreference
  pictureInPicture: boolean
  pictureInPictureScale: number
  setupComplete: boolean
  kindleDevices?: KindleDevice[]
  activeKindleId?: string
}

export interface DashboardConfigInput {
  dashboardUrl: string
  kindleFullRefreshEvery: number
  kindleIp: string
  kindlePassword?: string
  kindlePort: number
  kindleRefreshInterval: number
  kindleUser: string
  kindleWifiRetryEvery: number
  kindleDevices?: KindleDevice[]
  activeKindleId?: string
}

export interface AuthSourceStatus {
  detailKey: string
  detailVars?: Record<string, string>
  hintKey?: string
  label: string
  name: string
  ok: boolean
}

export interface AuthStatus {
  checkedAt: string
  ok: boolean
  sources: AuthSourceStatus[]
}

export type AuthLoginTool = 'claude' | 'codex'

export interface KindleStatus {
  canInstall: boolean
  checkedAt: string
  connected: boolean
  detail: string
  fbink: boolean
  hotfix: boolean
  initctl: boolean
  jailbroken: boolean
  mntroot: boolean
  mntus: boolean
  model: string | null
}

export interface KindleScriptStatus {
  backendReachable: boolean
  enabled: boolean
  installed: boolean
  output: string
  running: boolean
}

export interface KindleInstallResult {
  config: DashboardConfig
  output: string
  status: KindleScriptStatus
}

export interface WidgetItem {
  id: string
  name: string
}

export type WidgetOptionsMap = Record<string, Record<string, boolean>>

export interface DashboardBlock {
  id: string
  tool: string
  width: 'half' | 'full'
  height?: 'compact' | 'standard' | 'tall'
  options?: Record<string, boolean>
}

export interface DashboardLayoutConfig {
  mode: 'preset' | 'custom'
  blocks: DashboardBlock[]
}

export interface DashboardWidgetsConfig {
  activeWidgets: string[]
  availableWidgets: WidgetItem[]
  widgetOptions?: WidgetOptionsMap
  layout?: DashboardLayoutConfig
}

export interface ActiveNotification {
  message: string
  expiresAt: number
  createdAt: string
}

export interface ScheduledNotification {
  id: string
  message: string
  durationSec: number
  scheduledFor: number
  createdAt: string
}

export interface KindleLiveInfo {
  battery: number | null
  isCharging: boolean
  lastSeen: number | null
  clientIp: string | null
  devices?: Record<string, {
    clientIp: string
    battery: number | null
    isCharging: boolean
    lastSeen: number | null
  }>
}

export interface DashboardApi {
  checkAuth: () => Promise<AuthStatus>
  checkKindle: () => Promise<KindleStatus>
  getKindleScriptStatus: () => Promise<KindleScriptStatus>
  getRuntimeInfo: () => Promise<RuntimeInfo>
  getConfig: () => Promise<DashboardConfig>
  installKindle: () => Promise<KindleInstallResult>
  setLanguage: (language: LanguagePreference) => Promise<DashboardConfig>
  setPictureInPicture: (enabled: boolean) => Promise<DashboardConfig>
  setPictureInPictureScale: (scale: number) => Promise<DashboardConfig>
  startKindleScript: () => Promise<KindleScriptStatus>
  stopKindleScript: () => Promise<KindleScriptStatus>
  uninstallKindle: () => Promise<KindleInstallResult>
  openLogin: (tool: AuthLoginTool) => Promise<void>
  openRepo: () => Promise<void>
  renderNow: () => Promise<RenderResult>
  saveConfig: (config: DashboardConfigInput) => Promise<DashboardConfig>
  getWidgets: () => Promise<DashboardWidgetsConfig>
  saveWidgets: (activeWidgets: string[]) => Promise<DashboardWidgetsConfig>
  saveWidgetOptions: (widgetOptions: WidgetOptionsMap) => Promise<DashboardWidgetsConfig>
  saveLayout: (layout: DashboardLayoutConfig) => Promise<DashboardWidgetsConfig>
  getNotification: () => Promise<ActiveNotification | null>
  sendNotification: (message: string, durationSec?: number) => Promise<ActiveNotification | null>
  clearNotification: () => Promise<void>
  getScheduledNotifications: () => Promise<ScheduledNotification[]>
  scheduleNotification: (message: string, scheduledFor: number, durationSec?: number) => Promise<ScheduledNotification>
  cancelScheduledNotification: (id: string) => Promise<void>
  getKindleLive: () => Promise<KindleLiveInfo>
  quit: () => Promise<void>
  onOpenPanel: (callback: () => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
  onOpenWidgets: (callback: () => void) => () => void
  onOpenNotify: (callback: () => void) => () => void
  onPipChanged: (callback: (enabled: boolean) => void) => () => void
  onRenderCompleted: (callback: (result: RenderResult) => void) => () => void
}

