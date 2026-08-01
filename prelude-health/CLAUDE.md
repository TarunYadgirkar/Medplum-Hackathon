# Prelude — Claude Code Context

**Pitch:** Voice-first pre-visit check-in. Patient talks for ~3 minutes; the conversation is
charted into Medplum FHIR live, the agent retrieves history via Moss mid-sentence, answers
cost questions with a Stedi eligibility check, and the provider reviews an AI-drafted SOAP note.
**Event:** YC × Medplum Agentic Healthcare Hackathon, Aug 1 2026. Submissions 5pm. Video by 4pm.

## Current state (verified before hackathon day)

`npm run build` passes. The FULL pipeline works with ZERO keys (demo transcript → note →
dashboard). Every integration has a graceful fallback — never break that property.
NOT yet tested live: Deepgram WebSocket audio (mic → agent → speaker), Grok fallback path,
Stedi with a real test key, Moss with real keys. These are hackathon-morning jobs.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 App Router (Turbopack), React 19, TypeScript, Tailwind 4 |
| Voice (primary) | Deepgram Voice Agent WS — nova-3-medical STT, gpt-4o-mini think, Aura-2 TTS |
| Voice (backup) | Grok Voice (xAI Realtime) — carried over from carepath |
| FHIR record | Medplum (client-credentials server client) |
| Note generation | Gemini `gemini-2.5-flash-lite` |
| Eligibility | Stedi test mode (mock payers) → synthetic-pricing fallback |
| History retrieval | Moss `@moss-dev/moss` → keyword fallback |

## File map (ownership lanes for parallel sessions)

One Claude Code session per lane, in its own git worktree (branch `lane-1`…`lane-4`).
Ready-to-paste kickoff prompts for each lane: **docs/LANE_PROMPTS.md**.

```
LANE 1 — Voice loop (riskiest, most senior session):
  src/hooks/useVoiceAgent.ts        Deepgram WS: audio, transcript, FunctionCallRequest
  src/hooks/useGrokVoice.ts         Backup engine (same interface — keep interfaces in sync)
  src/lib/agent-config.ts           Deepgram Settings message + system prompt + function defs
  src/lib/audio.ts                  PCM16 capture/playback (from carepath — stable)
  src/app/api/voice-token/route.ts  Deepgram JWT grant (+ raw-key break-glass)
  src/app/api/voice-config/route.ts Engine selection
  src/app/api/realtime-token/route.ts  Grok token

LANE 2 — Data / FHIR:
  src/lib/medplum.ts, src/lib/store.ts   All FHIR reads/writes + in-memory fallback
  src/app/api/{intake-session,generate-note,patients,notes/[id],calls/[id]}/route.ts

LANE 3 — Integrations:
  src/lib/stedi.ts + src/app/api/eligibility/route.ts
  src/lib/moss.ts  + src/app/api/history/route.ts

LANE 4 — UI / polish / video assets:
  src/app/page.tsx, src/app/intake/page.tsx, src/app/dashboard/**
```

## Hard rules — never violate

1. API keys NEVER reach the client, except the documented `DEEPGRAM_ALLOW_RAW_KEY` break-glass.
2. Keyless mode must always work end-to-end (`bash scripts/smoke.sh` proves it). Do not add a
   hard dependency on any external service.
3. The dashboard API contract is frozen: `/api/patients` row shape and `/api/notes/[id]` flat
   note shape (see `src/types/index.ts`). Change store internals freely; never the contract.
4. The agent never diagnoses/prescribes — keep the guardrails in both voice prompts
   (`agent-config.ts` AND `useGrokVoice.ts`) and in the generate-note prompt.
5. Emergency language (911/988) stays in: consent screen, both prompts, landing footer.
6. `useVoiceAgent` and `useGrokVoice` must keep identical return interfaces — the intake page
   swaps them by provider.
7. Run `npm run build` && `bash scripts/smoke.sh` before declaring ANY task done.
8. Update `PROGRESS.md` after every completed task or unresolved blocker (create it on first
   write). Other sessions read it — it is the coordination bus between parallel Claude Codes.

## Commands

```bash
npm run dev              # dev server (Turbopack)
npm run build            # MUST pass before any task is "done"
bash scripts/smoke.sh    # keyless end-to-end pipeline test (needs dev server on :3000)
```

## Known risks + first fixes

- **Deepgram WS auth fails** → confirm subprotocol `['bearer', jwt]`; try
  `DEEPGRAM_ALLOW_RAW_KEY=true` (→ `['token', rawkey]`); check the browser console for the
  server's Error message; docs: developers.deepgram.com/reference/voice-agent/voice-agent.
- **FunctionCallRequest shape mismatch** → handler in `useVoiceAgent.ts` accepts both
  `msg.functions[]` and flat `msg` shapes; log the raw message and adapt.
- **nova-3-medical rejected in agent Settings** → fall back to `nova-3`, then `flux-general-en`
  (version 'v2').
- **Stedi non-UHC mock members error** → UHC (87726 / UHC202649) is the documented-safe pair;
  fix `MOCK_PAYERS` in `src/lib/stedi.ts` from Stedi's mock request docs.
- **Moss SDK breaks the build** → it's in `serverExternalPackages` in next.config.ts; keep it there.
- **Medplum 401s** → ClientApplication needs project admin/membership; recreate client, check
  secret has no trailing whitespace.

## Demo requirements (drive all priorities)

The video (docs/SUBMISSION.md has the script) needs, in order: live transcript charting during
a voice call → agent recalls history (Moss) → agent answers cost (Stedi card) → Medplum
console showing real FHIR resources → provider dashboard review. Anything not on that path is
polish — defer it.
