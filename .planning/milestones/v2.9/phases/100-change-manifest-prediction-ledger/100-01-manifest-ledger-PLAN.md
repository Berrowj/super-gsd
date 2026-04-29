---
plan_id: 100-01
phase: 100
title: Harness change manifest schema and ledger
type: code+schema
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/harness-manifest/MANIFEST.schema.json
  - super-gsd/tools/harness-manifest/manifest.cjs
  - super-gsd/tools/harness-manifest/run-self-test.cjs
  - super-gsd/tools/double-agent-executor/task-capsule.schema.json
  - super-gsd/tools/double-agent-executor/run.cjs
---

# Plan 100-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Define manifest schema | Requires fix and regression predictions |
| 2 | Implement writer/reader | Append/read/filter by change_id and component_id |
| 3 | Add task capsule link | Optional `harness_change_id` accepted and logged |
| 4 | Protected surface check | Rejects protected edits without override |
| 5 | Self-test | 15+ assertions including invalid prediction cases |

## Stop Rule

No harness evolution runner may apply candidate edits until this ledger exists.
