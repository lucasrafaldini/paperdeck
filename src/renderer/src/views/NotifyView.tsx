import { useEffect, useState } from 'react'
import type { ActiveNotification, ScheduledNotification } from '../../../shared/types'
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

const QUICK_DELAYS = [
  { label: 'Em 5 min', min: 5 },
  { label: 'Em 15 min', min: 15 },
  { label: 'Em 30 min', min: 30 },
  { label: 'Em 1 hora', min: 60 },
  { label: 'Em 2 horas', min: 120 },
]

export function NotifyView({ onSaved, onError, t }: NotifyViewProps): React.JSX.Element {
  const [activeNotify, setActiveNotify] = useState<ActiveNotification | null>(null)
  const [scheduledList, setScheduledList] = useState<ScheduledNotification[]>([])
  const [message, setMessage] = useState('')
  const [durationSec, setDurationSec] = useState(900)
  const [sending, setSending] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [mode, setMode] = useState<'immediate' | 'schedule'>('immediate')
  const [delayMinutes, setDelayMinutes] = useState(15)
  const [customDateTime, setCustomDateTime] = useState('')

  const fetchNotification = (): void => {
    window.dashboard
      .getNotification()
      .then((notif) => setActiveNotify(notif))
      .catch(() => {})

    window.dashboard
      .getScheduledNotifications()
      .then((list) => setScheduledList(list))
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

  const handleSchedule = async (): Promise<void> => {
    const finalMsg = message.trim()
    if (!finalMsg) return

    let targetTimeMs: number
    if (customDateTime) {
      targetTimeMs = new Date(customDateTime).getTime()
      if (Number.isNaN(targetTimeMs) || targetTimeMs <= Date.now()) {
        onError('Selecione uma data e hora futura válida.')
        return
      }
    } else {
      targetTimeMs = Date.now() + delayMinutes * 60 * 1000
    }

    setSending(true)
    try {
      await window.dashboard.scheduleNotification(finalMsg, targetTimeMs, durationSec)
      setMessage('')
      setCustomDateTime('')
      fetchNotification()
      onSaved('Notificação agendada com sucesso!')
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const handleCancelScheduled = async (id: string): Promise<void> => {
    try {
      await window.dashboard.cancelScheduledNotification(id)
      setScheduledList((prev) => prev.filter((item) => item.id !== id))
      onSaved('Agendamento cancelado.')
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
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

  const formatScheduledTime = (timestamp: number): string => {
    const diffMin = Math.round((timestamp - Date.now()) / 60000)
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diffMin <= 0) return `Agora (${timeStr})`
    if (diffMin < 60) return `Em ${diffMin} min (${timeStr})`
    const hours = Math.floor(diffMin / 60)
    const mins = diffMin % 60
    return `Em ${hours}h ${mins > 0 ? `${mins}m ` : ''}(${timeStr})`
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

        {/* Notificações Agendadas na Fila */}
        {scheduledList.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-soft)', marginBottom: '8px' }}>
              Fila de Notificações Agendadas ({scheduledList.length})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {scheduledList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>📢 {item.message}</div>
                    <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '2px' }}>
                      ⏰ {formatScheduledTime(item.scheduledFor)} · Duração: {item.durationSec / 60}m
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ghost ui-button"
                    style={{ minHeight: '30px', padding: '4px 10px', fontSize: '12px', color: 'var(--danger)' }}
                    onClick={() => void handleCancelScheduled(item.id)}
                    title="Cancelar agendamento"
                  >
                    <span className="button-icon">
                      <Icon name="trash" />
                    </span>
                    <span>Cancelar</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modo de Envio: Imediato vs Agendado */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
          <button
            type="button"
            className={`ui-button ${mode === 'immediate' ? '' : 'ghost'}`}
            style={{ minHeight: '36px', padding: '6px 14px' }}
            onClick={() => setMode('immediate')}
          >
            <span className="button-icon">
              <Icon name="bell" />
            </span>
            <span>Enviar Imediatamente</span>
          </button>
          <button
            type="button"
            className={`ui-button ${mode === 'schedule' ? '' : 'ghost'}`}
            style={{ minHeight: '36px', padding: '6px 14px' }}
            onClick={() => setMode('schedule')}
          >
            <span className="button-icon">
              <Icon name="bell" />
            </span>
            <span>Agendar Notificação</span>
          </button>
        </div>

        {/* Formulário */}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                if (e.key === 'Enter') {
                  if (mode === 'immediate') void handleSend()
                  else void handleSchedule()
                }
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
                    if (mode === 'immediate') void handleSend(preset)
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

          {/* Controles de Agendamento */}
          {mode === 'schedule' && (
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                Disparar em quanto tempo?
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {QUICK_DELAYS.map((d) => (
                  <button
                    key={d.min}
                    type="button"
                    className={`ui-button ${delayMinutes === d.min && !customDateTime ? '' : 'ghost'}`}
                    style={{ minHeight: '32px', padding: '4px 12px', fontSize: '13px' }}
                    onClick={() => {
                      setDelayMinutes(d.min)
                      setCustomDateTime('')
                    }}
                  >
                    <span>{d.label}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-soft)' }}>Ou horário específico:</span>
                <input
                  type="datetime-local"
                  className="field-input"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    fontSize: '13px',
                  }}
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Duração na tela */}
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
            {mode === 'immediate' ? (
              <ActionButton
                disabled={sending || !message.trim()}
                icon="bell"
                onClick={() => void handleSend()}
              >
                {sending ? t('notifySending') : t('notifySendButton')}
              </ActionButton>
            ) : (
              <ActionButton
                disabled={sending || !message.trim()}
                icon="bell"
                onClick={() => void handleSchedule()}
              >
                {sending ? 'Agendando...' : 'Agendar Notificação'}
              </ActionButton>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

