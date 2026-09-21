// Which FHIR Patient this browser is logging symptoms against. Prelude has no
// patient login, so the id from the most recent check-in is remembered here and
// reused by /timeline, keeping the symptom log on the same record the voice
// agent later reads history from.

const PATIENT_ID_KEY = 'prelude-patient-id';
const PATIENT_NAME_KEY = 'prelude-patient-name';

export interface PatientSession {
  patientId: string;
  patientName?: string;
}

export function getPatientSession(): PatientSession | null {
  if (typeof window === 'undefined') return null;
  const patientId = localStorage.getItem(PATIENT_ID_KEY);
  if (!patientId) return null;
  return { patientId, patientName: localStorage.getItem(PATIENT_NAME_KEY) ?? undefined };
}

export function savePatientSession(session: PatientSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PATIENT_ID_KEY, session.patientId);
  if (session.patientName) localStorage.setItem(PATIENT_NAME_KEY, session.patientName);
}
