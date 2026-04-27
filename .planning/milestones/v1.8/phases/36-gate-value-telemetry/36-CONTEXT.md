---
phase: 36
title: Gate Value Telemetry
type: code (lib + 3 SKILL.md wire-ins)
created: 2026-04-27
discuss_decisions: [36=B]
unblocks: [38, 39]
mode: gsd-discuss-phase --auto
---

# Phase 36 - Gate Value Telemetry (CONTEXT)

## Goal

Append-only `.planning/metrics/gate-value-log.jsonl` writer + summarizer,
wired into all 3 orchestrator gate-fire decision points (phase-level-ATC,
per-dispatch-ATC, MUDA-waste-audit). Each row captures gate name +
outcome ∈ {pass,warn,block,skip} + envelope-v1 standard fields +
retroactive metadata. Feeds Phase 38 sampling-decider + Phase 39
keep/kill rubric (defer-on-empty).

## Locked decision (DISCUSS 36=B)

Outcome + retroactive fields, **no cost** (no time/$$/etc. in log).
Locked in `.planning/discussions/2026-04-26-mass-discuss.md`.

## What the planner must produce

ONE plan: `36-01-gate-value-telemetry-PLAN.md` with 3 atomic deliverables:

1. **Lib** at `super-gsd/scripts/lib/gate-value-log.cjs` (~350 LOC):
   - Header citing 36-RESEARCH.md §10 + §11
   - Frozen consts: `OUTCOMES = Object.freeze(['pass','warn','block','skip'])`,
     `LEDGER_PATH`, `RUN_ID_REGEX`
   - Public exports per RESEARCH §7:
     - `logGateValue(planningDir, {gate, outcome, phase, milestone, run_id?, retroactive_fields?})`
     - `readGateValueRows(planningDir, {gate?, milestone?})`
     - `summarize(planningDir, {milestone?})` -> `{gate, fires, pass, warn, block, skip, fire_rate, value_score}` per gate
     - `OUTCOMES` (frozen)
   - Row shape: envelope-v1 wrapper + 3 extension fields
     `{envelope_version: 1, ts, command: 'logGateValue', status, run_id, gate, outcome, retroactive: {gate_yaml_hash, fired_at}, phase, milestone, ...}`
   - All public APIs in try/catch (mirrors Phase 32-34 locked design)
   - --self-test mode running 12+ assertions in tmpdir
   - --summary CLI mode
   - Anchor canonical fingerprint guard to `__dirname` (Phase 32 W3 lesson)
   - value_score formula: `max(0, (pass + 0.5*warn - block) / fires)` when
     fires > 0, else null (Phase 39 defer-on-empty)

2. **SKILL.md 3-site wire-in** at `super-gsd/skills/sgsd-orchestrate/SKILL.md`:
   - Site 1: phase-level-ATC (around line 591/760)
   - Site 2: per-dispatch-ATC (around line 1126/1276-1279)
   - Site 3: MUDA-waste-audit (around line 799/818-823)
   - Each site fires `logGateValue` on BOTH the SKIP arm (gates.shouldFire returns false)
     AND the FIRE arm (gate fired with verdict). Outcome derived from verdict.
   - Wrapped in try/catch — orchestrator continues regardless.

3. **Local fallback test** at `super-gsd/scripts/lib/gate-value-log.test.cjs` (~80 LOC):
   - Imports `logGateValue` from production lib (NOT mocked)
   - 4 fixtures: pass / warn / block / skip
   - Asserts each row matches expected envelope shape + extension fields
   - tmpdir-isolated; cleanup on exit

## Acceptance (GVAL-01..04, runnable)

- **GVAL-01**: `node super-gsd/scripts/lib/gate-value-log.cjs --self-test`
  exits 0 (12+ assertions PASS).
- **GVAL-02**: `grep -c "logGateValue\s*(" super-gsd/skills/sgsd-orchestrate/SKILL.md` >= 3.
- **GVAL-03**: each emitted row has gate, outcome ∈ OUTCOMES, phase,
  milestone, ts, run_id (envelope-v1 pattern), retroactive_fields.
- **GVAL-04**: `node super-gsd/scripts/lib/gate-value-log.cjs --summary`
  groups by gate; emits `{gate, fires, pass, warn, block, skip, fire_rate, value_score}` per gate.

## Open derivation calls

NONE — all 15 calls locked in 36-RESEARCH.md §10. Most notable locks:
- Q1 envelope-v1 wrapped (LOCKED)
- Q2 3 wire-in sites (LOCKED)
- Q3 OUTCOMES frozen const (LOCKED)
- Q4 value_score formula (LOCKED with rationale)
- Q5 LEGACY_VERDICT_MAP-mirrored outcome derivation (LOCKED)
- Q6-Q15 implementation details all locked

## Standard workflow

Phase 36 is code (1 new lib + 1 SKILL.md edit + 1 test). Standard
workflow runs full:
- Step 1 (pattern-mapper): SKIPPED — research mapped 1:1 from
  route-ledger.cjs / review-ledger.cjs
- Step 7 (MUDA): RUNS (~430 LOC threshold likely met)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. v1.7 precedent shows dual-provider review surfaces
real findings; expect 2-7 distinct findings, all in-loop fixable in
1 attempt (per v1.7 Phase 31-35 pattern).

## Kill / defer conditions

- Defer if first 10 gate-fire rows show no outcome variance (all pass,
  no signal value); revisit telemetry design.
- Hard stop if logGateValue throws upward and crashes orchestrator
  on first invocation (locked never-throws contract violation).

## Cross-phase integration

- Phase 38 sampling-decider WILL consume gate-value-log via
  `summarize()` -> per-gate value_score for risk-tier intersection.
- Phase 39 rubric WILL consume gate-value-log; defer-on-empty when
  fires=0 prevents cold-start kill recommendations.
- Phase 32 route-ledger NOT a consumer (orthogonal: gate-value-log
  is gate-FITNESS data, route-decisions is gate-OUTPUT data).
