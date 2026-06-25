// Same-origin in dev/preview (Vite proxies /api). Set VITE_API_BASE_URL for split deploys.
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function readErrorMessage(res) {
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return `HTTP ${res.status}`
  try {
    const body = await res.json()
    const d = body?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d) && d.length) {
      const parts = d.map((e) => (typeof e === 'object' && e?.msg) ? e.msg : String(e))
      return parts.filter(Boolean).join(' ') || `HTTP ${res.status}`
    }
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`
}

const req = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}

export const API = {
  getStats:      ()   => req('/api/stats'),
  getPatients:   (opts = {}) => {
    const id = opts.forDoctorId
    const q = id != null && id !== '' ? `?for_doctor_id=${encodeURIComponent(String(id))}` : ''
    return req(`/api/patients${q}`)
  },
  getPatient:    (id) => req(`/api/patients/${id}`),
  lookupPatientQr: (token) => req(`/api/patients/qr/${encodeURIComponent(token)}`),
  deletePatient: (patientId, actorId) =>
    req(`/api/patients/${patientId}?actor_id=${encodeURIComponent(String(actorId))}`, { method: 'DELETE' }),
  deleteAllPatients: (actorId) =>
    req(`/api/patients?actor_id=${encodeURIComponent(String(actorId))}`, { method: 'DELETE' }),
  getAppointments: (patientId) => req(`/api/patients/${patientId}/appointments`),
  createAppointment: (patientId, d) =>
    req(`/api/patients/${patientId}/appointments`, { method: 'POST', body: JSON.stringify(d) }),
  getTestReports: (patientId) => req(`/api/patients/${patientId}/test-reports`),
  createTestReport: (patientId, d) =>
    req(`/api/patients/${patientId}/test-reports`, { method: 'POST', body: JSON.stringify(d) }),
  orderImagingScan: (patientId, d) =>
    req(`/api/patients/${patientId}/imaging-scans`, { method: 'POST', body: JSON.stringify(d) }),
  intake:        (d)  => req('/api/intake', { method: 'POST', body: JSON.stringify(d) }),
  getImaging:    ()   => req('/api/imaging'),
  completeScan:  (id) => req(`/api/imaging/${id}/complete`, { method: 'POST' }),
  getTasks:      ()   => req('/api/tasks'),
  getAlerts:     ()   => req('/api/alerts'),
  resolveAlert:  (id) => req(`/api/alerts/${id}/resolve`, { method: 'POST' }),
  ragQuery:      (q)  => req('/api/rag/query', { method: 'POST', body: JSON.stringify({ query: q }) }),
  trainRL:       (ep) => req(`/api/rl/train?episodes=${ep}`, { method: 'POST' }),
  getRLMetrics:  ()   => req('/api/rl/metrics'),
  compareRL:     ()   => req('/api/rl/compare'),
  
  // Auth
  login: (u, p, opts = {}) => {
    const body = { username: u, password: p }
    if (opts.siteCity != null) body.site_city = opts.siteCity
    if (opts.siteHospital != null) body.site_hospital = opts.siteHospital
    return req('/api/auth/login', { method: 'POST', body: JSON.stringify(body) })
  },
  getUserProfile: (userId) => req(`/api/auth/user/${userId}`),
  register:      (d)    => req('/api/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  registerUserByManager: (actorId, d) =>
    req('/api/management/register-user', {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId, ...d }),
    }),

  // Vitals
  getVitals:     (pid)  => req(`/api/patients/${pid}/vitals`),
  addVitals:     (pid, v) => req(`/api/patients/${pid}/vitals`, { method: 'POST', body: JSON.stringify(v) }),
  
  // Diet
  getDiets:      (pid)  => req(`/api/patients/${pid}/diet`),
  generateDiet:  (pid, cond, vegType) => req(`/api/patients/${pid}/diet`, { method: 'POST', body: JSON.stringify({ condition: cond, veg_type: vegType }) }),
  
  // Protocols
  getProtocols:  ()     => req('/api/protocols'),
  getProtocol:   (name) => req(`/api/protocols/${name}`),

  // Payments (demo billing — no live gateway)
  listPayments:       (userId) => req(`/api/payments?user_id=${userId}`),
  listPatientPayments: (patientId) => req(`/api/patients/${patientId}/payments`),
  listPaymentsLedger: () => req('/api/payments/ledger?limit=80'),
  createPayment:      (d) => req('/api/payments', { method: 'POST', body: JSON.stringify(d) }),
}

