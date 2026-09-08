import { useEffect, useState } from 'react'
import type { DashboardWidgetsConfig, WidgetOptionsMap } from '../../../shared/types'
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
  macstats: {
    desc: 'Métricas de hardware do macOS (Uso de CPU, Memória RAM, Disco e Uptime).',
    icon: '💻',
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

const WIDGET_OPTIONS_SCHEMA: Record<string, { id: string; label: string; default: boolean }[]> = {
  claude: [
    { id: 'bar5h', label: 'Barra de uso de 5 horas', default: true },
    { id: 'bar7d', label: 'Barra de uso de 7 dias', default: true },
    { id: 'resets', label: 'Horários de reinício de limite', default: true },
    { id: 'history7d', label: 'Gráfico histórico (7 dias)', default: false },
    { id: 'statusPill', label: 'Status da conta e assinatura', default: true },
  ],
  antigravity: [
    { id: 'bar5h', label: 'Barra de cota de 5 horas', default: true },
    { id: 'bar7d', label: 'Barra de cota de 7 dias', default: true },
    { id: 'resets', label: 'Horários de reinício de cota', default: true },
    { id: 'statsGrid', label: 'Métricas de conversas, projetos e passos', default: true },
    { id: 'historyChart', label: 'Série histórica de passos de sessão', default: false },
  ],
  omnirouter: [
    { id: 'statGrid', label: 'Totais de tokens, custo USD, requisições e provedores', default: true },
    { id: 'topModels', label: 'Lista dos modelos mais usados', default: true },
    { id: 'pieChart', label: 'Gráfico pizza de distribuição por modelo', default: false },
    { id: 'historyChart', label: 'Gráfico de histórico de uso (7d / 15d / 30d)', default: false },
  ],
  macstats: [
    { id: 'cpuBar', label: 'Uso de CPU (%) com barra gráfica', default: true },
    { id: 'ramBar', label: 'Uso de Memória RAM (GB e %)', default: true },
    { id: 'diskBar', label: 'Espaço em disco raiz (/)', default: true },
    { id: 'uptime', label: 'Tempo de atividade (Uptime)', default: true },
    { id: 'sysInfo', label: 'Modelo do Mac e versão do macOS', default: true },
  ],
  chaosmachine: [
    { id: 'loadAvg', label: 'Load Average do processador', default: true },
    { id: 'ram', label: 'Uso de Memória RAM remota', default: true },
    { id: 'uptime', label: 'Tempo de atividade do servidor', default: true },
  ],
  applemusic: [
    { id: 'nowPlaying', label: 'Título da faixa e artista', default: true },
    { id: 'progressBar', label: 'Barra de progresso da música', default: true },
    { id: 'album', label: 'Nome do álbum', default: true },
  ],
  codex: [
    { id: 'limits', label: 'Limites e créditos disponíveis', default: true },
    { id: 'spend', label: 'Total gasto em USD e sessões ativas', default: true },
  ],
}

export function WidgetsView({ onSaved, onError, t }: WidgetsViewProps): React.JSX.Element {
  const [config, setConfig] = useState<DashboardWidgetsConfig | null>(null)
  const [activeList, setActiveList] = useState<string[]>([])
  const [options, setOptions] = useState<WidgetOptionsMap>({})
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null)
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
        setOptions(cfg.widgetOptions || {})
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
        if (current.length <= 1) return current
        return current.filter((item) => item !== id)
      }
      return [...current, id]
    })
  }

  const toggleOption = (widgetId: string, optionId: string): void => {
    setOptions((prev) => {
      const widgetOpts = { ...(prev[widgetId] || {}) }
      const schemaItem = (WIDGET_OPTIONS_SCHEMA[widgetId] || []).find((s) => s.id === optionId)
      const defaultVal = schemaItem ? schemaItem.default : true
      const currentVal = widgetOpts[optionId] !== undefined ? widgetOpts[optionId] : defaultVal
      widgetOpts[optionId] = !currentVal
      return { ...prev, [widgetId]: widgetOpts }
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
      await window.dashboard.saveWidgets(activeList)
      const updated = await window.dashboard.saveWidgetOptions(options)
      setConfig(updated)
      setActiveList(updated.activeWidgets)
      setOptions(updated.widgetOptions || {})
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
          <p className="settings-section-sub">
            Ative, reordene e personalize os dados e gráficos exibidos em cada bloco do Kindle.
          </p>
        </div>

        <div className="widgets-grid" style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          {orderedAvailable.map((widget) => {
            const isActive = activeList.includes(widget.id)
            const activeIndex = activeList.indexOf(widget.id)
            const meta = WIDGET_DESCRIPTIONS[widget.id] || { desc: '', icon: '📦' }
            const schema = WIDGET_OPTIONS_SCHEMA[widget.id] || []
            const isExpanded = expandedWidget === widget.id

            return (
              <div
                key={widget.id}
                className={`card-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '16px 20px',
                  background: 'var(--panel)',
                  borderRadius: '10px',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--line)',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      <>
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

                        {schema.length > 0 && (
                          <button
                            type="button"
                            className={`ui-button ${isExpanded ? '' : 'ghost'}`}
                            style={{ minHeight: '32px', padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => setExpandedWidget(isExpanded ? null : widget.id)}
                            title="Personalizar métricas"
                          >
                            <span className="button-icon">
                              <Icon name="slider" />
                            </span>
                            <span>Opções</span>
                          </button>
                        )}
                      </>
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

                {/* Sub-opções / Checkboxes de Métricas */}
                {isActive && (isExpanded || true) && schema.length > 0 && (
                  <div
                    style={{
                      marginTop: '14px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                      Métricas e Gráficos Visíveis:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                      {schema.map((item) => {
                        const widgetOpts = options[widget.id] || {}
                        const isChecked = widgetOpts[item.id] !== undefined ? widgetOpts[item.id] : item.default

                        return (
                          <label
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: isChecked ? 'var(--panel-2)' : 'transparent',
                              border: isChecked ? '1px solid var(--line-2)' : '1px solid transparent',
                              fontSize: '13px',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOption(widget.id, item.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span>{item.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
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

