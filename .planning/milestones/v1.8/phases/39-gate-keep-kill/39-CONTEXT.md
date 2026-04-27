---
phase: 39
title: Gate Keep/Kill Review
type: code (tool + 1 SKILL.md edit + test)
created: 2026-04-27
discuss_decisions: [39=B]
unblocks: []
mode: gsd-discuss-phase --auto
---

# Phase 39 - Gate Keep/Kill Review (CONTEXT)

## Goal

Mechanical R1-R6 first-match-wins rubric reading review-ledger +
gate-value-log + edge-guard-log + gates.yaml. Classifies all 13 gates as
keep | kill | defer. Wired into sgsd-complete-milestone Step 4.5 to
write `.planning/milestones/{{version}}/gate-keep-kill.md` + embed in
SUMMARY.md.

## Locked decision (DISCUSS 39=B)

Mechanical rubric only; manual override at milestone close (operator
inspects rubric output before applying any kill recommendations).

## What the planner must produce

ONE plan: `39-01-gate-keep-kill-PLAN.md` with 3 atomic deliverables:

1. **NEW tool** at `super-gsd/tools/gate-keep-kill/rubric.cjs` (~360 LOC):
   - Public API: `runRubric(planningDir, opts)`, `renderTable(rows)`, `classifyGate(...)`, `KEEP_THRESHOLDS`, `VERDICTS`, `REASONS`
   - R1-R6 mechanical rule with first-match-wins + edge-guard halt override
   - R1: fires === 0 -> defer / no_fires_yet (RUBRIC-03 defer-on-empty)
   - R2: edge-guard halt override -> keep
   - R3-R5: keep/kill thresholds (asymmetric: keep>=0.5+fires>=5; kill<0.2+fires>=10)
   - R6: defer fallback (low confidence)
   - --self-test 14 assertions in tmpdir; __dirname-anchored fingerprint guard

2. **EDIT** `super-gsd/skills/sgsd-complete-milestone/SKILL.md`:
   - Insert Step 4.5 between Step 4 (gate-drift) and Step 5 (cross-phase)
   - Invoke runRubric() + writeFile(.planning/milestones/{{version}}/gate-keep-kill.md)
   - Step 6 SUMMARY embedding (~6 lines)

3. **NEW test** at `super-gsd/tools/gate-keep-kill/rubric.test.cjs` (~120 LOC):
   - 6 fixtures covering R1-R6 + edge-guard halt override
   - Uses production lib; tmpdir-isolated

## Acceptance (RUBRIC-01..04, runnable)

- **RUBRIC-01**: rubric.cjs reads from review-ledger + gate-value-log + edge-guard-log + gates.yaml
- **RUBRIC-02**: output table classifies all 13 gates with verdict ∈ {keep, kill, defer}
- **RUBRIC-03**: empty gate-value-log produces all-defer verdicts (NOT default-kill); test fixture asserts
- **RUBRIC-04**: SKILL.md grep for `runRubric\(` returns >= 1

## Open derivation calls

NONE — all 11 calls locked in 39-RESEARCH.md §10.

## Standard workflow

Phase 39 is code (1 new tool + 1 SKILL.md edit + 1 test). Standard:
- Step 1 (pattern-mapper): SKIPPED — research mapped from
  Phase 32/34/36/38 architecture
- Step 7 (MUDA): RUNS (~440 LOC threshold)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. v1.8 Phase 36-38 precedent: dual-provider review
surfaces 5-7 distinct findings, all in-loop fixable.

## Kill / defer conditions

- Defer if rubric produces >50% kill verdicts on current 13 gates
  (signals threshold tuning needed; v1.9 candidate).
- Hard stop if RUBRIC-03 defer-on-empty fails (default-kill on empty
  data is a structural correctness violation).
