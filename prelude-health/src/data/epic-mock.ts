// Static simulation of an Epic FHIR R4 patient record (SMART on FHIR).
// No real OAuth or network calls — architecturally correct shape, ready to be
// swapped for a real FHIR client when app registration is in place.

export interface EpicSystem {
  id: string;
  name: string;
  logo: string;
  fhirBase: string;
}

export const EPIC_SYSTEMS: EpicSystem[] = [
  { id: 'sutter', name: 'Sutter Health', logo: '🏥', fhirBase: 'https://example.test/fhir/sutter/R4' },
  { id: 'kaiser', name: 'Kaiser Permanente', logo: '🏥', fhirBase: 'https://example.test/fhir/kaiser/R4' },
  { id: 'ucsf', name: 'UCSF Health', logo: '🏥', fhirBase: 'https://example.test/fhir/ucsf/R4' },
  { id: 'stanford', name: 'Stanford Health Care', logo: '🏥', fhirBase: 'https://example.test/fhir/stanford/R4' },
  { id: 'mayo', name: 'Mayo Clinic', logo: '🏥', fhirBase: 'https://example.test/fhir/mayo/R4' },
  { id: 'cleveland', name: 'Cleveland Clinic', logo: '🏥', fhirBase: 'https://example.test/fhir/cleveland/R4' },
  { id: 'mgb', name: 'Mass General Brigham', logo: '🏥', fhirBase: 'https://example.test/fhir/mgb/R4' },
  { id: 'nyp', name: 'NewYork-Presbyterian', logo: '🏥', fhirBase: 'https://example.test/fhir/nyp/R4' },
  { id: 'cedars', name: 'Cedars-Sinai', logo: '🏥', fhirBase: 'https://example.test/fhir/cedars/R4' },
  { id: 'hopkins', name: 'Johns Hopkins Medicine', logo: '🏥', fhirBase: 'https://example.test/fhir/hopkins/R4' },
  { id: 'northwestern', name: 'Northwestern Medicine', logo: '🏥', fhirBase: 'https://example.test/fhir/northwestern/R4' },
  { id: 'mountsinai', name: 'Mount Sinai Health System', logo: '🏥', fhirBase: 'https://example.test/fhir/mountsinai/R4' },
  { id: 'providence', name: 'Providence', logo: '🏥', fhirBase: 'https://example.test/fhir/providence/R4' },
  { id: 'ascension', name: 'Ascension', logo: '🏥', fhirBase: 'https://example.test/fhir/ascension/R4' },
  { id: 'intermountain', name: 'Intermountain Healthcare', logo: '🏥', fhirBase: 'https://example.test/fhir/intermountain/R4' },
  { id: 'upmc', name: 'UPMC', logo: '🏥', fhirBase: 'https://example.test/fhir/upmc/R4' },
  { id: 'duke', name: 'Duke Health', logo: '🏥', fhirBase: 'https://example.test/fhir/duke/R4' },
  { id: 'vanderbilt', name: 'Vanderbilt Health', logo: '🏥', fhirBase: 'https://example.test/fhir/vanderbilt/R4' },
  { id: 'penn', name: 'Penn Medicine', logo: '🏥', fhirBase: 'https://example.test/fhir/penn/R4' },
  { id: 'nyulangone', name: 'NYU Langone Health', logo: '🏥', fhirBase: 'https://example.test/fhir/nyulangone/R4' },
  { id: 'houstonmethodist', name: 'Houston Methodist', logo: '🏥', fhirBase: 'https://example.test/fhir/houstonmethodist/R4' },
  { id: 'banner', name: 'Banner Health', logo: '🏥', fhirBase: 'https://example.test/fhir/banner/R4' },
  { id: 'ohiohealth', name: 'OhioHealth', logo: '🏥', fhirBase: 'https://example.test/fhir/ohiohealth/R4' },
  { id: 'geisinger', name: 'Geisinger', logo: '🏥', fhirBase: 'https://example.test/fhir/geisinger/R4' },
];

export const EPIC_FHIR_MOCK = {
  patient: {
    name: 'Maya Patel',
    dob: '1988-04-15',
    mrn: 'E2847163',
    facility: 'Sutter Health Palo Alto Medical Foundation',
    primaryProvider: 'Dr. Sarah Chen, MD — Internal Medicine',
  },
  medications: [
    { name: 'Lisinopril 10 MG Oral Tablet', frequency: '1 tablet once daily', prescriber: 'Dr. Sarah Chen', started: '2023-02' },
    { name: 'Metformin HCl 500 MG Oral Tablet', frequency: '1 tablet twice daily with meals', prescriber: 'Dr. Sarah Chen', started: '2024-07' },
  ],
  allergies: [
    { substance: 'Penicillin', reaction: 'Urticaria (hives)', severity: 'Moderate', recorded: '2019-08' },
  ],
  conditions: [
    { name: 'Essential hypertension', icd10: 'I10', status: 'Active', diagnosed: '2023-01' },
    { name: 'Prediabetes', icd10: 'R73.09', status: 'Active', diagnosed: '2024-06' },
  ],
  recentEncounters: [
    { date: '2026-05-15', type: 'Office visit — Annual physical', provider: 'Dr. Sarah Chen', facility: 'Sutter Palo Alto' },
    { date: '2026-02-03', type: 'Urgent care visit — Upper respiratory infection', provider: 'NP Anita Torres', facility: 'Sutter Express Care' },
  ],
  labResults: [
    { name: 'Hemoglobin A1c (HbA1c)', value: '6.1%', date: '2026-05-15', reference: 'Normal < 5.7% | Prediabetes 5.7–6.4% | Diabetes ≥ 6.5%', flag: 'HIGH_NORMAL' },
    { name: 'eGFR (kidney function)', value: '87 mL/min/1.73m²', date: '2026-05-15', reference: 'Normal ≥ 60', flag: 'NORMAL' },
    { name: 'Blood Pressure', value: '128/82 mmHg', date: '2026-05-15', reference: 'Optimal < 120/80', flag: 'ELEVATED' },
    { name: 'LDL Cholesterol', value: '118 mg/dL', date: '2026-05-15', reference: 'Optimal < 100 mg/dL', flag: 'BORDERLINE' },
    { name: 'Serum Creatinine', value: '0.9 mg/dL', date: '2026-05-15', reference: 'Normal 0.6–1.1', flag: 'NORMAL' },
  ],
  immunizations: [
    { name: 'COVID-19 mRNA booster', date: '2025-10-12' },
    { name: 'Influenza, quadrivalent', date: '2025-09-28' },
    { name: 'Tdap (tetanus, diphtheria, pertussis)', date: '2019-04-03' },
  ],
  upcomingVisits: [
    { date: '2026-08-15', type: 'Office visit — Annual physical', provider: 'Dr. Sarah Chen' },
  ],
};

export type EpicImportResult = typeof EPIC_FHIR_MOCK;

export type LabFlag = 'NORMAL' | 'HIGH_NORMAL' | 'ELEVATED' | 'BORDERLINE' | 'HIGH' | 'LOW';

export const LAB_FLAG_STYLES: Record<string, string> = {
  NORMAL: 'bg-emerald-50 text-emerald-600',
  HIGH_NORMAL: 'bg-amber-50 text-amber-600',
  ELEVATED: 'bg-amber-50 text-amber-600',
  BORDERLINE: 'bg-amber-50 text-amber-600',
  HIGH: 'bg-red-50 text-red-600',
  LOW: 'bg-red-50 text-red-600',
};
