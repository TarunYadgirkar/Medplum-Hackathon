import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createIntake } from '@/lib/store';
import { demoHistoryDocs, indexPatientHistory } from '@/lib/moss';

const Schema = z.object({
  patientName: z.string().min(1).max(200),
  appointmentType: z.string().max(200).optional(),
  ageRange: z.string().max(50).optional(),
});

// Starts an intake: creates the FHIR Patient + Encounter in Medplum and
// seeds the Moss history index so the agent can retrieve context mid-call.
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { patientName, appointmentType, ageRange } = parsed.data;

  const { patientId, encounterId } = await createIntake({
    name: patientName,
    appointmentType,
    ageRange,
  });

  // Seed demo history (in production: built from the patient's FHIR record).
  await indexPatientHistory(patientId, demoHistoryDocs(patientName));

  return NextResponse.json({ patientId, encounterId });
}
