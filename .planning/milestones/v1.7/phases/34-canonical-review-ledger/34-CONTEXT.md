---
phase: 34
title: Canonical Review Ledger
type: code (lib + 2 wire-ins + 1 read-edit)
created: 2026-04-27
discuss_decisions: []
unblocks: [35]
mode: gsd-discuss-phase --auto
deviations:
  - "ROADMAP-AGENT.md split (tools/review-ledger/aggregate.cjs + lib/review-ledger-writer.cjs) collapsed to single super-gsd/scripts/lib/review-ledger.cjs; matches Phase 32+33 single-file pattern."
  - "LEDGER-02 wording misleading: codex-exec.sh does NOT write commit-reviews.jsonl; sgsd-orchestrate SKILL.md does at :760 (Claude path) and :1248 (Codex path post-Phase-32-fix). ONE wire-in covers both providers."
---

# Phase 34 - Canonical Review Ledger (CONTEXT)

## Goal

Aggregator + real-time writer that consolidates per-phase
`commit-reviews.jsonl` files into a canonical
`.planning/metrics/review-ledger.jsonl`. Closes the v1.5
empty-baseline kill-check gap (milestone close currently can't tell
"no reviews ran" from "all reviews passed cleanly"). New `--kill-check`
flag returns `baseline_ok` when ledger non-empty, `empty_baseline`
otherwise.

## Locked decisions

NONE for Phase 34 in `.planning/discussions/2026-04-26-mass-discuss.md`
(default-auto). 16 derivation calls all locked in 34-RESEARCH.md §11.

## What the planner must produce

ONE plan: `34-01-canonical-review-ledger-PLAN.md` with the following
deliverables (single combined file, not the ROADMAP split):

1. **Lib module** at `super-gsd/scripts/lib/review-ledger.cjs` (~350 LOC):
   - Header comment cites RESEARCH §10 public API + §11 locked decisions
   - Frozen consts: `LEGACY_VERDICT_MAP` (legacy vocab -> envelope status),
     `LEDGER_PATH = '.planning/metrics/review-ledger.jsonl'`
   - Public exports (per RESEARCH §10):
     - `appendReviewRow(planningDir, row)` -- atomic append, never throws upward
     - `readReviewRows(planningDir, {milestone?, phase?})` -- defensive read with optional filters
     - `aggregateFromPhases(planningDir)` -- walks per-phase files, populates canonical (idempotent via dedup)
     - `killCheck(planningDir, {milestone})` -- returns {ok, reason: 'baseline_ok' | 'empty_baseline', count}
     - `LEGACY_VERDICT_MAP` (frozen)
   - Row shape: envelope-v1 wrapper preserving legacy under `_legacy`:
     `{envelope_version: 1, ts, command: 'logReviewRow', status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone, _legacy: {original row}, _source_phase, _source_milestone}`
   - Dedup tuple: (ts, plan, provider) per RESEARCH §11.4 lock
   - All public APIs wrapped in try/catch; errors logged to stderr; functions return falsey on failure (mirrors route-ledger.cjs locked design)
   - --self-test mode running 15 assertions in tmpdir (RESEARCH §9.2 list)
   - --kill-check CLI mode (RESEARCH §4)
   - --aggregate CLI mode (RESEARCH §2)
   - Anchor canonical fingerprint guard to `__dirname` (Phase 32 W3 lesson)

2. **Wire-in** at `super-gsd/skills/sgsd-orchestrate/SKILL.md`:
   - ONE wire-in immediately AFTER `appendPerDispatchReviewEvidence(...)`
     at line ~1236 (post-Phase-32 placement). Both Claude and Codex paths
     converge here.
   - `appendReviewRow(...)` call wrapped in try/catch (orchestrator never crashes on writer failure)
   - Decision factors in scope: report (provider, model, content), effective (provider name), currentPhase, currentMilestone, currentPlan, dispatchResult (only on Codex path)
   - Per RESEARCH §3.3, the wire-in writes to BOTH the per-phase file (existing behavior preserved) AND the canonical ledger (new). Tee pattern.

3. **Cockpit read-edit** at `super-gsd/scripts/sgsd-mission-control.ps1`
   line ~1538 area: switch from per-phase enumeration to canonical ledger read
   when canonical exists; fall back to per-phase enumeration when canonical
   is absent (forward-compat: works on repos that haven't run Phase 34 yet).

4. **Acceptance criteria runnable** (LEDGER-01..04):
   - LEDGER-01: `node super-gsd/scripts/lib/review-ledger.cjs --aggregate`
     consolidates all per-phase commit-reviews.jsonl into canonical;
     `wc -l` of canonical >= 11 (per RESEARCH §1 — 11 existing per-phase files)
   - LEDGER-02: SKILL.md grep for `appendReviewRow(` returns >= 1 match;
     after a real Codex review (or local fallback), canonical gets a new row
   - LEDGER-03: `node super-gsd/scripts/lib/review-ledger.cjs --kill-check`
     against empty fixture returns `{ok: false, reason: 'empty_baseline'}`,
     exit 1; against canonical-with-rows returns `{ok: true, reason: 'baseline_ok'}`,
     exit 0
   - LEDGER-04: Mission Control reads canonical when present (smoke test by
     temporarily renaming and re-rendering)

5. **Live-or-local fallback** (Patch 4):
   - Live: next codex/claude review writes to canonical via the wire-in
   - Local: `--aggregate` invocation deterministically rebuilds canonical
     from existing per-phase files; no live dispatch needed
   - Both paths use the same `appendReviewRow` helper (no mocks)

## Open derivation calls

NONE - all 16 calls locked in 34-RESEARCH.md §11. Two documented
DEVIATIONS in frontmatter (file collapse + LEDGER-02 wording).

## Standard workflow

Phase 34 is code (1 new lib + 1 SKILL.md edit + 1 PS1 edit). Standard
workflow runs full:
- Step 1 (pattern-mapper): SKIPPED — research mapped pattern from
  route-ledger.cjs (1:1 reuse)
- Step 7 (MUDA): RUNS (~480 LOC threshold likely met)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. Codex behaviorally available per Phase 33 evidence.
Real WARNs from dual-provider review fixed in-loop in 1 attempt
each (per Phase 31 + 32 + 33 precedent: trivial vocab/scope/conformance
gaps closed efficiently).

## Kill / defer conditions

- Defer if --kill-check semantics turn out to need a per-phase
  threshold (currently ANY row counts as baseline_ok; if a phase passes
  with 0 reviews ran, that's still empty_baseline at the milestone level)
- Hard stop if dedup tuple (ts, plan, provider) collides on legitimate
  multi-provider review of same plan (would corrupt aggregation) — adjust
  to row-content hash if observed
