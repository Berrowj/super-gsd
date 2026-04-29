---
phase: 96
tier: docs-only-LITE
codex_review: SKIPPED
---

# Phase 96 -- ATC LITE

## First Principles
Warp gain is real (no native long-running local-orchestrator surface today).
Generalizes beyond SGSD (3 named adopters). Effort is the right scope --
draft spec, not implementation. Justified.

## Delete
None -- 5 sections are minimum coverage (problem, motivation, surface,
fallback, non-goals). Removing any breaks upstream-readiness.

## Anti-Slop
- 4-axis scoring is explicit, not vibes.
- "Do not open" rule honored (operator timing).
- Draft cites existing SGSD reference implementation (P74/P75).
- Fallback section preserves correctness without panel.

## Cross-Phase Sanity
- Phase 74 ORCHESTRATOR-LIVE.jsonl named as ingestion-contract reference.
- Phase 75 reader named as parser reference.
- Phase 89 4-tier permissions named as v2 permission model.
- Phase 95 ACP cross-link preserved (deferred candidate, not picked).

## Verdict: PASS
