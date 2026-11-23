import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Prévia editável: carrega a página /render do backend em modo de edição
// (?edit=1), no mesmo tamanho da captura do Kindle (800x600), escalada para
// caber no painel. Arrastar, redimensionar e renomear acontecem dentro da
// página; quando ela salva, pede um novo render para atualizar o PNG/Kindle.

const FRAME_WIDTH = 800
const FRAME_HEIGHT = 600
const RENDER_DEBOUNCE_MS = 800

interface LiveEditFrameProps {
  baseUrl: string
  language: string
}

export default function LiveEditFrame({ baseUrl, language }: LiveEditFrameProps): React.JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const recompute = (): void => {
      const { width, height } = stage.getBoundingClientRect()
      if (width === 0 || height === 0) return
      setScale(Math.min(width / FRAME_WIDTH, height / FRAME_HEIGHT))
    }
    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const origin = new URL(baseUrl).origin
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== origin) return
      const data = event.data as { type?: unknown } | null
      if (!data || data.type !== 'paperdeck:config-saved') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void window.dashboard?.renderNow?.(), RENDER_DEBOUNCE_MS)
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      if (timer) clearTimeout(timer)
    }
  }, [baseUrl])

  const src = `${baseUrl}/render?device=kt3&edit=1&lang=${encodeURIComponent(language)}`

  return (
    <div className="preview-stage" ref={stageRef}>
      {scale > 0 ? (
        <div style={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale, overflow: 'hidden' }}>
          <iframe
            title="PaperDeck"
            src={src}
            width={FRAME_WIDTH}
            height={FRAME_HEIGHT}
            style={{
              border: 0,
              display: 'block',
              background: '#fff',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
