import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteSymptom, listSymptoms, logSymptom } from '@/lib/symptoms';
import { rateLimit } from '@/lib/rate-limit';

// Patient ids travel in a header or a JSON body, never in the URL, so nothing
// identifying lands in access logs or a browser history entry.
const PATIENT_HEADER = 'x-patient-id';

const PatientId = z.string().min(1).max(200);

const CreateSchema = z.object({
  patientId: PatientId,
  text: z.string().min(1).max(400),
  severity: z.number().int().min(1).max(10),
  onset: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  tags: z.array(z.string().min(1).max(40)).max(8).optional(),
});

const DeleteSchema = z.object({ patientId: PatientId, id: z.string().min(1).max(200) });

function badRequest() {
  return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
}

function serverError(label: string, err: unknown) {
  console.error(`${label} failed:`, err);
  return NextResponse.json({ error: 'Symptom log is unavailable right now' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'symptoms');
  if (limited) return limited;
  const parsed = PatientId.safeParse(req.headers.get(PATIENT_HEADER));
  if (!parsed.success) return badRequest();
  try {
    return NextResponse.json(await listSymptoms(parsed.data));
  } catch (err) {
    return serverError('listSymptoms', err);
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'symptoms');
  if (limited) return limited;
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  try {
    return NextResponse.json(await logSymptom(parsed.data), { status: 201 });
  } catch (err) {
    return serverError('logSymptom', err);
  }
}

export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, 'symptoms');
  if (limited) return limited;
  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  try {
    const deleted = await deleteSymptom(parsed.data.id, parsed.data.patientId);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('deleteSymptom', err);
  }
}
