import { buildCareCard, type CareCard } from '@/lib/care-card';

// Seeded demo patient only: the same rash check-in the keyless demo note uses.
export const DEMO_CARE_CARD: CareCard = buildCareCard({
  result: {
    chief_concern: 'Itchy spreading rash on right forearm, 3 days',
    care_recommendation: {
      care_level: 'telehealth',
      confidence: 0.82,
      reasoning:
        'A rash on one arm with no fever or swelling can usually be checked over video. A similar rash last November cleared with a prescription cream.',
      red_flags_to_watch: ['Swelling of the face, lips or throat', 'Trouble breathing', 'Fever', 'Blisters or open sores'],
    },
  },
  payerKey: 'UHC',
  planId: 'uhc-choice-plus',
  patientName: 'Jordan Ellis',
  issued: new Date('2026-10-10T12:00:00Z'),
})!;
