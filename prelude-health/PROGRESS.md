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
- [09:xx] [lane-1] Live Deepgram WS probe (real key) validated the EXACT current
  `buildAgentSettings` payload: nova-3-medical + gpt-4o-mini (temp 0.6, functions at
  agent.think.functions) + aura-2-thalia-en all accepted — SettingsApplied + greeting audio,
  zero Error messages. Auth grant → JWT → `['bearer', jwt]` subprotocol confirmed working.
  FunctionCallRequest live shape = `functions[]` with `id`/`name`/`arguments`(JSON string),
  flat FunctionCallResponse — existing defensive handler in useVoiceAgent.ts already matches.
  NO code changes needed; `npm run build` green. Remaining lane-1 risk is mic/speaker loop in
  a real browser, not the Settings schema.

- [11:30] [lane-1] Live function-calling round trip verified against the real agent WS:
  streamed synthesized patient speech ("rash on my arm... how much will this visit cost"),
  got TWO FunctionCallRequests (lookup_patient_history, check_insurance_coverage) in the
  documented `functions[]` shape (`id`/`name`/`arguments` JSON string, `client_side:true`),
  replied with FunctionCallResponse, agent resumed speaking using the injected answers.
  Added a `client_side === false` guard in useVoiceAgent.ts. Note: server echoes each
  FunctionCallResponse back — harmless, switch ignores it. Note generation swapped
  Gemini→OpenAI gpt-4o-mini (OPENAI_API_KEY, optional OPENAI_MODEL). Repo history was
  rewritten to remove the committed .env — keys now live ONLY in local .env files; get
  them from Tarun's chat, never commit them (repo is public again).
- [11:55] [lane-1] LANE 1 COMPLETE. Real-browser intake call confirmed by Tarun on localhost:
  mic capture, greeting audio playback, live transcript charting all working in Chrome.
  Full lane-1 surface now live-verified: auth grant → JWT → WS, Settings accepted,
  KeepAlive, barge-in path untouched, FunctionCallRequest round trip (both functions),
  client_side guard added. Grok backup engine intentionally NOT live-tested (Deepgram is
  the demo engine per SETUP_KEYS; interfaces unchanged so swap still works if needed).
- [11:0x] [lane-4] Branch lane-4 created. Baseline `npm run build` green after pull.
- [11:0x] [lane-4] Wrote docs/UI_SPEC.md — full page/component/state inventory for the
  Claude Design handoff. Design language will land as new UI later; for now lane-4 does
  structure-only refactors (design tokens + shared components), no visual changes.
- [11:0x] [lane-4 → lane-2 ASK] Dashboard delete button calls `DELETE /api/patients/[id]`
  but that route doesn't exist — silently no-ops. Please add the route (store + Medplum
  delete) or tell lane-4 to hide the button.
- [11:2x] [lane-4] Structure sprint done: `@theme` design tokens in globals.css +
  `src/components/primitives.tsx` shared primitives (Nav/Btn/SectionCard/
  StatusChip/RiskBadge/BulletList), and all 4 pages routed through tokens/primitives
  with ZERO visual change (verified: build green + smoke.sh all pass). The Claude
  Design language will land as a token+primitive swap. Waiting on design mockups.
- [10:45] [lane-2] Medplum VERIFIED LIVE end-to-end. Scripted check-in (smoke.sh path) then
  fetched back via FHIR API: Patient, Encounter (in-progress → finished w/ period.end),
  DocumentReference (base64 transcript), Composition (SOAP sections + note-json/review-status
  extensions, flips preliminary → final on review PATCH), RiskAssessment — all present at
  app.medplum.com. ZERO code changes needed in medplum.ts/store.ts.
- [10:50] [lane-2] listPatients verified with real data: correct rows (name/call_status/
  note_status/risk/note_id), ~330-490ms — fast enough, no optimization.
- [10:55] [lane-2] Added scripts/cleanup-smoke.ts — deletes "Smoke Test" patients + related
  resources from Medplum (every smoke.sh run leaves one; run before recording the video).
- [11:05] [lane-2] scripts/seed-demo.ts DONE + run against live Medplum. 3 demo patients on
  dashboard: Marcus Whitfield (urgent_review/high), Priya Anand (ai_draft/low), Robert Alan
  Chen (reviewed/medium). Note: RiskLevel enum has no "moderate" — it's "medium".
  npm run build + smoke.sh green. Lane 2 core tasks (verify Medplum, listPatients, seed) ALL DONE.
  Before recording video: run `npx tsx scripts/cleanup-smoke.ts` (with .env loaded) to purge
  "Smoke Test" rows from Medplum — 3 currently on the dashboard.
- [11:25] [lane-2] STRETCH DONE: history docs now built from the patient's REAL FHIR record.
  New file src/lib/fhir-history.ts (lane-2 owned — moss.ts untouched, Lane 3 unaffected):
  matches a returning patient by name (excluding the just-created Patient, skipping empty
  same-name leftovers), pulls prior Compositions + AllergyIntolerance + MedicationRequest.
  intake-session route uses FHIR docs when non-empty, demo docs otherwise (keyless intact).
  Seeded patients now have real allergies/meds in Medplum (seed-demo.ts extended).
  VERIFIED LIVE: intake as "Robert Alan Chen" → /api/history returns "Active medications:
  Lisinopril — 10mg once daily; Metformin — 1000mg twice daily" from Medplum.
  DEMO TIP: check in with a seeded name (Robert Alan Chen / Marcus Whitfield / Priya Anand)
  and the agent recalls their real chart. build + smoke green.
- [11:25] [lane-2] NOTE for Lane 3: /api/history "Moss query failed, using keyword fallback:
  TypeError: (results || []).map is not a function" — live Moss query response shape differs
  from expected array. Your fix, in moss.ts queryPatientHistory.
- [12:10] [lane-2] SECURITY: my earlier lane-2 branch was cut from the PRE-rewrite history and
  its push republished the committed .env on the public repo. Fixed: lane-2 work cherry-picked
  onto clean main (e1d27d2, 2a34bb1), origin/lane-2 deleted, all remaining refs audited —
  zero .env reachability. KEYS MUST STILL BE ROTATED (Deepgram/OpenAI/Medplum/Moss) —
  GitHub caches deleted refs. Lesson: after a history rewrite, every un-rebased branch is a leak.
- [12:15] [lane-2] Lane-4 ASK done: DELETE /api/patients/[id] route added (store.deletePatient —
  Medplum RiskAssessment/Composition/DocumentReference/Encounter then Patient, + mem fallback).
  Verified live: deleted test patient returns 410 from Medplum. Dashboard delete button works.
- [12:15] [lane-2] Rerun `npx tsx scripts/cleanup-smoke.ts` right before video — smoke runs
  since the last purge left new "Smoke Test" rows; also "Test Patient"/"E2E Verify"/"Moss Test"
  junk rows can now be removed straight from the dashboard delete button.
- [12:2x] [lane-1] SECURITY CLEANUP: origin/lane-2 and origin/lane-4 carried the old keys
  commit (d2a04e8) after the history rewrite — both force-reset to clean main. ALL SESSIONS:
  `git fetch && git reset --hard origin/<your-branch>` before your next push, or you will
  reintroduce the leaked history. lane-2's and lane-4's work is all on main; nothing lost.
  OPENAI_API_KEY was auto-revoked while exposed (401) — note generation falls back to demo
  note until Tarun supplies a fresh key. Deepgram/Medplum/Moss keys still work.

- [11:5x] [lane-3] MOSS LIVE: /api/history returns source:moss with ranked results (verified
  against real keys). Fixed SDK query shape (SearchResult.docs, not bare array), made index
  build non-blocking at intake-session start (job tracked; queries wait ≤2.5s then keyword-
  fallback; failed builds lazily re-kick). loadIndex for in-memory speed. Keyless fallback
  intact. NEXT: Stedi — BLOCKER: no STEDI_API_KEY in .env (get a test key from stedi.com);
  meanwhile fixing MOCK_PAYERS + 271 parsing from docs so it's live the second the key lands.

- [12:2x] [lane-3] STEDI PREPPED (blocked on key) + E2E VERIFIED. MOCK_PAYERS fixed from
  Stedi's mock-requests docs — verified combos (subscriber-type, sent verbatim incl. name/
  DOB/NPI 1999999984): UHC 87726/UHC123456, Cigna 62308/23456789100, Aetna 60054/AETNA12345,
  CMS CMS/CMS12345678. (Old UHC202649 was dependent-type; Cigna/CMS ids were wrong.) 271
  parsing rewritten per docs: status from benefitsInformation codes 1-5/6, in-network+IND
  preferred, deductible timeQualifier 29(remaining)>23(annual), benefitPercent str fraction.
  WHEN KEY LANDS: put STEDI_API_KEY in .env, run `npx tsx scripts/verify-stedi.ts` — all 4
  payers should print source=stedi. E2E on lane-3: history source=moss post-build, saved
  note coverage block present. build+smoke green. PR #1 open (lane-3→main) — needs a merge
  click. ⚠ OPENAI_API_KEY is INVALIDATED (leaked-key auto-revoke; generate-note silently
  demo-fallbacks) — need fresh key, local .env only. ⚠ rebases onto rewritten main DELETE
  .env from worktrees — re-copy it after rebasing.
- [12:25] [lane-2] Dashboard purged to camera-ready state: ONLY the 3 seeded demo patients
  remain (Marcus urgent_review/high, Priya ai_draft/low, Robert reviewed/medium). All test
  junk deleted from Medplum. If any lane runs smoke.sh again, rerun cleanup-smoke.ts after.
  Lane 2 session ended.

- [1:0x] [full-scope] Carepath features ported: (1) Epic MyChart import — 24-system modal,
  simulated SMART on FHIR, /records page; imported chart feeds the voice prompt (fenced as
  untrusted data) AND the Moss history index via intake-session historyDocs (sanitized
  server-side). (2) MedCard — /medcard, 3-col card + pill scanner (graceful no-key state).
  (3) Reddit communities — /api/communities (OpenAI w/ curated keyless fallback + Arctic
  Shift enrichment) on the provider note page. Reviews run (react/ts/security): CRITICAL
  server-side sanitization fixed, size caps + localStorage validation added; known gaps
  left per MVP scope: no auth on patientId routes, no abort guards on scanner/communities
  fetches. Deployed: prelude-health.vercel.app (Vercel project linked to GitHub, root
  prelude-health, auto-deploy on main). Vercel env vars pending Tarun (fresh OpenAI key!).

- [11:50] [lane-1/review] Full 3-agent review (security/react/ts) of the carepath-port layer
  (epic import, medcard scanner, records, communities) — no CRITICAL. Fixed + pushed (155e1c4,
  ee72757 w/ concurrent session): server-side sanitizeField on historyDocs[]/patientName/
  appointmentType in intake-session route (public POST was injectable into voice prompt + SOAP
  note), try/catch guards on buildEpicContext/getImportedHistoryDocs/buildMedCardContext (stale
  localStorage shape threw inside voice start() and leaked the WS), req.json().catch, root
  .gitignore for .vercel/. Build + smoke green, smoke rows cleaned from Medplum. STILL OPEN:
  OPENAI_API_KEY revoked (401 — blocks generate-note/scan-label/communities; Tarun supplying),
  STEDI_API_KEY missing, scan-label 8MB zod limit vs ~4.5MB Vercel body cap, no rate limiting
  on new OpenAI-backed routes, old Deepgram/Medplum/Moss keys unrotated.

- [12:05] [lane-1/review] KEYS VERIFIED LIVE (local + Vercel): OpenAI 200 — communities returns
  source:openai with real Arctic Shift member counts (local AND prelude-health.vercel.app),
  scan-label available:true via vision, generate-note produced a real transcript-derived note
  (test patient created + deleted). All 5 prod pages 200. STILL MISSING: STEDI_API_KEY (not in
  .env or .env.local) — eligibility stays on synthetic fallback until it lands; then run
  `npx tsx scripts/verify-stedi.ts`.
- [2:0x] [full-scope] Brief-alignment: NEW /api/research + ResearchPanel on the note page —
  deep research (patient explainer + provider considerations + red flags), care-level
  spectrum viz, color risk pills, care-options table w/ medical-fit badges + coverage-aware
  costs (ported/adapted from carepath classify + CareOptionsTable + RiskSignalTags +
  timeline ramp). Verified live w/ OpenAI on Marcus's note. Also: modal double-click fix,
  free-text appointment type, demo copy cleanup. Before video: rerun cleanup-smoke.ts if
  any smoke.sh ran since last purge.
- [12:36] [subagent/past-visits] Added src/components/visits/PastVisits.tsx + wired 'Past Visits' SectionCard into src/app/dashboard/[noteId]/page.tsx after Patient Summary. Matches prior visits via GET /api/patients (read-only): resolves patient name from the row whose note_id == current note (Note contract has no name field), then case-insensitive name match, excluding current note. Build passes.
- [subagent/landing+medcard] Landing (src/app/page.tsx): added Med Card (/medcard) and Health
  records (/records) cards to the existing hero grid (now 4 cards, same style); restored the
  911/988 emergency line in the landing footer (hard rule 5 — it was missing). MedCard: new
  src/components/medcard/ManualMedForm.tsx (name/dosage/frequency -> sanitizeField ->
  saveMedCard merge, keyless), wired into src/app/medcard/page.tsx under an "or add manually"
  divider; MedCard.tsx now shows a friendly empty state listing the 3 fill paths (scan /
  manual / MyChart import) when all lists are empty. npm run build passes. Note: one build
  attempt failed transiently on src/app/records/page.tsx (other builder mid-edit); retry green.

## Records page polish (records-lane builder)
- Added src/components/records/RecordSummaryStrip.tsx (stat strip: meds/allergies/conditions/labs/visits, ChartTimeline category colors)
- src/app/records/page.tsx: summary strip under header, tab filter row (All/Timeline/Medications/Allergies/Labs/Visits, client state), "Start voice check-in" Btn -> /intake; all existing sections intact
- src/components/records/ChartTimeline.tsx: legend row above timeline
- npm run build passes; smoke.sh intentionally NOT run (dashboard camera-ready)
- [3:0x] [full-scope] Polish sweep merged: Past Visits on note page, records tabs + summary
  strip + timeline legend, landing links to /records + /medcard (911/988 restored on
  landing), manual med entry on medcard. Plus: insurance picker on intake (UHC/Cigna/
  Aetna/Medicare/self-pay) flowing through voice eligibility calls AND generate-note;
  synthetic fallback now payer-aware (different copay/deductible per payer keyless);
  Stedi mock payers ready for all 4 when key lands. Appointment type = select + "Other —
  describe it" free-text (datalist UX was broken). Reddit communities: official logo,
  "via Reddit" badge, expanded warning block (peer-not-medical-advice, privacy, 911/988).
- [3:3x] [full-scope] Urgency slider on intake (30 sec demo / 1 / 3 / 5 min) drives real
  agent pacing on both engines + shorter replies globally. MyChart import personalizes to
  the entered patient name (Maya Patel only via records-page sample data). Record shape
  aligned to real MyChart: Test Results / Visits (with Upcoming) / Immunizations / Health
  Issues; timeline + summary strip + history docs updated. Browser-verified end to end.
- [13:xx] [lane-4] DESIGN LANGUAGE IMPLEMENTED from the Claude Design handoff ("Prelude UI
  Handoff.dc.html"): new tokens (ink/paper/panel/brand blue/danger/caution/positive, radius 0,
  Archivo+Jost+Spline Mono+Material Symbols) in globals.css/layout/primitives, then all
  screens restyled in parallel: landing (5a), intake wizard incl. dark voice stage (5b-5d),
  dashboard queue (5e), note review (5f). NEW surfaces: CoverageBot guided Stedi slide-over
  (6a-6b, mounted on landing + intake done + note page) and /dashboard/patient/[id] chart
  with timeline + calendar + skeleton/empty states (6c-6e); ChartTimeline on /records
  restyled to tokens. ALL logic/contracts untouched. build + smoke.sh green.
- [lane-3] Insurance upgraded to carrier+plan model: new src/data/insurance-plans.ts
  (7 carriers, real plan names — UHC Choice Plus/Options PPO/Navigate HMO, Cigna OAP/
  LocalPlus/SureFit, Aetna Open Choice PPO/Managed Choice POS/Select, BCBS BlueCard PPO/
  Blue Choice, Kaiser Traditional/Deductible HMO, Medicare Part B/Advantage, Medicaid MC).
  Keyless path in stedi.ts now builds a per-plan simulated 271 (codes 1/B/C/A, network
  indicators) and runs it through the SAME parseStediResponse as live — source stays
  'synthetic'. planId flows intake page (carrier+plan selects, prelude-plan localStorage)
  → both voice hooks → /api/eligibility + /api/generate-note. payerKey enum widened
  (legacy CMS still accepted → Medicare). Missing planId → carrier's first plan.
  build + tsc + smoke.sh green; curled BCBS/Kaiser/Medicare/Medicaid/CMS all correct.
