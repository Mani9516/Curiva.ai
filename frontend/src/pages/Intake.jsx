import { useState } from 'react'
import AgentLog from '../components/AgentLog'
import { API } from '../api'

const SAMPLE_SYMPTOMS = [
  'Severe chest pain, shortness of breath, sweating',
  'High fever, persistent cough, difficulty breathing',
  'Severe abdominal pain, nausea, migrating from navel',
  'Head trauma, dizziness, vomiting after fall',
  'Fracture suspected, limb pain after accident',
]

export default function Intake({ onToast }) {
  const [form, setForm] = useState({ name: '', age: '', gender: 'Male', symptoms: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name || !form.age || !form.symptoms) {
      onToast('Please fill in Name, Age, and Symptoms.', 'error'); return
    }
    setLoading(true)
    try {
      const res = await API.intake({ ...form, age: parseInt(form.age) })
      setResult(res)
      onToast(`Patient ${form.name} registered! Pipeline completed.`, 'success')
      setForm({ name: '', age: '', gender: 'Male', symptoms: '', notes: '' })
    } catch {
      onToast('Backend connection failed. Is the server running?', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-title">
        <h2>Patient Intake Agent</h2>
        <p>Submit patient details to trigger the full multi-agent workflow pipeline</p>
      </div>

      <div className="grid-1-2" style={{ gap: 20 }}>
        {/* Form */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">🏥</div>New Patient Registration</div>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="e.g. John Doe" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Age</label>
              <input className="form-input" type="number" placeholder="e.g. 45" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Symptoms</label>
            <textarea className="form-input" rows={3} placeholder="Describe current symptoms..." value={form.symptoms} onChange={e => set('symptoms', e.target.value)} style={{ resize: 'vertical', minHeight: 80 }} />
          </div>

          {/* Quick symptom pills */}
          <div style={{ marginBottom: 18 }}>
            <div className="form-label">Quick Symptom Templates</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SAMPLE_SYMPTOMS.map(s => (
                <button key={s} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => set('symptoms', s)}>
                  {s.split(',')[0]}…
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Doctor Notes (Optional)</label>
            <textarea className="form-input" rows={2} placeholder="Additional clinical observations..." value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleSubmit} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Running Pipeline…</> : '🚀 Register & Run Agent Pipeline'}
          </button>
        </div>

        {/* Agent Log / Results */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title"><div className="icon">🤖</div>Agent Pipeline Execution</div>
            {result && (
              <span className={`badge badge-${result.success ? 'complete' : 'critical'}`}>
                {result.success ? '✓ Success' : '✗ Failed'}
              </span>
            )}
          </div>

          {result && (
            <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PATIENT ID</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    #{result.patient_id}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PIPELINE STEPS</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{result.steps?.length ?? 0}</div>
                </div>
              </div>
            </div>
          )}

          <AgentLog steps={result?.steps} />
        </div>
      </div>
    </div>
  )
}
