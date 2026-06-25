import { useState, useEffect } from 'react'
import { API } from '../api'
import { loginLogoBase64 } from '../assets/loginLogoData.js'
import HOSPITALS_DB from '../data/hospitals.json'

const REG_CITY_KEYS = Object.keys(HOSPITALS_DB).sort()

function cityLabel(key) {
  if (!key) return ''
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export default function Register({ onLogin, onToast, onGoLogin, onBackHome }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [siteCityKey, setSiteCityKey] = useState(() => REG_CITY_KEYS[0] || 'delhi')
  const [siteHospital, setSiteHospital] = useState('')
  const [loading, setLoading] = useState(false)

  const hospitalsInCity = HOSPITALS_DB[siteCityKey] || []

  useEffect(() => {
    setSiteHospital((prev) => {
      const list = HOSPITALS_DB[siteCityKey] || []
      if (list.some((h) => h.name === prev)) return prev
      return list[0]?.name || ''
    })
  }, [siteCityKey])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password || !fullName || !email) {
      onToast('Please fill in all required fields', 'error')
      return
    }
    if (!siteCityKey || !(siteHospital || '').trim()) {
      onToast('Please select your city and hospital', 'error')
      return
    }
    if (password !== confirm) {
      onToast('Passwords do not match', 'error')
      return
    }
    setLoading(true)
    try {
      const payload = {
        username,
        password,
        role: 'patient',
        full_name: fullName,
        email,
        site_city: cityLabel(siteCityKey),
        site_hospital: (siteHospital || '').trim(),
      }
      const data = await API.register(payload)
      if (data.success) {
        onToast(
          'Welcome! Your account is active with a new EHR linked to your hospital site — you can use the full portal.',
          'success',
        )
        onLogin(data.user)
      } else {
        onToast('Registration failed', 'error')
      }
    } catch (err) {
      onToast(err.message || 'Could not create account', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-icon">
            <img src={loginLogoBase64} alt="Curiva Logo" />
          </div>
          <h2>Create account</h2>
          <p>
            Patient self-registration: your account is activated immediately with a new EHR linked to the hospital and city you choose.
            Doctor and hospital-management accounts are created from <strong>Register staff</strong> after a clinician or admin signs in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <p style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>
            Link your chart to a <strong>hospital site</strong> (stored on your profile and EHR).
          </p>
          <div className="form-group">
            <label htmlFor="reg-city">City</label>
            <div className="input-wrapper">
              <span className="input-icon">📍</span>
              <select
                id="reg-city"
                className="login-select"
                value={siteCityKey}
                onChange={(e) => setSiteCityKey(e.target.value)}
                disabled={loading}
              >
                {REG_CITY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {cityLabel(key)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="reg-hospital">Hospital</label>
            <div className="input-wrapper">
              <span className="input-icon">🏥</span>
              <select
                id="reg-hospital"
                className="login-select"
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

          <div className="form-group">
            <label htmlFor="reg-full">Full name</label>
            <div className="input-wrapper">
              <span className="input-icon">✨</span>
              <input
                id="reg-full"
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <div className="input-wrapper">
              <span className="input-icon">✉️</span>
              <input
                id="reg-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-user">Username</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input
                id="reg-user"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-pass">Password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                id="reg-pass"
                type="password"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                id="reg-confirm"
                type="password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" className="login-btn-text" onClick={onGoLogin} disabled={loading}>
            Already have an account? Sign in
          </button>
          {onBackHome && (
            <>
              <button type="button" className="login-btn-text" style={{ marginTop: 10 }} onClick={onBackHome} disabled={loading}>
                ← Back to home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
