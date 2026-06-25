import { useState, useEffect, useCallback } from 'react'
import { applyAuthThemeToDocument, getStoredTheme, applyThemeToDocument } from './authTheme'
import AuthThemeToggle from './components/AuthThemeToggle'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Overview from './pages/Overview'
import Intake from './pages/Intake'
import ClinicalSummarizer from './pages/ClinicalSummarizer'
import Imaging from './pages/Imaging'
import RAGAssistant from './pages/RAGAssistant'
import Alerts from './pages/Alerts'
import Patients from './pages/Patients'

// New pages
import Login from './pages/Login'
import Register from './pages/Register'
import Landing from './pages/Landing'
import PatientPortal from './pages/PatientPortal'
import HealthMonitor from './pages/HealthMonitor'
import DietPlan from './pages/DietPlan'
import WomensHealth from './pages/WomensHealth'
import ChildrenHealth from './pages/ChildrenHealth'
import HospitalsTests from './pages/HospitalsTests'
import Payment from './pages/Payment'
import UserManagement from './pages/UserManagement'
import MedicationCalendar from './pages/MedicationCalendar'
import PatientRecordsHub from './pages/PatientRecordsHub'
import OrderScansLabs from './pages/OrderScansLabs'

import { API } from './api'

function defaultLandingPage(role) {
  if (role === 'patient') return 'portal'
  return 'overview'
}

function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => removeToast(t.id)}>
          <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mediflow_user')
    return saved ? JSON.parse(saved) : null
  })

  const [activePage, setActivePage] = useState(() => {
    const saved = localStorage.getItem('mediflow_user')
    if (saved) {
      const u = JSON.parse(saved)
      return defaultLandingPage(u.role)
    }
    return 'overview'
  })

  const [alertCount, setAlertCount] = useState(0)
  const [patientRegistryRevision, setPatientRegistryRevision] = useState(0)
  const [toasts, setToasts]         = useState([])
  const [authView, setAuthView]     = useState('landing')

  const addToast = (msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  const removeToast = (id) => setToasts(t => t.filter(x => x.id !== id))

  // Theme: shared across landing, login, and authenticated shell
  useEffect(() => {
    applyThemeToDocument(getStoredTheme())
  }, [])

  // Pre-login: keep global tokens in sync with saved landing/login theme
  useEffect(() => {
    if (user) return
    applyAuthThemeToDocument(getStoredTheme())
  }, [user, authView])

  // Poll alert count for clinical staff (doctors)
  useEffect(() => {
    if (!user || (user.role !== 'doctor' && user.role !== 'manager')) return
    const poll = async () => {
      try {
        const alerts = await API.getAlerts()
        setAlertCount(alerts.filter(a => !a.resolved).length)
      } catch {
        void 0
      }
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [user])

  const handleLogin = (authenticatedUser) => {
    setUser(authenticatedUser)
    localStorage.setItem('mediflow_user', JSON.stringify(authenticatedUser))
    setActivePage(defaultLandingPage(authenticatedUser.role))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('mediflow_user')
    setActivePage('overview')
    setAuthView('landing')
  }

  const mergeUserProfile = useCallback((patch) => {
    setUser((u) => {
      if (!u) return u
      const next = { ...u, ...patch }
      localStorage.setItem('mediflow_user', JSON.stringify(next))
      return next
    })
  }, [])

  const bumpPatientRegistryRevision = useCallback(() => {
    setPatientRegistryRevision((n) => n + 1)
  }, [])

  // After registry deletes (e.g. clear all), sync patient-linked accounts so UI drops stale EHR data.
  useEffect(() => {
    if (patientRegistryRevision === 0 || !user?.id) return
    if (user.role !== 'patient' && user.patient_id == null) return
    let cancelled = false
    ;(async () => {
      try {
        const profile = await API.getUserProfile(user.id)
        if (!cancelled) mergeUserProfile(profile)
      } catch {
        void 0
      }
    })()
    return () => {
      cancelled = true
    }
  }, [patientRegistryRevision, user?.id, user?.role, user?.patient_id, mergeUserProfile])

  const navigate = (page) => setActivePage(page)

  const PAGES = {
    // Shared / Doctor pages
    overview:  <Overview onNavigate={navigate} patientRegistryRevision={patientRegistryRevision} />,
    intake:    <Intake onToast={addToast} />,
    clinical:  <ClinicalSummarizer onToast={addToast} />,
    imaging:   <Imaging onToast={addToast} />,
    rag:       <RAGAssistant user={user} onToast={addToast} />,
    alerts:    <Alerts onToast={addToast} />,
    patients:  <Patients onToast={addToast} user={user} onRegistryMutated={bumpPatientRegistryRevision} />,

    // New patient & shared features
    portal:         <PatientPortal user={user} onToast={addToast} onNavigate={navigate} onProfileRefresh={mergeUserProfile} />,
    'patient-records': (
      <PatientRecordsHub
        user={user}
        onToast={addToast}
        onNavigate={navigate}
        onUserProfileRefresh={mergeUserProfile}
        patientRegistryRevision={patientRegistryRevision}
      />
    ),
    'order-scans': <OrderScansLabs user={user} onToast={addToast} onNavigate={navigate} onRecordsMutated={bumpPatientRegistryRevision} />,
    medications:    <MedicationCalendar user={user} onToast={addToast} />,
    'health-monitor': <HealthMonitor user={user} onToast={addToast} patientRegistryRevision={patientRegistryRevision} onRecordsMutated={bumpPatientRegistryRevision} />,
    'diet-plans':     <DietPlan user={user} onToast={addToast} patientRegistryRevision={patientRegistryRevision} />,
    'womens-health':  <WomensHealth onToast={addToast} />,
    'children-health': <ChildrenHealth onToast={addToast} />,
    hospitals:        <HospitalsTests user={user} onToast={addToast} onRecordsMutated={bumpPatientRegistryRevision} />,
    payments:         <Payment user={user} onToast={addToast} onRecordsMutated={bumpPatientRegistryRevision} />,
    'user-mgmt':      <UserManagement user={user} onToast={addToast} onRegistryMutated={bumpPatientRegistryRevision} />,
  }

  // Unauthenticated: marketing landing → login / register
  if (!user) {
    return (
      <>
        {authView === 'landing' && (
          <Landing onLogin={() => setAuthView('login')} />
        )}
        {authView === 'login' && (
          <div className="login-wrapper login-wrapper--no-scroll">
            <div className="login-theme-corner">
              <AuthThemeToggle />
            </div>
            <Login
              onLogin={handleLogin}
              onToast={addToast}
              onGoRegister={() => setAuthView('register')}
              onBackHome={() => setAuthView('landing')}
            />
          </div>
        )}
        {authView === 'register' && (
          <div className="login-wrapper">
            <div className="login-theme-corner">
              <AuthThemeToggle />
            </div>
            <Register
              onLogin={handleLogin}
              onToast={addToast}
              onGoLogin={() => setAuthView('login')}
              onBackHome={() => setAuthView('landing')}
            />
          </div>
        )}
        <Toast toasts={toasts} removeToast={removeToast} />
      </>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        alertCount={alertCount} 
        user={user}
        onLogout={handleLogout}
      />
      <div className="main-content">
        {activePage !== 'rag' && (
          <Header activePage={activePage} alertCount={alertCount} user={user} />
        )}
        <main className={`page-body${activePage === 'rag' ? ' page-body--chat' : ''}`}>
          {PAGES[activePage] || <div>Page not found</div>}
        </main>
      </div>
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
