---
plan_id: 98-01
phase: 98
title: Harness component registry and validator
type: code+registry
expected_ATC_tier: full
files_touched:
  - super-gsd/registry/harness-components.yaml
  - super-gsd/tools/harness-components/catalog.cjs
  - super-gsd/tools/harness-components/run-self-test.cjs
  - super-gsd/docs/SGSD-HARNESS-EVOLUTION.md
---

# Plan 98-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Inventory existing harness components | At least 25 rows across prompts, tools, hooks, skills, MCP, gates, workflows, memory, dashboard |
| 2 | Freeze component class vocabulary | Unknown class fails validation |
| 3 | Mark protected surfaces | Oracle, verifier, model config, and budget are protected |
| 4 | Implement catalog reader | Lock-13 API returns degraded envelope, never throws |
| 5 | Implement self-test | 15+ assertions cover valid, invalid, protected, path safety, ASCII |
| 6 | Document usage | `SGSD-HARNESS-EVOLUTION.md` explains registry purpose |

## Stop Rule

Do not move to Phase 99 until the registry can be read by a script without loading full SGSD docs into context.
