import { useState, useEffect } from 'react'
import { displayPersonName } from '../userDisplay'
import AppThemeToggle from './AppThemeToggle.jsx'

const PAGE_TITLES = {
  overview:         { title: 'Hospital Command Center', desc: 'Real-time monitoring of all hospital workflows' },
  intake:           { title: 'Patient Intake Dashboard', desc: 'Multi-agent registration and triage pipeline' },
  clinical:         { title: 'Clinical Summaries Archive', desc: 'LLM-powered report analysis and diagnosis extraction' },
  imaging:          { title: 'Imaging & Radiology Queue', desc: 'Radiology queue management and scan routing' },
  'health-monitor': { title: 'Vitals Monitoring Center', desc: 'Real-time bio-telemetry tracker and alert triggers' },
  'diet-plans':     { title: 'Dietary & Nutrition Programs', desc: 'AI-generated personalized meal plans and macros' },
  'womens-health':  { title: "Women's Health Protocols", desc: 'Clinical guidelines and therapy routes explorer' },
  'children-health': { title: "Children's Health Protocols", desc: 'Pediatric disease list across 20 categories with clinical guidance' },
    hospitals:        { title: 'Hospitals & Medical Tests', desc: 'Find hospitals, browse departments & services, and book lab tests' },
  payments:         { title: 'Payments & billing', desc: 'Pay for consults, labs, and packages (demo checkout)' },
  rag:              { title: 'Ask Curiva AI', desc: 'Clinical knowledge assistant powered by Curiva guidelines' },
  alerts:           { title: 'Alert Center', desc: 'Emergency notifications and escalation management' },
  patients:         { title: 'Electronic Health Records', desc: 'EHR records, clinical summaries, and FHIR data' },
  portal:           { title: 'Patient Health Portal', desc: 'Personal EHR files, clinical summaries, and diagnostic plans' },
  'patient-records': { title: 'My records', desc: 'Appointments, reports, imaging, HL7/FHIR exports, and billing history' },
  'order-scans': { title: 'Order scans & labs', desc: 'Ultrasound, X-ray, CT, MRI, and blood panels with demo reports saved to your record' },
  medications:      { title: 'Medications & schedule', desc: 'Daily calendar, doses, and reminders for your prescriptions' },
  'user-mgmt':      { title: 'Register staff', desc: 'Create doctor or patient portal accounts for your clinic' },
}

export default function Header({ activePage, alertCount, user }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const pageInfo = PAGE_TITLES[activePage] || { title: activePage, desc: '' }
  const displayName = displayPersonName(user)
  const userInitials =
    user && displayName
      ? displayName
          .split(/\s+/)
          .filter(Boolean)
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase()
      : 'US'

  return (
    <header className="header">
      <div className="header-left">
        <div className="breadcrumb">
          <span>Curiva</span>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">{pageInfo.title}</span>
        </div>
        <p className="header-page-desc">{pageInfo.desc}</p>
      </div>
      <div className="header-right">
        <div className="header-time">
          {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} &nbsp;|&nbsp;
          {time.toLocaleTimeString()}
        </div>
        <AppThemeToggle />
        {user.role === 'doctor' || user.role === 'manager' ? (
          <div className="alert-bell">
            🔔
            {alertCount > 0 && <span className="badge">{alertCount}</span>}
          </div>
        ) : null}
        <div className="header-profile-tag">
          <div className="avatar">{userInitials}</div>
          <div className="profile-text">
            <strong>{displayName}</strong>
            <span>{user.role.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
