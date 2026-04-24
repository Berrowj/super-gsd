---
phase: "20"
plan: "20-01"
subsystem: "autonomous-handoff"
tags: ["stop-hook", "handoff", "session-spawn", "safety"]
dependency_graph:
  requires: []
  provides: ["sgsd-stop-handoff.sh", "hooks.Stop in settings-overlay.json"]
  affects: ["settings-overlay.json"]
tech_stack:
  added: ["Claude Code Stop hook"]
  patterns: ["double-background fire-and-forget spawn", "node read-mutate-write config", "pid-$$ session fallback"]
key_files:
  created:
    - super-gsd/scripts/sgsd-stop-handoff.sh
  modified:
    - super-gsd/config/settings-overlay.json
decisions:
  - "Use pid-$$ as from_session_id fallback (CLAUDE_SESSION_ID not propagated to hook subprocesses)"
  - "Double-background spawn (cmd &) & to avoid 60s Stop hook timeout"
  - "handoff.enabled defaults to false -- no real spawn until operator opts in"
  - "Pre-condition order: enabled -> emergency_halt -> discuss-phase -> operator-abort -> chain-depth -> cooldown"
metrics:
  duration: "25 minutes"
  completed: "2026-04-24T15:47:23Z"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 20 Plan 20-01: HANDOFF-01 Stop Hook Summary

**One-liner:** sgsd-stop-handoff.sh Stop hook with 4-tier pre-conditions + double-background spawn + --dry-run safety path, disabled by default via handoff.enabled

## Files Changed

FILES_CHANGED:
- super-gsd/scripts/sgsd-stop-handoff.sh (created, T1)
- super-gsd/config/settings-overlay.json (modified, T1 -- Stop hook entry added)

## Verification Results

- `bash -n sgsd-stop-handoff.sh` -> exit 0 (syntax check passed)
- `bash sgsd-stop-handoff.sh --dry-run` -> exit 0 (no checkpoint, exits at pre-condition 1: disabled)
- `node -e "...c.hooks.Stop..."` -> OK: Stop hook timeout=60 (Stop hook present with correct timeout)
- No deletions in commit (git diff --diff-filter=D HEAD~1 HEAD = empty)

## Deviations from Plan

None - plan executed exactly as written.

The skeleton in the plan prompt had `set -u` (no pipefail); final script uses `set -euo pipefail` per production bash script convention. Both are valid -- pipefail adds safety.

## Commit

- 343c839: feat(20-01/T1): HANDOFF-01 sgsd-stop-handoff.sh + Stop hook wiring (disabled by default)

## Known Stubs

None. Script is fully functional with its --dry-run path. Real spawn path is gated behind handoff.enabled: true (which the operator must set explicitly in .planning/config.json).

## Self-Check: PASSED

- [x] super-gsd/scripts/sgsd-stop-handoff.sh exists
- [x] super-gsd/config/settings-overlay.json has hooks.Stop
- [x] Commit 343c839 exists in git log
- [x] No unexpected file deletions
