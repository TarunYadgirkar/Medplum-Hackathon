import type { CoverageSummary, NoteGenerationResult } from '@/types';

// Pre-written AI notes for the seeded demo patients, used only when the app
// runs without Medplum and OpenAI keys. Synthetic people, synthetic plans.
export interface DemoNote {
  result: NoteGenerationResult;
  coverage: CoverageSummary;
}

export const DEMO_NOTES: Record<string, DemoNote> = {
  'Marcus Whitfield': {
    result: {
      patient_summary:
        'Patient reports central chest pressure since yesterday afternoon, radiating to the left arm, with shortness of breath on stairs, a cold sweat and lightheadedness this morning. Hypertension on lisinopril. Father had a heart attack at 60. Advised to call 911 or go to the ER now; wife driving him.',
      chief_concern: 'Chest pressure radiating to left arm since yesterday',
      symptoms_reported: ['Squeezing central chest pressure, 6/10 now, peaked 8/10', 'Pain into left arm', 'Shortness of breath, now at rest', 'Cold sweat and lightheadedness'],
      history_of_present_illness:
        'Onset yesterday afternoon. Pressure-type pain, center of chest, radiating to left arm. Diaphoresis and lightheadedness this morning. Dyspnea on exertion progressing to mild dyspnea at rest. No aspirin or nitroglycerin taken.',
      medication_mentions: 'Lisinopril daily for about five years, taken as prescribed.',
      prior_care: 'Hypertension managed in primary care.',
      patient_goals: ['Find out whether this is serious'],
      soap_note: {
        subjective:
          'Central squeezing chest pressure since yesterday afternoon radiating to the left arm, rated 6/10 now and 8/10 at peak. Shortness of breath on exertion and mildly at rest, cold sweat and lightheadedness this morning. Hypertension on lisinopril. Family history of MI in father at 60. Penicillin allergy (rash).',
        objective: 'Voice intake only. No vitals or exam available.',
        assessment:
          'Patient-reported symptoms carry high-risk cardiac features. No diagnosis is made by this AI system. Requires emergency evaluation.',
        plan: 'Patient advised to call 911 or go to the nearest ER immediately. Flag for immediate provider review and ER handoff.',
      },
      risk: {
        level: 'high',
        flags: ['Chest pressure radiating to arm', 'Dyspnea at rest', 'Diaphoresis', 'Family history of early MI'],
        urgent_provider_review: true,
        reason: 'Possible acute coronary syndrome features reported. Emergency evaluation needed now.',
      },
      care_recommendation: {
        care_level: 'emergency_room',
        confidence: 0.96,
        reasoning: 'Chest pressure spreading to the arm with sweating and shortness of breath needs emergency care now.',
        red_flags_to_watch: ['Pain that worsens or spreads', 'Fainting', 'Severe shortness of breath'],
      },
      suggested_provider_questions: ['Did he reach the ER, and has an ECG been done?', 'Any prior cardiac workup?'],
      follow_up_actions: ['Confirm ER arrival', 'Send intake summary to the receiving ER team'],
      missing_information: ['Vitals', 'ECG'],
    },
    coverage: {
      source: 'synthetic',
      payer: 'Aetna Open Choice PPO',
      plan_status: 'Active Coverage',
      copay: 450,
      coinsurance_percent: 20,
      deductible_remaining: 1500,
      estimated_visit_cost: { min: 450, max: 450 },
      spoken_summary: 'Your Aetna Open Choice PPO plan shows active coverage. Expect roughly a $450 copay for an emergency room visit.',
    },
  },
  'Priya Anand': {
    result: {
      patient_summary:
        'Routine annual physical. Seasonal allergies a little worse this spring (sneezing, itchy eyes for three weeks), managed with cetirizine about twice a week. Sleeping better since exercising more. Mother has type 2 diabetes. Tdap may be due.',
      chief_concern: 'Annual physical',
      symptoms_reported: ['Sneezing and itchy eyes for three weeks'],
      history_of_present_illness: 'Seasonal allergy symptoms typical for spring, mild. No other new symptoms.',
      medication_mentions: 'Cetirizine 10mg as needed, about twice a week. Daily multivitamin.',
      prior_care: 'Annual physicals with this practice.',
      patient_goals: ['Stay on top of preventive care', 'Check whether Tdap is due'],
      soap_note: {
        subjective:
          'Here for an annual physical. Mild seasonal allergic symptoms for three weeks on as-needed cetirizine. Denies chest pain, dyspnea, palpitations, GI symptoms or headaches. Sleep improved with exercise. No known drug allergies. Family history: mother with type 2 diabetes, grandfather with hypertension.',
        objective: 'Voice intake only. Vitals and labs to be collected at the visit.',
        assessment: 'Routine preventive visit with no concerning symptoms reported. No diagnosis is made by this AI system.',
        plan: 'Vitals and age-appropriate labs. Consider diabetes screening given family history. Verify Tdap date and update if due.',
      },
      risk: { level: 'low', flags: ['Family history of type 2 diabetes'], urgent_provider_review: false, reason: 'Routine preventive visit.' },
      care_recommendation: {
        care_level: 'primary_care',
        confidence: 0.9,
        reasoning: 'An annual physical with labs and a vaccine check belongs with your primary care clinician.',
        red_flags_to_watch: ['Wheezing or trouble breathing', 'Swelling of the lips or throat'],
      },
      suggested_provider_questions: ['When was the last Tdap?', 'Any interest in an allergy action plan?'],
      follow_up_actions: ['Order fasting glucose or A1C', 'Update Tdap if due'],
      missing_information: ['Date of last Tdap'],
    },
    coverage: {
      source: 'synthetic',
      payer: 'Cigna LocalPlus',
      plan_status: 'Active Coverage',
      copay: 30,
      coinsurance_percent: 20,
      deductible_remaining: 900,
      estimated_visit_cost: { min: 30, max: 30 },
      spoken_summary: 'Your Cigna LocalPlus plan shows active coverage. Expect roughly a $30 copay for a primary care visit.',
    },
  },
  'Robert Alan Chen': {
    result: {
      patient_summary:
        'Type 2 diabetes follow-up and metformin refill. Ran out of metformin four days ago; more tired and thirsty this week. Fasting sugars 130 to 145 with post-meal spikes over 200. Night-time foot tingling for a couple of months. Home BP about 135/85. Last A1C 7.8 three months ago.',
      chief_concern: 'Diabetes follow-up, metformin refill',
      symptoms_reported: ['Increased thirst', 'Fatigue', 'Tingling in both feet at night'],
      history_of_present_illness:
        'Out of metformin 1000mg BID for four days. Fatigue and thirst since. Bilateral foot paresthesia at night for about two months, no wounds. Walking 20 minutes daily; diet inconsistent with travel.',
      medication_mentions: 'Metformin 1000mg twice daily (out for 4 days). Lisinopril 10mg daily.',
      prior_care: 'A1C 7.8 three months ago.',
      patient_goals: ['Refill metformin', 'Get sugars back in range'],
      soap_note: {
        subjective:
          'Type 2 diabetes follow-up. Out of metformin for four days with increased thirst and fatigue. Fasting glucose 130 to 145, post-prandial spikes over 200. Bilateral nocturnal foot tingling for two months without wounds. Home BP around 135/85 on lisinopril. Sulfamethoxazole allergy (hives).',
        objective: 'Voice intake only. Patient-reported home readings as above.',
        assessment: 'Suboptimal glycemic control with lapse in metformin and new neuropathic symptoms reported. No diagnosis is made by this AI system.',
        plan: 'Refill metformin. Repeat A1C. Monofilament foot exam. Review BP target and diet support for travel.',
      },
      risk: {
        level: 'medium',
        flags: ['Medication lapse', 'Possible peripheral neuropathy', 'Glucose over 200 after meals'],
        urgent_provider_review: false,
        reason: 'Needs timely follow-up, no emergency features reported.',
      },
      care_recommendation: {
        care_level: 'primary_care',
        confidence: 0.86,
        reasoning: 'A refill, a repeat A1C and a foot exam are best done at your primary care visit this week.',
        red_flags_to_watch: ['Blood sugar over 300', 'Confusion or vomiting', 'A foot sore that does not heal'],
      },
      suggested_provider_questions: ['How often is he checking sugars while traveling?', 'Any vision changes since last eye exam?'],
      follow_up_actions: ['Send metformin refill today', 'Order A1C', 'Schedule diabetic foot exam'],
      missing_information: ['Date of last eye exam'],
    },
    coverage: {
      source: 'synthetic',
      payer: 'Blue Cross Blue Shield BlueCard PPO',
      plan_status: 'Active Coverage',
      copay: 35,
      coinsurance_percent: 20,
      deductible_remaining: 1000,
      estimated_visit_cost: { min: 35, max: 35 },
      spoken_summary: 'Your BlueCard PPO plan shows active coverage. Expect roughly a $35 copay for a primary care visit.',
    },
  },
};
