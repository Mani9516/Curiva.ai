import { useState, useEffect } from 'react'
import { logoBase64 } from '../assets/logoData.js'
import { displayPersonName } from '../userDisplay'

export default function Sidebar({ activePage, setActivePage, alertCount, user, onLogout }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Dynamic Navigation Items based on Role
  const doctorNav = [
    { id: 'overview',       label: 'Command Center',      icon: '⚡', section: 'Dashboard' },
    { id: 'intake',         label: 'Patient Intake',      icon: '🏥', section: 'Agents' },
    { id: 'clinical',       label: 'Clinical Summarizer', icon: '🧬', section: 'Agents' },
    { id: 'imaging',        label: 'Imaging Workflow',    icon: '🔬', section: 'Agents' },
    { id: 'health-monitor', label: 'Health Monitor',      icon: '📈', section: 'Agents' },
    { id: 'diet-plans',     label: 'Diet Plans',          icon: '🥗', section: 'Agents' },
    { id: 'womens-health',  label: "Women's Health",      icon: '♀️', section: 'Clinical Protocols' },
    { id: 'children-health', label: "Children's Health", icon: '👶', section: 'Clinical Protocols' },
    { id: 'rag',            label: 'Ask Curiva AI',     icon: '💬', section: 'AI Tools' },
    { id: 'alerts',         label: 'Alerts Center',       icon: '🚨', section: 'Operations' },
    { id: 'patients',       label: 'Patient registry',    icon: '👤', section: 'Operations' },
    { id: 'user-mgmt',      label: 'Register staff',      icon: '➕', section: 'Clinic admin' },
  ]

  const patientNav = [
    { id: 'portal',         label: 'My Portal',           icon: '🏠', section: 'My Dashboard' },
    { id: 'rag',            label: 'Ask Curiva AI',     icon: '💬', section: 'My Dashboard' },
    { id: 'patient-records', label: 'My records',        icon: '📑', section: 'My Dashboard' },
    { id: 'order-scans',     label: 'Order scans & labs', icon: '🔬', section: 'My Dashboard' },
    { id: 'medications',    label: 'Medications',         icon: '💊', section: 'My Dashboard' },
    { id: 'health-monitor', label: 'My Vitals',           icon: '📈', section: 'My Records' },
    { id: 'diet-plans',     label: 'My Diet Plan',         icon: '🥗', section: 'My Records' },
    { id: 'hospitals',      label: 'Hospitals & Tests',   icon: '🏥', section: 'Services' },
    { id: 'payments',       label: 'Pay bills',           icon: '💳', section: 'Services' },
    { id: 'womens-health',  label: "Women's Health",      icon: '♀️', section: 'Education' },
    { id: 'children-health', label: "Children's Health", icon: '👶', section: 'Education' },
  ]

  const managerNav = [
    { id: 'overview', label: 'Command Center', icon: '⚡', section: 'Dashboard' },
    { id: 'rag', label: 'Ask Curiva AI', icon: '💬', section: 'AI Tools' },
    { id: 'hospitals', label: 'Hospitals & Tests', icon: '🏥', section: 'Operations' },
    { id: 'order-scans', label: 'Order scans & labs', icon: '🔬', section: 'Operations' },
    { id: 'payments', label: 'Payments & Billing', icon: '💳', section: 'Financial' },
    { id: 'alerts', label: 'Alerts Center', icon: '🚨', section: 'Operations' },
    { id: 'patients', label: 'Patient registry', icon: '👤', section: 'Operations' },
    { id: 'user-mgmt', label: 'Register staff', icon: '➕', section: 'Clinic admin' },
  ]

  const navItems =
    user.role === 'doctor' ? doctorNav : user.role === 'manager' ? managerNav : patientNav
  const sections = [...new Set(navItems.map(n => n.section))]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <img src={logoBase64} alt="Curiva Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          </div>
          <div className="logo-text">
            <h1>Curiva</h1>
            <span>Agentic Healthcare OS</span>
          </div>
        </div>
      </div>

      <div className="sidebar-status">
        <div className="status-badge">
          <div className="status-dot" />
          {user.role === 'doctor'
            ? 'All 9 Agents Online'
            : user.role === 'manager'
              ? 'Hospital operations session'
              : 'Secure Patient Session'}
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map(section => (
          <div key={section} className="nav-section-container">
            <div className="nav-section-label">{section}</div>
            {navItems.filter(n => n.section === section).map(item => (
              <div
                key={item.id}
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => setActivePage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.id === 'alerts' && alertCount > 0 && (
                  <span className="nav-badge">{alertCount}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-user-card" style={{ marginBottom: '8px' }}>
        <div className="user-avatar-circle">
          {user.role === 'doctor' ? '🩺' : user.role === 'manager' ? '🏢' : '👤'}
        </div>
        <div className="user-details">
          <h4>{displayPersonName(user)}</h4>
          <span>{user.role.toUpperCase()}</span>
          {(user.site_hospital || user.site_city) && (
            <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>
              {[user.site_hospital, user.site_city].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>

      <div className="sidebar-controls" style={{ padding: '0 20px', marginBottom: '16px' }}>
        <button 
          onClick={onLogout}
          style={{ width: '100%', padding: '10px', background: 'var(--accent-red)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          🚪 Logout
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="agent-count">
          <strong>Curiva</strong> v1.1 &nbsp;·&nbsp; {time.toLocaleTimeString()}
        </div>
      </div>
    </aside>
  )
}
