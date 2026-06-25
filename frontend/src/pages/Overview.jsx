import { useState, useEffect, useRef } from 'react'
import StatCard from '../components/StatCard'
import { API } from '../api'

const SEVERITY_COLORS = { Critical: '#ef4444', Urgent: '#f59e0b', Medium: '#3b82f6', Low: '#10b981' }

export default function Overview({ onNavigate, patientRegistryRevision = 0 }) {
  const [stats, setStats] = useState(null)
  const [patients, setPatients] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef(null)

  const fetchData = async () => {
    try {
      const [s, p, a] = await Promise.all([API.getStats(), API.getPatients(), API.getAlerts()])
      setStats(s)
      setPatients(p.slice(0, 6))
      setAlerts(a.filter(x => !x.resolved).slice(0, 5))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 8000); return () => clearInterval(t) }, [patientRegistryRevision])

  // Draw mini line chart on canvas
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight
    ctx.clearRect(0, 0, W, H)

    // Simulated trend data
    const data = [12, 19, 9, 22, 14, 28, 16, 31, 20, 25, 18, 30]
    const max = Math.max(...data)
    const pts = data.map((v, i) => [
      (i / (data.length - 1)) * W,
      H - (v / max) * (H - 10) - 5
    ])

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(0,229,255,0.25)')
    grad.addColorStop(1, 'rgba(0,229,255,0.0)')

    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    pts.forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()

    // Line
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    pts.forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2.5; ctx.stroke()

    // Dots
    pts.forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#00e5ff'; ctx.fill()
    })
  }, [stats])

  if (loading) return (
    <div className="loading-overlay">
      <div className="spinner" />
      <span>Loading Hospital Dashboard…</span>
    </div>
  )

  const sb = stats?.severity_breakdown || {}

  return (
    <div>
      <div className="page-title">
        <h2>Hospital Command Center</h2>
        <p>Real-time multi-agent workflow monitoring</p>
      </div>

      {/* KPI STATS */}
      <div className="stats-grid">
        <StatCard label="Total Patients" value={stats?.total_patients ?? 0} icon="👤" color="cyan" sub="Registered today" />
        <StatCard label="Active Alerts" value={stats?.active_alerts ?? 0} icon="🚨" color="red" sub="Unresolved emergencies" />
        <StatCard label="Pending Scans" value={stats?.pending_scans ?? 0} icon="🔬" color="blue" sub="Imaging queue" />
        <StatCard label="Avg Risk Score" value={stats?.average_risk_score ?? 0} icon="💊" color="amber" sub="Clinical assessment" />
        <StatCard label="Open Tasks" value={stats?.pending_tasks ?? 0} icon="📌" color="violet" sub="Agent task queue" />
        <StatCard label="Agents Active" value="7" icon="🤖" color="green" sub="All systems operational" />
      </div>

      <div className="grid-2-1" style={{ gap: 20 }}>
        {/* Patient Trend Chart */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title">
              <div className="icon">📈</div>
              Patient Intake Trend
            </div>
            <span className="tag">Last 12 hrs</span>
          </div>
          <div style={{ position: 'relative', height: 160 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
            {['Critical', 'Urgent', 'Medium', 'Low'].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLORS[s] }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s}: {sb[s] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">🎯</div>Severity Mix</div>
          </div>
          <div className="severity-chart">
            {Object.entries(SEVERITY_COLORS).map(([s, color]) => {
              const total = Object.values(sb).reduce((a, b) => a + b, 0) || 1
              const count = sb[s] ?? 0
              const pct = Math.round((count / total) * 100)
              return (
                <div className="severity-row" key={s}>
                  <span className="severity-label">{s}</span>
                  <div className="severity-bar-track">
                    <div className="severity-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="severity-count" style={{ color }}>{count}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => onNavigate('intake')}>
              + Register Patient
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, marginTop: 20 }}>
        {/* Recent Patients */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">👤</div>Recent Patients</div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('patients')}>View All</button>
          </div>
          {patients.length === 0
            ? <div className="empty-state"><div className="icon">🏥</div><p>No patients registered yet.</p></div>
            : <table className="data-table">
                <thead><tr>
                  <th>Name</th><th>Severity</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Age {p.age} · {p.gender}</div></td>
                      <td><span className={`badge badge-${p.severity?.toLowerCase()}`}>{p.severity}</span></td>
                      <td><span className="badge badge-info">{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        {/* Active Alerts */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">🚨</div>Active Alerts</div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('alerts')}>Manage</button>
          </div>
          {alerts.length === 0
            ? <div className="empty-state"><div className="icon">✅</div><p>All clear — no active alerts.</p></div>
            : alerts.map(a => (
                <div className={`alert-item ${a.level}`} key={a.id}>
                  <div className="alert-dot" />
                  <div className="alert-body">
                    <div className="alert-level">{a.level}</div>
                    <div className="alert-msg">{a.message?.slice(0, 100)}…</div>
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Agent Architecture */}
      <div className="glass-card" style={{ marginTop: 20 }}>
        <div className="glass-card-header">
          <div className="glass-card-title"><div className="icon">🤖</div>Multi-Agent Architecture</div>
          <span className="badge badge-complete">All Online</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { name: 'Intake Agent', icon: '🏥', role: 'Triage & Registration', color: 'cyan' },
            { name: 'Clinical Agent', icon: '🧬', role: 'NLP Summarization', color: 'blue' },
            { name: 'Imaging Agent', icon: '🔬', role: 'Scan Routing', color: 'violet' },
            { name: 'EHR Agent', icon: '📋', role: 'HL7 / FHIR Sync', color: 'green' },
            { name: 'Alert Agent', icon: '🚨', role: 'Emergency Escalation', color: 'red' },
            { name: 'Planner Agent', icon: '📌', role: 'Task Assignment', color: 'amber' },
            { name: 'Analytics Agent', icon: '📊', role: 'Bottleneck Detection', color: 'cyan' },
          ].map(a => (
            <div key={a.name} style={{
              padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-glass)', border: '1px solid var(--border-card)',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <div className={`stat-icon ${a.color}`} style={{ width: 34, height: 34, fontSize: 15 }}>{a.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.role}</div>
              </div>
              <div className="status-dot" style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
