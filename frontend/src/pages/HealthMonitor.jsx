import { useState, useEffect, useCallback } from 'react'
import { API } from '../api'
import { accountApprovalGate, PendingApprovalCard, RejectedAccountCard } from '../accountAccessGates.jsx'

export default function HealthMonitor({ user, onToast, patientRegistryRevision = 0, onRecordsMutated }) {
  const isDoctor = user.role === 'doctor'
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(user.patient_id || '')
  const [vitalsHistory, setVitalsHistory] = useState([])
  
  // Vitals form state
  const [heartRate, setHeartRate] = useState('')
  const [systolicBp, setSystolicBp] = useState('')
  const [diastolicBp, setDiastolicBp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [temperature, setTemperature] = useState('')
  const [bloodSugar, setBloodSugar] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')

  const fetchVitals = useCallback(async () => {
    try {
      const data = await API.getVitals(selectedPatientId)
      setVitalsHistory(data)
    } catch {
      onToast('Failed to fetch vitals history', 'error')
    }
  }, [selectedPatientId, onToast])

  // Load patients if doctor (re-fetch when registry changes elsewhere, e.g. registry cleared)
  useEffect(() => {
    if (isDoctor) {
      const fetchPatients = async () => {
        try {
          const list = await API.getPatients()
          setPatients(list)
          if (list.length === 0) {
            setSelectedPatientId('')
            setVitalsHistory([])
            return
          }
          setSelectedPatientId((prev) => {
            const pstr = prev != null && prev !== '' ? String(prev) : ''
            if (pstr && list.some((p) => String(p.id) === pstr)) return pstr
            return String(list[0].id)
          })
        } catch {
          onToast('Failed to load patients list', 'error')
        }
      }
      fetchPatients()
    }
  }, [isDoctor, patientRegistryRevision, onToast])

  // Load vitals history when patient selection changes
  useEffect(() => {
    if (selectedPatientId) {
      fetchVitals()
    }
  }, [selectedPatientId, fetchVitals])

  const handleRecordVitals = async (e) => {
    e.preventDefault()
    if (!selectedPatientId) {
      onToast('No patient selected', 'error')
      return
    }

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
      const result = await API.addVitals(selectedPatientId, payload)
      if (result.success) {
        onToast(`Vitals recorded! Agent analysis: ${result.status}`, result.status === 'Normal' ? 'success' : result.status === 'Warning' ? 'info' : 'error')
        fetchVitals()
        onRecordsMutated?.()
        // Reset form
        setHeartRate('')
        setSystolicBp('')
        setDiastolicBp('')
        setSpo2('')
        setTemperature('')
        setBloodSugar('')
      } else {
        onToast('Failed to record vitals', 'error')
      }
    } catch {
      onToast('Error recording vitals', 'error')
    }
  }

  const latestVitals = vitalsHistory[0] || {}

  if (!isDoctor && user?.role === 'patient' && accountApprovalGate(user) === 'pending') {
    return (
      <div className="health-monitor-container" style={{ padding: 24 }}>
        <PendingApprovalCard />
      </div>
    )
  }

  if (!isDoctor && user?.role === 'patient' && accountApprovalGate(user) === 'rejected') {
    return (
      <div className="health-monitor-container" style={{ padding: 24 }}>
        <RejectedAccountCard />
      </div>
    )
  }

  return (
    <div className="health-monitor-container">
      {isDoctor && (
        <div className="patient-selector-card card">
          <label htmlFor="patient-select">🔎 Select Patient to Monitor:</label>
          <select 
            id="patient-select" 
            value={selectedPatientId} 
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="patient-dropdown"
          >
            <option value="" disabled>-- Choose a patient --</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (Age: {p.age}, Severity: {p.severity})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedPatientId ? (
        <div className="monitor-grid">
          {/* Gauges Column */}
          <div className="vitals-display-section">
            <div className="vitals-status-header card">
              <h3>Latest Vitals Status: 
                <span className={`status-badge-inline ${latestVitals.status || 'Normal'}`}>
                  {latestVitals.status || 'No data'}
                </span>
              </h3>
              <p>Last checked: {latestVitals.recorded_at ? new Date(latestVitals.recorded_at).toLocaleString() : 'N/A'}</p>
            </div>

            <div className="gauges-grid">
              <div className={`gauge-card card ${latestVitals.spo2 < 95 ? (latestVitals.spo2 < 90 ? 'critical' : 'warning') : 'normal'}`}>
                <div className="gauge-icon">🫁</div>
                <h4>Oxygen Saturation</h4>
                <div className="gauge-value">{latestVitals.spo2 ? `${latestVitals.spo2}%` : '--'}</div>
                <span className="gauge-range">Normal: 95% - 100%</span>
              </div>

              <div className={`gauge-card card ${latestVitals.heart_rate > 100 || latestVitals.heart_rate < 60 ? (latestVitals.heart_rate > 120 || latestVitals.heart_rate < 50 ? 'critical' : 'warning') : 'normal'}`}>
                <div className="gauge-icon">❤️</div>
                <h4>Heart Rate</h4>
                <div className="gauge-value">{latestVitals.heart_rate ? `${latestVitals.heart_rate} bpm` : '--'}</div>
                <span className="gauge-range">Normal: 60 - 100 bpm</span>
              </div>

              <div className={`gauge-card card ${(latestVitals.systolic_bp > 130 || latestVitals.diastolic_bp > 85) ? 'warning' : 'normal'}`}>
                <div className="gauge-icon">🩺</div>
                <h4>Blood Pressure</h4>
                <div className="gauge-value">
                  {latestVitals.systolic_bp && latestVitals.diastolic_bp 
                    ? `${latestVitals.systolic_bp}/${latestVitals.diastolic_bp}` 
                    : '--'}
                </div>
                <span className="gauge-range">Normal: &lt; 130/85</span>
              </div>

              <div className={`gauge-card card ${latestVitals.temperature > 100.4 || latestVitals.temperature < 97.0 ? 'warning' : 'normal'}`}>
                <div className="gauge-icon">🌡️</div>
                <h4>Temperature</h4>
                <div className="gauge-value">{latestVitals.temperature ? `${latestVitals.temperature}°F` : '--'}</div>
                <span className="gauge-range">Normal: 97°F - 99°F</span>
              </div>

              <div className={`gauge-card card ${latestVitals.blood_sugar > 140 ? 'warning' : 'normal'}`}>
                <div className="gauge-icon">🩸</div>
                <h4>Blood Sugar</h4>
                <div className="gauge-value">{latestVitals.blood_sugar ? `${latestVitals.blood_sugar} mg/dL` : '--'}</div>
                <span className="gauge-range">Normal: &lt; 140 mg/dL</span>
              </div>

              <div className="gauge-card card normal">
                <div className="gauge-icon">⚖️</div>
                <h4>BMI & Body Composition</h4>
                <div className="gauge-value">{latestVitals.bmi ? `${latestVitals.bmi}` : '--'}</div>
                <span className="gauge-range">Weight: {latestVitals.weight ? `${latestVitals.weight}kg` : '--'} | Height: {latestVitals.height ? `${latestVitals.height}cm` : '--'}</span>
              </div>
            </div>

            {/* Historical Log */}
            <div className="vitals-history-card card">
              <h3>Vitals Log History</h3>
              <div className="table-wrapper">
                <table className="vitals-table">
                  <thead>
                    <tr>
                      <th>Time Recorded</th>
                      <th>SpO2</th>
                      <th>Heart Rate</th>
                      <th>BP</th>
                      <th>Temp</th>
                      <th>Glucose</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitalsHistory.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center">No vital records found.</td>
                      </tr>
                    ) : (
                      vitalsHistory.map(v => (
                        <tr key={v.id} className={`vitals-row-${v.status}`}>
                          <td>{new Date(v.recorded_at).toLocaleString()}</td>
                          <td>{v.spo2 ? `${v.spo2}%` : '-'}</td>
                          <td>{v.heart_rate ? `${v.heart_rate} bpm` : '-'}</td>
                          <td>{v.systolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '-'}</td>
                          <td>{v.temperature ? `${v.temperature}°F` : '-'}</td>
                          <td>{v.blood_sugar ? `${v.blood_sugar} mg/dL` : '-'}</td>
                          <td>
                            <span className={`status-badge-table ${v.status}`}>
                              {v.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="vitals-form-section">
            <div className="card vitals-input-card">
              <h3>📥 Record New Vitals</h3>
              <p>Simulate patient vital telemetry inputs analyzed by the Health Monitor Agent.</p>
              
              <form onSubmit={handleRecordVitals} className="vitals-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Heart Rate (bpm)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 72" 
                      value={heartRate} 
                      onChange={(e) => setHeartRate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Oxygen Saturation (SpO2 %)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      placeholder="e.g. 98" 
                      value={spo2} 
                      onChange={(e) => setSpo2(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Systolic BP (mmHg)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 120" 
                      value={systolicBp} 
                      onChange={(e) => setSystolicBp(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Diastolic BP (mmHg)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 80" 
                      value={diastolicBp} 
                      onChange={(e) => setDiastolicBp(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Temperature (°F)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      placeholder="e.g. 98.6" 
                      value={temperature} 
                      onChange={(e) => setTemperature(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Blood Sugar (mg/dL)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 95" 
                      value={bloodSugar} 
                      onChange={(e) => setBloodSugar(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      placeholder="e.g. 65" 
                      value={weight} 
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Height (cm)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 165" 
                      value={height} 
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="submit-vitals-btn">
                  Analyze & Record Vitals
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center card padding-lg">
          <p>Please select a patient to monitor.</p>
        </div>
      )}
    </div>
  )
}
