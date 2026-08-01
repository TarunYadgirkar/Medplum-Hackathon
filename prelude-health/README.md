# Prelude — the visit starts before the doctor walks in

**YC × Medplum Agentic Healthcare Hackathon · August 1, 2026**

Prelude is a voice-first pre-visit check-in. A patient talks to an AI agent for ~3 minutes;
the conversation is **charted into a real FHIR record as it happens**, the agent **pulls the
patient's history mid-sentence**, answers **"what will this cost me?" with a live insurance
eligibility check**, and the provider opens a **reviewed-and-ready draft SOAP note** before the
visit begins.

Built by rebuilding two of our prior hackathon projects
([carepath](https://github.com/TarunYadgirkar/carepath) — voice triage + cost navigation, and
[klarity-voicenote](https://github.com/TarunYadgirkar/klarity-voicenote-Hackathon) — voice intake → SOAP notes)
on the sponsor stack, from a fresh repo.

## How we used the sponsors

**Medplum — the system of record.** Every check-in becomes real FHIR: a `Patient`, an
`Encounter` (opened when the call starts, finished when it ends), a `DocumentReference`
holding the transcript, a `Composition` with SOAP sections for the AI draft note, and a
`RiskAssessment` for the safety screen. The provider dashboard reads its queue straight from
Medplum search. (`src/lib/medplum.ts`, `src/lib/store.ts`)

**Deepgram — the whole voice loop.** One Voice Agent WebSocket runs STT with
**nova-3-medical** (medical vocabulary), the reasoning LLM, and **Aura-2** TTS, with
barge-in. We register two client-side functions the agent calls mid-conversation:
`lookup_patient_history` and `check_insurance_coverage`. Browser auth uses short-lived JWTs
minted server-side via `/v1/auth/grant`. (`src/lib/agent-config.ts`, `src/hooks/useVoiceAgent.ts`)

**Stedi — real insurance answers.** When the patient asks about cost, the agent fires a
**test-mode eligibility check** (mock UHC/Cigna/Aetna/CMS payers, no PHI) and speaks the
copay/deductible back in plain language; the same coverage summary lands on the visit note.
(`src/lib/stedi.ts`)

**Moss — context at conversation speed.** The patient's history (prior visits, allergies,
meds) is indexed in Moss at check-in start; when the patient mentions something, the agent
semantically retrieves the relevant history in sub-10ms — fast enough to say *"I see you had a
similar rash last November"* without stalling. (`src/lib/moss.ts`)

## Run it

```bash
npm install
cp .env.example .env   # fill in what you have — every integration degrades gracefully
npm run dev
```

With **zero keys** the full pipeline still demos (demo transcript → note → dashboard, synthetic
pricing, keyword history search). Add keys to light up each sponsor:

| Env | Lights up |
|---|---|
| `MEDPLUM_CLIENT_ID/SECRET` | Real FHIR resources in your Medplum project |
| `DEEPGRAM_API_KEY` | Live voice agent (mic conversation) |
| `GEMINI_API_KEY` | Real note generation from your transcript |
| `STEDI_API_KEY` | Real test-mode eligibility checks |
| `MOSS_PROJECT_ID/KEY` | Semantic history retrieval |

## Architecture

```
Patient browser ──(PCM16 over WebSocket)── Deepgram Voice Agent
   │    ▲                                        │
   │    └── agent audio + live transcript        │ FunctionCallRequest
   │                                             ▼
   │                    /api/history ─── Moss (patient history index)
   │                    /api/eligibility ─ Stedi test mode (mock payers)
   │
   └── on end: /api/generate-note ── Gemini ──► SOAP + risk + care level
                                        │
                                        ▼
                        Medplum FHIR: Patient · Encounter · DocumentReference
                                      Composition (SOAP) · RiskAssessment
                                        │
                                        ▼
                        Provider dashboard (/dashboard): queue → review → approve
```

## Provenance

Fresh code written at the hackathon, reusing our own prior art where it made sense:
- UI flow + note-review dashboard adapted from our klarity-voicenote project (Retell/SQLite → Deepgram/Medplum).
- PCM audio utilities, emergency-keyword list, and synthetic pricing fallback from our carepath project (Grok Voice → Deepgram).

## Safety

Prelude never diagnoses, prescribes, or treats. Red-flag symptoms end the intake with a 911/988
instruction. All notes are drafts requiring licensed-provider review. Demo uses synthetic data only.
