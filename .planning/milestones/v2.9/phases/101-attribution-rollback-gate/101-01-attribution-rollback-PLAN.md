---
plan_id: 101-01
phase: 101
title: Attribution scorer and rollback recommendation gate
type: code+gate
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/harness-attribution/attribute.cjs
  - super-gsd/tools/harness-attribution/run-self-test.cjs
  - super-gsd/scripts/sgsd-complete-milestone.cjs
---

# Plan 101-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Define verdict model | keep/revert/quarantine/pivot/inconclusive/environmental_skip |
| 2 | Implement attribution scorer | Reads manifest + two run evidence indexes |
| 3 | Compute prediction metrics | Fix and regression precision/recall separate |
| 4 | Add rollback recommendation | Exact command or commit reference emitted |
| 5 | Milestone gate stub | v2.9 close can see unattributed candidate edits |
| 6 | Self-test | 12+ assertions over synthetic manifests and outcomes |

## Safety

This phase recommends rollback. It must not execute `git revert` automatically.
