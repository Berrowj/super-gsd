---
plan_id: 90-01
phase: 90
title: Controlled action MCP server (3 net-new tools + approval flow + audit log + DENIED_FOREVER enforcement)
type: code (FULL tier; new server)
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/warp-mcp-actions/server.cjs
  - super-gsd/tools/warp-mcp-actions/run-self-test.cjs
---

# Plan 90-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | server.cjs with 3 tool stubs | TOOL_NAMES len=3; TIERS len=4; DENIED_FOREVER len=5 |
| 2 | Approval flow | JSON-RPC ui/approval_required + 60s timeout + default-deny |
| 3 | Audit log appends on every dispatch | even denied/timeout/error |
| 4 | DENIED_FOREVER enforced before approval prompt | sgsd_go etc. cannot bypass |
| 5 | Self-test 15+/15+ PASS | ALLOW + DENY + TIMEOUT + DENIED_FOREVER paths |
| 6 | v2.3 server NOT modified | Lock-4 verified |
| 7 | Atomic commit | feat(p90-01) at dae0550 |

Status: SHIPPED at dae0550.
