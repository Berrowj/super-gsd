---
phase: 37
title: MUDA Deletion Candidates
type: code (lib + .sh post-hook + test)
created: 2026-04-27
discuss_decisions: [37=A]
unblocks: []
mode: gsd-discuss-phase --auto
---

# Phase 37 - MUDA Deletion Candidates (CONTEXT)

## Goal

Extend WASTE.md with `## Deletion Candidates` section populated by 3
heuristics (low_value, recurring, skip_drift) reading the canonical
ledgers (gate-value-log.jsonl from Phase 36; crit-backlog.jsonl).
Each candidate carries kind/target/evidence/risk/rollback fields so
operators (or the milestone-close keep/kill rubric in Phase 39) can
act on real signal.

## Locked decision (DISCUSS 37=A)

3 heuristics fixed. No graph-walk or semantic deep-dive in v1.8;
mechanical thresholds only. Locked in mass-discuss 2026-04-26.

## What the planner must produce

ONE plan: `37-01-muda-deletion-candidates-PLAN.md` with 3 atomic
deliverables:

1. **Lib** at `super-gsd/scripts/lib/muda-deletion-candidates.cjs`
   (~370 LOC):
   - Header citing 37-RESEARCH.md §11
   - Frozen consts: `KINDS = Object.freeze(['low_value_gate','recurring_backlog','skip_drift_gate'])`, `RISKS`, `THRESHOLDS`, `DEFAULT_ROLLBACKS`
   - 6 public exports per RESEARCH §4:
     - `findCandidates(planningDir, opts)` -- orchestrator
     - `findLowValueGates(planningDir, opts)` -- sub-finder
     - `findRecurringBacklog(planningDir, opts)` -- sub-finder
     - `findSkipDriftGates(planningDir, opts)` -- sub-finder
     - `renderMarkdown(candidates)` -- "## Deletion Candidates" section
     - `appendToWasteFile(wasteFilePath, candidates)` -- atomic append
   - All public APIs in try/catch (mirrors Phase 32-36 locked design)
   - --self-test mode running 14 assertions in tmpdir with __dirname-anchored fingerprint guard against canonical gate-value-log.jsonl + crit-backlog.jsonl

2. **sgsd-muda-audit.sh post-hook** (~25 LOC at line ~480, between
   qualitative-codex block and metrics log):
   - After the atomic `mv` of WASTE.md at line 287
   - Dry-run guarded (--dry-run skips)
   - Never blocks (post-hook failure logged but ignored)

3. **Local fallback test** at
   `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` (~90 LOC):
   - 3 fixtures: low_value gate / recurring backlog / skip_drift gate
   - Uses production lib (no mocks)
   - tmpdir-isolated

## Acceptance (MUDA-01..04, runnable)

- **MUDA-01**: `node super-gsd/scripts/lib/muda-deletion-candidates.cjs
  --self-test` exits 0 (14+ assertions PASS).
- **MUDA-02**: lib's `KINDS` const has exactly 3 entries:
  `low_value_gate`, `recurring_backlog`, `skip_drift_gate`.
- **MUDA-03**: each candidate row has 5 required fields
  (kind, target, evidence, risk, rollback).
- **MUDA-04**: `grep -q "muda-deletion-candidates"
  super-gsd/scripts/sgsd-muda-audit.sh` -> match found
  (post-hook present).

## Open derivation calls

NONE -- all 15 calls locked in 37-RESEARCH.md §11. Notable:
- Q1 thresholds (low_value: <0.3 + fires>=5; skip_drift: fire_rate<0.2 + obs>=5; recurring: >=2 milestones) -- LOCKED
- Q2 closed KINDS enum (3 values) -- LOCKED
- Q3 risk static lookup (low_value_gate->medium; others->low) -- LOCKED
- Q4 default rollback strings per kind -- LOCKED
- Q5 wire-in via post-hook (NOT in main shell flow) -- LOCKED

## Standard workflow

Phase 37 is code (1 new lib + 1 .sh edit + 1 test). Standard workflow
runs full:
- Step 1 (pattern-mapper): SKIPPED -- research mapped from
  gate-value-log.cjs / crit-backlog.cjs / route-ledger.cjs
- Step 7 (MUDA): RUNS (~485 LOC threshold met)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. Continuing the v1.7 + v1.8-Phase-36 pattern of dual-
provider review surfacing 5-7 distinct findings, all in-loop fixable.

## Kill / defer conditions

- Defer if heuristic thresholds turn out to false-positive at >50% on
  current repo state; re-tune in v1.9.
- Hard stop if sgsd-muda-audit.sh post-hook causes the audit to fail
  (post-hook MUST never block the audit -- locked invariant).
