---
phase: 56
name: Scenario-Based Acceptance Suite
milestone: v2.0
type: research
synthesized_at: 2026-04-29
synthesis_rule: "compressed-phase research per dispatch rule #1"
---

# Phase 56 Research - Scenario-Based Acceptance Suite

## 1. Goal (verbatim ROADMAP-AGENT.md:677)

6 happy + 4 adversarial scenarios.

Locked decision: 56=B.

## 2. Background - what already exists

Phases 41-55 have shipped per-tool harnesses (token-attribution, context-
packet, dispatch-router, vtp-bridge, memory-governance, redis-adapter,
context-bench, failure-injection, chaos-restart, provider-circuit). Each
verifies its own slice of behaviour. What is missing is a single
operator-runnable harness that exercises end-to-end happy-path AND
adversarial-path expectations in one place, producing one envelope-v1 row
per scenario as durable evidence.

Phase 53 (failure-injection) and Phase 54 (chaos-restart) already
established the harness pattern: closed-vocab manifest + JSON-Schema
draft-07 validator + 11-stream canonical fingerprint guard + tmpdir
container isolation + spawnSync real-process boundary + Lock-13 wrapped
public APIs + envelope-v1 JSONL writer. Phase 56 inherits that pattern
verbatim and adds:

- 10 closed-vocab scenario IDs spanning 6 happy + 4 adversarial cases.
- A 4-entry OUTCOMES enum (PASS / PASS-WITH-DEFERRED-1 /
  PASS-WITH-SOFT-SKIP / FAIL-REJECTED) where adversarial scenarios PASS
  when the under-test tool correctly REJECTS the malformed input.
- A validateScenarioOutcome oracle that matches actual vs. expected via
  byte-equality on the OUTCOMES enum.
- Per-scenario fixture directories under fixtures/<id>/ (10 dirs total).

## 3. Closed-vocab scenario manifest (10 entries, schema_version 1)

| ID                                | Kind        | Target tool                                           | Expected outcome    |
| --------------------------------- | ----------- | ----------------------------------------------------- | ------------------- |
| clean-phase-close                 | happy       | super-gsd/tools/plan-schema/validate.cjs              | PASS                |
| deferred-debt-pass                | happy       | super-gsd/scripts/lib/crit-backlog.cjs                | PASS-WITH-DEFERRED-1|
| soft-skip-codex-unavailable       | happy       | super-gsd/scripts/lib/provider-circuit.cjs            | PASS-WITH-SOFT-SKIP |
| redis-on-graceful-degrade         | happy       | super-gsd/tools/context-cache/redis-adapter.cjs       | PASS-WITH-SOFT-SKIP |
| memory-revocation-replay-clean    | happy       | super-gsd/tools/memory-governance/lifecycle.cjs       | PASS                |
| plan-schema-load-valid            | happy       | super-gsd/tools/plan-schema/validate.cjs              | PASS                |
| poisoned-plan-md                  | adversarial | super-gsd/tools/plan-schema/validate.cjs              | FAIL-REJECTED       |
| race-condition-writes             | adversarial | super-gsd/scripts/lib/crit-backlog.cjs                | FAIL-REJECTED       |
| malformed-checkpoint              | adversarial | super-gsd/tools/chaos-restart/manifest-validator.cjs  | FAIL-REJECTED       |
| mid-write-sigkill                 | adversarial | super-gsd/scripts/lib/crit-backlog.cjs                | FAIL-REJECTED       |

Each entry pins its target_tool path, an inject_mechanism (snake-case
closed string), its expected_reason_codes set, an optional soft_skip_when
trigger, and an evidence_kind (stdout_exit | log_row | fingerprint).

## 4. Public API surface (8, Lock-13 wrapped)

| API                       | Inputs                              | Output                                                   |
| ------------------------- | ----------------------------------- | -------------------------------------------------------- |
| runAll                    | {planningDir?, no_log?}             | {ok, run_id, verdict, pass_count, total, results, ...}   |
| runScenario               | {scenario, tmpdir}                  | {ok, scenario_id, verdict, actual_outcome, ...}          |
| validateScenarioOutcome   | {scenario, actual_outcome, ...}     | {ok, reason, expected_outcome, actual_outcome}           |
| selfTest                  | -                                   | {ok, results: [...] } (~21 assertions)                   |
| aggregateResults          | rs[]                                | {ok, pass, total, verdict, reason, exit_code}            |
| appendLogRow              | row, opts                           | {ok, written, path}                                      |
| _internals                | bag of helpers                      | identity-equal cross-task composition                    |
| frozen surfaces           | SCENARIOS / REASON_CODES / OUTCOMES | read-only constants                                      |

All wrappers try/catch around an _Impl helper. Never throw upward.

## 5. 11-stream canonical fingerprint guard

PHASE_56_GUARDED_STREAMS Object.freeze mirrors Phase 53 / Phase 54 (same
11 entries; superset, never mutates upstream constants):

```
agent-token-spend.jsonl, context-packet-log.jsonl,
context-complaints.jsonl, route-decisions.jsonl, crit-backlog.jsonl,
redis-projection-log.jsonl, edge-guard-log.jsonl,
memory-revocations.jsonl, memory-promotions.jsonl,
memory-demotions.jsonl, memory-revalidations.jsonl
```

The new scenario-suite-log.jsonl writer is NOT in the guarded set, so
appending one envelope-v1 row per scenario does not flag canonical drift.

## 6. v2.0 sext-gate wire (sgsd-complete-milestone.cjs)

Sequence:

1. context-bench self-test          (Phase 51, 33/33)
2. redis-adapter self-test          (Phase 52, 26/26)
3. failure-injection self-test      (Phase 53, 24/24)
4. failure-injection --run-all      (Phase 53, 10/10)
5. chaos-restart self-test          (Phase 54, 18/18)
6. provider-circuit self-test       (Phase 55, >=12/12)
7. NEW: scenario-suite run-self-test (Phase 56, ~21 self-test + 10/10 run-all)

All seven spawnSync invocations must exit 0 for the v2.0 gate to exit 0.
Lock 4: insertion is purely additive after the provider-circuit green
emission; v1.9 dual-gate + Phase 53 triple-gate + Phase 54 quad-gate +
Phase 55 quint-gate paths preserved byte-untouched up to the
scenario-suite insertion point.

## 7. Acceptance fixtures (verbatim ROADMAP-AGENT.md:684-685)

> 10 scenarios runnable; each produces evidence file + asserted gate
> outcome.

Encoded as the runAll(opts) driver: each scenario produces one envelope-v1
JSONL row in .planning/metrics/scenario-suite-log.jsonl AND a per-scenario
verdict via validateScenarioOutcome.

> 4 adversarial: poisoned PLAN.md, race-condition writes, malformed
> checkpoint, mid-write SIGKILL.

Encoded as scenarios SA1 (poisoned-plan-md), SA2 (race-condition-writes),
SA3 (malformed-checkpoint), SA4 (mid-write-sigkill). Each adversarial
scenario PASSes when the under-test tool REJECTS the malformed input
(actual_outcome === 'FAIL-REJECTED' === expected_outcome).

## 8. Lock invariants

- Lock 4: Phase 41-55 tool trees + sgsd-cockpit-shell.cjs byte-untouched.
  Only sgsd-complete-milestone.cjs is surgically extended for the 7th
  spawn step.
- Lock 11: scenario id matching + outcome enum membership +
  expected_reason_codes intersect use ONLY byte-equality and
  set-membership. No regex on stdout for verdict; no semantic match.
- Lock 13: every public API try/catch wraps an _Impl. Subprocess
  spawnSync errors degrade to a typed sentinel.
- ASCII-only across harness.cjs, scenarios.json, SCENARIOS.schema.json,
  run-self-test.cjs, and the sgsd-complete-milestone.cjs delta.

## 9. Out-of-scope (deferred)

- Adding more scenarios beyond the locked 10. Phase 57 candidate.
- Per-scenario evidence file beyond the JSONL row (e.g. per-run text
  reports). Operator-runnable status output already covers the gap.
- Cross-run aggregator (rolling pass-rate over N runs). Phase 57 release-
  readiness score consumes scenario-suite-log.jsonl directly.
