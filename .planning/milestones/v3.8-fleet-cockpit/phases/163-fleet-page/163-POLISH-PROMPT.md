# P163 polish + codex-live pane — orchestrator browser findings attached

Files: super-gsd/tools/fleet-cockpit/public/{index.html,app.js},
super-gsd/tools/fleet-cockpit/server.cjs (+run-self-test.cjs for new cases).
Edits-first; no spawns beyond in-process listen; do NOT commit. Hard
constraints unchanged: no framework/build/remote assets, ASCII, read-only.

## Part 1 — visual identity (operator rejected the current look; verified in a
real browser against the handover section 8 brief)

Observed defects, fix all:
1. No house identity: page reads as unstyled white cards. Apply the SGSD cool
   theme PROPERLY: paper #f6f7f8 page ground, #ffffff panels with #d8dee1
   hairlines, teal #147a74 as the visible PRIMARY (header accent, selected-lane
   marker, links, section eyebrows), ink #202629 text, muted #647076
   secondary. The header should carry identity (eyebrow SGSD CONTROL SURFACE +
   Fleet cockpit title + teal accent), not look like a default toolbar.
2. Typography: Segoe UI stack for lane names, headlines, titles; Cascadia Mono
   ONLY for technical values (shas, timestamps, counts, raw JSON). Currently
   mono is everywhere.
3. The left rail IS the product: full-height fixed-width rail (not a floating
   card), larger status dots, name prominent, headline muted beneath, age
   right-aligned tabular; selected lane clearly marked with a teal bar.
4. NOW tile: render a readable action line (tool name + short arg summary),
   never raw JSON.
5. OBJECTIVE tile: curated fields only (milestone, phase+name, status,
   confidence); the long milestone_status paragraph collapses behind a
   details/summary. Conflict box keeps both values + confidence, styled violet
   #6a5b8f accent per the palette.
6. resume_command: prominent copyable one-liner tile (mono, copy affordance via
   selection hint text; still no button that executes anything).

## Part 2 — live Codex pane (operator request)

7. New read-only route GET /api/lane/:name/codex-live: tails the lane's
   .planning/metrics/codex-executor-live.txt (fallback codex-live-output.txt),
   last 16KB, plain text, plus mtime age; absent file => {present:false}.
8. Right rail becomes two stacked panes: CODEX LIVE (auto-refresh 3s while the
   lane is selected, autoscroll to tail, mono, shows file age; "no live codex
   output" when absent) above RAW SNAPSHOT (collapsed by default behind
   details). This is the watch-what-codex-is-doing view.
9. Guard cases: codex-live route contract (present/absent/tail-bounded);
   structural style assertions updated (Segoe-for-names, teal-primary tokens
   actually used in rules, not merely defined).

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 150 words.
