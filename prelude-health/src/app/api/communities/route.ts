import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Ported from carepath's communities route. OPENAI_API_KEY is currently revoked,
// so a curated keyword fallback keeps the demo working fully keyless.

const DISCLAIMER =
  'These are public Reddit communities, not medical sources. People share personal experiences that may be inaccurate or unverified. Always confirm anything you read with a licensed clinician.';

const MAX_COMMUNITIES = 5;
const ARCTIC_SHIFT_TIMEOUT_MS = 5_000;
const VALID_NAME = /^[A-Za-z0-9_]+$/;

export interface Community {
  name: string;
  title: string;
  members: number | null;
  description: string;
  why: string;
  url: string;
}

interface Candidate {
  name: string;
  why: string;
}

interface ArcticShiftSubreddit {
  display_name?: string;
  title?: string;
  subscribers?: number;
  public_description?: string;
}

const Schema = z.object({
  summary: z.string().min(1).max(4000),
  riskFlags: z.array(z.string().max(200)).max(20).optional(),
});

const FALLBACK_MAP: { keywords: RegExp; candidates: Candidate[] }[] = [
  {
    keywords: /\brash(es)?\b|dermatitis|eczema|hives|itch/i,
    candidates: [
      { name: 'DermatologyQuestions', why: 'People post skin symptoms and rashes here to hear how others navigated similar issues.' },
      { name: 'eczema', why: 'A large community sharing experiences with recurring, itchy skin conditions.' },
    ],
  },
  {
    keywords: /headache|migraine/i,
    candidates: [
      { name: 'migraine', why: 'Members discuss headache triggers, patterns, and what helped them cope.' },
    ],
  },
  {
    keywords: /anxiety|stress|panic/i,
    candidates: [
      { name: 'Anxiety', why: 'A peer-support space where people share how they manage anxious and stressful periods.' },
    ],
  },
  {
    keywords: /back\s?pain|lower back|lumbar/i,
    candidates: [
      { name: 'backpain', why: 'People compare experiences with back pain and what recovery looked like for them.' },
    ],
  },
  {
    keywords: /stomach|gut|bowel|nausea|digest|abdominal/i,
    candidates: [
      { name: 'ibs', why: 'A community discussing stomach and digestive symptoms and day-to-day management.' },
    ],
  },
];

const DEFAULT_CANDIDATES: Candidate[] = [
  { name: 'AskDocs', why: 'A moderated community where verified clinicians respond to patient questions.' },
  { name: 'Health', why: 'A general community for discussing health experiences and questions.' },
];

function fallbackCandidates(summary: string): Candidate[] {
  const matched = FALLBACK_MAP.filter((entry) => entry.keywords.test(summary)).flatMap(
    (entry) => entry.candidates
  );
  const picked = matched.length > 0 ? matched : DEFAULT_CANDIDATES;
  return picked.slice(0, MAX_COMMUNITIES);
}

const PROMPT = `You suggest real, established Reddit support communities where patients with given symptoms can read others' experiences.

Given a patient's symptom summary (and optional risk flags), suggest 3-5 RELEVANT, REAL patient/condition support subreddits.

RULES:
- Favor well-known, established health/condition communities (e.g. migraine, ChronicPain, AskDocs, type1diabetes, ibs, Asthma, multiplesclerosis, POTS, Anxiety, depression).
- Names must be PLAUSIBLE REAL subreddits. Do NOT invent obviously-fake names.
- Return the subreddit name WITHOUT the "r/" prefix.
- Each "why" is ONE patient-friendly sentence explaining why this community may be relevant to the symptoms.

Return a JSON object with exactly this structure:
{
  "communities": [
    { "name": "<subreddit without r/>", "why": "<one patient-friendly sentence>" }
  ]
}`;

function parseCandidates(text: string): Candidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null || !('communities' in parsed)) return [];
  const raw = (parsed as { communities: unknown }).communities;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((c): c is { name: unknown; why: unknown } => typeof c === 'object' && c !== null && 'name' in c)
    .map((c) => ({
      name: typeof c.name === 'string' ? c.name.trim().replace(/^r\//i, '') : '',
      why: typeof c.why === 'string' ? c.why.trim() : '',
    }))
    .filter((c) => c.name.length > 0 && VALID_NAME.test(c.name))
    .slice(0, MAX_COMMUNITIES);
}

async function suggestWithOpenAI(apiKey: string, summary: string, riskFlags: string[]): Promise<Candidate[]> {
  const userContent = riskFlags.length
    ? `Symptom summary:\n${summary}\n\nRisk flags:\n- ${riskFlags.join('\n- ')}`
    : `Symptom summary:\n${summary}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('OpenAI response did not include text output');
  const candidates = parseCandidates(text);
  if (candidates.length === 0) throw new Error('OpenAI returned no valid community candidates');
  return candidates;
}

async function enrich(candidate: Candidate): Promise<Community> {
  const base: Community = {
    name: candidate.name,
    title: '',
    members: null,
    description: '',
    why: candidate.why,
    url: `https://www.reddit.com/r/${candidate.name}/`,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ARCTIC_SHIFT_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://arctic-shift.photon-reddit.com/api/subreddits/search?subreddit=${encodeURIComponent(candidate.name)}&limit=1`,
      { signal: controller.signal }
    );
    if (!res.ok) return base;

    const json: unknown = await res.json();
    const data =
      typeof json === 'object' && json !== null && 'data' in json ? (json as { data: unknown }).data : null;
    if (!Array.isArray(data) || data.length === 0) return base;

    const hit = data[0] as ArcticShiftSubreddit;
    const matches =
      typeof hit.display_name === 'string' &&
      hit.display_name.toLowerCase() === candidate.name.toLowerCase();
    if (!matches) return base;

    return {
      ...base,
      title: typeof hit.title === 'string' ? hit.title : '',
      members: typeof hit.subscribers === 'number' ? hit.subscribers : null,
      description: typeof hit.public_description === 'string' ? hit.public_description : '',
    };
  } catch {
    return base;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { summary, riskFlags = [] } = parsed.data;

  let candidates: Candidate[];
  let source: 'openai' | 'fallback';
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    candidates = fallbackCandidates(summary);
    source = 'fallback';
  } else {
    try {
      candidates = await suggestWithOpenAI(openaiKey, summary, riskFlags);
      source = 'openai';
    } catch (err) {
      console.error('Communities OpenAI error — using fallback map:', err instanceof Error ? err.message : 'unknown');
      candidates = fallbackCandidates(summary);
      source = 'fallback';
    }
  }

  const communities = await Promise.all(candidates.map(enrich));

  return NextResponse.json({ communities, disclaimer: DISCLAIMER, source });
}
