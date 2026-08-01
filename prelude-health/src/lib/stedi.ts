// Stedi Healthcare test-mode eligibility check.
// Docs: https://www.stedi.com/docs/healthcare/send-eligibility-checks
//       https://www.stedi.com/docs/healthcare/api-reference/mock-requests-eligibility-checks
// Test mode is free, uses mock payers, and never touches real PHI.
import { syntheticPricing, DEFAULT_PLAN_KEY } from '@/data/synthetic-pricing';
import type { CareLevel, CoverageSummary } from '@/types';

const STEDI_URL = 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3';

// Stedi test-mode mock payers — VERIFIED against Stedi's mock-requests docs
// (2026-08-01). Test mode only accepts these documented subscriber combos
// verbatim (memberId + name + DOB + NPI 1999999984); anything else errors.
export const MOCK_PAYERS: Record<
  string,
  { name: string; tradingPartnerServiceId: string; memberId: string; firstName: string; lastName: string; dateOfBirth: string }
> = {
  UHC: { name: 'UnitedHealthcare (mock)', tradingPartnerServiceId: '87726', memberId: 'UHC123456', firstName: 'Jane', lastName: 'Doe', dateOfBirth: '19710101' },
  CIGNA: { name: 'Cigna (mock)', tradingPartnerServiceId: '62308', memberId: '23456789100', firstName: 'James', lastName: 'Jones', dateOfBirth: '19910202' },
  AETNA: { name: 'Aetna (mock)', tradingPartnerServiceId: '60054', memberId: 'AETNA12345', firstName: 'Jane', lastName: 'Doe', dateOfBirth: '20040404' },
  CMS: { name: 'Medicare CMS (mock)', tradingPartnerServiceId: 'CMS', memberId: 'CMS12345678', firstName: 'Jane', lastName: 'Doe', dateOfBirth: '19550505' },
};

const CARE_LEVEL_TO_BASE_COST: Record<CareLevel, { min: number; max: number }> = {
  self_care: { min: 0, max: 20 },
  telehealth: syntheticPricing.baseCosts.telehealth,
  primary_care: syntheticPricing.baseCosts.primary_care,
  urgent_care: syntheticPricing.baseCosts.urgent_care,
  emergency_room: syntheticPricing.baseCosts.emergency_room,
};

interface EligibilityArgs {
  payerKey?: string; // UHC | CIGNA | AETNA | CMS
  memberId?: string;
  firstName?: string;
  lastName?: string;
  careLevel?: CareLevel;
}

export async function checkEligibility(args: EligibilityArgs): Promise<CoverageSummary> {
  const payer = MOCK_PAYERS[args.payerKey || 'UHC'] || MOCK_PAYERS.UHC;
  const careLevel: CareLevel = args.careLevel || 'primary_care';
  const baseCost = CARE_LEVEL_TO_BASE_COST[careLevel];

  if (!process.env.STEDI_API_KEY) {
    return syntheticCoverage(careLevel, baseCost);
  }

  try {
    const res = await fetch(STEDI_URL, {
      method: 'POST',
      headers: {
        Authorization: process.env.STEDI_API_KEY,
        'Content-Type': 'application/json',
      },
      // Test mode rejects non-documented combos, so the subscriber identity is
      // always the payer's documented mock — caller names are demo-only input.
      body: JSON.stringify({
        tradingPartnerServiceId: payer.tradingPartnerServiceId,
        provider: { organizationName: 'Provider Name', npi: '1999999984' },
        subscriber: {
          firstName: payer.firstName,
          lastName: payer.lastName,
          dateOfBirth: payer.dateOfBirth,
          memberId: payer.memberId,
        },
        encounter: { serviceTypeCodes: ['30'] }, // 30 = health benefit plan coverage
      }),
    });
    if (!res.ok) throw new Error(`Stedi ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return parseStediResponse(data, payer.name, careLevel, baseCost);
  } catch (err) {
    console.error('Stedi eligibility failed, using synthetic fallback:', err);
    return syntheticCoverage(careLevel, baseCost);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Exported for scripts/verify-stedi.ts (parse check without a live key).
export function parseStediResponse(
  data: any,
  payerName: string,
  careLevel: CareLevel,
  baseCost: { min: number; max: number }
): CoverageSummary {
  const benefits: any[] = Array.isArray(data?.benefitsInformation) ? data.benefitsInformation : [];

  // Plan status: benefitsInformation codes 1-5 = active, 6 = inactive.
  // (planStatus[] is deprecated in Stedi's API — kept only as a last resort.)
  const activeHit = benefits.find((b) => ['1', '2', '3', '4', '5'].includes(b.code));
  const inactiveHit = benefits.find((b) => b.code === '6');
  const planStatus: string =
    (activeHit ? activeHit.name || 'Active Coverage' : inactiveHit ? inactiveHit.name || 'Inactive' : null) ||
    data?.planStatus?.[0]?.status ||
    'Unknown';

  // Prefer in-network, individual-level benefit entries.
  const rank = (b: any) =>
    (b.inPlanNetworkIndicatorCode === 'N' ? 2 : 0) + (b.coverageLevelCode && b.coverageLevelCode !== 'IND' ? 1 : 0);
  const pick = (pred: (b: any) => boolean): any | undefined =>
    benefits.filter(pred).sort((a, b) => rank(a) - rank(b))[0];

  // B = Co-Payment (benefitAmount is a string dollar figure).
  const copayHit = pick((b) => b.code === 'B' && b.benefitAmount != null);
  const copay = copayHit ? Number(copayHit.benefitAmount) : undefined;

  // C = Deductible; timeQualifierCode 29 = Remaining, 23 = Calendar Year total.
  const dedHit =
    pick((b) => b.code === 'C' && b.benefitAmount != null && b.timeQualifierCode === '29') ||
    pick((b) => b.code === 'C' && b.benefitAmount != null && b.timeQualifierCode === '23') ||
    pick((b) => b.code === 'C' && b.benefitAmount != null);
  const deductible = dedHit ? Number(dedHit.benefitAmount) : undefined;

  // A = Co-Insurance (benefitPercent is a string fraction, e.g. "0.20" = 20%).
  const coinsHit = pick((b) => b.code === 'A' && b.benefitPercent != null);
  const coinsurance = coinsHit ? Math.round(Number(coinsHit.benefitPercent) * 100) : undefined;

  const est = estimateOutOfPocket(baseCost, copay, coinsurance, deductible);
  const spoken =
    `Your ${payerName} plan shows ${planStatus.toLowerCase() || 'unknown status'}. ` +
    (copay != null ? `Expect roughly a $${copay} copay` : `Expect roughly $${est.min}–$${est.max} out of pocket`) +
    ` for a ${careLevel.replace('_', ' ')} visit.`;

  return {
    source: 'stedi',
    payer: payerName,
    plan_status: planStatus,
    copay,
    coinsurance_percent: coinsurance,
    deductible_remaining: deductible,
    estimated_visit_cost: est,
    spoken_summary: spoken,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function syntheticCoverage(careLevel: CareLevel, baseCost: { min: number; max: number }): CoverageSummary {
  const plan = syntheticPricing.plans[DEFAULT_PLAN_KEY];
  const copay =
    careLevel === 'telehealth' ? plan.telehealthCopay :
    careLevel === 'urgent_care' ? plan.urgentCareCopay :
    careLevel === 'emergency_room' ? plan.erCopay :
    plan.pcpCopay;
  return {
    source: 'synthetic',
    payer: plan.name,
    plan_status: 'Active Coverage',
    copay,
    coinsurance_percent: Math.round(plan.coinsuranceAfterDeductible * 100),
    deductible_remaining: plan.deductibleRemaining,
    estimated_visit_cost: baseCost,
    spoken_summary: `Based on a typical ${plan.name} plan, expect about a $${copay} copay for a ${careLevel.replace('_', ' ')} visit (typical total cost $${baseCost.min}–$${baseCost.max}).`,
  };
}

function estimateOutOfPocket(
  base: { min: number; max: number },
  copay?: number,
  coinsurancePct?: number,
  deductibleRemaining?: number
): { min: number; max: number } {
  if (copay != null && (!deductibleRemaining || deductibleRemaining === 0)) {
    return { min: copay, max: copay };
  }
  const pct = coinsurancePct != null ? coinsurancePct / 100 : 1;
  return {
    min: Math.round(Math.min(base.min, (deductibleRemaining ?? base.min)) * (pct || 1)) || base.min,
    max: Math.round(base.max),
  };
}
