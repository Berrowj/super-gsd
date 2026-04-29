---
phase: 87
tier: full
provider: claude-orchestrator (in-session)
codex_review: SKIPPED -- codex_provider_unavailable; v2.6 codex_unavailable debt row still open
---

# Phase 87 -- ATC FULL (Claude-only)

## First Principles

Operator override item 4 mandated this phase. Wire-in is the substantive
repair (Phase 86 was detection; Phase 87 is enforcement). Justified.

## Delete

orchestrator-hooks.cjs minimum-shape: 2 public APIs + Lock-13 + selfTest.
SKILL.md additions: 2 surgical hook docs (Step 6.b.4 + Step 11.5).
v2.6 close gate extension: ~30 lines spawnSync warp-doctor + JSON parse +
status switch. No slop.

## Anti-Slop 10/10

1. Every fn called: tokenWasteCheck / contextPacketBuild / selfTest by CLI + SKILL.md hooks.
2. Imports unchanged; subprocess + Phase 74 writer.
3. Lock-13 wraps both public APIs.
4. ASCII-only.
5. Hooks degrade gracefully: missing tool → ok:false; subprocess timeout → ok:false; never throws.
6. v2.6 gate extension uses warp-doctor's existing JSON envelope; no new schema.
7. Crit-backlog row resolutions reflect what shipped (accepted-with-debt for the wire-in concern; accepted-environmental for the bench).
8. ONE thing: ship the live wire-in.
9. Live smoke proven: log mtime updated; freshness probe PASS; gate exit 0.
10. 100/100 cumulative self-test green across all phases.

## Cross-Phase Sanity

- Phase 42 CLI surface verified (--milestone flag available).
- Phase 45 library shape verified (require()-based; no CLI; matches SKILL.md Step 7.5 precedent).
- Phase 74 writer integration matches contract (token_threshold_crossed event emit).
- Phase 86 v2.6 gate preserved + extended cleanly.
- Phase 86 sgsd-complete-milestone-self-test extended + still passes.
- All sibling regressions green (warp-mcp 47/47, warp-doctor 17/17, cockpit-state 19/19).

## Operator Override Items — Final Status

| Item | Status |
|---|---|
| 1. Token-control repair phase | SHIPPED (Phase 86 + Phase 87) |
| 2. Cockpit + recovery packet show context-packet builder live/stale | SHIPPED (Phase 86) |
| 3. Wire token-waste + context-packet into orchestrator path | SHIPPED (Phase 87) |
| 4. 200k/500k context warnings + do_not_continue | SHIPPED (Phase 86 hardening) |
| 5. Fresh-session resume guidance | SHIPPED (Phase 86) |
| 6. Re-run context benchmark full mode | accepted-environmental (operator follow-up to flip proven) |
| 7. v2.6 debt records | SHIPPED (3 rows + v2.6 close gate that enforces) |

## Verdict: PASS

v2.6 close gate live: exit 0 green. Phase 88 unblocked.

Phase 87 closes clean. The operator override (2026-04-29T21:20Z + 21:35Z)
is fully addressed. v2.6 milestone may close at operator's discretion
SHIPPED-clean (or SHIPPED-WITH-DEBT-1 reflecting still-open codex_unavailable).
