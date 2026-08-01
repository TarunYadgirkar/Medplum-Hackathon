import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createIntake } from '@/lib/store';
import { demoHistoryDocs, indexPatientHistory } from '@/lib/moss';
import { buildFhirHistoryDocs } from '@/lib/fhir-history';
import { sanitizeField } from '@/lib/medcard';

const Schema = z.object({
  patientName: z.string().min(1).max(200),
  appointmentType: z.string().max(200).optional(),
  ageRange: z.string().max(50).optional(),
  // Chart data the patient imported client-side (Epic MyChart simulation).
  historyDocs: z.array(z.object({ text: z.string().min(1).max(2000) })).max(40).optional(),
});

// Starts an intake: creates the FHIR Patient + Encounter in Medplum and
// seeds the Moss history index so the agent can retrieve context mid-call.
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { patientName, appointmentType, ageRange, historyDocs } = parsed.data;

  const { patientId, encounterId } = await createIntake({
    name: patientName,
    appointmentType,
    ageRange,
  });

  // History priority: patient-imported chart docs first, then the returning
  // patient's real FHIR record, demo docs only when neither exists.
  const fhirDocs = await buildFhirHistoryDocs(patientName, patientId);
  // Sanitize server-side too — the client sanitizer is bypassable via direct POST,
  // and these strings reach two LLM prompts (history lookup + note generation).
  const imported = (historyDocs ?? [])
    .map((d, i) => ({ id: `imported-${i}`, text: sanitizeField(d.text, 2000), metadata: { source: 'mychart-import' } }))
    .filter((d) => d.text.length > 0);
  const combined = [...imported, ...fhirDocs];
  await indexPatientHistory(patientId, combined.length ? combined : demoHistoryDocs(patientName));

  return NextResponse.json({ patientId, encounterId });
}
