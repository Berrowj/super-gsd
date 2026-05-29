---
slug: dispatch-watchdog-phases-b-c
created: 2026-05-24
status: parked
parked_from: ".planning/proposals/2026-05-24-orphaned-dispatch-watchdog.md"
priority: medium
estimated_effort: ~1.5 hours total (B ~30min + C ~1hr)
unblocks: full self-healing autonomous loop (no operator intervention on silent dispatch deaths)
dependencies: none (Phase A discipline rule already live via memory)
---

# Backlog — Dispatch Watchdog Phases B + C

## Phase A status — LIVE
Discipline rule shipped 2026-05-24 via memory entry `workflow/feedback/feedback_orphaned_dispatch_no_wait.md`. Future Claude sessions inherit it automatically. Catches the 3-hour silent-wait pattern observed in the wild.

## Phase B — Heartbeat + dispatch-watchdog.cjs (~30 min, 1 Codex dispatch)

1. Modify `super-gsd/scripts/codex-executor.sh`:
   - Write PID to `.planning/runtime/codex-${PLAN_TAG}.pid` on start
   - Spawn background heartbeat writer updating `.planning/runtime/codex-${PLAN_TAG}.heartbeat` every 30s with `{ts, pid, phase}`
   - Trap EXIT to clean up both files

2. Create `super-gsd/scripts/lib/dispatch-watchdog.cjs` exposing:
   ```js
   checkLiveness(planTag) → { alive: bool, heartbeat_age_seconds: N, report_bytes: N }
   ```
   Pure Node — reads PID file, runs `ps -p`, stats heartbeat file mtime, stats report file size.

## Phase C — `/sgsd-dispatch-watchdog` skill + automatic recovery (~1 hour, 1 dispatch)

1. New skill at `super-gsd/skills/sgsd-dispatch-watchdog/SKILL.md` that:
   - Takes `planTag` argument
   - Invokes `dispatch-watchdog.cjs::checkLiveness`
   - Decides: continue-wait / reschedule-wakeup / declare-lost-and-redispatch / report-blocker
   - On lost: emits `PushNotification` + re-invokes `codex-executor.sh` with same prompt
   - Logs decision to `.planning/metrics/watchdog-log.jsonl`

2. Orchestrator pattern update: after every Codex dispatch, also `ScheduleWakeup(delaySeconds = expected_runtime + 60, prompt: "/sgsd-dispatch-watchdog ${planTag}")` as backstop.

3. Caps + backoff: max 3 silent-death retries with 60s/300s/600s delays (per Strategic Monoliths' capped exponential backoff).

## When to promote out of backlog
- After v3.3 closes (current focus: localhost cockpit visual redesign — Claude Design prototype incoming, then P135 implementation)
- OR if Phase A discipline rule doesn't fully eliminate the silent-wait pattern in practice
- OR if a real double-dispatch incident occurs (would also pull in the `--idempotent-key` lockfile work)

## References
- `.planning/proposals/2026-05-24-orphaned-dispatch-watchdog.md` — full proposal with VTP-grounded rationale
- Memory: `workflow/feedback/feedback_orphaned_dispatch_no_wait.md` (Phase A live)
- DDIA / Database Internals — 3PC cohort-side timeouts; phi-accrual failure detector
- Strategic Monoliths and Microservices — failure supervision, capped exponential backoff
