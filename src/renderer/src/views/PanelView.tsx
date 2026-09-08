import PreviewFrame from '../PreviewFrame'
import type { Translator } from '../i18n'
import type { KindleLiveInfo, SupportedLanguage } from '../../../shared/types'
import type { NavKey } from '../types'
import { ActionButton } from '../components/ActionButton'

interface PanelViewProps {
  baseUrl: string | undefined
  kindleLive: KindleLiveInfo | null
  language: SupportedLanguage
  onNav: (key: NavKey) => void
  previewKey: number
  t: Translator
}

export function PanelView({
  baseUrl,
  kindleLive,
  language,
  onNav,
  previewKey,
  t,
}: PanelViewProps): React.JSX.Element {
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

      <section className="preview-wrap">
        <section className="preview-panel">
          {baseUrl ? (
            <PreviewFrame baseUrl={baseUrl} language={language} previewKey={previewKey} />
          ) : (
            <div className="loading">{t('appLoading')}</div>
          )}
        </section>
      </section>
    </section>
  )
}
