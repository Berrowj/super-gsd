---
plan_id: 105-01
phase: 105
title: v2.9 release gate, MCP status, and cockpit integration
type: code+docs
expected_ATC_tier: full
files_touched:
  - super-gsd/scripts/sgsd-complete-milestone.cjs
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/cockpit-state/adapter.cjs
  - super-gsd/docs/SGSD-HARNESS-EVOLUTION.md
  - .planning/milestones/v2.9/SUMMARY.md
---

# Plan 105-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Add v2.9 close gate | Blocks missing attribution/transfer/protected override |
| 2 | Add MCP/cockpit summary | Candidate, predictions, verdicts, blockers visible |
| 3 | Write operator docs | Four runner modes explained with commands |
| 4 | Write summary template | Includes measured deltas and reverted changes |
| 5 | Self-tests | Adjacent MCP/cockpit/milestone tests remain green |

## Final Release Standard

Clean v2.9 ship means SGSD has a working harness evolution loop, not just harness evolution vocabulary.
