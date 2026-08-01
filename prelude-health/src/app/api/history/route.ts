import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryPatientHistory } from '@/lib/moss';

const Schema = z.object({
  patientId: z.string().min(1).max(200),
  query: z.string().min(1).max(500),
});

// Called by the voice agent mid-conversation: Moss semantic search over the
// patient's history, fast enough that the agent answers without stalling.
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const result = await queryPatientHistory(parsed.data.patientId, parsed.data.query);
  return NextResponse.json(result);
}
