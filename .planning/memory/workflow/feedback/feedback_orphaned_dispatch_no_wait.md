---
name: feedback-orphaned-dispatch-no-wait
description: "Never wait silently for a background task notification — always inspect the Bash response for \"Command running in background with ID:\" first. Submit-time errors return no task ID and no notification will ever fire."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4a157a1d-29d0-4841-943b-2a1902e5d255
---

After every `Bash(run_in_background=true)` call, inspect the response BEFORE assuming the task is running. If the response does NOT contain `Command running in background with ID: <ID>`, the dispatch failed at submit-time. There will be no task-notification — waiting silently means waiting forever.

**Why:** 2026-05-24 incident — operator observed a 3-hour silent wait after a `codex-executor.sh` dispatch errored at submit. Claude assumed a notification was coming and never checked. The harness only emits task-notifications for tasks that actually started; submit-failures return error text inline. This is a 2-Phase Commit cohort-without-timeout failure mode (Database Internals reference).

**How to apply:**
- On every `run_in_background=true` response, look for the task-ID substring.
- If present: record the ID, await notification (normal path).
- If absent: treat as immediate failure. Read the error. Decide: fix args/env and re-dispatch, fall back to foreground, or report blocker to operator. Do NOT keep waiting.
- For dispatches expected to run >5 minutes: additionally `ScheduleWakeup(delaySeconds=expected_runtime+60, ...)` as a backstop. If wakeup fires before notification, ps-check via Bash + check the report-out file size.
- Long-term: see [[orphaned-dispatch-watchdog-proposal]] for the heartbeat-file + watchdog-script approach (Layers 2+3).

**Related:**
- [[orchestrator-patterns]] — autonomous loop contract; this discipline supplements it.
- DDIA / Database Internals 3PC: cohort-side timeout is the canonical fix.
