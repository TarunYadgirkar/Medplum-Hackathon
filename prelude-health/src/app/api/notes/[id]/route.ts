import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getNote, updateNote } from '@/lib/store';

const PatchSchema = z.object({
  status: z.enum(['reviewed', 'urgent_review', 'ai_draft']),
  riskLevel: z.enum(['none', 'low', 'medium', 'high']).optional(),
  providerEditedNote: z.string().max(10000).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const note = await getNote(id);
    if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(note);
  } catch (err) {
    console.error('getNote failed:', err);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const note = await updateNote(id, parsed.data);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(note);
}
