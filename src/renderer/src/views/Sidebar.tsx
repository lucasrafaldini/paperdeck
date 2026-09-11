import { ActionButton } from '../components/ActionButton'
import { Icon } from '../components/Icon'
import type { Translator } from '../i18n'
import type { NavItem, NavKey } from '../types'

interface SidebarProps {
  appCommit?: string
  appVersion?: string
  backendPill: { className: string; label: string }
  nav: NavKey
  navItems: NavItem[]
  onNav: (key: NavKey) => void
  onOpenRepo: () => void
  t: Translator
}

export function Sidebar({
  appCommit,
  appVersion,
  backendPill,
  nav,
  navItems,
  onNav,
  onOpenRepo,
  t,
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark paperdeck-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
            <line x1="7" y1="8" x2="17" y2="8"/>
            <line x1="7" y1="12" x2="15" y2="12"/>
            <line x1="7" y1="16" x2="11" y2="16"/>
          </svg>
        </span>
        <div className="brand-header-text">
          <strong className="brand-title">PaperDeck</strong>
          <span className="brand-tag">STUDIO</span>
        </div>
      </div>

      <nav className="nav">
        {navItems.map((item) => {
          return (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${nav === item.key ? 'active' : ''}`}
              onClick={() => onNav(item.key)}
              title={item.hint}
            >
              <span className="nav-icon" aria-hidden="true"><Icon name={item.icon} /></span>
              <span className="nav-text">
                <span className="nav-label">{item.label}</span>
                <span className="nav-hint">{item.hint}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        <div className={`backend-pill ${backendPill.className}`}>
          <span className="status-dot" aria-hidden="true" />
          {backendPill.label}
        </div>
        <div className="about-line">
          <span>v{appVersion ?? '2.0'} ({appCommit ?? 'build'})</span>
          <span className="author-row">
            <span>Lucas Rafaldini</span>
            <ActionButton
              className="icon-link"
              title={t('githubOpen')}
              aria-label={t('githubOpen')}
              onClick={onOpenRepo}
              icon="github"
              iconOnly
            />
          </span>
        </div>
      </div>
    </aside>
  )
}
