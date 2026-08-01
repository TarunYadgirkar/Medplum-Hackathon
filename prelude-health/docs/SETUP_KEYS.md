# Key setup — local + Vercel

Every integration degrades gracefully, so set keys in this priority order and the app
works at every step. **Local:** copy `.env.example` → `.env` in the repo root and fill
values (never commit `.env` — it's gitignored). **Vercel:** Project → Settings →
Environment Variables → add each name/value for Production + Preview + Development,
then **redeploy** (env changes don't apply to old deployments). CLI alternative:
`vercel env add DEEPGRAM_API_KEY production`.

## 1. Deepgram (primary voice) — 2 min
1. console.deepgram.com (you're signed up — $200 hackathon credit, no card).
2. Left sidebar → **API Keys** → **Create a New API Key** → scope: Member/Owner → copy once.
3. Set `DEEPGRAM_API_KEY`.
4. If the voice call errors with an auth failure at the venue, set `DEEPGRAM_ALLOW_RAW_KEY=true`
   and redeploy — this bypasses the JWT grant step (hackathon-only escape hatch).

## 2. Medplum (FHIR record) — 5 min
1. app.medplum.com → register (free) → create a Project (e.g. "prelude").
2. **Project → Clients** (Admin section) → **New…** → create a ClientApplication.
3. Copy its **ID** → `MEDPLUM_CLIENT_ID`, and **Secret** → `MEDPLUM_CLIENT_SECRET`.
4. `MEDPLUM_BASE_URL` stays `https://api.medplum.com/` (hosted).
5. Verify: run a check-in, then open app.medplum.com → Patient / Encounter / Composition —
   your intake should appear as resources. This is the money shot for the demo video.

## 3. OpenAI (note generation) — 2 min
1. platform.openai.com → API keys.
2. Set `OPENAI_API_KEY`. Optional: `OPENAI_MODEL` (default `gpt-4o-mini`).
   (Gemini was replaced by OpenAI on hackathon day — key already in the committed `.env`.)

## 4. Stedi (eligibility, optional but a big demo moment) — 5 min
1. stedi.com → sign up → get a **test API key** (test mode is free, mock payers only).
2. Set `STEDI_API_KEY` (goes in the `Authorization` header as-is, no "Bearer").
3. Verify: `curl -X POST localhost:3000/api/eligibility -H 'Content-Type: application/json' -d '{"careLevel":"primary_care"}'`
   → response should say `"source":"stedi"`. If it says `"synthetic"`, check the server log.
4. Note: our UHC mock (payer 87726, member UHC202649) is from Stedi's docs. If another
   payer's mock member ID errors, check Stedi's mock requests page or ask their booth.

## 5. Moss (semantic history retrieval, optional) — 5 min
1. portal.usemoss.dev → sign up (no card) → create a project.
2. Copy project ID → `MOSS_PROJECT_ID`, project key → `MOSS_PROJECT_KEY`.
3. Verify: run a check-in, then `curl -X POST localhost:3000/api/history -H 'Content-Type: application/json' -d '{"patientId":"<id from intake>","query":"rash"}'`
   → `"source":"moss"` (falls back to `"fallback"` keyword search without keys).

## 6. Grok Voice (backup voice engine, optional) — from carepath
1. console.x.ai → API key → `XAI_API_KEY`.
2. Force it with `VOICE_PROVIDER=grok` if Deepgram misbehaves; otherwise Deepgram wins
   whenever `DEEPGRAM_API_KEY` is set. Judging note: use Deepgram for the demo —
   two judges are from Deepgram.

## Vercel deploy (10 min, do it early)
1. Push repo to GitHub → vercel.com → **Add New Project** → import the repo (defaults are fine; Next.js auto-detected).
2. Add ALL env vars above before the first deploy (or redeploy after adding).
3. Mic requires HTTPS — Vercel URLs are HTTPS, localhost is exempt. Both work.
4. Smoke-test the deployed URL: `/` → check-in flow → `/dashboard`.
