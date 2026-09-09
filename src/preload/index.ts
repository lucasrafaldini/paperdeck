import { contextBridge, ipcRenderer } from 'electron'
import type {
  AuthLoginTool,
  CustomSite,
  DashboardApi,
  DashboardConfigInput,
  LanguagePreference,
  RenderResult,
} from '../shared/types'

const api: DashboardApi = {
  checkAuth: () => ipcRenderer.invoke('auth:check'),
  checkKindle: () => ipcRenderer.invoke('kindle:check'),
  getKindleScriptStatus: () => ipcRenderer.invoke('kindle:script-status'),
  getRuntimeInfo: () => ipcRenderer.invoke('runtime:get'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  installKindle: () => ipcRenderer.invoke('kindle:install'),
  setLanguage: (language: LanguagePreference) => ipcRenderer.invoke('config:set-language', language),
  setDashboardTitle: (title: string) => ipcRenderer.invoke('config:set-title', title),
  setPictureInPicture: (enabled: boolean) => ipcRenderer.invoke('config:set-pip', enabled),
  setPictureInPictureScale: (scale: number) => ipcRenderer.invoke('config:set-pip-scale', scale),
  startKindleScript: () => ipcRenderer.invoke('kindle:script-start'),
  stopKindleScript: () => ipcRenderer.invoke('kindle:script-stop'),
  uninstallKindle: () => ipcRenderer.invoke('kindle:uninstall'),
  openLogin: (tool: AuthLoginTool) => ipcRenderer.invoke('auth:openLogin', tool),
  openRepo: () => ipcRenderer.invoke('app:openRepo'),
  renderNow: () => ipcRenderer.invoke('render:now'),
  saveConfig: (config: DashboardConfigInput) => ipcRenderer.invoke('config:save', config),
  getWidgets: () => ipcRenderer.invoke('widgets:get'),
  saveWidgets: (activeWidgets: string[]) => ipcRenderer.invoke('widgets:save', activeWidgets),
  saveWidgetOptions: (widgetOptions) => ipcRenderer.invoke('widgets:saveOptions', widgetOptions),
  saveLayout: (layout, extra) => ipcRenderer.invoke('widgets:saveLayout', layout, extra),
  saveCustomSites: (sites: CustomSite[]) => ipcRenderer.invoke('widgets:saveCustomSites', sites),
  petAction: (action, payload) => ipcRenderer.invoke('tamagotchi:action', action, payload),
  getPetState: () => ipcRenderer.invoke('tamagotchi:get'),
  getNotification: () => ipcRenderer.invoke('notify:get'),
  sendNotification: (message: string, durationSec?: number) => ipcRenderer.invoke('notify:set', message, durationSec),
  clearNotification: () => ipcRenderer.invoke('notify:clear'),
  getScheduledNotifications: () => ipcRenderer.invoke('notify:getScheduled'),
  scheduleNotification: (message: string, scheduledFor: number, durationSec?: number) =>
    ipcRenderer.invoke('notify:schedule', message, scheduledFor, durationSec),
  cancelScheduledNotification: (id: string) => ipcRenderer.invoke('notify:cancelScheduled', id),
  getKindleLive: () => ipcRenderer.invoke('kindle:live'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onOpenPanel: (callback) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('panel:open', listener)
    return () => ipcRenderer.removeListener('panel:open', listener)
  },
  onOpenSettings: (callback) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('settings:open', listener)
    return () => ipcRenderer.removeListener('settings:open', listener)
  },
  onOpenWidgets: (callback) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('widgets:open', listener)
    return () => ipcRenderer.removeListener('widgets:open', listener)
  },
  onOpenTamagotchi: (callback) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('tamagotchi:open', listener)
    return () => ipcRenderer.removeListener('tamagotchi:open', listener)
  },
  onOpenNotify: (callback) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('notify:open', listener)
    return () => ipcRenderer.removeListener('notify:open', listener)
  },
  onPipChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean): void => {
      callback(enabled)
    }
    ipcRenderer.on('pip:state', listener)
    return () => ipcRenderer.removeListener('pip:state', listener)
  },
  onRenderCompleted: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, result: RenderResult): void => {
      callback(result)
    }
    ipcRenderer.on('render:completed', listener)
    return () => ipcRenderer.removeListener('render:completed', listener)
  },
}

contextBridge.exposeInMainWorld('dashboard', api)
