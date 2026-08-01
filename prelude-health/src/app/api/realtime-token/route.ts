import { NextResponse } from 'next/server';

// Grok Voice (xAI Realtime) ephemeral token — carried over from carepath.
// Backup voice engine if Deepgram has issues at the venue.
export async function POST() {
  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY is not configured' }, { status: 500 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch('https://api.x.ai/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error('Realtime token fetch error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Voice service temporarily unavailable' }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    console.error('Realtime token upstream error:', response.status, await response.text());
    return NextResponse.json({ error: 'Voice service temporarily unavailable' }, { status: 502 });
  }

  const data = await response.json();
  if (!data.value) {
    return NextResponse.json({ error: 'Grok Voice session response missing token' }, { status: 502 });
  }
  return NextResponse.json({ token: data.value, model: 'grok-voice-think-fast-1.0' });
}
