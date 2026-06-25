import { useEffect, useMemo, useState } from 'react'
import './BookAppointmentFlow.css'
import { API } from '../api'
import { displayDoctorBookingName, displayPersonName } from '../userDisplay'

const SYMPTOM_CHIPS = ['I have a headache', 'I have a fever', 'Follow-up visit', 'General check-up', 'Prescription refill']

const TIME_SLOTS = ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM']

function initials(name) {
  if (!name) return '?'
  const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/)
  const a = parts[0]?.[0] || ''
  const b = parts[1]?.[0] || ''
  return (a + b).toUpperCase() || name.slice(0, 2).toUpperCase()
}

function formatLongDate(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function nextSevenDays(from = new Date()) {
  const out = []
  const cur = new Date(from)
  cur.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const d = new Date(cur)
    d.setDate(cur.getDate() + i)
    out.push({
      iso: d.toISOString().slice(0, 10),
      dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dom: d.getDate(),
    })
  }
  return out
}

/** e.g. "10:00 AM" + date "2025-06-20" → local wall-clock ISO fragment for DB */
function appointmentSlotToIso(dateIso, time12h) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(time12h || '').trim())
  if (!m || !dateIso) return `${dateIso || new Date().toISOString().slice(0, 10)}T10:00:00`
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap = m[3].toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return `${dateIso}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
}

/**
 * Multi-step book appointment UI inspired by mobile healthcare mocks (schedule + in-person + confirmation).
 */
export default function BookAppointmentFlow({ open, onClose, doctor, departmentName, hospital, user, onToast, onRecordsMutated }) {
  const [step, setStep] = useState('schedule')
  const [selectedIso, setSelectedIso] = useState('')
  const [selectedTime, setSelectedTime] = useState('10:00 AM')
  const [newPatient, setNewPatient] = useState(true)
  const [symptoms, setSymptoms] = useState('')
  const [clinicIndex, setClinicIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  const days = useMemo(() => nextSevenDays(), [])

  const clinicOptions = useMemo(() => {
    if (!hospital?.address) return []
    const main = hospital.address
    const short = main.split(',').slice(0, 2).join(',')
    return [
      { id: 0, label: 'Main building', address: main, distance: 'On campus' },
      {
        id: 1,
        label: 'Outpatient annex',
        address: `${short} — OPD Wing, Ground floor`,
        distance: '~0.8 km',
      },
    ]
  }, [hospital])

  useEffect(() => {
    if (!open) return
    setStep('schedule')
    const list = nextSevenDays()
    const first = list[0]?.iso || new Date().toISOString().slice(0, 10)
    setSelectedIso(first)
    setSelectedTime('10:00 AM')
    setNewPatient(true)
    setSymptoms('')
    setClinicIndex(0)
    setSaving(false)
  }, [open])

  if (!open || !doctor || !hospital) return null

  const doctorDisplayName = displayDoctorBookingName(doctor)
  const patientDisplayName = displayPersonName(user)
  const todayLine = `Today, ${formatLongDate(new Date())}`
  const specialtyLabel = departmentName || doctor.role || 'Specialist'
  const qrPayload = `Curiva|${hospital.name}|${doctorDisplayName}|${selectedIso}|${selectedTime}|${clinicOptions[clinicIndex]?.label || ''}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrPayload)}`

  const goScheduleNext = () => {
    if (!selectedIso) {
      onToast?.('Please select a date.', 'error')
      return
    }
    if (!selectedTime) {
      onToast?.('Please select a time slot.', 'error')
      return
    }
    setStep('location')
  }

  const confirmAppointment = async () => {
    const clinic = clinicOptions[clinicIndex]
    const locationLine = clinic ? `${clinic.label} — ${clinic.address || hospital.address || ''}` : hospital?.address || 'Curiva OPD'
    const notesParts = []
    if (symptoms?.trim()) notesParts.push(symptoms.trim())
    notesParts.push(newPatient ? 'New patient' : 'Returning patient')
    notesParts.push(`Booked via Curiva — ${hospital?.name || 'Curiva'}`)

    const pid = user?.patient_id != null ? Number(user.patient_id) : null
    if (pid != null && Number.isFinite(pid) && pid > 0) {
      setSaving(true)
      try {
        const scheduled_at = appointmentSlotToIso(selectedIso, selectedTime)
        await API.createAppointment(pid, {
          title: `${specialtyLabel} visit — ${doctorDisplayName}`,
          care_team: doctorDisplayName,
          location: locationLine,
          scheduled_at,
          status: 'Scheduled',
          notes: notesParts.join('\n'),
        })
        onToast?.('Appointment saved to My records.', 'success')
        onRecordsMutated?.()
      } catch (e) {
        onToast?.(e?.message || 'Could not save appointment', 'error')
        setSaving(false)
        return
      }
      setSaving(false)
    } else {
      onToast?.('Appointment confirmed (demo). Link a patient portal account to save visits under My records.', 'info')
    }
    setStep('confirmed')
  }

  const appendChip = (text) => {
    setSymptoms((prev) => (prev ? `${prev.trim()}; ${text}` : text))
  }

  return (
    <div className="ba-root" role="dialog" aria-modal="true" aria-labelledby="ba-dialog-title">
      <button type="button" className="ba-backdrop" aria-label="Close" onClick={onClose} />
      <div className="ba-shell">
        {step === 'schedule' && (
          <>
            <header className="ba-topbar">
              <button type="button" className="ba-icon-btn" onClick={onClose} aria-label="Back">
                ←
              </button>
              <h1 id="ba-dialog-title" className="ba-title">
                Book Appointment
              </h1>
              <button type="button" className="ba-icon-btn" aria-label="More" onClick={() => onToast?.('Menu: add to favourites, share, or help (demo).', 'info')}>
                ⋮
              </button>
            </header>

            <p className="ba-today-line">{todayLine}</p>

            <section className="ba-card ba-doctor-card">
              <div className="ba-avatar" aria-hidden>
                {initials(doctorDisplayName)}
              </div>
              <div className="ba-doctor-meta">
                <h2 className="ba-doctor-name">{doctorDisplayName}</h2>
                <p className="ba-doctor-spec">{specialtyLabel}</p>
                <p className="ba-doctor-rating">⭐ 5.0 <span className="ba-rating-count">(112 reviews)</span></p>
              </div>
            </section>

            <section className="ba-section">
              <h3 className="ba-section-title">Book an appointment</h3>
              <p className="ba-section-hint">Choose a day and time that work for you.</p>
              <div className="ba-date-strip" role="list">
                {days.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    role="listitem"
                    className={`ba-date-pill ${selectedIso === d.iso ? 'ba-date-pill--active' : ''}`}
                    onClick={() => setSelectedIso(d.iso)}
                  >
                    <span className="ba-date-dow">{d.dow}</span>
                    <span className="ba-date-dom">{d.dom}</span>
                  </button>
                ))}
              </div>
              <div className="ba-time-row">
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`ba-time-pill ${selectedTime === t ? 'ba-time-pill--active' : ''} ${t === '12:00 PM' ? 'ba-time-pill--disabled' : ''}`}
                    disabled={t === '12:00 PM'}
                    onClick={() => t !== '12:00 PM' && setSelectedTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label className="ba-check">
                <input type="checkbox" checked={newPatient} onChange={(e) => setNewPatient(e.target.checked)} />
                I&apos;m a new patient
              </label>
            </section>

            <section className="ba-section">
              <h3 className="ba-section-title">Describe your symptoms</h3>
              <textarea
                className="ba-textarea"
                rows={4}
                placeholder="Type your symptoms"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
              <div className="ba-chips">
                {SYMPTOM_CHIPS.map((c) => (
                  <button key={c} type="button" className="ba-chip" onClick={() => appendChip(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <button type="button" className="ba-btn-primary" onClick={goScheduleNext}>
              Book Now
            </button>
          </>
        )}

        {step === 'location' && (
          <>
            <header className="ba-topbar ba-topbar--dark">
              <button type="button" className="ba-icon-btn ba-icon-btn--on-dark" onClick={() => setStep('schedule')} aria-label="Back">
                ←
              </button>
              <span className="ba-brand-mark">Curiva</span>
              <span className="ba-topbar-spacer" />
            </header>

            <div className="ba-reedim-block">
              <h2 className="ba-reedim-title">In-person visit</h2>
              <p className="ba-reedim-sub">Book your in-person appointment to continue.</p>
            </div>

            <section className="ba-accordion">
              <div className="ba-accordion-head">
                <span>📍</span>
                <span>Select a clinic</span>
                <span className="ba-chev">⌃</span>
              </div>
              <div className="ba-clinic-list">
                {clinicOptions.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`ba-clinic-card ${clinicIndex === i ? 'ba-clinic-card--selected' : ''}`}
                    onClick={() => setClinicIndex(i)}
                  >
                    <span className="ba-clinic-label">{c.label}</span>
                    <span className="ba-clinic-addr">{c.address}</span>
                    <span className="ba-clinic-dist">{c.distance}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="ba-accordion">
              <div className="ba-accordion-head">
                <span>🕐</span>
                <span>Select visit time</span>
                <span className="ba-chev">⌃</span>
              </div>
              <p className="ba-recap">
                {new Date(selectedIso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                · {selectedTime}
              </p>
              <div className="ba-time-row ba-time-row--dark">
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`ba-slot-dark ${selectedTime === t ? 'ba-slot-dark--active' : ''}`}
                    onClick={() => setSelectedTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>

            <button type="button" className="ba-btn-confirm" disabled={saving} onClick={confirmAppointment}>
              <span className="ba-btn-confirm-icon">→</span>
              <span>{saving ? 'Saving…' : 'Confirm appointment'}</span>
              <span className="ba-btn-confirm-chev">›››</span>
            </button>
            <button type="button" className="ba-link-cancel" onClick={onClose}>
              Cancel &amp; close
            </button>
          </>
        )}

        {step === 'confirmed' && (
          <>
            <header className="ba-topbar ba-topbar--dark">
              <span className="ba-topbar-spacer" />
              <span className="ba-brand-mark">Curiva</span>
              <span className="ba-topbar-spacer" />
            </header>

            <div className="ba-success-head">
              <div className="ba-success-icon" aria-hidden>
                ✓
              </div>
              <h2 className="ba-success-title">Appointment confirmed</h2>
            </div>

            <div className="ba-card ba-summary-card">
              <div className="ba-summary-row">
                <span>📍</span>
                <div>
                  <strong>Clinic</strong>
                  <p>{clinicOptions[clinicIndex]?.address}</p>
                </div>
              </div>
              <div className="ba-summary-row">
                <span>🕐</span>
                <div>
                  <strong>Visit time</strong>
                  <p>
                    {new Date(selectedIso + 'T12:00:00').toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    · {selectedTime}
                  </p>
                </div>
              </div>
              <div className="ba-summary-row">
                <span>🩺</span>
                <div>
                  <strong>With</strong>
                  <p>
                    {doctorDisplayName} — {specialtyLabel}
                  </p>
                </div>
              </div>
              {user && (
                <div className="ba-summary-row">
                  <span>👤</span>
                  <div>
                    <strong>Patient</strong>
                    <p>{patientDisplayName}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="ba-card ba-qr-card">
              <p className="ba-qr-label">Check-in QR</p>
              <img className="ba-qr-img" src={qrSrc} alt="Appointment check-in QR code" width={160} height={160} />
            </div>

            <button type="button" className="ba-btn-done" onClick={onClose}>
              Got it
            </button>
            <button type="button" className="ba-link-cancel" onClick={() => onToast?.('Refund flow is not enabled in this demo.', 'info')}>
              Cancel &amp; refund
            </button>
          </>
        )}
      </div>
    </div>
  )
}
