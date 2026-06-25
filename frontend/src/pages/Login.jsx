import { useState, useEffect } from 'react'
import { API } from '../api'
import { displayPersonName } from '../userDisplay'
import AppleSignInFlow from '../components/AppleSignInFlow.jsx'
import GoogleSignInFlow from '../components/GoogleSignInFlow.jsx'
import { loginLogoBase64 } from '../assets/loginLogoData.js'
import './LoginSplit.css'
import loginSplitHeroUrl from '../assets/login-split-hero.png?url'
import HOSPITALS_DB from '../data/hospitals.json'
import { GoogleColoredLogo, AppleLogoMark } from '../components/BrandOAuthLogos.jsx'

const LOGIN_CITY_KEYS = Object.keys(HOSPITALS_DB).sort()

function cityLabel(key) {
  if (!key) return ''
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function LoginHeroArt() {
  return (
    <div className="login-split-art" aria-hidden>
      <div className="login-split-art-bg" />
      <img
        className="login-split-art-img"
        src={loginSplitHeroUrl}
        alt=""
        loading="eager"
        decoding="async"
      />
    </div>
  )
}

export default function Login({ onLogin, onToast, onGoRegister, onBackHome }) {
  const [loginAs, setLoginAs] = useState('patient') // patient | doctor | manager
  const [siteCityKey, setSiteCityKey] = useState(() => LOGIN_CITY_KEYS[0] || 'delhi')
  const [siteHospital, setSiteHospital] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleFlowOpen, setGoogleFlowOpen] = useState(false)
  const [appleFlowOpen, setAppleFlowOpen] = useState(false)

  const hospitalsInCity = HOSPITALS_DB[siteCityKey] || []

  useEffect(() => {
    setSiteHospital((prev) => {
      const list = HOSPITALS_DB[siteCityKey] || []
      if (list.some((h) => h.name === prev)) return prev
      return list[0]?.name || ''
    })
  }, [siteCityKey])

  useEffect(() => {
    if (loginAs !== 'patient') {
      setGoogleFlowOpen(false)
      setAppleFlowOpen(false)
    }
  }, [loginAs])

  const loginSiteOpts = () => ({
    siteCity: cityLabel(siteCityKey),
    siteHospital: (siteHospital || '').trim(),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      onToast('Please fill in all fields', 'error')
      return
    }
    if (!siteCityKey || !(siteHospital || '').trim()) {
      onToast('Please select your city and hospital', 'error')
      return
    }
    setLoading(true)
    try {
      const u = username.trim()
      const p = password
      const site = loginSiteOpts()
      const data = await API.login(u, p, site)
      if (data.success) {
        const role = data.user.role
        const ok =
          (loginAs === 'patient' && role === 'patient') ||
          (loginAs === 'doctor' && role === 'doctor') ||
          (loginAs === 'manager' && role === 'manager')
        if (!ok) {
          const label = loginAs === 'patient' ? 'patient' : loginAs === 'doctor' ? 'doctor' : 'hospital management'
          onToast(
            `This account is not a ${label} login. Pick the correct option above or use the right credentials.`,
            'error',
          )
          return
        }
        onToast(`Welcome back, ${displayPersonName(data.user)}!`, 'success')
        onLogin(data.user)
      } else {
        onToast('Login failed', 'error')
      }
    } catch (err) {
      onToast(err.message || 'Invalid username or password', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container login-container--split">
      <div className="login-card login-card--split">
        <div className="login-split-left">
          <div className="login-split-brand-row">
            {onBackHome && (
              <button
                type="button"
                className="login-back-symbol"
                onClick={onBackHome}
                disabled={loading}
                aria-label="Back to home"
              >
                <span aria-hidden>←</span>
              </button>
            )}
            <div className="login-split-brand">
              <img src={loginLogoBase64} alt="Curiva" />
              <div className="login-split-brand-text">
                <strong>CURIVA</strong>
                <span>Healthcare operations</span>
              </div>
            </div>
          </div>

          <h1 className="login-split-heading">Welcome back — sign in together</h1>

          <div className="login-create-banner">
            <button
              type="button"
              className="login-create-account-btn"
              onClick={() => onGoRegister?.()}
              disabled={loading || !onGoRegister}
            >
              Create account
            </button>
            <span className="login-create-banner-text">
              New patient? <strong>Create account</strong> (choose hospital &amp; city). Staff: <strong>doctor1</strong> / <strong>doctor123</strong> or{' '}
              <strong>hospitalmgr</strong> / <strong>hospital123</strong> for hospital management.
            </span>
          </div>

          <div className="login-role-section">
            <span className="login-role-label">Sign in as</span>
            <div className="login-role-grid" role="tablist" aria-label="Login type">
              <button
                type="button"
                role="tab"
                aria-selected={loginAs === 'patient'}
                className={`login-role-tile ${loginAs === 'patient' ? 'active' : ''}`}
                onClick={() => setLoginAs('patient')}
                disabled={loading}
              >
                <span className="login-role-icon">👤</span>
                <span className="login-role-title">Patient</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={loginAs === 'doctor'}
                className={`login-role-tile ${loginAs === 'doctor' ? 'active' : ''}`}
                onClick={() => setLoginAs('doctor')}
                disabled={loading}
              >
                <span className="login-role-icon">🩺</span>
                <span className="login-role-title">Doctor</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={loginAs === 'manager'}
                className={`login-role-tile ${loginAs === 'manager' ? 'active' : ''}`}
                onClick={() => setLoginAs('manager')}
                disabled={loading}
              >
                <span className="login-role-icon">🏢</span>
                <span className="login-role-title">Hospital mgmt</span>
              </button>
            </div>
          </div>

          <p className="login-site-hint">
            Select your <strong>city</strong> and <strong>hospital site</strong> for this session (saved to your profile).
          </p>
          <div className="login-form" style={{ marginBottom: 6 }}>
            <div className="form-group">
              <label htmlFor="login-city">City</label>
              <select
                id="login-city"
                className="login-site-select"
                value={siteCityKey}
                onChange={(e) => setSiteCityKey(e.target.value)}
                disabled={loading}
              >
                {LOGIN_CITY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {cityLabel(key)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="login-hospital">Hospital</label>
              <select
                id="login-hospital"
                className="login-site-select"
                value={siteHospital}
                onChange={(e) => setSiteHospital(e.target.value)}
                disabled={loading || hospitalsInCity.length === 0}
              >
                {hospitalsInCity.map((h) => (
                  <option key={h.name} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper input-wrapper--trail">
                <input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                />
                <span className="input-icon-trail">👤</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper input-wrapper--trail">
                <input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <span className="input-icon-trail">🔒</span>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading
                ? 'Authenticating...'
                : loginAs === 'patient'
                  ? 'Sign in as patient'
                  : loginAs === 'doctor'
                    ? 'Sign in as doctor'
                    : 'Sign in as hospital management'}
            </button>
          </form>

          {loginAs === 'patient' && (
            <div className="login-oauth-split" role="group" aria-label="Social sign-in for patients">
              <div className="login-oauth-or" aria-hidden>
                <span />
                <span>or</span>
                <span />
              </div>
              <div className="login-oauth-buttons">
                <button
                  type="button"
                  className="login-oauth-btn login-oauth-btn--google"
                  disabled={loading}
                  onClick={() => {
                    if (!siteCityKey || !(siteHospital || '').trim()) {
                      onToast('Please select city and hospital first.', 'error')
                      return
                    }
                    setGoogleFlowOpen(true)
                  }}
                  aria-label="Login with Google"
                >
                  <GoogleColoredLogo size={22} className="login-oauth-brand-svg" />
                  Login with Google
                </button>
                <button
                  type="button"
                  className="login-oauth-btn login-oauth-btn--apple"
                  disabled={loading}
                  onClick={() => {
                    if (!siteCityKey || !(siteHospital || '').trim()) {
                      onToast('Please select city and hospital first.', 'error')
                      return
                    }
                    setAppleFlowOpen(true)
                  }}
                  aria-label="Login with Apple"
                >
                  <AppleLogoMark size={22} className="login-oauth-brand-svg login-oauth-brand-svg--apple" />
                  Login with Apple
                </button>
              </div>
            </div>
          )}
        </div>

        <LoginHeroArt />
      </div>

      <GoogleSignInFlow
        open={googleFlowOpen}
        onClose={() => setGoogleFlowOpen(false)}
        onToast={onToast}
        onSuccess={(user) => onLogin(user)}
        siteCity={cityLabel(siteCityKey)}
        siteHospital={siteHospital}
        loginAs={loginAs}
      />
      <AppleSignInFlow
        open={appleFlowOpen}
        onClose={() => setAppleFlowOpen(false)}
        onToast={onToast}
        onSuccess={(user) => onLogin(user)}
        siteCity={cityLabel(siteCityKey)}
        siteHospital={siteHospital}
        loginAs={loginAs}
      />
    </div>
  )
}
