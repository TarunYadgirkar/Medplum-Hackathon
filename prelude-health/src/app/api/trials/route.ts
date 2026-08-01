import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_TRIALS = 3;

const Schema = z.object({
  medications: z.array(z.string().max(200)).max(20),
  conditions: z.array(z.string().max(200)).max(20),
  allergies: z.array(z.string().max(200)).max(20),
});

export interface TrialMatch {
  title: string;
  condition_match: string;
  why_eligible: string;
  search_url: string;
}

// Server-side rebuild — never trust a model-generated URL.
function buildSearchUrl(condition: string): string {
  return `https://clinicaltrials.gov/search?cond=${encodeURIComponent(condition.slice(0, 100))}`;
}

const FALLBACK_MAP: { keywords: RegExp; trials: Omit<TrialMatch, 'search_url'>[] }[] = [
  {
    keywords: /diabet|metformin|insulin|a1c|glucose|prediabet/i,
    trials: [
      {
        title: 'Lifestyle and medication studies in type 2 diabetes and prediabetes',
        condition_match: 'Type 2 Diabetes',
        why_eligible: 'Your record mentions diabetes-related conditions or medications, which many glucose-management trials recruit for.',
      },
    ],
  },
  {
    keywords: /hypertension|blood pressure|lisinopril|amlodipine|losartan/i,
    trials: [
      {
        title: 'Blood pressure control and cardiovascular outcome studies',
        condition_match: 'Hypertension',
        why_eligible: 'Your record mentions hypertension or blood pressure medication, a common inclusion criterion for cardiovascular trials.',
      },
    ],
  },
  {
    keywords: /dermatitis|eczema|rash|psoriasis|hives/i,
    trials: [
      {
        title: 'Topical and biologic studies for inflammatory skin conditions',
        condition_match: 'Dermatitis',
        why_eligible: 'Your record mentions a skin condition, and dermatology trials often recruit patients with ongoing symptoms.',
      },
    ],
  },
  {
    keywords: /asthma|inhaler|albuterol|wheez/i,
    trials: [
      {
        title: 'Inhaled therapy and asthma-control studies',
        condition_match: 'Asthma',
        why_eligible: 'Your record mentions asthma or inhaler medication, which respiratory trials commonly recruit for.',
      },
    ],
  },
  {
    keywords: /migraine|headache|sumatriptan|triptan/i,
    trials: [
      {
        title: 'Preventive and acute treatment studies for migraine',
        condition_match: 'Migraine',
        why_eligible: 'Your record mentions migraines or migraine medication, a frequent inclusion criterion for headache trials.',
      },
    ],
  },
];

function fallbackTrials(haystack: string): TrialMatch[] {
  return FALLBACK_MAP.filter((entry) => entry.keywords.test(haystack))
    .flatMap((entry) => entry.trials)
    .slice(0, MAX_TRIALS)
    .map((t) => ({ ...t, search_url: buildSearchUrl(t.condition_match) }));
}

const PROMPT = `You match a patient's medication/condition profile to types of clinical trials they MAY be eligible for on ClinicalTrials.gov.

Given medications, conditions, and allergies, suggest 2-3 trial categories. Return JSON:
{"trials": [{"title": "<short plain-language trial category, max 90 chars>", "condition_match": "<the single condition to search on ClinicalTrials.gov, e.g. 'Type 2 Diabetes'>", "why_eligible": "<ONE patient-friendly sentence tying their record to this trial category>"}]}

RULES:
- Only suggest categories clearly supported by the given profile. If nothing matches, return {"trials": []}.
- Never promise eligibility — phrase as "may be eligible".
- condition_match must be a real, searchable condition name.`;

function parseTrials(text: string): TrialMatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const raw =
    typeof parsed === 'object' && parsed !== null && 'trials' in parsed
      ? (parsed as { trials: unknown }).trials
      : null;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (t): t is { title: unknown; condition_match: unknown; why_eligible: unknown } =>
        typeof t === 'object' && t !== null
    )
    .map((t) => ({
      title: typeof t.title === 'string' ? t.title.trim().slice(0, 120) : '',
      condition_match: typeof t.condition_match === 'string' ? t.condition_match.trim().slice(0, 100) : '',
      why_eligible: typeof t.why_eligible === 'string' ? t.why_eligible.trim().slice(0, 300) : '',
    }))
    .filter((t) => t.title && t.condition_match && t.why_eligible)
    .slice(0, MAX_TRIALS)
    .map((t) => ({ ...t, search_url: buildSearchUrl(t.condition_match) }));
}

async function matchWithOpenAI(
  apiKey: string,
  medications: string[],
  conditions: string[],
  allergies: string[]
): Promise<TrialMatch[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        {
          role: 'user',
          content: `Medications: ${medications.join('; ') || 'none listed'}\nConditions: ${conditions.join('; ') || 'none listed'}\nAllergies: ${allergies.join('; ') || 'none listed'}`,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('OpenAI response did not include text output');
  return parseTrials(text);
}

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { medications, conditions, allergies } = parsed.data;
  const haystack = [...medications, ...conditions].join(' ');

  let trials: TrialMatch[];
  let source: 'openai' | 'fallback';
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    trials = fallbackTrials(haystack);
    source = 'fallback';
  } else {
    try {
      trials = await matchWithOpenAI(apiKey, medications, conditions, allergies);
      source = 'openai';
    } catch (err) {
      console.error('trials error — using fallback map:', err instanceof Error ? err.message : 'unknown');
      trials = fallbackTrials(haystack);
      source = 'fallback';
    }
  }

  return NextResponse.json({ trials, source });
}
