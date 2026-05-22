---
phase: 125
phase_name: Cockpit Alert Grammar + North-Star Ranking
milestone: v3.2
ws: B
created: 2026-05-22
status: queued-planning
implementation_status: not-started
source: DLB-12.5 — Operator Comprehension System; WS-B phase 2 (first WS-B code phase)
predecessor: v3.2 P124 PASS (cockpit design spec LOCKED)
implements: 124-COCKPIT-DESIGN-SPEC.md D2 (North-Star ranking) + D3 (alert grammar)
---

# Phase 125 — Cockpit Alert Grammar + North-Star Ranking

> First WS-B code phase. Implements the two computation layers the answer-first cockpit (P126) renders: the deterministic North-Star ranking cascade and the threshold→duration→channel alert grammar.

## Goal

After P125, two new deterministic modules under `super-gsd/tools/cockpit-sidecar/` compute, from the same live ledger inputs the sidecar already reads, (a) the single North Star via a first-match priority cascade and (b) the ranked alert set — all candidate alerts evaluated, exactly one surfaced, the rest counted. P126 then renders them; P125 ships the logic + self-test only.

## Binding invariants (from DLB-12 + 124-COCKPIT-DESIGN-SPEC.md)

1. **Deterministic, no agent judgement.** North Star and alerts are pure functions of ledger state — same input, same output. No LLM call (DLB-12 invariant 5; D2).
2. **Lock-13 untouched.** All new files live in `super-gsd/tools/cockpit-sidecar/`. Zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*` (DLB-12 invariant 3; D6).
3. **One North Star.** The ranking cascade returns exactly one result — first match wins (D2; Made to Stick `::0018`).
4. **Rank then gate.** The alert layer evaluates every candidate, then exposes exactly one + a count of the rest — the alert-fatigue countermeasure (D3; Designing ML Systems `ch08::0022`).
5. **`--json` contract frozen.** P125 adds modules; it does not change `cockpit-sidecar.cjs` output yet (P126 wires the render). New modules are independently `require`-able and self-tested.

## What ships

### `super-gsd/tools/cockpit-sidecar/north-star.cjs`
`computeNorthStar(state)` — input is the sidecar's already-computed signal object (`binding_gate_status`, latest validator verdict, `requires_operator_review`/blocker flags, `fog_score`, `milestone`/`phase`/`progress`). Returns `{ rank, code, message }` via the D2 cascade:
1. `binding_gate_status === 'RED'` → `BLOCKED`
2. validator verdict ∈ {UNGROUNDED, BROKEN_CITATION, CONTAMINATED} → `CHRONICLE_FAILED`
3. hard blocker / `requires_operator_review` open → `NEEDS_OPERATOR`
4. `fog_score.tier === 'high'` → `HEAVY_PHASE`
5. else → `ON_TRACK`

### `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs`
`evaluateAlerts(state)` — each alert candidate is `{ signal, threshold, duration, channel }` per the D3 seed table. Returns `{ top: <alert|null>, others_count: <int>, all: [...] }`. Benign warnings (e.g. `executor_log_unavailable`) are filtered before ranking. Duration-gated alerts (`fog_score > 70 sustained`) require the caller to pass prior-phase context; absent it, treat as not-yet-sustained (fail-safe quiet).

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (create or extend)
Assertions SAC-P125-NN covering: each of the 5 North-Star cascade ranks; first-match precedence (gate RED beats high fog); exactly-one alert surfaced when multiple fire; benign-warning filtering; duration-gate fail-safe.

## Semantic acceptance criteria (target — 125-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P125-01
    input: "state with binding_gate_status=RED and fog_score.tier=high"
    expected_outcome: "computeNorthStar returns rank 1 code=BLOCKED — gate RED wins over high fog (first-match)"
  - id: SAC-P125-02
    input: "state with validator verdict=BROKEN_CITATION, gate not RED"
    expected_outcome: "computeNorthStar returns rank 2 code=CHRONICLE_FAILED"
  - id: SAC-P125-03
    input: "healthy state — gate GREEN, verdict GROUNDED, fog low"
    expected_outcome: "computeNorthStar returns rank 5 code=ON_TRACK"
  - id: SAC-P125-04
    input: "state where 3 alert candidates fire (gate RED, fog>70, dispatch>12)"
    expected_outcome: "evaluateAlerts returns exactly one top alert + others_count=2"
  - id: SAC-P125-05
    input: "state whose only warning is executor_log_unavailable"
    expected_outcome: "evaluateAlerts returns top=null — benign warning filtered, no alert raised"
  - id: SAC-P125-06
    input: "fog_score>70 with no prior-phase context supplied"
    expected_outcome: "the duration-gated fog alert does not fire (fail-safe quiet)"
```

## Out of scope

- Rendering — `renderText()` / `--brief` / `--html` are P126.
- Cross-surface conformance test — P127.
- Changing `cockpit-sidecar.cjs` output or the `--json` contract.
- `fog-score.cjs` and the 10 fog signals — consumed as-is, not modified.

## Cross-references

- `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-COCKPIT-DESIGN-SPEC.md` — D2 + D3, the locked spec this implements
- `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-RESEARCH.md` — cited evidence
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — the consumer P126 wires these modules into
- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock
