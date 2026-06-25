import { useState } from 'react'
import { API } from '../api'
import { displayPersonName } from '../userDisplay'
import { accountApprovalGate, PendingApprovalCard, RejectedAccountCard } from '../accountAccessGates.jsx'

function normalizePatientId(user) {
  const n = user?.patient_id != null ? Number(user.patient_id) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

function buildBloodPanelReport(patientName) {
  const t = new Date().toISOString().slice(0, 16).replace('T', ' ')
  return `CURIVA LABORATORY REPORT (demo generated)
Patient: ${patientName}
Collected: ${t}
Laboratory: Curiva Central Lab
Accession: LAB-${Date.now()}

--- HEMATOLOGY (CBC) ---
WBC 7.2 x10³/µL (reference 4.5–11.0)
RBC 4.5 x10⁶/µL (reference 4.0–5.2)
Hemoglobin 13.2 g/dL (reference 12.0–15.5)
Hematocrit 39.8 %
Platelets 265 x10³/µL (reference 150–400)

--- METABOLIC ---
Glucose 92 mg/dL
Creatinine 0.8 mg/dL
eGFR >90 mL/min/1.73m² (demo estimate)

--- LIPID PANEL ---
Total cholesterol 178 mg/dL
HDL 52 mg/dL
LDL 108 mg/dL (Friedewald estimate, demo)
Triglycerides 110 mg/dL

--- HbA1c ---
5.4 % (eAG ~108 mg/dL, demo)

IMPRESSION: Pattern consistent with routine wellness screening on this simulated panel. Not for clinical or billing use.

Disclaimer: Auto-generated demonstration content only.`
}

const RADIOLOGY_OPTIONS = [
  {
    key: 'us',
    title: 'Ultrasound',
    icon: '🔊',
    desc: 'Abdomen & pelvis — soft tissue and Doppler-capable study (demo).',
    scan_type: 'Ultrasound (abdomen & pelvis)',
    priority: 'Routine',
  },
  {
    key: 'xr',
    title: 'X-Ray',
    icon: '🩻',
    desc: 'Chest radiograph, two views — quick structural screen (demo).',
    scan_type: 'Chest X-Ray (PA & lateral)',
    priority: 'Routine',
  },
  {
    key: 'ct',
    title: 'CT scan',
    icon: '🌀',
    desc: 'Chest–abdomen protocol — cross-sectional anatomy (demo).',
    scan_type: 'CT chest–abdomen (demo protocol)',
    priority: 'Urgent',
  },
  {
    key: 'mri',
    title: 'MRI',
    icon: '🧲',
    desc: 'Brain MRI without contrast — detailed soft-tissue contrast (demo).',
    scan_type: 'MRI brain without contrast',
    priority: 'Routine',
  },
]

export default function OrderScansLabs({ user, onToast, onNavigate, onRecordsMutated }) {
  const pid = normalizePatientId(user)
  const [busy, setBusy] = useState(null)

  if (user?.role === 'patient' && accountApprovalGate(user) === 'pending') {
    return (
      <div style={{ padding: 24 }}>
        <PendingApprovalCard />
      </div>
    )
  }

  if (user?.role === 'patient' && accountApprovalGate(user) === 'rejected') {
    return (
      <div style={{ padding: 24 }}>
        <RejectedAccountCard />
      </div>
    )
  }

  const orderRadiology = async (opt) => {
    if (!pid) {
      onToast('Link a patient record to your account to save orders under My records.', 'error')
      return
    }
    setBusy(opt.key)
    try {
      await API.orderImagingScan(pid, {
        scan_type: opt.scan_type,
        priority: opt.priority,
        mark_completed: true,
      })
      onToast(`${opt.title} ordered — radiology report generated and saved to My records.`, 'success')
      onRecordsMutated?.()
    } catch (e) {
      onToast(e?.message || 'Could not save imaging order', 'error')
    } finally {
      setBusy(null)
    }
  }

  const orderBloodPanel = async () => {
    if (!pid) {
      onToast('Link a patient record to your account to save orders under My records.', 'error')
      return
    }
    setBusy('blood')
    const name = displayPersonName(user)
    try {
      await API.createTestReport(pid, {
        title: 'Laboratory panel (CBC, metabolic, lipids, HbA1c)',
        lab_name: 'Curiva Central Laboratory',
        items: ['CBC', 'CMP subset', 'Lipid profile', 'HbA1c'],
        scheduled_at: new Date().toISOString(),
        status: 'Completed',
        result_summary: buildBloodPanelReport(name),
      })
      onToast('Blood panel report generated and saved to My records.', 'success')
      onRecordsMutated?.()
    } catch (e) {
      onToast(e?.message || 'Could not save lab report', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="page-title">
        <h2>Order scans &amp; labs</h2>
        <p>
          Choose ultrasound, X-ray, CT, MRI, or a blood test panel. Curiva generates a <strong>demo report</strong>, saves it to your EHR, and you can open{' '}
          <strong>My records</strong> to read or download each report.
        </p>
      </div>

      {!pid && (
        <div className="glass-card" style={{ marginBottom: 20, padding: 20 }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            Your login does not have a <strong>patient ID</strong> linked. Sign in as a patient portal account (e.g. <code>patient1</code>) or ask staff to link your profile,
            then return here to place orders that appear under <strong>My records</strong>.
          </p>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {RADIOLOGY_OPTIONS.map((opt) => (
          <div key={opt.key} className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 28 }}>{opt.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{opt.title}</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, flex: 1 }}>{opt.desc}</p>
            <span className="badge badge-info" style={{ alignSelf: 'flex-start', fontSize: 11 }}>
              Priority: {opt.priority}
            </span>
            <button
              type="button"
              className="tag"
              disabled={busy !== null}
              onClick={() => orderRadiology(opt)}
              style={{
                cursor: busy ? 'wait' : 'pointer',
                fontWeight: 600,
                padding: '10px 14px',
                border: '1px solid var(--accent-cyan)',
                color: 'var(--accent-cyan)',
                marginTop: 4,
              }}
            >
              {busy === opt.key ? 'Saving…' : 'Order & generate report'}
            </button>
          </div>
        ))}

        <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'rgba(16,185,129,0.35)' }}>
          <div style={{ fontSize: 28 }}>🧪</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Blood test panel</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, flex: 1 }}>
            CBC, basic metabolic markers, lipids, and HbA1c with an auto-generated narrative suitable for demos.
          </p>
          <span className="badge badge-complete" style={{ alignSelf: 'flex-start', fontSize: 11 }}>
            Results: instant (demo)
          </span>
          <button
            type="button"
            className="tag"
            disabled={busy !== null}
            onClick={orderBloodPanel}
            style={{
              cursor: busy ? 'wait' : 'pointer',
              fontWeight: 600,
              padding: '10px 14px',
              border: '1px solid var(--accent-green)',
              color: 'var(--accent-green)',
              marginTop: 4,
            }}
          >
            {busy === 'blood' ? 'Saving…' : 'Order blood panel & report'}
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 18 }}>
        <div className="glass-card-title" style={{ marginBottom: 8 }}>
          <div className="icon">📑</div>
          View &amp; download
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
          Open <strong>My records</strong> → <strong>Reports &amp; imaging</strong>. Each study and lab entry has a <strong>Download report</strong> button (plain text). You can
          still use <strong>Download / print report</strong> for a combined PDF via your browser.
        </p>
        {typeof onNavigate === 'function' && (
          <button type="button" className="tag" style={{ cursor: 'pointer', fontWeight: 600 }} onClick={() => onNavigate('patient-records')}>
            Go to My records
          </button>
        )}
      </div>
    </div>
  )
}
