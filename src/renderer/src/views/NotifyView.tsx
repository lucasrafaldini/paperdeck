import { useEffect, useState } from 'react'
import type { ActiveNotification } from '../../../shared/types'
import { ActionButton } from '../components/ActionButton'
import { Icon } from '../components/Icon'
import type { Translator } from '../i18n'

interface NotifyViewProps {
  onSaved: (message: string) => void
  onError: (error: string) => void
  t: Translator
}

const DURATIONS = [
  { label: '5m', sec: 300 },
  { label: '15m', sec: 900 },
  { label: '30m', sec: 1800 },
  { label: '1h', sec: 3600 },
  { label: '4h', sec: 14400 },
]

export function NotifyView({ onSaved, onError, t }: NotifyViewProps): React.JSX.Element {
  const [activeNotify, setActiveNotify] = useState<ActiveNotification | null>(null)
  const [message, setMessage] = useState('')
  const [durationSec, setDurationSec] = useState(900)
  const [sending, setSending] = useState(false)
  const [clearing, setClearing] = useState(false)

  const fetchNotification = (): void => {
    window.dashboard
      .getNotification()
      .then((notif) => setActiveNotify(notif))
      .catch(() => {})
  }

  useEffect(() => {
    fetchNotification()
    const interval = setInterval(fetchNotification, 4000)
    return () => clearInterval(interval)
  }, [])

  const handleSend = async (textToSend?: string): Promise<void> => {
    const finalMsg = (textToSend || message).trim()
    if (!finalMsg) return

    setSending(true)
    try {
      const res = await window.dashboard.sendNotification(finalMsg, durationSec)
      setActiveNotify(res)
      setMessage('')
      onSaved(t('notifySentSuccess'))
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    setClearing(true)
    try {
      await window.dashboard.clearNotification()
      setActiveNotify(null)
      onSaved(t('notifyClearedSuccess'))
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="view-container">
      <section className="settings-section">
        <div className="settings-section-head">
          <span className="settings-section-eyebrow">Kindle</span>
          <h2>{t('notifyTitle')}</h2>
          <p className="settings-section-sub">{t('notifySub')}</p>
        </div>

        {/* Notificação Ativa Card */}
        <div
          style={{
            marginTop: '16px',
            padding: '16px 20px',
            borderRadius: '10px',
            background: activeNotify ? 'var(--panel-2)' : 'var(--panel)',
            border: activeNotify ? '1px solid var(--accent)' : '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: activeNotify ? 'var(--accent)' : 'var(--text-soft)',
              }}
            >
              {activeNotify ? t('notifyActiveLabel') : t('notifyNoneActive')}
            </span>
            {activeNotify ? (
              <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 700 }}>
                📢 {activeNotify.message}
              </div>
            ) : (
              <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-dim)' }}>
                Envie uma mensagem abaixo para ser fixada no topo da tela do Kindle.
              </div>
            )}
          </div>

          {activeNotify ? (
            <ActionButton
              icon="trash"
              disabled={clearing}
              onClick={() => void handleClear()}
              className="ghost"
            >
              {clearing ? t('notifyClearing') : t('notifyClearButton')}
            </ActionButton>
          ) : null}
        </div>

        {/* Formulário de Envio */}
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              {t('notifyInputLabel')}
            </label>
            <input
              type="text"
              className="field-input"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                color: 'var(--text)',
                fontSize: '15px',
              }}
              placeholder={t('notifyInputPlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSend()
              }}
            />
          </div>

          {/* Atalhos Rápidos */}
          <div>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '8px' }}>
              {t('quickPresets')}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                t('presetMeeting'),
                t('presetDeploy'),
                t('presetCoffee'),
                t('presetAlert'),
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="ghost ui-button"
                  style={{ minHeight: '32px', padding: '4px 12px', fontSize: '13px' }}
                  onClick={() => {
                    setMessage(preset)
                    void handleSend(preset)
                  }}
                >
                  <span className="button-icon">
                    <Icon name="bell" />
                  </span>
                  <span>{preset}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duração */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              {t('notifyDurationLabel')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {DURATIONS.map((dur) => (
                <button
                  key={dur.sec}
                  type="button"
                  className={`ui-button ${durationSec === dur.sec ? '' : 'ghost'}`}
                  style={{ minHeight: '36px', padding: '6px 14px' }}
                  onClick={() => setDurationSec(dur.sec)}
                >
                  <span>{dur.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <ActionButton
              disabled={sending || !message.trim()}
              icon="bell"
              onClick={() => void handleSend()}
            >
              {sending ? t('notifySending') : t('notifySendButton')}
            </ActionButton>
          </div>
        </div>
      </section>
    </div>
  )
}
