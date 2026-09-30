import { useCallback, useEffect, useMemo, useState } from 'react'
import { createTranslator } from './i18n'
import { formFromConfig, inputFromForm, resolveLanguage } from './lib/format'
import type {
  BackendState,
  ConfigForm,
  KindleScriptAction,
  KindleTab,
  NavItem,
  NavKey,
} from './types'
import { KindleView } from './views/KindleView'
import { LoginsView } from './views/LoginsView'
import { NotifyView } from './views/NotifyView'
import { PanelView } from './views/PanelView'
import { SettingsView } from './views/SettingsView'
import { Sidebar } from './views/Sidebar'
import { TamagotchiView } from './views/TamagotchiView'
import { Topbar } from './views/Topbar'
import { WidgetsView } from './views/WidgetsView'
import type {
  AuthLoginTool,
  AuthStatus,
  DashboardConfig,
  KindleDevice,
  KindleLiveInfo,
  KindleScriptStatus,
  KindleStatus,
  LanguagePreference,
  RenderResult,
  RuntimeInfo,
} from '../../shared/types'

export default function App(): React.JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [form, setForm] = useState<ConfigForm | null>(null)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [kindle, setKindle] = useState<KindleStatus | null>(null)
  const [kindleLive, setKindleLive] = useState<KindleLiveInfo | null>(null)
  const [kindleScript, setKindleScript] = useState<KindleScriptStatus | null>(null)
  const [backendState, setBackendState] = useState<BackendState>('checking')
  const [lastRender, setLastRender] = useState<string | null>(null)
  const [nav, setNav] = useState<NavKey>('configuracoes')
  const [kindleTab, setKindleTab] = useState<KindleTab>('dispositivos')
  const [rendering, setRendering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [savingPip, setSavingPip] = useState(false)
  const [savingPipScale, setSavingPipScale] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [checkingKindle, setCheckingKindle] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [scriptAction, setScriptAction] = useState<KindleScriptAction | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noticeNav, setNoticeNav] = useState<NavKey | null>(null)
  const [installOutput, setInstallOutput] = useState<string | null>(null)

  const configured = config?.setupComplete === true
  const activeLanguage = resolveLanguage(config?.language, runtime?.systemLanguage)
  const t = useMemo(() => createTranslator(activeLanguage), [activeLanguage])

  const checkBackend = useCallback(async (baseUrl: string) => {
    try {
      const response = await fetch(`${baseUrl}/api/ping`, { cache: 'no-store' })
      setBackendState(response.ok ? 'online' : 'offline')
    } catch {
      setBackendState('offline')
    }
  }, [])

  const refreshAuth = useCallback(async () => {
    setCheckingAuth(true)
    try {
      const status = await window.dashboard.checkAuth()
      setAuth(status)
      return status
    } catch (authError) {
      showError('logins', authError instanceof Error ? authError.message : String(authError))
      return null
    } finally {
      setCheckingAuth(false)
    }
  }, [])

  useEffect(() => {
    let timer: number | undefined
    let unsubscribeRender = (): void => {}
    let unsubscribeSettings = (): void => {}
    let unsubscribePanel = (): void => {}
    let unsubscribePip = (): void => {}
    let unsubscribeWidgets = (): void => {}
    let unsubscribeTamagotchi = (): void => {}
    let unsubscribeNotify = (): void => {}
    let liveTimer: number | undefined

    async function hydrate(): Promise<void> {
      try {
        const [runtimeInfo, savedConfig, authStatus, live] = await Promise.all([
          window.dashboard.getRuntimeInfo(),
          window.dashboard.getConfig(),
          window.dashboard.checkAuth(),
          window.dashboard.getKindleLive().catch(() => null),
        ])

        setRuntime(runtimeInfo)
        setConfig(savedConfig)
        setForm(formFromConfig(savedConfig))
        setAuth(authStatus)
        if (live) setKindleLive(live)
        setNav(savedConfig.setupComplete ? 'painel' : 'configuracoes')
        setLastRender(runtimeInfo.lastRender?.updatedAt ?? null)
        if (runtimeInfo.lastRender) setPreviewKey(Date.parse(runtimeInfo.lastRender.updatedAt) || Date.now())
        void checkBackend(runtimeInfo.baseUrl)
        timer = window.setInterval(() => void checkBackend(runtimeInfo.baseUrl), 5000)

        const pollLive = (): void => {
          window.dashboard.getKindleLive().then(setKindleLive).catch(() => {})
        }
        liveTimer = window.setInterval(pollLive, 6000)
      } catch (hydrateError) {
        setBackendState('offline')
        showError('configuracoes', hydrateError instanceof Error ? hydrateError.message : String(hydrateError))
      }
    }

    void hydrate()

    unsubscribeRender = window.dashboard.onRenderCompleted((result: RenderResult) => {
      setLastRender(result.updatedAt)
      setPreviewKey(Date.now())
      if (noticeNav === 'painel') clearNotice('painel')
    })
    unsubscribeSettings = window.dashboard.onOpenSettings(() => {
      setNav('kindle')
      setKindleTab('config')
    })
    unsubscribePanel = window.dashboard.onOpenPanel(() => {
      setNav(configured ? 'painel' : 'configuracoes')
    })
    unsubscribeWidgets = window.dashboard.onOpenWidgets(() => {
      setNav('widgets')
    })
    unsubscribeTamagotchi = window.dashboard.onOpenTamagotchi(() => {
      setNav('tamagotchi')
    })
    unsubscribeNotify = window.dashboard.onOpenNotify(() => {
      setNav('notificacoes')
    })
    unsubscribePip = window.dashboard.onPipChanged((enabled) => {
      setConfig((current) => current ? { ...current, pictureInPicture: enabled } : current)
    })

    return () => {
      if (timer) window.clearInterval(timer)
      if (liveTimer) window.clearInterval(liveTimer)
      unsubscribeRender()
      unsubscribeSettings()
      unsubscribePanel()
      unsubscribeWidgets()
      unsubscribeTamagotchi()
      unsubscribeNotify()
      unsubscribePip()
    }
  }, [checkBackend, configured])

  const dashboardUrlPreview = useMemo(() => {
    if (!form?.dashboardUrl) return ''
    try {
      return new URL(form.dashboardUrl).toString()
    } catch {
      return form.dashboardUrl
    }
  }, [form?.dashboardUrl])

  const backendPill = useMemo(() => {
    if (backendState === 'offline') return { className: 'offline', label: t('backendOffline') }
    if (backendState === 'online' && !configured) return { className: 'pending', label: t('backendPending') }
    if (backendState === 'online') return { className: 'online', label: t('backendOnline') }
    return { className: 'checking', label: t('backendChecking') }
  }, [backendState, configured, t])

  const navItems = useMemo<NavItem[]>(() => [
    { key: 'painel', label: t('menuDashboard'), hint: t('hintDashboard'), icon: 'book' },
    { key: 'widgets', label: t('menuWidgets'), hint: t('hintWidgets'), icon: 'slider' },
    { key: 'tamagotchi', label: t('menuTamagotchi'), hint: t('hintTamagotchi'), icon: 'pet' },
    { key: 'notificacoes', label: t('menuNotify'), hint: t('hintNotify'), icon: 'bell' },
    { key: 'kindle', label: t('menuKindle'), hint: t('hintKindle'), icon: 'kindle' },
    { key: 'logins', label: t('menuLogins'), hint: t('hintLogins'), icon: 'login' },
    { key: 'configuracoes', label: t('menuSettings'), hint: t('hintSettings'), icon: 'settings' },
  ], [t])

  const activeNav = navItems.find((item) => item.key === nav) ?? navItems[0]

  function showMessage(nextNav: NavKey, value: string): void {
    setNoticeNav(nextNav)
    setMessage(value)
    setError(null)
  }

  function showError(nextNav: NavKey, value: string): void {
    setNoticeNav(nextNav)
    setError(value)
    setMessage(null)
  }

  function clearNotice(nextNav?: NavKey): void {
    setNoticeNav(nextNav ?? null)
    setMessage(null)
    setError(null)
  }

  function updateForm(key: keyof ConfigForm, value: string): void {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  async function saveCurrentConfig(): Promise<DashboardConfig | null> {
    if (!form) return null

    setSaving(true)
    clearNotice('kindle')
    try {
      const saved = await window.dashboard.saveConfig(inputFromForm(form, {
        kindleDevices: config?.kindleDevices,
        activeKindleId: config?.activeKindleId,
      }))
      setConfig(saved)
      setForm(formFromConfig(saved))
      showMessage('kindle', t('configSaved'))
      return saved
    } catch (saveError) {
      showError('kindle', saveError instanceof Error ? saveError.message : String(saveError))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleAddKindleDevice(device: { name: string; ip: string; port: number; user: string }): Promise<void> {
    if (!config) return
    const id = 'k_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
    const newDevice: KindleDevice = {
      id,
      name: device.name.trim() || `Kindle ${device.ip}`,
      ip: device.ip.trim(),
      port: device.port || 22,
      user: device.user.trim() || 'root',
    }
    const currentList = config.kindleDevices && config.kindleDevices.length > 0
      ? config.kindleDevices
      : [
          {
            id: 'kindle-1',
            name: 'Kindle',
            ip: config.kindleIp || '',
            port: config.kindlePort || 22,
            user: config.kindleUser || 'root',
          },
        ]
    const devices = [...currentList, newDevice]
    setSaving(true)
    clearNotice('kindle')
    try {
      const updated = await window.dashboard.saveConfig({
        dashboardUrl: config.dashboardUrl,
        kindleIp: config.kindleIp,
        kindlePort: config.kindlePort,
        kindleUser: config.kindleUser,
        kindleRefreshInterval: config.kindleRefreshInterval,
        kindleFullRefreshEvery: config.kindleFullRefreshEvery,
        kindleWifiRetryEvery: config.kindleWifiRetryEvery,
        kindleDevices: devices,
        activeKindleId: config.activeKindleId || 'kindle-1',
      })
      setConfig(updated)
      setForm(formFromConfig(updated))
      showMessage('kindle', t('deviceAdded'))
    } catch (err) {
      showError('kindle', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleSelectKindleDevice(id: string): Promise<void> {
    if (!config) return
    const target = (config.kindleDevices || []).find((d) => d.id === id)
    if (!target) return
    setSaving(true)
    clearNotice('kindle')
    try {
      const updated = await window.dashboard.saveConfig({
        dashboardUrl: config.dashboardUrl,
        kindleIp: target.ip,
        kindlePort: target.port || 22,
        kindleUser: target.user || 'root',
        kindleRefreshInterval: config.kindleRefreshInterval,
        kindleFullRefreshEvery: config.kindleFullRefreshEvery,
        kindleWifiRetryEvery: config.kindleWifiRetryEvery,
        kindleDevices: config.kindleDevices,
        activeKindleId: id,
      })
      setConfig(updated)
      setForm(formFromConfig(updated))
      showMessage('kindle', t('deviceSelected'))
    } catch (err) {
      showError('kindle', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveKindleDevice(id: string): Promise<void> {
    if (!config) return
    const remaining = (config.kindleDevices || []).filter((d) => d.id !== id)
    const nextActive = config.activeKindleId === id ? remaining[0]?.id : config.activeKindleId
    const activeDevice = remaining.find((d) => d.id === nextActive) || remaining[0]
    setSaving(true)
    clearNotice('kindle')
    try {
      const updated = await window.dashboard.saveConfig({
        dashboardUrl: config.dashboardUrl,
        kindleIp: activeDevice?.ip || config.kindleIp,
        kindlePort: activeDevice?.port || config.kindlePort,
        kindleUser: activeDevice?.user || config.kindleUser,
        kindleRefreshInterval: config.kindleRefreshInterval,
        kindleFullRefreshEvery: config.kindleFullRefreshEvery,
        kindleWifiRetryEvery: config.kindleWifiRetryEvery,
        kindleDevices: remaining,
        activeKindleId: nextActive,
      })
      setConfig(updated)
      setForm(formFromConfig(updated))
      showMessage('kindle', t('deviceRemoved'))
    } catch (err) {
      showError('kindle', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveLanguage(language: LanguagePreference): Promise<void> {
    setSavingLanguage(true)
    clearNotice('configuracoes')
    try {
      const saved = await window.dashboard.setLanguage(language)
      setConfig(saved)
      const savedTranslator = createTranslator(resolveLanguage(saved.language, runtime?.systemLanguage))
      showMessage('configuracoes', savedTranslator('languageSaved'))
    } catch (languageError) {
      showError('configuracoes', languageError instanceof Error ? languageError.message : String(languageError))
    } finally {
      setSavingLanguage(false)
    }
  }

  async function handleSaveDashboardTitle(title: string): Promise<void> {
    setSavingTitle(true)
    clearNotice('configuracoes')
    try {
      const saved = await window.dashboard.setDashboardTitle(title)
      setConfig(saved)
      showMessage('configuracoes', 'Título do dashboard atualizado!')
      setPreviewKey(Date.now())
    } catch (titleError) {
      showError('configuracoes', titleError instanceof Error ? titleError.message : String(titleError))
    } finally {
      setSavingTitle(false)
    }
  }

  async function handleTogglePictureInPicture(enabled: boolean): Promise<void> {
    setSavingPip(true)
    clearNotice('configuracoes')
    try {
      const saved = await window.dashboard.setPictureInPicture(enabled)
      setConfig(saved)
      showMessage('configuracoes', saved.pictureInPicture ? t('pipEnabled') : t('pipDisabled'))
    } catch (pipError) {
      showError('configuracoes', pipError instanceof Error ? pipError.message : String(pipError))
    } finally {
      setSavingPip(false)
    }
  }

  async function handleChangePipScale(scale: number): Promise<void> {
    setSavingPipScale(true)
    clearNotice('configuracoes')
    try {
      const saved = await window.dashboard.setPictureInPictureScale(scale)
      setConfig(saved)
      showMessage('configuracoes', t('pipScaleSaved'))
    } catch (pipScaleError) {
      showError('configuracoes', pipScaleError instanceof Error ? pipScaleError.message : String(pipScaleError))
    } finally {
      setSavingPipScale(false)
    }
  }

  async function handleCheckKindle(): Promise<void> {
    const saved = await saveCurrentConfig()
    if (!saved) return

    setCheckingKindle(true)
    clearNotice('kindle')
    try {
      const status = await window.dashboard.checkKindle()
      setKindle(status)
      showMessage('kindle', status.detail)
      if (status.connected) {
        const scriptStatus = await window.dashboard.getKindleScriptStatus()
        setKindleScript(scriptStatus)
        setInstallOutput(scriptStatus.output)
      }
      setNav('kindle')
    } catch (kindleError) {
      showError('kindle', kindleError instanceof Error ? kindleError.message : String(kindleError))
    } finally {
      setCheckingKindle(false)
    }
  }

  async function handleInstallKindle(): Promise<void> {
    const saved = await saveCurrentConfig()
    if (!saved) return

    setInstalling(true)
    clearNotice('kindle')
    setInstallOutput(null)
    try {
      const result = await window.dashboard.installKindle()
      setConfig(result.config)
      setForm(formFromConfig(result.config))
      setInstallOutput(result.output)
      setKindleScript(result.status)
      showMessage('kindle', t('scriptsInstalled'))
      setNav('painel')
      await refreshAuth()
    } catch (installError) {
      showError('kindle', installError instanceof Error ? installError.message : String(installError))
    } finally {
      setInstalling(false)
    }
  }

  async function handleUninstallKindle(): Promise<void> {
    const confirmed = window.confirm(t('uninstallConfirm'))
    if (!confirmed) return

    const saved = await saveCurrentConfig()
    if (!saved) return

    setUninstalling(true)
    clearNotice('kindle')
    setInstallOutput(null)
    try {
      const result = await window.dashboard.uninstallKindle()
      setConfig(result.config)
      setForm(formFromConfig(result.config))
      setInstallOutput(result.output)
      setKindleScript(result.status)
      showMessage('kindle', t('scriptsRemoved'))
    } catch (uninstallError) {
      showError('kindle', uninstallError instanceof Error ? uninstallError.message : String(uninstallError))
    } finally {
      setUninstalling(false)
    }
  }

  async function handleKindleScript(action: KindleScriptAction): Promise<void> {
    setScriptAction(action)
    clearNotice('kindle')
    try {
      const status = action === 'start'
        ? await window.dashboard.startKindleScript()
        : await window.dashboard.stopKindleScript()
      setKindleScript(status)
      setInstallOutput(status.output)
      showMessage('kindle', action === 'start' ? t('scriptStarted') : t('scriptStopped'))
    } catch (scriptError) {
      showError('kindle', scriptError instanceof Error ? scriptError.message : String(scriptError))
    } finally {
      setScriptAction(null)
    }
  }

  async function handleRender(): Promise<void> {
    setRendering(true)
    clearNotice('painel')
    try {
      const result = await window.dashboard.renderNow()
      setLastRender(result.updatedAt)
      setPreviewKey(Date.now())
    } catch (renderError) {
      showError('painel', renderError instanceof Error ? renderError.message : String(renderError))
    } finally {
      setRendering(false)
    }
  }

  async function handleOpenLogin(tool: AuthLoginTool): Promise<void> {
    clearNotice('logins')
    try {
      await window.dashboard.openLogin(tool)
      showMessage('logins', tool === 'claude' ? t('sourceLoginOpenedClaude') : t('sourceLoginOpenedCodex'))
    } catch (loginError) {
      showError('logins', loginError instanceof Error ? loginError.message : String(loginError))
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        appCommit={runtime?.appCommit}
        appVersion={runtime?.appVersion}
        backendPill={backendPill}
        nav={nav}
        navItems={navItems}
        onNav={setNav}
        onOpenRepo={() => void window.dashboard.openRepo()}
        t={t}
      />

      <div className="main">
        <Topbar
          activeNav={activeNav}
          canRender={Boolean(runtime)}
          language={activeLanguage}
          lastRender={lastRender}
          nav={nav}
          onRender={() => void handleRender()}
          rendering={rendering}
          t={t}
        />

        <main className="content">
          {(message || error) && noticeNav === nav ? (
            <section className="global-notices">
              {message ? <div className="notice ok">{message}</div> : null}
              {error ? <div className="notice error">{error}</div> : null}
            </section>
          ) : null}

          {nav === 'painel' ? (
            <PanelView
              baseUrl={runtime?.baseUrl}
              kindleLive={kindleLive}
              language={activeLanguage}
              onNav={setNav}
              previewKey={previewKey}
              t={t}
              onSaved={(msg) => showMessage('painel', msg)}
              onError={(err) => showError('painel', err)}
            />
          ) : null}

          {nav === 'widgets' ? (
            <WidgetsView
              onSaved={(msg) => showMessage('widgets', msg)}
              onError={(err) => showError('widgets', err)}
              t={t}
            />
          ) : null}

          {nav === 'tamagotchi' ? (
            <TamagotchiView
              onSaved={(msg) => showMessage('tamagotchi', msg)}
              onError={(err) => showError('tamagotchi', err)}
              t={t}
            />
          ) : null}

          {nav === 'notificacoes' ? (
            <NotifyView
              onSaved={(msg) => showMessage('notificacoes', msg)}
              onError={(err) => showError('notificacoes', err)}
              t={t}
            />
          ) : null}

          {nav === 'configuracoes' ? (
            <SettingsView
              dashboardTitle={config?.dashboardTitle || 'PaperDeck'}
              disabled={!config}
              languagePreference={config?.language ?? 'system'}
              onChangeDashboardTitle={(title) => void handleSaveDashboardTitle(title)}
              onChangeLanguage={(language) => void handleSaveLanguage(language)}
              onChangePictureInPictureScale={(scale) => void handleChangePipScale(scale)}
              onTogglePictureInPicture={(enabled) => void handleTogglePictureInPicture(enabled)}
              pictureInPicture={config?.pictureInPicture ?? false}
              pictureInPictureScale={config?.pictureInPictureScale ?? 1.5}
              saving={savingLanguage}
              savingPip={savingPip}
              savingPipScale={savingPipScale}
              savingTitle={savingTitle}
              systemLanguage={runtime?.systemLanguage}
              t={t}
            />
          ) : null}

          {nav === 'kindle' ? (
            <KindleView
              checkingKindle={checkingKindle}
              config={config}
              configured={configured}
              dashboardUrlPreview={dashboardUrlPreview}
              form={form}
              installOutput={installOutput}
              installing={installing}
              kindle={kindle}
              kindleLive={kindleLive}
              kindleScript={kindleScript}
              kindleTab={kindleTab}
              onAddDevice={(device) => handleAddKindleDevice(device)}
              onCheckKindle={() => void handleCheckKindle()}
              onInstall={() => void handleInstallKindle()}
              onKindleTab={setKindleTab}
              onRemoveDevice={(id) => handleRemoveKindleDevice(id)}
              onScript={(action) => void handleKindleScript(action)}
              onSelectDevice={(id) => handleSelectKindleDevice(id)}
              onSubmitConfig={() => void saveCurrentConfig()}
              onUninstall={() => void handleUninstallKindle()}
              onUpdateForm={updateForm}
              saving={saving}
              scriptAction={scriptAction}
              t={t}
              uninstalling={uninstalling}
            />
          ) : null}

          {nav === 'logins' ? (
            <LoginsView
              checking={checkingAuth}
              language={activeLanguage}
              onLogin={(tool) => void handleOpenLogin(tool)}
              onRecheck={() => void refreshAuth()}
              sources={auth?.sources}
              t={t}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
