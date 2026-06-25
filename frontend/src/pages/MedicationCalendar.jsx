import { useState, useEffect, useMemo, useCallback } from 'react'
import './MedicationCalendar.css'

const STORAGE_MEDS = 'mediflow_patient_medications'
const STORAGE_DONE = 'mediflow_patient_med_doses_done'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const defaultMedications = () => [
  {
    id: 'm1',
    name: 'Vitamin D 5000 IU',
    detail: '1 capsule • After meal',
    windowLabel: '7:30 – 8:00 AM',
    period: 'Morning',
    iconBg: 'linear-gradient(135deg, #fb923c, #f97316)',
    icon: '💊',
  },
  {
    id: 'm2',
    name: 'Iron supplement',
    detail: '1 tablet • Before meal',
    windowLabel: '7:30 – 8:00 AM',
    period: 'Morning',
    iconBg: 'linear-gradient(135deg, #f87171, #ef4444)',
    icon: '🔴',
  },
  {
    id: 'm3',
    name: 'Omega-3',
    detail: '2 capsules • With lunch',
    windowLabel: '12:00 – 1:00 PM',
    period: 'Day',
    iconBg: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
    icon: '💧',
  },
  {
    id: 'm4',
    name: 'Metformin 500mg',
    detail: '1 tablet • With food',
    windowLabel: '12:00 – 1:00 PM',
    period: 'Day',
    iconBg: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
    icon: '⚕️',
  },
]

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function toISODate(d) {
  return startOfDay(d).toISOString().slice(0, 10)
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function weekStartMonday(d) {
  const x = startOfDay(d)
  const day = x.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addDays(x, mondayOffset)
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* ignore */
  }
}

export default function MedicationCalendar({ user, onToast }) {
  const userKey = user?.id != null ? String(user.id) : user?.username || 'guest'

  const [appTab, setAppTab] = useState('today')
  const [calView, setCalView] = useState('week')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [showRound, setShowRound] = useState(false)
  const [medications, setMedications] = useState(defaultMedications)
  const [dosesDone, setDosesDone] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDetail, setNewDetail] = useState('')
  const [newWindow, setNewWindow] = useState('8:00 – 9:00 AM')
  const [newPeriod, setNewPeriod] = useState('Morning')

  useEffect(() => {
    const meds = loadJson(`${STORAGE_MEDS}_${userKey}`, null)
    if (meds && Array.isArray(meds) && meds.length) setMedications(meds)
    const done = loadJson(`${STORAGE_DONE}_${userKey}`, {})
    if (done && typeof done === 'object') setDosesDone(done)
  }, [userKey])

  useEffect(() => {
    saveJson(`${STORAGE_MEDS}_${userKey}`, medications)
  }, [medications, userKey])

  useEffect(() => {
    saveJson(`${STORAGE_DONE}_${userKey}`, dosesDone)
  }, [dosesDone, userKey])

  const monthLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [selectedDate],
  )

  const weekDays = useMemo(() => {
    const start = weekStartMonday(selectedDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [selectedDate])

  const monthCells = useMemo(() => {
    const y = selectedDate.getFullYear()
    const m = selectedDate.getMonth()
    const first = new Date(y, m, 1)
    const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const cells = []
    const prevMonthDays = new Date(y, m, 0).getDate()
    for (let i = 0; i < startPad; i++) {
      cells.push({
        date: new Date(y, m - 1, prevMonthDays - startPad + i + 1),
        muted: true,
      })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(y, m, d), muted: false })
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date
      cells.push({ date: addDays(last, 1), muted: true })
    }
    return cells
  }, [selectedDate])

  const dateKey = toISODate(selectedDate)

  const isDone = useCallback(
    (medId) => !!dosesDone[`${dateKey}|${medId}`],
    [dosesDone, dateKey],
  )

  const toggleDose = (medId) => {
    const k = `${dateKey}|${medId}`
    setDosesDone((prev) => {
      const next = { ...prev }
      if (next[k]) delete next[k]
      else next[k] = true
      return next
    })
  }

  const grouped = useMemo(() => {
    const order = ['Morning', 'Day', 'Evening', 'Night']
    const map = {}
    for (const p of order) map[p] = []
    for (const med of medications) {
      const p = med.period && map[med.period] != null ? med.period : 'Day'
      map[p].push(med)
    }
    return order.filter((p) => map[p].length).map((p) => ({ period: p, items: map[p] }))
  }, [medications])

  const addMedication = (e) => {
    e.preventDefault()
    if (!newName.trim()) {
      onToast('Enter a medication name', 'error')
      return
    }
    const id = `m_${Date.now()}`
    setMedications((prev) => [
      ...prev,
      {
        id,
        name: newName.trim(),
        detail: newDetail.trim() || 'As directed',
        windowLabel: newWindow.trim() || 'Any time',
        period: newPeriod,
        iconBg: 'linear-gradient(135deg, #94a3b8, #64748b)',
        icon: '💊',
      },
    ])
    setNewName('')
    setNewDetail('')
    setShowAdd(false)
    onToast('Medication added to your schedule', 'success')
  }

  if (user?.role !== 'patient') {
    return (
      <div className="medication-calendar-page">
        <div className="medcal-placeholder">
          <p>
            <strong>Medications & calendar</strong> is available in the patient portal. Sign in as a patient to track
            doses and schedules.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="medication-calendar-page">
      <div className="medcal-layout">
        <nav className="medcal-app-nav" aria-label="Medication views">
          <button type="button" className={appTab === 'preferences' ? 'active' : ''} onClick={() => setAppTab('preferences')}>
            <span className="nav-ic" aria-hidden>
              ⚙️
            </span>
            Preferences
          </button>
          <button type="button" className={appTab === 'history' ? 'active' : ''} onClick={() => setAppTab('history')}>
            <span className="nav-ic" aria-hidden>
              🕐
            </span>
            History
          </button>
          <button type="button" className={appTab === 'today' ? 'active' : ''} onClick={() => setAppTab('today')}>
            <span className="nav-ic" aria-hidden>
              📅
            </span>
            Today
          </button>
          <button type="button" className={appTab === 'all' ? 'active' : ''} onClick={() => setAppTab('all')}>
            <span className="nav-ic" aria-hidden>
              💊
            </span>
            All medicine
          </button>
        </nav>

        <div className="medcal-workspace">
          <header className="medcal-topbar">
            <h1 className="medcal-month">{monthLabel}</h1>
            <div className="medcal-segment" role="group" aria-label="Calendar range">
              <button type="button" className={calView === 'week' ? 'on' : ''} onClick={() => setCalView('week')}>
                Week
              </button>
              <button type="button" className={calView === 'month' ? 'on' : ''} onClick={() => setCalView('month')}>
                Month
              </button>
            </div>
          </header>

          {calView === 'week' ? (
            <div className="medcal-strip-wrap">
              <div className="medcal-week-strip" role="tablist" aria-label="Week days">
                {weekDays.map((d) => {
                  const sel = toISODate(d) === dateKey
                  return (
                    <button
                      key={toISODate(d)}
                      type="button"
                      className={`medcal-day-pill ${sel ? 'selected' : ''}`}
                      onClick={() => setSelectedDate(d)}
                    >
                      <span className="dow">{DOW[d.getDay()]}</span>
                      <span className="dom">{d.getDate()}</span>
                    </button>
                  )
                })}
              </div>
              <div className="medcal-round-row">
                <span>Show round</span>
                <button
                  type="button"
                  className={`medcal-switch ${showRound ? 'on' : ''}`}
                  onClick={() => setShowRound((v) => !v)}
                  aria-pressed={showRound}
                  aria-label="Toggle show round"
                />
              </div>
            </div>
          ) : (
            <div className="medcal-strip-wrap">
              <div className="medcal-month-grid-head">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((h) => (
                  <div key={h} className="medcal-month-dow">
                    {h}
                  </div>
                ))}
              </div>
              <div className="medcal-month-grid" role="grid" aria-label="Month">
                {monthCells.map(({ date, muted }, i) => {
                  const sel = toISODate(date) === dateKey
                  return (
                    <button
                      key={`${toISODate(date)}-${i}`}
                      type="button"
                      className={`cell ${muted ? 'muted' : ''} ${sel ? 'selected' : ''}`}
                      onClick={() => setSelectedDate(date)}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
              <div className="medcal-round-row">
                <span>Show round</span>
                <button
                  type="button"
                  className={`medcal-switch ${showRound ? 'on' : ''}`}
                  onClick={() => setShowRound((v) => !v)}
                  aria-pressed={showRound}
                  aria-label="Toggle show round"
                />
              </div>
            </div>
          )}

          {appTab === 'preferences' && (
            <div className="medcal-placeholder">
              <p>
                Reminder preferences and units will appear here. For now, use <strong>Today</strong> to manage doses for
                the selected day.
              </p>
            </div>
          )}

          {appTab === 'history' && (
            <div className="medcal-placeholder">
              <p>
                A full adherence history view is coming soon. Completed doses are saved per day when you check them off
                on <strong>Today</strong>.
              </p>
            </div>
          )}

          {appTab === 'all' && (
            <div className="medcal-cards" style={{ maxWidth: 720 }}>
              {medications.map((med) => (
                <div key={med.id} className="medcal-card">
                  <div className="medcal-card-icon" style={{ background: med.iconBg }}>
                    {med.icon}
                  </div>
                  <div className="medcal-card-body">
                    <strong>{med.name}</strong>
                    <span>
                      {med.windowLabel} · {med.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {appTab === 'today' && (
            <>
              {showRound && (
                <p className="medcal-round-hint">
                  Round dosing view enabled — same schedule repeats across the selected week (demo).
                </p>
              )}
              {grouped.map(({ period, items }) => (
                <section key={period}>
                  <div className="medcal-section-label">{period}</div>
                  {items.map((med, idx) => {
                    const showTime = idx === 0 || items[idx - 1].windowLabel !== med.windowLabel
                    return (
                      <div key={med.id}>
                        {showTime && <div className="medcal-time">{med.windowLabel}</div>}
                        <div className="medcal-cards">
                          <div className="medcal-card">
                            <div className="medcal-card-icon" style={{ background: med.iconBg }}>
                              {med.icon}
                            </div>
                            <div className="medcal-card-body">
                              <strong>{med.name}</strong>
                              <span>{med.detail}</span>
                            </div>
                            <button
                              type="button"
                              className={`medcal-check ${isDone(med.id) ? 'done' : 'pending-mark'}`}
                              onClick={() => toggleDose(med.id)}
                              aria-label={isDone(med.id) ? 'Mark not taken' : 'Mark taken'}
                            >
                              {isDone(med.id) ? '✓' : '✓'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </section>
              ))}
            </>
          )}

          <button type="button" className="medcal-fab" onClick={() => setShowAdd(true)} aria-label="Add medication">
            +
          </button>
        </div>
      </div>

      {showAdd && (
        <div
          className="medcal-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medcal-add-title"
          onClick={() => setShowAdd(false)}
        >
          <div className="medcal-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="medcal-add-title">Add medication</h3>
            <form onSubmit={addMedication}>
              <label htmlFor="medcal-name">Name</label>
              <input id="medcal-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Aspirin 81mg" />
              <label htmlFor="medcal-detail">Instructions</label>
              <input id="medcal-detail" value={newDetail} onChange={(e) => setNewDetail(e.target.value)} placeholder="1 tablet • With food" />
              <label htmlFor="medcal-window">Time window</label>
              <input id="medcal-window" value={newWindow} onChange={(e) => setNewWindow(e.target.value)} />
              <label htmlFor="medcal-period">Part of day</label>
              <select id="medcal-period" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)}>
                <option value="Morning">Morning</option>
                <option value="Day">Day</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
              <div className="medcal-modal-actions">
                <button type="button" className="ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
