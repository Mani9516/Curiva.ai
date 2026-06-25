export const INDIAN_FIRST = [
  'Priya', 'Rajesh', 'Anita', 'Vikram', 'Sunita', 'Arjun', 'Meera', 'Kiran',
  'Deepa', 'Sanjay', 'Rohit', 'Lakshmi', 'Ananya', 'Rajiv', 'Aditya', 'Neha',
  'Rahul', 'Kartik', 'Divya', 'Suresh', 'Pooja', 'Amit', 'Nisha', 'Gaurav',
  'Kavita', 'Harish', 'Swati', 'Manoj', 'Ritu', 'Varun', 'Sneha', 'Pranav',
  'Shreya', 'Ashok', 'Leela', 'Siddharth', 'Tanvi', 'Ramesh', 'Padma', 'Ishaan',
]

export const INDIAN_LAST = [
  'Menon', 'Sharma', 'Iyer', 'Patel', 'Reddy', 'Nair', 'Kapoor', 'Singh',
  'Das', 'Joshi', 'Banerjee', 'Venkatesh', 'Gupta', 'Malhotra', 'Chatterjee',
  'Pillai', 'Kulkarni', 'Desai', 'Rao', 'Mehta', 'Agarwal', 'Bose', 'Krishnan',
  'Mishra', 'Hegde', 'Chopra', 'Saxena', 'Bhatt', 'Ghosh', 'Shetty',
]

export const FALLBACK_DOCTOR_DISPLAY_NAME = 'Dr. Vikram Menon'

export function hashString(s) {
  let h = 2166136261
  const str = String(s)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic Indian clinician name from a seed string (e.g. department name). */
export function pickIndianDoctorName(seed, offset = 0) {
  const h = hashString(`${seed}:${offset}`)
  const first = INDIAN_FIRST[h % INDIAN_FIRST.length]
  const last = INDIAN_LAST[(h >> 4) % INDIAN_LAST.length]
  return `Dr. ${first} ${last}`
}

/** Deterministic admin / coordinator name from a seed string. */
export function pickIndianStaffName(seed, offset = 0) {
  const h = hashString(`${seed}:staff:${offset}`)
  const first = INDIAN_FIRST[(h >> 2) % INDIAN_FIRST.length]
  const last = INDIAN_LAST[(h >> 6) % INDIAN_LAST.length]
  const honorific = h % 2 ? 'Ms.' : 'Mr.'
  return `${honorific} ${first} ${last}`
}
