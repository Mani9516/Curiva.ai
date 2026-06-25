import { useState, useEffect } from 'react'
import './Landing.css'
import { AUTH_THEME_STORAGE_KEY, applyAuthThemeToDocument } from '../authTheme'
import { PL_ABOUT_HASH, scrollPlAboutIntoView } from '../hashAnchor'
import caduceusUrl from '../assets/caduceus.svg?url'

function HeartIllustration() {
  return (
    <svg
      className="pl-heart-svg"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="plHeartBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="50%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
        <linearGradient id="plHeartVein" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path
        fill="url(#plHeartBody)"
        d="M100 180c-48-28-80-52-80-92C20 52 48 28 78 28c14 0 28 8 36 22 8-14 22-22 36-22 30 0 58 24 58 60 0 40-32 64-80 92z"
      />
      <path
        fill="none"
        stroke="url(#plHeartVein)"
        strokeWidth="3"
        strokeLinecap="round"
        d="M52 78c12-8 28-6 40 4M108 70c14-10 32-8 44 6M70 120c16 12 36 14 60 8M88 96c10 18 28 26 48 22"
        opacity="0.9"
      />
    </svg>
  )
}

export default function Landing({ onLogin }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_THEME_STORAGE_KEY)
      if (saved === 'dark' || saved === 'light') return saved
    } catch {
      /* ignore */
    }
    return 'dark'
  })

  useEffect(() => {
    try {
      localStorage.setItem(AUTH_THEME_STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
    applyAuthThemeToDocument(theme)
  }, [theme])

  useEffect(() => {
    const onHash = () => scrollPlAboutIntoView()
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const isDark = theme === 'dark'
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <div className={`pre-login-landing ${isDark ? 'pre-login-landing--dark' : ''}`}>
      <header className="pl-nav">
        <div className="pl-logo">
          <span className="pl-logo-mark" aria-hidden>
            <img src={caduceusUrl} alt="" className="pl-logo-mark-img" width={36} height={36} decoding="async" />
          </span>
          Curiva
        </div>
        <div className="pl-nav-actions">
          <button type="button" className="pl-theme-toggle" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button type="button" className="pl-nav-login" onClick={onLogin}>
            Sign in
          </button>
        </div>
      </header>

      <main>
        <section className="pl-hero">
          <div className="pl-hero-copy">
            <div className="pl-badge">🩺 Perfect for businesses of all sizes</div>
            <h1>Streamline Your Medical Practice with Ease</h1>
            <p className="pl-hero-lead">
              Curiva helps doctors manage patient records, appointments, and schedules — so you can focus on what
              truly matters: patient care.
            </p>
            <button type="button" className="pl-cta-login" onClick={onLogin}>
              Sign in
            </button>
            <div className="pl-social">
              <div className="pl-avatars" aria-hidden>
                <span>👨‍⚕️</span>
                <span>👩‍⚕️</span>
                <span>🧑‍⚕️</span>
              </div>
              <p>Trusted by 10,000+ medical professionals worldwide.</p>
            </div>
          </div>

          <div className="pl-visual" aria-hidden>
            <div className="pl-heart-wrap">
              <HeartIllustration />
              <div className="pl-float-card pl-fc-overview">
                <div className="pl-donut" />
                <div className="pl-donut-label">87%</div>
                <div className="pl-legend">
                  <span>
                    <i className="pl-dot" style={{ background: '#6366f1' }} /> Heart
                  </span>
                  <span>
                    <i className="pl-dot" style={{ background: '#38bdf8' }} /> Lungs
                  </span>
                  <span>
                    <i className="pl-dot" style={{ background: '#f472b6' }} /> Brain
                  </span>
                </div>
              </div>
              <div className="pl-float-card pl-fc-appt">
                <div className="pl-date">11 December</div>
                <div className="pl-time">Tuesday 13:30–14:30</div>
                <div className="pl-person">
                  <span className="pl-mini-av" />
                  Andrew Polson
                </div>
              </div>
              <div className="pl-float-card pl-fc-hr">
                <strong>Heart Rate 100 bpm</strong>
                <div className="pl-ecg" />
              </div>
              <div className="pl-float-card pl-fc-sched">
                <h4>My Schedule</h4>
                <div className="pl-sd">12 April 2023</div>
                <ul>
                  <li>
                    <span className="pl-mini-av" style={{ width: 24, height: 24 }} /> Anna Johnson
                    <span className="pl-tag">12/12</span>
                  </li>
                  <li>
                    <span className="pl-mini-av" style={{ width: 24, height: 24 }} /> Emma Bator
                    <span className="pl-tag">12/12</span>
                  </li>
                  <li>
                    <span className="pl-mini-av" style={{ width: 24, height: 24 }} /> William Smith
                    <span className="pl-tag">12/12</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="pl-about" className="pl-about" aria-labelledby="pl-about-heading">
          <h2 id="pl-about-heading">About Curiva</h2>
          <p>
            Curiva connects patients, clinicians, and hospital operations on one platform — from intake and imaging
            to follow-up care, billing, and your personal health portal.
          </p>
          <p className="pl-about-foot">
            Use <strong>Sign in</strong> above to open your dashboard. This section is reachable at{' '}
            <code>{PL_ABOUT_HASH}</code> on the home page.
          </p>
        </section>
      </main>
    </div>
  )
}
