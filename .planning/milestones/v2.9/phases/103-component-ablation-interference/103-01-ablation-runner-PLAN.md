---
plan_id: 103-01
phase: 103
title: Component ablation and interference runner
type: code+benchmark
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/harness-ablation/ablate.cjs
  - super-gsd/tools/harness-ablation/run-self-test.cjs
  - super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs
---

# Plan 103-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Implement temp workspace ablation | Main workspace byte-stable before/after |
| 2 | Define ablation manifest | Component id, disabled paths, expected behavior |
| 3 | Run deterministic benchmark per variant | RUN.json captured per component |
| 4 | Compute interference report | Duplicate checks and cost increases surfaced |
| 5 | Self-test | 10+ assertions for isolation and scoring |

## Stop Rule

Do not recommend pruning a component from deterministic benchmark alone. Live/transfer evidence is required.
