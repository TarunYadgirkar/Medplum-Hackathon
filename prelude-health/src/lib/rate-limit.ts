import { NextRequest, NextResponse } from 'next/server';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
// Above this many tracked clients, sweep out expired entries so a burst of
// unique IPs cannot grow the map without bound.
const SWEEP_THRESHOLD = 10_000;

// Per-instance, in-memory sliding window: Vercel runs several serverless
// instances and recycles them, so the real ceiling is 30/min per instance
// rather than 30/min globally, and a cold start forgets everything. It stops
// casual hammering of a route without adding a Redis dependency; a shared
// store is the fix if this ever needs to hold a real limit.
const hits = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// Returns a 429 to send back when the caller is over budget, else null.
export function rateLimit(req: NextRequest, scope: string): NextResponse | null {
  const now = Date.now();
  const key = `${scope}:${clientIp(req)}`;
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent);
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    return NextResponse.json(
      { error: 'Too many requests. Please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  hits.set(key, [...recent, now]);
  if (hits.size > SWEEP_THRESHOLD) sweepExpired(now);
  return null;
}

function sweepExpired(now: number): void {
  for (const [key, times] of hits) {
    const live = times.filter((at) => now - at < WINDOW_MS);
    if (live.length === 0) hits.delete(key);
    else hits.set(key, live);
  }
}
