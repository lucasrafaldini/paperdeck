import { join } from 'node:path'
import { app, ipcMain, shell } from 'electron'
import type {
  ActiveNotification,
  AuthLoginTool,
  AuthStatus,
  CustomSite,
  DashboardConfig,
  DashboardConfigInput,
  DashboardLayoutConfig,
  DashboardWidgetsConfig,
  KindleInstallResult,
  KindleLiveInfo,
  KindleScriptStatus,
  KindleStatus,
  LanguagePreference,
  RuntimeInfo,
  ScheduledNotification,
  WidgetOptionsMap,
} from '../shared/types'
import { getAuthStatus, openLogin } from './auth'
import { BASE_URL, REPO_URL } from './constants'
import {
  loadConfig,
  publicConfig,
  saveConfig,
  setDashboardTitle,
  setLanguage,
  setPictureInPicture,
  setPictureInPictureScale,
} from './config'
import { currentSystemLanguage } from './i18n'
import { checkKindle, installKindle, manageKindleScript, uninstallKindle } from './kindle'
import { appCommitHash, runtimeOutputPath } from './paths'
import { applyPipPreference, applyPipScale } from './pip'
import { getIntervalSeconds, getLastRender, renderDashboard, scheduleRender } from './render'
import { refreshTray } from './tray'
import { getMainWindow } from './windows'

interface IpcHandlers {
  quitApplication: () => void
}

export function registerIpc(handlers: IpcHandlers): void {
  ipcMain.handle('runtime:get', async (): Promise<RuntimeInfo> => {
    const config = await loadConfig()
    return {
      appCommit: await appCommitHash(),
      appVersion: app.getVersion(),
      baseUrl: BASE_URL,
      configured: config.setupComplete,
      imageUrl: config.dashboardUrl,
      lastRender: getLastRender(),
      outputPath: runtimeOutputPath(),
      renderIntervalSeconds: getIntervalSeconds(),
      systemLanguage: currentSystemLanguage(),
    }
  })

  ipcMain.handle('config:get', async (): Promise<DashboardConfig> => publicConfig(await loadConfig()))

  ipcMain.handle('config:save', async (_event, config: DashboardConfigInput): Promise<DashboardConfig> => {
    const saved = await saveConfig(config)
    if (saved.kindleRefreshInterval !== getIntervalSeconds()) scheduleRender(saved.kindleRefreshInterval)
    return saved
  })

  ipcMain.handle('config:set-language', async (_event, language: LanguagePreference): Promise<DashboardConfig> => {
    const saved = await setLanguage(language)
    refreshTray()
    return saved
  })

  ipcMain.handle('config:set-title', async (_event, title: string): Promise<DashboardConfig> => {
    const saved = await setDashboardTitle(title)
    try {
      await fetch(`${BASE_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardTitle: saved.dashboardTitle }),
        signal: AbortSignal.timeout(3000),
      })
    } catch {}
    void renderDashboard().catch(() => {})
    return saved
  })

  ipcMain.handle('config:set-pip', async (_event, enabled: boolean): Promise<DashboardConfig> => {
    const saved = await setPictureInPicture(enabled)
    applyPipPreference(saved.pictureInPicture)
    return saved
  })

  ipcMain.handle('config:set-pip-scale', async (_event, scale: number): Promise<DashboardConfig> => {
    const saved = await setPictureInPictureScale(scale)
    applyPipScale()
    return saved
  })

  // Botao "fechar" dentro da janela PiP: desliga a preferencia e avisa a UI.
  ipcMain.handle('pip:close', async (): Promise<void> => {
    const saved = await setPictureInPicture(false)
    applyPipPreference(saved.pictureInPicture)
    getMainWindow()?.webContents.send('pip:state', saved.pictureInPicture)
  })

  ipcMain.handle('auth:check', (): AuthStatus => getAuthStatus())
  ipcMain.handle('auth:openLogin', (_event, tool: AuthLoginTool): void => openLogin(tool))
  ipcMain.handle('app:openRepo', () => shell.openExternal(REPO_URL))

  ipcMain.handle('kindle:check', (): Promise<KindleStatus> => checkKindle())
  ipcMain.handle('kindle:install', async (): Promise<KindleInstallResult> => {
    const result = await installKindle()
    refreshTray()
    return result
  })
  ipcMain.handle('kindle:uninstall', async (): Promise<KindleInstallResult> => {
    const result = await uninstallKindle()
    refreshTray()
    return result
  })
  ipcMain.handle('kindle:script-status', (): Promise<KindleScriptStatus> => manageKindleScript('status'))
  ipcMain.handle('kindle:script-start', (): Promise<KindleScriptStatus> => manageKindleScript('start'))
  ipcMain.handle('kindle:script-stop', (): Promise<KindleScriptStatus> => manageKindleScript('stop'))

  ipcMain.handle('widgets:get', async (): Promise<DashboardWidgetsConfig> => {
    try {
      const res = await fetch(`${BASE_URL}/api/config`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return (await res.json()) as DashboardWidgetsConfig
    } catch {}
    const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
    const configMgr = require(join(root, 'backend', 'config.js')) as { readConfig: () => DashboardWidgetsConfig }
    return configMgr.readConfig()
  })

  ipcMain.handle('widgets:save', async (_event, activeWidgets: string[]): Promise<DashboardWidgetsConfig> => {
    let result: DashboardWidgetsConfig
    try {
      const res = await fetch(`${BASE_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeWidgets }),
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        result = (await res.json()) as DashboardWidgetsConfig
      } else {
        throw new Error('failed')
      }
    } catch {
      const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
      const configMgr = require(join(root, 'backend', 'config.js')) as { writeConfig: (patch: unknown) => DashboardWidgetsConfig }
      result = configMgr.writeConfig({ activeWidgets })
    }
    void renderDashboard().catch(() => {})
    return result
  })

  ipcMain.handle('widgets:saveOptions', async (_event, widgetOptions: WidgetOptionsMap): Promise<DashboardWidgetsConfig> => {
    let result: DashboardWidgetsConfig
    try {
      const res = await fetch(`${BASE_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetOptions }),
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        result = (await res.json()) as DashboardWidgetsConfig
      } else {
        throw new Error('failed')
      }
    } catch {
      const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
      const configMgr = require(join(root, 'backend', 'config.js')) as { writeConfig: (patch: unknown) => DashboardWidgetsConfig }
      result = configMgr.writeConfig({ widgetOptions })
    }
    void renderDashboard().catch(() => {})
    return result
  })

  ipcMain.handle(
    'widgets:saveLayout',
    async (
      _event,
      layout: DashboardLayoutConfig,
      extra?: { activeWidgets?: string[]; widgetOptions?: WidgetOptionsMap; customSites?: CustomSite[]; dashboardTitle?: string },
    ): Promise<DashboardWidgetsConfig> => {
      let result: DashboardWidgetsConfig
      const payload = { layout, ...(extra || {}) }
      try {
        const res = await fetch(`${BASE_URL}/api/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3000),
        })
        if (res.ok) {
          result = (await res.json()) as DashboardWidgetsConfig
        } else {
          throw new Error('failed')
        }
      } catch {
        const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
        const configMgr = require(join(root, 'backend', 'config.js')) as {
          writeConfig: (patch: unknown) => DashboardWidgetsConfig
        }
        result = configMgr.writeConfig(payload)
      }
      void renderDashboard().catch(() => {})
      return result
    },
  )

  ipcMain.handle('widgets:saveCustomSites', async (_event, customSites: CustomSite[]): Promise<DashboardWidgetsConfig> => {
    let result: DashboardWidgetsConfig
    try {
      const res = await fetch(`${BASE_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customSites }),
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        result = (await res.json()) as DashboardWidgetsConfig
      } else {
        throw new Error('failed')
      }
    } catch {
      const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
      const configMgr = require(join(root, 'backend', 'config.js')) as {
        writeConfig: (patch: unknown) => DashboardWidgetsConfig
      }
      result = configMgr.writeConfig({ customSites })
    }
    void renderDashboard().catch(() => {})
    return result
  })

  ipcMain.handle('tamagotchi:action', async (_event, action: string, payload?: Record<string, unknown>): Promise<unknown> => {
    try {
      const res = await fetch(`${BASE_URL}/api/tamagotchi/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json()
        void renderDashboard().catch(() => {})
        return data
      }
    } catch {}
    const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
    const tamagotchiCollector = require(join(root, 'backend', 'collectors', 'tamagotchi.js')) as {
      performAction: (act: string, pl?: Record<string, unknown>) => unknown
    }
    const res = tamagotchiCollector.performAction(action, payload)
    void renderDashboard().catch(() => {})
    return res
  })

  ipcMain.handle('tamagotchi:get', async (): Promise<unknown> => {
    try {
      const res = await fetch(`${BASE_URL}/api/tamagotchi/action`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return await res.json()
    } catch {}
    const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
    const tamagotchiCollector = require(join(root, 'backend', 'collectors', 'tamagotchi.js')) as {
      collect: () => Promise<unknown>
    }
    return tamagotchiCollector.collect()
  })

  ipcMain.handle('notify:get', async (): Promise<ActiveNotification | null> => {
    try {
      const res = await fetch(`${BASE_URL}/api/notify`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = (await res.json()) as { notification: ActiveNotification | null }
        return data.notification
      }
    } catch {}
    return null
  })

  ipcMain.handle('notify:set', async (_event, message: string, durationSec?: number): Promise<ActiveNotification | null> => {
    try {
      const res = await fetch(`${BASE_URL}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, durationSec: durationSec || 300 }),
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = (await res.json()) as { notification: ActiveNotification | null }
        void renderDashboard().catch(() => {})
        return data.notification
      }
    } catch {}
    return null
  })

  ipcMain.handle('notify:clear', async (): Promise<void> => {
    try {
      await fetch(`${BASE_URL}/api/notify`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(3000),
      })
      void renderDashboard().catch(() => {})
    } catch {}
  })

  ipcMain.handle('notify:getScheduled', async (): Promise<ScheduledNotification[]> => {
    try {
      const res = await fetch(`${BASE_URL}/api/notify/scheduled`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = (await res.json()) as { scheduledNotifications: ScheduledNotification[] }
        return data.scheduledNotifications || []
      }
    } catch {}
    const root = app.getAppPath().replace(/[/\\]dist([/\\]main)?$/, '')
    const configMgr = require(join(root, 'backend', 'config.js')) as { readConfig: () => { scheduledNotifications?: ScheduledNotification[] } }
    return configMgr.readConfig().scheduledNotifications || []
  })

  ipcMain.handle('notify:schedule', async (_event, message: string, scheduledFor: number, durationSec?: number): Promise<ScheduledNotification> => {
    const res = await fetch(`${BASE_URL}/api/notify/scheduled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, scheduledFor, durationSec: durationSec || 300 }),
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = (await res.json()) as { item: ScheduledNotification }
      return data.item
    }
    throw new Error('Falha ao agendar notificação')
  })

  ipcMain.handle('notify:cancelScheduled', async (_event, id: string): Promise<void> => {
    await fetch(`${BASE_URL}/api/notify/scheduled`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(3000),
    })
  })

  ipcMain.handle('kindle:live', async (): Promise<KindleLiveInfo> => {
    try {
      const res = await fetch(`${BASE_URL}/api/kindle`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return (await res.json()) as KindleLiveInfo
    } catch {}
    return { battery: null, isCharging: false, lastSeen: null, clientIp: null }
  })

  ipcMain.handle('render:now', () => renderDashboard())
  ipcMain.handle('app:quit', () => {
    handlers.quitApplication()
  })
}
