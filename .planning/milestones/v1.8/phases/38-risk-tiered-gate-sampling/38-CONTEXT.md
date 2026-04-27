---
phase: 38
title: Risk-Tiered Gate Sampling
type: code (lib + 5 file edits)
created: 2026-04-27
discuss_decisions: [38.1, 38.2, 38.3, 38.4, 38.5]
unblocks: [39]
mode: gsd-discuss-phase --auto
---

# Phase 38 - Risk-Tiered Gate Sampling (CONTEXT)

## Goal

Gate × work-risk intersection layer. 3x3 MATRIX (gate_sampling_tier ×
work_risk) decides whether to fire/skip/maybe-fire each gate. Classifier
emits work_risk from 4 primary + 1 secondary inputs (gate_fitness_history
from Phase 36 summarize() feeds back). Force/skip overrides require
override-reason and log to route-decisions.jsonl with boundary=gate_override.

## Locked decisions (DISCUSS 38.1-38.5)

Verbatim from `.planning/discussions/2026-04-26-mass-discuss.md:181-187`:
- 38.1: 3 work-risk tiers (low/medium/high)
- 38.2: 4 primary classifier inputs (diff_lines, files_touched_count,
  phase_type, phase_includes_security_review)
- 38.3: 1 secondary classifier input (gate_fitness_history; reads Phase 36)
- 38.4: 13 gates each get gate_sampling_tier in {always, sampled-rate-50,
  low-risk-skip}
- 38.5: --force-gates X requires --override-reason "..."; logged to
  route-decisions.jsonl with boundary=gate_override

## What the planner must produce

ONE plan: `38-01-risk-tiered-gate-sampling-PLAN.md` with the following
deliverables:

1. **NEW lib** at `super-gsd/scripts/lib/sampling-decider.cjs` (~280 LOC):
   - Frozen consts: `MATRIX` (3x3), `WORK_RISKS = Object.freeze(['low','medium','high'])`, `SAMPLING_TIERS = Object.freeze(['always','sampled-rate-50','low-risk-skip'])`
   - Public API:
     - `decide({work_risk, gate_sampling_tier})` -> 'fire' | 'skip' | 'maybe'
     - `scoreWorkRisk({diff_lines, files_touched_count, phase_type, phase_includes_security_review, gate_fitness_history?})` -> 'low' | 'medium' | 'high'
   - --self-test (17 assertions in tmpdir; __dirname-anchored)

2. **EDIT** `super-gsd/registry/gates.yaml` (+13 lines):
   - Each gate row gains `gate_sampling_tier:` field per RESEARCH §3 mapping
   - Mapping rationale based on enforcement_mode

3. **EDIT** `super-gsd/scripts/lib/gates-registry.cjs` (~+11 LOC):
   - Validate gate_sampling_tier ∈ SAMPLING_TIERS at load time
   - Throw on unknown tier

4. **EDIT** `super-gsd/agents/sgsd-classifier.md` (output schema):
   - Add work_risk field to classifier output spec
   - Document scoreWorkRisk algorithm (4 primary + 1 secondary)

5. **EDIT** `super-gsd/skills/sgsd-orchestrate/SKILL.md`:
   - 3 wire-in sites at gate-fire decision points (phase-level-ATC,
     per-dispatch-ATC, MUDA-waste-audit) — apply MATRIX before
     gates.shouldFire returns
   - Add --force-gates + --override-reason CLI handling at top of skill
   - Wire route-ledger.cjs::logRouteDecision({boundary: 'gate_override'})

6. **EDIT** `super-gsd/scripts/lib/route-ledger.cjs`:
   - Extend BOUNDARIES from 6 to 7 entries (add 'gate_override')
   - Update --self-test assertion #6 (was 6 entries; now 7)

7. **EDIT** `super-gsd/registry/command-envelope-v1.yaml`:
   - Add 2 new reason_codes (per Phase 31 documented extension protocol):
     - `gate_force_override_with_reason`
     - `gate_sampled_skip`
   - Bump registry_version (semver patch)

8. **NEW test** at `super-gsd/scripts/lib/sampling-decider.test.cjs` (~100 LOC):
   - Local fallback exercising decide() + scoreWorkRisk() with all
     9 matrix cells covered

## Acceptance (SAMPLE-01..05, runnable)

- **SAMPLE-01**: `grep -c '^[[:space:]]*gate_sampling_tier:' gates.yaml` >= 13
- **SAMPLE-02**: classifier output schema includes work_risk; sampling-decider --self-test asserts scoreWorkRisk correctness
- **SAMPLE-03**: SKILL.md grep for `samplingDecider.decide(` returns >= 3
- **SAMPLE-04**: --force-gates X --override-reason "..." appends row to
  route-decisions.jsonl with boundary='gate_override'; --self-test
  exercises this
- **SAMPLE-05**: --force-gates X without --override-reason exits 1

## Open derivation calls

NONE -- all 14 calls locked in 38-RESEARCH.md §11.

## Standard workflow

Phase 38 is code (1 new lib + 5 file edits + 1 test). Standard workflow:
- Step 1 (pattern-mapper): SKIPPED — research mapped from Phase 32 + 36
- Step 7 (MUDA): RUNS (~580 LOC threshold met)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. v1.7 + v1.8-Phase-36 + v1.8-Phase-37 precedent: dual-
provider review surfaces 5-7 distinct findings, all in-loop fixable.

## Kill / defer conditions

- Defer if MATRIX produces >50% skip rate on real workloads (signal
  that thresholds need re-tuning).
- Hard stop if BOUNDARIES extension breaks existing route-ledger.cjs
  consumers (Phase 32 wire-in must continue to work for boundary
  values 1-6).
- Hard stop if reason_codes extension regresses Phase 31 envelope-v1
  schema (semver patch bump only; no schema field shape change).
