import { useEffect, useState, useRef } from 'react'
import { CHARACTERS, PALETTE, type CharacterDef } from '../components/tamagotchiSprites'
import { ActionButton } from '../components/ActionButton'
import { Icon } from '../components/Icon'
import type { Translator } from '../i18n'

interface PetData {
  name: string
  character?: string
  type?: string
  level: number
  ageDays: number
  hunger: number
  happiness: number
  energy: number
  cleanliness?: number
  mood: string
  statusText: string
  feedCount?: number
  petCount?: number
  playCount?: number
  bathCount?: number
  animSpeed?: 'fast' | 'normal' | 'slow'
  theme?: 'lcd' | 'eink' | 'amber' | 'cyber'
}

interface TamagotchiViewProps {
  t: Translator
  onSaved: (message: string) => void
  onError: (error: string) => void
}

const THEMES = [
  { id: 'lcd', label: 'Verde LCD Clássico', bg: '#d4e7c5', border: '#5a7346', pixel: '#151515', badge: 'Retrô' },
  { id: 'eink', label: 'E-Ink Monocromático', bg: '#ffffff', border: '#333333', pixel: '#000000', badge: 'Kindle' },
  { id: 'amber', label: 'Âmbar Vintage CRT', bg: '#1c1608', border: '#ffaa00', pixel: '#ffaa00', badge: 'CRT' },
  { id: 'cyber', label: 'Cyber Matrix Cyan', bg: '#081a24', border: '#00e5ff', pixel: '#00e5ff', badge: 'Neon' },
]

const SPEED_OPTIONS = [
  { id: 'fast', label: 'Rápido', ms: 350, desc: '350ms · Enérgico' },
  { id: 'normal', label: 'Normal', ms: 650, desc: '650ms · Clássico Tamagotchi' },
  { id: 'slow', label: 'Calmo', ms: 1000, desc: '1000ms · Relaxado' },
]

const NAME_SUGGESTIONS = ['Memtchi', 'Pixel', 'Bolinha', 'Pipoca', 'Kuro', 'Mochi', 'Tama', 'FraterPet']

function playRetroSound(type: 'feed' | 'play' | 'bath' | 'pet' | 'select' | 'save'): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const playTone = (freq: number, start: number, duration: number, wave: OscillatorType = 'square', vol = 0.04): void => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = wave
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(vol, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration)
    }

    if (type === 'feed') {
      playTone(440, now, 0.12)
      playTone(660, now + 0.12, 0.16)
    } else if (type === 'play') {
      playTone(523, now, 0.09)
      playTone(659, now + 0.09, 0.09)
      playTone(784, now + 0.18, 0.15)
    } else if (type === 'bath') {
      playTone(392, now, 0.1)
      playTone(587, now + 0.1, 0.1)
      playTone(880, now + 0.2, 0.2)
    } else if (type === 'pet') {
      playTone(587, now, 0.1)
      playTone(740, now + 0.1, 0.18, 'sine', 0.06)
    } else if (type === 'save') {
      playTone(523, now, 0.08)
      playTone(659, now + 0.08, 0.08)
      playTone(1046, now + 0.16, 0.2, 'triangle', 0.05)
    } else {
      playTone(880, now, 0.05, 'square', 0.02)
    }
  } catch {}
}

export function TamagotchiView({ t: _t, onSaved, onError }: TamagotchiViewProps): React.JSX.Element {
  const [pet, setPet] = useState<PetData>({
    name: 'Mametchi',
    character: 'mametchi',
    level: 3,
    ageDays: 5,
    hunger: 25,
    happiness: 90,
    energy: 85,
    cleanliness: 95,
    mood: 'happy',
    statusText: 'Muito feliz e animado! ✨',
    animSpeed: 'normal',
    theme: 'lcd',
  })

  const [nameInput, setNameInput] = useState('Mametchi')
  const [selectedTheme, setSelectedTheme] = useState<'lcd' | 'eink' | 'amber' | 'cyber'>('lcd')
  const [selectedSpeed, setSelectedSpeed] = useState<'fast' | 'normal' | 'slow'>('normal')
  const [activeExpression, setActiveExpression] = useState<string | null>(null)
  const [frameToggle, setFrameToggle] = useState(0)
  const [savingName, setSavingName] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const expressionTimeout = useRef<number | null>(null)

  // Carrega estado do mascote
  const loadPet = async (): Promise<void> => {
    try {
      if (window.dashboard?.getPetState) {
        const data = (await window.dashboard.getPetState()) as PetData
        if (data && data.name) {
          setPet(data)
          setNameInput(data.name)
          if (data.theme) setSelectedTheme(data.theme)
          if (data.animSpeed) setSelectedSpeed(data.animSpeed)
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void loadPet()
  }, [])

  // Timer do frame de animação conforme a velocidade configurada
  const currentInterval = SPEED_OPTIONS.find((s) => s.id === selectedSpeed)?.ms ?? 650
  useEffect(() => {
    const timer = setInterval(() => {
      setFrameToggle((prev) => (prev === 0 ? 1 : 0))
    }, currentInterval)
    return () => clearInterval(timer)
  }, [currentInterval])

  // Salvar novo nome
  const handleSaveName = async (customName?: string): Promise<void> => {
    const targetName = (customName || nameInput).trim()
    if (!targetName) return
    setSavingName(true)
    try {
      if (window.dashboard?.petAction) {
        const res = (await window.dashboard.petAction('setName', { name: targetName })) as { pet?: PetData }
        if (res && res.pet) {
          setPet(res.pet)
          setNameInput(res.pet.name)
        } else {
          setPet((prev) => ({ ...prev, name: targetName }))
        }
      } else {
        setPet((prev) => ({ ...prev, name: targetName }))
      }
      playRetroSound('save')
      onSaved(`Nome do mascote atualizado para "${targetName}"!`)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingName(false)
    }
  }

  // Mudar personagem
  const handleSelectCharacter = async (charId: string): Promise<void> => {
    playRetroSound('select')
    try {
      if (window.dashboard?.petAction) {
        const res = (await window.dashboard.petAction('setCharacter', { character: charId })) as { pet?: PetData }
        if (res && res.pet) {
          setPet(res.pet)
          setNameInput(res.pet.name)
        } else {
          setPet((prev) => ({ ...prev, character: charId }))
        }
      } else {
        setPet((prev) => ({ ...prev, character: charId }))
      }
      const charDef = CHARACTERS[charId]
      onSaved(`Personagem alterado para ${charDef ? charDef.name : charId}!`)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  // Mudar tema de cor do visor
  const handleChangeTheme = async (themeId: 'lcd' | 'eink' | 'amber' | 'cyber'): Promise<void> => {
    setSelectedTheme(themeId)
    playRetroSound('select')
    try {
      if (window.dashboard?.petAction) {
        await window.dashboard.petAction('setOptions', { theme: themeId })
      }
      onSaved(`Tema do visor alterado!`)
    } catch {}
  }

  // Mudar velocidade da animação
  const handleChangeSpeed = async (speedId: 'fast' | 'normal' | 'slow'): Promise<void> => {
    setSelectedSpeed(speedId)
    playRetroSound('select')
    try {
      if (window.dashboard?.petAction) {
        await window.dashboard.petAction('setOptions', { animSpeed: speedId })
      }
      onSaved(`Velocidade de animação configurada!`)
    } catch {}
  }

  // Testador de animações / expressões
  const handleTriggerExpression = (expressionKey: string, soundType?: 'feed' | 'play' | 'bath' | 'pet'): void => {
    setActiveExpression(expressionKey)
    if (soundType) playRetroSound(soundType)
    else playRetroSound('select')

    if (expressionTimeout.current) clearTimeout(expressionTimeout.current)
    expressionTimeout.current = window.setTimeout(() => {
      setActiveExpression(null)
    }, 2500)
  }

  // Cuidar do Mascote
  const handleCareAction = async (actionName: 'feed' | 'play' | 'bath' | 'pet', msg: string): Promise<void> => {
    if (isBusy) return
    setIsBusy(true)
    setActiveExpression(actionName)
    setFeedback(msg)
    playRetroSound(actionName)

    if (expressionTimeout.current) clearTimeout(expressionTimeout.current)
    expressionTimeout.current = window.setTimeout(() => {
      setActiveExpression(null)
      setFeedback(null)
    }, 2800)

    try {
      if (window.dashboard?.petAction) {
        const res = (await window.dashboard.petAction(actionName)) as { pet?: PetData }
        if (res && res.pet) {
          setPet(res.pet)
        }
      }
      onSaved(msg)
    } catch {
      setPet((prev) => {
        const now = { ...prev }
        if (actionName === 'feed') {
          now.hunger = Math.max(0, now.hunger - 35)
          now.happiness = Math.min(100, now.happiness + 10)
        } else if (actionName === 'play') {
          now.happiness = Math.min(100, now.happiness + 30)
          now.hunger = Math.min(100, now.hunger + 10)
          now.energy = Math.max(10, now.energy - 15)
        } else if (actionName === 'bath') {
          now.cleanliness = 100
          now.happiness = Math.min(100, now.happiness + 20)
        } else if (actionName === 'pet') {
          now.happiness = Math.min(100, now.happiness + 25)
        }
        return now
      })
    } finally {
      setIsBusy(false)
    }
  }

  const currentCharId = pet.character || pet.type || 'mametchi'
  const charDef: CharacterDef = CHARACTERS[currentCharId] || CHARACTERS.mametchi
  const themeObj = THEMES.find((t) => t.id === selectedTheme) || THEMES[0]

  // Determinar frame ativo
  let activeFrame = charDef.frames.idle_1
  if (activeExpression === 'feed') activeFrame = charDef.frames.feed
  else if (activeExpression === 'play') activeFrame = charDef.frames.play
  else if (activeExpression === 'bath') activeFrame = charDef.frames.bath
  else if (activeExpression === 'pet') activeFrame = charDef.frames.pet
  else if (activeExpression === 'sleep') activeFrame = charDef.frames.sleep
  else if (activeExpression === 'idle_1') activeFrame = charDef.frames.idle_1
  else if (activeExpression === 'idle_2') activeFrame = charDef.frames.idle_2
  else if (pet.mood === 'sleeping') activeFrame = charDef.frames.sleep
  else activeFrame = frameToggle === 0 ? charDef.frames.idle_1 : charDef.frames.idle_2

  const hunger = pet.hunger ?? 25
  const happiness = pet.happiness ?? 90
  const energy = pet.energy ?? 85
  const cleanliness = pet.cleanliness ?? 95

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
      {/* Top Section Header */}
      <section className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="pet" /> Personalização
          </span>
          <h2 style={{ margin: '4px 0 2px 0' }}>Customização do Memtchi</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            Personalize o nome, aparência e animações do seu mascote virtual exibido no Kindle e no app.
          </p>
        </div>
      </section>

      {/* Main Grid: Coluna de Controles e Coluna do Visor Retrô */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '18px', alignItems: 'start' }}>
        {/* Left Column: Configurações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card 1: Nome do Mascote */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🏷️ Nome do Mascote</span>
                </div>
                <div className="card-sub">Escolha como o seu companheiro será chamado no dashboard.</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={nameInput}
                  maxLength={20}
                  placeholder="ex.: Memtchi, Pipoca, Bolinha..."
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveName()
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                />
                <ActionButton
                  icon="save"
                  disabled={savingName}
                  onClick={() => void handleSaveName()}
                >
                  {savingName ? 'Salvando...' : 'Salvar Nome'}
                </ActionButton>
              </div>

              {/* Chips de sugestão rápida */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>Sugestões:</span>
                {NAME_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setNameInput(sug)
                      void handleSaveName(sug)
                    }}
                    style={{
                      minHeight: '26px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      borderRadius: '12px',
                    }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Aparência do Personagem */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎨 Aparência e Personagem</span>
                </div>
                <div className="card-sub">Selecione a espécie em pixel art que habita o seu visor.</div>
              </div>
            </div>

            {/* Grid dos 5 Personagens */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginTop: '12px' }}>
              {Object.keys(CHARACTERS).map((key) => {
                const char = CHARACTERS[key]
                const isSelected = currentCharId === key

                return (
                  <div
                    key={key}
                    onClick={() => void handleSelectCharacter(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--accent, #2196f3)' : '1px solid var(--line)',
                      background: isSelected ? 'var(--panel-2)' : 'var(--bg)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '24px',
                        width: '38px',
                        height: '38px',
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {char.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {char.name}
                        {isSelected && (
                          <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'var(--accent, #2196f3)', color: '#fff' }}>
                            Ativo
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-dim)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {char.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Seletor de Tema do Visor */}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                Tema do Visor (App e Prévia):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {THEMES.map((theme) => {
                  const isSel = selectedTheme === theme.id
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => void handleChangeTheme(theme.id as 'lcd' | 'eink' | 'amber' | 'cyber')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: isSel ? '2px solid var(--accent, #2196f3)' : '1px solid var(--line)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: isSel ? 700 : 500,
                      }}
                    >
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '3px',
                          background: theme.bg,
                          border: `1px solid ${theme.border}`,
                          flexShrink: 0,
                        }}
                      />
                      <span>{theme.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Card 3: Animações & Expressões */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎬 Animações & Teste de Expressões</span>
                </div>
                <div className="card-sub">Ajuste a cadência dos passos e teste as poses animadas ao vivo.</div>
              </div>
            </div>

            {/* Seletor de Velocidade */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Velocidade do Frame:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {SPEED_OPTIONS.map((spd) => {
                  const isSel = selectedSpeed === spd.id
                  return (
                    <button
                      key={spd.id}
                      type="button"
                      onClick={() => void handleChangeSpeed(spd.id as 'fast' | 'normal' | 'slow')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px',
                        borderRadius: '6px',
                        border: isSel ? '2px solid var(--accent, #2196f3)' : '1px solid var(--line)',
                        background: isSel ? 'var(--panel-2)' : 'var(--bg)',
                        color: isSel ? 'var(--accent, #2196f3)' : 'var(--text)',
                        cursor: 'pointer',
                        minHeight: '48px',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '12px' }}>{spd.label}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{spd.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Testador de Poses / Expressões */}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                Banco de Testes de Expressão (Clique para animar no visor):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '6px' }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleTriggerExpression('idle_1')}
                  style={{ fontSize: '11px', minHeight: '32px', padding: '4px 8px' }}
                >
                  🚶 Idle 1
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleTriggerExpression('idle_2')}
                  style={{ fontSize: '11px', minHeight: '32px', padding: '4px 8px' }}
                >
                  🐾 Idle 2
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleTriggerExpression('feed', 'feed')}
                  style={{ fontSize: '11px', minHeight: '32px', padding: '4px 8px' }}
                >
                  🍖 Comer
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleTriggerExpression('play', 'play')}
                  style={{ fontSize: '11px', minHeight: '32px', padding: '4px 8px' }}
                >
                  🎾 Brincar
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleTriggerExpression('bath', 'bath')}
                  style={{ fontSize: '11px', minHeight: '32px', padding: '4px 8px' }}
                >
                  🧼 Banho
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleTriggerExpression('pet', 'pet')}
                  style={{ fontSize: '11px', minHeight: '32px', padding: '4px 8px' }}
                >
                  ❤️ Carinho
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleTriggerExpression('sleep')}
                  style={{ fontSize: '11px', minHeight: '32px', padding: '4px 8px' }}
                >
                  💤 Dormir
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visor Retrô Interativo & Status de Cuidados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '16px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📺 Visor Interativo</span>
                </div>
                <div className="card-sub">Prévia viva do mascote renderizado em tempo real.</div>
              </div>
            </div>

            {/* LCD Screen Display Box */}
            <div
              style={{
                position: 'relative',
                background: themeObj.bg,
                border: `3px solid ${themeObj.border}`,
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)',
                minHeight: '220px',
              }}
            >
              {/* Moldura superior do visor LCD com marca retro */}
              <div
                style={{
                  position: 'absolute',
                  top: '6px',
                  left: '12px',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  color: selectedTheme === 'lcd' ? '#5a7346' : 'rgba(150,150,150,0.8)',
                  textTransform: 'uppercase',
                }}
              >
                ● TAMAGOTCHI LCD 16x16
              </div>

              {/* Badges de ação voando (Comer, Brincar, etc) */}
              {activeExpression === 'feed' && (
                <span style={{ position: 'absolute', top: 12, right: 14, fontSize: '22px' }}>🍖</span>
              )}
              {activeExpression === 'play' && (
                <span style={{ position: 'absolute', top: 10, right: 14, fontSize: '22px' }}>🎾</span>
              )}
              {activeExpression === 'bath' && (
                <span style={{ position: 'absolute', top: 10, right: 14, fontSize: '22px' }}>🫧</span>
              )}
              {activeExpression === 'pet' && (
                <span style={{ position: 'absolute', top: 10, right: 14, fontSize: '22px' }}>❤️</span>
              )}
              {activeExpression === 'sleep' && (
                <span style={{ position: 'absolute', top: 10, right: 14, fontSize: '22px' }}>💤</span>
              )}

              {/* Renderizador do Sprite 16x16 em SVG com pixels nítidos */}
              <svg
                viewBox="0 0 16 16"
                width="128"
                height="128"
                style={{
                  shapeRendering: 'crispEdges',
                  imageRendering: 'pixelated',
                  margin: '12px 0 6px 0',
                  filter: selectedTheme === 'amber' ? 'drop-shadow(0 0 4px #ffaa00)' : undefined,
                }}
              >
                {activeFrame.map((row, r) =>
                  row.split('').map((ch, c) => {
                    let color = PALETTE[ch]
                    if (!color || color === 'transparent') return null
                    if (selectedTheme === 'eink') {
                      color = ch === '.' ? 'transparent' : ch === 'W' ? '#ffffff' : '#000000'
                    } else if (selectedTheme === 'amber') {
                      color = ch === '.' ? 'transparent' : ch === 'W' ? '#ffffff' : '#ffaa00'
                    } else if (selectedTheme === 'cyber') {
                      color = ch === '.' ? 'transparent' : ch === 'W' ? '#ffffff' : '#00e5ff'
                    }
                    return <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill={color} />
                  })
                )}
              </svg>

              {/* Nome e Nível no LCD */}
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '15px',
                  color: selectedTheme === 'lcd' ? '#151515' : selectedTheme === 'eink' ? '#000000' : '#ffffff',
                  marginTop: '4px',
                }}
              >
                {pet.name || charDef.name}{' '}
                <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>
                  (Nv. {pet.level} · {pet.ageDays}d)
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: selectedTheme === 'lcd' ? '#333333' : 'rgba(255,255,255,0.7)',
                  marginTop: '2px',
                }}
              >
                {pet.statusText}
              </div>
            </div>

            {/* Barras de Estatísticas e Necessidades */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              {feedback && (
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--ok, #4caf50)',
                    background: 'rgba(76, 175, 80, 0.1)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    textAlign: 'center',
                  }}
                >
                  {feedback}
                </div>
              )}

              {/* Fome */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>🍖 Fome</span>
                  <strong>{hunger}%</strong>
                </div>
                <div style={{ height: '7px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${hunger}%`,
                      background: hunger > 70 ? 'var(--danger, #f44336)' : '#ff9800',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Felicidade */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>❤️ Felicidade</span>
                  <strong>{happiness}%</strong>
                </div>
                <div style={{ height: '7px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${happiness}%`,
                      background: '#e91e63',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Energia */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>⚡ Energia</span>
                  <strong>{energy}%</strong>
                </div>
                <div style={{ height: '7px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${energy}%`,
                      background: '#2196f3',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Limpeza */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>🧼 Limpeza</span>
                  <strong>{cleanliness}%</strong>
                </div>
                <div style={{ height: '7px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${cleanliness}%`,
                      background: '#00bcd4',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Ações Rápidas de Cuidados */}
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleCareAction('feed', '🍖 Nhac! Fome reduzida!')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 4px',
                  background: activeExpression === 'feed' ? 'var(--accent, #2196f3)' : 'var(--bg)',
                  color: activeExpression === 'feed' ? '#fff' : 'var(--text)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '16px' }}>🍖</span>
                <span>Alimentar</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleCareAction('play', '🎾 Brincadeira animada!')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 4px',
                  background: activeExpression === 'play' ? 'var(--accent, #2196f3)' : 'var(--bg)',
                  color: activeExpression === 'play' ? '#fff' : 'var(--text)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '16px' }}>🎾</span>
                <span>Brincar</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleCareAction('bath', '🧼 Banho tomado, limpinho!')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 4px',
                  background: activeExpression === 'bath' ? 'var(--accent, #2196f3)' : 'var(--bg)',
                  color: activeExpression === 'bath' ? '#fff' : 'var(--text)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '16px' }}>🧼</span>
                <span>Banho</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleCareAction('pet', '❤️ Muito carinho recebido!')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 4px',
                  background: activeExpression === 'pet' ? 'var(--accent, #2196f3)' : 'var(--bg)',
                  color: activeExpression === 'pet' ? '#fff' : 'var(--text)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '16px' }}>❤️</span>
                <span>Carinho</span>
              </button>
            </div>

            {/* Dica sobre sincronização com o Kindle */}
            <div
              style={{
                marginTop: '14px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--line)',
                fontSize: '10px',
                color: 'var(--text-dim)',
                lineHeight: 1.4,
              }}
            >
              💡 <strong>Kindle E-Ink Sync:</strong> As alterações de nome e personagem são salvas automaticamente e refletidas no bloco do mascote no seu Kindle no próximo ciclo de refresh.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
