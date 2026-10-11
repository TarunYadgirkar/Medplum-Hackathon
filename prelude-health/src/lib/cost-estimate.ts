// Out-of-pocket estimates against a patient's plan, ported from CarePath's
// care-options table. Pure so the voice agent, the eligibility route and the
// Care Card all quote the same number for the same plan.
import { syntheticPricing } from '@/data/synthetic-pricing';
import type { InsurancePlanOption } from '@/data/insurance-plans';
import type { CareLevel } from '@/types';

export interface CostRange {
  min: number;
  max: number;
}

export interface CostTerms {
  copay?: number | null;
  deductibleRemaining?: number;
  coinsurancePct?: number;
}

export type VisitLevel = Exclude<CareLevel, 'self_care'>;
export const VISIT_LEVELS: VisitLevel[] = ['telehealth', 'primary_care', 'urgent_care', 'emergency_room'];

// Synthetic allowed amounts (what the clinic bills the plan) per care level.
export const ALLOWED_AMOUNTS: Record<CareLevel, CostRange> = {
  self_care: { min: 0, max: 20 },
  ...syntheticPricing.baseCosts,
};

function patientShare(allowed: number, terms: CostTerms): number {
  const deductible = Math.max(0, terms.deductibleRemaining ?? 0);
  const coinsurance = (terms.coinsurancePct ?? 100) / 100;
  const towardDeductible = Math.min(allowed, deductible);
  return Math.round(towardDeductible + (allowed - towardDeductible) * coinsurance);
}

// A known copay is the whole bill for an in-network visit. Without one the
// patient pays the deductible first, then their coinsurance share.
export function estimateVisitCost(allowed: CostRange, terms: CostTerms): CostRange {
  if (terms.copay != null) return { min: terms.copay, max: terms.copay };
  return { min: patientShare(allowed.min, terms), max: patientShare(allowed.max, terms) };
}

export function termsForPlan(plan: InsurancePlanOption | null, level: CareLevel): CostTerms {
  if (!plan) return { coinsurancePct: 100 };
  return {
    copay: plan.copays[level === 'self_care' ? 'telehealth' : level],
    deductibleRemaining: plan.deductibleRemaining,
    coinsurancePct: plan.coinsurancePct,
  };
}

export function estimateCareCosts(plan: InsurancePlanOption | null): Record<VisitLevel, CostRange> {
  return Object.fromEntries(
    VISIT_LEVELS.map((level) => [level, estimateVisitCost(ALLOWED_AMOUNTS[level], termsForPlan(plan, level))])
  ) as Record<VisitLevel, CostRange>;
}

export function formatCostRange({ min, max }: CostRange): string {
  const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
  return min === max ? usd(min) : `${usd(min)} to ${usd(max)}`;
}
