import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkEligibility } from '@/lib/stedi';
import type { CareLevel } from '@/types';

const Schema = z.object({
  careLevel: z.enum(['self_care', 'telehealth', 'primary_care', 'urgent_care', 'emergency_room']).optional(),
  payerKey: z.enum(['UHC', 'CIGNA', 'AETNA', 'CMS']).optional(),
  memberId: z.string().max(80).optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
});

// Called by the voice agent (client-side function) and by the summary card.
// Runs a Stedi test-mode eligibility check against a mock payer.
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const coverage = await checkEligibility({
    payerKey: parsed.data.payerKey,
    memberId: parsed.data.memberId,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    careLevel: parsed.data.careLevel as CareLevel | undefined,
  });
  return NextResponse.json(coverage);
}
