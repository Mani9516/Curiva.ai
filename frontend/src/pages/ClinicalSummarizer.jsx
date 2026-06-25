import { useState } from 'react'
import { API } from '../api'

const SAMPLE_REPORTS = [
  { label: 'Chest Pain Report', text: 'Patient is a 52-year-old male presenting with acute chest pain radiating to the jaw and left arm. Reports sweating and shortness of breath. ECG shows ST-elevation. Cardiac troponin elevated.' },
  { label: 'Pneumonia Report', text: 'Patient presents with high fever, productive cough, and difficulty breathing. CXR shows bilateral infiltrates. SpO2 at 88%. Suspected community-acquired pneumonia with sepsis risk.' },
  { label: 'Appendicitis Report', text: 'Patient is a 24-year-old female with severe abdominal pain migrating from umbilicus to right lower quadrant. Positive McBurney\'s sign. Nausea, anorexia. Urgent CT scan ordered for confirmation.' },
  { label: 'Fracture Report', text: 'Patient sustained a fall from bicycle. Reports severe right wrist pain, visible deformity, and swelling. X-Ray reveals distal radius fracture with mild displacement.' },
]

export default function ClinicalSummarizer({ onToast }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleSummarize = async () => {
    if (!notes) { onToast('Please enter clinical notes to summarize.', 'error'); return }
    setLoading(true)
    try {
      // POST to intake to get a full clinical summary via the agent pipeline
      const res = await API.intake({
        name: `Clinical Review ${Date.now()}`,
        age: 40,
        gender: 'Other',
        symptoms: notes.slice(0, 200),
        notes: notes
      })
      setResult(res)
      onToast('Clinical summary generated successfully!', 'success')
    } catch {
      onToast('Could not connect to backend.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const clinicalStep = result?.steps?.find(s => s.agent === 'Clinical Summary Agent')
  const alertStep = result?.steps?.find(s => s.agent === 'Alert Agent')
  const imagingStep = result?.steps?.find(s => s.agent === 'Imaging Workflow Agent')

  const extractRisk = (log) => {
    const m = log?.match(/Risk Score: (\d+)/)
    return m ? parseInt(m[1]) : null
  }

  const extractDiagnoses = (log) => {
    const m = log?.match(/Identified: (.+?)\. Risk/)
    return m ? m[1].split(', ') : []
  }

  const risk = extractRisk(clinicalStep?.log)
  const diagnoses = extractDiagnoses(clinicalStep?.log)

  const riskColor = risk >= 80 ? '#ef4444' : risk >= 50 ? '#f59e0b' : '#10b981'
  const riskLabel = risk >= 80 ? 'High Risk' : risk >= 50 ? 'Moderate Risk' : 'Low Risk'

  return (
    <div>
      <div className="page-title">
        <h2>Clinical Summarizer Agent</h2>
        <p>NLP-powered report analysis — diagnosis extraction, risk scoring & ICD-10 tagging</p>
      </div>

      <div className="grid-1-2" style={{ gap: 20 }}>
        {/* Input Panel */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">📄</div>Clinical Notes Input</div>
          </div>

          <div className="form-group">
            <label className="form-label">Sample Reports</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SAMPLE_REPORTS.map(r => (
                <button key={r.label} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}
                  onClick={() => setNotes(r.text)}>
                  📋 {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divider" />

          <div className="form-group">
            <label className="form-label">Clinical Text / Doctor Notes</label>
            <textarea className="form-input" rows={8} placeholder="Paste clinical report, doctor notes, or patient observations here..."
              value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleSummarize} disabled={loading || !notes}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Analyzing…</> : '🧬 Run Clinical Analysis'}
          </button>
        </div>

        {/* Results Panel */}
        <div>
          {!result && (
            <div className="glass-card flex-center" style={{ height: '100%', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>🧬</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Submit clinical notes to generate AI summary</div>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Risk Score */}
              {risk !== null && (
                <div className="glass-card">
                  <div className="glass-card-header">
                    <div className="glass-card-title"><div className="icon">⚠️</div>Risk Assessment</div>
                    <span className="badge" style={{ background: `${riskColor}20`, color: riskColor, border: `1px solid ${riskColor}40` }}>{riskLabel}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                      <svg viewBox="0 0 80 80" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                        <circle cx="40" cy="40" r="32" fill="none" stroke={riskColor}
                          strokeWidth="8" strokeDasharray={`${(risk / 100) * 201} 201`}
                          strokeLinecap="round" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: riskColor }}>{risk}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Identified Conditions</div>
                      {diagnoses.map(d => <div key={d} className="tag" style={{ display: 'block', marginBottom: 4 }}>{d}</div>)}
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Summary */}
              {clinicalStep && (
                <div className="glass-card">
                  <div className="glass-card-title" style={{ marginBottom: 12 }}><div className="icon">📝</div>Clinical Summary</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {clinicalStep.log}
                  </div>
                </div>
              )}

              {/* Imaging Recommendation */}
              {imagingStep && (
                <div className="glass-card" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                  <div className="glass-card-title" style={{ marginBottom: 12 }}><div className="icon">🔬</div>Imaging Recommendation</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {imagingStep.log}
                  </div>
                </div>
              )}

              {/* Alert Status */}
              {alertStep && (
                <div className="glass-card" style={{ borderColor: alertStep.log.includes('ALERT CREATED') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)' }}>
                  <div className="glass-card-title" style={{ marginBottom: 12 }}>
                    <div className="icon">{alertStep.log.includes('ALERT CREATED') ? '🚨' : '✅'}</div>Alert Status
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {alertStep.log}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
