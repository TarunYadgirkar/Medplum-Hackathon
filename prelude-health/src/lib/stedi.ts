// Stedi Healthcare test-mode eligibility check.
// Docs: https://www.stedi.com/docs/healthcare/send-eligibility-checks
// Test mode is free, uses mock payers, and never touches real PHI.
import { syntheticPricing, DEFAULT_PLAN_KEY } from '@/data/synthetic-pricing';
import type { CareLevel, CoverageSummary } from '@/types';

const STEDI_URL = 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3';

// Stedi test-mode mock payers (test member IDs per Stedi docs / mock request library).
export const MOCK_PAYERS: Record<string, { name: string; tradingPartnerServiceId: string; memberId: string }> = {
  UHC: { name: 'UnitedHealthcare (mock)', tradingPartnerServiceId: '87726', memberId: 'UHC202649' },
  CIGNA: { name: 'Cigna (mock)', tradingPartnerServiceId: '62308', memberId: 'CIGNA731608' },
  AETNA: { name: 'Aetna (mock)', tradingPartnerServiceId: '60054', memberId: 'AETNA9wcSu' },
  CMS: { name: 'Medicare CMS (mock)', tradingPartnerServiceId: 'CMS', memberId: '1EG4TE5MK73' },
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
      body: JSON.stringify({
        tradingPartnerServiceId: payer.tradingPartnerServiceId,
        encounter: { serviceTypeCodes: ['30'] }, // 30 = health benefit plan coverage
        provider: { organizationName: 'Prelude Health Clinic', npi: '1999999984' },
        subscriber: {
          firstName: args.firstName || 'Jane',
          lastName: args.lastName || 'Doe',
          memberId: args.memberId || payer.memberId,
        },
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
function parseStediResponse(
  data: any,
  payerName: string,
  careLevel: CareLevel,
  baseCost: { min: number; max: number }
): CoverageSummary {
  const planStatus: string =
    data?.planStatus?.[0]?.status || data?.benefitsInformation?.find((b: any) => b.code === '1' || b.code === '6')?.name || 'Unknown';

  const benefits: any[] = Array.isArray(data?.benefitsInformation) ? data.benefitsInformation : [];
  const amount = (code: string): number | undefined => {
    const hit = benefits.find((b) => b.code === code && b.benefitAmount != null);
    return hit ? Number(hit.benefitAmount) : undefined;
  };
  const copay = amount('B'); // co-payment
  const deductible = amount('C'); // deductible
  const coinsHit = benefits.find((b) => b.code === 'A' && b.benefitPercent != null);
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
