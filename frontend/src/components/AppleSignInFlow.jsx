import { useEffect, useState } from 'react'
import { API } from '../api'
import { PL_ABOUT_HASH } from '../hashAnchor'
import { AppleLogoMark } from './BrandOAuthLogos.jsx'
import './AppleSignInFlow.css'

function roleMatchesLoginAs(role, loginAs) {
  return (
    (loginAs === 'patient' && role === 'patient') ||
    (loginAs === 'doctor' && role === 'doctor')
  )
}

function AppleIdHero() {
  return (
    <div className="asf-hero" aria-hidden>
      <svg className="asf-hero-ring" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="asf-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff2d55" />
            <stop offset="16%" stopColor="#ff9500" />
            <stop offset="33%" stopColor="#ffcc00" />
            <stop offset="50%" stopColor="#34c759" />
            <stop offset="66%" stopColor="#00c7be" />
            <stop offset="83%" stopColor="#007aff" />
            <stop offset="100%" stopColor="#af52de" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#asf-ring-grad)" opacity="0.85" />
        <circle cx="60" cy="60" r="44" fill="#fff" />
      </svg>
      <div className="asf-hero-apple">
        <AppleLogoMark className="asf-hero-apple-svg" size={44} />
      </div>
    </div>
  )
}

/** Apple ID–inspired demo (2 steps) then real Curiva login via API. */
export default function AppleSignInFlow({
  open,
  onClose,
  onSuccess,
  onToast,
  siteCity = '',
  siteHospital = '',
  loginAs = 'patient',
}) {
  const [step, setStep] = useState(1)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setIdentifier('')
    setPassword('')
    setKeepSignedIn(true)
    setShowPassword(false)
    setLoading(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const trimmedId = identifier.trim()

  const goPasswordStep = () => {
    if (!trimmedId) {
      onToast?.('Enter your Apple ID (Curiva email or username).', 'info')
      return
    }
    setStep(2)
  }

  const submitLogin = async (e) => {
    e.preventDefault()
    if (!trimmedId || !password) {
      onToast?.('Enter your password.', 'info')
      return
    }
    setLoading(true)
    try {
      const data = await API.login(trimmedId, password, { siteCity, siteHospital: (siteHospital || '').trim() })
      const role = data?.user?.role
      if (!roleMatchesLoginAs(role, loginAs)) {
        const label =
          loginAs === 'patient' ? 'patient' : loginAs === 'doctor' ? 'doctor' : 'hospital management / staff'
        onToast?.(`This account is not a ${label} login. Choose the matching role on the Curiva sign-in page.`, 'info')
        setLoading(false)
        return
      }
      onToast?.(`Welcome back, ${data.user.full_name || data.user.username}.`, 'success')
      onSuccess?.(data.user)
      onClose?.()
      window.location.hash = PL_ABOUT_HASH
    } catch (err) {
      const msg = err?.message || 'Sign-in failed.'
      onToast?.(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="asf-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby={step === 1 ? 'asf-title' : 'asf-title-pwd'}
    >
      <button type="button" className="asf-backdrop" aria-label="Close" onClick={onClose} />
      <div className="asf-shell">
        <header className="asf-topbar">
          <span className="asf-topbar-brand">
            <AppleLogoMark className="asf-topbar-apple" size={20} />
            <span className="asf-topbar-text">Curiva</span>
          </span>
          <button type="button" className="asf-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {step === 1 && (
          <div className="asf-card">
            <AppleIdHero />
            <h1 id="asf-title" className="asf-title">
              Sign in with Apple ID
            </h1>
            <p className="asf-lead">Use the email or username for your Curiva account (patient, doctor, or hospital).</p>
            <label className="asf-sr-only" htmlFor="asf-apple-id">
              Apple ID
            </label>
            <input
              id="asf-apple-id"
              className="asf-input"
              type="text"
              autoComplete="username"
              placeholder="Apple ID"
              value={identifier}
              onChange={(ev) => setIdentifier(ev.target.value)}
            />
            <label className="asf-check">
              <input type="checkbox" checked={keepSignedIn} onChange={(ev) => setKeepSignedIn(ev.target.checked)} />
              Keep me signed in
            </label>
            <div className="asf-btn-row">
              <button type="button" className="asf-btn asf-btn-primary" onClick={goPasswordStep}>
                Continue with Password
              </button>
              <button
                type="button"
                className="asf-btn asf-btn-secondary"
                onClick={() => onToast?.('Sign in with iPhone is not part of this demo.', 'info')}
              >
                <span className="asf-iphone-ico" aria-hidden>
                  📱
                </span>
                Sign in with iPhone
              </button>
            </div>
            <div className="asf-links">
              <button type="button" className="asf-link">
                Forgotten your Apple ID or password?
              </button>
              <button type="button" className="asf-link">
                Create Apple ID
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="asf-card asf-card-step2">
            <button type="button" className="asf-back" onClick={() => setStep(1)} aria-label="Back">
              ‹
            </button>
            <AppleIdHero />
            <h1 id="asf-title-pwd" className="asf-title">
              Enter password
            </h1>
            <p className="asf-account-label">Apple ID</p>
            <div className="asf-chip">{trimmedId}</div>
            <form onSubmit={submitLogin}>
              <label className="asf-sr-only" htmlFor="asf-password">
                Password
              </label>
              <input
                id="asf-password"
                className="asf-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
              />
              <label className="asf-check">
                <input type="checkbox" checked={showPassword} onChange={(ev) => setShowPassword(ev.target.checked)} />
                Show password
              </label>
              <div className="asf-step2-actions">
                <button type="submit" className="asf-btn asf-btn-primary asf-btn-wide" disabled={loading}>
                  {loading ? 'Signing in…' : 'Next'}
                </button>
              </div>
            </form>
          </div>
        )}

        <footer className="asf-footer">
          <div className="asf-footer-links">
            <button type="button" className="asf-footer-link">
              System Status
            </button>
            <button type="button" className="asf-footer-link">
              Privacy Policy
            </button>
            <button type="button" className="asf-footer-link">
              Terms &amp; Conditions
            </button>
          </div>
          <p className="asf-copyright">Copyright © {new Date().getFullYear()} Curiva demo. Not affiliated with Apple Inc.</p>
        </footer>
        <p className="asf-demo-note">
          Demo UI only. Your Curiva username or email and password sign you into Curiva; any @icloud.com, @me.com, @mac.com, or
          @privaterelay.appleid.com address also works with the demo patient password when that address is not already tied to another
          account. Your role must match the option selected on the main sign-in page.
        </p>
      </div>
    </div>
  )
}
