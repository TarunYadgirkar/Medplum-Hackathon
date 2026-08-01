import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createIntake } from '@/lib/store';
import { demoHistoryDocs, indexPatientHistory } from '@/lib/moss';
import { buildFhirHistoryDocs } from '@/lib/fhir-history';

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

  // Real history from the returning patient's FHIR record; demo docs when new/keyless.
  const fhirDocs = await buildFhirHistoryDocs(patientName, patientId);
  await indexPatientHistory(patientId, fhirDocs.length ? fhirDocs : demoHistoryDocs(patientName));

  return NextResponse.json({ patientId, encounterId });
}
