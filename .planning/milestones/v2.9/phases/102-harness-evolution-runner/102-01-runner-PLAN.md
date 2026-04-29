---
plan_id: 102-01
phase: 102
title: AHE runner dry-run and candidate workflow
type: code+orchestration
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/harness-evolution/run.cjs
  - super-gsd/tools/harness-evolution/run-self-test.cjs
  - super-gsd/tools/harness-evolution/README.md
  - super-gsd/tools/double-agent-executor/run.cjs
  - super-gsd/tools/warp-mcp-actions/server.cjs
---

# Plan 102-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Implement dry-run mode | Reads evidence and prints next candidate areas |
| 2 | Implement proposal-only mode | Writes valid manifest entries, no code changes |
| 3 | Implement apply-candidate guard | Uses component registry and protected-surface checks |
| 4 | Integrate double-agent executor | Bounded code candidates use task capsules |
| 5 | Log runner events | `.planning/metrics/harness-evolution-log.jsonl` |
| 6 | Self-test | No LLM required; 15+ assertions |

## Hard Boundary

The runner must not call hidden benchmark oracles from inside model-visible prompts.
