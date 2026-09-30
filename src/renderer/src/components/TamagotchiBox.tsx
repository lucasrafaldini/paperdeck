import { useEffect, useState, useRef } from 'react'
import { CHARACTERS, PALETTE, type CharacterDef } from './tamagotchiSprites'

interface PetState {
  name: string
  character?: string
  type?: string
  level: number
  ageDays: number
  hunger: number
  happiness: number
  energy: number
  cleanliness?: number
  isSleeping?: boolean
  mood: string
  statusText: string
  feedCount?: number
  petCount?: number
  playCount?: number
  bathCount?: number
  sleepCount?: number
}

interface TamagotchiBoxProps {
  compact?: boolean
  showCharacterPicker?: boolean
  onAction?: (action: string) => void
}

function playRetroSound(type: 'feed' | 'play' | 'bath' | 'pet' | 'select' | 'sleep'): void {
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
    } else if (type === 'sleep') {
      playTone(523, now, 0.12, 'sine', 0.05)
      playTone(392, now + 0.12, 0.15, 'sine', 0.04)
      playTone(330, now + 0.27, 0.25, 'sine', 0.03)
    } else {
      playTone(880, now, 0.05, 'square', 0.02)
    }
  } catch {}
}

export function TamagotchiBox({
  compact = false,
  showCharacterPicker = true,
  onAction,
}: TamagotchiBoxProps): React.JSX.Element {
  const [pet, setPet] = useState<PetState>({
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
  })
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [frameToggle, setFrameToggle] = useState(0)
  const [isBusy, setIsBusy] = useState(false)
  const actionTimeout = useRef<number | null>(null)

  // Carrega estado inicial do backend
  const loadState = async (): Promise<void> => {
    try {
      if (window.dashboard?.getPetState) {
        const data = (await window.dashboard.getPetState()) as PetState
        if (data && data.name) {
          setPet(data)
        }
      }
    } catch {}
  }

  useEffect(() => {
    void loadState()
  }, [])

  // Loop de animação contínua dos sprites (600ms alterna frames)
  useEffect(() => {
    const timer = setInterval(() => {
      setFrameToggle((prev) => (prev === 0 ? 1 : 0))
    }, 650)
    return () => clearInterval(timer)
  }, [])

  const handleAction = async (
    actionName: 'feed' | 'play' | 'bath' | 'pet' | 'sleep' | 'wake',
    msg: string
  ): Promise<void> => {
    if (isBusy) return
    setIsBusy(true)
    setActiveAction(actionName)
    setFeedback(msg)
    if (actionName === 'sleep' || actionName === 'wake') {
      playRetroSound('sleep')
    } else {
      playRetroSound(actionName)
    }

    if (actionTimeout.current) clearTimeout(actionTimeout.current)
    actionTimeout.current = window.setTimeout(() => {
      setActiveAction(null)
      setFeedback(null)
    }, 2800)

    try {
      if (window.dashboard?.petAction) {
        const res = (await window.dashboard.petAction(actionName)) as { ok?: boolean; pet?: PetState }
        if (res && res.pet) {
          setPet(res.pet)
        } else if (res && (res as PetState).name) {
          setPet(res as PetState)
        }
      }
      if (onAction) onAction(actionName)
    } catch {
      // Atualização local de fallback
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
        } else if (actionName === 'sleep') {
          now.isSleeping = !now.isSleeping
          now.energy = Math.min(100, (now.energy || 30) + 45)
          now.happiness = Math.min(100, (now.happiness || 80) + 10)
        } else if (actionName === 'wake') {
          now.isSleeping = false
          now.energy = Math.min(100, (now.energy || 50) + 15)
        }
        return now
      })
    } finally {
      setIsBusy(false)
    }
  }

  const handleSelectCharacter = async (charId: string): Promise<void> => {
    playRetroSound('select')
    try {
      if (window.dashboard?.petAction) {
        const res = (await window.dashboard.petAction('setCharacter', { character: charId })) as {
          ok?: boolean
          pet?: PetState
        }
        if (res && res.pet) {
          setPet(res.pet)
        }
      }
    } catch {
      const def = CHARACTERS[charId]
      if (def) {
        setPet((prev) => ({ ...prev, character: charId, name: def.name }))
      }
    }
  }

  const currentCharId = pet.character || pet.type || 'mametchi'
  const charDef: CharacterDef = CHARACTERS[currentCharId] || CHARACTERS.mametchi

  // Determina frame ativo
  let activeFrame = charDef.frames.idle_1
  if (activeAction === 'feed') activeFrame = charDef.frames.feed
  else if (activeAction === 'play') activeFrame = charDef.frames.play
  else if (activeAction === 'bath') activeFrame = charDef.frames.bath
  else if (activeAction === 'pet') activeFrame = charDef.frames.pet
  else if (activeAction === 'sleep') activeFrame = charDef.frames.sleep
  else if (pet.mood === 'sleeping' || pet.mood === 'tired' || pet.isSleeping) activeFrame = charDef.frames.sleep
  else activeFrame = frameToggle === 0 ? charDef.frames.idle_1 : charDef.frames.idle_2

  const hunger = pet.hunger ?? 25
  const happiness = pet.happiness ?? 90
  const energy = pet.energy ?? 85
  const cleanliness = pet.cleanliness ?? 95

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '8px' : '12px',
        padding: compact ? '10px 12px' : '14px 16px',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: '10px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header: Personagem, Nível e Seletor */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{charDef.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              {pet.name || charDef.name}{' '}
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)' }}>
                Nível {pet.level} · {pet.ageDays}d
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{pet.statusText}</div>
          </div>
        </div>

        {showCharacterPicker && (
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', padding: '2px 4px', borderRadius: '6px', border: '1px solid var(--line)' }}>
            {Object.keys(CHARACTERS).map((key) => {
              const c = CHARACTERS[key]
              const isSelected = currentCharId === key
              return (
                <button
                  key={key}
                  type="button"
                  title={`${c.name}: ${c.desc}`}
                  onClick={() => handleSelectCharacter(key)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent, #2196f3)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {c.icon} {c.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Center Stage: Sprite Animado + Barras de Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'var(--bg)',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid var(--line)',
        }}
      >
        {/* Caixa Retrô LCD do Mascote */}
        <div
          style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            background: '#d4e7c5', // Fundo clássico LCD esverdeado retrô
            borderRadius: '6px',
            border: '2px solid #5a7346',
            boxShadow: 'inset 0 0 6px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {/* Efeito de partículas/ação */}
          {activeAction === 'feed' && (
            <span style={{ position: 'absolute', top: 4, right: 4, fontSize: '16px', animation: 'bounce 0.5s infinite' }}>🍖</span>
          )}
          {activeAction === 'play' && (
            <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '16px', animation: 'bounce 0.4s infinite' }}>🎾</span>
          )}
          {activeAction === 'bath' && (
            <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '16px' }}>🫧</span>
          )}
          {activeAction === 'pet' && (
            <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '16px' }}>❤️</span>
          )}
          {activeAction === 'sleep' && (
            <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '16px', animation: 'bounce 0.8s infinite' }}>💤</span>
          )}

          {/* Renderizador do Sprite 16x16 em SVG com crisp edges */}
          <svg
            viewBox="0 0 16 16"
            width="64"
            height="64"
            style={{ shapeRendering: 'crispEdges', imageRendering: 'pixelated' }}
          >
            {activeFrame.map((row, r) =>
              row.split('').map((ch, c) => {
                const color = PALETTE[ch]
                if (!color || color === 'transparent') return null
                return <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill={color} />
              })
            )}
          </svg>
        </div>

        {/* Barras de Necessidades */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
          {feedback && (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--ok, #4caf50)',
                background: 'rgba(76, 175, 80, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                textAlign: 'center',
              }}
            >
              {feedback}
            </div>
          )}

          {/* Fome */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: hunger > 70 ? 'var(--danger, #f44336)' : 'var(--text)' }}>
                🍖 Fome
              </span>
              <strong>{hunger}%</strong>
            </div>
            <div style={{ height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>❤️ Felicidade</span>
              <strong>{happiness}%</strong>
            </div>
            <div style={{ height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>⚡ Energia</span>
              <strong>{energy}%</strong>
            </div>
            <div style={{ height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>🧼 Limpeza</span>
              <strong>{cleanliness}%</strong>
            </div>
            <div style={{ height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
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
      </div>

      {/* Action Buttons Diretamente no Box (Alimentar, Brincar, Soneca, Dar banho, Fazer carinho) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleAction('feed', '🍖 Nhac! Fome reduzida!')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            padding: '8px 4px',
            background: activeAction === 'feed' ? 'var(--accent, #2196f3)' : 'var(--bg)',
            color: activeAction === 'feed' ? '#fff' : 'var(--text)',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '15px' }}>🍖</span>
          <span>Alimentar</span>
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleAction('play', '🎾 Brincadeira divertida!')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            padding: '8px 4px',
            background: activeAction === 'play' ? 'var(--accent, #2196f3)' : 'var(--bg)',
            color: activeAction === 'play' ? '#fff' : 'var(--text)',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '15px' }}>🎾</span>
          <span>Brincar</span>
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            pet.isSleeping
              ? handleAction('wake', '☀️ Bom dia! Acordou revigorado!')
              : handleAction('sleep', '💤 Zzz... Soneca revigorante!')
          }
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            padding: '8px 4px',
            background: activeAction === 'sleep' || pet.isSleeping ? 'var(--accent, #2196f3)' : 'var(--bg)',
            color: activeAction === 'sleep' || pet.isSleeping ? '#fff' : 'var(--text)',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '15px' }}>{pet.isSleeping ? '☀️' : '💤'}</span>
          <span>{pet.isSleeping ? 'Acordar' : 'Soneca'}</span>
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleAction('bath', '🧼 Banho tomado, cheiroso!')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            padding: '8px 4px',
            background: activeAction === 'bath' ? 'var(--accent, #2196f3)' : 'var(--bg)',
            color: activeAction === 'bath' ? '#fff' : 'var(--text)',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '15px' }}>🧼</span>
          <span>Dar Banho</span>
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleAction('pet', '❤️ Muito carinho recebido!')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            padding: '8px 4px',
            background: activeAction === 'pet' ? 'var(--accent, #2196f3)' : 'var(--bg)',
            color: activeAction === 'pet' ? '#fff' : 'var(--text)',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '15px' }}>❤️</span>
          <span>Carinho</span>
        </button>
      </div>
    </div>
  )
}
