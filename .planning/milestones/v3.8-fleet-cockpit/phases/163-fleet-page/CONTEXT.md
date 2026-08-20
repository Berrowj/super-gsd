---
phase: "163"
slug: fleet-page
milestone: v3.8-fleet-cockpit
status: PENDING
depends_on: ["162"]
source: handover sections 8, 9 step 2
---

# P163 Context — Fleet Page (handover step 2)

tools/fleet-cockpit/public/{index.html,app.js}. No framework, no build step, no
remote assets; must open from file:// as well as HTTP. House palette verbatim
(paper #f6f7f8, ink #202629, muted #647076, line #d8dee1, panel #ffffff, teal
#147a74 primary, blue #315f90, amber #b27622, green #4f7f45, red #aa4a43,
violet #6a5b8f); system font stacks inline (Segoe UI names, Cascadia Mono
technical values).

Layout: left rail IS the product (status dot, name, headline, age; sorted
attention/running/stale/idle then recency); centre = 12 section tiles for the
selected lane (now/objective/blockers/gates/tokens/staleness real tiles, rest
collapsed; resume_command copyable, never a button); right = raw snapshot
pre-block (Omnigent embed reserved for gated P164).

Behaviour: poll /api/fleet 5s; /api/lane/:name on selection only; cache_age
always visible; failed fetch keeps last render + banner, never blanks; deep
link #/lane/:name.

Acceptance = handover step-2 checklist verbatim, including: no-data visually
distinct from zero everywhere, projection_stale shows both values + confidence,
usable on a phone over LAN.

HARD STOP after this phase: the handover mandates stop-and-evaluate before
P164/P165; the loop exits at milestone-partial with the two gated phases
untouched until the operator says go.
