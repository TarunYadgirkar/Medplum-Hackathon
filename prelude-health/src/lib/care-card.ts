// The Care Card (ported from CarePath): a patient-facing summary of the
// check-in that travels as a link. The card lives in the URL fragment, which
// browsers never send to a server, so sharing it stores nothing on ours.
import { z } from 'zod';
import { resolveCarrierPlan } from '@/data/insurance-plans';
import { estimateCareCosts } from '@/lib/cost-estimate';
import type { CoverageSummary, NoteGenerationResult } from '@/types';

const Range = z.object({ min: z.number().min(0).max(100_000), max: z.number().min(0).max(100_000) });
const MAX_RED_FLAGS = 6;

export const CareCardSchema = z.object({
  v: z.literal(1),
  firstName: z.string().max(40).optional(),
  concern: z.string().max(200),
  careLevel: z.enum(['self_care', 'telehealth', 'primary_care', 'urgent_care', 'emergency_room']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(600),
  redFlags: z.array(z.string().max(160)).max(MAX_RED_FLAGS),
  plan: z.string().max(80).optional(),
  costs: z.object({ telehealth: Range, primary_care: Range, urgent_care: Range, emergency_room: Range }),
  costSource: z.enum(['stedi', 'synthetic', 'self_pay']),
  issued: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CareCard = z.infer<typeof CareCardSchema>;

export interface BuildCareCardArgs {
  result: Pick<NoteGenerationResult, 'chief_concern' | 'care_recommendation'>;
  coverage?: CoverageSummary;
  payerKey?: string;
  planId?: string;
  patientName?: string;
  issued: Date;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

// Returns null when the note's fields fall outside the card schema (for
// example an unexpected care level), so a bad model reply never breaks the flow.
export function buildCareCard({ result, coverage, payerKey, planId, patientName, issued }: BuildCareCardArgs): CareCard | null {
  const insured = Boolean(payerKey);
  const resolved = insured ? resolveCarrierPlan(payerKey, planId) : null;
  const rec = result.care_recommendation;
  if (!rec) return null;
  const planCosts = estimateCareCosts(resolved?.plan ?? null);
  // A live eligibility answer beats the plan profile for the level it priced.
  const costs =
    coverage?.source === 'stedi' && rec.care_level !== 'self_care'
      ? { ...planCosts, [rec.care_level]: coverage.estimated_visit_cost }
      : planCosts;

  const firstName = patientName?.trim().split(/\s+/)[0];
  const card = CareCardSchema.safeParse({
    v: 1,
    firstName: firstName && firstName !== 'Walk-in' ? clip(firstName, 40) : undefined,
    concern: clip(result.chief_concern || 'Pre-visit check-in', 200),
    careLevel: rec.care_level,
    confidence: Math.min(1, Math.max(0, rec.confidence || 0)),
    reasoning: clip(rec.reasoning || '', 600),
    redFlags: (rec.red_flags_to_watch ?? []).slice(0, MAX_RED_FLAGS).map((f) => clip(f, 160)),
    plan: resolved ? clip(`${resolved.carrier.name} ${resolved.plan.name}`, 80) : undefined,
    costs,
    costSource: !insured ? 'self_pay' : coverage?.source === 'stedi' ? 'stedi' : 'synthetic',
    issued: issued.toISOString().slice(0, 10),
  });
  return card.success ? card.data : null;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeCareCard(card: CareCard): string {
  return toBase64Url(JSON.stringify(card));
}

// The fragment comes from whoever sent the link, so it is parsed as untrusted.
export function decodeCareCard(fragment: string): CareCard | null {
  const raw = fragment.replace(/^#/, '').trim();
  if (!raw || raw.length > 8000) return null;
  try {
    const parsed = CareCardSchema.safeParse(JSON.parse(fromBase64Url(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function careCardPath(card: CareCard): string {
  return `/card#${encodeCareCard(card)}`;
}
