import { useState } from 'react'
import { ActionButton } from '../components/ActionButton'
import { Icon } from '../components/Icon'
import { ReqChip } from '../components/StatusChips'
import type { Translator } from '../i18n'
import type {
  KindleCandidate,
  KindleConnectResult,
  KindleConnectionTarget,
  KindleScanResult,
  KindleStatus,
} from '../../../shared/types'

type Step = 'find' | 'auth' | 'done'

interface ConnectWizardProps {
  busy: boolean
  defaultUser: string
  onConnect: (target: KindleConnectionTarget) => Promise<KindleConnectResult>
  onGoInstall: () => void
  onScan: () => Promise<KindleScanResult>
  t: Translator
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

export function ConnectWizard({ busy, defaultUser, onConnect, onGoInstall, onScan, t }: ConnectWizardProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('find')
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<KindleScanResult | null>(null)
  const [scanFailed, setScanFailed] = useState(false)
  const [manualIp, setManualIp] = useState('')
  const [manualPort, setManualPort] = useState('22')
  const [target, setTarget] = useState<{ ip: string; port: number; hint: string | null } | null>(null)
  const [name, setName] = useState('')
  const [user, setUser] = useState(defaultUser || 'root')
  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [status, setStatus] = useState<KindleStatus | null>(null)

  const steps: { key: Step; label: string }[] = [
    { key: 'find', label: t('connectStepFind') },
    { key: 'auth', label: t('connectStepAuth') },
    { key: 'done', label: t('connectStepDone') },
  ]
  const stepIndex = steps.findIndex((item) => item.key === step)
  const manualValid = IPV4.test(manualIp.trim())

  async function runScan(): Promise<void> {
    setScanning(true)
    setScanFailed(false)
    try {
      const result = await onScan()
      setScan(result)
      setScanFailed(Boolean(result.error))
    } catch {
      setScan(null)
      setScanFailed(true)
    } finally {
      setScanning(false)
    }
  }

  function choose(ip: string, port: number, candidate?: KindleCandidate): void {
    setTarget({ ip, port, hint: candidate ? candidate.hostname || candidate.banner : null })
    setName(candidate?.likelyKindle || !candidate?.hostname ? 'Kindle' : candidate.hostname)
    setFailure(null)
    setStep('auth')
  }

  async function connect(): Promise<void> {
    if (!target) return
    setConnecting(true)
    setFailure(null)
    try {
      const result = await onConnect({ ip: target.ip, port: target.port, user, name, password })
      if (result.config && result.status.connected) {
        setStatus(result.status)
        setPassword('')
        setStep('done')
      } else {
        setFailure(result.status.detail)
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setConnecting(false)
    }
  }

  function restart(): void {
    setStep('find')
    setTarget(null)
    setStatus(null)
    setFailure(null)
    setPassword('')
  }

  return (
    <section className="panel wizard">
      <header className="wizard-head">
        <span className="wizard-icon" aria-hidden="true">
          <Icon name="wifi" />
        </span>
        <div className="wizard-title">
          <p className="eyebrow">{t('connectEyebrow')}</p>
          <h2>{t('connectTitle')}</h2>
          <p className="field-note">{t('connectSub')}</p>
        </div>
      </header>

      <ol className="stepper" aria-label={t('connectTitle')}>
        {steps.map((item, index) => {
          const complete = index < stepIndex || step === 'done'
          return (
            <li
              key={item.key}
              className={`stepper-item ${complete ? 'complete' : ''} ${index === stepIndex ? 'current' : ''}`}
              aria-current={index === stepIndex ? 'step' : undefined}
            >
              <span className="stepper-dot">{complete ? '✓' : index + 1}</span>
              <span className="stepper-label">{item.label}</span>
            </li>
          )
        })}
      </ol>

      {step === 'find' ? (
        <div className="wizard-body">
          <div className={`radar ${scanning ? 'active' : ''}`}>
            <span className="radar-ring" aria-hidden="true" />
            <span className="radar-ring delay" aria-hidden="true" />
            <ActionButton className="radar-cta" icon="search" onClick={() => void runScan()} disabled={busy || scanning}>
              {scanning ? t('scanning') : scan ? t('connectScanAgain') : t('connectScanCta')}
            </ActionButton>
            {scanning ? <p className="field-note">{t('connectScanningHint')}</p> : null}
            {!scanning && scan?.subnets?.length ? (
              <p className="field-note">{t('scanSubnets', { subnets: scan.subnets.join(', ') })}</p>
            ) : null}
          </div>

          {!scanning && scanFailed ? <div className="notice error">{t('scanError')}</div> : null}

          {!scanning && scan && !scanFailed ? (
            scan.candidates.length > 0 ? (
              <ul className="scan-list" aria-live="polite">
                {scan.candidates.map((candidate) => (
                  <li key={`${candidate.ip}:${candidate.port}`} className={`scan-item ${candidate.likelyKindle ? 'likely' : ''}`}>
                    <span className="scan-glyph" aria-hidden="true"><Icon name={candidate.likelyKindle ? 'kindle' : 'globe'} /></span>
                    <div className="scan-item-info">
                      <div className="scan-item-top">
                        <span className="scan-ip">{candidate.ip}:{candidate.port}</span>
                        {candidate.likelyKindle ? <span className="badge ok">{t('scanLikelyKindle')}</span> : null}
                      </div>
                      <span className="scan-meta">
                        {candidate.hostname || t('scanUnknownHost')}
                        {candidate.banner ? ` · ${candidate.banner}` : ''}
                      </span>
                    </div>
                    <ActionButton
                      className={candidate.likelyKindle ? 'compact' : 'ghost compact'}
                      icon="check"
                      onClick={() => choose(candidate.ip, candidate.port, candidate)}
                      disabled={busy}
                    >
                      {t('connectSelect')}
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="step-empty">{t('scanEmpty')}</p>
            )
          ) : null}

          <form
            className="manual-row"
            onSubmit={(event) => {
              event.preventDefault()
              if (manualValid) choose(manualIp.trim(), Number.parseInt(manualPort, 10) || 22)
            }}
          >
            <span className="manual-label">{t('connectManualTitle')}</span>
            <input
              value={manualIp}
              onChange={(event) => setManualIp(event.target.value)}
              placeholder="192.168.0.x"
              aria-label={t('fieldKindleIp')}
              inputMode="decimal"
            />
            <input
              className="manual-port"
              value={manualPort}
              onChange={(event) => setManualPort(event.target.value)}
              aria-label={t('fieldPort')}
              inputMode="numeric"
            />
            <ActionButton type="submit" className="ghost" icon="check" disabled={!manualValid || busy}>
              {t('connectContinue')}
            </ActionButton>
          </form>

          <details className="tips">
            <summary>{t('connectTipsTitle')}</summary>
            <ul>
              <li>{t('connectTip1')}</li>
              <li>{t('connectTip2')}</li>
              <li>{t('connectTip3')}</li>
              <li>{t('connectTip4')}</li>
            </ul>
          </details>
        </div>
      ) : null}

      {step === 'auth' && target ? (
        <form
          className="wizard-body"
          onSubmit={(event) => {
            event.preventDefault()
            void connect()
          }}
        >
          <div className="target-chip">
            <span className="target-label">{t('connectTarget')}</span>
            <span className="scan-ip">{target.ip}:{target.port}</span>
            {target.hint ? <span className="scan-meta">{target.hint}</span> : null}
          </div>

          <div className="field-grid">
            <label>
              <span>{t('deviceName')}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('deviceNamePlaceholder')} />
            </label>
            <label>
              <span>{t('fieldUser')}</span>
              <input value={user} onChange={(event) => setUser(event.target.value)} placeholder="root" autoComplete="off" />
            </label>
          </div>
          <label className="wide-field">
            <span>{t('fieldPassword')}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('connectPasswordPlaceholder')}
              autoComplete="off"
              autoFocus
            />
          </label>

          {failure ? (
            <div className="conn-banner bad" role="alert">
              <span className="conn-dot" aria-hidden="true" />
              <div className="conn-text">
                <strong>{t('connectFailedTitle')}</strong>
                <span>{failure}</span>
              </div>
            </div>
          ) : null}

          <div className="button-row">
            <ActionButton type="button" className="ghost" icon="arrow-left" onClick={restart} disabled={connecting}>
              {t('connectBack')}
            </ActionButton>
            <ActionButton type="submit" icon="plug" disabled={connecting || busy}>
              {connecting ? t('connectTesting') : t('connectTest')}
            </ActionButton>
            {connecting ? <span className="scan-spinner" aria-hidden="true" /> : null}
          </div>
        </form>
      ) : null}

      {step === 'done' && status ? (
        <div className="wizard-body">
          <div className="success-hero">
            <span className="success-badge" aria-hidden="true">✓</span>
            <div>
              <h3>{t('connectSuccessTitle')}</h3>
              <p className="field-note">
                {status.model ? `${status.model} · ` : ''}
                {t('connectSuccessSub')}
              </p>
            </div>
          </div>
          <div className="req-grid">
            <ReqChip ok={status.jailbroken} label="Jailbreak" desc={t('reqJailbreak')} />
            <ReqChip ok={status.fbink} label="FBInk" desc={t('reqFbink')} />
            <ReqChip ok={status.hotfix} label="Hotfix" desc={t('reqHotfix')} />
            <ReqChip ok={status.canInstall} label={t('configBadgeReady')} desc={t('reqReady')} />
          </div>
          {!status.canInstall ? <p className="field-note">{status.detail}</p> : null}
          <div className="button-row">
            <ActionButton icon="download" onClick={onGoInstall}>{t('connectGoInstall')}</ActionButton>
            <ActionButton className="ghost" icon="plus" onClick={restart}>{t('connectAnother')}</ActionButton>
          </div>
        </div>
      ) : null}
    </section>
  )
}
