# Hackathon-day build plan — 2 people × Claude Max 20x, ~3.5 hours

Scope is NOT reduced: the codebase already builds and the keyless pipeline passes
`scripts/smoke.sh`. Tomorrow is: make every integration LIVE, deploy, polish, record.
The plan optimizes wall-clock time via parallel Claude Code sessions with clear file
ownership (lanes are defined in CLAUDE.md — sessions must stay in their lane).

## Session topology (the answer to "how many parallel sessions")

**4 concurrent Claude Code sessions (2 per person) + 1 short-lived polish session later.**
More than 4 on a repo this size loses more time to merge conflicts and duplicated context
than it gains — parallelism should come from *subagents inside* each session, not from
more top-level sessions. Each session runs **fable as the orchestrator**, spawning
**opus subagents for the hard debugging** (voice WebSocket, FHIR auth) and **sonnet
subagents for mechanical fan-out** (UI tweaks, copy, error states, docs).

Set each session up in its own git worktree so they never touch the same checkout:

```bash
git clone <repo> prelude && cd prelude
git worktree add ../prelude-lane1 -b lane-1   # Voice
git worktree add ../prelude-lane2 -b lane-2   # Data/FHIR
git worktree add ../prelude-lane3 -b lane-3   # Integrations
git worktree add ../prelude-lane4 -b lane-4   # UI
# one Claude Code session per directory; merge to main early and often
```

**Full copy-paste kickoff prompts for all four sessions are in `docs/LANE_PROMPTS.md`** —
open a session per worktree, paste its prompt, go.

Rules for every session (also in CLAUDE.md, which Claude Code auto-reads):
read `PROGRESS.md` first, append to it on every finish/blocker; `npm run build` +
`bash scripts/smoke.sh` must pass before merging; merge to main at least every 30 min;
main stays green always.

| Session | Person | Owns | Kickoff prompt |
|---|---|---|---|
| **Lane 1 — Voice** | P1 (attended — mic testing needs a human) | Deepgram/Grok hooks, agent config, voice API routes | docs/LANE_PROMPTS.md → LANE 1 |
| **Lane 2 — Data/FHIR** | P1 (background) | Medplum client + store, data API routes, demo seeding | docs/LANE_PROMPTS.md → LANE 2 |
| **Lane 3 — Integrations** | P2 (background) | Stedi + Moss libs and routes | docs/LANE_PROMPTS.md → LANE 3 |
| **Lane 4 — UI** | P2 (background) | Landing, intake screen visuals, dashboard | docs/LANE_PROMPTS.md → LANE 4 |

## Timeline (T0 = hands on keyboard, target T0 ≈ 10:15am after opening remarks)

**T+0:00 → 0:20 — Setup burst (humans, no Claude yet)**
P1: push repo to GitHub → import to Vercel → create Medplum project + ClientApplication → Gemini key.
P2: Deepgram key → Stedi test key → Moss project → paste ALL keys into local `.env` files AND
Vercel env vars (per docs/SETUP_KEYS.md). Both: `npm i && npm run build && bash scripts/smoke.sh`
in the main checkout, create the 4 worktrees, launch the 4 sessions with the seed prompts above.

**T+0:20 → 1:20 — Parallel lanes (the meat)**
Lane 1 is the critical path — P1 stays with it (speak when it needs mic input; it cannot hear).
Lanes 2–4 run largely autonomously; check them every ~15 min, answer questions, merge green work.
Definition of done per lane: Lane 1 = full voice conversation with both function calls live;
Lane 2 = FHIR resources visible in app.medplum.com + 3 seeded demo patients; Lane 3 = both endpoints
returning real sources; Lane 4 = demo path looks video-ready.

**T+1:20 → 2:00 — Integration + deploy**
Merge all lanes to main. One person runs the FULL live flow locally (voice → note → Medplum
console → dashboard). Deploy main to Vercel (keys already set), retest ON THE DEPLOYED URL —
mic over HTTPS, function calls, dashboard. Fix-forward on main; kill Lanes 2–4, keep Lane 1 for voice bugs.

**T+2:00 → 2:45 — Iterate (this is the buffer scope was preserved for)**
Rehearse the exact demo conversation 3×; make the agent's history-recall and cost moments hit
reliably (tune prompts in agent-config.ts). Nice-to-haves ONLY if green: FHIR-derived (not demo)
history docs for Moss; a /summary patient care-card page; voicevision-style "increase contrast"
voice command as an accessibility flourish.

**T+2:45 → 3:30 — Ship**
Record the demo video following docs/SUBMISSION.md's script (phone or QuickTime; one take is
fine, energy > polish). Upload to YouTube (Public), blast the link to every group chat
immediately (the form asks for VIEW COUNT). Fill the form (answers pre-drafted in
docs/SUBMISSION.md) and submit — target 4:30pm, hard stop 5:00pm.

## Claude Code operating tips for this repo

- Sessions auto-read `CLAUDE.md` — it contains lanes, hard rules, known risks, and fix hints.
- Tell Lane 1 explicitly when you're available to speak into the mic; it should batch its
  "please talk now" tests to respect your attention.
- Use plan mode for Lane 1's first move (WebSocket debugging benefits from a plan); the other
  lanes can go straight to execution.
- Have each session spawn subagents for anything parallelizable inside its lane
  (e.g. Lane 4: one sonnet subagent per page) instead of asking for more top-level sessions.
- If two sessions must touch the same file, do it sequentially via a PROGRESS.md handoff note.
- On any Deepgram/Stedi/Moss confusion: the sponsors are physically at the venue and it's a
  judged criterion to use them — office hours are at 3pm, but booths are open all day. Ask early.
