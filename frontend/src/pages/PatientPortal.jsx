import { useState, useEffect, useCallback } from 'react'
import { API } from '../api'
import { scrollPlAboutIntoView } from '../hashAnchor'
import { displayPersonName } from '../userDisplay'
import { accountApprovalGate, PendingApprovalCard, RejectedAccountCard } from '../accountAccessGates.jsx'
import PatientQrCard from '../components/PatientQrCard.jsx'

export default function PatientPortal({ user, onToast, onNavigate, onProfileRefresh }) {
  const patientId = user.patient_id
  const [patientData, setPatientData] = useState(null)
  const [vitals, setVitals] = useState([])
  const [activeDiet, setActiveDiet] = useState(null)
  const [loading, setLoading] = useState(true)

  const [loggingVitals, setLoggingVitals] = useState(false)
  const [profileRefreshBusy, setProfileRefreshBusy] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [heartRate, setHeartRate] = useState('')
  const [systolicBp, setSystolicBp] = useState('')
  const [diastolicBp, setDiastolicBp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [temperature, setTemperature] = useState('')
  const [bloodSugar, setBloodSugar] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')

  const approvalGate = accountApprovalGate(user)

  const loadPortalData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch patient details (contains summary, scans, hl7/fhir)
      const details = await API.getPatient(patientId)
      setPatientData(details)

      // Fetch vitals history
      const vitalsData = await API.getVitals(patientId)
      setVitals(vitalsData)

      // Fetch diet plans
      const dietData = await API.getDiets(patientId)
      if (dietData.length > 0) {
        setActiveDiet(dietData[0].plan)
      } else {
        setActiveDiet(null)
      }
    } catch {
      onToast('Failed to load patient records', 'error')
    } finally {
      setLoading(false)
    }
  }, [patientId, onToast])

  useEffect(() => {
    if (patientId) {
      loadPortalData()
    } else {
      setPatientData(null)
      setVitals([])
      setActiveDiet(null)
      setLoading(false)
    }
  }, [patientId, loadPortalData])

  useEffect(() => {
    if (loading || !patientId) return
    const onHash = () => scrollPlAboutIntoView()
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [loading, patientId])

  const handleSelfLogVitals = async (e) => {
    e.preventDefault()
    if (!patientId) {
      onToast('Chart data is not available for logging yet.', 'info')
      return
    }
    setLoggingVitals(true)

    const payload = {
      heart_rate: heartRate ? parseInt(heartRate) : null,
      systolic_bp: systolicBp ? parseInt(systolicBp) : null,
      diastolic_bp: diastolicBp ? parseInt(diastolicBp) : null,
      spo2: spo2 ? parseFloat(spo2) : null,
      temperature: temperature ? parseFloat(temperature) : null,
      blood_sugar: bloodSugar ? parseFloat(bloodSugar) : null,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
    }

    try {
      const result = await API.addVitals(patientId, payload)
      if (result.success) {
        onToast(`Vitals logged successfully. Status: ${result.status}`, result.status === 'Normal' ? 'success' : 'warning')
        setShowLogModal(false)
        loadPortalData()
        // Reset form
        setHeartRate('')
        setSystolicBp('')
        setDiastolicBp('')
        setSpo2('')
        setTemperature('')
        setBloodSugar('')
      } else {
        onToast('Failed to log vitals', 'error')
      }
    } catch {
      onToast('Error logging vitals', 'error')
    } finally {
      setLoggingVitals(false)
    }
  }

  const refreshAccessFromServer = async () => {
    if (!user?.id || typeof onProfileRefresh !== 'function') return
    setProfileRefreshBusy(true)
    try {
      const profile = await API.getUserProfile(user.id)
      onProfileRefresh(profile)
      if (profile.approval_status === 'approved') {
        onToast?.('Your access is active. Loading your portal…', 'success')
      } else {
        onToast?.('Still awaiting approval. Try again after staff confirms.', 'info')
      }
    } catch {
      onToast?.('Could not refresh status. Check your connection.', 'error')
    } finally {
      setProfileRefreshBusy(false)
    }
  }

  if (approvalGate === 'pending') {
    return (
      <div className="patient-portal-container" style={{ padding: 24 }}>
        <PendingApprovalCard onRefresh={refreshAccessFromServer} busy={profileRefreshBusy} />
      </div>
    )
  }

  if (approvalGate === 'rejected') {
    return (
      <div className="patient-portal-container" style={{ padding: 24 }}>
        <RejectedAccountCard />
      </div>
    )
  }

  if (loading && patientId) {
    return <div className="text-center padding-lg">Loading Patient Portal...</div>
  }

  const canUseChart = Boolean(patientId)
  const latestVitals = vitals[0] || {}

  return (
    <div className="patient-portal-container">
      <section id="pl-about" className="portal-card card pl-portal-about" aria-labelledby="pl-portal-about-h">
        <h3 id="pl-portal-about-h">About your portal</h3>
        <p>
          This is your Curiva patient home: records, vitals, diet guidance, and AI-assisted questions live here.
          The same <code>#pl-about</code> link can bring you back to this block after sign-in.
        </p>
        {typeof onNavigate === 'function' && (
          <p style={{ marginTop: 12 }}>
            <button
              type="button"
              className="log-vitals-btn"
              style={{ fontSize: 13 }}
              onClick={() => onNavigate('patient-records')}
            >
              📑 Open My records — appointments, reports & billing
            </button>
          </p>
        )}
      </section>

      {/* Top Welcome Section */}
      <div className="portal-welcome-strip card">
        <div className="welcome-info">
          <h2>Hello, {displayPersonName(user)}!</h2>
          <p>Welcome to your personal health portal. Review your diagnosis summaries, nutrition plans, and diagnostics below.</p>
        </div>
        <div className="welcome-actions">
          <button
            type="button"
            className="log-vitals-btn"
            disabled={!canUseChart}
            title={canUseChart ? '' : 'Available when your account has an active chart'}
            onClick={() => (canUseChart ? setShowLogModal(true) : onToast('Log vitals once your chart is active.', 'info'))}
          >
            ➕ Log Daily Vitals
          </button>
        </div>
      </div>

      <div className="portal-main-grid">
        {/* Left Column: Health Records & Telemetry */}
        <div className="portal-left-col">
          {/* Medical Record Summary */}
          <div className="portal-card card">
            <h3>🧬 Your Electronic Health Record (EHR)</h3>
            {patientData?.patient ? (
              <div className="patient-meta-grid">
                <div><strong>Age:</strong> {patientData.patient.age}</div>
                <div><strong>Gender:</strong> {patientData.patient.gender}</div>
                <div><strong>Status:</strong> <span className="status-badge-inline Normal">{patientData.patient.status}</span></div>
                <div><strong>Triage Severity:</strong> <span className={`status-badge-inline ${patientData.patient.severity}`}>{patientData.patient.severity}</span></div>
              </div>
            ) : null}

            {patientData?.summary ? (
              <div className="ehr-summary-box">
                <h4>Diagnoses & Findings</h4>
                <div className="diagnoses-chips">
                  {patientData.summary.diagnoses.split(',').map((d, i) => (
                    <span key={i} className="diagnosis-chip">{d}</span>
                  ))}
                </div>
                <h4>Clinical Summary</h4>
                <p className="summary-text">{patientData.summary.summary}</p>
                <div className="risk-score-indicator">
                  <span>Calculated Risk Score:</span>
                  <strong className={`risk-val ${patientData.summary.risk_score >= 75 ? 'Critical' : patientData.summary.risk_score >= 50 ? 'Warning' : 'Normal'}`}>
                    {patientData.summary.risk_score}/100
                  </strong>
                </div>
              </div>
            ) : (
              <p className="no-data-msg">No clinical summary has been generated for your profile yet.</p>
            )}

            {patientData?.qr_card && patientData?.qr_text && (
              <div style={{ marginTop: 16 }}>
                <PatientQrCard
                  qrCard={patientData.qr_card}
                  qrText={patientData.qr_text}
                  compact
                  onToast={onToast}
                />
              </div>
            )}
          </div>

          {/* Vitals Telemetry logs */}
          <div className="portal-card card">
            <h3>📈 Live Vitals Telemetry</h3>
            {vitals.length > 0 ? (
              <div className="portal-vitals-grid">
                <div className="vital-metric-card">
                  <span className="lbl">Heart Rate</span>
                  <span className="val">{latestVitals.heart_rate ? `${latestVitals.heart_rate} bpm` : '--'}</span>
                </div>
                <div className="vital-metric-card">
                  <span className="lbl">SpO2</span>
                  <span className="val">{latestVitals.spo2 ? `${latestVitals.spo2}%` : '--'}</span>
                </div>
                <div className="vital-metric-card">
                  <span className="lbl">Blood Pressure</span>
                  <span className="val">{latestVitals.systolic_bp && latestVitals.diastolic_bp ? `${latestVitals.systolic_bp}/${latestVitals.diastolic_bp}` : '--'}</span>
                </div>
                <div className="vital-metric-card">
                  <span className="lbl">Blood Sugar</span>
                  <span className="val">{latestVitals.blood_sugar ? `${latestVitals.blood_sugar} mg/dL` : '--'}</span>
                </div>
              </div>
            ) : (
              <p className="no-data-msg">No vitals logs recorded. Use the "Log Daily Vitals" button to start.</p>
            )}

            {vitals.length > 0 && (
              <div className="portal-vitals-status">
                <span>Vitals Status Evaluation: </span>
                <strong className={`status-badge-inline ${latestVitals.status}`}>
                  {latestVitals.status}
                </strong>
              </div>
            )}
          </div>

          {/* Imaging Scans */}
          <div className="portal-card card">
            <h3>🔬 Scheduled Diagnostic Scans</h3>
            {patientData?.scans && patientData.scans.length > 0 ? (
              <div className="portal-scans-list">
                {patientData.scans.map(s => (
                  <div key={s.id} className="portal-scan-item">
                    <div className="scan-icon-type">
                      <span>📸</span>
                      <div>
                        <h4>{s.scan_type} Scan</h4>
                        <p>Radiologist: {s.assigned_radiologist}</p>
                      </div>
                    </div>
                    <div className="scan-status-info">
                      <span className={`status-badge-table ${s.status === 'Completed' ? 'Normal' : 'Warning'}`}>
                        {s.status}
                      </span>
                      <span className="scan-time">{s.scheduled_time}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data-msg">No radiology or imaging scans are scheduled for your profile.</p>
            )}
          </div>
        </div>

        {/* Right Column: Nutrition & RAG AI */}
        <div className="portal-right-col">
          {/* Active Nutrition Program */}
          <div className="portal-card card">
            <h3>🥗 Your Customized Diet Plan</h3>
            {activeDiet ? (
              <div className="portal-diet-preview">
                <div className="macros-strip">
                  <div className="macro-chip cal">
                    <span className="macro-lbl">Cal</span>
                    <strong className="macro-val">{activeDiet.macros?.calories || '--'}</strong>
                  </div>
                  <div className="macro-chip pro">
                    <span className="macro-lbl">Prot</span>
                    <strong className="macro-val">{activeDiet.macros?.protein || '--'}</strong>
                  </div>
                  <div className="macro-chip carb">
                    <span className="macro-lbl">Carb</span>
                    <strong className="macro-val">{activeDiet.macros?.carbs || '--'}</strong>
                  </div>
                  <div className="macro-chip fat">
                    <span className="macro-lbl">Fat</span>
                    <strong className="macro-val">{activeDiet.macros?.fats || '--'}</strong>
                  </div>
                </div>

                <div className="portal-meals-mini">
                  <div className="mini-meal">
                    <strong>🍳 Breakfast:</strong>
                    <p>{activeDiet.breakfast}</p>
                  </div>
                  <div className="mini-meal">
                    <strong>🥗 Lunch:</strong>
                    <p>{activeDiet.lunch}</p>
                  </div>
                  <div className="mini-meal">
                    <strong>🍲 Dinner:</strong>
                    <p>{activeDiet.dinner}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="no-data-msg">No diet plans generated. Ask your doctor or trigger the Diet Agent to generate one.</p>
            )}
          </div>

          {/* Dedicated Q&A Chatbot widget */}
          <div className="portal-card card rag-chatbot-card">
            <h3>💬 Ask Curiva AI</h3>
            <p>Get answers about your diagnoses, diet plans, lab results, and care guidance.</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => onNavigate?.('rag')}
            >
              Open chat assistant →
            </button>
          </div>
        </div>
      </div>

      {/* Daily Vitals Self Logging Modal */}
      {showLogModal && (
        <div className="modal-overlay">
          <div className="modal-card glass-card vitals-modal-card">
            <div className="modal-header">
              <h3>📝 Log Daily Health Vitals</h3>
              <button className="close-modal-btn" onClick={() => setShowLogModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSelfLogVitals} className="vitals-modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Heart Rate (bpm)</label>
                  <input type="number" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="e.g. 72" />
                </div>
                <div className="form-group">
                  <label>SpO2 (%)</label>
                  <input type="number" step="0.1" value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="e.g. 98" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Systolic BP (mmHg)</label>
                  <input type="number" value={systolicBp} onChange={(e) => setSystolicBp(e.target.value)} placeholder="e.g. 120" />
                </div>
                <div className="form-group">
                  <label>Diastolic BP (mmHg)</label>
                  <input type="number" value={diastolicBp} onChange={(e) => setDiastolicBp(e.target.value)} placeholder="e.g. 80" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Temperature (°F)</label>
                  <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="e.g. 98.6" />
                </div>
                <div className="form-group">
                  <label>Blood Sugar (mg/dL)</label>
                  <input type="number" value={bloodSugar} onChange={(e) => setBloodSugar(e.target.value)} placeholder="e.g. 95" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 60" />
                </div>
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 160" />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowLogModal(false)}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={loggingVitals}>
                  {loggingVitals ? 'Saving...' : 'Submit Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
