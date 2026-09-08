export function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const PORT = positiveInt(process.env.PORT, 8787)
export const BASE_URL = `http://127.0.0.1:${PORT}`
export const REPO_URL = 'https://github.com/alexishida/kindle-dashboard'

// Resolução nativa do Kindle 8th Gen (KT3: 600x800 framebuffer, tela 800x600 landscape)
export const CAPTURE_WIDTH = 600
export const CAPTURE_HEIGHT = 800
export const LANDSCAPE_CAPTURE_WIDTH = 800
export const LANDSCAPE_CAPTURE_HEIGHT = 600
