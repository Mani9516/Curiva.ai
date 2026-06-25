import { useState, useEffect, useCallback } from 'react'
import { API } from '../api'
import { accountApprovalGate, PendingApprovalCard, RejectedAccountCard } from '../accountAccessGates.jsx'

/* ── All supported conditions with specialist info ── */
const CONDITIONS = [
  { name: 'PCOS',                  icon: '🩺', specialist: 'Gynecologist / Endocrinologist',              category: "Women's Health" },
  { name: 'PCOD',                  icon: '🩺', specialist: 'Gynecologist / Reproductive Endocrinologist', category: "Women's Health" },
  { name: 'Hypothyroidism',        icon: '🦋', specialist: 'Endocrinologist',                             category: 'Thyroid Disorders' },
  { name: 'Hyperthyroidism',       icon: '🦋', specialist: 'Endocrinologist',                             category: 'Thyroid Disorders' },
  { name: 'Endometriosis',         icon: '🩺', specialist: 'Gynecologist / Reproductive Surgeon',         category: "Women's Health" },
  { name: 'Osteoporosis',          icon: '🦴', specialist: 'Rheumatologist / Endocrinologist',             category: 'Bone & Joint' },
  { name: 'Uterine Fibroids',      icon: '🩺', specialist: 'Gynecologist / Interventional Radiologist',   category: "Women's Health" },
  { name: 'Menstrual Disorders',   icon: '🩺', specialist: 'Gynecologist',                                category: "Women's Health" },
  { name: 'Breast Health',         icon: '🩺', specialist: 'Gynecologist / Breast Surgeon',               category: "Women's Health" },
  { name: 'Cervical Health',       icon: '🩺', specialist: 'Gynecologist / Oncologist',                   category: "Women's Health" },
]

export default function DietPlan({ user, onToast, patientRegistryRevision = 0 }) {
  const isDoctor = user.role === 'doctor'
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(user.patient_id || '')
  const [dietsHistory, setDietsHistory] = useState([])
  const [activePlan, setActivePlan] = useState(null)
  const [generating, setGenerating] = useState(false)
  
  // Diet plan generator inputs
  const [condition, setCondition] = useState('')
  const [vegType, setVegType] = useState('veg')  // 'veg' or 'non-veg'

  const fetchDiets = useCallback(async () => {
    try {
      const data = await API.getDiets(selectedPatientId)
      setDietsHistory(data)
      if (data.length > 0) {
        setActivePlan(data[0].plan)
      } else {
        setActivePlan(null)
      }
    } catch {
      onToast('Failed to fetch diet plans history', 'error')
    }
  }, [selectedPatientId, onToast])

  // Load patients if doctor (re-fetch when registry changes elsewhere)
  useEffect(() => {
    if (isDoctor) {
      const fetchPatients = async () => {
        try {
          const list = await API.getPatients()
          setPatients(list)
          if (list.length === 0) {
            setSelectedPatientId('')
            setDietsHistory([])
            setActivePlan(null)
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

  // Load diets history when patient selection changes
  useEffect(() => {
    if (selectedPatientId) {
      fetchDiets()
    }
  }, [selectedPatientId, fetchDiets])

  const handleGenerateDiet = async (e) => {
    e.preventDefault()
    if (!selectedPatientId) {
      onToast('No patient selected', 'error')
      return
    }
    if (!condition) {
      onToast('Please select a clinical condition', 'error')
      return
    }

    setGenerating(true)
    try {
      const result = await API.generateDiet(selectedPatientId, condition, vegType)
      if (result.success) {
        onToast(`${vegType === 'veg' ? '🥬 Vegetarian' : '🍗 Non-Vegetarian'} diet plan generated!`, 'success')
        fetchDiets()
        setCondition('')
      } else {
        onToast('Failed to generate diet plan', 'error')
      }
    } catch {
      onToast('Error generating diet plan', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const selectedConditionInfo = CONDITIONS.find(c => c.name === condition)

  if (!isDoctor && user?.role === 'patient' && accountApprovalGate(user) === 'pending') {
    return (
      <div className="diet-plan-container" style={{ padding: 24 }}>
        <PendingApprovalCard />
      </div>
    )
  }

  if (!isDoctor && user?.role === 'patient' && accountApprovalGate(user) === 'rejected') {
    return (
      <div className="diet-plan-container" style={{ padding: 24 }}>
        <RejectedAccountCard />
      </div>
    )
  }

  return (
    <div className="diet-plan-container">
      {isDoctor && (
        <div className="patient-selector-card card">
          <label htmlFor="patient-diet-select">🔎 Select Patient for Diet Plan:</label>
          <select 
            id="patient-diet-select" 
            value={selectedPatientId} 
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="patient-dropdown"
          >
            <option value="" disabled>-- Choose a patient --</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (Age: {p.age}, Symptoms: {p.symptoms})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedPatientId ? (
        <div className="diet-layout">
          {/* ── Main Plan Display ── */}
          <div className="diet-display-section">
            {activePlan ? (
              <div className="active-diet-plan">
                {/* Header Card */}
                <div className="diet-header-card card">
                  <div className="plan-meta-badge">
                    {activePlan.veg_type === 'non-veg' ? '🍗 Non-Vegetarian' : '🥬 Vegetarian'} Diet Plan
                  </div>
                  <h2>Personalized Nutrition & Diet Protocol</h2>
                  <p className="clinical-ref"><strong>Medical Reference:</strong> {activePlan.medical_reference || 'N/A'}</p>
                  
                  {/* Macros breakdown */}
                  {activePlan.macros && (
                    <div className="macros-strip">
                      <div className="macro-chip cal">
                        <span className="macro-lbl">Calories</span>
                        <strong className="macro-val">{activePlan.macros.calories} kcal</strong>
                      </div>
                      <div className="macro-chip pro">
                        <span className="macro-lbl">Protein</span>
                        <strong className="macro-val">{activePlan.macros.protein}</strong>
                      </div>
                      <div className="macro-chip carb">
                        <span className="macro-lbl">Carbohydrates</span>
                        <strong className="macro-val">{activePlan.macros.carbs}</strong>
                      </div>
                      <div className="macro-chip fat">
                        <span className="macro-lbl">Fats</span>
                        <strong className="macro-val">{activePlan.macros.fats}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Meals Grid */}
                <div className="meals-grid">
                  <div className="meal-card card">
                    <div className="meal-title-bar">
                      <span className="meal-icon">🍳</span>
                      <h3>Breakfast</h3>
                    </div>
                    <p className="meal-content">{activePlan.breakfast}</p>
                  </div>

                  <div className="meal-card card">
                    <div className="meal-title-bar">
                      <span className="meal-icon">🍎</span>
                      <h3>Mid-Morning Snack</h3>
                    </div>
                    <p className="meal-content">{activePlan.mid_morning}</p>
                  </div>

                  <div className="meal-card card">
                    <div className="meal-title-bar">
                      <span className="meal-icon">🥗</span>
                      <h3>Lunch</h3>
                    </div>
                    <p className="meal-content">{activePlan.lunch}</p>
                  </div>

                  <div className="meal-card card">
                    <div className="meal-title-bar">
                      <span className="meal-icon">🍵</span>
                      <h3>Evening Snack</h3>
                    </div>
                    <p className="meal-content">{activePlan.evening}</p>
                  </div>

                  <div className="meal-card card double-width">
                    <div className="meal-title-bar">
                      <span className="meal-icon">🍲</span>
                      <h3>Dinner</h3>
                    </div>
                    <p className="meal-content">{activePlan.dinner}</p>
                  </div>
                </div>

                {/* Treatment Protocol Section */}
                {activePlan.treatment && (
                  <div className="treatment-card card">
                    <h3>💊 Treatment Protocol & Medical Guidance</h3>
                    <div className="treatment-grid">
                      {activePlan.treatment.medications && (
                        <div className="treatment-block">
                          <h4>💉 Medications</h4>
                          <ul>{activePlan.treatment.medications.map((m, i) => <li key={i}>{m}</li>)}</ul>
                        </div>
                      )}
                      {activePlan.treatment.lifestyle && (
                        <div className="treatment-block">
                          <h4>🏃‍♀️ Lifestyle Modifications</h4>
                          <ul>{activePlan.treatment.lifestyle.map((l, i) => <li key={i}>{l}</li>)}</ul>
                        </div>
                      )}
                      {activePlan.treatment.supplements && (
                        <div className="treatment-block">
                          <h4>💊 Supplements</h4>
                          <ul>{activePlan.treatment.supplements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      )}
                      {activePlan.treatment.monitoring && (
                        <div className="treatment-block">
                          <h4>📋 Monitoring & Follow-up</h4>
                          <ul>{activePlan.treatment.monitoring.map((m, i) => <li key={i}>{m}</li>)}</ul>
                        </div>
                      )}
                      {activePlan.treatment.specialist && (
                        <div className="treatment-specialist-badge">
                          🩺 Recommended Specialist: <strong>{activePlan.treatment.specialist}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rules & Guidelines */}
                {activePlan.rules && activePlan.rules.length > 0 && (
                  <div className="rules-card card">
                    <h3>⚠️ Crucial Guidelines & Lifestyle Rules</h3>
                    <ul className="diet-rules-list">
                      {activePlan.rules.map((rule, idx) => (
                        <li key={idx}><strong>Rule {idx+1}:</strong> {rule}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center card padding-lg">
                <h3>🥗 No Active Nutrition Program</h3>
                <p>Use the Diet Planner Agent on the right to compile a customized daily meal plan based on clinical symptoms.</p>
              </div>
            )}

            {/* Previously Generated Plans */}
            {dietsHistory.length > 1 && (
              <div className="diet-history-card card">
                <h3>Archived Diet Protocols</h3>
                <div className="history-list">
                  {dietsHistory.map((d) => (
                    <div 
                      key={d.id} 
                      className={`history-item ${activePlan === d.plan ? 'active-history' : ''}`}
                      onClick={() => setActivePlan(d.plan)}
                    >
                      <div className="history-meta">
                        <strong>{d.condition}</strong>
                        <span>{new Date(d.created_at).toLocaleDateString()}</span>
                      </div>
                      <button className="view-archived-btn">View Plan</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar Generator ── */}
          <div className="diet-generator-section">
            <div className="card diet-input-card">
              <h3>🧬 Diet Planner Agent</h3>
              <p>AI-powered personalized nutrition & treatment protocols for women's health conditions.</p>
              
              <form onSubmit={handleGenerateDiet} className="diet-form">
                {/* ── Veg / Non-Veg Toggle ── */}
                <div className="form-group">
                  <label>🥗 Diet Preference</label>
                  <div className="veg-toggle-group">
                    <button
                      type="button"
                      className={`veg-toggle-btn ${vegType === 'veg' ? 'active veg-active' : ''}`}
                      onClick={() => setVegType('veg')}
                      disabled={generating}
                    >
                      <span className="veg-toggle-icon">🥬</span>
                      Vegetarian
                    </button>
                    <button
                      type="button"
                      className={`veg-toggle-btn ${vegType === 'non-veg' ? 'active nonveg-active' : ''}`}
                      onClick={() => setVegType('non-veg')}
                      disabled={generating}
                    >
                      <span className="veg-toggle-icon">🍗</span>
                      Non-Vegetarian
                    </button>
                  </div>
                </div>

                {/* ── Condition Selection ── */}
                <div className="form-group">
                  <label>🏥 Clinical Condition</label>
                  <div className="condition-grid">
                    {CONDITIONS.map(c => (
                      <button
                        key={c.name}
                        type="button"
                        className={`condition-chip ${condition === c.name ? 'condition-active' : ''}`}
                        onClick={() => setCondition(c.name)}
                        disabled={generating}
                      >
                        <span className="chip-icon">{c.icon}</span>
                        <span className="chip-label">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Selected Condition Info ── */}
                {selectedConditionInfo && (
                  <div className="condition-info-badge">
                    <div className="cinfo-category">{selectedConditionInfo.category}</div>
                    <div className="cinfo-name">{selectedConditionInfo.icon} {selectedConditionInfo.name}</div>
                    <div className="cinfo-specialist">🩺 {selectedConditionInfo.specialist}</div>
                  </div>
                )}

                <button type="submit" className="submit-diet-btn" disabled={generating}>
                  {generating ? (
                    <>
                      <span className="spinner-inline"></span>
                      Generating {vegType === 'veg' ? 'Vegetarian' : 'Non-Veg'} Plan...
                    </>
                  ) : (
                    `Compile ${vegType === 'veg' ? '🥬 Vegetarian' : '🍗 Non-Veg'} Plan`
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center card padding-lg">
          <p>Please select a patient to view or generate a diet plan.</p>
        </div>
      )}
    </div>
  )
}
