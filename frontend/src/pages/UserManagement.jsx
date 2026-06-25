import { useState } from 'react'
import { API } from '../api'

export default function UserManagement({ user, onToast, onRegistryMutated }) {
  const canRegisterAccounts = user?.role === 'doctor' || user?.role === 'manager'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('doctor')
  const [patientId, setPatientId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canRegisterAccounts) {
      onToast('Sign in as a doctor or hospital management to register accounts.', 'error')
      return
    }
    if (!username.trim() || !password || !fullName.trim() || !email.trim()) {
      onToast('Please fill in all required fields', 'error')
      return
    }
    if (password !== confirm) {
      onToast('Passwords do not match', 'error')
      return
    }
    const pid = patientId.trim() ? parseInt(patientId, 10) : null
    if (patientId.trim() && Number.isNaN(pid)) {
      onToast('Patient record ID must be a number', 'error')
      return
    }

    setLoading(true)
    try {
      const data = await API.registerUserByManager(user.id, {
        username: username.trim(),
        password,
        role,
        full_name: fullName.trim(),
        email: email.trim(),
        patient_id: role === 'patient' ? pid : null,
      })
      if (data.success) {
        onToast(`Created ${data.user.role} account: ${data.user.full_name} (@${data.user.username})`, 'success')
        setUsername('')
        setPassword('')
        setConfirm('')
        setFullName('')
        setEmail('')
        setPatientId('')
        setRole('doctor')
        if (data.user?.role === 'patient' && data.user?.patient_id != null) {
          onRegistryMutated?.()
        }
      }
    } catch (err) {
      onToast(err.message || 'Could not create account', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {user?.role !== 'doctor' && user?.role !== 'manager' ? (
        <div className="page-title">
          <h2>Access restricted</h2>
          <p>Only signed-in doctors or hospital management can create portal accounts here.</p>
        </div>
      ) : (
        <>
          <div className="page-title">
            <h2>Register staff & patients</h2>
            <p>
              Create <strong>doctor</strong> or <strong>patient</strong> portal accounts
              {user?.role === 'doctor' ? (
                <>
                  , or an additional <strong>hospital management</strong> login.
                </>
              ) : (
                <> for your site (hospital management accounts can only be created by a doctor).</>
              )}{' '}
              For patients, leave <strong>Patient record ID</strong> blank to create a new hospital record automatically, or enter an existing registry ID to link the login to that EHR.
            </p>
          </div>

          <div className="glass-card" style={{ maxWidth: 640 }}>
            <div className="glass-card-header">
              <div className="glass-card-title">
                <span className="icon">➕</span>
                <div>
                  <h3>New account</h3>
                  <span className="sub">Credentials are stored securely (demo: SHA-256 hash only)</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="login-form" style={{ paddingTop: 8 }}>
              <div className="form-group">
                <label htmlFor="mu-role">Account type</label>
                <div className="input-wrapper">
                  <span className="input-icon">🏷️</span>
                  <select
                    id="mu-role"
                    className="login-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={loading}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="patient">Patient</option>
                    {user?.role === 'doctor' && <option value="manager">Hospital management</option>}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="mu-full">Full name</label>
                <div className="input-wrapper">
                  <span className="input-icon">✨</span>
                  <input
                    id="mu-full"
                    type="text"
                    placeholder="Legal name as it should appear in the system"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="mu-email">Work or contact email</label>
                <div className="input-wrapper">
                  <span className="input-icon">✉️</span>
                  <input
                    id="mu-email"
                    type="email"
                    placeholder="name@hospital.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {role === 'patient' && (
                <div className="form-group">
                  <label htmlFor="mu-pid">Patient record ID (optional — leave blank to create a new record)</label>
                  <div className="input-wrapper">
                    <span className="input-icon">#</span>
                    <input
                      id="mu-pid"
                      type="text"
                      inputMode="numeric"
                      placeholder="Existing registry # only; leave empty for new record"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="mu-user">Username</label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    id="mu-user"
                    type="text"
                    placeholder="Unique login (e.g. dr_smith)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="mu-pass">Temporary password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    id="mu-pass"
                    type="password"
                    placeholder="Share securely with the user"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="mu-confirm">Confirm password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    id="mu-confirm"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Creating account...' : `Create ${role} account`}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
