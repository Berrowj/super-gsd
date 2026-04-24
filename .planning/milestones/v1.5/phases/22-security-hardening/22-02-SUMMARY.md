---
phase: 22
plan: "22-02"
subsystem: sgsd-stop-handoff
tags: [security, flock, concurrent-write, SEC-02]
dependency_graph:
  requires: [22-01]
  provides: [SEC-02]
  affects: [sgsd-stop-handoff.sh, handoff-log.jsonl]
tech_stack:
  added: []
  patterns: [flock-fd-guard, node-appendFileSync-fallback, bash-version-guard]
key_files:
  modified:
    - super-gsd/scripts/sgsd-stop-handoff.sh
decisions:
  - "Use exec {LOG_FD}>>$LOG_PATH fd-based locking (not subshell redirect) for clean lock/unlock lifecycle"
  - "bash >= 4.1 guard required before exec {var}>> auto-fd syntax"
  - "lock_fallback:true field injected only on last-resort unlocked path (path 4), not on Node path"
  - "Node appendFileSync fallback emits no lock_fallback field — O_APPEND is atomic for small POSIX writes"
metrics:
  duration_minutes: 6
  completed_date: "2026-04-24"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
  commits: 1
---

# Phase 22 Plan 02: flock Concurrent-Write Guard Summary

**One-liner:** flock -x -w 5 fd-based guard + Node O_APPEND fallback + bash-version guard + lock_fallback audit field in sgsd-stop-handoff.sh _log_row.

## What Was Built

Extended `_log_row()` in `sgsd-stop-handoff.sh` with a three-tier locking fallback chain:

1. **flock path (preferred):** `exec {LOG_FD}>>"$LOG_PATH"` opens a persistent fd; `flock -x -w 5 $LOG_FD` acquires an exclusive 5-second-timeout lock; `echo "$row" >&"$LOG_FD"` writes the row; `flock -u $LOG_FD` releases; `exec {LOG_FD}>&-` closes. A bash >= 4.1 version guard (`BASH_VERSINFO`) gates this path since `exec {var}>>` automatic fd allocation requires bash 4.1+.

2. **Node fallback:** When `flock` is absent or bash < 4.1, `node -e "require('fs').appendFileSync(...)"` is used. `O_APPEND` on POSIX is atomic for writes under `PIPE_BUF` (~4KB), making this safe for concurrent small rows. No `lock_fallback` field added — this path is considered safe.

3. **Last-resort unlocked:** When neither `flock` nor `node` is available, `echo "$row" >> "$LOG_PATH"` runs with `lock_fallback:true` injected into the JSON row via `${row%\}},\"lock_fallback\":true}`. This provides an audit signal for degraded environments.

## Commits

| Hash | Message |
|------|---------|
| 4c71bb8 | fix(22-02/T1): SEC-02 fs flock concurrent-write guard on handoff-log |

## Verification Results

| Check | Result |
|-------|--------|
| `bash -n sgsd-stop-handoff.sh` | exit 0 |
| `bash sgsd-stop-handoff.sh --dry-run` | exit 0 |
| `grep -q 'flock' sgsd-stop-handoff.sh` | FOUND |
| `grep -q 'lock_fallback' sgsd-stop-handoff.sh` | FOUND |
| Backward compat (pre-Phase-22 rows without lock_fallback) | No schema break — field absent = locked path |

## Deviations from Plan

None — plan executed exactly as written. Implementation follows output_contract D-03 verbatim:
- fd-based exec {LOG_FD} pattern used (not subshell)
- lock_fallback field on path (4) only
- Node path has no lock_fallback field
- bash version guard added per implementation notes (exec {var}>> requires bash >= 4.1)

## Known Stubs

None.

## Threat Flags

None — this change closes a JSONL append race, introduces no new network endpoints, auth paths, or trust boundary surfaces.

## Self-Check: PASSED

- `super-gsd/scripts/sgsd-stop-handoff.sh` exists and contains flock guard
- Commit `4c71bb8` verified in git log
- bash -n and --dry-run both exit 0
