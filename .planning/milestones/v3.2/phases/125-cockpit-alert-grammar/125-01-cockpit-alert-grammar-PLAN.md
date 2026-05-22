---
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P125-01-cockpit-alert-grammar
phase_id: 125-cockpit-alert-grammar
phase_number: 125
milestone: v3.2
workstream: WS-B
title: Cockpit Alert Grammar + North-Star Ranking
created_by: Codex Planner
created_at: 2026-05-22
locked: true
---

# P125-01 Cockpit Alert Grammar + North-Star Ranking PLAN

## Scope

Translate the locked Phase 124 cockpit design D2/D3 into two deterministic sidecar-local modules plus a sidecar-local self-test runner. This plan does not wire the new modules into `cockpit-sidecar.cjs` and does not change cockpit `--json` output in Phase 125.

## Authoritative Inputs

- `.planning/milestones/v3.2/phases/125-cockpit-alert-grammar/125-CONTEXT.md`
- `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-COCKPIT-DESIGN-SPEC.md`
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs`
- `super-gsd/tools/cockpit-sidecar/fog-score.cjs`
- `super-gsd/templates/plan-schema-v2.json`
- `super-gsd/schemas/plan-locked.schema.json`

## Binding Invariants

- Deterministic only: no LLM calls, no stochastic ranking, no network dependency.
- Lock-13 remains untouched: implementation scope is limited to `super-gsd/tools/cockpit-sidecar/`.
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` is not modified in this phase.
- Cockpit sidecar `--json` output is not modified in this phase.
- `super-gsd/tools/cockpit-sidecar/fog-score.cjs` is consumed as an input contract only and is not modified.
- D2 and D3 behavior is not redesigned; implementation must translate the locked Phase 124 design exactly.

## File Operations

| Operation | Path | Purpose |
| --- | --- | --- |
| CREATE | `super-gsd/tools/cockpit-sidecar/north-star.cjs` | Export `computeNorthStar(state)` implementing the D2 5-rank first-match cascade. |
| CREATE | `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` | Export `evaluateAlerts(state)` implementing the D3 rank-then-gate logic and returning `{top, others_count, all}`. |
| CREATE_OR_EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | Node self-test runner with assertions for SAC-P125-01 through SAC-P125-06; if a cockpit-sidecar self-test already exists, extend by pure append only. |

## Tasks

### P125-T1: North-Star Module

- File operation: CREATE `super-gsd/tools/cockpit-sidecar/north-star.cjs`.
- Export exactly `computeNorthStar(state)`.
- Implement the D2 5-rank first-match cascade from `124-COCKPIT-DESIGN-SPEC.md`.
- Consume the existing cockpit signal object shape produced by `cockpit-sidecar.cjs`.
- Preserve deterministic behavior with no mutation of input state and no side effects.

Acceptance:

- `require('./north-star.cjs').computeNorthStar` is a function.
- The first matching D2 rank wins deterministically.
- Lower-ranked candidates cannot override a higher-ranked match.
- Missing or degraded optional input fields degrade predictably according to the locked D2 cascade.
- Covered by `SAC-P125-01`, `SAC-P125-02`, and `SAC-P125-03` in the self-test runner (the three North-Star cascade ranks).

### P125-T2: Alert Grammar Module

- File operation: CREATE `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs`.
- Export exactly `evaluateAlerts(state)`.
- Implement the D3 rank-then-gate logic from `124-COCKPIT-DESIGN-SPEC.md`.
- Return exactly an object shaped `{top, others_count, all}`.
- Consume fog tier/score fields using the `fog-score.cjs` contract without modifying that file.
- Preserve deterministic ordering and no side effects.

Acceptance:

- `require('./alert-grammar.cjs').evaluateAlerts` is a function.
- Alert candidates are ranked before gates are applied, as locked in D3.
- `top` is the highest-ranked applicable alert or the locked empty-state value.
- `others_count` equals the number of applicable alerts after `top`.
- `all` contains the deterministic applicable alert list in ranked order.
- Covered by `SAC-P125-04`, `SAC-P125-05`, and `SAC-P125-06` in the self-test runner (rank-then-gate, benign-warning filtering, duration-gate fail-safe).

### P125-T3: Sidecar Self-Test Runner

- File operation: CREATE_OR_EXTEND `super-gsd/tools/cockpit-sidecar/run-self-test.cjs`.
- Implement a Node self-test runner using built-in assertions only.
- Support full-suite execution with `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs`.
- Support per-SAC execution with `--sac SAC-P125-NN`.
- Include assertions named SAC-P125-01 through SAC-P125-06.
- If an existing cockpit-sidecar self-test exists, append Phase 125 tests without rewriting unrelated tests.

Acceptance:

- `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` exits 0 when all SACs pass.
- `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P125-01` exits 0 when only SAC-P125-01 passes.
- The same per-SAC behavior exists for SAC-P125-02 through SAC-P125-06.
- Unknown `--sac` values exit non-zero with a clear message.
- The runner implements all six assertions SAC-P125-01 through SAC-P125-06 verbatim against the inputs/outcomes locked in 125-CONTEXT.md.

## Semantic Acceptance Criteria

The following SAC declarations are bound to `.planning/milestones/v3.2/phases/125-cockpit-alert-grammar/125-CONTEXT.md` and must be implemented verbatim by the self-test runner.

| ID | Input | Expected outcome | Verification Command |
| --- | --- | --- | --- |
| SAC-P125-01 | state with `binding_gate_status=RED` and `fog_score.tier=high` | `computeNorthStar` returns rank 1 `code=BLOCKED` — gate RED wins over high fog (first-match) | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P125-01` |
| SAC-P125-02 | state with validator verdict `BROKEN_CITATION`, gate not RED | `computeNorthStar` returns rank 2 `code=CHRONICLE_FAILED` | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P125-02` |
| SAC-P125-03 | healthy state — gate GREEN, verdict GROUNDED, fog low | `computeNorthStar` returns rank 5 `code=ON_TRACK` | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P125-03` |
| SAC-P125-04 | state where 3 alert candidates fire (gate RED, fog>70, dispatch>12) | `evaluateAlerts` returns exactly one `top` alert + `others_count=2` | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P125-04` |
| SAC-P125-05 | state whose only warning is `executor_log_unavailable` | `evaluateAlerts` returns `top=null` — benign warning filtered, no alert raised | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P125-05` |
| SAC-P125-06 | `fog_score>70` with no prior-phase context supplied | the duration-gated fog alert does not fire (fail-safe quiet) | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P125-06` |

## Phase Verification

Primary command:

```powershell
node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
```

Expected result:

- Exit code 0.
- SAC-P125-01 through SAC-P125-06 pass.
- No source files outside the three declared file operations are changed.

## Out Of Scope

- No source mutation outside `super-gsd/tools/cockpit-sidecar/`.
- No modification to `cockpit-sidecar.cjs`.
- No modification to cockpit sidecar `--json` output.
- No modification to `fog-score.cjs`.
- No UI rendering changes.
- No redesign of D2 North-Star ranking or D3 alert grammar.
