import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

/**
 * Renders a patient identity QR (encodes qr_text from API) plus a readable summary for staff.
 */
export default function PatientQrCard({ qrCard, qrText, compact = false, onToast }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const payload = (qrText || '').trim()
    if (!canvas || !payload) return
    QRCode.toCanvas(canvas, payload, {
      width: compact ? 140 : 200,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {
      onToast?.('Could not render QR code', 'error')
    })
  }, [qrText, compact, onToast])

  if (!qrCard?.token && !qrText) return null

  const downloadPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const name = (qrCard?.name || 'patient').replace(/\s+/g, '_')
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `Curiva-QR-${name}-${qrCard?.patient_id || 'record'}.png`
    a.click()
    onToast?.('QR card downloaded', 'success')
  }

  return (
    <div
      className="patient-qr-card"
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        gap: compact ? 16 : 14,
        alignItems: compact ? 'flex-start' : 'stretch',
        padding: compact ? '12px 14px' : '16px 18px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-card)',
        background: 'var(--bg-glass)',
      }}
    >
      <div style={{ flexShrink: 0, textAlign: 'center' }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Patient QR code for ${qrCard?.name || 'record'}`}
          style={{
            display: 'block',
            borderRadius: 8,
            background: '#fff',
            padding: 6,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        />
        <button
          type="button"
          className="tag"
          style={{ marginTop: 8, cursor: 'pointer', fontSize: 11 }}
          onClick={downloadPng}
        >
          Download QR
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: compact ? 13 : 14, marginBottom: 6 }}>
          Patient ID card (QR)
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
          Unique code for front-desk check-in and EHR lookup. Scan to read name, record ID, hospital site, and portal contact.
        </p>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? 'auto 1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: '6px 12px',
            fontSize: 12,
            margin: 0,
          }}
        >
          <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Token</dt>
          <dd style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{qrCard?.token}</dd>
          <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Record</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>#{qrCard?.patient_id}</dd>
          <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Name</dt>
          <dd style={{ margin: 0 }}>{qrCard?.name}</dd>
          <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Age / gender</dt>
          <dd style={{ margin: 0 }}>
            {qrCard?.age} · {qrCard?.gender}
          </dd>
          {(qrCard?.site_hospital || qrCard?.site_city) && (
            <>
              <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Site</dt>
              <dd style={{ margin: 0 }}>
                {[qrCard?.site_hospital, qrCard?.site_city].filter(Boolean).join(' · ')}
              </dd>
            </>
          )}
          {qrCard?.email && (
            <>
              <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Email</dt>
              <dd style={{ margin: 0 }}>{qrCard.email}</dd>
            </>
          )}
          {qrCard?.portal_username && (
            <>
              <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Portal</dt>
              <dd style={{ margin: 0 }}>@{qrCard.portal_username}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
