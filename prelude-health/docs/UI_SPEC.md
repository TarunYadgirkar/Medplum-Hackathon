# Prelude — UI Spec (design handoff)

Purpose: complete inventory of every page, region, component, and interactive element,
so a design language generated in Claude Design can be mapped 1:1 onto the app.
Lane 4 owns: `src/app/page.tsx` (landing), `src/app/intake/page.tsx` (UI only),
`src/app/dashboard/**`. API contracts and hooks are frozen — design must fit this
structure, not change it.

Demo-camera priority (what must look great at 1080p, in order):
1. Intake call screen: **live transcript** + **coverage card** (the two hero moments)
2. Dashboard queue: risk badges readable instantly
3. Note review page: SOAP note + care-level + coverage cards, satisfying Approve
4. Landing page: 5 seconds of cold-open

Current shared palette (to be replaced by the new design language). CSS custom
properties already exist in `globals.css` — the new design language should land as
new values for these tokens first:
- `--teal #00B894`, `--teal-dark #00897B`, `--teal-accent #00CEB8`, `--teal-light #E6FAF6`
- `--ink #0F172A`, `--muted #64748B`, `--border #E2E8F0`, `--surface #F8FAFC`
- Motion token `--ease-out-expo: cubic-bezier(0.16,1,0.3,1)`
- Semantic (Tailwind classes, not tokens yet): red (urgent/high risk), amber
  (medium/pending), emerald (low/reviewed/live), blue (AI draft), purple (SOAP Assessment)
- Cards: white, `rounded-2xl`/`rounded-3xl`, 1px border, subtle shadow
- Font: Geist Sans / Geist Mono (next/font), `ss01`/`cv01` features enabled on body.
- Animation: framer-motion for entrances; CSS keyframe utilities in globals.css:
  `.voice-bar` (idle bars, staggered), `.voice-bar-active` (speech bars, organic
  per-bar durations), `.animate-breathe` (connecting pulse), `.hero-orb` (landing
  background mesh drift, 14s).
- Note: many components hardcode the hex values inline instead of using the vars —
  part of the structure work is routing everything through tokens.

---

## 1. Landing page `/`

Purpose: 5-second cold open for the video + route into the two flows.

Regions, top to bottom:
1. **Top nav** (shared shell): logo wordmark "Prelude" (left), event tagline text (right, hides on mobile).
2. **Hero**: kicker label (uppercase, tracked-out, teal) → H1 two-line headline
   ("The visit starts before the doctor walks in.") → 1-paragraph subhead.
3. **Two role cards** (2-col grid, stack on mobile), each a full-card link:
   - "I'm a patient" → `/intake` — emoji icon tile, title, one-liner, arrow CTA text that nudges right on hover.
   - "I'm a provider" → `/dashboard` — same anatomy.
   Hover: border → brand color, shadow lift.
4. **"Powered by" strip**: 4 sponsor names (Medplum · Deepgram · Stedi · Moss) with one-word descriptors. PLANNED upgrade: a "How it works" strip — 4 steps (Talk → Charted to FHIR → Costed → Reviewed), one sponsor per step.
5. **Footer disclaimer**: "not a clinician / synthetic data" microcopy. Emergency 911/988 language MUST remain somewhere on this page (compliance rule).

Interactive elements: 2 card links only. No buttons, no forms.

---

## 2. Intake page `/intake` — 4-step wizard

One centered column (max-w-lg), card per step, animated step transitions
(fade+slide via AnimatePresence). Persistent top nav + **step progress bar**
(4 dots/circles with connector lines: Form → Consent → Check-in → Done;
done = check, current = ringed, future = muted).

### Step 1 — Form
- Card with gradient header (title + subhead).
- **Amber warning callout**: "Not a doctor… 911/988" (must remain).
- Inputs: text field "Your name" (required, placeholder), select "Appointment type"
  (5 options), select "Age range" (optional, 6 options).
- Primary button "Continue →" (disabled until name non-empty).

### Step 2 — Consent
- Card, blue-tinted info panel: 4 labeled bullet rows (What this is / What this is not /
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
1. **Error banner** (red, conditional) — hook error string.
2. **Voice visualizer panel** (large rounded panel, centered):
   - connecting: pulsing circle + "allow microphone access…"
   - active (listening): 7 vertical bars, brand color, + "Listening — speak when ready"
   - agent_speaking: bars switch to accent color + pulse, "Prelude is speaking…"
   - ended: check-circle + "Charting your visit…"
3. **Live coverage card** (conditional — appears mid-call when the agent runs the
   eligibility check). Data: source label ("Stedi test mode" / "synthetic data"),
   payer name + plan status, copay OR est. cost range, deductible remaining.
   PLANNED: slide-in entrance animation; this is hero moment #2.
4. **Live transcript panel** (conditional, scrollable, max-height): label
   "Live transcript · charting as you speak", rows of utterances — speaker tag
   ("Prelude" teal / "You" ink) + text. PLANNED: auto-scroll to newest + a subtle
   "charting to FHIR" activity indicator while call is active.
5. **Action button** (state-dependent):
   - during call: destructive-soft "End Check-in" (red tint; loading: "Charting to Medplum…")
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
1. **Top nav** (provider variant): logo, "Live" indicator (pulsing green dot + label),
   avatar circle + provider name ("Dr. Chen").
2. **Page header row**: H1 "Patient Intake Queue" + safety subcopy; right side primary
   button "**+ New Intake**" → `/intake`.
3. **3 stat cards** (grid): Total Patients / Pending Review (amber) / High Risk (red) —
   label, big number, icon tile.
4. **Urgent banner** (conditional, red, animated in): "N patient(s) flagged for urgent
   provider review" with pulsing dot.
5. **Patient table** (card):
   - Column headers (desktop): Patient / Appointment / Status / Risk / Action / [delete].
   - Row: name (+ red risk dot if high) + date, appointment type,
     **status chip** (Urgent-red / AI Draft-blue / Reviewed-emerald / Processing… / Pending),
     **risk badge** (high-red / medium-amber / low-emerald / none-slate / "—"),
     "View Note →" link, hover-revealed **delete icon button** (with confirm dialog).
   - High-risk rows get a faint red row wash.
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
2. **Note header card** — background tint tracks risk level (high red / medium amber /
   else neutral). Contains:
   - **Risk override**: 4 pill toggle buttons (none/low/medium/high), active pill
     tinted + ringed, all disabled while saving (PATCHes immediately).
   - **Status badge**: "AI Draft" (blue) / "✓ Provider Reviewed" (emerald) /
     "Urgent Review" (red).
   - Title "Intake Note" + meta ("Generated {date}", "· Reviewed {date}" in emerald).
   - Buttons: secondary "Edit Note"/"Cancel" toggle, primary "**✓ Approve Note**"
     ("✓ Re-approve" if already reviewed; saving = disabled + mini spinner +
     "Saving…"; no confirm dialog). PLANNED: satisfying approve moment.
3. **AI disclaimer banner** (amber, always shown): "AI-generated draft — review before
   clinical use."
4. **Risk Flags card** (amber, currently always rendered): bullet list of flags or
   empty text.
5. **Patient Summary card**: `ai_summary` paragraph + "CHIEF CONCERN" micro-label block.
6. **Symptoms & Goals** 2-col grid: two bullet-list cards (teal dots / accent dots).
7. **Care level + Coverage** 2-col grid (each card conditional):
   - **Suggested Care Level**: pill badge per level (self care emerald / telehealth teal
     / primary care blue / urgent care amber / emergency room red) + confidence %,
     reasoning paragraph, "ESCALATE IF" red-dot bullet list.
   - **Coverage & Cost**: source micro-pill ("Stedi eligibility" / "Synthetic"),
     "{payer} — {plan_status}" bold, 3-col stat grid (Copay / Deductible left /
     Est. visit range), `spoken_summary` footer.
8. **SOAP Note Draft card** ("AI generated · provider review required" badge):
   - View mode: 4 left-bordered blocks — S teal, O blue, A purple, P amber, each with
     uppercase micro-label.
   - Edit mode: 20-row monospace textarea (seeded from provider note or generated
     plaintext), saved via header Approve.
9. **Suggested Provider Questions**: numbered list (teal numerals).
10. **Follow-Up Actions**: bullet list.
11. **Full Transcript card**: "Show transcript"/"Hide" text-button; lazy-fetches
    `GET /api/calls/{call_id}` (currently NO loading indicator — design should add
    one); `<pre>` mono block, max-height scroll; "Transcript not available." fallback.

Recurring primitives on this page: `SectionCard` (title + optional badge slot +
children), `BulletList` (colored dot + text + italic empty string), micro-labels
(10-12px bold uppercase widest-tracking).

---

## 5. Shared component inventory (design-system surface)

Primitives the design language must define (all exist today as inline Tailwind):
- **Buttons**: primary (brand), secondary (surface+border), destructive-soft (red tint),
  disabled, loading-label variants; full-width (intake) and inline (dashboard) sizes.
- **Status chip** (5 variants) and **risk badge** (4 variants + empty).
- **Card**: default, gradient-header, tinted callout (amber warning, blue info,
  red error/urgent, brand-tint coverage).
- **Stat card** (label + number + icon tile).
- **Top nav** shell: patient variant vs provider variant (Live dot, avatar).
- **Step progress** indicator (4 steps).
- **Voice visualizer** (4 states) — the most brandable custom element.
- **Transcript row** (agent vs patient speaker treatment).
- **Form controls**: text input, select, checkbox — focus ring treatment.
- **Empty/loading/error** patterns (spinner, folder empty state, red banner).
- Icons: currently inline SVG (users, clock, alert-triangle, check, plus, trash) + a few emoji.

Accessibility notes for the design language: WCAG AA contrast at 1080p video scale,
visible focus states, and a PLANNED high-contrast/large-text toggle on the intake page
(stretch). Motion: all entrances < 400ms, no motion on data refresh.
