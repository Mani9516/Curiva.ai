import { useState, useEffect } from 'react'
import { API } from '../api'

export default function Alerts({ onToast }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(null)

  const fetchAlerts = async () => {
    try { setAlerts(await API.getAlerts()) }
    catch { onToast('Could not load alerts.', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAlerts(); const t = setInterval(fetchAlerts, 6000); return () => clearInterval(t) }, [])

  const resolve = async (id) => {
    setResolving(id)
    try {
      await API.resolveAlert(id)
      onToast('Alert resolved!', 'success')
      await fetchAlerts()
    } catch { onToast('Failed to resolve alert.', 'error') }
    finally { setResolving(null) }
  }

  const active   = alerts.filter(a => !a.resolved)
  const resolved = alerts.filter(a => a.resolved)
  const critical = active.filter(a => a.level === 'Critical')
  const warnings = active.filter(a => a.level === 'Warning')

  return (
    <div>
      <div className="page-title">
        <h2>Alert Center</h2>
        <p>Emergency notifications from the Alert Agent — real-time escalation management</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card red">
          <div className="stat-header"><div className="stat-label">Critical</div><div className="stat-icon red">🚨</div></div>
          <div className="stat-value red">{critical.length}</div>
          <div className="stat-sub">ICU / ER escalation</div>
          <div className="stat-glow red" />
        </div>
        <div className="stat-card amber">
          <div className="stat-header"><div className="stat-label">Warnings</div><div className="stat-icon amber">⚠️</div></div>
          <div className="stat-value amber">{warnings.length}</div>
          <div className="stat-sub">Priority attention needed</div>
          <div className="stat-glow amber" />
        </div>
        <div className="stat-card green">
          <div className="stat-header"><div className="stat-label">Resolved</div><div className="stat-icon green">✅</div></div>
          <div className="stat-value green">{resolved.length}</div>
          <div className="stat-sub">Handled alerts</div>
          <div className="stat-glow green" />
        </div>
      </div>

      {/* Active Alerts */}
      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="glass-card-header">
          <div className="glass-card-title"><div className="icon">🚨</div>Active Alerts</div>
          {active.length > 0 && <span className="badge badge-critical">{active.length} Unresolved</span>}
        </div>
        {loading ? <div className="loading-overlay"><div className="spinner" /></div>
          : active.length === 0
            ? <div className="empty-state"><div className="icon">✅</div><p>All clear — no active alerts.</p></div>
            : active.map(a => (
                <div className={`alert-item ${a.level}`} key={a.id} style={{ marginBottom: 10 }}>
                  <div className="alert-dot" />
                  <div className="alert-body" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className="alert-level">{a.level} — {a.patient_name || 'Registration / admin'}</div>
                        <div className="alert-msg">{a.message}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                          🕐 {new Date(a.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button className="btn btn-success btn-sm" style={{ flexShrink: 0, marginLeft: 12 }}
                        onClick={() => resolve(a.id)} disabled={resolving === a.id}>
                        {resolving === a.id ? <div className="spinner" style={{ width: 12, height: 12 }} /> : '✓ Resolve'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
        }
      </div>

      {/* Resolved Alerts */}
      {resolved.length > 0 && (
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">✅</div>Resolved Alerts</div>
            <span className="badge badge-complete">{resolved.length} Resolved</span>
          </div>
          <table className="data-table">
            <thead><tr><th>Patient</th><th>Level</th><th>Message</th><th>Time</th></tr></thead>
            <tbody>
              {resolved.map(a => (
                <tr key={a.id} style={{ opacity: 0.6 }}>
                  <td>{a.patient_name || '—'}</td>
                  <td><span className={`badge badge-${a.level === 'Critical' ? 'critical' : 'medium'}`}>{a.level}</span></td>
                  <td style={{ fontSize: 12 }}>{a.message?.slice(0, 80)}…</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(a.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
