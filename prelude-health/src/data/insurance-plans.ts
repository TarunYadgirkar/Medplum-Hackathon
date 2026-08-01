// Real, commonly-known plan lineups per major US carrier (verified against
// carrier marketing pages + hospital accepted-plan lists, 2026-08-01):
// UHC Choice Plus / Options PPO / Navigate HMO (uhc.com), Cigna Open Access
// Plus / LocalPlus / SureFit (cigna.com, NM.org accepted plans), Aetna Open
// Choice PPO / Managed Choice POS / Aetna Select (aetna.com, endeavorhealth),
// BCBS BlueCard PPO / Blue Choice, Kaiser Traditional & Deductible HMO,
// Medicare Part B / Advantage, Medicaid managed care.
// Dollar figures are SYNTHETIC demo profiles shaped like each plan type.

export type CarrierKey = 'UHC' | 'CIGNA' | 'AETNA' | 'BCBS' | 'KAISER' | 'MEDICARE' | 'MEDICAID';
export type StediPayerKey = 'UHC' | 'CIGNA' | 'AETNA' | 'CMS';

export interface PlanCopays {
  telehealth: number | null;
  primary_care: number | null;
  urgent_care: number | null;
  emergency_room: number | null;
}

export interface InsurancePlanOption {
  id: string;
  name: string;
  copays: PlanCopays;
  deductibleRemaining: number;
  coinsurancePct: number;
}

export interface Carrier {
  key: CarrierKey;
  name: string;
  stediPayerKey?: StediPayerKey; // only carriers with a verified Stedi mock payer
  plans: InsurancePlanOption[];
}

export const CARRIERS: Carrier[] = [
  {
    key: 'UHC',
    name: 'UnitedHealthcare',
    stediPayerKey: 'UHC',
    plans: [
      {
        id: 'uhc-choice-plus',
        name: 'Choice Plus',
        copays: { telehealth: 20, primary_care: 30, urgent_care: 75, emergency_room: 350 },
        deductibleRemaining: 750,
        coinsurancePct: 20,
      },
      {
        id: 'uhc-options-ppo',
        name: 'Options PPO',
        copays: { telehealth: 25, primary_care: 40, urgent_care: 90, emergency_room: 400 },
        deductibleRemaining: 1500,
        coinsurancePct: 20,
      },
      {
        id: 'uhc-navigate-hmo',
        name: 'Navigate HMO',
        copays: { telehealth: 10, primary_care: 25, urgent_care: 60, emergency_room: 300 },
        deductibleRemaining: 250,
        coinsurancePct: 10,
      },
    ],
  },
  {
    key: 'CIGNA',
    name: 'Cigna',
    stediPayerKey: 'CIGNA',
    plans: [
      {
        id: 'cigna-open-access-plus',
        name: 'Open Access Plus',
        copays: { telehealth: 25, primary_care: 35, urgent_care: 85, emergency_room: 400 },
        deductibleRemaining: 1200,
        coinsurancePct: 20,
      },
      {
        id: 'cigna-localplus',
        name: 'LocalPlus',
        copays: { telehealth: 20, primary_care: 30, urgent_care: 75, emergency_room: 350 },
        deductibleRemaining: 900,
        coinsurancePct: 20,
      },
      {
        id: 'cigna-surefit',
        name: 'SureFit',
        copays: { telehealth: 15, primary_care: 25, urgent_care: 65, emergency_room: 300 },
        deductibleRemaining: 500,
        coinsurancePct: 15,
      },
    ],
  },
  {
    key: 'AETNA',
    name: 'Aetna',
    stediPayerKey: 'AETNA',
    plans: [
      {
        id: 'aetna-open-choice-ppo',
        name: 'Open Choice PPO',
        copays: { telehealth: 25, primary_care: 40, urgent_care: 90, emergency_room: 450 },
        deductibleRemaining: 1500,
        coinsurancePct: 20,
      },
      {
        id: 'aetna-managed-choice-pos',
        name: 'Managed Choice POS',
        copays: { telehealth: 20, primary_care: 30, urgent_care: 75, emergency_room: 350 },
        deductibleRemaining: 800,
        coinsurancePct: 15,
      },
      {
        id: 'aetna-select-hmo',
        name: 'Aetna Select',
        copays: { telehealth: 10, primary_care: 20, urgent_care: 60, emergency_room: 250 },
        deductibleRemaining: 0,
        coinsurancePct: 10,
      },
    ],
  },
  {
    key: 'BCBS',
    name: 'Blue Cross Blue Shield',
    plans: [
      {
        id: 'bcbs-bluecard-ppo',
        name: 'BlueCard PPO',
        copays: { telehealth: 25, primary_care: 35, urgent_care: 80, emergency_room: 400 },
        deductibleRemaining: 1000,
        coinsurancePct: 20,
      },
      {
        id: 'bcbs-blue-choice',
        name: 'Blue Choice',
        copays: { telehealth: 15, primary_care: 25, urgent_care: 65, emergency_room: 300 },
        deductibleRemaining: 500,
        coinsurancePct: 15,
      },
    ],
  },
  {
    key: 'KAISER',
    name: 'Kaiser Permanente',
    plans: [
      {
        id: 'kaiser-traditional-hmo',
        name: 'Traditional HMO',
        copays: { telehealth: 10, primary_care: 20, urgent_care: 50, emergency_room: 250 },
        deductibleRemaining: 0,
        coinsurancePct: 10,
      },
      {
        id: 'kaiser-deductible-hmo',
        name: 'Deductible HMO',
        copays: { telehealth: 30, primary_care: 40, urgent_care: 90, emergency_room: 500 },
        deductibleRemaining: 2000,
        coinsurancePct: 25,
      },
    ],
  },
  {
    key: 'MEDICARE',
    name: 'Medicare',
    stediPayerKey: 'CMS',
    plans: [
      {
        id: 'medicare-part-b',
        name: 'Part B (Original)',
        copays: { telehealth: null, primary_care: null, urgent_care: null, emergency_room: null },
        deductibleRemaining: 257,
        coinsurancePct: 20,
      },
      {
        id: 'medicare-advantage',
        name: 'Medicare Advantage',
        copays: { telehealth: 0, primary_care: 10, urgent_care: 45, emergency_room: 120 },
        deductibleRemaining: 0,
        coinsurancePct: 20,
      },
    ],
  },
  {
    key: 'MEDICAID',
    name: 'Medicaid',
    plans: [
      {
        id: 'medicaid-managed-care',
        name: 'State Managed Care Plan',
        copays: { telehealth: 0, primary_care: 3, urgent_care: 5, emergency_room: 8 },
        deductibleRemaining: 0,
        coinsurancePct: 0,
      },
    ],
  },
];

export function resolveCarrierPlan(payerKey?: string, planId?: string): { carrier: Carrier; plan: InsurancePlanOption } {
  const key = payerKey === 'CMS' ? 'MEDICARE' : payerKey; // legacy localStorage value
  const carrier = CARRIERS.find((c) => c.key === key) ?? CARRIERS[0];
  const plan = carrier.plans.find((p) => p.id === planId) ?? carrier.plans[0];
  return { carrier, plan };
}
