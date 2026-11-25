import { useState, useEffect } from 'react'
import { LANGUAGES, languageName, type Translator } from '../i18n'
import { THEME_OPTIONS } from '../theme'
import type { LanguagePreference, SupportedLanguage, ThemePreference } from '../../../shared/types'

const PIP_SCALE_OPTIONS = [1, 1.25, 1.5, 1.75, 2]

interface SettingsViewProps {
  dashboardTitle: string
  disabled: boolean
  languagePreference: LanguagePreference
  onChangeDashboardTitle: (title: string) => void
  onChangeLanguage: (language: LanguagePreference) => void
  onChangeTheme: (theme: ThemePreference) => void
  onChangePictureInPictureScale: (scale: number) => void
  onTogglePictureInPicture: (enabled: boolean) => void
  pictureInPicture: boolean
  pictureInPictureScale: number
  saving: boolean
  savingPip: boolean
  savingPipScale: boolean
  savingTitle?: boolean
  systemLanguage: SupportedLanguage | undefined
  t: Translator
  themePreference: ThemePreference
}

export function SettingsView({
  dashboardTitle,
  disabled,
  languagePreference,
  onChangeDashboardTitle,
  onChangeLanguage,
  onChangeTheme,
  onChangePictureInPictureScale,
  onTogglePictureInPicture,
  pictureInPicture,
  pictureInPictureScale,
  saving,
  savingPip,
  savingPipScale,
  savingTitle,
  systemLanguage,
  t,
  themePreference,
}: SettingsViewProps): React.JSX.Element {
  const [titleInput, setTitleInput] = useState(dashboardTitle || '')

  useEffect(() => {
    setTitleInput(dashboardTitle || '')
  }, [dashboardTitle])

  return (
    <section className="single-grid settings-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('themeSectionEyebrow')}</p>
            <h2>{t('themeSectionTitle')}</h2>
            <p className="field-note">{t('themeSectionSub')}</p>
          </div>
        </div>

        <div className="theme-grid" role="radiogroup" aria-label={t('themeSectionTitle')}>
          {THEME_OPTIONS.map((option) => {
            const selected = option.id === themePreference
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`theme-card ${selected ? 'selected' : ''}`}
                onClick={() => onChangeTheme(option.id)}
                disabled={disabled}
              >
                <span className="theme-preview" style={{ background: option.swatch.bg }} aria-hidden="true">
                  <span className="theme-preview-side" style={{ background: option.swatch.surface }} />
                  <span className="theme-preview-body">
                    <span className="theme-preview-line" style={{ background: option.swatch.text }} />
                    <span className="theme-preview-line short" style={{ background: option.swatch.text }} />
                    <span className="theme-preview-card" style={{ background: option.swatch.surface }}>
                      <span className="theme-preview-dot" style={{ background: option.swatch.accent }} />
                    </span>
                  </span>
                </span>
                <span className="theme-card-text">
                  <span className="theme-card-name">
                    {t(option.nameKey)}
                    {selected ? <span className="theme-card-check">{t('themeActive')}</span> : null}
                  </span>
                  <span className="theme-card-desc">{t(option.descKey)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Personalização</p>
            <h2>Título do Dashboard</h2>
          </div>
        </div>

        <label className="wide-field">
          <span>Título exibido no topo da tela</span>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <input
              type="text"
              value={titleInput}
              placeholder="PaperDeck"
              onChange={(e) => setTitleInput(e.target.value)}
              disabled={disabled || savingTitle}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="ui-button"
              disabled={disabled || savingTitle || titleInput === dashboardTitle}
              onClick={() => onChangeDashboardTitle(titleInput)}
            >
              {savingTitle ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </label>

        <p className="field-note standalone-note">
          Título atual: <strong>{dashboardTitle || 'PaperDeck'}</strong>. Se não preenchido, o padrão exibido é <strong>PaperDeck</strong>.
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('languageSectionEyebrow')}</p>
            <h2>{t('languageSectionTitle')}</h2>
          </div>
        </div>

        <label className="wide-field">
          <span>{t('languageField')}</span>
          <select
            value={languagePreference}
            onChange={(event) => onChangeLanguage(event.target.value as LanguagePreference)}
            disabled={saving || disabled}
          >
            <option value="system">{t('languageAuto')}</option>
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>{language.name}</option>
            ))}
          </select>
        </label>

        <p className="field-note standalone-note">
          {t('languageDetected', { value: languageName(systemLanguage ?? 'en') })}
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('pipSectionEyebrow')}</p>
            <h2>{t('pipSectionTitle')}</h2>
          </div>
        </div>

        <label className="toggle-field">
          <span className="toggle-text">
            <span className="toggle-label">{t('pipField')}</span>
            <span className="toggle-status">{pictureInPicture ? t('pipOn') : t('pipOff')}</span>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={pictureInPicture}
              onChange={(event) => onTogglePictureInPicture(event.target.checked)}
              disabled={savingPip || disabled}
            />
            <span className="switch-track" aria-hidden="true" />
          </span>
        </label>

        <label className="wide-field">
          <span>{t('pipScaleField')}</span>
          <select
            value={String(pictureInPictureScale)}
            onChange={(event) => onChangePictureInPictureScale(Number.parseFloat(event.target.value))}
            disabled={savingPipScale || disabled}
          >
            {PIP_SCALE_OPTIONS.map((scale) => (
              <option key={scale} value={scale}>{`${scale}x`}</option>
            ))}
          </select>
        </label>

        <p className="field-note standalone-note">{t('pipNote')}</p>
      </section>
    </section>
  )
}
