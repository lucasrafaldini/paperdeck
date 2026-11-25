import { THEME_IDS, type ThemeId, type ThemePreference } from '../../shared/types'

export interface ThemeOption {
  id: ThemePreference
  nameKey: string
  descKey: string
  // Swatches for the picker preview: background, surface, accent, text.
  swatch: { bg: string; surface: string; accent: string; text: string }
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'system', nameKey: 'themeSystem', descKey: 'themeSystemDesc', swatch: { bg: 'linear-gradient(135deg, #f4f5f8 50%, #0c0e13 50%)', surface: '#ffffff', accent: '#6366f1', text: '#111827' } },
  { id: 'midnight', nameKey: 'themeMidnight', descKey: 'themeMidnightDesc', swatch: { bg: '#0b0d12', surface: '#151922', accent: '#f5a524', text: '#eef1f6' } },
  { id: 'daylight', nameKey: 'themeDaylight', descKey: 'themeDaylightDesc', swatch: { bg: '#f4f5f8', surface: '#ffffff', accent: '#5b5bf0', text: '#111827' } },
  { id: 'glass', nameKey: 'themeGlass', descKey: 'themeGlassDesc', swatch: { bg: 'linear-gradient(135deg, #4c1d95, #1e3a8a 55%, #be185d)', surface: 'rgba(255,255,255,0.18)', accent: '#67e8f9', text: '#ffffff' } },
  { id: 'solar', nameKey: 'themeSolar', descKey: 'themeSolarDesc', swatch: { bg: '#fdf6e3', surface: '#fffbef', accent: '#cb4b16', text: '#073642' } },
  { id: 'solar-night', nameKey: 'themeSolarNight', descKey: 'themeSolarNightDesc', swatch: { bg: '#002b36', surface: '#073642', accent: '#b58900', text: '#eee8d5' } },
  { id: 'nord', nameKey: 'themeNord', descKey: 'themeNordDesc', swatch: { bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0', text: '#eceff4' } },
  { id: 'paper', nameKey: 'themePaper', descKey: 'themePaperDesc', swatch: { bg: '#f2f0ea', surface: '#fbfaf6', accent: '#111111', text: '#111111' } },
]

const STORAGE_KEY = 'paperdeck.theme'
const darkQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function resolveTheme(preference: ThemePreference | undefined): ThemeId {
  if (preference && preference !== 'system' && (THEME_IDS as readonly string[]).includes(preference)) return preference
  if (preference === 'system') return darkQuery()?.matches ? 'midnight' : 'daylight'
  return 'midnight'
}

export function applyTheme(preference: ThemePreference | undefined): void {
  document.documentElement.dataset.theme = resolveTheme(preference)
  try {
    if (preference) localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage may be unavailable; the saved config still restores the theme.
  }
}

// Called before React mounts so the first paint already uses the last theme.
export function applyCachedTheme(): void {
  let cached: ThemePreference | undefined
  try {
    cached = (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? undefined
  } catch {
    cached = undefined
  }
  document.documentElement.dataset.theme = resolveTheme(cached)
}

// Re-resolve "system" when macOS switches between light and dark.
export function watchSystemTheme(preference: ThemePreference | undefined): () => void {
  const query = darkQuery()
  if (!query || preference !== 'system') return () => {}
  const listener = (): void => applyTheme('system')
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
