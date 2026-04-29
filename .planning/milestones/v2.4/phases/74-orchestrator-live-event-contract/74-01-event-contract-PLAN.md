---
plan_id: 74-01
phase: 74
title: Live event contract + writer helper
type: code+docs
expected_ATC_tier: lite
files_touched:
  - super-gsd/docs/ORCHESTRATOR-LIVE-EVENTS.md
  - super-gsd/scripts/lib/orchestrator-live-writer.cjs
---

# Plan 74-01

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author ORCHESTRATOR-LIVE-EVENTS.md | 16 event types + per-event schemas + writer interface |
| 2 | Implement writer helper | 3 public APIs Lock-13 wrapped |
| 3 | Run self-test | 9/9 PASS |
| 4 | Verify ASCII-only | first_nonascii_idx=-1 |
| 5 | Atomic commit | feat(p74-01) |

## Self-test floor

```bash
node super-gsd/scripts/lib/orchestrator-live-writer.cjs --self-test
# Expected: 9/9 PASS, exit 0
```
