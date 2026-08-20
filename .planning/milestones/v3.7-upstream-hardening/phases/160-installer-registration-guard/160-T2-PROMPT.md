# P160-T2 — bundled-overlay provider-lock refresh + drift tripwire (edits-first)

You are the implementer for ONE task. Fresh context. No spawns; do NOT stop on
spawnSync EPERM; static verification only; the orchestrator runs the suite. Do
NOT commit.

Task P160-T2 in `160-01-PLAN-LOCKED.md` (same dir) is your VERBATIM contract.
Files: `super-gsd/CLAUDE-OVERLAY.md` and the guard test.

Essentials:
- Remove/replace every known-stale marker in the bundled overlay: ByteRover-era
  memory routing (".brv/context-tree", brv-query/brv-curate), Agent haiku
  classifier dispatch, sonnet readiness routing — replaced by the current
  contracts (DLB-01 .planning/memory + sgsd-recall; Codex gpt-5.6-sol provider
  lock for delivery surfaces).
- Tripwire: a new test case (stale-marker scan) that FAILS when the bundled
  overlay contains any marker from a declared list; the list lives in the test
  as data, and the case also asserts the overlay still carries the load-bearing
  sections a fresh clone needs (memory wrappers, model routing, commit
  discipline).
- Do not touch the operator's live CLAUDE.md files anywhere; ONLY the bundled
  overlay ships.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
