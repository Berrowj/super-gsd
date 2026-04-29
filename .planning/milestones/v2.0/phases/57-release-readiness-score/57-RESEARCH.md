---
phase: 57
name: Release Readiness Score
milestone: v2.0
type: research
synthesized_at: 2026-04-29
synthesis_rule: "compressed-phase research per dispatch rule #1"
---

# Phase 57 Research - Release Readiness Score

## 1. Goal (verbatim ROADMAP-AGENT.md:692)

8-bucket score (0-100). Gates milestone close: cannot SHIPPED until >=70 AND
zero `edge_guard_miss` rows in CRIT-BACKLOG.md.

Locked decision: 57=B.

## 2. Background - what already exists

Phases 41-56 ship per-tool harnesses, manifests, canonical streams, and
self-tests. v2.0 currently runs a sext-gate inside
`super-gsd/scripts/sgsd-complete-milestone.cjs` (context-bench +
redis-adapter + failure-injection + chaos-restart + provider-circuit +
scenario-suite). Each individually green produces the milestone-close go
signal. What is missing is a single composite readiness score that
collapses the multi-bucket evidence into one operator-facing 0-100 number
plus a RED/AMBER/GREEN classifier, with a hard `edge_guard_miss`
precondition that overrides bucket totals.

Phase 57 inherits the closed-vocab manifest pattern from Phase 53/54/55/56
verbatim and adds:

- 8 score buckets each contributing a fixed point allocation summing to 100.
- A hard precondition: any `edge_guard_miss` row in
  `.planning/metrics/crit-backlog.jsonl` -> color RED + score 0 regardless
  of bucket totals.
- Color thresholds: GREEN >=70 (exit 0), AMBER 50-69 (exit 1), RED <50 OR
  edge_guard_miss present (exit 1).
- Public surface mirroring Phase 55: 6 APIs (computeScore, getBucketScore,
  hasEdgeGuardMiss, getColor, selfTest, _internals).

## 3. 8-bucket score allocation (locked, sums to 100)

| # | Bucket               | Pts | Source signal                                                                | Computation                                                              |
| - | -------------------- | --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1 | scenarios            | 15  | `.planning/metrics/failure-injection-log.jsonl` rows where milestone matches | (PASS + PASS-WITH-SOFT-SKIP) / total * 15                                |
| 2 | chaos_restart        | 10  | `.planning/metrics/chaos-restart-log.jsonl` rows where verdict=PASS          | pass / total * 10                                                        |
| 3 | provider_circuit     | 10  | `.planning/metrics/provider-circuit.json` -> milestones[m].codex             | 10 if no fallback active OR no codex entry, else 5                       |
| 4 | scenario_suite       | 15  | `.planning/metrics/scenario-suite-log.jsonl` rows where verdict=PASS         | pass / total * 15                                                        |
| 5 | token_governance     | 15  | `super-gsd/tools/token-waste/budgets.yaml` presence + checker available      | 15 if budgets file exists AND checker module loads, 7 if file only, 0 if absent |
| 6 | memory_governance    | 10  | `super-gsd/tools/memory-governance/lifecycle.cjs` selfTest available         | 10 if module loads AND exposes selfTest, 5 if module loads, 0 if absent  |
| 7 | routing_quality      | 10  | `super-gsd/tools/dispatch-router/route.cjs` available                        | 10 if module loads AND exposes routeDispatch, 5 if module loads, 0 if absent |
| 8 | lock_invariants      | 15  | composite check: ASCII-only on score.cjs + Lock 13 self-test green           | 15 if score.cjs first_nonascii_idx === -1 AND selfTest exits 0 on inputs |

Total: 100 points. All bucket scores rounded down to integer.

## 4. Hard precondition - edge_guard_miss override

`hasEdgeGuardMiss(planningDir)` reads
`.planning/metrics/crit-backlog.jsonl` line-by-line (JSONL parse with
try/catch per line), checks for any row where `kind === 'edge_guard_miss'`
AND `resolved_at == null`. Lock 11: byte-equality on `kind` field; no
fuzzy matching, no regex.

When `hasEdgeGuardMiss` returns true:
- `computeScore` returns `{ok: true, score: 0, color: 'RED',
  reason: 'edge_guard_miss_present', buckets: {...all-zero}, exit_code: 1}`.
- The bucket scores ARE still computed (for observability) but the total
  is hard-zeroed and color is forced RED.

When the file is missing or every line fails to parse:
- `hasEdgeGuardMiss` returns `false` (degraded-OK; the gate is permissive
  about missing files per Lock 13).

## 5. Public API surface (6, Lock-13 wrapped)

| API                | Inputs                              | Output                                                   |
| ------------------ | ----------------------------------- | -------------------------------------------------------- |
| computeScore       | {planningDir?, milestone?}          | {ok, score, color, reason, buckets, exit_code}           |
| getBucketScore     | {bucket, planningDir?, milestone?}  | {ok, bucket, points, max, source, reason}                |
| hasEdgeGuardMiss   | {planningDir?}                      | {ok, present, count, source}                             |
| getColor           | score                               | 'GREEN' | 'AMBER' | 'RED'                                |
| selfTest           | -                                   | {ok, results: [...]} (12-15 assertions)                  |
| _internals         | bag of helpers                      | identity-equal cross-task composition                    |

All wrappers try/catch around an `_Impl` helper. Never throw upward.

## 6. Closed-vocab BUCKET_NAMES

`BUCKET_NAMES = Object.freeze(['scenarios', 'chaos_restart',
'provider_circuit', 'scenario_suite', 'token_governance',
'memory_governance', 'routing_quality', 'lock_invariants'])`. Length 8;
sum of MAX_POINTS table === 100; both invariants asserted in selfTest.

## 7. CLI dispatch

`node super-gsd/tools/release-readiness/score.cjs --self-test`
  -> 12-15 assertions. Exit 0 on all-PASS, 1 otherwise.

`node super-gsd/tools/release-readiness/score.cjs --milestone v2.0`
  -> compute score against canonical streams + metrics + tool-presence
     probes. Print `score: NN  color: GREEN|AMBER|RED  reason: <code>`
     plus per-bucket lines. Exit 0 if score>=70 AND no edge_guard_miss,
     1 otherwise.

`node super-gsd/tools/release-readiness/score.cjs --milestone v2.0
  --planning-dir <abs-or-relative-path>`
  -> override the canonical-streams root (test-only; mirrors Phase 55
     `SGSD_CIRCUIT_STATE_FILE` env override pattern).

## 8. 11-stream canonical fingerprint guard - INTENTIONAL OMISSION

Phase 53/54/56 each ship `PHASE_NN_GUARDED_STREAMS` to detect cross-run
canonical drift during `--run-all` paths that spawn subprocesses. Phase
57 score.cjs is READ-ONLY by shape: it never writes to canonical streams
and never spawns subprocesses. The cross-run-drift assertion is therefore
unnecessary; Lock 11 byte-equality on bucket-source reads is sufficient.

(If a future Phase 5N introduces a `--run-all` that DOES write its own
witness stream, that future phase will add `PHASE_5N_GUARDED_STREAMS` then.)

## 9. v2.0 sept-gate extension

`super-gsd/scripts/sgsd-complete-milestone.cjs` becomes a 7-gate sept
when invoked with `--milestone v2.0`:

1. context-bench --self-test (Phase 51)
2. redis-adapter --self-test (Phase 52)
3. failure-injection --self-test (Phase 53)
4. failure-injection --run-all (Phase 53)
5. chaos-restart --self-test (Phase 54)
6. provider-circuit --self-test (Phase 55)
7. scenario-suite run-self-test (Phase 56)
8. release-readiness score (Phase 57; HARD precondition + >=70)

The release-readiness gate runs LAST because it observes evidence emitted
by gates 1-7. If any earlier gate failed, the score gate never executes
(fail-fast preserves stderr signal clarity).

A new stderr tag `milestone_close_blocked:release_score_below_threshold`
fires when score < 70. A separate tag
`milestone_close_blocked:edge_guard_miss_present` fires when the hard
precondition triggers. Lock 13: try/catch wraps the score require AND the
spawnSync invocation; never throws upward.

## 10. Lock invariants

- **Lock 4**: Phase 41-56 byte-untouched. `score.cjs` is new. The single
  surgical extension to `sgsd-complete-milestone.cjs` preserves the v1.9
  dual-gate + Phase 53 triple-gate + Phase 54 quad-gate + Phase 55
  quint-gate + Phase 56 sext-gate paths byte-equality up to the new
  insertion point.
- **Lock 11**: bucket reads use byte-equality on closed-vocab status
  fields (`verdict === 'PASS'`, `kind === 'edge_guard_miss'`). No regex
  predicates on payload content. No fuzzy match.
- **Lock 13**: every public API try/catch wraps an `_Impl` helper.
  Missing data file -> bucket score = 0 (degraded-OK). Never throws
  upward.
- **ASCII-only**: all 4 changed files (score.cjs, run-self-test.cjs,
  fixture seeds, sgsd-complete-milestone.cjs surgical block) verified
  `first_nonascii_idx === -1`.

## 11. Open Q-issues - resolved at research

- **Q1** (counted-pass set for scenarios bucket): include
  PASS-WITH-SOFT-SKIP and PASS-WITH-DEFERRED-N as pass equivalents per
  Phase 53/56 conventions; FAIL and FAIL-REJECTED count as fail.
- **Q2** (provider_circuit when state file missing): treat as
  no-fallback-active = full 10 points (consistent with Phase 55
  "missing-state-file degrades to ok-sentinel" rule).
- **Q3** (token_governance proxy): use file presence + module loadability
  rather than median pct_reduction because the live ledger has not yet
  accumulated stable budget-breach signal in this run; presence-based
  proxy is forward-compatible (a future Phase 5N can swap to live data
  without changing the bucket interface).
- **Q4** (lock_invariants self-check vs. external check): self-check
  (this module's own ASCII + Lock 13) - running `git diff --quiet -- ...`
  on Phase 41-56 trees from inside the score module would couple Phase
  57 to repo working-tree state, which is brittle. The lock_invariants
  bucket is intentionally narrow.

## 12. Failure modes and degraded paths

- Missing canonical stream files: bucket score = 0; `reason:
  missing_source_file_degraded`. Score still computed; never throws.
- Unparseable JSONL line: skipped via per-line try/catch; counted as
  zero-pass for that line. Never throws.
- crit-backlog.jsonl JSON parse error: per-line try/catch; ignored line.
  `hasEdgeGuardMiss` returns the count of cleanly-parsed rows matching
  the predicate.
- score.cjs require failure inside sgsd-complete-milestone.cjs: stderr
  tag `milestone_close_blocked:release_readiness_unavailable`; exit 1.

## 13. Hand-off

Single executor dispatch (compressed): score.cjs (~600-800L) +
run-self-test.cjs thin shell + 3 fixture cases (synthetic 70-pt + 69-pt
+ edge_guard_miss override) + 12-15 self-tests + sgsd-complete-milestone
sept-gate extension. ~5 atomic commits + 1 close commit + milestone
SHIPPED commit.
