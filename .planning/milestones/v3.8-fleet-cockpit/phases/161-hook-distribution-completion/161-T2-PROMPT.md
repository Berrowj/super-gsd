# P161-T2 — surface-aware hook manifest + overlay completeness (edits-first)

You are the implementer for ONE task. Fresh context. No spawns; do NOT stop on
spawnSync EPERM; static verification only; the orchestrator runs install-driven
suites. Do NOT commit.

Task P161-T2 in `161-01-PLAN-LOCKED.md` (same dir) is your VERBATIM contract.
Files: NEW super-gsd/config/hook-manifest.json, settings-overlay.json,
install.sh, and the guard test. T1 is COMMITTED (glob + batching); build on it.

Essentials (plan review confirmed):
- Explicit manifest of every shipped hook with its intended registration
  surface OR a reasoned intentionally-unregistered entry (statusLine and git
  pre-commit hooks use native surfaces — do NOT double-register them as event
  hooks; the manifest says so with a reason).
- Register the genuinely-missing hooks in settings-overlay.json with correct
  events/timeouts (the 2026-08-13 report's five, minus any the manifest
  legitimately routes to native surfaces).
- Guard-test completeness case: manifest-vs-overlay reconciliation — every
  shipped hook accounted for (registered or reasoned), every overlay
  registration backed by a shipped file, no duplicate event registrations;
  silence fails. Red path encoded as fixtures.
- All nine existing cases stay green; the P160 preflight naturally validates
  the new registrations.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
