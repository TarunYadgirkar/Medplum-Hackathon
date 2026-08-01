import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Ported from carepath's classify route ideas (per-option personalized
// explanations, medical-fit ratings, questionsToAsk). Keyless fallback keeps
// the demo working with zero keys — never break that property.

const CARE_LEVELS = [
  'self_monitor',
  'telehealth',
  'primary_care',
  'urgent_care',
  'emergency_room',
] as const;

type ResearchCareLevel = (typeof CARE_LEVELS)[number];
type Fit = 'low' | 'medium' | 'high';

interface CareOption {
  level: ResearchCareLevel;
  fit: Fit;
  why: string;
  est_cost: string;
}

export interface ResearchResult {
  patient_explainer: string;
  provider_considerations: string[];
  red_flags_to_watch: string[];
  care_options: CareOption[];
  questions_to_ask: string[];
}

const Schema = z.object({
  summary: z.string().min(1).max(4000),
  symptoms: z.array(z.string().max(300)).max(20),
  riskFlags: z.array(z.string().max(200)).max(20),
  careLevel: z.string().max(50).optional(),
  coverage: z
    .object({
      copay: z.number().nullable().optional(),
      deductible_remaining: z.number().nullable().optional(),
      payer: z.string().max(200).optional(),
    })
    .optional(),
});

type Input = z.infer<typeof Schema>;
type Coverage = NonNullable<Input['coverage']>;

const SYSTEM_PROMPT = `You are a health research assistant that prepares a pre-visit research draft. You are NOT a doctor. You NEVER diagnose or prescribe. Everything you produce is a draft that a licensed provider reviews before the visit.

HARD RULES:
- No diagnosis. No prescribing. No treatment instructions.
- The patient explainer must be plain language, educational, and must state that their provider will confirm what is actually going on.
- Provider considerations are phrased as considerations to weigh ("Consider...", "May warrant..."), never as diagnoses.
- If emergency red flags are present in the input, emergency_room must be rated "high" fit.
- Cost estimates: if coverage copay/deductible values are provided, use them; otherwise give typical US price ranges.

Return a JSON object with exactly this structure:
{
  "patient_explainer": "3-4 plain-language sentences about the described issue. Educational only, no diagnosis, and mention that the provider confirms what is going on.",
  "provider_considerations": ["3-5 clinical considerations or differentials for the PROVIDER to weigh, phrased as considerations"],
  "red_flags_to_watch": ["3-5 warning signs specific to these symptoms that mean the patient should seek care urgently"],
  "care_options": [
    { "level": "self_monitor", "fit": "low|medium|high", "why": "personalized to THESE symptoms", "est_cost": "e.g. $0" },
    { "level": "telehealth", "fit": "low|medium|high", "why": "...", "est_cost": "..." },
    { "level": "primary_care", "fit": "low|medium|high", "why": "...", "est_cost": "..." },
    { "level": "urgent_care", "fit": "low|medium|high", "why": "...", "est_cost": "..." },
    { "level": "emergency_room", "fit": "low|medium|high", "why": "...", "est_cost": "..." }
  ],
  "questions_to_ask": ["4-5 symptom-specific questions the patient should ask their doctor — include relevant tests/labs/imaging to ask about, not just generic questions"]
}

"care_options" must contain all 5 levels, each exactly once, in the order shown.`;

function isStringArray(value: unknown, min: number, max: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= min &&
    value.length <= max &&
    value.every((v) => typeof v === 'string' && v.trim().length > 0)
  );
}

function isCareOption(value: unknown): value is CareOption {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.level === 'string' &&
    (CARE_LEVELS as readonly string[]).includes(o.level) &&
    (o.fit === 'low' || o.fit === 'medium' || o.fit === 'high') &&
    typeof o.why === 'string' &&
    o.why.trim().length > 0 &&
    typeof o.est_cost === 'string' &&
    o.est_cost.trim().length > 0
  );
}

function isValidResearchResult(value: unknown): value is ResearchResult {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  if (typeof o.patient_explainer !== 'string' || o.patient_explainer.trim().length === 0) return false;
  if (!isStringArray(o.provider_considerations, 1, 8)) return false;
  if (!isStringArray(o.red_flags_to_watch, 1, 8)) return false;
  if (!isStringArray(o.questions_to_ask, 1, 8)) return false;
  if (!Array.isArray(o.care_options) || o.care_options.length !== CARE_LEVELS.length) return false;
  if (!o.care_options.every(isCareOption)) return false;
  const levels = new Set((o.care_options as CareOption[]).map((opt) => opt.level));
  return CARE_LEVELS.every((level) => levels.has(level));
}

function normalizeCareLevel(careLevel?: string): ResearchCareLevel {
  if (!careLevel) return 'primary_care';
  const normalized = careLevel === 'self_care' ? 'self_monitor' : careLevel;
  return (CARE_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as ResearchCareLevel)
    : 'primary_care';
}

function fallbackCost(level: ResearchCareLevel, coverage?: Coverage): string {
  const copay = coverage?.copay;
  const deductible = coverage?.deductible_remaining;
  const withDeductible = (base: string) =>
    typeof deductible === 'number' && deductible > 0
      ? `${base} (until ~$${deductible.toLocaleString()} deductible is met)`
      : base;

  switch (level) {
    case 'self_monitor':
      return '$0 — home monitoring';
    case 'telehealth':
      return typeof copay === 'number' ? `~$${copay} copay` : '$40-$90 typical';
    case 'primary_care':
      return typeof copay === 'number' ? `~$${copay} copay` : withDeductible('$100-$200 typical');
    case 'urgent_care':
      return withDeductible('$120-$250 typical');
    case 'emergency_room':
      return withDeductible('$800-$2,500+ typical');
  }
}

const FALLBACK_WHY: Record<ResearchCareLevel, { recommended: string; other: string }> = {
  self_monitor: {
    recommended: 'The reported symptoms appear stable enough to track at home while watching for any change.',
    other: 'Home monitoring alone may miss changes given what was reported — keep it as a supplement, not a substitute.',
  },
  telehealth: {
    recommended: 'A video visit can review these symptoms quickly without an in-person exam.',
    other: 'A video visit could give initial guidance, but these symptoms may need more than a screen can assess.',
  },
  primary_care: {
    recommended: 'An in-person primary care visit fits these symptoms — a hands-on exam within a day or two.',
    other: 'A primary care follow-up is reasonable, though it may not match the urgency of what was reported.',
  },
  urgent_care: {
    recommended: 'Same-day in-person evaluation matches the urgency of the reported symptoms.',
    other: 'Urgent care is available if symptoms worsen before a scheduled visit.',
  },
  emergency_room: {
    recommended: 'The reported red flags warrant immediate emergency evaluation.',
    other: 'Reserved for emergencies — go immediately if any red-flag symptom appears.',
  },
};

function fallbackFit(level: ResearchCareLevel, recommended: ResearchCareLevel): Fit {
  const distance = Math.abs(CARE_LEVELS.indexOf(level) - CARE_LEVELS.indexOf(recommended));
  if (distance === 0) return 'high';
  if (distance === 1) return 'medium';
  return 'low';
}

function buildFallback(input: Input): ResearchResult {
  const recommended = normalizeCareLevel(input.careLevel);
  const symptomPhrase =
    input.symptoms.length > 0 ? input.symptoms.slice(0, 3).join(', ').toLowerCase() : 'the symptoms you described';

  return {
    patient_explainer: `You reported ${symptomPhrase}. Symptoms like these can have several everyday explanations, and most are manageable once a clinician takes a proper look. This summary is educational background to help you prepare for your visit, not a diagnosis. Your provider will examine you, ask follow-up questions, and confirm what is actually going on.`,
    provider_considerations: [
      `Consider the reported duration and progression of: ${symptomPhrase}.`,
      'Consider common benign causes before escalating workup.',
      'May warrant review of current medications and recent changes.',
      input.riskFlags.length > 0
        ? `Weigh the flagged risk signals: ${input.riskFlags.slice(0, 3).join('; ')}.`
        : 'Weigh whether any systemic signs (fever, weight change, fatigue) accompany the primary complaint.',
    ],
    red_flags_to_watch: [
      'Symptoms suddenly worsening or spreading',
      'New chest pain, trouble breathing, or confusion',
      'High fever that does not respond to usual measures',
      'Symptoms interfering with eating, drinking, or sleeping',
    ],
    care_options: CARE_LEVELS.map((level) => ({
      level,
      fit: fallbackFit(level, recommended),
      why: level === recommended ? FALLBACK_WHY[level].recommended : FALLBACK_WHY[level].other,
      est_cost: fallbackCost(level, input.coverage),
    })),
    questions_to_ask: [
      'What do you think is most likely causing these symptoms?',
      'Are there tests, labs, or imaging that would help narrow this down?',
      'What warning signs mean I should come back sooner?',
      'How long should I expect this to last, and when should I follow up?',
      'Is there anything I should avoid or change while this resolves?',
    ],
  };
}

function buildUserContent(input: Input): string {
  const lines = [`Symptom summary:\n${input.summary}`];
  if (input.symptoms.length > 0) lines.push(`Reported symptoms:\n- ${input.symptoms.join('\n- ')}`);
  if (input.riskFlags.length > 0) lines.push(`Risk flags:\n- ${input.riskFlags.join('\n- ')}`);
  if (input.careLevel) lines.push(`AI-recommended care level: ${normalizeCareLevel(input.careLevel)}`);
  if (input.coverage) {
    const parts: string[] = [];
    if (input.coverage.payer) parts.push(`Payer: ${input.coverage.payer}`);
    if (typeof input.coverage.copay === 'number') parts.push(`Copay: $${input.coverage.copay}`);
    if (typeof input.coverage.deductible_remaining === 'number') {
      parts.push(`Deductible remaining: $${input.coverage.deductible_remaining}`);
    }
    if (parts.length > 0) lines.push(`Insurance coverage:\n- ${parts.join('\n- ')}`);
  }
  return lines.join('\n\n');
}

async function researchWithOpenAI(apiKey: string, input: Input): Promise<ResearchResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserContent(input) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}: ${await response.text()}`);

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('OpenAI response did not include text output');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('OpenAI returned unparseable JSON');
  }
  if (!isValidResearchResult(parsed)) throw new Error('OpenAI returned an invalid research shape');
  return parsed;
}

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ source: 'fallback', research: buildFallback(input) });
  }

  try {
    const research = await researchWithOpenAI(apiKey, input);
    return NextResponse.json({ source: 'openai', research });
  } catch (err) {
    console.error(
      'Research OpenAI error — using fallback:',
      err instanceof Error ? err.message : 'unknown'
    );
    return NextResponse.json({ source: 'fallback', research: buildFallback(input) });
  }
}
