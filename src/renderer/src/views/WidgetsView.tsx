import { useEffect, useState } from 'react'
import type { DashboardWidgetsConfig } from '../../../shared/types'
import { ActionButton } from '../components/ActionButton'
import { Icon } from '../components/Icon'
import type { Translator } from '../i18n'

interface WidgetsViewProps {
  onSaved: (message: string) => void
  onError: (error: string) => void
  t: Translator
}

const WIDGET_DESCRIPTIONS: Record<string, { desc: string; icon: string }> = {
  claude: {
    desc: 'Uso da assinatura Claude Desktop / CLI (5h e 7d) com resets em tempo real.',
    icon: '🤖',
  },
  omnirouter: {
    desc: 'Roteamento multi-LLM (tokens, custo em USD, requisições e modelos mais usados).',
    icon: '🌐',
  },
  antigravity: {
    desc: 'Google DeepMind Antigravity AI, sessões ativas e projetos do Brain.',
    icon: '🧠',
  },
  applemusic: {
    desc: 'Música tocando no Mac, artista, álbum e barra de progresso.',
    icon: '🎵',
  },
  chaosmachine: {
    desc: 'Servidor remoto Linux via SSH (load average, RAM usada, uptime).',
    icon: '🖥️',
  },
  codex: {
    desc: 'OpenAI Codex CLI, tokens utilizados e limites de uso.',
    icon: '⚡',
  },
}

export function WidgetsView({ onSaved, onError, t }: WidgetsViewProps): React.JSX.Element {
  const [config, setConfig] = useState<DashboardWidgetsConfig | null>(null)
  const [activeList, setActiveList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    window.dashboard
      .getWidgets()
      .then((cfg) => {
        if (!mounted) return
        setConfig(cfg)
        setActiveList(cfg.activeWidgets || ['claude', 'omnirouter'])
      })
      .catch((err) => {
        if (!mounted) return
        onError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [onError])

  const toggleWidget = (id: string): void => {
    setActiveList((current) => {
      if (current.includes(id)) {
        if (current.length <= 1) return current // manter ao menos 1 widget
        return current.filter((item) => item !== id)
      }
      return [...current, id]
    })
  }

  const moveUp = (index: number): void => {
    if (index <= 0) return
    setActiveList((current) => {
      const next = [...current]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const moveDown = (index: number): void => {
    if (index >= activeList.length - 1) return
    setActiveList((current) => {
      const next = [...current]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated = await window.dashboard.saveWidgets(activeList)
      setConfig(updated)
      setActiveList(updated.activeWidgets)
      onSaved(t('widgetsSaved'))
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !config) {
    return <div className="loading">{t('loading')}</div>
  }

  const available = config.availableWidgets || []
  // Coloca na frente os ativos na ordem de activeList, e depois os inativos
  const orderedAvailable = [
    ...activeList.map((id) => available.find((w) => w.id === id)).filter(Boolean),
    ...available.filter((w) => !activeList.includes(w.id)),
  ] as Array<{ id: string; name: string }>

  return (
    <div className="view-container">
      <section className="settings-section">
        <div className="settings-section-head">
          <span className="settings-section-eyebrow">Dashboard</span>
          <h2>{t('widgetsTitle')}</h2>
          <p className="settings-section-sub">{t('widgetsSub')}</p>
        </div>

        <div className="widgets-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {orderedAvailable.map((widget) => {
            const isActive = activeList.includes(widget.id)
            const activeIndex = activeList.indexOf(widget.id)
            const meta = WIDGET_DESCRIPTIONS[widget.id] || { desc: '', icon: '📦' }

            return (
              <div
                key={widget.id}
                className={`card-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: 'var(--panel)',
                  borderRadius: '10px',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--line)',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                  <span style={{ fontSize: '24px', lineHeight: 1 }}>{meta.icon}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '16px' }}>{widget.name}</strong>
                      <span
                        className={`status-pill ${isActive ? 'online' : 'offline'}`}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        {isActive ? t('widgetsActive') : t('widgetsInactive')}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dim)' }}>{meta.desc}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isActive ? (
                    <div style={{ display: 'flex', gap: '4px', marginRight: '6px' }}>
                      <button
                        type="button"
                        className="ghost ui-button"
                        style={{ minHeight: '32px', padding: '4px 8px' }}
                        disabled={activeIndex === 0}
                        onClick={() => moveUp(activeIndex)}
                        title={t('widgetsMoveUp')}
                      >
                        <span className="button-icon">
                          <Icon name="arrow-up" />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ghost ui-button"
                        style={{ minHeight: '32px', padding: '4px 8px' }}
                        disabled={activeIndex === activeList.length - 1}
                        onClick={() => moveDown(activeIndex)}
                        title={t('widgetsMoveDown')}
                      >
                        <span className="button-icon">
                          <Icon name="arrow-down" />
                        </span>
                      </button>
                    </div>
                  ) : null}

                  <ActionButton
                    icon={isActive ? 'check' : 'slider'}
                    className={isActive ? '' : 'ghost'}
                    onClick={() => toggleWidget(widget.id)}
                  >
                    {isActive ? t('widgetsActive') : t('widgetsInactive')}
                  </ActionButton>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <ActionButton
            disabled={saving}
            icon="save"
            onClick={() => void handleSave()}
          >
            {saving ? t('saving') : t('widgetsSaveButton')}
          </ActionButton>
        </div>
      </section>
    </div>
  )
}
