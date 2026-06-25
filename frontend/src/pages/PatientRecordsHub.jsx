import { useState, useEffect, useMemo, useCallback } from 'react'
import { API } from '../api'
import { displayCareTeamLabel, displayPersonName } from '../userDisplay'
import { accountApprovalGate, PendingApprovalCard, RejectedAccountCard } from '../accountAccessGates.jsx'
import PatientQrCard from '../components/PatientQrCard.jsx'

const TABS = [
  { id: 'all', label: 'All activity' },
  { id: 'reports', label: 'Reports & imaging' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'vitals', label: 'Vitals history' },
  { id: 'billing', label: 'Billing' },
]

function fmtWhen(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function escHtml(s) {
  if (s == null || s === '') return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseTestReportItems(itemsJson) {
  try {
    const v = JSON.parse(itemsJson || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function formatVitalsLine(v) {
  if (!v) return ''
  const parts = []
  if (v.heart_rate != null) parts.push(`HR ${v.heart_rate}`)
  if (v.systolic_bp != null && v.diastolic_bp != null) parts.push(`BP ${v.systolic_bp}/${v.diastolic_bp}`)
  if (v.spo2 != null) parts.push(`SpO₂ ${v.spo2}%`)
  if (v.temperature != null) parts.push(`Temp ${v.temperature}°F`)
  if (v.blood_sugar != null) parts.push(`Glucose ${v.blood_sugar}`)
  if (v.weight != null) parts.push(`Wt ${v.weight}`)
  if (v.height != null) parts.push(`Ht ${v.height}`)
  if (v.bmi != null) parts.push(`BMI ${Number(v.bmi).toFixed(1)}`)
  return parts.length ? parts.join(' · ') : 'Reading on file'
}

function normalizePatientRecordId(raw) {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

export default function PatientRecordsHub({ user, onToast, onNavigate, onUserProfileRefresh, patientRegistryRevision = 0 }) {
  const [loadError, setLoadError] = useState(null)
  const [chartPatientId, setChartPatientId] = useState(() => normalizePatientRecordId(user?.patient_id))
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [payments, setPayments] = useState([])
  const [vitals, setVitals] = useState([])
  const [dietsCount, setDietsCount] = useState(0)
  const [testReports, setTestReports] = useState([])
  const [pendingRefreshBusy, setPendingRefreshBusy] = useState(false)
  const [recordsRefreshBusy, setRecordsRefreshBusy] = useState(false)

  const loadRecords = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)

    let merged = user
    try {
      const profile = await API.getUserProfile(user.id)
      merged = { ...user, ...profile }
      onUserProfileRefresh?.(profile)
    } catch {
      /* offline or legacy server without /api/auth/user */
    }

    if (merged.approval_status === 'pending' || merged.approval_status === 'rejected') {
      setLoading(false)
      return
    }

    const pid = normalizePatientRecordId(merged.patient_id)
    setChartPatientId(pid)
    const uid = merged.id
    const paymentsReq = pid
      ? API.listPatientPayments(pid).catch(() =>
          uid != null && Number.isFinite(Number(uid))
            ? API.listPayments(uid).catch(() => [])
            : [],
        )
      : uid != null && Number.isFinite(Number(uid))
        ? API.listPayments(uid).catch(() => [])
        : Promise.resolve([])

    if (!pid) {
      try {
        const pay = await paymentsReq
        setDetail(null)
        setAppointments([])
        setPayments(Array.isArray(pay) ? pay : [])
        setVitals([])
        setDietsCount(0)
        setTestReports([])
        setLoadError(null)
      } catch {
        setLoadError('missing_record')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const [d, ap, pay, vit, diets, tests] = await Promise.all([
        API.getPatient(pid),
        API.getAppointments(pid),
        paymentsReq,
        API.getVitals(pid).catch(() => []),
        API.getDiets(pid).catch(() => []),
        API.getTestReports(pid).catch(() => []),
      ])
      setDetail(d)
      setLoadError(null)
      setAppointments(Array.isArray(ap) ? ap : [])
      setPayments(Array.isArray(pay) ? pay : [])
      setVitals(Array.isArray(vit) ? vit : [])
      setDietsCount(Array.isArray(diets) ? diets.length : 0)
      setTestReports(Array.isArray(tests) ? tests : [])
    } catch (err) {
      const hint = err instanceof Error && err.message ? err.message : 'Check that the API is running.'
      if (/not\s*found|patient\s*not\s*found/i.test(hint)) {
        setLoadError('missing_record')
      }
      onToast?.(`Could not load your records. ${hint}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.patient_id, user?.approval_status, onUserProfileRefresh])

  useEffect(() => {
    loadRecords()
  }, [loadRecords, patientRegistryRevision])

  const refreshRecords = async () => {
    setRecordsRefreshBusy(true)
    try {
      await loadRecords()
      onToast?.('Records refreshed.', 'success')
    } finally {
      setRecordsRefreshBusy(false)
    }
  }
  const refreshPendingProfile = async () => {
    if (!user?.id) return
    setPendingRefreshBusy(true)
    try {
      const profile = await API.getUserProfile(user.id)
      onUserProfileRefresh?.(profile)
      if (profile.approval_status === 'approved') {
        onToast?.('Your access is active.', 'success')
        await loadRecords()
      } else {
        onToast?.('Still awaiting approval.', 'info')
      }
    } catch {
      onToast?.('Could not refresh status.', 'error')
    } finally {
      setPendingRefreshBusy(false)
    }
  }

  const activity = useMemo(() => {
    const rows = []
    if (detail?.summary?.updated_at) {
      rows.push({
        key: 'sum',
        when: detail.summary.updated_at,
        icon: '🧬',
        title: 'Clinical summary updated',
        sub: detail.summary.diagnoses || 'EHR summary',
      })
    }
    for (const s of detail?.scans || []) {
      const subParts = [s.assigned_radiologist, s.status].filter(Boolean)
      if (s.report_findings) subParts.push('Radiology report on file')
      rows.push({
        key: `scan-${s.id}`,
        when: s.scheduled_time || detail?.patient?.created_at,
        icon: '🔬',
        title: `${s.scan_type || 'Imaging'} — ${s.status || ''}`,
        sub: subParts.join(' · '),
      })
    }
    for (const a of appointments) {
      rows.push({
        key: `ap-${a.id}`,
        when: a.scheduled_at,
        icon: '📅',
        title: a.title,
        sub: `${a.location || ''} · ${a.status || ''}`,
      })
    }
    for (const p of payments) {
      rows.push({
        key: `pay-${p.id}`,
        when: p.created_at,
        icon: '💳',
        title: `${p.description || 'Payment'} — ₹${p.amount_inr}`,
        sub: p.status || p.method || '',
      })
    }
    for (const tr of testReports) {
      const items = parseTestReportItems(tr.items_json)
      const subParts = [tr.lab_name, tr.status].filter(Boolean)
      if (Array.isArray(items) && items.length) {
        subParts.push(items.slice(0, 4).join(', ') + (items.length > 4 ? '…' : ''))
      }
      rows.push({
        key: `lab-${tr.id}`,
        when: tr.scheduled_at || tr.created_at,
        icon: '🧪',
        title: tr.title || 'Lab / pathology',
        sub: subParts.join(' · '),
      })
    }
    for (const v of vitals.slice(0, 20)) {
      rows.push({
        key: `vit-${v.id}`,
        when: v.recorded_at,
        icon: '📈',
        title: `Vitals — ${v.status || 'Recorded'}`,
        sub: formatVitalsLine(v),
      })
    }
    if (dietsCount) {
      rows.push({
        key: 'diet',
        when: detail?.patient?.created_at,
        icon: '🥗',
        title: `Diet plans`,
        sub: `${dietsCount} plan(s) saved`,
      })
    }
    rows.sort((a, b) => String(b.when).localeCompare(String(a.when)))
    return rows
  }, [detail, appointments, payments, vitals, dietsCount, testReports])

  const downloadBlob = (filename, text, mime) => {
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="glass-card flex-center" style={{ minHeight: 280 }}>
        <div className="spinner" />
      </div>
    )
  }

  if (user?.role === 'patient' && accountApprovalGate(user) === 'pending') {
    return (
      <div className="glass-card" style={{ padding: 24 }}>
        <PendingApprovalCard onRefresh={refreshPendingProfile} busy={pendingRefreshBusy} />
      </div>
    )
  }

  if (user?.role === 'patient' && accountApprovalGate(user) === 'rejected') {
    return (
      <div className="glass-card" style={{ padding: 24 }}>
        <RejectedAccountCard />
      </div>
    )
  }

  if (loadError === 'missing_record') {
    return (
      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ marginTop: 0 }}>We couldn&apos;t open your EHR record</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Your login is still pointing at a patient ID that doesn&apos;t exist in this database (common after a demo reset), or the hospital API returned &quot;Not Found&quot;.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong>Try this:</strong> use <strong>Sign out</strong>, then sign in again so your profile picks up the current record. If the problem persists, your account may need an updated patient record ID in this environment.
        </p>
      </div>
    )
  }

  const p = detail?.patient
  const summary = detail?.summary

  const openMyRecordsPrintReport = () => {
    if (!chartPatientId || !detail) {
      onToast?.('Nothing to export yet — your timeline will show here when data is available.', 'info')
      return
    }
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    const timeStr = now.toLocaleTimeString('en-IN')
    const apptsRows = appointments
      .map(
        (a) =>
          `<tr><td>${escHtml(a.title)}</td><td>${escHtml(fmtWhen(a.scheduled_at))}</td><td>${escHtml(displayCareTeamLabel(a.care_team))}</td><td>${escHtml(a.status)}</td></tr>`,
      )
      .join('')
    const payRows = payments
      .map(
        (pm) =>
          `<tr><td>${escHtml(pm.description)}</td><td>${escHtml(fmtWhen(pm.created_at))}</td><td>₹${escHtml(String(pm.amount_inr))}</td><td>${escHtml(pm.status)}</td></tr>`,
      )
      .join('')
    const labRows = testReports
      .map((tr) => {
        const items = parseTestReportItems(tr.items_json)
        const itemStr = escHtml(items.join(', '))
        return `<tr><td>${escHtml(tr.title)}</td><td>${escHtml(tr.lab_name)}</td><td>${itemStr}</td><td>${escHtml(fmtWhen(tr.scheduled_at))}</td><td>${escHtml(tr.status)}</td><td>${escHtml(tr.result_summary || '—')}</td></tr>`
      })
      .join('')
    const vitalsRows = vitals
      .map(
        (v) =>
          `<tr><td>${escHtml(fmtWhen(v.recorded_at))}</td><td>${escHtml(v.status || '—')}</td><td>${escHtml(formatVitalsLine(v))}</td></tr>`,
      )
      .join('')
    const scansRows = (detail?.scans || [])
      .map((s) => {
        const findings = (s.report_findings || '—').slice(0, 1200)
        return `<tr><td>${escHtml(s.scan_type)}</td><td>${escHtml(s.priority)}</td><td>${escHtml(s.assigned_radiologist)}</td><td>${escHtml(s.status)}</td><td style="white-space:pre-wrap">${escHtml(findings)}${(s.report_findings || '').length > 1200 ? '…' : ''}</td></tr>`
      })
      .join('')
    const summaryBlock = summary
      ? `<div class="section"><h2>Clinical summary</h2><p>${escHtml(summary.summary)}</p><p><strong>Risk score</strong> ${escHtml(String(summary.risk_score))} · <strong>Diagnoses</strong> ${escHtml(summary.diagnoses || '')}</p></div>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Curiva — My records — ${escHtml(displayPersonName(user))}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;color:#1a1a2e;padding:32px;max-width:900px;margin:0 auto;line-height:1.5}
h1{font-size:20px;color:#1a1a9e} h2{font-size:14px;text-transform:uppercase;color:#1a1a9e;border-bottom:1px solid #dde;padding-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0} th{background:#1a1a9e;color:#fff;text-align:left;padding:8px} td{border-bottom:1px solid #eee;padding:8px}
.meta{color:#555;font-size:12px;margin-bottom:24px}
.section{margin-bottom:22px}
@media print{body{padding:16px}}
</style></head><body>
<h1>My records — consolidated report</h1>
<div class="meta">Generated ${escHtml(dateStr)} ${escHtml(timeStr)} · Patient: ${escHtml(p?.name || displayPersonName(user))} · Record #${chartPatientId}</div>
${summaryBlock}
<div class="section"><h2>Imaging</h2>${scansRows ? `<table><thead><tr><th>Type</th><th>Priority</th><th>Radiologist</th><th>Status</th><th>Report / findings</th></tr></thead><tbody>${scansRows}</tbody></table>` : '<p>No imaging rows.</p>'}</div>
<div class="section"><h2>Lab tests &amp; pathology</h2>${labRows ? `<table><thead><tr><th>Order</th><th>Lab</th><th>Tests</th><th>Scheduled</th><th>Status</th><th>Summary</th></tr></thead><tbody>${labRows}</tbody></table>` : '<p>No lab reports on file.</p>'}</div>
<div class="section"><h2>Vitals history</h2>${vitalsRows ? `<table><thead><tr><th>Recorded</th><th>Status</th><th>Values</th></tr></thead><tbody>${vitalsRows}</tbody></table>` : '<p>No vitals logged yet.</p>'}</div>
<div class="section"><h2>Appointments</h2>${apptsRows ? `<table><thead><tr><th>Title</th><th>When</th><th>Care team</th><th>Status</th></tr></thead><tbody>${apptsRows}</tbody></table>` : '<p>No appointments.</p>'}</div>
<div class="section"><h2>Payments</h2>${payRows ? `<table><thead><tr><th>Description</th><th>When</th><th>Amount</th><th>Status</th></tr></thead><tbody>${payRows}</tbody></table>` : '<p>No payments.</p>'}</div>
<p style="font-size:11px;color:#888;margin-top:32px">Demo export — not a legal medical record. For official reports, contact your hospital.</p>
<script>window.onload=function(){window.print()}</script>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) {
      onToast('Allow pop-ups to print or save as PDF', 'error')
      return
    }
    win.document.write(html)
    win.document.close()
    onToast('Report opened — use Print → Save as PDF', 'success')
  }

  return (
    <div>
      <div className="page-title">
        <h2>My records</h2>
        <p>
          Vitals, lab reports, appointments, clinical summaries, imaging, and billing for {p?.name || displayPersonName(user)}
          {p?.site_hospital || p?.site_city
            ? ` · ${[p.site_hospital, p.site_city].filter(Boolean).join(', ')}`
            : ''}
          {chartPatientId ? ` · Record #${chartPatientId}` : ''}
          {' '}in one place. Use Patient Portal or Health Monitor for vitals; book tests in Hospitals &amp; Tests or Order scans &amp; labs where supported.
        </p>
      </div>

      {detail?.qr_card && detail?.qr_text && (
        <div className="glass-card" style={{ marginBottom: 16 }}>
          <PatientQrCard qrCard={detail.qr_card} qrText={detail.qr_text} compact onToast={onToast} />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tag' : ''}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${tab === t.id ? 'rgba(0,229,255,0.35)' : 'var(--border-card)'}`,
              background: tab === t.id ? 'rgba(0,229,255,0.1)' : 'var(--bg-glass)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: tab === t.id ? 700 : 500,
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="tag"
            disabled={recordsRefreshBusy}
            style={{ cursor: recordsRefreshBusy ? 'wait' : 'pointer', fontSize: 12 }}
            onClick={refreshRecords}
          >
            {recordsRefreshBusy ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <button
            type="button"
            className="tag"
            disabled={!chartPatientId || !detail}
            title={chartPatientId && detail ? '' : 'Available once your record has loaded'}
            style={{
              cursor: chartPatientId && detail ? 'pointer' : 'not-allowed',
              fontSize: 12,
              background: 'linear-gradient(135deg, #00e5ff22, #3b82f622)',
              border: '1px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              fontWeight: 600,
              opacity: chartPatientId && detail ? 1 : 0.55,
            }}
            onClick={openMyRecordsPrintReport}
          >
            📥 Download / print report
          </button>
          {typeof onNavigate === 'function' && (
            <>
              <button
                type="button"
                className="tag"
                style={{ cursor: 'pointer', fontSize: 12 }}
                onClick={() => onNavigate('hospitals')}
              >
                Book tests
              </button>
              <button
                type="button"
                className="tag"
                style={{ cursor: 'pointer', fontSize: 12 }}
                onClick={() => onNavigate('order-scans')}
              >
                Order scans &amp; labs
              </button>
              <button
                type="button"
                className="tag"
                style={{ cursor: 'pointer', fontSize: 12 }}
                onClick={() => onNavigate('payments')}
              >
                Pay a bill
              </button>
            </>
          )}
        </span>
      </div>

      {!chartPatientId && !loading && loadError !== 'missing_record' && (
        <div className="glass-card" style={{ marginBottom: 16, padding: 16, borderColor: 'rgba(245, 158, 11, 0.35)' }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>Clinical record is being linked</strong>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
            Your account is active, but the hospital chart ID is still syncing. Tap <strong>Refresh</strong> above — billing
            payments you make will still appear under the Billing tab.
          </p>
        </div>
      )}

      {tab === 'all' && (
        <div className="glass-card" style={{ marginBottom: 16 }}>
          <div className="glass-card-header">
            <div className="glass-card-title">
              <div className="icon">📋</div>
              Recent activity
            </div>
          </div>
          {activity.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.slice(0, 24).map((row) => (
                <div
                  key={row.key}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-card)',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{row.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{row.sub}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtWhen(row.when)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'appointments' && (
        <div className="glass-card" style={{ marginBottom: 16 }}>
          <div className="glass-card-header">
            <div className="glass-card-title">
              <div className="icon">📅</div>
              All appointments
            </div>
            <span className="badge badge-info">{appointments.length}</span>
          </div>
          {appointments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No appointments on file yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {appointments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-card)',
                    background: 'var(--bg-glass)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {fmtWhen(a.scheduled_at)} · {displayCareTeamLabel(a.care_team)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{a.location}</div>
                  {a.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{a.notes}</div>
                  )}
                  <span className={`badge badge-${a.status === 'Completed' ? 'complete' : 'pending'}`} style={{ marginTop: 8, display: 'inline-block' }}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'vitals' && (
        <div className="glass-card" style={{ marginBottom: 16 }}>
          <div className="glass-card-header">
            <div className="glass-card-title">
              <div className="icon">📈</div>
              Vitals history
            </div>
            <span className="badge badge-info">{vitals.length}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Each log from <strong>Patient Portal</strong> or <strong>Health Monitor</strong> is stored on the server and listed here (newest first).
          </p>
          {vitals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No vitals logged yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {vitals.map((v) => (
                <div
                  key={v.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-card)',
                    background: 'var(--bg-glass)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{formatVitalsLine(v)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    {fmtWhen(v.recorded_at)} ·{' '}
                    <span className={`badge badge-${v.status === 'Normal' ? 'complete' : v.status === 'Critical' ? 'pending' : 'info'}`}>{v.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {summary && (
            <div className="glass-card">
              <div className="glass-card-title" style={{ marginBottom: 12 }}>
                <div className="icon">🧬</div>
                Clinical report
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{summary.summary}</div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Risk score</span>
                <strong style={{ fontSize: 16 }}>{summary.risk_score}</strong>
                {summary.diagnoses?.split(',').map((d, i) => (
                  <span key={`${d.trim()}-${i}`} className="tag" style={{ fontSize: 11 }}>
                    {d.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {testReports.length > 0 && (
            <div className="glass-card">
              <div className="glass-card-header">
                <div className="glass-card-title">
                  <div className="icon">🧪</div>
                  Lab tests &amp; pathology reports
                </div>
                <span className="badge badge-info">{testReports.length}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Bookings from <strong>Hospitals &amp; Tests</strong>, <strong>Order scans &amp; labs</strong>, and seeded demo panels are stored in your EHR.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {testReports.map((tr) => {
                  const items = parseTestReportItems(tr.items_json)
                  return (
                    <div
                      key={tr.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-glass)',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{tr.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{tr.lab_name}</div>
                      {Array.isArray(items) && items.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Tests: {items.join(', ')}</div>
                      )}
                      {tr.result_summary && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{tr.result_summary}</div>
                      )}
                      <div
                        style={{
                          marginTop: 10,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {fmtWhen(tr.scheduled_at)} ·{' '}
                          <span className={`badge badge-${tr.status === 'Completed' ? 'complete' : 'pending'}`}>{tr.status}</span>
                        </div>
                        {tr.result_summary ? (
                          <button
                            type="button"
                            className="tag"
                            style={{ cursor: 'pointer', fontSize: 11 }}
                            onClick={() => {
                              const body = `${tr.title}\n${tr.lab_name}\n${fmtWhen(tr.scheduled_at)} · ${tr.status}\n\n${tr.result_summary}`
                              downloadBlob(`curiva-lab-report-${chartPatientId}-${tr.id}.txt`, body, 'text/plain;charset=utf-8')
                              onToast('Lab report downloaded', 'success')
                            }}
                          >
                            Download report
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {detail?.scans?.length > 0 && (
            <div className="glass-card">
              <div className="glass-card-title" style={{ marginBottom: 12 }}>
                <div className="icon">🔬</div>
                Imaging &amp; radiology reports
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {detail.scans.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-card)',
                      background: 'var(--bg-glass)',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span className="tag">{s.scan_type}</span>
                      <span className="badge badge-pending">{s.priority}</span>
                      <span className={`badge badge-${s.status === 'Completed' ? 'complete' : 'pending'}`}>{s.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.assigned_radiologist}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{fmtWhen(s.scheduled_time)}</div>
                    {s.report_findings ? (
                      <pre
                        style={{
                          marginTop: 10,
                          fontSize: 11.5,
                          color: 'var(--text-secondary)',
                          fontFamily: 'inherit',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.5,
                          maxHeight: 220,
                          overflow: 'auto',
                          padding: 10,
                          borderRadius: 8,
                          background: 'rgba(0,0,0,0.15)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {s.report_findings}
                      </pre>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>No typed report on file for this row (legacy seed).</p>
                    )}
                    {s.report_findings ? (
                      <button
                        type="button"
                        className="tag"
                        style={{ cursor: 'pointer', fontSize: 11, marginTop: 10 }}
                        onClick={() => {
                          const body = `${s.scan_type}\n${s.priority} · ${s.status}\n${s.assigned_radiologist}\n${fmtWhen(s.scheduled_time)}\n\n${s.report_findings}`
                          downloadBlob(`curiva-radiology-${chartPatientId}-scan-${s.id}.txt`, body, 'text/plain;charset=utf-8')
                          onToast('Radiology report downloaded', 'success')
                        }}
                      >
                        Download report
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail?.hl7 && (
            <div className="glass-card">
              <div className="glass-card-header">
                <div className="glass-card-title">
                  <div className="icon">📡</div>
                  HL7 message (export)
                </div>
                <button
                  type="button"
                  className="tag"
                  style={{ cursor: 'pointer', fontSize: 12 }}
                  onClick={() => {
                    downloadBlob(`curiva-hl7-patient-${chartPatientId}.txt`, detail.hl7, 'text/plain;charset=utf-8')
                    onToast('HL7 file downloaded', 'success')
                  }}
                >
                  Download .txt
                </button>
              </div>
              <pre
                style={{
                  fontSize: 11,
                  color: 'var(--accent-cyan)',
                  fontFamily: 'JetBrains Mono, monospace',
                  overflowX: 'auto',
                  background: 'var(--bg-glass)',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 220,
                }}
              >
                {detail.hl7}
              </pre>
            </div>
          )}

          {detail?.fhir && Object.keys(detail.fhir).length > 0 && (
            <div className="glass-card">
              <div className="glass-card-header">
                <div className="glass-card-title">
                  <div className="icon">🧾</div>
                  FHIR Patient (JSON)
                </div>
                <button
                  type="button"
                  className="tag"
                  style={{ cursor: 'pointer', fontSize: 12 }}
                  onClick={() => {
                    downloadBlob(
                      `curiva-fhir-patient-${chartPatientId}.json`,
                      JSON.stringify(detail.fhir, null, 2),
                      'application/json;charset=utf-8',
                    )
                    onToast('FHIR JSON downloaded', 'success')
                  }}
                >
                  Download .json
                </button>
              </div>
            </div>
          )}

          {!summary &&
            !(detail?.scans?.length) &&
            !detail?.hl7 &&
            !(detail?.fhir && Object.keys(detail.fhir).length > 0) &&
            testReports.length === 0 && (
            <div className="glass-card">
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                No formal reports are on file yet. Book lab tests from <strong>Hospitals &amp; Tests</strong> (while signed in as a patient with a linked record) or check back after your next visit.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'billing' && (
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title">
              <div className="icon">💳</div>
              Payments & receipts
            </div>
            <span className="badge badge-info">{payments.length}</span>
          </div>
          {payments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No payments yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map((pmt) => (
                <div
                  key={pmt.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-card)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{pmt.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{fmtWhen(pmt.created_at)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>₹{pmt.amount_inr}</div>
                    <span className="badge badge-complete" style={{ marginTop: 4, display: 'inline-block' }}>
                      {pmt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
