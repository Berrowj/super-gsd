---
plan_id: 85-01
phase: 85
title: Recovery packet upgrade
type: code (FULL tier)
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/warp-mcp/fixtures/sgsd_recovery_packet/
  - super-gsd/tools/warp-mcp/fixtures/_redaction/
---

# Plan 85-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Trim current_position to 5-field summary | last_activity_summary + milestone_status_summary ≤200 chars each |
| 2 | Add why_stopped derivation | heuristic-derived 1-line |
| 3 | Add artifact_links | latest_verification + latest_atc_review + checkpoint paths |
| 4 | Roadmap-complete branch | "ROADMAP COMPLETE — nothing to resume" guidance |
| 5 | Total response ≤4 KB | A43 size guard |
| 6 | Roadmap-complete fixture A44 | synthetic state-only fixture |
| 7 | Atomic commit | feat(p85-01) |

NOTE: Phase 85 close revealed STATE.md staleness gap — recovery packet
reads STATE.md as truth but STATE.md hasn't been updated since v2.2
close. See DEVIATIONS in 85-VERIFICATION.md. Phase 86 will address
staleness detection / reconciliation.
