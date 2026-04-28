# Context Stress Benchmark Results — v1.9

Generated: 2026-04-28T18:08:32.723Z
Source: super-gsd/tools/context-bench/harness.cjs

## Aggregate Verdict

**Verdict:** ledger-only — incomplete

| Metric | Value |
|--------|------:|
| Median pct_reduction | — |
| Total evidence loss (items) | 22 |
| Scenarios scored | 6 |
| Injections recorded | 16 |

The aggregate gate uses **median** pct_reduction across S1–S6 (RESEARCH Pitfall 2: median, not mean). PASS requires median >= 0.50 AND every scenario evidence_retention == 1.0 AND every injection gate fired AND zero scenarios in the `ledger-only — incomplete` state. PASS-WITH-DEFERRED-N is permitted only when median is in the [0.40, 0.50) band per VTP-DELTA CANDIDATE-WITH-DEBT clause.

## Per-Scenario Diff Table

| Scenario | Drawn From | Tokens Before | Tokens After | Pct Reduction | Evidence Retention | Verdict |
|----------|------------|--------------:|-------------:|--------------:|-------------------:|---------|
| S1-v17-P32 | v1.7/P32/researcher | 198924 | — | — | 0.00 | ledger-only — incomplete |
| S2-v18-P36 | v1.8/P36/researcher | 171175 | — | — | 0.00 | ledger-only — incomplete |
| S3-v18-P40 | v1.8/P40/researcher | 122437 | — | — | 0.00 | ledger-only — incomplete |
| S4-v16-P26 | v1.6/P26/planner | 94696 | — | — | 0.00 | ledger-only — incomplete |
| S5-v17-P34 | v1.7/P34/researcher | 198771 | — | — | 0.00 | ledger-only — incomplete |
| S6-v15-P21 | v1.5/P21/researcher | 97818 | — | — | 0.00 | ledger-only — incomplete |

Cells rendered as `—` indicate null values: tokens_after is null in `ledger-only — incomplete` runs (no post-mode dispatch); pct_reduction is null when tokens_before is zero or tokens_after is null; evidence_retention is computed against the (kind, ref) byte-equality oracle (Lock 11) and equals 1.0 only when every required evidence item is byte-present in the post_artifacts array.

## Per-Injection Gate-Fired Table

| Fixture | Label | Gate Fired | Reason |
|---------|-------|-----------:|--------|
| F1 | missing capsule | YES | inject_applied |
| F2 | stale registry (legal-keys swap v1.8 -> v1.99) | YES | inject_applied |
| F3 | invalid phase ID (phase=999) | YES | inject_applied |
| F4 | deleted SQLite context-index db | YES | inject_applied |
| F5 | Redis flush stub (SGSD_REDIS_DISABLED=1) | YES | inject_applied |
| F6 | VTP unavailable (SGSD_VTP_FORCE_OFFLINE=1) | YES | inject_applied |
| F7 | Codex unavailable (SGSD_CODEX_FORCE_OFFLINE=1) | YES | inject_applied |
| F8 | critical bypass byte-verbatim preservation | YES | inject_applied |
| F9 | ambiguous command (3 contradictory assumptions) | YES | inject_applied |
| F10 | source-file prompt injection (literal SECRET_PLACEHOLDER_X) | YES | inject_applied |
| F11 | semantic-only false relationship (Lock 11 rejection) | YES | inject_applied |
| F12 | stale operator feedback (2 milestones ago) | soft-skip | bench_fixture_skipped:phase_49_writer_unwired |
| F13 | poisoned validated thought (high confidence + empty source_refs) | soft-skip | bench_fixture_skipped:phase_49_writer_unwired |
| F14 | missing provenance (root_source_hashes=[]) | soft-skip | bench_fixture_skipped:phase_49_writer_unwired |
| F15 | stale abstraction demote (source_hash drift) | soft-skip | bench_fixture_skipped:phase_49_writer_unwired |
| F16 | critical bypass incorrectly compressed (Lock 6 binding rejects) | YES | inject_applied |

Soft-skipped fixtures (F12–F15 when memory-governance writers are unwired; F17 contract-only) are excluded from the failed-injection count for verdict computation.


## ledger-only — incomplete

One or more scenarios returned tokens_after=null because the claude CLI was absent or the post-mode dispatch could not run. This is documented absence-of-evidence, NOT a PASS. Re-run with `--mode=full --milestone=v1.9` once the claude CLI is available to upgrade the report to a real PASS/FAIL verdict.

## Anti-Cheat Attestation

- workspace_clean_assertion: PASS
- forbidden_strings_checked: 6
- secret_prefixes_checked: 3
- post_dispatch_witness: ABSENT


The anti-cheat boundary asserts that the workspace handed to the post-mode dispatch is clean of all 6 forbidden anti-cheat strings (`benchmark`, `score_weight`, `expected_failure`, `oracle`, `anti_cheat_signal`, `this_is_a_test`) and 3 secret-prefix paranoia tokens (`AKIA`, `sk-`, `ghp_`) before the dispatch is permitted. The post-dispatch witness row in `.planning/metrics/route-decisions.jsonl` (run_id prefix `bench-post-{scenario_id}-`) is the unforgeable proof that the dispatch was real.

## Sources

- Plan: `.planning/milestones/v1.9/phases/51-context-stress-benchmark/51-01-context-stress-benchmark-PLAN.md`
- Research: `.planning/milestones/v1.9/phases/51-context-stress-benchmark/51-RESEARCH.md`
- Scenarios: `super-gsd/tools/context-bench/scenarios/S{1..6}-*.json`
- Injectors: `super-gsd/tools/context-bench/failure-injectors.cjs` (F1–F16 + F17 stub)
- Per-row JSONL: `.planning/metrics/context-bench-runs.jsonl` (envelope_version:1, command:`logBenchScenarioResult`)
- Token attribution: `.planning/metrics/agent-token-spend.jsonl` (Phase 41)
- Packet log: `.planning/metrics/context-packet-log.jsonl` (Phase 45)
- Complaint log: `.planning/metrics/context-complaints.jsonl` (Phase 49)
- Route decisions: `.planning/metrics/route-decisions.jsonl` (Phase 47, bench witnesses)
