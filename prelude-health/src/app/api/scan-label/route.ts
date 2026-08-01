import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_IMAGE_BASE64_LEN = 8 * 1024 * 1024;

const Schema = z.object({
  image: z
    .string()
    .startsWith('data:image/')
    .max(MAX_IMAGE_BASE64_LEN),
});

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

const SYSTEM_PROMPT = `You are a pill bottle label reader. Extract medication name, dosage, and frequency/instructions from the image. Return JSON: {"medicationName": string, "dosage": string, "frequency": string, "confidence": "low"|"medium"|"high"}. If the image is unreadable or not a medication label, set medicationName to "" and confidence to "low".`;

export async function POST(req: NextRequest) {
  // Reject oversized payloads before buffering the whole body.
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 12 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "image must be a data URL starting with 'data:image/' and under 8 MB" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ available: false, reason: 'no key' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Read this medication label.' },
              { type: 'image_url', image_url: { url: parsed.data.image } },
            ],
          },
        ],
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ available: false, reason: 'invalid key' });
    }
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI response did not include text output');

    const result: unknown = JSON.parse(text);
    if (!isValidScanResult(result)) throw new Error('Unexpected response shape from vision model');

    return NextResponse.json({ available: true, ...result });
  } catch (err) {
    console.error('scan-label error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json(
      { error: 'Failed to extract label — please try again or enter manually' },
      { status: 502 }
    );
  }
}
