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
  patterns: [flock-fd-guard, node-secure-oappend-no-symlink, bash-version-guard]
key_files:
  modified:
    - super-gsd/scripts/sgsd-stop-handoff.sh
decisions:
  - "Use exec {LOG_FD}>>$LOG_LOCK_RAW fd-based locking (not subshell redirect) for clean lock/unlock lifecycle"
  - "bash >= 4.1 guard required before exec {var}>> auto-fd syntax"
  - "lock_fallback:true field is emitted only when flock is unavailable or times out and secure Node O_APPEND writes the row"
  - "No unlocked echo fallback remains; when secure append is unavailable, audit write is refused"
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

Extended `_log_row()` in `sgsd-stop-handoff.sh` with a secure locking/append chain:

1. **flock path (preferred):** `exec {LOG_FD}>>"$LOG_LOCK_RAW"` opens a sibling lock fd; `flock -x -w 5 $LOG_FD` acquires an exclusive 5-second-timeout lock; the row is then written via the secure append helper. `flock -u $LOG_FD` releases; `exec {LOG_FD}>&-` closes. A bash >= 4.1 version guard (`BASH_VERSINFO`) gates this path since `exec {var}>>` automatic fd allocation requires bash 4.1+.

2. **Secure Node fallback:** When `flock` is absent, bash < 4.1, or the lock times out, Node opens the log with `O_APPEND` plus `O_NOFOLLOW` where available after lstat-walking the raw `.planning`, `metrics`, and log components.

3. **No unsafe last resort:** When a secure append helper is unavailable, the script writes a stderr refusal and does not append to `handoff-log.jsonl`.

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
- lock_fallback field only when the flock lock was unavailable or timed out
- No unlocked echo append remains
- bash version guard added per implementation notes (exec {var}>> requires bash >= 4.1)

## Known Stubs

None.

## Threat Flags

None — this change closes a JSONL append race, introduces no new network endpoints, auth paths, or trust boundary surfaces.

## Self-Check: PASSED

- `super-gsd/scripts/sgsd-stop-handoff.sh` exists and contains flock guard
- Commit `4c71bb8` verified in git log
- bash -n and --dry-run both exit 0

## Round 7 Codex CRIT Fix

Round 6 Codex found a residual symlink-redirection surface: refusal rows and normal audit appends still used paths derived from `PLANNING_DIR_CANONICAL`, which is attacker-controlled when `.planning` itself is a symlink.

Fix applied:
- Symlink-component refusals are stderr-only; they do not write audit rows because no `.planning`-derived path is trustworthy at that point.
- Containment refusals are also stderr-only for the same reason.
- Raw paths are restored after canonical containment checks; canonical paths are used only for escape detection.
- `_log_row()` revalidates raw `.planning`, `metrics`, log, and lock components immediately before every audit append.
- The flock branch now locks a sibling lock file and writes the JSON row through a secure append helper when Node is available.

Verification:
- `bash -n super-gsd/scripts/sgsd-stop-handoff.sh` passed.
- Symlinked `.planning` exploit check passed: refused via stderr and wrote no attacker-target log.
- Symlinked `.planning/metrics` exploit check passed: refused via stderr and wrote no attacker-target log.
- Symlinked final `handoff-log.jsonl` exploit check passed: refused via stderr and did not write through the attacker-controlled log leaf.
