import { useState, useEffect } from 'react'
import { API } from '../api'

const PRIORITY_COLOR = { Emergency: 'red', Urgent: 'amber', Routine: 'blue' }
const STATUS_COLOR   = { Pending: 'pending', Completed: 'complete' }

export default function Imaging({ onToast }) {
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)

  const fetchScans = async () => {
    try { setScans(await API.getImaging()) }
    catch { onToast('Could not load imaging data.', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchScans(); const t = setInterval(fetchScans, 8000); return () => clearInterval(t) }, [])

  const completeScan = async (id) => {
    setCompleting(id)
    try {
      await API.completeScan(id)
      onToast('Scan marked as completed!', 'success')
      await fetchScans()
    } catch { onToast('Failed to update scan status.', 'error') }
    finally { setCompleting(null) }
  }

  const pending   = scans.filter(s => s.status === 'Pending')
  const completed = scans.filter(s => s.status === 'Completed')
  const emergency = pending.filter(s => s.priority === 'Emergency')
  const urgent    = pending.filter(s => s.priority === 'Urgent')

  return (
    <div>
      <div className="page-title">
        <h2>Imaging Workflow Agent</h2>
        <p>MRI, CT & X-Ray scheduling with AI-driven priority routing and radiologist assignment</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card red">
          <div className="stat-header"><div className="stat-label">Emergency</div><div className="stat-icon red">🚑</div></div>
          <div className="stat-value red">{emergency.length}</div>
          <div className="stat-sub">Immediate action needed</div>
          <div className="stat-glow red" />
        </div>
        <div className="stat-card amber">
          <div className="stat-header"><div className="stat-label">Urgent</div><div className="stat-icon amber">⚡</div></div>
          <div className="stat-value amber">{urgent.length}</div>
          <div className="stat-sub">Within 2 hours</div>
          <div className="stat-glow amber" />
        </div>
        <div className="stat-card blue">
          <div className="stat-header"><div className="stat-label">Pending Total</div><div className="stat-icon blue">🔬</div></div>
          <div className="stat-value blue">{pending.length}</div>
          <div className="stat-sub">In imaging queue</div>
          <div className="stat-glow blue" />
        </div>
        <div className="stat-card green">
          <div className="stat-header"><div className="stat-label">Completed</div><div className="stat-icon green">✅</div></div>
          <div className="stat-value green">{completed.length}</div>
          <div className="stat-sub">Reports ready</div>
          <div className="stat-glow green" />
        </div>
      </div>

      {/* PACS Workflow Diagram */}
      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="glass-card-title" style={{ marginBottom: 16 }}><div className="icon">📡</div>PACS Workflow Pipeline</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {['Order Entry\n(RIS)', 'Priority\nAssignment', 'Scanner\nRouting', 'DICOM\nAcquisition', 'PACS\nArchive', 'Radiologist\nReview', 'HL7 Report\n→ EHR'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                background: i < 4 ? 'rgba(0,229,255,0.08)' : 'rgba(16,185,129,0.08)',
                border: `1px solid ${i < 4 ? 'rgba(0,229,255,0.2)' : 'rgba(16,185,129,0.2)'}`,
                textAlign: 'center', minWidth: 90, flexShrink: 0
              }}>
                <div style={{ fontSize: 11, color: i < 4 ? 'var(--accent-cyan)' : 'var(--accent-green)', fontWeight: 600, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{step}</div>
              </div>
              {i < 6 && <div style={{ width: 32, height: 2, background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Scan Queue Table */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="glass-card-title"><div className="icon">🔬</div>Imaging Queue</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-pending">{pending.length} Pending</span>
            <span className="badge badge-complete">{completed.length} Done</span>
          </div>
        </div>

        {loading
          ? <div className="loading-overlay"><div className="spinner" /></div>
          : scans.length === 0
            ? <div className="empty-state"><div className="icon">🔬</div><p>No scans scheduled yet. Register a patient to begin.</p></div>
            : <table className="data-table">
                <thead><tr>
                  <th>Patient</th><th>Scan Type</th><th>Priority</th>
                  <th>Radiologist</th><th>Scheduled</th><th>Report</th><th>Status</th><th>Action</th>
                </tr></thead>
                <tbody>
                  {scans.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.patient_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID #{s.patient_id}</div>
                      </td>
                      <td><span className="tag">{s.scan_type}</span></td>
                      <td><span className={`badge badge-${(PRIORITY_COLOR[s.priority] || 'info')}`}>{s.priority}</span></td>
                      <td style={{ fontSize: 12 }}>{s.assigned_radiologist}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.scheduled_time}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200 }}>
                        {s.report_findings
                          ? String(s.report_findings).length > 90
                            ? `${String(s.report_findings).slice(0, 90)}…`
                            : String(s.report_findings)
                          : '—'}
                      </td>
                      <td><span className={`badge badge-${STATUS_COLOR[s.status] || 'pending'}`}>{s.status}</span></td>
                      <td>
                        {s.status === 'Pending' && (
                          <button className="btn btn-success btn-sm" onClick={() => completeScan(s.id)}
                            disabled={completing === s.id}>
                            {completing === s.id ? <div className="spinner" style={{ width: 12, height: 12 }} /> : '✓ Complete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>
    </div>
  )
}
