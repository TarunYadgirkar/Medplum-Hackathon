import { NextRequest, NextResponse } from 'next/server';
import { getTranscript } from '@/lib/store';

// Returns the intake transcript for an encounter (used by the note review page).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const transcript = await getTranscript(id);
    if (!transcript) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ id, transcript, status: 'completed' });
  } catch (err) {
    console.error('getTranscript failed:', err);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
