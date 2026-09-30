import { app, Menu, Notification } from 'electron'
import { getAuthStatus } from './auth'
import { startBackend, stopBackend } from './backend-bridge'
import { loadConfig } from './config'
import { applyLanguagePreference, loadLocales, text } from './i18n'
import { registerIpc } from './ipc'
import { applyPipPreference, destroyPipWindow } from './pip'
import {
  destroyCaptureWindow,
  renderDashboard,
  scheduleRender,
  stopRenderTimer,
} from './render'
import { createTray, destroyTray, updateTrayStatus } from './tray'
import {
  createMainWindow,
  destroyMainWindow,
  restoreMainWindow,
  setQuitting,
  showNotifyWindow,
  showPanelWindow,
  showSettingsWindow,
  showTamagotchiWindow,
  showWidgetsWindow,
} from './windows'
import { BASE_URL, PORT } from './constants'

let quitInProgress: Promise<void> | null = null

async function shutdown(): Promise<void> {
  stopRenderTimer()
  destroyCaptureWindow()
  destroyPipWindow()
  destroyMainWindow()
  destroyTray()
  await stopBackend()
}

function quitApplication(): void {
  if (quitInProgress) return

  setQuitting(true)
  quitInProgress = shutdown()
    .catch((error) => {
      console.error('shutdown failed', error)
    })
    .finally(() => {
      app.exit(0)
    })
}

function runStartupChecks(): void {
  const auth = getAuthStatus()
  if (auth.ok) return

  if (Notification.isSupported()) {
    new Notification({
      title: text('notificationTitle'),
      body: text('notificationBody'),
    }).show()
  }
  showSettingsWindow()
}

app.setName('PaperDeck')

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.exit(0)
} else {
  app.on('second-instance', () => {
    restoreMainWindow()
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.lucasrafaldini.paperdeck')
    Menu.setApplicationMenu(null)

    loadLocales()
    const config = await loadConfig()
    applyLanguagePreference(config.language)

    scheduleRender(config.kindleRefreshInterval)
    registerIpc({ quitApplication })
    await startBackend()
    createMainWindow({ showOnReady: true })
    createTray({
      onOpenPanel: showPanelWindow,
      onOpenSettings: showSettingsWindow,
      onOpenWidgets: showWidgetsWindow,
      onOpenTamagotchi: showTamagotchiWindow,
      onOpenNotify: showNotifyWindow,
      onRefresh: () => {
        void renderDashboard()
      },
      onQuit: quitApplication,
    })

    const pollKindleStatus = async (): Promise<void> => {
      try {
        const res = await fetch(`${BASE_URL}/api/kindle`, { signal: AbortSignal.timeout(2500) })
        if (res.ok) {
          const data = (await res.json()) as { battery: number | null; isCharging: boolean; lastSeen: number | null }
          updateTrayStatus({
            serverOnline: true,
            port: PORT,
            battery: data.battery,
            isCharging: Boolean(data.isCharging),
            lastSeen: data.lastSeen,
          })
          return
        }
      } catch {}
      updateTrayStatus({ serverOnline: false })
    }
    void pollKindleStatus()
    setInterval(() => void pollKindleStatus(), 8000)

    await renderDashboard()
    applyPipPreference(config.pictureInPicture)
    if (config.setupComplete) runStartupChecks()
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })

  app.on('activate', () => {
    restoreMainWindow()
  })

  app.on('before-quit', () => {
    setQuitting(true)
  })

  app.on('will-quit', (event) => {
    if (quitInProgress) return
    event.preventDefault()
    quitApplication()
  })
}
