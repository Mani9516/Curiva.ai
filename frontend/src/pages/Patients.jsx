import { useState, useEffect, useCallback } from 'react'
import { API } from '../api'
import PatientQrCard from '../components/PatientQrCard.jsx'

export default function Patients({ onToast, user, onRegistryMutated }) {
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [clearAllBusy, setClearAllBusy] = useState(false)

  const isRegistryStaff = user?.role === 'doctor' || user?.role === 'manager'

  const reloadPatients = useCallback(() => {
    return API.getPatients()
      .then(setPatients)
      .catch(() => onToast('Could not load patients.', 'error'))
  }, [onToast])

  useEffect(() => {
    setLoading(true)
    reloadPatients().finally(() => setLoading(false))
  }, [onToast, reloadPatients])

  const loadDetail = async (p) => {
    setSelected(p)
    setDetailLoading(true)
    try { setDetail(await API.getPatient(p.id)) }
    catch { onToast('Could not load patient detail.', 'error') }
    finally { setDetailLoading(false) }
  }

  const handleDeletePatient = async () => {
    if (!selected || !detail?.patient || !user?.id) return
    const name = detail.patient.name
    const pid = detail.patient.id
    const confirmed = window.confirm(
      `Remove "${name}" (patient #${pid}) from the registry?\n\n` +
        'This permanently deletes this patient row and related records (clinical summary, vitals, diet plans, imaging, appointments, lab reports). ' +
        'Portal accounts are unlinked from this patient ID. This cannot be undone.',
    )
    if (!confirmed) return
    setDeleteBusy(true)
    try {
      await API.deletePatient(pid, user.id)
      onToast(`${name} was removed from the patient registry.`, 'success')
      setSelected(null)
      setDetail(null)
      await reloadPatients()
      onRegistryMutated?.()
    } catch (err) {
      onToast(err?.message || 'Could not delete patient.', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleClearAllPatients = async () => {
    if (!user?.id || patients.length === 0) return
    const n = patients.length
    const confirmed = window.confirm(
      `Clear the entire patient registry?\n\n` +
        `This will permanently delete all ${n} patient record(s) and related data (clinical summaries, vitals, diet plans, imaging, appointments, lab reports). ` +
        `Portal accounts will be unlinked from patient IDs. This cannot be undone.`,
    )
    if (!confirmed) return
    const typed = window.prompt('Type DELETE ALL to confirm:', '')
    if (typed !== 'DELETE ALL') {
      onToast('Clear cancelled — confirmation text did not match.', 'error')
      return
    }
    setClearAllBusy(true)
    try {
      await API.deleteAllPatients(user.id)
      onToast(`Patient registry cleared (${n} removed).`, 'success')
      setSelected(null)
      setDetail(null)
      await reloadPatients()
      onRegistryMutated?.()
    } catch (err) {
      onToast(err?.message || 'Could not clear the registry.', 'error')
    } finally {
      setClearAllBusy(false)
    }
  }

  const SEVERITY_COLOR = { Critical: 'critical', Urgent: 'urgent', Medium: 'medium', Low: 'low' }

  return (
    <div>
      <div className="page-title">
        <h2>Patient registry</h2>
        <p>
          {isRegistryStaff
            ? 'All hospital patients in Curiva. Select a row for full EHR. You can remove one patient or clear the entire registry (irreversible).'
            : 'Complete EHR records with clinical summaries, HL7 messages, and FHIR compliance data'}
        </p>
      </div>

      <div className="grid-1-2" style={{ gap: 20 }}>
        {/* Patient List */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">👤</div>All patients</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {isRegistryStaff && patients.length > 0 && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={clearAllBusy}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClearAllPatients()
                  }}
                >
                  {clearAllBusy ? 'Clearing…' : 'Clear entire registry'}
                </button>
              )}
              <span className="badge badge-info">{patients.length} registered</span>
            </div>
          </div>
          {loading
            ? <div className="loading-overlay"><div className="spinner" /></div>
            : patients.length === 0
              ? <div className="empty-state"><div className="icon">🏥</div>
                  <p>No patients in the registry yet.</p>
                  {isRegistryStaff && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                      Use <strong>Patient Intake</strong> or <strong>Register staff</strong> to add records, or wait for patient self-registration.
                    </p>
                  )}
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {patients.map(p => (
                    <div key={p.id} onClick={() => loadDetail(p)}
                      style={{
                        padding: '12px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        background: selected?.id === p.id ? 'rgba(0,229,255,0.07)' : 'var(--bg-glass)',
                        border: `1px solid ${selected?.id === p.id ? 'rgba(0,229,255,0.25)' : 'var(--border-card)'}`,
                        transition: 'all 0.2s'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>
                            {p.name} <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--accent-cyan)' }}>#{p.id}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                            Age {p.age} · {p.gender} · {p.status}
                          </div>
                        </div>
                        <span className={`badge badge-${SEVERITY_COLOR[p.severity] || 'info'}`}>{p.severity}</span>
                      </div>
                      {p.symptoms && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                          {p.symptoms.slice(0, 60)}…
                        </div>
                      )}
                    </div>
                  ))}
                </div>
          }
        </div>

        {/* Patient Detail / EHR */}
        <div>
          {!selected && (
            <div className="glass-card flex-center" style={{ height: 300, flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 40, opacity: 0.3 }}>📋</div>
              <div style={{ color: 'var(--text-muted)' }}>Select a patient to view EHR details</div>
            </div>
          )}

          {selected && detailLoading && (
            <div className="glass-card loading-overlay" style={{ height: 300 }}>
              <div className="spinner" />
            </div>
          )}

          {selected && !detailLoading && detail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Basic Info */}
              <div className="glass-card">
                <div className="glass-card-header">
                  <div className="glass-card-title"><div className="icon">👤</div>{detail.patient.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {isRegistryStaff && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={deleteBusy}
                        onClick={handleDeletePatient}
                      >
                        {deleteBusy ? 'Removing…' : 'Remove from registry'}
                      </button>
                    )}
                    <span className={`badge badge-${SEVERITY_COLOR[detail.patient.severity] || 'info'}`}>{detail.patient.severity}</span>
                  </div>
                </div>
                <div className="form-grid">
                  {[
                    ['Patient ID', `#${detail.patient.id}`],
                    ['Age', detail.patient.age],
                    ['Gender', detail.patient.gender],
                    ['Status', detail.patient.status],
                  ].map(([k, v]) => (
                    <div key={k} style={{ padding: '10px 14px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{k}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4, fontFamily: k === 'Patient ID' ? 'JetBrains Mono' : 'inherit' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {detail.patient.symptoms && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Symptoms</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{detail.patient.symptoms}</div>
                  </div>
                )}
              </div>

              {detail.qr_card && detail.qr_text && (
                <div className="glass-card">
                  <div className="glass-card-title" style={{ marginBottom: 12 }}>
                    <div className="icon">📱</div>
                    Hospital patient QR
                  </div>
                  <PatientQrCard qrCard={detail.qr_card} qrText={detail.qr_text} onToast={onToast} />
                </div>
              )}

              {/* Clinical Summary */}
              {detail.summary && (
                <div className="glass-card">
                  <div className="glass-card-title" style={{ marginBottom: 12 }}><div className="icon">🧬</div>Clinical Summary</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>{detail.summary.summary}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Risk Score:</span>
                    <span style={{ fontWeight: 800, fontSize: 16, color: detail.summary.risk_score >= 80 ? 'var(--accent-red)' : detail.summary.risk_score >= 50 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>{detail.summary.risk_score}</span>
                    {detail.summary.diagnoses?.split(',').map(d => <span key={d} className="tag" style={{ fontSize: 11 }}>{d.trim()}</span>)}
                  </div>
                </div>
              )}

              {/* Scans */}
              {detail.scans?.length > 0 && (
                <div className="glass-card">
                  <div className="glass-card-title" style={{ marginBottom: 12 }}><div className="icon">🔬</div>Imaging Scans</div>
                  {detail.scans.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span className="tag">{s.scan_type}</span>
                      <span className="badge badge-pending">{s.priority}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{s.assigned_radiologist}</span>
                      <span className={`badge badge-${s.status === 'Completed' ? 'complete' : 'pending'}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* HL7 */}
              {detail.hl7 && (
                <div className="glass-card">
                  <div className="glass-card-title" style={{ marginBottom: 12 }}><div className="icon">📡</div>HL7 v2 Message</div>
                  <pre style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono', overflowX: 'auto', background: 'var(--bg-glass)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {detail.hl7}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
