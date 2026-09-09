import { useEffect, useRef, useState } from 'react'
import type { CustomSite, DashboardBlock, DashboardLayoutConfig, DashboardWidgetsConfig, WidgetOptionsMap } from '../../../shared/types'
import { ActionButton } from '../components/ActionButton'
import { Icon } from '../components/Icon'
import { TamagotchiBox } from '../components/TamagotchiBox'
import type { Translator } from '../i18n'

interface LayoutEditorProps {
  onSaved: (message: string) => void
  onError: (error: string) => void
  t: Translator
  onClose?: () => void
}

const WIDGET_META: Record<string, { name: string; icon: string; desc: string }> = {
  claude: { name: 'Claude', icon: '🤖', desc: 'Uso 5h e 7d' },
  antigravity: { name: 'Antigravity AI', icon: '🧠', desc: 'Cota 5h/7d e Brain' },
  macstats: { name: 'Mac Stats', icon: '💻', desc: 'CPU, RAM, Disco e Uptime' },
  tamagotchi: { name: 'Mascote (Tamagotchi)', icon: '🐱', desc: 'Bichinho virtual para cuidar' },
  sitescraper: { name: 'Monitor de Sites', icon: '🌐', desc: 'Últimos conteúdos e posts' },
  omnirouter: { name: 'Omni Router', icon: '🌐', desc: 'Tokens, custo e modelos' },
  applemusic: { name: 'Apple Music', icon: '🎵', desc: 'Faixa e progresso' },
  chaosmachine: { name: 'Chaos Machine', icon: '🖥️', desc: 'Servidor Linux remoto' },
  codex: { name: 'OpenAI Codex', icon: '⚡', desc: 'Créditos e sessões' },
}

const WIDGET_OPTIONS_SCHEMA: Record<string, { id: string; label: string; default: boolean }[]> = {
  claude: [
    { id: 'bar5h', label: 'Barra 5 horas', default: true },
    { id: 'bar7d', label: 'Barra 7 dias', default: true },
    { id: 'resets', label: 'Horários de reinício', default: true },
    { id: 'history7d', label: 'Gráfico histórico 7d', default: false },
    { id: 'statusPill', label: 'Status da assinatura', default: true },
  ],
  antigravity: [
    { id: 'bar5h', label: 'Barra cota 5 horas', default: true },
    { id: 'bar7d', label: 'Barra cota 7 dias', default: true },
    { id: 'resets', label: 'Horários de reinício', default: true },
    { id: 'statsGrid', label: 'Grid conversas/projetos/passos', default: true },
    { id: 'historyChart', label: 'Série histórica passos', default: false },
  ],
  macstats: [
    { id: 'cpuBar', label: 'Barra de CPU (%)', default: true },
    { id: 'ramBar', label: 'Barra de RAM (GB e %)', default: true },
    { id: 'diskBar', label: 'Barra de espaço em disco (/)', default: true },
    { id: 'uptime', label: 'Tempo de atividade (Uptime)', default: true },
    { id: 'sysInfo', label: 'Modelo Mac e sistema', default: true },
  ],
  tamagotchi: [
    { id: 'showSprite', label: 'Exibir mascote em pixel art', default: true },
    { id: 'showBars', label: 'Barras de fome, felicidade e energia', default: true },
    { id: 'showStatus', label: 'Frase de humor e status do dia', default: true },
  ],
  sitescraper: [
    { id: 'showDate', label: 'Exibir data de publicação', default: true },
  ],
  omnirouter: [
    { id: 'statGrid', label: 'Totais tokens/custo/reqs/provedores', default: true },
    { id: 'topModels', label: 'Lista dos modelos mais usados', default: true },
    { id: 'pieChart', label: 'Gráfico pizza de distribuição', default: false },
    { id: 'historyChart', label: 'Gráfico histórico de uso', default: false },
  ],
  chaosmachine: [
    { id: 'loadAvg', label: 'Load Average', default: true },
    { id: 'ram', label: 'Uso de RAM', default: true },
    { id: 'uptime', label: 'Tempo de atividade', default: true },
  ],
  applemusic: [
    { id: 'nowPlaying', label: 'Título e artista', default: true },
    { id: 'progressBar', label: 'Barra de progresso', default: true },
    { id: 'album', label: 'Nome do álbum', default: true },
  ],
  codex: [
    { id: 'limits', label: 'Limites e créditos', default: true },
    { id: 'spend', label: 'Custo USD e sessões', default: true },
  ],
}

export function LayoutEditor({ onSaved, onError, t, onClose }: LayoutEditorProps): React.JSX.Element {
  const [blocks, setBlocks] = useState<DashboardBlock[]>([])
  const [dashboardTitle, setDashboardTitle] = useState('Dashboard do Frater')
  const [widgetOptions, setWidgetOptions] = useState<WidgetOptionsMap>({})
  const [customSites, setCustomSites] = useState<CustomSite[]>([])
  const [newSiteName, setNewSiteName] = useState('')
  const [newSiteUrl, setNewSiteUrl] = useState('')
  const [petMsg, setPetMsg] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    window.dashboard
      .getWidgets()
      .then((cfg: DashboardWidgetsConfig) => {
        if (cfg.dashboardTitle) setDashboardTitle(cfg.dashboardTitle)
        setWidgetOptions(cfg.widgetOptions || {})
        setCustomSites(cfg.customSites || [])
        if (cfg.layout && Array.isArray(cfg.layout.blocks) && cfg.layout.blocks.length > 0) {
          setBlocks(cfg.layout.blocks)
        } else {
          // Default blocks based on active widgets
          const initialBlocks: DashboardBlock[] = (cfg.activeWidgets || ['claude', 'antigravity', 'macstats']).map(
            (tool, i) => ({
              id: `block_${tool}_${i}`,
              tool,
              width: 'half',
              height: 'standard',
            }),
          )
          setBlocks(initialBlocks)
        }
      })
      .catch((err) => onErrorRef.current(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  const handleDragStart = (index: number) => {
    setDraggedIdx(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === index) return
    const nextBlocks = [...blocks]
    const item = nextBlocks.splice(draggedIdx, 1)[0]
    nextBlocks.splice(index, 0, item)
    setDraggedIdx(index)
    setBlocks(nextBlocks)
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
  }

  const handleToggleWidth = (id: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, width: b.width === 'half' ? 'full' : 'half' } : b)),
    )
  }

  const handleRemoveBlock = (id: string) => {
    if (blocks.length <= 1) return
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (selectedBlockId === id) setSelectedBlockId(null)
  }

  const handleAddBlock = (tool: string) => {
    const newBlock: DashboardBlock = {
      id: `block_${tool}_${Date.now()}`,
      tool,
      width: 'half',
      height: 'standard',
    }
    setBlocks((prev) => [...prev, newBlock])
    setSelectedBlockId(newBlock.id)
  }

  const handleToggleOption = (tool: string, optId: string) => {
    setWidgetOptions((prev) => {
      const toolOpts = { ...(prev[tool] || {}) }
      const schemaItem = (WIDGET_OPTIONS_SCHEMA[tool] || []).find((s) => s.id === optId)
      const defaultVal = schemaItem ? schemaItem.default : true
      const currentVal = toolOpts[optId] !== undefined ? toolOpts[optId] : defaultVal
      toolOpts[optId] = !currentVal
      return { ...prev, [tool]: toolOpts }
    })
  }

  const handlePetAction = async (action: 'feed' | 'pet' | 'play' | 'bath') => {
    try {
      await window.dashboard.petAction(action)
      const label =
        action === 'feed'
          ? 'Mascote alimentado! 🍖'
          : action === 'pet'
            ? 'Carinho recebido! ❤️'
            : action === 'bath'
              ? 'Banho tomado! Mascote limpinho! 🧼'
              : 'Mascote brincou com você! 🎾'
      setPetMsg(label)
      setTimeout(() => setPetMsg(null), 3500)
    } catch (err) {
      onErrorRef.current(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSiteUrl.trim()) return
    const newSite: CustomSite = {
      id: 'site_' + Date.now(),
      name: newSiteName.trim() || newSiteUrl.trim(),
      url: newSiteUrl.trim(),
    }
    setCustomSites((prev) => [...prev, newSite])
    setNewSiteName('')
    setNewSiteUrl('')
  }

  const handleRemoveSite = (id: string) => {
    setCustomSites((prev) => prev.filter((s) => s.id !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const activeTools = Array.from(new Set(blocks.map((b) => b.tool)))
      const layoutCfg: DashboardLayoutConfig = {
        mode: 'custom',
        blocks,
      }
      await window.dashboard.saveLayout(layoutCfg, {
        activeWidgets: activeTools,
        widgetOptions,
        customSites,
        dashboardTitle: dashboardTitle.trim() || 'Kindle Dashboard',
      })
      await window.dashboard.renderNow()
      onSaved('Layout salvo e enviado ao Kindle com sucesso!')
      if (onClose) onClose()
    } catch (err) {
      onErrorRef.current(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const defaultBlocks: DashboardBlock[] = [
      { id: 'b_claude', tool: 'claude', width: 'half', height: 'standard' },
      { id: 'b_antigravity', tool: 'antigravity', width: 'half', height: 'standard' },
      { id: 'b_macstats', tool: 'macstats', width: 'half', height: 'tall' },
    ]
    setBlocks(defaultBlocks)
    setSelectedBlockId(null)
  }

  if (loading) return <div className="loading">{t('loading')}</div>

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  const selectedSchema = selectedBlock ? WIDGET_OPTIONS_SCHEMA[selectedBlock.tool] || [] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Top Header Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'var(--panel)',
          borderRadius: '10px',
          border: '1px solid var(--line)',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎨</span>
            <span>Editor Visual de Layout (Kindle 800x600)</span>
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-soft)' }}>
            Arraste os blocos para reorganizar, clique para configurar métricas ou alterne a largura.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <ActionButton icon="refresh" className="ghost" onClick={handleReset}>
            Resetar Padrão
          </ActionButton>
          <ActionButton disabled={saving} icon="save" onClick={() => void handleSave()}>
            {saving ? 'Salvando...' : 'Salvar & Atualizar Kindle'}
          </ActionButton>
          {onClose && (
            <ActionButton icon="check" className="ghost" onClick={onClose}>
              Fechar Editor
            </ActionButton>
          )}
        </div>
      </div>

      {/* Main Canvas & Inspector Area */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedBlock ? '1fr 300px' : '1fr', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Canvas Simulado do Kindle */}
        <div
          style={{
            background: '#ffffff',
            color: '#000000',
            borderRadius: '12px',
            border: '4px solid #000000',
            padding: '18px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            fontFamily: 'Helvetica, Arial, sans-serif',
          }}
        >
          {/* Kindle Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '4px solid #000000',
              paddingBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={dashboardTitle}
                placeholder="Kindle Dashboard"
                onChange={(e) => setDashboardTitle(e.target.value)}
                style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  letterSpacing: '-0.5px',
                  border: '1px dashed transparent',
                  background: 'transparent',
                  color: '#000',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  maxWidth: '380px',
                }}
                onFocus={(e) => (e.target.style.border = '1px dashed #666')}
                onBlur={(e) => (e.target.style.border = '1px dashed transparent')}
                title="Clique para editar o título do dashboard"
              />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>08/09/2026 12:00  🔋 44%</span>
          </div>

          {/* Canvas Blocks Container */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              flex: 1,
              alignContent: 'flex-start',
            }}
          >
            {blocks.map((block, index) => {
              const meta = WIDGET_META[block.tool] || { name: block.tool, icon: '📦', desc: '' }
              const isSelected = selectedBlockId === block.id
              const isFull = block.width === 'full'

              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedBlockId(block.id)}
                  style={{
                    flex: isFull ? '0 0 100%' : '1 1 calc(50% - 7px)',
                    minWidth: isFull ? '100%' : '320px',
                    border: isSelected ? '3px solid #0055ff' : '3px solid #000000',
                    borderRadius: '4px',
                    padding: '12px 14px',
                    background: isSelected ? '#f5f8ff' : '#ffffff',
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    position: 'relative',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Block Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '2px solid #000000',
                      paddingBottom: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ cursor: 'grab', fontSize: '14px', color: '#666' }} title="Arraste para reordenar">
                        ⠿
                      </span>
                      <span style={{ fontSize: '18px' }}>{meta.icon}</span>
                      <strong style={{ fontSize: '18px' }}>{meta.name}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleWidth(block.id)
                        }}
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '2px 8px',
                          border: '1.5px solid #000',
                          borderRadius: '3px',
                          background: isFull ? '#000' : '#fff',
                          color: isFull ? '#fff' : '#000',
                          cursor: 'pointer',
                        }}
                        title="Alternar largura"
                      >
                        {isFull ? '100% Largura' : '50% Coluna'}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveBlock(block.id)
                        }}
                        style={{
                          fontSize: '13px',
                          fontWeight: 'bold',
                          border: 'none',
                          background: 'transparent',
                          color: '#cc0000',
                          cursor: 'pointer',
                          padding: '2px 6px',
                        }}
                        title="Remover do dashboard"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Block Simulated Content */}
                  <div style={{ fontSize: '13px', color: '#333' }}>
                    {block.tool === 'claude' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div>5h: [████████░░░░░░░░] 68%</div>
                        <div>7d: [████░░░░░░░░░░░░] 38%</div>
                      </div>
                    )}
                    {block.tool === 'antigravity' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div>5h: [████░░░░░░░░░░░░] 23%</div>
                        <div>7d: [█████░░░░░░░░░░░] 27%</div>
                        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>26 Conversas · 27 Projetos · Ativo</div>
                      </div>
                    )}
                    {block.tool === 'omnirouter' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontWeight: 'bold' }}>1.83M Tokens · $5.34 Total · 8.5k Reqs</div>
                        <div style={{ fontSize: '11px', opacity: 0.8 }}>Top: gpt-oss-20b, mistral-medium-3-5</div>
                      </div>
                    )}
                    {block.tool === 'macstats' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>CPU: 14% · RAM: 13.1 / 16.0 GB (81%)</div>
                        <div>Disco: 39% usado · Uptime: 18h 22m</div>
                      </div>
                    )}
                    {block.tool === 'applemusic' && (
                      <div>▶ Música atual tocando · Álbum · Barra de progresso</div>
                    )}
                    {block.tool === 'tamagotchi' && (
                      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                        <TamagotchiBox compact={true} showCharacterPicker={true} />
                      </div>
                    )}
                    {block.tool === 'sitescraper' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12px' }}>🌐 Notícias & Blog</div>
                        <div style={{ fontSize: '11px', opacity: 0.85 }}>• Novo release publicado (hoje)</div>
                        <div style={{ fontSize: '11px', opacity: 0.85 }}>• Atualizações do sistema (ontem)</div>
                      </div>
                    )}
                    {block.tool === 'chaosmachine' && (
                      <div>● Online · Load: 0.15 · RAM: 420MB · Uptime: 12d</div>
                    )}
                    {block.tool === 'codex' && (
                      <div>$4.20 gastos · 42 sessões ativas</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Adicionar Blocos Disponíveis */}
          <div
            style={{
              borderTop: '2px dashed #888',
              paddingTop: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#555' }}>
              + Adicionar Bloco:
            </span>
            {Object.keys(WIDGET_META).map((tool) => {
              const meta = WIDGET_META[tool]
              return (
                <button
                  key={tool}
                  type="button"
                  onClick={() => handleAddBlock(tool)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    background: '#f0f0f0',
                    color: '#111',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sidebar Inspector: Opções do Bloco Selecionado */}
        {selectedBlock && (
          <div
            style={{
              padding: '16px',
              background: 'var(--panel)',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{WIDGET_META[selectedBlock.tool]?.icon}</span>
                <strong style={{ fontSize: '15px' }}>{WIDGET_META[selectedBlock.tool]?.name}</strong>
              </div>
              <button
                type="button"
                className="ghost ui-button"
                style={{ padding: '2px 6px', minHeight: '24px' }}
                onClick={() => setSelectedBlockId(null)}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-soft)' }}>
                Largura do Bloco
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`ui-button ${selectedBlock.width === 'half' ? '' : 'ghost'}`}
                  style={{ flex: 1, minHeight: '32px', fontSize: '12px' }}
                  onClick={() => handleToggleWidth(selectedBlock.id)}
                >
                  50% Coluna
                </button>
                <button
                  type="button"
                  className={`ui-button ${selectedBlock.width === 'full' ? '' : 'ghost'}`}
                  style={{ flex: 1, minHeight: '32px', fontSize: '12px' }}
                  onClick={() => handleToggleWidth(selectedBlock.id)}
                >
                  100% Total
                </button>
              </div>
            </div>

            {selectedSchema.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-soft)' }}>
                  Métricas Visíveis no Bloco:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedSchema.map((item) => {
                    const toolOpts = widgetOptions[selectedBlock.tool] || {}
                    const isChecked = toolOpts[item.id] !== undefined ? toolOpts[item.id] : item.default

                    return (
                      <label
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: isChecked ? 'var(--panel-2)' : 'transparent',
                          border: isChecked ? '1px solid var(--line-2)' : '1px solid transparent',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleOption(selectedBlock.tool, item.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{item.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedBlock.tool === 'tamagotchi' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--line-2)', paddingTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)' }}>
                  Cuidar do Mascote:
                </label>
                {petMsg && (
                  <div style={{ fontSize: '12px', padding: '6px 8px', background: 'rgba(46, 204, 113, 0.15)', color: '#27ae60', borderRadius: '4px', fontWeight: 600 }}>
                    {petMsg}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    className="ui-button ghost"
                    style={{ fontSize: '12px' }}
                    onClick={() => void handlePetAction('feed')}
                  >
                    🍖 Alimentar
                  </button>
                  <button
                    type="button"
                    className="ui-button ghost"
                    style={{ fontSize: '12px' }}
                    onClick={() => void handlePetAction('play')}
                  >
                    🎾 Brincar
                  </button>
                  <button
                    type="button"
                    className="ui-button ghost"
                    style={{ fontSize: '12px' }}
                    onClick={() => void handlePetAction('bath')}
                  >
                    🧼 Dar banho
                  </button>
                  <button
                    type="button"
                    className="ui-button ghost"
                    style={{ fontSize: '12px' }}
                    onClick={() => void handlePetAction('pet')}
                  >
                    ❤️ Carinho
                  </button>
                </div>
              </div>
            )}

            {selectedBlock.tool === 'sitescraper' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--line-2)', paddingTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)' }}>
                  Sites Cadastrados para Raspagem:
                </label>
                {customSites.length === 0 ? (
                  <p style={{ fontSize: '11px', color: 'var(--text-soft)', margin: 0 }}>
                    Nenhum site adicionado ainda. Adicione uma URL abaixo (suporta blogs, notícias e feeds RSS).
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {customSites.map((site) => (
                      <div
                        key={site.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          background: 'var(--panel-2)',
                          border: '1px solid var(--line-2)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ overflow: 'hidden', marginRight: '6px' }}>
                          <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {site.name}
                          </strong>
                          <span style={{ fontSize: '10px', color: 'var(--text-soft)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {site.url}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSite(site.id)}
                          style={{ border: 'none', background: 'transparent', color: '#cc0000', cursor: 'pointer', fontSize: '12px' }}
                          title="Remover site"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddSite} style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--line-2)', paddingTop: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-soft)' }}>+ Adicionar Site</span>
                  <input
                    placeholder="Nome (ex.: Meu Blog)"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--line-2)' }}
                  />
                  <input
                    placeholder="https://exemplo.com ou feed"
                    value={newSiteUrl}
                    onChange={(e) => setNewSiteUrl(e.target.value)}
                    required
                    style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--line-2)' }}
                  />
                  <ActionButton type="submit" icon="plus" className="compact" disabled={!newSiteUrl.trim()}>
                    Adicionar Site
                  </ActionButton>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
