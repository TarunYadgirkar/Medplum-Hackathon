import { NextResponse } from 'next/server';

// Mints a short-lived Deepgram JWT so the browser never sees the API key.
// https://developers.deepgram.com/reference/token-based-auth-api/grant
export async function POST() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 });
  }
  try {
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl_seconds: 600 }),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ...data, scheme: 'bearer' });
    }
    console.error('Deepgram grant failed:', res.status, await res.text());
  } catch (err) {
    console.error('Deepgram grant error:', err);
  }

  // Break-glass for demo day: if the grant endpoint misbehaves and you've
  // explicitly opted in, hand the raw key to the browser (hackathon-only!).
  if (process.env.DEEPGRAM_ALLOW_RAW_KEY === 'true') {
    return NextResponse.json({ access_token: key, scheme: 'token' });
  }
  return NextResponse.json({ error: 'Deepgram grant failed (set DEEPGRAM_ALLOW_RAW_KEY=true as a demo-day fallback)' }, { status: 502 });
}
