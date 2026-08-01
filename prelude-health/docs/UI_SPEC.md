# Prelude — UI Spec (design handoff)

Purpose: complete inventory of every page, region, component, and interactive element,
so a design language generated in Claude Design can be mapped 1:1 onto the app.
Colors, typography, and visual styling are intentionally OMITTED — Claude Design owns
those. This spec defines structure, content, states, and behavior only.
Lane 4 owns: `src/app/page.tsx` (landing), `src/app/intake/page.tsx` (UI only),
`src/app/dashboard/**`. API contracts and hooks are frozen — design must fit this
structure, not change it.

Demo-camera priority (what must look great at 1080p, in order):
1. Intake call screen: **live transcript** + **coverage card** (the two hero moments)
2. Dashboard queue: risk badges readable instantly
3. Note review page: SOAP note + care-level + coverage cards, satisfying Approve
4. Landing page: 5 seconds of cold-open

Implementation notes for the design language:
- All visual values route through design tokens (`@theme` in `globals.css`) and shared
  primitives (`src/components/primitives.tsx`: Nav, Btn, SectionCard, StatusChip,
  RiskBadge, BulletList, MicroLabel). The new design lands there, not in pages.
- Semantic intents that need distinct visual treatments: brand, danger/urgent,
  warning/caution, success/positive, informational/draft, neutral/muted — plus one
  extra distinct accent for the SOAP "Assessment" block.
- Existing animation hooks: framer-motion entrances; CSS keyframes for the voice
  visualizer (idle bars / active speech bars), a "breathe" pulse (connecting state),
  and a slow background drift for the landing hero.
- Motion rules: entrances < 400ms; no motion on 5s data refreshes.
- Accessibility: WCAG AA contrast at 1080p video scale, visible focus states; PLANNED
  stretch — high-contrast/large-text toggle on the intake page.

---

## 1. Landing page `/`

Purpose: 5-second cold open for the video + route into the two flows.

Regions, top to bottom:
1. **Top nav** (shared shell): logo wordmark "Prelude" (left), event tagline text
   (right, hides on mobile).
2. **Hero**: small kicker label (uppercase) → H1 two-line headline ("The visit starts
   before the doctor walks in.") → 1-paragraph subhead.
3. **Two role cards** (2-col grid, stack on mobile), each a full-card link:
   - "I'm a patient" → `/intake` — icon tile, title, one-liner, arrow CTA text that
     nudges right on hover.
   - "I'm a provider" → `/dashboard` — same anatomy.
   Hover: border emphasis + shadow lift.
4. **"Powered by" strip**: 4 sponsor names (Medplum · Deepgram · Stedi · Moss) with
   one-word descriptors. PLANNED upgrade: a "How it works" strip — 4 steps
   (Talk → Charted to FHIR → Costed → Reviewed), one sponsor per step.
5. **Footer disclaimer**: "not a clinician / synthetic data" microcopy. Emergency
   911/988 language MUST remain somewhere on this page (compliance rule).

Interactive elements: 2 card links only. No buttons, no forms.

---

## 2. Intake page `/intake` — 4-step wizard

One centered column (max-w-lg), card per step, animated step transitions
(fade+slide via AnimatePresence). Persistent top nav + **step progress bar**
(4 dots/circles with connector lines: Form → Consent → Check-in → Done;
done = check, current = ringed/emphasized, future = muted).

### Step 1 — Form
- Card with header block (title + subhead).
- **Warning callout**: "Not a doctor… 911/988" (copy must remain).
- Inputs: text field "Your name" (required, placeholder), select "Appointment type"
  (5 options), select "Age range" (optional, 6 options).
- Primary button "Continue →" (disabled until name non-empty).

### Step 2 — Consent
- Card with info panel: 4 labeled bullet rows (What this is / What this is not /
  Your responses / Emergency 911-988).
- **Checkbox** + consent sentence (required).
- Button row: secondary "Back" + primary "Start Voice Check-in"
  (disabled until checked; loading label "Starting…").

### Step 3 — Check-in (THE hero screen)
Header swaps title by state: "Connecting…" / "Voice Check-in Active" /
"Check-in Complete" / "Demo Mode". Sub-line shows active voice engine
("Deepgram Voice Agent" or "Grok Voice (fallback)").

Voice state machine driving visuals: `idle → connecting → active ⇄ agent_speaking → ended | error`.

Components in order:
1. **Error banner** (conditional) — hook error string.
2. **Voice visualizer panel** (large rounded panel, centered) — the most brandable
   custom element. Four states:
   - connecting: breathing/pulsing circle + "allow microphone access…"
   - active (listening): 7 vertical animated bars + "Listening — speak when ready"
   - agent_speaking: bars switch to a distinct emphasized treatment + "Prelude is speaking…"
   - ended: check-circle + "Charting your visit…"
3. **Live coverage card** (conditional — appears mid-call when the agent runs the
   eligibility check). Data: source label ("Stedi test mode" / "synthetic data"),
   payer name + plan status, copay OR est. cost range, deductible remaining.
   PLANNED: slide-in entrance animation; this is hero moment #2.
4. **Live transcript panel** (conditional, scrollable, max-height): label
   "Live transcript · charting as you speak", rows of utterances — speaker tag
   ("Prelude" vs "You", visually distinct) + text. PLANNED: auto-scroll to newest +
   a subtle "charting to FHIR" activity indicator while call is active.
5. **Action button** (state-dependent):
   - during call: soft-destructive "End Check-in" (loading: "Charting to Medplum…")
   - after ended/error: primary "Generate Visit Note →"
6. **Demo mode variant** (no keys): transcript preview panel (4-line clamp) +
   primary button "Use Demo Transcript + Chart Visit".

### Step 4 — Complete
- Celebration card: spring-animated check badge, "You're checked in", explainer.
- Primary link-button "View the provider's draft note →" (conditional on noteId).
- Text link "Provider dashboard →".

---

## 3. Provider dashboard `/dashboard` — queue

Full-width page (max-w-6xl). Auto-refreshes every 5s (design must tolerate rows
appearing/reordering without jank).

Regions:
1. **Top nav** (provider variant): logo, "Live" indicator (pulsing dot + label),
   avatar circle + provider name ("Dr. Chen").
2. **Page header row**: H1 "Patient Intake Queue" + safety subcopy; right side primary
   button "**+ New Intake**" → `/intake`.
3. **3 stat cards** (grid): Total Patients / Pending Review / High Risk — label,
   big number, icon tile. The latter two carry warning and danger intent respectively.
4. **Urgent banner** (conditional, danger intent, animated in): "N patient(s) flagged
   for urgent provider review" with pulsing dot.
5. **Patient table** (card):
   - Column headers (desktop): Patient / Appointment / Status / Risk / Action / [delete].
   - Row: name (+ risk dot if high) + date, appointment type,
     **status chip** (5 variants: Urgent / AI Draft / Reviewed / Processing… / Pending),
     **risk badge** (high / medium / low / none / "—" — 4 escalating intents),
     "View Note →" link, hover-revealed **delete icon button** (with confirm dialog).
   - High-risk rows get a faint danger-tint row wash.
   - Rows animate in with stagger. Mobile: rows collapse into stacked cards.
   - **Empty state**: folder icon, "No patients yet.", "Start an intake →" link.
   - **Loading state**: spinner + "Loading patients…".

Known gap (flagged to Lane 2): delete button calls `DELETE /api/patients/[id]` which
doesn't exist yet — design should still include the control.

---

## 4. Note review page `/dashboard/[noteId]`

Single centered column (max-w-4xl), stacked cards, one entrance animation on load.
Page states: loading (spinner + "Loading note…"), not-found ("Note not found." +
back link), loaded. Data contract is the flat `Note` type in `src/types/index.ts` —
field names frozen.

Regions in render order:
1. **Nav**: "Prelude" wordmark → `/`, "‹ Dashboard" back link.
2. **Note header card** — background tint tracks risk level (high = danger tint /
   medium = warning tint / else neutral). Contains:
   - **Risk override**: 4 pill toggle buttons (none/low/medium/high), active pill
     emphasized + ringed, all disabled while saving (PATCHes immediately).
   - **Status badge**: "AI Draft" (informational) / "✓ Provider Reviewed" (success) /
     "Urgent Review" (danger).
   - Title "Intake Note" + meta ("Generated {date}", "· Reviewed {date}" with success
     emphasis).
   - Buttons: secondary "Edit Note"/"Cancel" toggle, primary "**✓ Approve Note**"
     ("✓ Re-approve" if already reviewed; saving = disabled + mini spinner +
     "Saving…"; no confirm dialog). PLANNED: satisfying approve moment.
3. **AI disclaimer banner** (caution intent, always shown): "AI-generated draft —
   review before clinical use."
4. **Risk Flags card** (caution intent, currently always rendered): bullet list of
   flags or empty text.
5. **Patient Summary card**: `ai_summary` paragraph + "CHIEF CONCERN" micro-label block.
6. **Symptoms & Goals** 2-col grid: two bullet-list cards (visually distinct dot accents).
7. **Care level + Coverage** 2-col grid (each card conditional):
   - **Suggested Care Level**: pill badge per level — 5 escalating levels (self care /
     telehealth / primary care / urgent care / emergency room) each needing a distinct
     escalating treatment + confidence %, reasoning paragraph, "ESCALATE IF"
     danger-accent bullet list.
   - **Coverage & Cost**: source micro-pill ("Stedi eligibility" / "Synthetic"),
     "{payer} — {plan_status}" emphasized, 3-col stat grid (Copay / Deductible left /
     Est. visit range), `spoken_summary` footer.
8. **SOAP Note Draft card** ("AI generated · provider review required" badge):
   - View mode: 4 left-bordered blocks — Subjective / Objective / Assessment / Plan,
     each with an uppercase micro-label and its own distinct accent (4 distinguishable
     treatments).
   - Edit mode: 20-row monospace textarea (seeded from provider note or generated
     plaintext), saved via header Approve.
9. **Suggested Provider Questions**: numbered list (emphasized numerals).
10. **Follow-Up Actions**: bullet list.
11. **Full Transcript card**: "Show transcript"/"Hide" text-button; lazy-fetches
    `GET /api/calls/{call_id}` (currently NO loading indicator — design should add
    one); preformatted monospace block, max-height scroll; "Transcript not
    available." fallback.

Recurring primitives on this page: `SectionCard` (title + optional badge slot +
children), `BulletList` (accent dot + text + italic empty string), micro-labels
(small bold uppercase wide-tracked).

---

## 5. Stedi coverage bot — "Ask about coverage" (NEW)

Purpose: let anyone check insurance coverage/cost WITHOUT doing a voice call — a
guided, chat-style widget powered by the existing Stedi eligibility check. Grounded
UI, not freeform chat: every exchange is chips/inputs → one API call → a result card.

Placement: floating **launcher button** (docked corner, above the fold on mobile) on
the landing page, the intake "Done" step, and the note review page. Opens a
**slide-over panel** (full-screen sheet on mobile). Closes via ✕ or scrim tap.

Panel anatomy, top to bottom:
1. **Header**: bot identity ("Coverage Assistant"), "Powered by Stedi" attribution,
   a mode tag ("test mode" / "synthetic data"), close button.
2. **Message thread** (scrollable): bot bubbles + user bubbles + inline cards.
3. **Composer row**: context-dependent — chip rows for guided steps, a text input
   only where free entry is needed (member ID).

Guided conversation flow (each step is a bot bubble + a chip row):
1. Greeting bubble + one-line disclaimer microcopy (estimates, not a guarantee of
   coverage — must remain).
2. "Who's your insurer?" → **payer chips**: UnitedHealthcare / Cigna / Aetna /
   Medicare (from the mock-payer set).
3. "Member ID?" → text input pre-filled with the payer's demo member ID +
   "use demo ID" chip.
4. "What kind of visit?" → **care-level chips**: Telehealth / Primary care /
   Urgent care / Emergency room.
5. **Checking state**: typing/working indicator bubble ("Checking with {payer}…").
6. **Result**: inline **coverage card** (REUSE the coverage card component: payer +
   plan status, copay OR est. cost range, deductible remaining, source micro-pill) +
   the `spoken_summary` sentence as a bot bubble.
7. **Follow-up chips**: "Check another visit type" (loops to step 4, keeps payer),
   "Different insurer" (loops to step 2), "Start voice check-in →" (deep-links
   `/intake` — the conversion moment).

States: closed (launcher only), open-idle, awaiting-input (chips highlighted),
checking (typing indicator), result, error/fallback (bot bubble noting synthetic
estimate was used instead — never a dead end). Thread persists while the panel
stays open; reopening may reset.

Data: existing `POST /api/eligibility` contract only ({payerKey, memberId,
careLevel} → CoverageSummary). No new API needed.

---

## 6. Patient chart — timeline / calendar (NEW)

Purpose: the provider-side "this is a real FHIR record" moment — one patient's full
history as a browsable chart. Suggested route: `/dashboard/patient/[patientId]`,
entered by clicking the patient's name in the queue and from a link in the note
review header.

Regions, top to bottom:
1. **Nav**: provider nav shell + "‹ Queue" back link.
2. **Patient header card**: identity block (name, age range, appointment type),
   summary chips (current risk badge, latest note status, visit count, last-seen
   date), actions: primary "Open latest note →", secondary "New intake".
3. **View toggle**: segmented control — **Timeline | Calendar** (Timeline default).
4. **Filter chip row** (multi-select, horizontally scrollable on mobile): All /
   Visits / Notes / Medications / Allergies / Coverage checks. Active-filter state
   must be obvious; counts per type optional.

### Timeline view (default — the demo hero here)
- Vertical spine, **newest first**, entries grouped under month labels; a "Today"
  marker at the top when applicable.
- **Timeline entry** anatomy: date node on the spine + event card containing:
  event-type icon tile, title (e.g. "Sick visit — itchy rash"), one-line summary,
  contextual badges (risk level, note status), and a trailing action when linkable
  ("Open note →" for notes/visits).
- Event types needing distinct-but-related treatments: **Visit/Encounter**,
  **AI note**, **Medication**, **Allergy** (persistent facts — consider pinning
  allergies above the timeline as an always-visible strip), **Coverage check**,
  **Risk flag**.
- Entry cards animate in with stagger on load/filter change.

### Calendar view
- Month grid with weekday header row; prev / next month + "jump to today" controls;
  month-year label.
- **Day cell**: date numeral, up to 3 event dots (dot per event type) + "+N"
  overflow; today emphasized; out-of-month days muted; days with events are
  clickable/focusable.
- Selecting a day opens a **day detail list** (side panel on desktop, sheet or
  below-grid list on mobile) reusing the SAME event cards as the timeline.
- Keyboard: arrow-key day navigation is the accessibility bar.

Page states: loading skeleton (header + 3 ghost entries), empty ("No history yet
for this patient" + "Start an intake →"), single-event, dense (10+ events — spine
must stay readable).

Data note: events derive from the patient's FHIR record (Encounters, Compositions/
notes, MedicationRequest, AllergyIntolerance — lane-2 already builds these for Moss
history). OPEN ASK to Lane 2: a `GET /api/patients/[id]/events` endpoint; until it
exists the page can assemble from `/api/patients` + `/api/notes/[id]` with the demo
history entries.

---

## 7. Shared component inventory (design-system surface)

Primitives the design language must define:
- **Buttons**: primary (brand), secondary (surface+border), soft-destructive,
  disabled, loading-label variants; full-width (intake) and inline (dashboard) sizes.
- **Status chip** (5 variants) and **risk badge** (4 escalating variants + empty).
- **Card**: default, header-block, and intent-tinted callout variants (warning, info,
  danger/urgent, brand-tint coverage).
- **Stat card** (label + number + icon tile).
- **Top nav** shell: patient variant vs provider variant (Live dot, avatar).
- **Step progress** indicator (4 steps).
- **Voice visualizer** (4 states) — the most brandable custom element.
- **Transcript row** (agent vs patient speaker treatment).
- **Form controls**: text input, select, checkbox — focus treatment.
- **Empty/loading/error** patterns (spinner, folder empty state, error banner).
- Icons: currently inline SVG (users, clock, alert-triangle, check, plus, trash) +
  a few emoji tiles.

New primitives required by sections 5–6:
- **Chat bubble** pair (bot vs user) + **typing indicator**.
- **Chip** (quick-reply / filter): default, selected, multi-select states.
- **Floating launcher button** + **slide-over panel / mobile sheet** (with scrim).
- **Segmented control** (2 options).
- **Timeline spine + date node + event card** (6 event-type treatments).
- **Calendar month grid + day cell** (event dots, today, muted, overflow count)
  + **day detail list**.
- **Pinned facts strip** (allergies).
- **Loading skeleton** pattern.
