import { Menu, Tray, nativeImage } from 'electron'
import { text } from './i18n'
import { appAssetPath } from './paths'
import { PORT } from './constants'

export interface TrayHandlers {
  onOpenPanel: () => void
  onOpenSettings: () => void
  onOpenWidgets: () => void
  onOpenTamagotchi: () => void
  onOpenNotify: () => void
  onQuit: () => void
  onRefresh: () => void
}

export interface TrayStatus {
  serverOnline: boolean
  port: number
  battery: number | null
  isCharging: boolean
  lastSeen: number | null
}

let tray: Tray | null = null
let trayHandlers: TrayHandlers | null = null
let currentStatus: TrayStatus = {
  serverOnline: true,
  port: PORT,
  battery: null,
  isCharging: false,
  lastSeen: null,
}

function buildTrayMenu(handlers: TrayHandlers): Menu {
  const serverLabel = currentStatus.serverOnline
    ? text('trayServerOnline', { port: String(currentStatus.port) })
    : text('trayServerOffline')

  const kindleLabel = currentStatus.battery != null
    ? text('trayKindleConnected', {
        icon: currentStatus.isCharging ? '⚡' : '🔋',
        battery: String(currentStatus.battery),
      })
    : text('trayKindleWaiting')

  return Menu.buildFromTemplate([
    { label: serverLabel, enabled: false },
    { label: kindleLabel, enabled: false },
    { type: 'separator' },
    { label: text('trayOpenPanel'), click: handlers.onOpenPanel },
    { label: text('trayOpenCustomize'), click: handlers.onOpenWidgets },
    { label: text('trayOpenTamagotchi', undefined) || 'Mascote Memtchi', click: handlers.onOpenTamagotchi },
    { label: text('trayOpenNotify'), click: handlers.onOpenNotify },
    { label: text('trayRefresh'), click: handlers.onRefresh },
    { type: 'separator' },
    { label: text('trayOpenSettings'), click: handlers.onOpenSettings },
    { label: text('trayQuit'), click: handlers.onQuit },
  ])
}

function updateTrayAppearance(): void {
  if (!tray || !trayHandlers) return

  tray.setContextMenu(buildTrayMenu(trayHandlers))

  const tooltipParts = [text('trayToolTip')]
  if (currentStatus.serverOnline) tooltipParts.push(`● :${currentStatus.port}`)
  if (currentStatus.battery != null) {
    const icon = currentStatus.isCharging ? '⚡' : '🔋'
    tooltipParts.push(`${icon} ${currentStatus.battery}%`)
  }
  tray.setToolTip(tooltipParts.join(' · '))

  // No macOS, mostra a bateria diretamente na barra de menus ao lado do ícone
  if (process.platform === 'darwin') {
    if (currentStatus.battery != null) {
      const chargeGlyph = currentStatus.isCharging ? '⚡' : ''
      tray.setTitle(` ${chargeGlyph}${currentStatus.battery}%`)
    } else {
      tray.setTitle('')
    }
  }
}

export function createTray(handlers: TrayHandlers): void {
  trayHandlers = handlers
  if (tray) {
    updateTrayAppearance()
    return
  }

  let icon = nativeImage.createFromPath(appAssetPath('icon.png'))
  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 18, height: 18 })
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  updateTrayAppearance()
  tray.on('click', handlers.onOpenPanel)
}

export function updateTrayStatus(patch: Partial<TrayStatus>): void {
  currentStatus = { ...currentStatus, ...patch }
  updateTrayAppearance()
}

export function refreshTray(): void {
  updateTrayAppearance()
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
