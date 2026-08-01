# Prelude — voice-first pre-visit check-in

**Live:** https://prelude-health.vercel.app · **App code:** [`prelude-health/`](prelude-health)

A patient talks to Prelude for ~3 minutes before their visit. The conversation is charted
**live into Medplum FHIR**, the voice agent retrieves the patient's history via **Moss**
mid-sentence, answers "how much will this cost?" with a **Stedi** eligibility check, and the
provider opens their dashboard to review an **AI-drafted SOAP note** — plus deep research,
care options, and past visits — before the patient ever sits down.

Built at the YC × Medplum Agentic Healthcare Hackathon (Aug 1, 2026).

---

## What it does

### Patient flow

1. **Land** on the home page — start a check-in, open your Med Card, or view your Health Records.
2. **Intake form** — name, appointment type (select + free-text "Other"), insurance
   (carrier → real plan names, e.g. UHC Choice Plus, Cigna OAP), and an **urgency slider**
   (30-sec demo / 1 / 3 / 5 min) that drives the agent's pacing and reply length.
   Or **skip the form entirely** — "just talk to Prelude" and the agent collects your name
   and visit type in conversation.
3. **Consent screen** — explicit consent + emergency language (911/988).
4. **Voice call** — talk naturally. Live transcript charts on screen as you speak
   (Deepgram Voice Agent: nova-3-medical STT → gpt-4o-mini reasoning → Aura-2 TTS).
   Barge-in works; mic noise gate stops background audio from interrupting; mute buttons
   for both mic and the agent. Mid-conversation the agent calls client-side functions:
   - `lookup_patient_history` → Moss semantic search over the patient's chart
   - `check_insurance_coverage` → Stedi eligibility (copay/deductible/coinsurance)
   - `end_checkin` → the agent wraps up and ends the call itself after a recap + goodbye
5. **Done** — the visit is charted to Medplum as FHIR resources automatically.
6. **Extras:** `/records` (MyChart-style imported chart with timeline + tabs),
   `/medcard` (medication card + pill-bottle scanner + manual entry), and a
   CoverageBot slide-over for a guided insurance cost check anytime.

### Provider flow

1. **Dashboard** (`/dashboard`) — patient queue with call status, note status, and risk level.
2. **Note review** (`/dashboard/[noteId]`) — AI-drafted SOAP note with risk assessment,
   care-level spectrum, coverage card, **deep research panel** (patient explainer, provider
   considerations, red flags, care-options table with medical-fit badges and coverage-aware
   costs), **Reddit community suggestions** (with peer-not-medical-advice warnings), and
   **Past Visits** for returning patients.
3. **Approve** — one click flips the FHIR Composition from `preliminary` to `final`.
4. **Patient chart** (`/dashboard/patient/[id]`) — timeline + calendar view of the record.
5. Everything is inspectable as real FHIR resources at app.medplum.com: Patient, Encounter,
   DocumentReference (transcript), Composition (SOAP), RiskAssessment.

---

## Architecture

```
 Browser (patient)                                Browser (provider)
 ┌─────────────────────────────┐                  ┌──────────────────────────┐
 │ /intake  voice call UI      │                  │ /dashboard  queue        │
 │  PCM16 mic ⇄ speaker        │                  │ /dashboard/[noteId] note │
 │  live transcript, VoiceOrb  │                  │ /dashboard/patient/[id]  │
 └──────┬──────────────┬───────┘                  └────────────┬─────────────┘
        │ WebSocket    │ fetch                                 │ fetch
        ▼              ▼                                       ▼
 Deepgram Voice   Next.js API routes (src/app/api/*) ──────────┘
 Agent (STT →     │ voice-token (JWT grant)   eligibility ──► Stedi 270/271
 gpt-4o-mini →    │ intake-session            history ──────► Moss semantic search
 Aura-2 TTS)      │ generate-note             research ─────► OpenAI
   │ function     │ calls/[id]                communities ──► OpenAI + Arctic Shift
   │ calls back   │ patients, notes/[id]      scan-label ───► OpenAI vision
   ▼              ▼
 client executes  Medplum FHIR store (src/lib/store.ts + medplum.ts)
 lookup_history / Patient · Encounter · DocumentReference · Composition ·
 check_coverage / RiskAssessment   (+ in-memory fallback when keyless)
 end_checkin
```

Every external service has a graceful fallback — the **full pipeline runs with zero API
keys** (demo transcript → note → dashboard), proven by `scripts/smoke.sh`.

---

## Sponsor integrations

| Sponsor | What it does | Where in code |
|---|---|---|
| **Medplum** | System of record. Every check-in becomes real FHIR: Patient, Encounter (in-progress → finished), DocumentReference (base64 transcript), Composition (SOAP + review-status extension, preliminary → final on approve), RiskAssessment. Returning-patient history is rebuilt from the live FHIR record. | `prelude-health/src/lib/medplum.ts`, `src/lib/store.ts`, `src/lib/fhir-history.ts` |
| **Deepgram** | Primary voice engine — Voice Agent WebSocket with nova-3-medical STT, gpt-4o-mini think stage, Aura-2 TTS. Client-side function calling (history, coverage, agent-initiated call end), barge-in, KeepAlive, JWT token grant. | `src/hooks/useVoiceAgent.ts`, `src/lib/agent-config.ts`, `src/lib/audio.ts`, `src/app/api/voice-token/route.ts` |
| **Moss** | Semantic retrieval over patient history. Index built non-blocking at intake start; agent queries it mid-sentence via `lookup_patient_history`; keyword fallback when keyless. | `src/lib/moss.ts`, `src/app/api/history/route.ts` |
| **Stedi** | Real-time eligibility (270/271) in test mode with verified mock payers (UHC, Cigna, Aetna, CMS). Keyless mode builds a per-plan **simulated 271** and parses it through the same parser, so the demo answer is structurally identical. | `src/lib/stedi.ts`, `src/app/api/eligibility/route.ts`, `src/data/insurance-plans.ts` |
| **OpenAI** | SOAP note generation, deep research panel, Reddit community matching, pill-label vision scan. | `src/app/api/generate-note/route.ts`, `api/research/`, `api/communities/`, `api/scan-label/` |
| **xAI (Grok Voice)** | Backup voice engine with an identical hook interface — swappable via `VOICE_PROVIDER=grok`. | `src/hooks/useGrokVoice.ts`, `src/app/api/realtime-token/route.ts` |

---

## Features

- **Urgency slider** — 30-sec demo / 1 / 3 / 5 min; drives agent pacing and reply length on
  both voice engines. The agent can also **end the call itself** (`end_checkin` function)
  after a recap and goodbye.
- **Voice-first skip-form path** — no form needed; the agent collects identity in conversation.
- **MyChart import** — 24-health-system connect modal; imported chart is personalized to the
  entered patient name, feeds the voice prompt (fenced as untrusted data) and the Moss index.
  `/records` shows the chart with a summary strip, category timeline + legend, and tabs
  (All / Timeline / Medications / Allergies / Labs / Visits).
- **Med Card** (`/medcard`) — medication card filled three ways: pill-bottle scanner
  (OpenAI vision), manual entry, or MyChart import.
- **Insurance carrier → plan picker** — 7 carriers with real plan names (UHC Choice Plus,
  Cigna LocalPlus, Aetna Open Choice PPO, BCBS BlueCard PPO, Kaiser HMO, Medicare, Medicaid);
  plan flows through voice eligibility calls and note generation; keyless fallback is
  payer-aware (different copay/deductible per plan).
- **Deep research panel** — patient explainer, provider considerations, red flags,
  care-level spectrum, care-options table with medical-fit badges and coverage-aware costs.
- **Reddit communities** — condition-matched subreddits with member counts (Arctic Shift)
  and a prominent warning block (peer support ≠ medical advice, privacy, 911/988).
- **Provider dashboard** — queue with risk levels, SOAP review + one-click approve,
  Past Visits for returning patients, per-patient chart page with timeline + calendar.
- **CoverageBot** — guided chip-based insurance cost check as a slide-over on landing,
  intake-done, and the note page.
- **Safety guardrails** — the agent never diagnoses or prescribes; emergency language
  (911/988) on the consent screen, in both voice prompts, and the landing footer.

**Honest notes on what's simulated:**
- The MyChart "connect" flow is a simulated SMART-on-FHIR UI — no live Epic sandbox call.
- Without `STEDI_API_KEY`, eligibility returns a synthetic per-plan 271 (labeled
  `source: "synthetic"`); with the key it hits Stedi test mode against mock payers.

---

## Running locally

```bash
cd prelude-health
npm install
cp .env.example .env   # fill in keys — every one is optional
npm run dev            # http://localhost:3000
bash scripts/smoke.sh  # keyless end-to-end pipeline test (dev server must be running)
```

Environment variables (names only — see `prelude-health/docs/SETUP_KEYS.md` for setup steps):

| Variable | Purpose |
|---|---|
| `DEEPGRAM_API_KEY` | Voice agent (primary engine) |
| `DEEPGRAM_ALLOW_RAW_KEY` | Break-glass: skip JWT grant, use raw key subprotocol |
| `MEDPLUM_BASE_URL` / `MEDPLUM_CLIENT_ID` / `MEDPLUM_CLIENT_SECRET` | FHIR store (client credentials) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Note generation, research, communities, pill scan |
| `STEDI_API_KEY` | Live eligibility (test mode); synthetic 271 without it |
| `MOSS_PROJECT_ID` / `MOSS_PROJECT_KEY` | Semantic history retrieval; keyword fallback without |
| `XAI_API_KEY` / `VOICE_PROVIDER` | Grok backup voice engine (`VOICE_PROVIDER=grok` forces it) |
| `BASE_URL` | Base URL override for scripts |

With **no keys at all** the app still works end to end (demo transcript, in-memory store,
keyword history, synthetic eligibility, demo note).

---

## Demo script (15 seconds to wow)

1. `/intake` → set the urgency slider to **30-sec demo** → start the call.
2. Ask one question: *"I have a rash on my arm — how much will this visit cost?"*
   Watch the transcript chart live, the agent pull your history mid-sentence, and answer
   with your plan's copay. The agent recaps and ends the call itself.
3. `/records` → import MyChart — the chart is personalized to the name you entered.
4. `/dashboard` → open the new note: SOAP draft, risk, coverage, research, care options.
   Click **Approve** — then show the same visit as FHIR resources at app.medplum.com.
