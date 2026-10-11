import { describe, expect, it } from 'vitest';
import { buildCareCard, careCardPath, decodeCareCard, encodeCareCard } from './care-card';
import type { CoverageSummary } from '@/types';

const result = {
  chief_concern: 'Itchy spreading rash on right forearm, 3 days',
  care_recommendation: {
    care_level: 'telehealth' as const,
    confidence: 0.82,
    reasoning: 'Localized recurrent rash without red flags suits a video visit.',
    red_flags_to_watch: ['Facial or throat swelling', 'Fever'],
  },
};
const issued = new Date('2026-10-10T12:00:00Z');

describe('buildCareCard', () => {
  it('prices care against the chosen plan and keeps only the first name', () => {
    const card = buildCareCard({ result, payerKey: 'UHC', planId: 'uhc-choice-plus', patientName: 'Jordan Ellis', issued })!;
    expect(card.firstName).toBe('Jordan');
    expect(card.plan).toBe('UnitedHealthcare Choice Plus');
    expect(card.costs.telehealth).toEqual({ min: 20, max: 20 });
    expect(card.costSource).toBe('synthetic');
    expect(card.issued).toBe('2026-10-10');
  });

  it('uses a live eligibility answer for the recommended level', () => {
    const coverage: CoverageSummary = {
      source: 'stedi',
      payer: 'UnitedHealthcare Choice Plus',
      plan_status: 'Active Coverage',
      estimated_visit_cost: { min: 15, max: 15 },
      spoken_summary: '',
    };
    const card = buildCareCard({ result, coverage, payerKey: 'UHC', planId: 'uhc-choice-plus', issued })!;
    expect(card.costs.telehealth).toEqual({ min: 15, max: 15 });
    expect(card.costs.primary_care).toEqual({ min: 30, max: 30 });
    expect(card.costSource).toBe('stedi');
  });

  it('marks a card without insurance as self-pay and drops the walk-in placeholder name', () => {
    const card = buildCareCard({ result, patientName: 'Walk-in Patient', issued })!;
    expect(card.costSource).toBe('self_pay');
    expect(card.plan).toBeUndefined();
    expect(card.firstName).toBeUndefined();
  });
});

describe('buildCareCard with an unexpected model reply', () => {
  it('returns null instead of throwing', () => {
    const bad = { ...result, care_recommendation: { ...result.care_recommendation, care_level: 'hospital' } };
    expect(buildCareCard({ result: bad as unknown as typeof result, issued })).toBeNull();
  });
});

describe('Care Card links', () => {
  const card = buildCareCard({ result, payerKey: 'AETNA', patientName: 'Zoë Martín', issued })!;

  it('round-trips through the URL fragment, including non-ASCII text', () => {
    expect(decodeCareCard(`#${encodeCareCard(card)}`)).toEqual(card);
    expect(careCardPath(card).startsWith('/card#')).toBe(true);
  });

  it('rejects fragments that are not a valid card', () => {
    expect(decodeCareCard('')).toBeNull();
    expect(decodeCareCard('#not-base64!!')).toBeNull();
    const tampered = encodeCareCard({ ...card, careLevel: 'hospital' } as unknown as typeof card);
    expect(decodeCareCard(tampered)).toBeNull();
    expect(decodeCareCard('a'.repeat(13_000))).toBeNull();
    expect(decodeCareCard(encodeCareCard({ ...card, issued: '2026-13-45' }))).toBeNull();
    expect(decodeCareCard(encodeCareCard({ ...card, costs: { ...card.costs, telehealth: { min: 50, max: 10 } } }))).toBeNull();
  });
});
