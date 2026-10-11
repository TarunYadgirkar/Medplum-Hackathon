// Seeds 3 realistic demo patients through the real HTTP API so the provider
// dashboard has live-looking data for the demo video. Run: npx tsx scripts/seed-demo.ts

import { DEMO_PATIENTS as PATIENTS, type DemoPatient } from '../src/data/demo-patients';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function assertOk(res: Response, body: unknown, label: string): void {
  if (!res.ok) {
    console.error(`FAILED ${label}: ${res.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }
}

// Allergies + active meds written straight to Medplum so buildFhirHistoryDocs
// has real clinical background to retrieve when the same name checks in again.
async function seedClinicalBackground(patientId: string, patient: DemoPatient): Promise<void> {
  if (!process.env.MEDPLUM_CLIENT_ID || !process.env.MEDPLUM_CLIENT_SECRET) {
    console.log('MEDPLUM_CLIENT_ID/SECRET not set — skipping allergy/medication seeding');
    return;
  }
  const medplumBase = process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com/';
  const tokenRes = await fetch(`${medplumBase}oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.MEDPLUM_CLIENT_ID,
      client_secret: process.env.MEDPLUM_CLIENT_SECRET,
    }),
  });
  const tokenBody = await tokenRes.json();
  assertOk(tokenRes, tokenBody, 'medplum token');
  const create = async (resource: Record<string, unknown>) => {
    const res = await fetch(`${medplumBase}fhir/R4/${resource.resourceType}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBody.access_token}`, 'Content-Type': 'application/fhir+json' },
      body: JSON.stringify(resource),
    });
    const body = await res.json();
    assertOk(res, body, `create ${resource.resourceType}`);
    console.log(`created ${resource.resourceType}/${body.id}`);
  };

  for (const allergy of patient.allergies || []) {
    await create({
      resourceType: 'AllergyIntolerance',
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
      patient: { reference: `Patient/${patientId}`, display: patient.name },
      code: { text: allergy.substance },
      reaction: [{ manifestation: [{ text: allergy.reaction }] }],
    });
  }
  for (const med of patient.medications || []) {
    await create({
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      subject: { reference: `Patient/${patientId}`, display: patient.name },
      medicationCodeableConcept: { text: med.name },
      dosageInstruction: [{ text: med.dosage }],
    });
  }
}

// Patient-logged symptoms land on the same FHIR Patient as the visit, so the
// agent retrieves them through lookup_patient_history on the next check-in.
async function seedSymptoms(patientId: string, patient: DemoPatient): Promise<void> {
  for (const symptom of patient.symptoms || []) {
    const onset = new Date(Date.now() - symptom.daysAgo * 86_400_000).toISOString();
    const res = await fetch(`${BASE_URL}/api/symptoms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, text: symptom.text, severity: symptom.severity, onset }),
    });
    const body = await res.json();
    assertOk(res, body, 'symptoms POST');
    console.log(`logged symptom ${body.id} (${symptom.daysAgo}d ago)`);
  }
}

async function seedPatient(patient: DemoPatient): Promise<void> {
  console.log(`\n--- Seeding ${patient.name} (target: ${patient.targetStatus}/${patient.targetRisk}) ---`);

  const sessionRes = await fetch(`${BASE_URL}/api/intake-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientName: patient.name,
      ageRange: patient.ageRange,
      appointmentType: patient.appointmentType,
    }),
  });
  const session = await sessionRes.json();
  assertOk(sessionRes, session, 'intake-session');
  const { patientId, encounterId } = session;
  console.log(`patientId=${patientId} encounterId=${encounterId}`);

  const noteRes = await fetch(`${BASE_URL}/api/generate-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: patient.transcript,
      patientId,
      encounterId,
      patientName: patient.name,
    }),
  });
  const noteBody = await noteRes.json();
  assertOk(noteRes, noteBody, 'generate-note');
  const noteId: string = noteBody.noteId;
  const generatedRisk = noteBody.result?.risk?.level;
  console.log(`noteId=${noteId} generatedRisk=${generatedRisk}`);

  const patchRes = await fetch(`${BASE_URL}/api/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: patient.targetStatus, riskLevel: patient.targetRisk }),
  });
  const patchBody = await patchRes.json();
  assertOk(patchRes, patchBody, 'notes PATCH');

  await seedClinicalBackground(patientId, patient);
  await seedSymptoms(patientId, patient);

  const verifyRes = await fetch(`${BASE_URL}/api/notes/${noteId}`);
  const verifyBody = await verifyRes.json();
  assertOk(verifyRes, verifyBody, 'notes GET verify');
  console.log(
    `FINAL ${patient.name}: patientId=${patientId} noteId=${noteId} status=${verifyBody.status} risk=${verifyBody.risk_level}`
  );
}

async function main(): Promise<void> {
  console.log(`Seeding demo data against ${BASE_URL}`);
  for (const patient of PATIENTS) {
    await seedPatient(patient);
  }

  const patientsRes = await fetch(`${BASE_URL}/api/patients`);
  const rows = await patientsRes.json();
  assertOk(patientsRes, rows, 'patients GET');
  console.log(`\nDashboard now has ${rows.length} total patient rows.`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed script crashed:', err);
  process.exit(1);
});

export {};
