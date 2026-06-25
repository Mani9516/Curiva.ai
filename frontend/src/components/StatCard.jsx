export default function StatCard({ label, value, icon, color = 'cyan', sub }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-header">
        <div className="stat-label">{label}</div>
        <div className={`stat-icon ${color}`}>{icon}</div>
      </div>
      <div className={`stat-value ${color}`}>{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className={`stat-glow ${color}`} />
    </div>
  )
}
