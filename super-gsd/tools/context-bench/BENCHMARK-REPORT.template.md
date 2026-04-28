# Context Stress Benchmark Results — {{milestone}}

Generated: {{generated_at}}
Source: super-gsd/tools/context-bench/harness.cjs

## Aggregate Verdict

**Verdict:** {{aggregate_verdict}}

| Metric | Value |
|--------|------:|
| Median pct_reduction | {{median_pct_reduction}} |
| Total evidence loss (items) | {{evidence_loss_total}} |
| Scenarios scored | {{scenario_count}} |
| Injections recorded | {{injection_count}} |

The aggregate gate uses **median** pct_reduction across S1–S6 (RESEARCH Pitfall 2: median, not mean). PASS requires median >= 0.50 AND every scenario evidence_retention == 1.0 AND every injection gate fired AND zero scenarios in the `ledger-only — incomplete` state. PASS-WITH-DEFERRED-N is permitted only when median is in the [0.40, 0.50) band per VTP-DELTA CANDIDATE-WITH-DEBT clause.

## Per-Scenario Diff Table

| Scenario | Drawn From | Tokens Before | Tokens After | Pct Reduction | Evidence Retention | Verdict |
|----------|------------|--------------:|-------------:|--------------:|-------------------:|---------|
{{scenarios_table}}

Cells rendered as `—` indicate null values: tokens_after is null in `ledger-only — incomplete` runs (no post-mode dispatch); pct_reduction is null when tokens_before is zero or tokens_after is null; evidence_retention is computed against the (kind, ref) byte-equality oracle (Lock 11) and equals 1.0 only when every required evidence item is byte-present in the post_artifacts array.

## Per-Injection Gate-Fired Table

| Fixture | Label | Gate Fired | Reason |
|---------|-------|-----------:|--------|
{{injection_table}}

Soft-skipped fixtures (F12–F15 when memory-governance writers are unwired; F17 contract-only) are excluded from the failed-injection count for verdict computation.

{{deferred_debt_section}}
{{ledger_only_section}}
## Anti-Cheat Attestation

{{anti_cheat_attestation}}

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
