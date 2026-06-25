/** Role-specific suggested prompts for Ask Curiva AI */
export const RAG_ROLE_CONFIG = {
  doctor: {
    greeting: 'What can I help with?',
    subtitle: 'Clinical guidelines, radiology workflows, and treatment protocols',
    suggestions: [
      'How to diagnose and treat pneumonia?',
      'ACS and chest pain emergency management?',
      'When should I order an MRI vs CT scan?',
      'What is the protocol for acute appendicitis?',
    ],
  },
  manager: {
    greeting: 'What can I help with?',
    subtitle: 'Hospital operations, billing workflows, and patient services',
    suggestions: [
      'How do outpatient billing and insurance claims work?',
      'What is the patient registration approval workflow?',
      'How should we triage emergency department capacity?',
      'What lab panels are included in executive health checkups?',
    ],
  },
  patient: {
    greeting: 'What can I help with?',
    subtitle: 'Your health questions, diet plans, and care guidance',
    suggestions: [
      'What do elevated TSH levels usually mean?',
      'How can I manage PCOD with diet and lifestyle?',
      'When should I go to the emergency room?',
      'What should I know before a thyroid ultrasound?',
    ],
  },
}

export function getRagConfigForRole(role) {
  if (role === 'doctor') return RAG_ROLE_CONFIG.doctor
  if (role === 'manager') return RAG_ROLE_CONFIG.manager
  return RAG_ROLE_CONFIG.patient
}
