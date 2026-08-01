# PROGRESS — coordination bus for all Claude Code sessions

Read this before starting work. Append (never rewrite others' entries) after every
completed task or blocker. Format: `[time] [lane/session] what happened / what's next`.

## Pre-hackathon (built the night before, in Claude Cowork)

- [done] Full repo scaffolded: Next.js 16 + React 19 + Tailwind 4. `npm run build` passes.
- [done] Keyless end-to-end pipeline verified via `scripts/smoke.sh` (intake-session →
  generate-note (demo fallback) → patients queue → note GET/PATCH → eligibility → history).
- [done] Deepgram Voice Agent hook (`useVoiceAgent`): PCM16 mic/playback, KeepAlive,
  barge-in, ConversationText transcript, FunctionCallRequest handler (defensive to two
  message shapes), JWT auth with `DEEPGRAM_ALLOW_RAW_KEY` break-glass. **NOT tested live.**
- [done] Grok Voice backup engine (`useGrokVoice`) ported from carepath, same interface,
  incl. function-calling round trip. Engine selection via `/api/voice-config`. **NOT tested live.**
- [done] Medplum FHIR store (`src/lib/store.ts`): Patient/Encounter/DocumentReference/
  Composition/RiskAssessment + in-memory fallback. **NOT tested against a real Medplum project.**
- [done] Stedi test-mode eligibility with synthetic fallback. **NOT tested with a real key;
  non-UHC mock member IDs are unverified guesses.**
- [done] Moss indexing/query with keyword fallback (`@moss-dev/moss@1.4.1`, kept in
  `serverExternalPackages`). **NOT tested with real keys.** History docs are hardcoded demo
  data seeded per intake — upgrading to FHIR-derived docs is a stretch goal.
- [done] Provider dashboard (from klarity) + new care-level & coverage cards on the note page.
- [done] Docs: SETUP_KEYS.md (keys local+Vercel), BUILD_PLAN.md (session topology + timeline),
  SUBMISSION.md (form answers + video script), CLAUDE.md (lanes, rules, risks).

## Hackathon day

- (append here)
