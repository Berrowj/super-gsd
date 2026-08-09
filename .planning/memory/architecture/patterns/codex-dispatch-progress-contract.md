---
title: codex dispatch progress contract
tags: [codex, dispatch, observability]
importance: 70
maturity: raw
created: 2026-08-09T02:01:02Z
---

Operator request 2026-08-09: stop discovering codex dispatch outcomes at the
1200s wrapper timeout. Two-part pattern:

1. **Progress contract in every executor prompt**: codex appends stage lines
   (`<plan>|<utc>|started/edits-done/verifying/reporting/done`) to
   `.planning/metrics/dispatch-progress.txt`, and is told: if running short on
   time, skip polish, write the report EARLY and mark done — a partial report
   beats a timeout kill.
2. **Quiescence watcher Monitor** tailing `codex-executor-live.txt` byte
   growth: alert at 2 min of silence, escalate at 6 — the earliest tell that a
   dispatch is dead or done inside a long window.

**Why:** wrapper timeouts kill mid-work dispatches with report_bytes=0; the
orchestrator then burns a salvage-assessment round. Stage markers turn that
into an instant, precise salvage.
