---
phase: 91
tier: docs-only-LITE
codex_review: SKIPPED
---

# Phase 91 -- ATC LITE

## First Principles
Cloud-safety contract is required before Phase 92 (Oz env spec) and Phase 93 (scheduled audit) can ship. Justified.

## Delete
None — 5 CS + 6 CU are minimum coverage of the operator brief's local-vs-cloud concerns.

## Anti-Slop
- Default-local discipline (when in doubt UNSAFE).
- 11-row decision matrix forces explicit per-task classification.
- Each CU has a documented reason.

## Cross-Phase Sanity
- CU-01 references Phase 48 selective-bridge.
- CU-02 references Phase 52 Redis adapter.
- CU-03 references Phase 67 warp-doctor probes.
- CU-05 references Phase 90 controlled actions.

## Verdict: PASS
