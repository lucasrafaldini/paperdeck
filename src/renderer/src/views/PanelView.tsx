import { useState } from 'react'
import PreviewFrame from '../PreviewFrame'
import type { Translator } from '../i18n'
import type { KindleLiveInfo, SupportedLanguage } from '../../../shared/types'
import type { NavKey } from '../types'
import { ActionButton } from '../components/ActionButton'
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
  const hasBattery = kindleLive && kindleLive.battery != null

  return (
    <section className="dashboard-grid">
      {/* Top Status & Quick Actions Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'var(--panel)',
          borderRadius: '10px',
          border: '1px solid var(--line)',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{kindleLive?.isCharging ? '⚡' : '🔋'}</span>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>
                {t('batteryHeader')}
              </span>
              <strong style={{ fontSize: '15px' }}>
                {hasBattery ? `${kindleLive.battery}%` : '--%'}
                {kindleLive?.isCharging ? ` (${t('charging')})` : ''}
              </strong>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--line-2)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🖥️</span>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>
                {t('backend')}
              </span>
              <strong style={{ fontSize: '15px', color: 'var(--ok)' }}>Online (:8787)</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <ActionButton
            icon={isEditingLayout ? 'check' : 'slider'}
            className={isEditingLayout ? '' : 'ghost'}
            onClick={() => setIsEditingLayout(!isEditingLayout)}
          >
            {isEditingLayout ? '👁️ Ver Preview' : '🎨 Editor de Blocos'}
          </ActionButton>
          <ActionButton
            icon="slider"
            className="ghost"
            onClick={() => onNav('widgets')}
          >
            {t('menuWidgets')}
          </ActionButton>
          <ActionButton
            icon="bell"
            className="ghost"
            onClick={() => onNav('notificacoes')}
          >
            {t('menuNotify')}
          </ActionButton>
        </div>
      </div>

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
            {baseUrl ? (
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

