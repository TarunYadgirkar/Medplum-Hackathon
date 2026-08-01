import { NextResponse } from 'next/server';
import { listPatients } from '@/lib/store';

// Provider dashboard queue — same response contract as klarity-voicenote,
// now assembled from FHIR resources in Medplum.
export async function GET() {
  try {
    const rows = await listPatients();
    return NextResponse.json(rows);
  } catch (err) {
    console.error('listPatients failed:', err);
    return NextResponse.json({ error: 'Failed to load patients' }, { status: 500 });
  }
}
