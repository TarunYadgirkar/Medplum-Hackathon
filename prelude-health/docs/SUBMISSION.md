# Submission form drafts (due 5:00 PM)

Form: https://docs.google.com/forms/d/e/1FAIpQLSdqhh466ADsUm-44CSkjC0xkOcm431wkJx_n_r7W4qT8FCRgA/viewform

## Hack name and tagline
**Prelude — the visit starts before the doctor walks in.**

## Problem statement
Doctors spend the first ten minutes of every visit collecting information a patient could have
given in advance — and patients walk in blind about what the visit will cost. Intake forms go
unread, front-desk phone trees waste staff time, and nothing lands in the chart in a structured
way. Prelude replaces the clipboard with a 3-minute voice conversation: the patient just talks,
their words are charted into the clinic's FHIR record as structured SOAP documentation in real
time, the agent references their actual medical history mid-conversation, answers "will my
insurance cover this and what's my copay?" with a live eligibility check, and the provider
starts the visit with a risk-flagged, reviewed-and-ready draft note.

## Describe how you used Medplum, Stedi, Deepgram, Moss.dev
**Medplum** is our system of record — every check-in creates real FHIR resources: a Patient, an
Encounter opened when the call starts and finished when it ends, a DocumentReference holding the
transcript, a Composition with SOAP sections for the AI draft note, and a RiskAssessment for the
safety screen. The provider dashboard reads its queue directly from Medplum search.

**Deepgram** runs the entire voice loop over one Voice Agent WebSocket: nova-3-medical for
medical-vocabulary STT, the agent LLM, and Aura-2 TTS with barge-in. We registered two
client-side functions the agent invokes mid-conversation — lookup_patient_history and
check_insurance_coverage — and mint short-lived JWTs server-side (/v1/auth/grant) so the API key
never reaches the browser.

**Stedi** answers the cost question for real: when the patient asks what the visit will cost,
the agent fires a test-mode eligibility check against mock payers (UHC/Cigna/Aetna/CMS), parses
plan status / copay / deductible from the 271 response, and speaks it back in plain language.
The coverage summary is also attached to the visit note.

**Moss** gives the agent memory at conversation speed: the patient's history (prior visits,
allergies, medications) is indexed at check-in start, and the agent's history function retrieves
semantically relevant entries in sub-10ms — fast enough for the agent to say "I see you had a
similar rash last November" without stalling the conversation.

## Code repo link
https://github.com/TarunYadgirkar/prelude-health  ← create this repo and push

## Demo video script (record by ~4:00 PM, upload to YouTube, blast link for views)
1. (0:00) Cold open on the landing page. "Every doctor visit starts with ten wasted minutes
   and a cost surprise. This is Prelude."
2. (0:15) Patient check-in: talk about a rash. Show the LIVE transcript charting as you speak.
3. (0:40) The wow moments, in order:
   - Agent recalls prior history ("similar rash last November") → mention Moss retrieval.
   - Ask "what will this cost me?" → live Stedi coverage card appears while the agent speaks
     the copay.
4. (1:20) End call → show the Medplum app (app.medplum.com): the Patient, Encounter,
   Composition, RiskAssessment that were just created. "This isn't a demo database — it's a
   production FHIR record."
5. (1:40) Provider dashboard: queue with risk badges → open the draft SOAP note → approve it.
6. (2:00) Close: "Rebuilt from our past hackathon winners on the Medplum + Deepgram + Stedi +
   Moss stack, in one day. The visit starts before the doctor walks in."

## Checklist before submitting
- [ ] Push repo to GitHub (fresh repo, today's commits)
- [ ] Deploy to Vercel (set env vars!) — or demo locally
- [ ] Record + upload YouTube video, set to Public
- [ ] Share video link in group chats (form asks for VIEW COUNT)
- [ ] One submission per team, by 5:00 PM
