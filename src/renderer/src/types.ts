export type BackendState = 'checking' | 'online' | 'offline'
export type NavKey = 'painel' | 'widgets' | 'notificacoes' | 'kindle' | 'logins' | 'configuracoes'
export type KindleTab = 'config' | 'diagnostico'
export type KindleScriptAction = 'start' | 'stop'

export type IconName =
  | 'book'
  | 'kindle'
  | 'login'
  | 'refresh'
  | 'settings'
  | 'stethoscope'
  | 'save'
  | 'download'
  | 'trash'
  | 'play'
  | 'stop'
  | 'search'
  | 'github'
  | 'globe'
  | 'slider'
  | 'bell'
  | 'battery'
  | 'arrow-up'
  | 'arrow-down'
  | 'check'

export interface NavItem {
  key: NavKey
  label: string
  hint: string
  icon: IconName
}

export interface ConfigForm {
  dashboardUrl: string
  kindleFullRefreshEvery: string
  kindleIp: string
  kindlePassword: string
  kindlePort: string
  kindleRefreshInterval: string
  kindleUser: string
  kindleWifiRetryEvery: string
}
