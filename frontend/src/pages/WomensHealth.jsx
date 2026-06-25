import { useState, useEffect } from 'react'
import { API } from '../api'

export default function WomensHealth({ onToast }) {
  const [protocols, setProtocols] = useState([])
  const [selectedProtocol, setSelectedProtocol] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  // RAG assistant inside the portal
  const [ragQuery, setRagQuery] = useState('')
  const [ragAnswer, setRagAnswer] = useState('')
  const [ragCitations, setRagCitations] = useState([])
  const [ragLoading, setRagLoading] = useState(false)

  async function fetchProtocols() {
    setLoading(true)
    try {
      const data = await API.getProtocols()
      setProtocols(data)
      if (data.length > 0) {
        setSelectedProtocol(data[0])
      }
    } catch {
      onToast('Failed to load disease protocols', 'error')
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

  const filteredProtocols = protocols.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="womens-health-container">
      <div className="health-portal-grid">
        {/* Left Side: Navigation / List */}
        <div className="protocols-sidebar-card card">
          <div className="search-bar-wrapper">
            <span className="search-icon">🔎</span>
            <input 
              type="text" 
              placeholder="Search diseases or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="protocol-search"
            />
          </div>

          <div className="protocol-list">
            {loading ? (
              <div className="text-center padding-sm">Loading protocols...</div>
            ) : filteredProtocols.length === 0 ? (
              <div className="text-center padding-sm">No protocols found.</div>
            ) : (
              filteredProtocols.map(p => (
                <div 
                  key={p.id}
                  className={`protocol-item-card ${selectedProtocol?.id === p.id ? 'active' : ''}`}
                  onClick={() => { setSelectedProtocol(p); setActiveTab('overview') }}
                >
                  <span className="category-tag">{p.category}</span>
                  <h4>{p.name}</h4>
                  <p className="specialist-short">🩺 {p.specialist}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Details View */}
        <div className="protocol-details-section">
          {selectedProtocol ? (
            <div className="detail-view-container">
              {/* Profile Card */}
              <div className="protocol-main-header card">
                <span className="detail-cat">{selectedProtocol.category}</span>
                <h2>{selectedProtocol.name}</h2>
                <div className="specialist-banner">
                  <span>Primary Specialist Team:</span>
                  <strong>{selectedProtocol.specialist}</strong>
                </div>
              </div>

              {/* Tabs Nav */}
              <div className="protocol-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  📖 Clinical Overview
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'symptoms' ? 'active' : ''}`}
                  onClick={() => setActiveTab('symptoms')}
                >
                  ⚠️ Symptoms & Risks
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'treatment' ? 'active' : ''}`}
                  onClick={() => setActiveTab('treatment')}
                >
                  💊 Treatments & Meds
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'lifestyle' ? 'active' : ''}`}
                  onClick={() => setActiveTab('lifestyle')}
                >
                  🥗 Diet & Lifestyle
                </button>
              </div>

              {/* Tab Contents */}
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
              <p>Select a disease protocol from the left to view details.</p>
            </div>
          )}

          {/* RAG Assistant Widget for Women's Health */}
          <div className="card rag-portal-widget">
            <h3>🤖 RAG Assistant (Women's Health Specialist)</h3>
            <p>Ask our local RAG assistant questions about female health disorders, medical guidelines, or wellness plans.</p>
            
            <form onSubmit={handleRagSearch} className="rag-widget-form">
              <input 
                type="text" 
                placeholder="Ask e.g. What is the diet plan for PCOS or PCOD?"
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
