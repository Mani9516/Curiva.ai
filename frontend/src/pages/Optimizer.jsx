import { useState, useEffect, useRef } from 'react'
import { API } from '../api'

export default function Optimizer({ onToast }) {
  const [metrics, setMetrics] = useState([])
  const [comparison, setComparison] = useState(null)
  const [training, setTraining] = useState(false)
  const [episodes, setEpisodes] = useState(150)
  const canvasRef = useRef(null)
  const compCanvasRef = useRef(null)

  const fetchMetrics = async () => {
    try {
      const m = await API.getRLMetrics()
      setMetrics(m)
    } catch {
      void 0
    }
  }

  useEffect(() => { fetchMetrics() }, [])

  const drawRewardChart = (metrics) => {
    const canvas = canvasRef.current
    if (!canvas || metrics.length < 2) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight
    ctx.clearRect(0, 0, W, H)

    const values = metrics.map(m => m.reward)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    const toY = v => H - ((v - min) / range) * (H - 20) - 10

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke()
    }

    const pts = metrics.map((m, i) => [(i / (metrics.length - 1)) * W, toY(m.reward)])

    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(139,92,246,0.35)')
    grad.addColorStop(1, 'rgba(139,92,246,0)')
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    pts.forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()

    // Stroke
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    pts.forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2; ctx.stroke()
  }

  const drawComparisonChart = (comp) => {
    const canvas = compCanvasRef.current
    if (!canvas || !comp) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight
    ctx.clearRect(0, 0, W, H)

    const policies = ['Random', 'FIFO', 'RL_Optimized']
    const colors = ['#ef4444', '#f59e0b', '#8b5cf6']
    const barW = (W - 60) / policies.length - 20
    const maxVal = Math.max(...policies.map(p => comp[p]?.avg_wait || 0)) * 1.2 || 1

    policies.forEach((policy, i) => {
      const val = comp[policy]?.avg_wait || 0
      const barH = (val / maxVal) * (H - 40)
      const x = 30 + i * ((W - 60) / policies.length)
      const y = H - barH - 20

      const grad = ctx.createLinearGradient(x, y, x, H - 20)
      grad.addColorStop(0, colors[i])
      grad.addColorStop(1, colors[i] + '40')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(x, y, barW, barH, 4)
      ctx.fill()

      ctx.fillStyle = colors[i]
      ctx.font = 'bold 11px Inter'
      ctx.textAlign = 'center'
      ctx.fillText(val.toFixed(1), x + barW / 2, y - 6)

      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '10px Inter'
      ctx.fillText(policy === 'RL_Optimized' ? 'RL' : policy, x + barW / 2, H - 6)
    })
  }

  useEffect(() => { drawRewardChart(metrics) }, [metrics])
  useEffect(() => { if (comparison) drawComparisonChart(comparison) }, [comparison])

  const handleTrain = async () => {
    setTraining(true)
    onToast(`Starting RL training (${episodes} episodes)…`, 'info')
    try {
      const res = await API.trainRL(episodes)
      await fetchMetrics()
      const comp = await API.compareRL()
      setComparison(comp)
      onToast(`Training complete! Final reward: ${res.final_reward?.toFixed(0)}`, 'success')
    } catch {
      onToast('Training failed — is the backend running?', 'error')
    } finally {
      setTraining(false)
    }
  }

  const handleCompare = async () => {
    try {
      const comp = await API.compareRL()
      setComparison(comp)
      onToast('Policy comparison complete!', 'success')
    } catch { onToast('Could not load policy comparison.', 'error') }
  }

  const lastMetric = metrics[metrics.length - 1]

  return (
    <div>
      <div className="page-title">
        <h2>RL Queue Optimizer</h2>
        <p>Q-Learning agent trained to minimize patient wait times and maximize scanner utilization</p>
      </div>

      {/* Control Panel */}
      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="glass-card-header">
          <div className="glass-card-title"><div className="icon">🎮</div>Training Control</div>
          {training && <span className="badge badge-pending" style={{ animation: 'pulse-green 1s infinite' }}>⚡ Training…</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="form-label" style={{ margin: 0 }}>Episodes:</label>
            {[50, 100, 150, 200].map(n => (
              <button key={n} className={`btn btn-sm ${episodes === n ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEpisodes(n)} disabled={training}>{n}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleTrain} disabled={training} style={{ minWidth: 180 }}>
            {training ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Training Q-Agent…</> : '🚀 Train RL Agent'}
          </button>
          <button className="btn btn-secondary" onClick={handleCompare} disabled={training}>📊 Compare Policies</button>
        </div>
      </div>

      {/* RL Explanation Banner */}
      <div className="glass-card" style={{ marginBottom: 20, background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.2)' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { icon: '🏥', label: 'State Space', desc: '(Emergency Queue × Urgent Queue × Routine Queue × Scanner Busy)' },
            { icon: '🎯', label: 'Actions', desc: 'Idle | Schedule Emergency | Schedule Urgent | Schedule Routine' },
            { icon: '💰', label: 'Reward Function', desc: '+20 Emergency, +10 Urgent, +5 Routine − Waiting Penalty × Priority' },
            { icon: '🧠', label: 'Algorithm', desc: 'Q-Learning with ε-greedy exploration + Bellman update' },
          ].map(x => (
            <div key={x.label} style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{x.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-violet)', marginBottom: 3 }}>{x.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{x.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {/* Reward Chart */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">📈</div>Training Reward Curve</div>
            {lastMetric && (
              <span className="tag">Ep {lastMetric.episode} | R: {lastMetric.reward?.toFixed(0)}</span>
            )}
          </div>
          {metrics.length < 2
            ? <div className="empty-state"><div className="icon">📈</div><p>Run training to see reward curve</p></div>
            : <div style={{ position: 'relative', height: 200 }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              </div>
          }
        </div>

        {/* Policy Comparison Bar Chart */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">📊</div>Policy Comparison</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Wait (patients/step)</span>
          </div>
          {!comparison
            ? <div className="empty-state"><div className="icon">📊</div><p>Click "Compare Policies" to run evaluation</p></div>
            : <div style={{ position: 'relative', height: 200 }}>
                <canvas ref={compCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              </div>
          }
        </div>
      </div>

      {/* Metrics Table */}
      {metrics.length > 0 && (
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">🗂️</div>Training Log</div>
            <span className="badge badge-info">{metrics.length} data points</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Episode</th><th>Avg Wait</th><th>Utilization</th><th>Reward</th>
              </tr></thead>
              <tbody>
                {[...metrics].reverse().map(m => (
                  <tr key={m.id}>
                    <td><span className="tag">Ep {m.episode}</span></td>
                    <td style={{ color: 'var(--accent-amber)' }}>{m.average_waiting_time?.toFixed(2)}</td>
                    <td style={{ color: 'var(--accent-green)' }}>{m.resource_utilization?.toFixed(1)}%</td>
                    <td style={{ color: m.reward > -500 ? 'var(--accent-cyan)' : 'var(--accent-red)', fontFamily: 'JetBrains Mono' }}>
                      {m.reward?.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Policy comparison details */}
      {comparison && (
        <div className="glass-card" style={{ marginTop: 20 }}>
          <div className="glass-card-title" style={{ marginBottom: 16 }}><div className="icon">🏆</div>Policy Performance Summary</div>
          <div className="grid-3">
            {Object.entries(comparison).map(([policy, data], i) => {
              const colors = ['red', 'amber', 'violet']
              const icons = ['🎲', '📋', '🤖']
              return (
                <div key={policy} className={`stat-card ${colors[i]}`}>
                  <div className="stat-header">
                    <div className="stat-label">{policy.replace('_', ' ')}</div>
                    <div className={`stat-icon ${colors[i]}`}>{icons[i]}</div>
                  </div>
                  <div className={`stat-value ${colors[i]}`} style={{ fontSize: 28 }}>{data.avg_wait?.toFixed(2)}</div>
                  <div className="stat-sub">avg patients waiting/step</div>
                  <div className={`stat-glow ${colors[i]}`} />
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    Emergency: {data.emergency_wait?.toFixed(2)} · Util: {data.utilization?.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
