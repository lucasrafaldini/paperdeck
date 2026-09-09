import { useState } from 'react'
import { ActionButton } from '../components/ActionButton'
import { ExecPill, ReqChip } from '../components/StatusChips'
import type { Translator } from '../i18n'
import { dashboardHostFromUrl, dashboardUrlWithHost, formatTime } from '../lib/format'
import type { ConfigForm, KindleScriptAction, KindleTab } from '../types'
import type { DashboardConfig, KindleDevice, KindleLiveInfo, KindleScriptStatus, KindleStatus } from '../../../shared/types'

interface KindleViewProps {
  checkingKindle: boolean
  config: DashboardConfig | null
  configured: boolean
  dashboardUrlPreview: string
  form: ConfigForm | null
  installOutput: string | null
  installing: boolean
  kindle: KindleStatus | null
  kindleLive: KindleLiveInfo | null
  kindleScript: KindleScriptStatus | null
  kindleTab: KindleTab
  onAddDevice: (device: { name: string; ip: string; port: number; user: string }) => Promise<void>
  onCheckKindle: () => void
  onInstall: () => void
  onKindleTab: (tab: KindleTab) => void
  onRemoveDevice: (id: string) => Promise<void>
  onScript: (action: KindleScriptAction) => void
  onSelectDevice: (id: string) => Promise<void>
  onSubmitConfig: () => void
  onUninstall: () => void
  onUpdateForm: (key: keyof ConfigForm, value: string) => void
  saving: boolean
  scriptAction: KindleScriptAction | null
  t: Translator
  uninstalling: boolean
}

export function KindleView({
  checkingKindle,
  config,
  configured,
  dashboardUrlPreview,
  form,
  installOutput,
  installing,
  kindle,
  kindleLive,
  kindleScript,
  kindleTab,
  onAddDevice,
  onCheckKindle,
  onInstall,
  onKindleTab,
  onRemoveDevice,
  onScript,
  onSelectDevice,
  onSubmitConfig,
  onUninstall,
  onUpdateForm,
  saving,
  scriptAction,
  t,
  uninstalling,
}: KindleViewProps): React.JSX.Element {
  const busy = saving || installing || uninstalling || checkingKindle || scriptAction !== null
  const [newName, setNewName] = useState('')
  const [newIp, setNewIp] = useState('')
  const [newPort, setNewPort] = useState('22')
  const [newUser, setNewUser] = useState('root')
  const [addingDevice, setAddingDevice] = useState(false)

  const devices: KindleDevice[] = config?.kindleDevices && config.kindleDevices.length > 0
    ? config.kindleDevices
    : [
        {
          id: 'default',
          name: 'Kindle Principal (Mesa)',
          ip: config?.kindleIp || '192.168.0.40',
          port: config?.kindlePort || 22,
          user: config?.kindleUser || 'root',
        },
      ]

  async function handleAddSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!newIp.trim()) return
    setAddingDevice(true)
    try {
      await onAddDevice({
        name: newName.trim() || `Kindle ${newIp.trim()}`,
        ip: newIp.trim(),
        port: Number.parseInt(newPort, 10) || 22,
        user: newUser.trim() || 'root',
      })
      setNewName('')
      setNewIp('')
      setNewPort('22')
      setNewUser('root')
    } finally {
      setAddingDevice(false)
    }
  }

  return (
    <section className="single-grid">
      <div className="subtabs" role="tablist">
        <ActionButton
          role="tab"
          aria-selected={kindleTab === 'dispositivos'}
          className={`subtab ${kindleTab === 'dispositivos' ? 'active' : ''}`}
          onClick={() => onKindleTab('dispositivos')}
          icon="battery"
        >
          {t('kindleDevicesTab')}
        </ActionButton>
        <ActionButton
          role="tab"
          aria-selected={kindleTab === 'config'}
          className={`subtab ${kindleTab === 'config' ? 'active' : ''}`}
          onClick={() => onKindleTab('config')}
          icon="settings"
        >
          {t('configSectionTitle')}
        </ActionButton>
        <ActionButton
          role="tab"
          aria-selected={kindleTab === 'diagnostico'}
          className={`subtab ${kindleTab === 'diagnostico' ? 'active' : ''}`}
          onClick={() => onKindleTab('diagnostico')}
          icon="stethoscope"
        >
          {t('diagnosticsInstall')}
        </ActionButton>
      </div>

      {kindleTab === 'dispositivos' ? (
        <section className="kindle-devices-view">
          <div className="panel devices-intro-banner">
            <div>
              <p className="eyebrow">{t('kindleDevicesTab')}</p>
              <h2>{t('kindleDevicesTitle')}</h2>
              <p className="field-note">{t('kindleDevicesSub')}</p>
            </div>
          </div>

          <div className="devices-list-grid">
            {devices.map((device) => {
              const isSelected = device.id === config?.activeKindleId || (!config?.activeKindleId && device.ip === (config?.kindleIp || '192.168.0.40'))
              const live = kindleLive?.devices?.[device.ip] || (device.ip === kindleLive?.clientIp ? kindleLive : null)
              const hasBat = live?.battery !== null && live?.battery !== undefined
              const lastSeenText = live?.lastSeen ? formatTime(new Date(live.lastSeen).toISOString(), 'pt-BR', t('loading')) : null

              return (
                <div key={device.id} className={`panel device-card ${isSelected ? 'active-device' : ''}`}>
                  <div className="device-card-header">
                    <div>
                      <h3 className="device-name">{device.name}</h3>
                      <span className="device-ip-tag">{device.ip}:{device.port || 22}</span>
                    </div>
                    {isSelected ? (
                      <span className="badge ok">{t('activeBadge')}</span>
                    ) : (
                      <ActionButton
                        className="ghost compact"
                        onClick={() => void onSelectDevice(device.id)}
                        disabled={busy}
                        icon="check"
                      >
                        {t('selectDevice')}
                      </ActionButton>
                    )}
                  </div>

                  <div className="device-card-body">
                    <div className="device-row">
                      <span className="row-label">{t('fieldUser')}:</span>
                      <span className="row-val">{device.user || 'root'}</span>
                    </div>
                    <div className="device-row">
                      <span className="row-label">{t('batteryHeader')}:</span>
                      <span className="row-val">
                        {hasBat ? `${live.battery}% · ${live.isCharging ? t('charging') : t('notCharging')}` : 'Aguardando sync'}
                      </span>
                    </div>
                    {lastSeenText ? (
                      <div className="device-row">
                        <span className="row-label">{t('updatedAt')}:</span>
                        <span className="row-val muted">{lastSeenText}</span>
                      </div>
                    ) : null}
                  </div>

                  {devices.length > 1 ? (
                    <div className="device-card-footer">
                      <ActionButton
                        className="ghost danger compact"
                        icon="trash"
                        onClick={() => void onRemoveDevice(device.id)}
                        disabled={busy}
                      >
                        {t('removeDevice')}
                      </ActionButton>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <form className="panel add-device-form" onSubmit={(e) => void handleAddSubmit(e)}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{t('kindleDevicesTab')}</p>
                <h3>+ {t('addKindle')}</h3>
              </div>
            </div>

            <div className="field-grid">
              <label>
                <span>{t('deviceName')}</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('deviceNamePlaceholder')}
                />
              </label>
              <label>
                <span>{t('fieldKindleIp')}</span>
                <input
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="192.168.0.x"
                  required
                />
              </label>
              <label>
                <span>{t('fieldPort')}</span>
                <input
                  value={newPort}
                  onChange={(e) => setNewPort(e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label>
                <span>{t('fieldUser')}</span>
                <input
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  placeholder="root"
                />
              </label>
            </div>

            <div className="button-row">
              <ActionButton type="submit" icon="plus" disabled={busy || addingDevice || !newIp.trim()}>
                {addingDevice ? t('addingKindle') : t('addKindle')}
              </ActionButton>
            </div>
          </form>
        </section>
      ) : null}

      {kindleTab === 'config' ? (
        <form
          className="panel settings-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmitConfig()
          }}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t('configSectionEyebrow')}</p>
              <h2>{t('configSectionTitle')}</h2>
            </div>
            <span className={`badge ${configured ? 'ok' : 'warn'}`}>
              {configured ? t('configBadgeReady') : t('configBadgePending')}
            </span>
          </div>

          <div className="field-grid">
            <label>
              <span>{t('fieldKindleIp')}</span>
              <input
                value={form?.kindleIp ?? ''}
                onChange={(event) => onUpdateForm('kindleIp', event.target.value)}
                placeholder={t('fieldKindleIpPlaceholder')}
              />
            </label>
            <label>
              <span>{t('fieldPort')}</span>
              <input value={form?.kindlePort ?? ''} onChange={(event) => onUpdateForm('kindlePort', event.target.value)} inputMode="numeric" />
            </label>
            <label>
              <span>{t('fieldUser')}</span>
              <input value={form?.kindleUser ?? ''} onChange={(event) => onUpdateForm('kindleUser', event.target.value)} />
            </label>
            <label>
              <span>{t('fieldPassword')}</span>
              <input
                value={form?.kindlePassword ?? ''}
                onChange={(event) => onUpdateForm('kindlePassword', event.target.value)}
                placeholder={config?.kindlePasswordSaved ? t('fieldPasswordSaved') : t('fieldPasswordPlaceholder')}
                type="password"
              />
            </label>
          </div>

          <label className="wide-field">
            <span>{t('dashboardHost')}</span>
            <input
              value={dashboardHostFromUrl(form?.dashboardUrl ?? '')}
              onChange={(event) => onUpdateForm('dashboardUrl', dashboardUrlWithHost(form?.dashboardUrl ?? '', event.target.value))}
              placeholder={t('dashboardHostPlaceholder')}
            />
            <small className="field-note">{t('dashboardGeneratedUrl', { value: dashboardUrlPreview || t('loading') })}</small>
          </label>

          <div className="field-grid compact">
            <label>
              <span>{t('downloadInterval')}</span>
              <input value={form?.kindleRefreshInterval ?? ''} onChange={(event) => onUpdateForm('kindleRefreshInterval', event.target.value)} inputMode="numeric" />
            </label>
            <label>
              <span>{t('fullRefresh')}</span>
              <input value={form?.kindleFullRefreshEvery ?? ''} onChange={(event) => onUpdateForm('kindleFullRefreshEvery', event.target.value)} inputMode="numeric" />
            </label>
            <label>
              <span>{t('fieldWifiRetry')}</span>
              <input value={form?.kindleWifiRetryEvery ?? ''} onChange={(event) => onUpdateForm('kindleWifiRetryEvery', event.target.value)} inputMode="numeric" />
            </label>
          </div>

          <div className="button-row">
            <ActionButton type="submit" icon="save" disabled={saving}>{saving ? t('saving') : t('save')}</ActionButton>
          </div>
        </form>
      ) : null}

      {kindleTab === 'diagnostico' ? (
        <section className="diag">
          <section className="panel diag-step">
            <header className="step-head">
              <span className="step-num" aria-hidden="true">1</span>
              <div className="step-info">
                <h2>{t('step1Title')}</h2>
                <p className="step-sub">{t('step1Sub')}</p>
              </div>
              <ActionButton className="ghost" icon="search" onClick={onCheckKindle} disabled={checkingKindle || saving}>
                {checkingKindle ? t('checkingKindle') : t('checkKindle')}
              </ActionButton>
            </header>

            {kindle ? (
              <>
                <div className={`conn-banner ${kindle.connected ? 'ok' : 'bad'}`}>
                  <span className="conn-dot" aria-hidden="true" />
                  <div className="conn-text">
                    <strong>{kindle.connected ? t('connectionReady') : t('connectionFail')}</strong>
                    <span>{kindle.detail}{kindle.model ? ` · ${kindle.model}` : ''}</span>
                  </div>
                </div>
                <div className="req-grid">
                  <ReqChip ok={kindle.jailbroken} label="Jailbreak" desc={t('reqJailbreak')} />
                  <ReqChip ok={kindle.fbink} label="FBInk" desc={t('reqFbink')} />
                  <ReqChip ok={kindle.hotfix} label="Hotfix" desc={t('reqHotfix')} />
                  <ReqChip ok={kindle.canInstall} label={t('configBadgeReady')} desc={t('reqReady')} />
                </div>
              </>
            ) : (
              <p className="step-empty">{t('diagnosticEmpty')}</p>
            )}
          </section>

          <section className="panel diag-step">
            <header className="step-head">
              <span className="step-num" aria-hidden="true">2</span>
              <div className="step-info">
                <h2>{t('step2Title')}</h2>
                <p className="step-sub">{t('step2Sub')}</p>
              </div>
              {kindleScript ? (
                <span className={`badge ${kindleScript.installed ? 'ok' : 'warn'}`}>
                  {kindleScript.installed ? t('installed') : t('statusInstalledMissing')}
                </span>
              ) : null}
            </header>

            <div className="button-row">
              <ActionButton icon="download" onClick={onInstall} disabled={busy}>
                {installing ? t('installing') : t('installScripts')}
              </ActionButton>
              <ActionButton className="ghost danger" icon="trash" onClick={onUninstall} disabled={busy}>
                {uninstalling ? t('uninstallBusy') : t('uninstall')}
              </ActionButton>
            </div>
          </section>

          <section className="panel diag-step">
            <header className="step-head">
              <span className="step-num" aria-hidden="true">3</span>
              <div className="step-info">
                <h2>{t('step3Title')}</h2>
                <p className="step-sub">{t('step3Sub')}</p>
              </div>
            </header>

            {kindleScript ? (
              <div className="exec-grid">
                <ExecPill ok={kindleScript.running} label={t('loop')} value={kindleScript.running ? t('loopRunning') : t('loopStopped')} />
                <ExecPill ok={kindleScript.enabled} label={t('autostart')} value={kindleScript.enabled ? t('autostartActive') : t('autostartInactive')} />
                <ExecPill ok={kindleScript.backendReachable} label={t('backend')} value={kindleScript.backendReachable ? t('ok') : t('backendOffline')} />
              </div>
            ) : (
              <p className="step-empty">{t('diagnosticScriptEmpty')}</p>
            )}

            <div className="button-row">
              <ActionButton
                icon="play"
                onClick={() => onScript('start')}
                disabled={!kindleScript?.installed || kindleScript.running || scriptAction !== null || installing || uninstalling || checkingKindle}
              >
                {scriptAction === 'start' ? t('starting') : t('startScript')}
              </ActionButton>
              <ActionButton
                className="ghost"
                icon="stop"
                onClick={() => onScript('stop')}
                disabled={!kindleScript?.running || scriptAction !== null || installing || uninstalling || checkingKindle}
              >
                {scriptAction === 'stop' ? t('stopping') : t('stopScript')}
              </ActionButton>
            </div>
          </section>

          {installOutput ? (
            <details className="tech-log">
              <summary>{t('detailsTechnical')}</summary>
              <pre className="output-log">{installOutput}</pre>
            </details>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
