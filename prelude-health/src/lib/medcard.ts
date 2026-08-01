export interface MedCardData {
  medications: string[];
  allergies: string[];
  conditions: string[];
  lastUpdated: string;
}

const MEDCARD_KEY = 'prelude-medcard';

const ITEM_MAX_LEN = 200;
const ROLE_MARKER_RE = /\b(system|user|assistant|ignore\s+previous)\s*:/gi;

export function sanitizeField(value: string, maxLen: number = ITEM_MAX_LEN): string {
  return value
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ')
    .replace(ROLE_MARKER_RE, (m) => m.replace(':', '​:'))
    .trim()
    .slice(0, maxLen);
}

function sanitizeList(items: string[]): string[] {
  return items.map(sanitizeField).filter(Boolean);
}

export function getMedCard(): MedCardData | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(MEDCARD_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== 'object' || parsed === null ||
      !Array.isArray((parsed as MedCardData).medications) ||
      !Array.isArray((parsed as MedCardData).allergies) ||
      !Array.isArray((parsed as MedCardData).conditions)
    ) {
      return null;
    }
    return parsed as MedCardData;
  } catch {
    return null;
  }
}

export function saveMedCard(data: Omit<MedCardData, 'lastUpdated'>): void {
  if (typeof window === 'undefined') return;
  const existing = getMedCard();
  localStorage.setItem(
    MEDCARD_KEY,
    JSON.stringify({
      medications: dedupe([...(existing?.medications ?? []), ...(data.medications ?? [])]),
      allergies: dedupe([...(existing?.allergies ?? []), ...(data.allergies ?? [])]),
      conditions: dedupe([...(existing?.conditions ?? []), ...(data.conditions ?? [])]),
      lastUpdated: new Date().toISOString(),
    })
  );
}

export function clearMedCard(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MEDCARD_KEY);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function buildMedCardContext(data: MedCardData | null): string {
  // try/catch: a stale localStorage entry with a different shape must not
  // throw here — this runs inside the voice-call start path.
  try {
    if (!data || (data.medications.length === 0 && data.allergies.length === 0 && data.conditions.length === 0)) {
      return '';
    }
    const meds = sanitizeList(data.medications);
    const allergies = sanitizeList(data.allergies);
    const conditions = sanitizeList(data.conditions);
    if (meds.length === 0 && allergies.length === 0 && conditions.length === 0) return '';
    const parts: string[] = [];
    if (meds.length > 0) parts.push(`Medications: ${meds.join(', ')}.`);
    if (allergies.length > 0) parts.push(`Known allergies: ${allergies.join(', ')}.`);
    if (conditions.length > 0) parts.push(`Known conditions: ${conditions.join(', ')}.`);
    return `\n\nThe patient has the following on file: ${parts.join(' ')} Use this context — they don't need to repeat themselves.`;
  } catch {
    return '';
  }
}
