/**
 * Clinical & operational departments shown for a selected hospital
 * (Hospitals & Tests → Departments & services tab).
 */
export const HOSPITAL_DEPARTMENT_GROUPS = [
  {
    title: 'Emergency & Critical Care',
    icon: '🚨',
    color: '#ef4444',
    departments: [
      { name: 'Accident & Emergency', description: 'Instant life-saving care.' },
      { name: 'Intensive Care Unit', description: 'Constant critical monitoring.' },
      { name: 'Neonatal ICU', description: 'Newborn intensive medical care.' },
      { name: 'Pediatric ICU', description: 'Child intensive medical care.' },
      { name: 'Coronary Care Unit', description: 'Serious heart condition monitoring.' },
    ],
  },
  {
    title: 'Medicine & General Specialities',
    icon: '🩺',
    color: '#0ea5e9',
    departments: [
      { name: 'General Medicine', description: 'Adult chronic and acute illness care.' },
      { name: 'Pediatrics', description: 'Child health and development.' },
      { name: 'Geriatrics', description: 'Elderly healthcare and needs.' },
      { name: 'Dermatology', description: 'Skin, hair, and nail disorders.' },
      { name: 'Psychiatry', description: 'Mental health disorder treatment.' },
      { name: 'Neurology', description: 'Non-surgical nervous system care.' },
      { name: 'Cardiology', description: 'Heart health and management.' },
      { name: 'Gastroenterology', description: 'Digestive system disorder treatment.' },
      { name: 'Nephrology', description: 'Kidney disease and dialysis.' },
      { name: 'Pulmonology', description: 'Respiratory and lung care.' },
      { name: 'Endocrinology', description: 'Diabetes and hormone disorders.' },
      { name: 'Rheumatology', description: 'Autoimmune and joint diseases.' },
      { name: 'Oncology', description: 'Medical cancer treatments and chemotherapy.' },
      { name: 'Hematology', description: 'Blood disorders and diseases.' },
      { name: 'Infectious Diseases', description: 'Complex contagious illness care.' },
    ],
  },
  {
    title: 'Surgical Specialities',
    icon: '🔪',
    color: '#8b5cf6',
    departments: [
      { name: 'General Surgery', description: 'Abdominal and soft tissue surgery.' },
      { name: 'Orthopedics', description: 'Bone and joint surgery.' },
      { name: 'OB-GYN', description: 'Pregnancy and female health.' },
      { name: 'Neurosurgery', description: 'Brain and spine surgery.' },
      { name: 'Cardiothoracic Surgery', description: 'Heart and lung surgery.' },
      { name: 'Urology', description: 'Urinary tract surgery.' },
      { name: 'Plastic Surgery', description: 'Reconstructive and cosmetic surgery.' },
      { name: 'Ophthalmology', description: 'Eye care and surgery.' },
      { name: 'ENT', description: 'Ear, nose, and throat surgery.' },
      { name: 'Pediatric Surgery', description: 'Specialized surgery for children.' },
      { name: 'Vascular Surgery', description: 'Blood vessel surgical repair.' },
    ],
  },
  {
    title: 'Clinical Support & Diagnostics',
    icon: '🔬',
    color: '#10b981',
    departments: [
      { name: 'Radiology', description: 'X-rays, CTs, and MRIs.' },
      { name: 'Pathology', description: 'Blood and tissue testing.' },
      { name: 'Anesthesiology', description: 'Pain relief for surgery.' },
      { name: 'Pharmacy', description: 'Medication dispensing and guidance.' },
      { name: 'Physiotherapy', description: 'Physical movement rehabilitation therapy.' },
      { name: 'Occupational Therapy', description: 'Daily life skill recovery.' },
      { name: 'Speech Therapy', description: 'Speech and swallowing therapy.' },
      { name: 'Dietetics', description: 'Nutrition and meal planning.' },
    ],
  },
  {
    title: 'Operations & Administration',
    icon: '🏢',
    color: '#64748b',
    departments: [
      { name: 'Outpatient Department', description: 'Consultations without overnight stays.' },
      { name: 'Medical Records', description: 'Secure patient file management.' },
      { name: 'Billing & Insurance', description: 'Financial handling and claims.' },
      { name: 'Social Services', description: 'Patient community support resources.' },
    ],
  },
]

import { hashString, pickIndianDoctorName, pickIndianStaffName } from './indianDoctorNames.js'

function deptKind(name) {
  if (/Medical Records|Billing|Insurance|Social Services/i.test(name)) return 'admin'
  if (/Pharmacy|Dietetics|Physiotherapy|Occupational|Speech|Radiology|Pathology|Anesthesiology/i.test(name)) return 'allied'
  return 'clinical'
}

/**
 * Deterministic demo roster: every department gets two "available" clinicians or staff.
 */
export function getDoctorsForDepartment(departmentName) {
  const h = hashString(departmentName)
  const kind = deptKind(departmentName)
  const name1 = pickIndianDoctorName(departmentName, 0)
  const name2 = pickIndianDoctorName(departmentName, 1)
  const exp1 = 6 + (h % 18)
  const exp2 = 4 + ((h >> 6) % 20)

  const baseId = `d-${h.toString(36)}`

  if (kind === 'admin') {
    return [
      {
        id: `${baseId}-a1`,
        name: pickIndianStaffName(departmentName, 0),
        role: 'Department lead',
        qualifications: 'MHA, PGDHA',
        experienceYears: Math.max(5, exp1 - 2),
        focus: `${departmentName} — process & patient support`,
        availability: 'Mon–Fri · 10:00 AM – 5:00 PM',
      },
      {
        id: `${baseId}-a2`,
        name: pickIndianStaffName(departmentName, 1),
        role: 'Senior coordinator',
        qualifications: 'MBA (Healthcare), CHFP',
        experienceYears: Math.max(4, exp2 - 1),
        focus: `${departmentName} — scheduling & documentation`,
        availability: 'Mon–Sat · 9:00 AM – 4:00 PM',
      },
    ]
  }

  if (kind === 'allied') {
    const q1 = /Pharmacy/i.test(departmentName) ? 'PharmD, BCPS' : /Radiology|Pathology/i.test(departmentName) ? 'MD, DNB' : 'MPT / BSc + PG Dip'
    const q2 = /Anesthesiology/i.test(departmentName) ? 'MD (Anaesthesia), FICA' : 'MD, Fellowship'
    return [
      {
        id: `${baseId}-l1`,
        name: name1,
        role: 'Senior consultant',
        qualifications: q1,
        experienceYears: exp1,
        focus: `${departmentName} — diagnostics & care pathways`,
        availability: 'Mon–Sat · 9:00 AM – 1:00 PM',
      },
      {
        id: `${baseId}-l2`,
        name: name2,
        role: 'Consultant',
        qualifications: q2,
        experienceYears: exp2,
        focus: `${departmentName} — procedures & follow-up`,
        availability: 'Tue–Sun · 2:00 PM – 7:00 PM',
      },
    ]
  }

  return [
    {
      id: `${baseId}-c1`,
      name: name1,
      role: 'Senior consultant',
      qualifications: 'MD, DNB',
      experienceYears: exp1,
      focus: `${departmentName} — outpatient & inpatient`,
      availability: 'Mon–Sat · 9:00 AM – 1:00 PM',
    },
    {
      id: `${baseId}-c2`,
      name: name2,
      role: 'Consultant',
      qualifications: 'MS / MD, Fellowship',
      experienceYears: exp2,
      focus: `${departmentName} — specialist clinics`,
      availability: 'Mon–Fri · 3:00 PM – 7:00 PM',
    },
  ]
}
