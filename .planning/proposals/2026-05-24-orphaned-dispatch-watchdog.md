# Proposal — Orphaned-Dispatch Watchdog

> **The recurring failure:** Claude orchestrator dispatches a background task via `Bash(run_in_background=true)`. The dispatch tool errors before emitting a task ID. Claude assumes a notification is coming, waits silently — **3 hours observed in the wild**.

## Failure mode in one diagram

```
Claude ──Bash(run_in_background=true)──▶ Harness
                                              │
                                              ▼
                                       (error at submit;
                                        NO task ID returned)
                                              │
                                              ▼
Claude expects task-notification ◀──── (never fires; no task started)
   │
   ▼
Claude sits silent for 3h
```

This is a **2-Phase Commit failure mode** where the cohort (Claude) is waiting for a coordinator (harness) prepare-result message that the coordinator never sent because it errored during propose. The cohort has no timeout → indefinite wait.

## VTP-substrate grounding (the canonical fix recipes)

- **Database Internals — phi-accrual failure detector** (Cassandra/Akka pattern): sliding-window probability of liveness from heartbeat arrival times. *"How likely we are to make a correct decision about a process's liveness."*
- **Database Internals — 3PC with cohort-side timeouts**: *"timeouts on both sides... allow cohorts to proceed with either commit or abort in the event of coordinator failure."* The cohort makes a decision even when the coordinator goes silent.
- **Strategic Monoliths and Microservices — Resilience primitives**: Failure supervision · Circuit breakers · Retries with capped exponential backoff · **Idempotent receivers** (so a re-dispatch doesn't double-execute).
- **Software Architecture in Practice (ATAM)** — heartbeat + watchdog architecture, *"guaranteed to detect failure within 2 seconds based on rates of heartbeat and watchdog."*
- **Programming Ruby — `Process.wait` + `WNOHANG`**: non-blocking child-process status poll. The language-level pattern we need at the orchestrator layer.

## The three-layer fix

### Layer 1 — Bash-response inspection (Claude-side discipline; zero code change)

After every `Bash(run_in_background=true)` call, Claude **must inspect the response** before assuming the task is running:

```
RESPONSE CONTAINS "Command running in background with ID: <ID>"?
  YES → record <ID>; await notification (normal path)
  NO  → dispatch FAILED at submit. Do NOT wait. Read the error. Decide:
        - fix args / env and re-dispatch
        - fall back to foreground execution
        - report blocker to operator
```

This is a **discipline rule, not a code change**. Add it to `CLAUDE.md` orchestrator guidance:

> **Background dispatch discipline (mandatory):**
> 1. After every `Bash(run_in_background=true)`, INSPECT the response substring.
> 2. If response does NOT contain a task ID → treat as immediate failure. Never wait for a notification that won't come.
> 3. For long-running dispatches (>5 min expected), additionally `ScheduleWakeup(delaySeconds = expected_runtime + 60, ...)` as a backstop. When the wakeup fires before any task-notification, ps-check + report-file check; if dead, re-dispatch.

**Cost:** zero — discipline rule. **Coverage:** catches the exact 3-hour-wait pattern.

### Layer 2 — Scheduled watchdog wakeup (Claude-side; uses existing `ScheduleWakeup` tool)

For each dispatched task, immediately schedule a wakeup at `expected_runtime + 60s`. On wakeup, before assuming the task is still running:

```bash
# ps-check: is the child still alive?
ps -p $(cat .planning/runtime/codex-{plan_tag}.pid 2>/dev/null) 2>/dev/null
# heartbeat-check: when was the script last alive?
stat -c %Y .planning/runtime/codex-{plan_tag}.heartbeat 2>/dev/null
# report-check: did the script start writing output?
test -s .planning/runtime/codex-{plan_tag}-report.md
```

If process gone AND no recent heartbeat AND no report content → task is **orphaned/lost**. Recovery:
- `PushNotification` to operator: "Task <ID> lost — re-dispatching"
- Re-dispatch the same prompt (idempotent — script is safe to re-run)

**Cost:** trivial — one `ScheduleWakeup` per dispatch. **Coverage:** catches both submit-failures AND mid-flight silent deaths.

### Layer 3 — codex-executor.sh heartbeat (script-side; small modification)

Modify `super-gsd/scripts/codex-executor.sh` to:

1. On start (before invoking codex), write PID + heartbeat:
   ```bash
   HEARTBEAT_FILE=".planning/runtime/codex-${PLAN_TAG}.heartbeat"
   PID_FILE=".planning/runtime/codex-${PLAN_TAG}.pid"
   mkdir -p .planning/runtime
   echo "$$" > "$PID_FILE"
   ```

2. Spawn a background heartbeat-writer:
   ```bash
   (
     while kill -0 $$ 2>/dev/null; do
       printf '{"ts":"%s","pid":%d,"phase":"%s"}\n' \
         "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$$" "$PLAN_TAG" \
         > "$HEARTBEAT_FILE"
       sleep 30
     done
   ) &
   HEARTBEAT_BG=$!
   trap 'kill "$HEARTBEAT_BG" 2>/dev/null; rm -f "$HEARTBEAT_FILE" "$PID_FILE"' EXIT
   ```

3. Continue normal execution; heartbeat updates every 30s while alive; cleared on exit.

**Cost:** ~10 lines of bash. **Coverage:** gives the watchdog (Layer 2) a reliable "is it alive?" signal that's independent of the harness's notification mechanism.

## Recovery decision matrix

| Signal | Diagnosis | Action |
|---|---|---|
| Response has task ID + notification fires within expected_runtime + 60s | Normal | Process result, commit, advance |
| Response has no task ID | Submit failure (Layer 1 catch) | Read error, fix, re-dispatch |
| Response has task ID; scheduled wakeup fires; PID alive; heartbeat <60s old; no report | Long task, still running | Reschedule wakeup +5min; continue waiting |
| Response has task ID; scheduled wakeup fires; PID gone; heartbeat >2min old; no report | **Orphaned** (silent death) | Push notification; re-dispatch |
| Response has task ID; scheduled wakeup fires; PID alive; heartbeat <30s old; report has content | Race condition (about to land) | Reschedule wakeup +60s; continue waiting |

## Idempotency guarantee (per Strategic Monoliths' idempotent receivers)

The Codex executor script must be safe to re-run with the same prompt-file/report-out without harm. Current behavior: re-running overwrites the report file and lets Codex re-mutate the workspace. The risk: Codex re-applies edits that already landed.

**Mitigation already in place:** Codex executes patches via git-aware tooling. Re-applying an already-applied patch is a no-op (git detects no changes). The risk of double-application is essentially zero for our workload.

**Belt-and-braces:** add `--idempotent-key {plan_id}-{task_id}` to codex-executor.sh; if the lockfile `.planning/runtime/codex-${KEY}.lock` exists AND is <max-runtime old, exit 0 (assume the other instance is finishing). Optional — only if double-dispatch becomes a real risk.

## Implementation plan (when operator approves)

**Phase A — discipline rule only** (0 code, instant):
1. Update `CLAUDE.md` § "Background dispatch discipline" with the Layer 1 check.
2. Save as feedback memory so future sessions inherit it.

**Phase B — heartbeat + watchdog** (~30 min of code, 1 dispatch):
1. Modify `super-gsd/scripts/codex-executor.sh` to write heartbeat + PID files.
2. Add helper `super-gsd/scripts/lib/dispatch-watchdog.cjs` exposing `checkLiveness(plan_tag)` returning `{alive, heartbeat_age_seconds, report_bytes}`.
3. Update orchestrator pattern: after every Codex dispatch, `ScheduleWakeup(delaySeconds = max(expected_runtime+60, 600), prompt: "/dispatch-watchdog ${plan_tag}")`.

**Phase C — automatic recovery** (~1 hour, 1 dispatch):
1. New skill `/sgsd-dispatch-watchdog` that runs the liveness check + decides recovery action.
2. Wakeup invokes the skill automatically.
3. If recovery is needed, the skill re-dispatches with the same prompt + emits `PushNotification`.

## Memory entry (for `.planning/memory/`)

This whole incident becomes a feedback memory. Slug: `feedback_orphaned_dispatch_no_wait`. Contents: the 3-hour incident, the discipline rule, the 2PC analogy. Save so future sessions can be reminded.

## Open questions

1. **Wakeup delay tuning:** `expected_runtime + 60s`? What's the right default per task type?
   - Codex executor: 600s timeout default → wakeup at 660s ✓
   - Light scripts: ~120s → wakeup at 180s
   - Long-running watchers: shouldn't use the watchdog at all
2. **Heartbeat staleness threshold:** 2× heartbeat interval (60s threshold for 30s heartbeat)? Per phi-accrual: tune for false-positive rate.
3. **Re-dispatch limits:** how many silent-death retries before giving up? Strategic Monoliths suggests capped exponential backoff — propose 3 retries with 60s/300s/600s delays.
4. **Idempotency check:** belt-and-braces lockfile, or trust git's no-op-on-clean-diff guarantee? Recommend trust git; revisit if a double-application incident actually occurs.

## Recommendation

**Ship Phase A immediately (discipline rule + memory entry).** It's free and catches the exact failure mode you experienced. Phase B + C are nice but add code; queue them for a maintenance phase if Phase A doesn't fully eliminate the silent-wait pattern.
