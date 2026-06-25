/** Legacy accounts may still have approval_status pending/rejected from older builds. */

export function accountApprovalGate(user) {
  const s = user?.approval_status
  if (s === 'pending') return 'pending'
  if (s === 'rejected') return 'rejected'
  return null
}

export function PendingApprovalCard({ onRefresh, busy }) {
  return (
    <div className="glass-card" style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <h3 style={{ marginTop: 0 }}>Account pending activation</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 16 }}>
        This login is still marked pending. Try refreshing your profile, or sign out and sign in again. If the issue persists, contact your clinic.
      </p>
      {typeof onRefresh === 'function' && (
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onRefresh}>
          {busy ? 'Checking…' : 'I was approved — refresh status'}
        </button>
      )}
    </div>
  )
}

export function RejectedAccountCard() {
  return (
    <div className="glass-card" style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <h3 style={{ marginTop: 0 }}>Account not approved</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        This registration was not approved for Curiva access. Please contact your clinic if you believe this is a mistake, or
        use <strong>Sign out</strong> and register again with corrected information.
      </p>
    </div>
  )
}
