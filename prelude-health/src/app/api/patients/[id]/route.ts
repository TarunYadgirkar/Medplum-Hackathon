import { NextRequest, NextResponse } from 'next/server';
import { deletePatient } from '@/lib/store';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deletePatient(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('deletePatient failed:', err);
    return NextResponse.json({ error: 'Failed to remove patient' }, { status: 500 });
  }
}
