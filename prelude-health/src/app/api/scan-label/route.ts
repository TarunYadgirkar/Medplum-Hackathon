import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_IMAGE_BASE64_LEN = 8 * 1024 * 1024;
const MAX_TEXT_LEN = 2000;
const MAX_MEDICATIONS = 20;

const ImageSchema = z.object({
  image: z
    .string()
    .startsWith('data:image/')
    .max(MAX_IMAGE_BASE64_LEN),
});

const TextSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_LEN),
});

const Schema = z.union([ImageSchema, TextSchema]);

interface ScanLabelResult {
  medicationName: string;
  dosage: string;
  frequency: string;
  confidence: 'low' | 'medium' | 'high';
}

function isValidScanResult(val: unknown): val is ScanLabelResult {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return (
    typeof v.medicationName === 'string' &&
    typeof v.dosage === 'string' &&
    typeof v.frequency === 'string' &&
    (v.confidence === 'low' || v.confidence === 'medium' || v.confidence === 'high')
  );
}

const IMAGE_SYSTEM_PROMPT = `You are a pill bottle label reader. Extract medication name, dosage, and frequency/instructions from the image. Return JSON: {"medicationName": string, "dosage": string, "frequency": string, "confidence": "low"|"medium"|"high"}. If the image is unreadable or not a medication label, set medicationName to "" and confidence to "low".`;

const TEXT_SYSTEM_PROMPT = `You extract medications from a patient's spoken or typed description. The text may mention several medications. Return JSON: {"medications": [{"medicationName": string, "dosage": string, "frequency": string, "confidence": "low"|"medium"|"high"}]}. Use "" for any dosage or frequency the patient did not state. Confidence reflects how clearly the medication was named. If no medications are mentioned, return {"medications": []}. Never invent medications not present in the text.`;

async function callOpenAI(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      ...body,
    }),
  });
}

export async function POST(req: NextRequest) {
  // Reject oversized payloads before buffering the whole body.
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 12 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Body must be {image: 'data:image/...' under 8 MB} or {text: string, 1-2000 chars}",
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ available: false, reason: 'no key' });
  }

  const isTextMode = 'text' in parsed.data;

  try {
    const response = isTextMode
      ? await callOpenAI(apiKey, {
          max_tokens: 800,
          messages: [
            { role: 'system', content: TEXT_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Extract all medications from this description:\n\n${(parsed.data as { text: string }).text}`,
            },
          ],
        })
      : await callOpenAI(apiKey, {
          max_tokens: 400,
          messages: [
            { role: 'system', content: IMAGE_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Read this medication label.' },
                { type: 'image_url', image_url: { url: (parsed.data as { image: string }).image } },
              ],
            },
          ],
        });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ available: false, reason: 'invalid key' });
    }
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI response did not include text output');

    const result: unknown = JSON.parse(text);

    if (isTextMode) {
      const meds = (result as Record<string, unknown>)?.medications;
      if (!Array.isArray(meds)) throw new Error('Unexpected response shape from text model');
      const medications = meds
        .filter(isValidScanResult)
        .filter((m) => m.medicationName.trim().length > 0)
        .slice(0, MAX_MEDICATIONS);
      return NextResponse.json({ available: true, medications });
    }

    if (!isValidScanResult(result)) throw new Error('Unexpected response shape from vision model');
    return NextResponse.json({ available: true, ...result });
  } catch (err) {
    console.error('scan-label error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json(
      { error: 'Failed to extract medications — please try again or enter manually' },
      { status: 502 }
    );
  }
}
