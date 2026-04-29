---
plan_id: 99-01
phase: 99
title: Layered trajectory evidence distiller
type: code+evidence
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/harness-evidence/distill.cjs
  - super-gsd/tools/harness-evidence/run-self-test.cjs
  - super-gsd/docs/SGSD-HARNESS-EVOLUTION.md
---

# Plan 99-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Define evidence corpus layout | `OVERVIEW.md`, `INDEX.json`, `tasks/*.md`, `raw/` pointers documented |
| 2 | Implement log readers | Handles JSONL parse errors without throwing |
| 3 | Implement root-cause classifier | Closed labels, deterministic string/rule based first |
| 4 | Write compact overview | Under 4KB default, with drill-down links |
| 5 | Self-test | 12+ assertions for empty, malformed, benchmark, and live-ish fixtures |

## Root-Cause Vocabulary

- state_projection_drift
- missing_context_packet
- provider_unavailable
- gate_false_negative
- gate_false_positive
- token_budget_breach
- duplicate_verification
- incomplete_artifact
- hidden_fault_uncaught
- successful_recovery_pattern
- unknown
