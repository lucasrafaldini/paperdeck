import { useEffect, useState } from 'react'
import PreviewFrame from '../PreviewFrame'
import LiveEditFrame from '../LiveEditFrame'
import type { Translator } from '../i18n'
import type { KindleLiveInfo, SupportedLanguage } from '../../../shared/types'
import type { NavKey } from '../types'
import { ActionButton } from '../components/ActionButton'
import { Icon } from '../components/Icon'
import { TamagotchiBox } from '../components/TamagotchiBox'
import { LayoutEditor } from './LayoutEditor'

interface PanelViewProps {
  baseUrl: string | undefined
  kindleLive: KindleLiveInfo | null
  language: SupportedLanguage
  onNav: (key: NavKey) => void
  previewKey: number
  t: Translator
  onSaved?: (message: string) => void
  onError?: (error: string) => void
}

export function PanelView({
  baseUrl,
  kindleLive,
  language,
  onNav,
  previewKey,
  t,
  onSaved,
  onError,
}: PanelViewProps): React.JSX.Element {
  const [isEditingLayout, setIsEditingLayout] = useState(false)
  const [isEditingOnScreen, setIsEditingOnScreen] = useState(false)
  const [showPetBox, setShowPetBox] = useState(false)
  const hasBattery = kindleLive && kindleLive.battery != null
  const backendPort = (() => {
    try {
      return baseUrl ? new URL(baseUrl).port : ''
    } catch {
      return ''
    }
  })()

  useEffect(() => {
    // Se o widget de tamagotchi estiver ativo, abre por padrão
    void window.dashboard?.getWidgets?.().then((cfg) => {
      if (cfg?.activeWidgets?.includes('tamagotchi')) {
        setShowPetBox(true)
      }
    }).catch(() => {})
  }, [])

  return (
    <section className="dashboard-grid">
      <div className="panel-bar">
        <div className="panel-bar-status">
          <div className="panel-stat" title={kindleLive?.isCharging ? t('charging') : undefined}>
            <span className="panel-stat-icon" aria-hidden="true">
              <Icon name={kindleLive?.isCharging ? 'bolt' : 'battery'} />
            </span>
            <div className="panel-stat-text">
              <span className="panel-stat-label">{t('batteryHeader')}</span>
              <strong className="panel-stat-value">
                {hasBattery ? `${kindleLive.battery}%` : '--%'}
                {kindleLive?.isCharging ? <small>{t('charging')}</small> : null}
              </strong>
            </div>
          </div>
          <div className="panel-stat" title={baseUrl}>
            <span className="panel-stat-icon" aria-hidden="true">
              <Icon name="server" />
            </span>
            <div className="panel-stat-text">
              <span className="panel-stat-label">{t('backend')}</span>
              <strong className="panel-stat-value ok">
                {t('panelOnline')}
                {backendPort ? <small>:{backendPort}</small> : null}
              </strong>
            </div>
          </div>
        </div>

        <div className="panel-bar-actions">
          <div className="panel-bar-group">
            <ActionButton
              icon={isEditingOnScreen ? 'check' : 'edit'}
              className={isEditingOnScreen ? '' : 'ghost'}
              aria-pressed={isEditingOnScreen}
              onClick={() => {
                setIsEditingLayout(false)
                setIsEditingOnScreen(!isEditingOnScreen)
              }}
            >
              {isEditingOnScreen ? t('editOnScreenDone') : t('editOnScreen')}
            </ActionButton>
            <ActionButton
              icon={isEditingLayout ? 'check' : 'slider'}
              className={isEditingLayout ? '' : 'ghost'}
              aria-pressed={isEditingLayout}
              onClick={() => {
                setIsEditingOnScreen(false)
                setIsEditingLayout(!isEditingLayout)
              }}
            >
              {isEditingLayout ? t('blockEditorDone') : t('blockEditor')}
            </ActionButton>
            <ActionButton
              icon="pet"
              className={showPetBox ? '' : 'ghost'}
              aria-pressed={showPetBox}
              onClick={() => setShowPetBox(!showPetBox)}
            >
              {t('panelPet')}
            </ActionButton>
          </div>
          <div className="panel-bar-group panel-bar-nav">
            <ActionButton icon="settings" className="ghost" title={t('menuWidgets')} onClick={() => onNav('widgets')}>
              {t('menuWidgets')}
            </ActionButton>
            <ActionButton icon="bell" className="ghost" title={t('menuNotify')} onClick={() => onNav('notificacoes')}>
              {t('menuNotify')}
            </ActionButton>
          </div>
        </div>
      </div>

      {showPetBox && !isEditingLayout && (
        <div style={{ marginBottom: '14px' }}>
          <TamagotchiBox onAction={() => void window.dashboard?.renderNow?.()} />
        </div>
      )}

      {isEditingLayout ? (
        <LayoutEditor
          onSaved={(msg) => {
            if (onSaved) onSaved(msg)
            setIsEditingLayout(false)
          }}
          onError={onError || (() => {})}
          t={t}
          onClose={() => setIsEditingLayout(false)}
        />
      ) : (
        <section className="preview-wrap">
          <section className="preview-panel">
            {baseUrl && isEditingOnScreen ? (
              <LiveEditFrame baseUrl={baseUrl} language={language} />
            ) : baseUrl ? (
              <PreviewFrame baseUrl={baseUrl} language={language} previewKey={previewKey} />
            ) : (
              <div className="loading">{t('appLoading')}</div>
            )}
          </section>
        </section>
      )}
    </section>
  )
}

