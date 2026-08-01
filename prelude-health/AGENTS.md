# AGENTS.md — canonical agent handoff for Prelude

New agent? Read this, then `CLAUDE.md` (rules, unchanged), then skim `PROGRESS.md`
(the full day's history — append-only coordination bus, never rewrite entries).
Root `README.md` has the product story + demo script.

## Current state (2026-08-01, end of hackathon day)

Everything below is DONE, live-verified, and deployed at **prelude-health.vercel.app**:

- **Voice loop (Deepgram)** — real-browser verified: JWT grant → WS `['bearer', jwt]`,
  nova-3-medical + gpt-4o-mini + aura-2-thalia-en Settings accepted, live transcript,
  barge-in, KeepAlive, function-calling round trip (`lookup_patient_history`,
  `check_insurance_coverage`), agent-initiated **`end_checkin`** (recap + goodbye →
  auto-chart, 7s safety timeout). Mic RMS noise gate (higher threshold while agent speaks),
  AGC off, mic/speaker mute buttons. Skip-form voice-first path (`collectIdentity`).
  Urgency slider (30s/1/3/5 min) drives pacing on BOTH engines. Grok backup engine kept
  interface-parity but was never live-tested (Deepgram is the demo engine).
- **Medplum** — verified live at app.medplum.com: Patient, Encounter (in-progress→finished),
  DocumentReference (base64 transcript), Composition (SOAP + note-json/review-status
  extensions, preliminary→final on approve PATCH), RiskAssessment. `DELETE
  /api/patients/[id]` cascades. 3 seeded demo patients (Marcus Whitfield urgent/high,
  Priya Anand ai_draft/low, Robert Alan Chen reviewed/medium) with real allergies/meds.
- **Moss** — live `source:moss` ranked results; index build non-blocking at intake start,
  queries wait ≤2.5s then keyword fallback. Returning patients get history docs built
  from their REAL FHIR record (`src/lib/fhir-history.ts`).
- **Stedi** — MOCK_PAYERS verified from docs (UHC 87726/UHC123456, Cigna 62308/23456789100,
  Aetna 60054/AETNA12345, CMS CMS/CMS12345678), 271 parser rewritten per docs. Keyless path
  builds a per-plan **simulated 271** run through the SAME parser (`source:'synthetic'`).
  Carrier→plan model in `src/data/insurance-plans.ts` (7 carriers, real plan names);
  planId flows intake → voice hooks → eligibility + generate-note.
- **OpenAI** — note generation (gpt-4o-mini, replaced Gemini on hackathon day), deep
  research panel, Reddit communities (+ Arctic Shift member counts), pill-label vision scan.
  All verified live locally AND on prod.
- **UI** — full design-language pass (Claude Design handoff): ink/paper tokens, radius 0,
  Archivo/Jost/Spline Mono, dark voice stage, VoiceOrb (sim on landing, mic-driven on call),
  CoverageBot slide-over, `/dashboard/patient/[id]` chart with timeline+calendar,
  `/records` tabs + summary strip + timeline legend, `/medcard` scanner + manual entry,
  Past Visits on the note page, MyChart import personalized to entered name.

## Key files map

```
src/hooks/useVoiceAgent.ts        Deepgram Voice Agent WS (primary)
src/hooks/useGrokVoice.ts         Grok backup — MUST keep identical return interface
src/lib/agent-config.ts           Deepgram Settings + system prompt + function defs
src/lib/audio.ts                  PCM16 capture/playback   src/lib/mic-level.ts  noise gate/levels
src/lib/medplum.ts, store.ts      FHIR writes + in-memory fallback (store is the seam)
src/lib/fhir-history.ts           returning-patient history from real FHIR record
src/lib/moss.ts                   Moss index/query (SearchResult.docs shape!) + keyword fallback
src/lib/stedi.ts                  270/271 + simulated-271 keyless path
src/data/insurance-plans.ts       carrier→plan catalog
src/lib/epic-import.ts, medcard.ts, emergency-keywords.ts
src/app/api/*                     voice-token, voice-config, realtime-token, intake-session,
                                  generate-note, patients(+[id] DELETE), notes/[id], calls/[id],
                                  eligibility, history, research, communities, scan-label
src/app/{page,intake,records,medcard}.tsx + dashboard/{page,[noteId],patient/[id]}
src/components/{primitives,voice-orb,coverage-bot,epic,medcard,records,research,visits,communities}
src/types/index.ts                FROZEN dashboard API contracts
scripts/smoke.sh                  keyless e2e (needs dev server on :3000)
scripts/{seed-demo,cleanup-smoke,verify-stedi}.ts
docs/{SETUP_KEYS,BUILD_PLAN,SUBMISSION,UI_SPEC,LANE_PROMPTS}.md
```

## Hard rules (from CLAUDE.md — recap, full text there)

1. API keys never reach the client (sole exception: documented `DEEPGRAM_ALLOW_RAW_KEY`).
2. Keyless mode must always work end-to-end — never add a hard external dependency.
3. `/api/patients` row shape and `/api/notes/[id]` flat note shape are FROZEN.
4. Agent never diagnoses/prescribes — guardrails live in BOTH voice prompts + note prompt.
5. Emergency 911/988 language stays: consent screen, both prompts, landing footer.
6. `useVoiceAgent` / `useGrokVoice` keep identical return interfaces.
7. `npm run build` && `bash scripts/smoke.sh` before declaring anything done.
8. Append to `PROGRESS.md` after every task/blocker.

## Env / deploy state

- **Vercel:** project linked to GitHub, auto-deploys on push to `main`,
  **rootDirectory = `prelude-health`**. All env vars are set in Vercel including
  `STEDI_API_KEY`. (Names in README table + docs/SETUP_KEYS.md. NEVER write values
  anywhere — the repo is public and already survived one key-leak incident; all leaked
  keys were rotated.)
- **Local:** `.env` in `prelude-health/` (gitignored). Keys come from Tarun directly.

## Gotchas

- `tsx` scripts do NOT load `.env` — run `set -a && . ./.env && set +a` first
  (e.g. before `npx tsx scripts/cleanup-smoke.ts` or `verify-stedi.ts`).
- Deploy context is the repo ROOT, not `prelude-health/` — Vercel's rootDirectory
  handles the subfolder. Don't `vercel` from inside `prelude-health/`.
- `epic-sandbox` branch is ABANDONED per user — ignore it. Lane branches are merged;
  work happens on `main`. Other sessions push frequently: pull-merge before pushing.
- `PROGRESS.md` is append-only — never rewrite others' entries.
- `smoke.sh` leaves "Smoke Test" rows in Medplum — run `cleanup-smoke.ts` after
  (dashboard is kept camera-ready with only the 3 seeded patients).
- `@moss-dev/moss` must stay in `serverExternalPackages` (next.config.ts) or the build breaks.
- Moss query returns `SearchResult.docs`, not a bare array.
- RiskLevel enum has no `moderate` — it's `medium`.
- Known accepted MVP gaps: no auth on patientId routes, no rate limiting on
  OpenAI-backed routes, scan-label zod limit 8MB vs ~4.5MB Vercel body cap.

## Answering judge questions — crib sheet

- **"How do you use Medplum?"** Every check-in writes 5 real FHIR resources
  (`src/lib/store.ts` → `medplum.ts`): Patient, Encounter, DocumentReference (transcript),
  Composition (SOAP, preliminary→final on provider approve), RiskAssessment. Returning
  patients' voice-agent context is rebuilt FROM the live FHIR record (`fhir-history.ts`).
  Show it live at app.medplum.com.
- **"How do you use Deepgram?"** Full Voice Agent WS (`useVoiceAgent.ts`): nova-3-medical
  STT, gpt-4o-mini think with client-side functions defined in `agent-config.ts`, Aura-2
  TTS. Short-lived JWT via token grant (`api/voice-token`), barge-in, and the agent can
  end the call itself via `end_checkin`.
- **"How do you use Moss?"** Semantic index per patient built at intake start
  (`src/lib/moss.ts`); the agent's `lookup_patient_history` function hits `/api/history`
  mid-sentence and speaks the retrieved facts. Real: verified `source:moss` with live keys.
- **"How do you use Stedi?"** `check_insurance_coverage` → `/api/eligibility` →
  270/271 test-mode request (`src/lib/stedi.ts`) against verified mock payers; parsed to
  copay/deductible/coinsurance and spoken by the agent + shown as a coverage card.
- **What's real vs simulated:**
  - REAL: Deepgram voice loop, Medplum FHIR writes/reads, Moss retrieval, OpenAI note/
    research/communities/scan, Stedi test-mode when keyed.
  - SIMULATED: MyChart "connect" UI (SMART-on-FHIR look-alike, no live Epic call);
    Stedi keyless fallback (synthetic per-plan 271, honestly labeled `source:"synthetic"`,
    parsed by the same code path as live).
  - Grok Voice backup exists but wasn't live-tested; Deepgram is the demo engine.
