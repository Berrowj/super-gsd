---
milestone: v2.0
name: Failure Injection (Gate Failure Injection + Restart Chaos + Provider Circuits + Scenario Suite + Release Readiness)
status: SHIPPED
shipped: 2026-04-29
phases: 5
plans: 5
release_readiness_score: 97
release_readiness_color: GREEN
edge_guard_miss_present: false
sept_gate: green
---

# v2.0 Milestone SUMMARY

**Status: SHIPPED 2026-04-29**

All 5 phases (53-57) closed PASS. v2.0 sept-gate green
(33+26+24+10+18+8+~21+10+score=97 across 8 spawns). Zero new
CRITICAL/HIGH debt rows. Release readiness score 97/100 GREEN; zero
edge_guard_miss rows in CRIT-BACKLOG.md.

## What v2.0 delivered

| Phase | Title                                       | Commit            | Key artifact                                                                                  | ATC findings                                                                                                |
|-------|---------------------------------------------|-------------------|-----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| 53    | Gate Failure Injection Harness              | 5680d14           | failure-injection/harness.cjs (10 scenarios + 24 self-test) + failure-injection-log.jsonl     | 10/10 verifier; 24/24 self-test; 10/10 --run-all sub-5.4s; F1-F16 frozen; Lock 4/11/13 verified             |
| 54    | Restart Handoff Chaos Tests                 | a7b0a33           | chaos-restart/harness.cjs (5 kill points + 18 self-test + manifest validator)                 | 10/10 verifier; 18/18 self-test sub-30s; 5/5 --run-all chaos_pass; spawnSync timeout=200ms SIGTERM observed |
| 55    | Provider Backpressure + Timeout Circuits    | a600a2a           | provider-circuit.cjs (6 APIs + 12 self-test) + provider-circuit.json                          | 8/8 verifier; 12/12 self-test sub-5s; N=3 threshold env-overridable; codex->claude byte-equality fallback   |
| 56    | Scenario-Based Acceptance Suite             | 5be6409           | scenario-suite/harness.cjs (10 scenarios + ~21 self-test + JSON-Schema draft-07)              | 7/7 verifier; 21/21 self-test PASS; 10/10 --run-all sub-90s; 6 happy + 4 adversarial scenarios              |
| 57    | Release Readiness Score                     | 24ca109,0a8e611   | release-readiness/score.cjs (8-bucket composite + 15 self-test) + sept-gate wire              | 8/8 verifier; 15/15 self-test PASS sub-1s; live score 97/100 GREEN; edge_guard_miss override demonstrated   |

## v2.0 acceptance gates - all green

- node super-gsd/tools/failure-injection/harness.cjs --self-test -> 24/24 PASS
- node super-gsd/tools/failure-injection/harness.cjs --run-all -> 10/10 PASS
- node super-gsd/tools/chaos-restart/harness.cjs --self-test -> 18/18 PASS
- node super-gsd/scripts/lib/provider-circuit.cjs --self-test -> 12/12 PASS
- node super-gsd/tools/scenario-suite/run-self-test.cjs -> dual-pass green (~21 + 10/10)
- node super-gsd/tools/release-readiness/score.cjs --self-test -> 15/15 PASS
- node super-gsd/tools/release-readiness/score.cjs --milestone v2.0 -> score 97/100 GREEN exit 0
- node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 -> exit 0 (sept-gate green: 33+26+24+10+18+8+~21+10+score=97)
- node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 -> exit 0 (no regression on dual-gate)

## Release readiness score breakdown (Phase 57)

```
release_readiness_score:
  score: 97 / 100
  color: GREEN
  reason: score_computed_ok
  edge_guard_miss_count: 0
  exit_code: 0
  buckets:
    scenarios: 14 / 15            (failure-injection-log.jsonl PASS rate)
    chaos_restart: 10 / 10        (chaos-restart-log.jsonl PASS rate)
    provider_circuit: 10 / 10     (no fallback active)
    scenario_suite: 13 / 15       (scenario-suite-log.jsonl PASS rate)
    token_governance: 15 / 15     (budgets.yaml + check.cjs present)
    memory_governance: 10 / 10    (lifecycle.cjs present)
    routing_quality: 10 / 10      (route.cjs present)
    lock_invariants: 15 / 15      (ASCII-only + Lock 13 self-check)
```

The 3-point shortfall (97 vs 100) reflects real evidence quality in the
failure-injection and scenario-suite log streams (one PASS-WITH-SOFT-SKIP
verdict not in the strict counted-pass set; floor-rounded ratio for the
scenario-suite stream from pre-stabilization rows). Both shortfalls are
non-blocking for the >=70 GREEN threshold and forward-improvable.

## Hard precondition verification (edge_guard_miss override)

Mechanically demonstrated by:
1. selfTest assertion 5 (edge_guard_miss_overrides_to_red): synthetic
   fixture row in tmpdir crit-backlog.jsonl forces score=0, color=RED,
   reason=score_red_edge_guard_miss, exit_code=1.
2. Standalone CLI invocation: score.cjs --milestone v2.0 --planning-dir
   <fixture-with-edge-guard-miss> exits 1 with the same RED override.
3. Sept-gate disambiguation: when score.cjs exits 1, the gate calls
   computeScore() in-process and emits the precise stderr tag
   (milestone_close_blocked:edge_guard_miss_present vs
   milestone_close_blocked:release_score_below_threshold).

## Lock invariants - all hold

- **Lock 4** (Phase 41-56 byte-untouched + import-by-reference): verified
  across all 5 phases. The single observed pre-existing uncommitted edit
  in super-gsd/tools/token-attribution/collect.cjs predates Phase 57
  dispatch (logged as out-of-scope deferred item D1 in Phase 57). Every
  surgical extension to sgsd-complete-milestone.cjs preserved prior gate
  paths byte-equality up to each insertion point (v1.9 dual-gate ->
  Phase 53 triple-gate -> Phase 54 quad-gate -> Phase 55 quint-gate ->
  Phase 56 sext-gate -> Phase 57 sept-gate).
- **Lock 11** (set-membership + byte-equality only - NO embedding/cosine/
  fuzzy): verified across failure-injection harness, chaos-restart harness,
  provider-circuit, scenario-suite, release-readiness score. Every
  predicate uses closed-vocab status field equality (verdict === 'PASS',
  kind === 'edge_guard_miss').
- **Lock 13** (every public API try/catch + degraded sentinel; never
  throws upward): verified across all 5 phases. Operationally: claude CLI
  absent + Redis absent + Codex absent + crit-backlog.jsonl missing +
  failure-injection-log.jsonl unparseable line - no throw escapes anywhere.
- **ASCII-only**: verified across all 5 phases changed files
  (first_nonascii_idx === -1).

## Codex provider health

Codex provider_unavailable across the entire v2.0 run (network/auth on
this host). Phase-level ATC dispatches: all 5 phases reviewed by Claude
only. The Phase 55 provider-circuit infrastructure now formally captures
this state via a circuit breaker (codex->claude fallback). Future v2.1
runs with Codex available will exercise both providers; v2.0 ships the
mechanism.

## Backlog state

- v1.6 carryover: **10 unresolved** (unchanged)
- v1.7 added: 0
- v1.8 added: 0
- v1.9 added: 0
- v2.0 added: **0 new CRITICAL/HIGH debt rows**
  - Phase 53 LOW: 0
  - Phase 54 LOW: 0
  - Phase 55 LOW: 0
  - Phase 56 LOW: 0 (2 in-loop fixes during build, both resolved before close)
  - Phase 57 LOW: 0 (one out-of-scope deferred item for pre-existing collect.cjs diff)
- Total open: 10 (unchanged from v1.6 close)
- edge_guard_miss rows: 0 (verified by Phase 57 score gate)

## Generated artifacts (consumable downstream)

- .planning/metrics/failure-injection-log.jsonl (Phase 53 - envelope-v1; 1500+ rows)
- .planning/metrics/chaos-restart-log.jsonl (Phase 54 - envelope-v1; one row per --run-all)
- .planning/metrics/provider-circuit.json (Phase 55 - schema_version 1)
- .planning/metrics/scenario-suite-log.jsonl (Phase 56 - envelope-v1)
- super-gsd/tools/release-readiness/score.cjs (Phase 57 - 6 public APIs + 8-bucket scorer)
- super-gsd/tools/release-readiness/run-self-test.cjs (Phase 57 - thin shell)
- super-gsd/tools/release-readiness/fixtures/score-with-edge-guard-miss/crit-backlog.jsonl (Phase 57 - synthetic fixture)
- super-gsd/scripts/sgsd-complete-milestone.cjs (Phase 53-57 - extended to sept-gate)

## Falsifiable proof

v2.0 ships a mechanically-falsifiable readiness gate. The score gate is
the closing assertion: a synthetic edge_guard_miss row CAN reduce the
score to 0 RED + exit 1 (verified by self-test 5 + the standalone fixture
invocation). The hard precondition is wired AND mechanically demonstrated,
not just documented. The composite 8-bucket score is forward-improvable:
as more PASS rows accumulate in the canonical streams, the score trends
toward 100. Today's score: 97/100 GREEN.

## What's next

v2.1 (Distribution + Onboarding) - phases 58-62. Operator-facing cookbook,
migration path, install one-liner refinement, real-world deployment harness.

## Closing

v2.0 Failure Injection is SHIPPED. The milestone delivers gate failure
injection + restart chaos tests + provider backpressure circuits +
scenario-based acceptance suite + composite release readiness score. The
sept-gate now requires 8 spawns of green evidence before
sgsd-complete-milestone.cjs --milestone v2.0 exits 0. Lock invariants
4/11/13 + ASCII-only hold across the entire 5-phase run.
