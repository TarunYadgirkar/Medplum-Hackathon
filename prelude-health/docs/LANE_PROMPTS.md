# Lane kickoff prompts — copy-paste to start each Claude Code session

Setup first (one person, 2 min):

```bash
git clone <repo-url> prelude && cd prelude
git worktree add ../prelude-lane1 -b lane-1
git worktree add ../prelude-lane2 -b lane-2
git worktree add ../prelude-lane3 -b lane-3
git worktree add ../prelude-lane4 -b lane-4
# copy the filled-in .env into EACH worktree directory, then npm install in each
```

Open one Claude Code session (fable) per directory and paste the matching prompt below
verbatim. Person 1 runs Lanes 1+2, Person 2 runs Lanes 3+4. Lane 1 is the attended
critical path — stay near it.

---

## LANE 1 — Voice loop (Person 1, attended)

```
You are the Lane 1 (Voice) session. Read CLAUDE.md and PROGRESS.md first — obey the hard
rules and stay inside Lane 1's files.

GOAL: Get the Deepgram Voice Agent working live, end-to-end, in /intake:
mic audio in → agent replies audibly → live transcript renders → BOTH client-side
functions fire during a real conversation (lookup_patient_history and
check_insurance_coverage) → End Check-in produces a note.

CONTEXT: The WebSocket hook is src/hooks/useVoiceAgent.ts. It has NEVER been tested
against the real API — auth subprotocol, Settings acceptance, message shapes, and the
FunctionCallRequest format are all unverified. CLAUDE.md "Known risks" lists the likely
failures and first fixes. The Grok fallback (src/hooks/useGrokVoice.ts) exists — if
Deepgram is truly stuck after ~45 min, verify Grok works (VOICE_PROVIDER=grok) so we
have a working demo, then come back to Deepgram.

METHOD: I am your microphone and speakers — you cannot hear audio. Batch your tests:
get everything ready, then tell me exactly what to do ("open localhost:3000/intake,
start a check-in, say X, tell me what you hear/see, paste any console errors").
Read the browser console output I paste carefully. Use an opus subagent for deep
protocol debugging against the Deepgram docs (developers.deepgram.com/reference/
voice-agent/voice-agent) if you get stuck.

DONE = a full 2-minute conversation with both functions firing and a note generated.
Then run /handoff. Keep useGrokVoice's interface identical if you change useVoiceAgent's.
```

## LANE 2 — Data / FHIR / Medplum (Person 1, background)

```
You are the Lane 2 (Data/FHIR) session. Read CLAUDE.md and PROGRESS.md first — obey the
hard rules and stay inside Lane 2's files.

GOAL: Make Medplum the real, verified system of record.
1. .env has MEDPLUM_CLIENT_ID/SECRET. Run a scripted check-in (curl the API routes like
   scripts/smoke.sh does) and verify in code AND by fetching back from Medplum that it
   created: Patient, Encounter (in-progress → finished), DocumentReference (transcript),
   Composition with SOAP sections + extensions, RiskAssessment. Fix any auth/search/
   validation errors in src/lib/medplum.ts and src/lib/store.ts.
2. listPatients() currently does naive client-side joins over three searches — verify it
   returns correct rows with real data; optimize only if it's actually slow.
3. Seed 3 realistic demo patients with completed intakes + notes (varied risk levels:
   one urgent_review, one low, one reviewed) so the dashboard looks alive on camera.
   Write the seeder as scripts/seed-demo.ts (runnable via npx tsx or an API route).
4. STRETCH (only if 1-3 are green): build Moss history docs from the patient's real
   FHIR record (prior Compositions/AllergyIntolerance/MedicationRequest) instead of
   the hardcoded demoHistoryDocs in src/lib/moss.ts — coordinate via PROGRESS.md since
   that file is Lane 3's.

RULES: The /api/patients and /api/notes/[id] response contracts are FROZEN. The keyless
in-memory fallback must keep working. Spawn sonnet subagents for the seeder and for
verification scripts in parallel. DONE = resources visible at app.medplum.com + seeded
dashboard + npm run build + bash scripts/smoke.sh green. Then run /handoff.
```

## LANE 3 — Integrations: Stedi + Moss (Person 2, background)

```
You are the Lane 3 (Integrations) session. Read CLAUDE.md and PROGRESS.md first — obey
the hard rules and stay inside Lane 3's files.

GOAL: Flip both integrations from fallback to live.
1. STEDI: .env has STEDI_API_KEY (test mode). Make POST /api/eligibility return
   "source":"stedi" with real parsed copay/deductible/coinsurance. The UHC mock
   (tradingPartnerServiceId 87726, memberId UHC202649) is documented-safe; the
   Cigna/Aetna/CMS entries in MOCK_PAYERS (src/lib/stedi.ts) are unverified guesses —
   fix them from Stedi's mock-requests docs (stedi.com/docs/healthcare/test-mode) or
   remove broken ones. Verify the benefitsInformation parsing against a real response,
   not the guessed shape.
2. MOSS: .env has MOSS_PROJECT_ID/KEY. Make POST /api/history return "source":"moss"
   with sensible ranked results. Verify index creation timing (it happens at
   intake-session start) doesn't race the first query; add a lazy re-index on query
   failure if needed.
3. Verify both THROUGH the demo transcript path end-to-end: run a scripted check-in and
   confirm the saved note's coverage block says source stedi.

RULES: Both must keep their graceful fallbacks (synthetic / keyword) — never make a key
required. Use sonnet subagents to work Stedi and Moss in parallel. DONE = both curls
live + npm run build + bash scripts/smoke.sh green + PROGRESS.md updated with the exact
verified payer/member IDs. Then run /handoff.
```

## LANE 4 — UI / demo polish (Person 2, background)

```
You are the Lane 4 (UI) session. Read CLAUDE.md and PROGRESS.md first — obey the hard
rules and stay inside Lane 4's files (src/app/page.tsx, src/app/intake/page.tsx UI only,
src/app/dashboard/**).

GOAL: Make the exact demo path in docs/SUBMISSION.md look great on camera. Priorities:
1. Intake call screen: the live transcript and the coverage card are the two hero
   moments — make the coverage card slide in with an animation when it appears, make
   the transcript auto-scroll, add a subtle "charting to FHIR" indicator while active.
2. Dashboard queue: risk badges, status chips, empty state; make it read instantly on
   a 1080p recording (font sizes, contrast).
3. Note review page: check the care-level + coverage cards render well with real data;
   tighten spacing; make the Approve flow feel satisfying.
4. Landing page: sharpen copy; add a small "How it works" strip (Talk → Charted to
   FHIR → Costed → Reviewed) with the four sponsor names.
5. STRETCH: a voicevision-style accessibility touch — a high-contrast/large-text toggle
   on the intake page.

RULES: NO changes to hooks, API routes, or response contracts — visual/UX only. If a UI
need requires new data, write the ask in PROGRESS.md instead of changing other lanes'
files. Spawn one sonnet subagent per page to work in parallel. Verify by running the app
and screenshotting each page (Playwright is available). DONE = demo path screenshots look
video-ready + npm run build green. Then run /handoff.
```
