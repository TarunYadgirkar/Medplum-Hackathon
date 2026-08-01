import { NextResponse } from 'next/server';

// Tells the intake page which voice engine to use.
// Priority: VOICE_PROVIDER env override → Deepgram (sponsor) → Grok (carepath
// fallback, battle-tested) → demo transcript mode.
export async function GET() {
  const forced = process.env.VOICE_PROVIDER; // 'deepgram' | 'grok' | 'demo'
  if (forced === 'grok' && process.env.XAI_API_KEY) return NextResponse.json({ provider: 'grok' });
  if (forced === 'demo') return NextResponse.json({ provider: 'demo' });
  if (process.env.DEEPGRAM_API_KEY) return NextResponse.json({ provider: 'deepgram' });
  if (process.env.XAI_API_KEY) return NextResponse.json({ provider: 'grok' });
  return NextResponse.json({ provider: 'demo' });
}
