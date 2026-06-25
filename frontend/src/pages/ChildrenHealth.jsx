import { useState, useEffect, useMemo } from 'react'
import { API } from '../api'
import {
  CHILD_DISEASE_CATEGORIES,
  CHILD_DISEASE_CATEGORY_PREFIX,
  isChildHealthProtocol,
} from '../data/childDiseases'

export default function ChildrenHealth({ onToast }) {
  const [protocols, setProtocols] = useState([])
  const [selectedProtocol, setSelectedProtocol] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('overview')

  const [ragQuery, setRagQuery] = useState('')
  const [ragAnswer, setRagAnswer] = useState('')
  const [ragCitations, setRagCitations] = useState([])
  const [ragLoading, setRagLoading] = useState(false)

  const protocolByName = useMemo(() => {
    const map = new Map()
    for (const p of protocols) {
      map.set(p.name.toLowerCase(), p)
    }
    return map
  }, [protocols])

  async function fetchProtocols() {
    setLoading(true)
    try {
      const data = await API.getProtocols()
      const child = data.filter((p) => isChildHealthProtocol(p.category))
      setProtocols(child)
      if (child.length > 0) {
        setSelectedProtocol(child[0])
      }
    } catch {
      onToast('Failed to load children disease protocols', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProtocols()
  }, [])

  const handleRagSearch = async (e) => {
    e.preventDefault()
    if (!ragQuery.trim()) return

    setRagLoading(true)
    try {
      const result = await API.ragQuery(ragQuery)
      setRagAnswer(result.answer)
      setRagCitations(result.citations || [])
    } catch {
      onToast('RAG assistant query failed', 'error')
    } finally {
      setRagLoading(false)
    }
  }

  const resolveProtocol = (diseaseName) => {
    const exact = protocolByName.get(diseaseName.toLowerCase())
    if (exact) return exact
    const partial = protocols.find(
      (p) =>
        p.name.toLowerCase().includes(diseaseName.toLowerCase()) ||
        diseaseName.toLowerCase().includes(p.name.toLowerCase())
    )
    return partial || null
  }

  const listItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const items = []

    for (const cat of CHILD_DISEASE_CATEGORIES) {
      if (categoryFilter !== 'all' && categoryFilter !== cat.id) continue

      for (const disease of cat.diseases) {
        if (q && !disease.toLowerCase().includes(q) && !cat.label.toLowerCase().includes(q)) {
          continue
        }
        items.push({
          key: `${cat.id}-${disease}`,
          disease,
          categoryLabel: cat.label,
          protocol: resolveProtocol(disease),
        })
      }
    }
    return items
  }, [searchQuery, categoryFilter, protocols, protocolByName])

  const selectDisease = (item) => {
    if (item.protocol) {
      setSelectedProtocol(item.protocol)
    } else {
      setSelectedProtocol({
        id: item.key,
        name: item.disease,
        category: `${CHILD_DISEASE_CATEGORY_PREFIX} ${item.categoryLabel}`,
        overview: `${item.disease} is listed under pediatric ${item.categoryLabel.toLowerCase()}. Detailed protocol data is being expanded — consult a pediatric specialist for individualized care.`,
        symptoms: 'Symptoms vary by age and severity. Watch for fever, breathing difficulty, dehydration, lethargy, rash, or pain — seek urgent care for red-flag signs.',
        treatment: 'Age-appropriate evaluation by a pediatrician or relevant subspecialist; supportive care and condition-specific therapy per national guidelines.',
        diet_notes: 'Maintain hydration, age-appropriate nutrition, and follow any allergen or therapeutic diet prescribed by your care team.',
        medications: 'Use only weight-based pediatric dosing under medical supervision.',
        lifestyle: 'Vaccination on schedule, hand hygiene, safe sleep for infants, and regular growth and development monitoring.',
        specialist: 'Pediatrician',
      })
    }
    setActiveTab('overview')
  }

  return (
    <div className="womens-health-container children-health-container">
      <div className="health-portal-grid">
        <div className="protocols-sidebar-card card">
          <div className="ch-category-filter">
            <label htmlFor="ch-category">Category</label>
            <select
              id="ch-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="protocol-search ch-category-select"
            >
              <option value="all">All categories (20)</option>
              {CHILD_DISEASE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="search-bar-wrapper">
            <span className="search-icon">🔎</span>
            <input
              type="text"
              placeholder="Search children's diseases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="protocol-search"
            />
          </div>

          <div className="protocol-list">
            {loading ? (
              <div className="text-center padding-sm">Loading protocols...</div>
            ) : listItems.length === 0 ? (
              <div className="text-center padding-sm">No diseases found.</div>
            ) : (
              listItems.map((item) => (
                <div
                  key={item.key}
                  className={`protocol-item-card ${
                    selectedProtocol?.name === item.disease ? 'active' : ''
                  }`}
                  onClick={() => selectDisease(item)}
                >
                  <span className="category-tag">{item.categoryLabel}</span>
                  <h4>{item.disease}</h4>
                  {item.protocol ? (
                    <p className="specialist-short">🩺 {item.protocol.specialist}</p>
                  ) : (
                    <p className="specialist-short ch-pending-tag">Guideline summary</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="protocol-details-section">
          {selectedProtocol ? (
            <div className="detail-view-container">
              <div className="protocol-main-header card">
                <span className="detail-cat">{selectedProtocol.category}</span>
                <h2>{selectedProtocol.name}</h2>
                <div className="specialist-banner">
                  <span>Primary Specialist Team:</span>
                  <strong>{selectedProtocol.specialist}</strong>
                </div>
              </div>

              <div className="protocol-tabs">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  📖 Clinical Overview
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'symptoms' ? 'active' : ''}`}
                  onClick={() => setActiveTab('symptoms')}
                >
                  ⚠️ Symptoms & Risks
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'treatment' ? 'active' : ''}`}
                  onClick={() => setActiveTab('treatment')}
                >
                  💊 Treatments & Meds
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'lifestyle' ? 'active' : ''}`}
                  onClick={() => setActiveTab('lifestyle')}
                >
                  🥗 Diet & Lifestyle
                </button>
              </div>

              <div className="tab-content-panel card">
                {activeTab === 'overview' && (
                  <div className="tab-pane">
                    <h3>Condition Overview</h3>
                    <p className="paragraph-lead">{selectedProtocol.overview}</p>
                  </div>
                )}

                {activeTab === 'symptoms' && (
                  <div className="tab-pane">
                    <h3>Recognized Symptoms & Diagnostic Indicators</h3>
                    <p className="symptoms-list-text">{selectedProtocol.symptoms}</p>
                  </div>
                )}

                {activeTab === 'treatment' && (
                  <div className="tab-pane">
                    <div className="treatment-block">
                      <h3>Standard Clinical Treatment Protocols</h3>
                      <p className="txt-block">{selectedProtocol.treatment}</p>
                    </div>

                    <div className="medication-block">
                      <h3>Recommended Medications & Dosages</h3>
                      <div className="med-box">
                        <p>{selectedProtocol.medications}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'lifestyle' && (
                  <div className="tab-pane">
                    <div className="diet-block">
                      <h3>Dietary Guidelines & Nutrition</h3>
                      <p className="txt-block">{selectedProtocol.diet_notes}</p>
                    </div>

                    <div className="lifestyle-block">
                      <h3>Lifestyle Modifications & Self Care</h3>
                      <p className="txt-block">{selectedProtocol.lifestyle}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center card padding-lg">
              <p>Select a childhood disease from the list to view details.</p>
            </div>
          )}

          <div className="card rag-portal-widget">
            <h3>🤖 RAG Assistant (Pediatric Health)</h3>
            <p>
              Ask about childhood illnesses, vaccination timing, fever management, or when to seek
              emergency pediatric care.
            </p>

            <form onSubmit={handleRagSearch} className="rag-widget-form">
              <input
                type="text"
                placeholder="Ask e.g. When should I take my child to ER for fever?"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                className="rag-widget-input"
                disabled={ragLoading}
              />
              <button type="submit" className="rag-widget-btn" disabled={ragLoading}>
                {ragLoading ? 'Searching...' : 'Ask RAG'}
              </button>
            </form>

            {ragAnswer && (
              <div className="rag-widget-response">
                <div className="response-box">
                  <strong>Answer:</strong>
                  <p>{ragAnswer}</p>
                </div>
                {ragCitations.length > 0 && (
                  <div className="citations-box">
                    <span>Citations:</span>
                    <ul>
                      {ragCitations.map((c, idx) => (
                        <li key={idx}>
                          <strong>{c.source}</strong> (Relevance: {c.relevance})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
