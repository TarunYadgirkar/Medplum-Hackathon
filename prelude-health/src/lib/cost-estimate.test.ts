import { describe, expect, it } from 'vitest';
import { resolveCarrierPlan } from '@/data/insurance-plans';
import { ALLOWED_AMOUNTS, estimateCareCosts, estimateVisitCost, formatCostRange } from './cost-estimate';

describe('estimateVisitCost', () => {
  it('charges the flat copay when the plan has one', () => {
    expect(estimateVisitCost({ min: 85, max: 180 }, { copay: 75, deductibleRemaining: 750, coinsurancePct: 20 }))
      .toEqual({ min: 75, max: 75 });
  });

  it('charges the full bill while the deductible covers it', () => {
    expect(estimateVisitCost({ min: 35, max: 120 }, { deductibleRemaining: 2000, coinsurancePct: 25 }))
      .toEqual({ min: 35, max: 120 });
  });

  it('splits a bill that crosses the deductible into deductible plus coinsurance', () => {
    // $257 deductible, then 20% of the remaining $943 on a $1,200 bill.
    expect(estimateVisitCost({ min: 650, max: 1200 }, { deductibleRemaining: 257, coinsurancePct: 20 }))
      .toEqual({ min: 336, max: 446 });
  });

  it('treats a missing coinsurance as paying the whole bill', () => {
    expect(estimateVisitCost({ min: 20, max: 40 }, {})).toEqual({ min: 20, max: 40 });
  });
});

describe('estimateCareCosts', () => {
  it('prices every visit level from the plan copays', () => {
    const { plan } = resolveCarrierPlan('UHC', 'uhc-choice-plus');
    expect(estimateCareCosts(plan)).toEqual({
      telehealth: { min: 20, max: 20 },
      primary_care: { min: 30, max: 30 },
      urgent_care: { min: 75, max: 75 },
      emergency_room: { min: 350, max: 350 },
    });
  });

  it('falls back to deductible math when a plan has no copays (Medicare Part B)', () => {
    const { plan } = resolveCarrierPlan('MEDICARE', 'medicare-part-b');
    const costs = estimateCareCosts(plan);
    expect(costs.primary_care).toEqual({ min: 35, max: 120 });
    expect(costs.emergency_room).toEqual({ min: 336, max: 446 });
  });

  it('quotes the allowed amount for self-pay', () => {
    expect(estimateCareCosts(null).urgent_care).toEqual(ALLOWED_AMOUNTS.urgent_care);
  });
});

describe('formatCostRange', () => {
  it('collapses equal bounds and formats thousands', () => {
    expect(formatCostRange({ min: 30, max: 30 })).toBe('$30');
    expect(formatCostRange({ min: 650, max: 1200 })).toBe('$650 to $1,200');
  });
});
