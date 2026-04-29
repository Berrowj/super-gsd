---
plan_id: 104-01
phase: 104
title: Transfer and out-of-distribution evaluator
type: code+benchmark
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/harness-transfer/evaluate.cjs
  - super-gsd/tools/harness-transfer/run-self-test.cjs
  - super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs
---

# Plan 104-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Define transfer result schema | success, failure detection, token cost, runtime, environment |
| 2 | Add frozen-candidate evaluation | No evolution during transfer run |
| 3 | Add environment toggles | VTP off, Codex unavailable, PowerShell-only |
| 4 | Write transfer report | Candidate vs baseline table |
| 5 | Self-test | No LLM needed; fixture candidates and fixture reports |

## Hard Rule

Do not claim a harness edit transfers unless it was frozen before the transfer run.
