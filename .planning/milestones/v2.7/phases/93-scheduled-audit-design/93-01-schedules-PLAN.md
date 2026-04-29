---
plan_id: 93-01
phase: 93
title: 5 candidate schedules + cost + disable instructions
type: docs
expected_ATC_tier: lite
files_touched:
  - super-gsd/docs/SGSD-SCHEDULED-AUDIT-DESIGN.md
---

# Plan 93-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | 5 schedules SA-01..SA-05 | each has cron / audit / runtime / output / review / disable / cost |
| 2 | Cost aggregate table | yearly credit estimate per schedule + total |
| 3 | Schedule prompt template | reusable text operator pastes |
| 4 | Disable/stop instructions | per-schedule + false-positive recovery |
| 5 | NOT-scheduled list | CU-01..CU-06 + Phase 90 exclusions |
| 6 | Atomic commit | feat(p93-01) |
