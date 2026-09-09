import type { IconName } from '../types'

export function Icon({ name }: { name: IconName }): React.JSX.Element {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  }

  switch (name) {
    case 'book':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21Z" />
          <path d="M5 5.5V21" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
        </svg>
      )
    case 'kindle':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
          <path d="M10 6.5h4" />
          <path d="M9.5 17h5" />
        </svg>
      )
    case 'login':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M20 6v5h-5" />
          <path d="M4 18v-5h5" />
          <path d="M7.5 8A7 7 0 0 1 20 11" />
          <path d="M16.5 16A7 7 0 0 1 4 13" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
          <path d="M19 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.8-1L14.5 3h-5l-.2 2.9a7.6 7.6 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.8 1l.2 2.9h5l.2-2.9a7.6 7.6 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" />
        </svg>
      )
    case 'stethoscope':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M8 4v5a4 4 0 0 0 8 0V4" />
          <path d="M8 4H6" />
          <path d="M16 4h2" />
          <path d="M12 13v3a4 4 0 0 0 8 0a2 2 0 1 0-4 0" />
        </svg>
      )
    case 'save':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 4h11l3 3v13H5Z" />
          <path d="M8 4v5h7V4" />
          <path d="M8 20v-6h8v6" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M9 3h6" />
          <path d="M7 7l1 13h8l1-13" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common} aria-hidden="true">
          <path d="m8 5 10 7-10 7Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'stop':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="11" cy="11" r="5.5" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'slider':
      return (
        <svg {...common} aria-hidden="true">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    case 'battery':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
          <line x1="22" y1="11" x2="22" y2="13" />
        </svg>
      )
    case 'arrow-up':
      return (
        <svg {...common} aria-hidden="true">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      )
    case 'arrow-down':
      return (
        <svg {...common} aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common} aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    case 'github':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common} aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      )
    case 'pet':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="14" r="4.2" />
          <circle cx="7" cy="8" r="2.2" />
          <circle cx="17" cy="8" r="2.2" />
          <circle cx="10.2" cy="5" r="2.2" />
          <circle cx="13.8" cy="5" r="2.2" />
        </svg>
      )
  }
}
