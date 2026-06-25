import { useState, useMemo } from 'react'

import { API } from '../api'
import { accountApprovalGate, PendingApprovalCard, RejectedAccountCard } from '../accountAccessGates.jsx'
import HOSPITALS_DB from '../data/hospitals.json'
import { HOSPITAL_DEPARTMENT_GROUPS, getDoctorsForDepartment } from '../data/hospitalDepartments.js'
import BookAppointmentFlow from '../components/BookAppointmentFlow.jsx'
import { LOGOS } from '../data/logos'

const POPULAR_CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad']

/* ── Medical Tests Catalog ── */
const TEST_CATEGORIES = [
  {
    category: "Blood Tests",
    icon: "🩸",
    color: "#ef4444",
    tests: [
      { name: "Complete Blood Count (CBC)", price: 350, duration: "2-4 hrs", fasting: false, description: "Measures RBC, WBC, platelets, hemoglobin levels" },
      { name: "Blood Glucose (Fasting)", price: 150, duration: "2-3 hrs", fasting: true, description: "Measures blood sugar after 8-12 hr fasting" },
      { name: "HbA1c (Glycated Hemoglobin)", price: 550, duration: "4-6 hrs", fasting: false, description: "3-month average blood sugar indicator" },
      { name: "Lipid Profile", price: 600, duration: "4-6 hrs", fasting: true, description: "Total cholesterol, LDL, HDL, triglycerides" },
      { name: "Liver Function Test (LFT)", price: 700, duration: "6-8 hrs", fasting: false, description: "AST, ALT, bilirubin, albumin, ALP levels" },
      { name: "Kidney Function Test (KFT)", price: 650, duration: "6-8 hrs", fasting: false, description: "Creatinine, BUN, uric acid, electrolytes" },
      { name: "Thyroid Profile (T3, T4, TSH)", price: 800, duration: "6-8 hrs", fasting: false, description: "Free T3, Free T4, and TSH levels" },
      { name: "Vitamin D (25-OH)", price: 900, duration: "24 hrs", fasting: false, description: "Measures Vitamin D3 levels in blood" },
      { name: "Vitamin B12", price: 750, duration: "24 hrs", fasting: false, description: "Measures B12 for nerve and blood health" },
      { name: "Iron Studies (Ferritin + TIBC)", price: 850, duration: "6-8 hrs", fasting: true, description: "Serum iron, ferritin, TIBC for anemia diagnosis" },
    ]
  },
  {
    category: "Full Body Checkups",
    icon: "🏥",
    color: "#3b82f6",
    tests: [
      { name: "Basic Health Checkup", price: 1499, duration: "1 day", fasting: true, description: "CBC, blood sugar, lipid, LFT, KFT, urine routine" },
      { name: "Comprehensive Health Checkup", price: 3499, duration: "1 day", fasting: true, description: "60+ parameters: blood, liver, kidney, thyroid, vitamin, cardiac markers" },
      { name: "Premium Full Body Checkup", price: 5999, duration: "1-2 days", fasting: true, description: "80+ tests including tumor markers, hormones, ECG, X-Ray" },
      { name: "Executive Health Checkup", price: 8999, duration: "1-2 days", fasting: true, description: "100+ tests, doctor consultation, ultrasound, ECG, stress test" },
      { name: "Senior Citizen Health Package", price: 4999, duration: "1 day", fasting: true, description: "Bone density, cardiac, diabetes, kidney, prostate/breast markers" },
    ]
  },
  {
    category: "Women's Health Tests",
    icon: "♀️",
    color: "#ec4899",
    tests: [
      { name: "PCOD/PCOS Profile", price: 2200, duration: "1 day", fasting: true, description: "LH, FSH, testosterone, insulin, DHEA-S, AMH" },
      { name: "Thyroid Complete Panel", price: 1200, duration: "6-8 hrs", fasting: false, description: "T3, T4, TSH, Anti-TPO, Anti-TG antibodies" },
      { name: "Pap Smear (Cervical Screening)", price: 800, duration: "3-5 days", fasting: false, description: "Screens for cervical cancer and HPV changes" },
      { name: "Mammography", price: 2500, duration: "Same day", fasting: false, description: "Breast cancer screening X-ray imaging" },
      { name: "Bone Density (DXA) Scan", price: 3000, duration: "Same day", fasting: false, description: "Measures bone mineral density for osteoporosis" },
      { name: "Fertility Panel (Female)", price: 3500, duration: "1 day", fasting: true, description: "AMH, FSH, LH, Estradiol, Prolactin, Progesterone" },
      { name: "Prenatal Screening Package", price: 4500, duration: "1-2 days", fasting: true, description: "CBC, blood group, HIV, Hepatitis B/C, TORCH, glucose" },
    ]
  },
  {
    category: "Cardiac Tests",
    icon: "❤️",
    color: "#f59e0b",
    tests: [
      { name: "ECG (Electrocardiogram)", price: 300, duration: "15 min", fasting: false, description: "Records heart's electrical activity" },
      { name: "2D Echocardiography", price: 2500, duration: "30-45 min", fasting: false, description: "Ultrasound imaging of heart chambers and valves" },
      { name: "Treadmill Stress Test (TMT)", price: 2000, duration: "1 hr", fasting: false, description: "Heart performance under physical stress" },
      { name: "Cardiac Markers (Troponin + BNP)", price: 1500, duration: "4-6 hrs", fasting: false, description: "Detects heart attack or heart failure markers" },
      { name: "Coronary Calcium Score (CT)", price: 5000, duration: "30 min", fasting: false, description: "CT scan to measure calcium in coronary arteries" },
    ]
  },
  {
    category: "Imaging & Scans",
    icon: "📷",
    color: "#8b5cf6",
    tests: [
      { name: "Chest X-Ray", price: 400, duration: "15 min", fasting: false, description: "Standard PA view chest radiograph" },
      { name: "Ultrasound Abdomen (Complete)", price: 1200, duration: "30 min", fasting: true, description: "Liver, kidney, spleen, gallbladder, pancreas imaging" },
      { name: "MRI Brain", price: 6000, duration: "45-60 min", fasting: false, description: "Detailed brain imaging without radiation" },
      { name: "CT Scan (Abdomen/Chest)", price: 5000, duration: "30 min", fasting: false, description: "Cross-sectional imaging of internal organs" },
      { name: "Pelvic Ultrasound", price: 1500, duration: "30 min", fasting: false, description: "Uterus, ovaries, bladder imaging for women" },
    ]
  },
  {
    category: "Hormone & Allergy",
    icon: "🧪",
    color: "#10b981",
    tests: [
      { name: "Complete Hormone Panel", price: 3500, duration: "1 day", fasting: true, description: "Thyroid, cortisol, insulin, testosterone, estrogen" },
      { name: "Allergy Panel (30 Allergens)", price: 4000, duration: "2-3 days", fasting: false, description: "IgE levels for food, dust, pollen, pet allergens" },
      { name: "Cortisol (Morning)", price: 500, duration: "6-8 hrs", fasting: true, description: "Measures stress hormone levels" },
      { name: "Insulin (Fasting)", price: 600, duration: "4-6 hrs", fasting: true, description: "Measures insulin resistance and levels" },
      { name: "Prolactin", price: 550, duration: "6-8 hrs", fasting: false, description: "Pituitary hormone linked to fertility" },
    ]
  }
]


export default function HospitalsTests({ user, onToast, onRecordsMutated }) {
  const [activeTab, setActiveTab] = useState('hospitals')
  
  // ── Hospital State ──
  const [cityInput, setCityInput] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedHospital, setSelectedHospital] = useState(null)

  // ── Tests State ──
  const [testSearch, setTestSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [cart, setCart] = useState([])
  const [showBooking, setShowBooking] = useState(false)
  const [bookingForm, setBookingForm] = useState({ name: user?.full_name || '', phone: '', date: '', time: '09:00', hospital: '', payment_method: 'upi', payment_provider: 'phonepe' })
  const [deptAppt, setDeptAppt] = useState(null)

  // ── Hospital Logic ──
  const handleCitySearch = () => {
    const city = cityInput.trim().toLowerCase()
    if (HOSPITALS_DB[city]) {
      setSelectedCity(city)
      setSelectedHospital(null)
      onToast(`Found ${HOSPITALS_DB[city].length} hospitals in ${cityInput}`, 'success')
    } else {
      onToast(`No hospitals data for "${cityInput}". We currently support 100+ cities in India.`, 'error')
    }
  }

  const filteredHospitals = useMemo(() => {
    if (!selectedCity) return []
    const list = HOSPITALS_DB[selectedCity] || []
    if (filterType === 'all') return list
    return list.filter(h => h.type.toLowerCase() === filterType)
  }, [selectedCity, filterType])

  const selectHospitalAndOpenServices = (h) => {
    setSelectedHospital(h)
    setActiveTab('departments')
  }

  const mapSrc = useMemo(() => {
    if (selectedHospital) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=${selectedHospital.lng - 0.01},${selectedHospital.lat - 0.008},${selectedHospital.lng + 0.01},${selectedHospital.lat + 0.008}&layer=mapnik&marker=${selectedHospital.lat},${selectedHospital.lng}`
    }
    if (selectedCity) {
      const hospitals = HOSPITALS_DB[selectedCity]
      if (hospitals && hospitals.length > 0) {
        const avgLat = hospitals.reduce((s, h) => s + h.lat, 0) / hospitals.length
        const avgLng = hospitals.reduce((s, h) => s + h.lng, 0) / hospitals.length
        return `https://www.openstreetmap.org/export/embed.html?bbox=${avgLng - 0.08},${avgLat - 0.05},${avgLng + 0.08},${avgLat + 0.05}&layer=mapnik`
      }
    }
    return null
  }, [selectedCity, selectedHospital])

  // ── Tests Logic ──
  const filteredTests = useMemo(() => {
    if (!testSearch && !selectedCategory) return TEST_CATEGORIES
    return TEST_CATEGORIES.map(cat => {
      if (selectedCategory && cat.category !== selectedCategory) return null
      const filtered = cat.tests.filter(t =>
        t.name.toLowerCase().includes(testSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(testSearch.toLowerCase())
      )
      if (filtered.length === 0) return null
      return { ...cat, tests: filtered }
    }).filter(Boolean)
  }, [testSearch, selectedCategory])

  const addToCart = (test) => {
    if (cart.find(t => t.name === test.name)) {
      onToast('Test already added', 'info')
      return
    }
    setCart([...cart, test])
    onToast(`✅ ${test.name} added to cart`, 'success')
  }

  const removeFromCart = (testName) => {
    setCart(cart.filter(t => t.name !== testName))
  }

  const totalPrice = cart.reduce((s, t) => s + t.price, 0)

  const handleBookSubmit = async (e) => {
    e.preventDefault()
    if (!bookingForm.name || !bookingForm.phone || !bookingForm.date) {
      onToast('Please fill all required fields', 'error')
      return
    }
    if (cart.length === 0) {
      onToast('Add at least one test to the cart', 'error')
      return
    }
    const pid = user?.patient_id != null ? Number(user.patient_id) : null
    if (pid != null && Number.isFinite(pid) && pid > 0) {
      try {
        const slotIso = `${bookingForm.date}T${(bookingForm.time || '09:00').length === 5 ? bookingForm.time : '09:00'}:00`
        const title =
          cart.length === 1
            ? cart[0].name
            : `Lab bundle (${cart.length} tests) — ${cart
                .slice(0, 2)
                .map((t) => t.name)
                .join(', ')}${cart.length > 2 ? '…' : ''}`
        await API.createTestReport(pid, {
          title,
          lab_name: bookingForm.hospital || selectedHospital?.name || 'Curiva partner lab',
          items: cart.map((t) => t.name),
          scheduled_at: slotIso,
          status: 'Scheduled',
          result_summary: `Booked via Curiva (demo). Total ₹${totalPrice}. Payment: ${bookingForm.payment_method || 'upi'}. Reports will appear here after processing.`,
        })
        onToast(`🎉 ${cart.length} test(s) booked — saved to My records for ₹${totalPrice}`, 'success')
        onRecordsMutated?.()
      } catch (err) {
        onToast(err?.message || 'Could not save booking to your records', 'error')
        return
      }
    } else {
      onToast(
        `🎉 ${cart.length} test(s) booked for ₹${totalPrice} on ${bookingForm.date}! (Demo only — link a patient portal account to save bookings under My records.)`,
        'success',
      )
    }
    setCart([])
    setShowBooking(false)
    setBookingForm({
      name: user?.full_name || '',
      phone: '',
      date: '',
      time: '09:00',
      hospital: '',
      payment_method: 'upi',
      payment_provider: 'phonepe',
    })
  }

  if (user?.role === 'patient' && accountApprovalGate(user) === 'pending') {
    return (
      <div className="hosp-tests-container" style={{ padding: 24 }}>
        <PendingApprovalCard />
      </div>
    )
  }

  if (user?.role === 'patient' && accountApprovalGate(user) === 'rejected') {
    return (
      <div className="hosp-tests-container" style={{ padding: 24 }}>
        <RejectedAccountCard />
      </div>
    )
  }

  return (
    <div className="hosp-tests-container">
      {/* ── Tab Switcher ── */}
      <div className="ht-tabs">
        <button className={`ht-tab ${activeTab === 'hospitals' ? 'ht-tab-active' : ''}`} onClick={() => setActiveTab('hospitals')}>
          <span className="ht-tab-icon">🏥</span> Nearby Hospitals
        </button>
        <button className={`ht-tab ${activeTab === 'tests' ? 'ht-tab-active' : ''}`} onClick={() => setActiveTab('tests')}>
          <span className="ht-tab-icon">🧪</span> Book Medical Tests
        </button>
        <button
          type="button"
          className={`ht-tab ${activeTab === 'departments' ? 'ht-tab-active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          <span className="ht-tab-icon">📋</span> Departments &amp; services
        </button>
        {cart.length > 0 && (
          <div className="ht-cart-badge" onClick={() => { setActiveTab('tests'); setShowBooking(true) }}>
            🛒 {cart.length} Test{cart.length > 1 ? 's' : ''} · ₹{totalPrice}
          </div>
        )}
      </div>

      {/* ═══════════════ HOSPITALS TAB ═══════════════ */}
      {activeTab === 'hospitals' && (
        <div className="hospitals-section">
          {/* City Search */}
          <div className="city-search-card card">
            <h3>🔍 Find Best Hospitals in Your City</h3>
            <div className="city-search-row">
              <input
                type="text"
                placeholder="Enter city name (e.g. Delhi, Mumbai, Bangalore...)"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCitySearch()}
                className="city-input"
              />
              <button className="city-search-btn" onClick={handleCitySearch}>Search Hospitals</button>
            </div>
            <div className="city-chips">
              <span className="city-chips-label">Popular:</span>
              {POPULAR_CITIES.map(c => (
                <button key={c} className={`city-chip ${selectedCity === c.toLowerCase() ? 'city-chip-active' : ''}`}
                  onClick={() => { setCityInput(c); setSelectedCity(c.toLowerCase()); setSelectedHospital(null) }}>
                  {c}
                </button>
              ))}
              <span className="city-chips-label" style={{marginLeft: '8px', fontStyle: 'italic', color: 'var(--text-muted)'}}>
                + 94 more cities supported. Try searching!
              </span>
            </div>
          </div>

          {selectedCity && (
            <div className="hosp-layout">
              {/* Hospital List */}
              <div className="hosp-list-section">
                <div className="hosp-list-header">
                  <h3>🏥 Hospitals in {selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1)} ({filteredHospitals.length})</h3>
                  <div className="hosp-filter-group">
                    <button className={`hosp-filter-btn ${filterType === 'all' ? 'hf-active' : ''}`} onClick={() => setFilterType('all')}>All</button>
                    <button className={`hosp-filter-btn ${filterType === 'government' ? 'hf-active' : ''}`} onClick={() => setFilterType('government')}>Government</button>
                    <button className={`hosp-filter-btn ${filterType === 'private' ? 'hf-active' : ''}`} onClick={() => setFilterType('private')}>Private</button>
                  </div>
                </div>

                <div className="hosp-list">
                  {filteredHospitals.map((h, idx) => (
                    <div key={idx} className={`hosp-card card ${selectedHospital === h ? 'hosp-card-selected' : ''}`}
                      onClick={() => selectHospitalAndOpenServices(h)}>
                      <div className="hosp-card-top">
                        <div className="hosp-name-block">
                          <h4>{h.name}</h4>
                          <span className={`hosp-type-badge ${h.type.toLowerCase()}`}>{h.type}</span>
                        </div>
                        <div className="hosp-rating">
                          ⭐ {h.rating}
                        </div>
                      </div>
                      <p className="hosp-speciality">🩺 {h.speciality}</p>
                      <div className="hosp-meta-row">
                        <span>📍 {h.address}</span>
                      </div>
                      <div className="hosp-meta-row">
                        <span>📞 {h.phone}</span>
                        <span>🛏️ {h.beds} Beds</span>
                        {h.emergency && <span className="hosp-emergency-badge">🚑 24/7 ER</span>}
                      </div>
                      <button type="button" className="hosp-view-map-btn" onClick={(e) => { e.stopPropagation(); selectHospitalAndOpenServices(h) }}>
                        📌 View on Map
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map Section */}
              <div className="hosp-map-section">
                <div className="map-card card">
                  <div className="map-header">
                    <h3>📍 {selectedHospital ? selectedHospital.name : `${selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1)} Overview`}</h3>
                    {selectedHospital && (
                      <button className="map-clear-btn" onClick={() => setSelectedHospital(null)}>Show All</button>
                    )}
                  </div>
                  {mapSrc ? (
                    <iframe
                      className="map-iframe"
                      src={mapSrc}
                      title="Hospital Map"
                      loading="lazy"
                    />
                  ) : (
                    <div className="map-placeholder">
                      <span>🗺️</span>
                      <p>Select a city to view hospitals on the map</p>
                    </div>
                  )}
                  {selectedHospital && (
                    <div className="map-detail-strip">
                      <div className="map-detail-item">
                        <strong>📍 Address</strong>
                        <span>{selectedHospital.address}</span>
                      </div>
                      <div className="map-detail-item">
                        <strong>📞 Contact</strong>
                        <span>{selectedHospital.phone}</span>
                      </div>
                      <div className="map-detail-item">
                        <strong>🩺 Speciality</strong>
                        <span>{selectedHospital.speciality}</span>
                      </div>
                      <a className="map-directions-btn"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedHospital.lat},${selectedHospital.lng}`}
                        target="_blank" rel="noopener noreferrer">
                        🧭 Get Directions
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TESTS TAB ═══════════════ */}
      {activeTab === 'tests' && (
        <div className="tests-section">
          {/* Search & Categories */}
          <div className="tests-toolbar card">
            <div className="tests-search-row">
              <input
                type="text"
                placeholder="Search tests... (e.g. CBC, thyroid, MRI)"
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                className="tests-search-input"
              />
            </div>
            <div className="test-category-chips">
              <button className={`tcat-chip ${!selectedCategory ? 'tcat-active' : ''}`}
                onClick={() => setSelectedCategory(null)}>All Categories</button>
              {TEST_CATEGORIES.map(cat => (
                <button key={cat.category}
                  className={`tcat-chip ${selectedCategory === cat.category ? 'tcat-active' : ''}`}
                  style={selectedCategory === cat.category ? { borderColor: cat.color, color: cat.color } : {}}
                  onClick={() => setSelectedCategory(selectedCategory === cat.category ? null : cat.category)}>
                  {cat.icon} {cat.category}
                </button>
              ))}
            </div>
          </div>

          <div className="tests-layout">
            {/* Test List */}
            <div className="tests-list-area">
              {filteredTests.map(cat => (
                <div key={cat.category} className="test-category-block">
                  <div className="tcat-header" style={{ borderLeftColor: cat.color }}>
                    <span className="tcat-icon">{cat.icon}</span>
                    <h3>{cat.category}</h3>
                    <span className="tcat-count">{cat.tests.length} test{cat.tests.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="test-items-grid">
                    {cat.tests.map(test => {
                      const inCart = cart.find(t => t.name === test.name)
                      return (
                        <div key={test.name} className={`test-item-card card ${inCart ? 'test-in-cart' : ''}`}>
                          <div className="test-item-top">
                            <h4>{test.name}</h4>
                            <div className="test-price">₹{test.price}</div>
                          </div>
                          <p className="test-desc">{test.description}</p>
                          <div className="test-meta">
                            <span className="test-meta-tag">⏱️ {test.duration}</span>
                            {test.fasting && <span className="test-meta-tag fasting-tag">🍽️ Fasting Required</span>}
                          </div>
                          <button
                            className={`test-add-btn ${inCart ? 'test-added' : ''}`}
                            onClick={() => inCart ? removeFromCart(test.name) : addToCart(test)}
                          >
                            {inCart ? '✓ Added — Remove' : '+ Add to Cart'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Sidebar */}
            <div className="tests-cart-sidebar">
              <div className="cart-card card">
                <h3>🛒 Your Test Cart</h3>
                {cart.length === 0 ? (
                  <div className="cart-empty">
                    <span>🧪</span>
                    <p>No tests selected yet.<br />Browse categories and add tests.</p>
                  </div>
                ) : (
                  <>
                    <div className="cart-items">
                      {cart.map(t => (
                        <div key={t.name} className="cart-item">
                          <div className="cart-item-info">
                            <strong>{t.name}</strong>
                            <span>₹{t.price}</span>
                          </div>
                          <button className="cart-remove-btn" onClick={() => removeFromCart(t.name)}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="cart-total">
                      <span>Total ({cart.length} test{cart.length > 1 ? 's' : ''})</span>
                      <strong>₹{totalPrice}</strong>
                    </div>
                    <button className="cart-book-btn" onClick={() => setShowBooking(true)}>
                      📅 Book Appointment
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Booking Modal */}
          {showBooking && (
            <div className="booking-overlay" onClick={() => setShowBooking(false)}>
              <div className="booking-modal card" onClick={(e) => e.stopPropagation()}>
                <div className="booking-modal-header">
                  <h3>📅 Book Test Appointment</h3>
                  <button className="booking-close-btn" onClick={() => setShowBooking(false)}>✕</button>
                </div>
                <div className="booking-summary">
                  <strong>{cart.length} Test{cart.length > 1 ? 's' : ''} Selected</strong>
                  <span className="booking-total">Total: ₹{totalPrice}</span>
                </div>
                <div className="booking-tests-list">
                  {cart.map(t => (
                    <div key={t.name} className="booking-test-item">
                      <span>{t.name}</span>
                      <span>₹{t.price}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleBookSubmit} className="booking-form">
                  <div className="form-group">
                    <label>Patient Name *</label>
                    <input type="text" value={bookingForm.name}
                      onChange={(e) => setBookingForm({...bookingForm, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input type="tel" placeholder="+91 XXXXX XXXXX" value={bookingForm.phone}
                      onChange={(e) => setBookingForm({...bookingForm, phone: e.target.value})} required />
                  </div>
                  <div className="booking-datetime-row">
                    <div className="form-group">
                      <label>Preferred Date *</label>
                      <input type="date" value={bookingForm.date}
                        onChange={(e) => setBookingForm({...bookingForm, date: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Time Slot</label>
                      <select value={bookingForm.time}
                        onChange={(e) => setBookingForm({...bookingForm, time: e.target.value})}>
                        <option value="07:00">7:00 AM (Early)</option>
                        <option value="09:00">9:00 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="14:00">2:00 PM</option>
                        <option value="16:00">4:00 PM</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Preferred Hospital / Lab (Optional)</label>
                    <input type="text" placeholder="e.g. Apollo Hospital, SRL Diagnostics"
                      value={bookingForm.hospital}
                      onChange={(e) => setBookingForm({...bookingForm, hospital: e.target.value})} />
                  </div>
                  {cart.some(t => t.fasting) && (
                    <div className="booking-fasting-alert">
                      ⚠️ <strong>Fasting Required:</strong> Some tests require 8-12 hours of fasting before the appointment. Please do not eat or drink (except water) before your scheduled time.
                    </div>
                  )}

                  <div className="payment-section">
                    <h4>Payment Method</h4>
                    <div className="payment-tabs">
                      {['upi', 'card', 'netbanking'].map(method => (
                        <div 
                          key={method} 
                          className={`payment-tab ${bookingForm.payment_method === method ? 'payment-tab-active' : ''}`}
                          onClick={() => setBookingForm({...bookingForm, payment_method: method, payment_provider: method === 'upi' ? 'phonepe' : method === 'netbanking' ? 'sbi' : ''})}
                        >
                          {method === 'upi' ? 'UPI' : method === 'card' ? 'Credit/Debit Card' : 'Netbanking'}
                        </div>
                      ))}
                    </div>

                    {bookingForm.payment_method === 'upi' && (
                      <div className="payment-providers-grid">
                        {['phonepe', 'paytm', 'gpay', 'navi', 'bhim'].map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            className={`provider-card ${bookingForm.payment_provider === provider ? 'provider-card-active' : ''}`}
                            onClick={() => setBookingForm({ ...bookingForm, payment_provider: provider })}
                          >
                            <div className="provider-logo">{LOGOS[provider]}</div>
                            <span>
                              {provider === 'bhim'
                                ? 'BHIM UPI'
                                : provider === 'gpay'
                                  ? 'Google Pay'
                                  : provider.charAt(0).toUpperCase() + provider.slice(1)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {bookingForm.payment_method === 'netbanking' && (
                      <div className="payment-providers-grid">
                        {['sbi', 'hdfc', 'icici', 'axis', 'kotak'].map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            className={`provider-card ${bookingForm.payment_provider === provider ? 'provider-card-active' : ''}`}
                            onClick={() => setBookingForm({ ...bookingForm, payment_provider: provider })}
                          >
                            <div className="provider-logo">{LOGOS[provider]}</div>
                            <span>{provider.toUpperCase()}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {bookingForm.payment_method === 'card' && (
                      <div className="card-payment-form">
                        <input type="text" placeholder="Card Number (0000 0000 0000 0000)" className="card-input" required={bookingForm.payment_method === 'card'} />
                        <div className="card-row">
                          <input type="text" placeholder="MM/YY" className="card-input" required={bookingForm.payment_method === 'card'} />
                          <input type="text" placeholder="CVV" className="card-input" required={bookingForm.payment_method === 'card'} />
                        </div>
                        <input type="text" placeholder="Name on Card" className="card-input" required={bookingForm.payment_method === 'card'} />
                      </div>
                    )}
                  </div>
                  <button type="submit" className="booking-confirm-btn">
                    ✅ Confirm Booking · ₹{totalPrice}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ DEPARTMENTS & SERVICES TAB ═══════════════ */}
      {activeTab === 'departments' && (
        <div className="ht-departments-section">
          {!selectedHospital ? (
            <div className="ht-dept-empty card">
              <span className="ht-dept-empty-icon">🏥</span>
              <h3>Select a hospital first</h3>
              <p>
                Open <strong>Nearby Hospitals</strong>, choose your city, then click a hospital. You will land here with
                the full departments and services directory for that facility.
              </p>
              <button type="button" className="city-search-btn" onClick={() => setActiveTab('hospitals')}>
                Go to Nearby Hospitals
              </button>
            </div>
          ) : (
            <>
              <div className="ht-dept-hero card">
                <div className="ht-dept-hero-main">
                  <div className="ht-dept-hero-badge">{selectedHospital.type}</div>
                  <h2>{selectedHospital.name}</h2>
                  <p className="ht-dept-hero-meta">
                    <span>📍 {selectedHospital.address}</span>
                    <span>📞 {selectedHospital.phone}</span>
                    <span>🛏️ {selectedHospital.beds} beds</span>
                    {selectedHospital.emergency && <span className="hosp-emergency-badge">🚑 24/7 ER</span>}
                  </p>
                  <p className="ht-dept-hero-speciality"><strong>Lead speciality:</strong> {selectedHospital.speciality}</p>
                </div>
                <div className="ht-dept-hero-actions">
                  <button type="button" className="hosp-view-map-btn" onClick={() => setActiveTab('hospitals')}>
                    ← Back to hospital list
                  </button>
                  <a
                    className="map-directions-btn"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedHospital.lat},${selectedHospital.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🧭 Get directions
                  </a>
                </div>
              </div>

              <p className="ht-dept-intro">
                Departments and services typically available at this hospital (reference directory). Availability varies
                by location—confirm with the hospital directly for referrals and appointments.
              </p>

              <div className="ht-dept-groups">
                {HOSPITAL_DEPARTMENT_GROUPS.map((group) => (
                  <div key={group.title} className="ht-dept-group card">
                    <div className="ht-dept-group-head" style={{ borderLeftColor: group.color }}>
                      <span className="ht-dept-group-icon" aria-hidden>
                        {group.icon}
                      </span>
                      <h3>{group.title}</h3>
                    </div>
                    <div className="ht-dept-grid">
                      {group.departments.map((d) => {
                        const docs = getDoctorsForDepartment(d.name)
                        return (
                          <div key={d.name} className="ht-dept-card">
                            <h4>{d.name}</h4>
                            <p>{d.description}</p>
                            <div className="ht-dept-doctors">
                              <div className="ht-dept-doctors-label">Available team</div>
                              {docs.map((doc) => (
                                <div key={doc.id} className="ht-dept-doctor">
                                  <div className="ht-dept-doctor-info">
                                    <strong>{doc.name}</strong>
                                    <span className="ht-dept-doctor-role">{doc.role}</span>
                                    <span className="ht-dept-doctor-meta">
                                      {doc.qualifications} · {doc.experienceYears}+ yrs experience
                                    </span>
                                    <span className="ht-dept-doctor-slots">📅 {doc.availability}</span>
                                    <span className="ht-dept-doctor-focus">{doc.focus}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="ht-dept-appt-btn"
                                    onClick={() =>
                                      setDeptAppt({
                                        doctor: doc,
                                        departmentName: d.name,
                                      })
                                    }
                                  >
                                    Book appointment
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <BookAppointmentFlow
                open={Boolean(deptAppt && selectedHospital)}
                onClose={() => setDeptAppt(null)}
                doctor={deptAppt?.doctor}
                departmentName={deptAppt?.departmentName}
                hospital={selectedHospital}
                user={user}
                onToast={onToast}
                onRecordsMutated={onRecordsMutated}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
