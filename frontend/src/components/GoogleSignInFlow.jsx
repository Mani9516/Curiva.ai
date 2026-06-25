import { useEffect, useState } from 'react'
import { API } from '../api'
import { PL_ABOUT_HASH } from '../hashAnchor'
import { GoogleColoredLogo } from './BrandOAuthLogos.jsx'
import './GoogleSignInFlow.css'

function roleMatchesLoginAs(role, loginAs) {
  return (
    (loginAs === 'patient' && role === 'patient') ||
    (loginAs === 'doctor' && role === 'doctor')
  )
}

/** Simulated Google sign-in (2 steps) then real Curiva login via API. */
export default function GoogleSignInFlow({
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
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setIdentifier('')
    setPassword('')
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
  const displayName = trimmedId.includes('@')
    ? trimmedId.split('@')[0].replace(/[._]/g, ' ').split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'there'
    : trimmedId.charAt(0).toUpperCase() + trimmedId.slice(1) || 'there'

  const goNextStep1 = (e) => {
    e.preventDefault()
    if (!trimmedId) {
      onToast?.('Enter your email or Curiva username.', 'info')
      return
    }
    setStep(2)
    window.location.hash = PL_ABOUT_HASH
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
      className="gsf-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby={step === 1 ? 'gsf-title' : 'gsf-title-pwd'}
    >
      <button type="button" className="gsf-backdrop" aria-label="Close" onClick={onClose} />
      <div className="gsf-shell">
        {step === 1 && (
          <div className="gsf-card gsf-card-step1">
            <button
              type="button"
              className="gsf-back-step"
              onClick={() => onClose?.()}
              aria-label="Back to Curiva sign-in"
            >
              ‹
            </button>
            <div className="gsf-step1-left">
              <div className="gsf-logo-row">
                <GoogleColoredLogo size={28} />
              </div>
              <h1 id="gsf-title" className="gsf-h1">Sign in</h1>
              <p className="gsf-sub">Use your Google Account with your Curiva credentials</p>
            </div>
            <form className="gsf-step1-right" onSubmit={goNextStep1}>
              <label className="gsf-field">
                <span className="gsf-field-label">Email or phone</span>
                <input
                  className="gsf-input"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(ev) => setIdentifier(ev.target.value)}
                  placeholder=" "
                />
              </label>
              <button type="button" className="gsf-link">Forgot email?</button>
              <p className="gsf-hint">
                Not your computer? Use Guest mode to sign in privately. <button type="button" className="gsf-link-inline">Learn more</button>
              </p>
              <div className="gsf-actions">
                <button type="button" className="gsf-link">Create account</button>
                <button type="submit" className="gsf-btn-primary">Next</button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="gsf-card gsf-card-step2">
            <button type="button" className="gsf-back-step" onClick={() => setStep(1)} aria-label="Back">‹</button>
            <div className="gsf-step2-inner">
              <div className="gsf-logo-center">
                <GoogleColoredLogo size={40} />
              </div>
              <h1 id="gsf-title-pwd" className="gsf-h1-center">Hi {displayName}</h1>
              <div className="gsf-chip" role="status">
                <span className="gsf-chip-avatar" aria-hidden>{trimmedId.charAt(0).toUpperCase()}</span>
                <span className="gsf-chip-email">{trimmedId}</span>
              </div>
              <form onSubmit={submitLogin}>
                <label className="gsf-field gsf-field-floating">
                  <span className="gsf-float-label">Enter your password</span>
                  <input
                    className="gsf-input gsf-input-pwd"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                  />
                </label>
                <label className="gsf-check">
                  <input type="checkbox" checked={showPassword} onChange={(ev) => setShowPassword(ev.target.checked)} />
                  Show password
                </label>
                <div className="gsf-actions gsf-actions-step2">
                  <button type="button" className="gsf-link">Forgot password?</button>
                  <button type="submit" className="gsf-btn-primary" disabled={loading}>{loading ? '…' : 'Next'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <footer className="gsf-page-footer">
          <span className="gsf-footer-links">
            <button type="button" className="gsf-link-inline">Help</button>
            <button type="button" className="gsf-link-inline">Privacy</button>
            <button type="button" className="gsf-link-inline">Terms</button>
          </span>
        </footer>
        <p className="gsf-demo-note">
          Demo: simulates Google sign-in. Use your Curiva username or email and password; any @gmail.com / @googlemail.com
          address also works with the demo patient password when that address is not already tied to another account. iCloud / me.com /
          mac.com / Apple private relay addresses follow the same rule. Role must match
          the option you chose on the main sign-in page.
        </p>
      </div>
    </div>
  )
}
