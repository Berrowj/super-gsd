# P163-T1 — the fleet page (edits-first)

You are the implementer for ONE task. Fresh context. No nested spawns; do NOT
stop on spawnSync EPERM; verify statically + in-process. Do NOT commit.

Task P163-T1 in `163-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract. Design: in-repo HANDOVER.md section 8.

Files: super-gsd/tools/fleet-cockpit/public/index.html + public/app.js.

Essentials (violations, not suggestions): no framework, no build step, no
remote assets, ASCII source; opens from file:// AND over HTTP; house palette
verbatim (paper #f6f7f8 ink #202629 muted #647076 line #d8dee1 panel #ffffff
teal #147a74 blue #315f90 amber #b27622 green #4f7f45 red #aa4a43 violet
#6a5b8f); system font stacks inline (Segoe UI names, Cascadia Mono technical).

Layout: left rail (dot/name/headline/age; sorted attention>running>stale>idle
then recency — exported compareLaneRows INVOKED by the production rail
renderer); centre tiles now/objective/blockers/gates/tokens/staleness, rest
collapsed; resume_command copyable text only (no button/link/form/exec); right
rail raw snapshot in a pre.

Behaviour: poll /api/fleet 5s; /api/lane/:name on selection; cache_age always
visible; failed fetch keeps last render + banner; deep link #/lane/:name.
Rendering truth: No-data rendering distinct from 0 with DISTINCT classes;
conflict branch renders BOTH effective and STATE milestone/phase values plus
source and confidence. Export the pure functions (compareLaneRows, formatters,
renderers) for T2's node tests (guard exports for non-browser require).

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
