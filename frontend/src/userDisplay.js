import { FALLBACK_DOCTOR_DISPLAY_NAME } from './data/indianDoctorNames.js'

/** Shown when `full_name` is missing or corrupted (e.g. legacy rows, bad localStorage). */
export { FALLBACK_DOCTOR_DISPLAY_NAME }

/**
 * Human-readable name for header/sidebar/toasts. Prefer `full_name`, then `username`, then a role-appropriate demo label.
 * @param {{ full_name?: string, username?: string, role?: string } | null | undefined} user
 */
export function displayPersonName(user) {
  if (!user) return 'Portal member'
  const raw = (user.full_name ?? '').toString().trim()
  if (raw && raw.toLowerCase() !== 'undefined') return raw
  const u = (user.username ?? '').toString().trim()
  if (u) return u
  if (user.role === 'doctor') return FALLBACK_DOCTOR_DISPLAY_NAME
  if (user.role === 'manager') return 'Hospital administrator'
  return 'Portal member'
}

/** Hospitals roster / booking modal — clinician row object uses `name`. */
export function displayDoctorBookingName(doctor) {
  const n = (doctor?.name ?? '').toString().trim()
  if (n && n.toLowerCase() !== 'undefined') return n
  return FALLBACK_DOCTOR_DISPLAY_NAME
}

/** Appointment / roster line — never show the JS string "undefined". */
export function displayCareTeamLabel(value) {
  const s = (value ?? '').toString().trim()
  if (!s || s.toLowerCase() === 'undefined') return 'Curiva care team'
  return s
}
