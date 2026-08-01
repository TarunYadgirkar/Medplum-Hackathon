import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { completeIntake, saveNote } from '@/lib/store';
import { checkEligibility } from '@/lib/stedi';
import type { NoteGenerationResult } from '@/types';

// Adapted from klarity-voicenote's generate-note route:
// transcript → OpenAI → structured note + care recommendation → FHIR in Medplum.

const PROMPT = `You are an AI clinical documentation assistant for a primary-care clinic's pre-visit intake system.
Your job is to convert a patient voice-intake transcript into (1) a provider-reviewed draft note and (2) a care-level recommendation.

Important rules:
- Do not diagnose. Do not prescribe. Do not recommend medication changes.
- Use patient-reported language. If information is missing, say "Not mentioned."
- Flag safety concerns for provider review.
- The output is a draft and must be reviewed by a licensed provider.
- Do not invent facts not present in the transcript.
- care_level must be one of: self_care, telehealth, primary_care, urgent_care, emergency_room. Choose the LOWEST safe level; escalate only for red-flag symptoms.

Return ONLY valid JSON with these fields:
{
  "patient_summary": "",
  "chief_concern": "",
  "symptoms_reported": [],
  "history_of_present_illness": "",
  "medication_mentions": "",
  "prior_care": "",
  "patient_goals": [],
  "soap_note": { "subjective": "", "objective": "", "assessment": "", "plan": "" },
  "risk": { "level": "none | low | medium | high", "flags": [], "urgent_provider_review": false, "reason": "" },
  "care_recommendation": { "care_level": "primary_care", "confidence": 0.0, "reasoning": "", "red_flags_to_watch": [] },
  "suggested_provider_questions": [],
  "follow_up_actions": [],
  "missing_information": []
}`;

const Schema = z.object({
  transcript: z.string().min(1).max(50000),
  patientId: z.string().min(1).max(200),
  encounterId: z.string().min(1).max(200),
  patientName: z.string().max(200).optional(),
  payerKey: z.enum(['UHC', 'CIGNA', 'AETNA', 'BCBS', 'KAISER', 'MEDICARE', 'MEDICAID', 'CMS']).optional(),
  planId: z.string().max(60).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { transcript, patientId, encounterId, patientName, payerKey, planId } = parsed.data;

  // 1. Persist transcript + close the FHIR Encounter.
  await completeIntake({ patientId, encounterId, transcript });

  // 2. Structured note via OpenAI (demo note fallback keeps the app usable keyless).
  let result: NoteGenerationResult;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    result = getDemoNote();
  } else {
    try {
      result = await generateWithOpenAI(openaiKey, transcript);
    } catch (err) {
      console.error('OpenAI error:', err);
      result = getDemoNote();
    }
  }

  // 3. Cost/coverage for the recommended care level (Stedi test mode).
  const [firstName, ...rest] = (patientName || 'Jane Doe').split(/\s+/);
  const coverage = await checkEligibility({
    careLevel: result.care_recommendation?.care_level || 'primary_care',
    payerKey,
    planId,
    firstName,
    lastName: rest.join(' ') || 'Doe',
  });

  // 4. Save as FHIR Composition + RiskAssessment in Medplum.
  const noteId = await saveNote({ patientId, encounterId, result, coverage });

  return NextResponse.json({ ok: true, noteId, result, coverage });
}

async function generateWithOpenAI(apiKey: string, transcript: string): Promise<NoteGenerationResult> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `Transcript:\n${transcript}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI response did not include text output');
  return JSON.parse(text) as NoteGenerationResult;
}

function getDemoNote(): NoteGenerationResult {
  return {
    patient_summary:
      'Patient reports an itchy, spreading rash on the right forearm that began three days ago after gardening. No fever, no trouble breathing, no facial swelling. Tried over-the-counter hydrocortisone with minimal relief. History of a similar contact dermatitis episode last November.',
    chief_concern: 'Itchy spreading rash on right forearm, 3 days',
    symptoms_reported: ['Itchy raised rash', 'Mild spreading over 3 days', 'No fever', 'No swelling of face or throat'],
    history_of_present_illness:
      'Onset 3 days ago after gardening. Gradual spread on forearm. Itching worse at night. OTC hydrocortisone tried with minimal effect. Denies systemic symptoms.',
    medication_mentions: 'OTC hydrocortisone cream (minimal relief). Loratadine 10mg daily for seasonal allergies.',
    prior_care: 'Similar rash treated with triamcinolone cream in November 2025, resolved in two weeks.',
    patient_goals: ['Identify the rash and stop the itching', 'Know whether an in-person visit is needed', 'Understand visit cost in advance'],
    soap_note: {
      subjective:
        'Patient reports a pruritic, mildly spreading rash on the right forearm beginning three days ago after gardening. Itching is worse at night. OTC hydrocortisone provided minimal relief. Patient recalls a similar episode in November 2025 that resolved with prescription triamcinolone. Denies fever, facial/throat swelling, or difficulty breathing. Takes loratadine 10mg daily for seasonal allergies. Documented penicillin allergy.',
      objective:
        'Voice intake only — no exam or vitals available. Patient was coherent and organized; reported visible raised red rash localized to right forearm.',
      assessment:
        'Patient-reported localized pruritic rash consistent with prior contact dermatitis history. No diagnosis is made by this AI system. No red-flag features reported (no systemic symptoms, no mucosal involvement).',
      plan:
        'Provider to visually assess rash (photo or in-person). Consider whether prior triamcinolone regimen is appropriate to repeat. Review allergy history before any prescription. Counsel on trigger avoidance (gardening exposure).',
    },
    risk: {
      level: 'low',
      flags: ['Recurrent dermatitis', 'Penicillin allergy on record'],
      urgent_provider_review: false,
      reason: 'Localized rash without systemic involvement. Routine review appropriate.',
    },
    care_recommendation: {
      care_level: 'telehealth',
      confidence: 0.82,
      reasoning: 'Localized recurrent rash without red flags is well suited to a photo/video telehealth assessment; prior episode resolved with topical prescription.',
      red_flags_to_watch: ['Rapid spreading', 'Facial or throat swelling', 'Fever', 'Blistering or open sores'],
    },
    suggested_provider_questions: [
      'Any new soaps, plants, or chemicals during gardening?',
      'Has the rash changed appearance since onset (blisters, oozing)?',
      'Did the November episode occur after similar exposure?',
    ],
    follow_up_actions: [
      'Provider to review rash photos before or during visit',
      'Confirm allergy list before prescribing',
      'Advise ER immediately if breathing difficulty or facial swelling develops',
    ],
    missing_information: ['Photo of the rash', 'Exact products/plants contacted', 'Any prior patch testing'],
  };
}
