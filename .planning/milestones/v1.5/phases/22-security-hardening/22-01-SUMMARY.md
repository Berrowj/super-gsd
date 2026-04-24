---
phase: 22
plan: "01"
subsystem: security
tags: [sec-01, symlink, canonicalize, handoff]
dependency_graph:
  requires: []
  provides: [symlink-hardened-handoff-paths]
  affects: [super-gsd/scripts/sgsd-stop-handoff.sh]
tech_stack:
  added: []
  patterns: [readlink-f-realpath-fallback, module-scope-flag, audit-field-in-jsonl]
key_files:
  created: []
  modified:
    - super-gsd/scripts/sgsd-stop-handoff.sh
decisions:
  - "Used module-scope _CANON_RESOLVED flag (set false on fallback) rather than subshell exit-code to track canonicalize success — simpler and avoids subshell variable-leak issues."
  - "canonicalize_path() placed after _detect_root() and before PROJECT_DIR= so helper is defined before path variables are set."
metrics:
  duration: "~5 minutes"
  completed: "2026-04-24T21:12:03Z"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 22 Plan 01: SEC-01 Symlink Canonicalize Summary

**One-liner:** `canonicalize_path()` helper (readlink -f -> realpath -> raw fallback) wraps the three handoff paths at assignment time, plus `canonical_path_resolved` audit field in every log row.

## What Was Built

Added symlink-attack hardening to `sgsd-stop-handoff.sh` per SEC-01:

1. `canonicalize_path()` function (lines 52-75) — 3-tier fallback: `readlink -f` primary, `realpath` secondary, raw echo last-resort. Sets module-scope `_CANON_RESOLVED=false` only when neither canonicalizer is on PATH.

2. Three canonicalize calls immediately after `$LOG_PATH`, `$CHECKPOINT`, `$ABORT_FILE` assignment (lines 90-93) — all downstream `[[ -f ]]`, `grep`, and Node reads operate on resolved paths.

3. `canonical_path_resolved` boolean field appended to every `_log_row()` JSON row (line 124) — value is `true` when readlink/realpath ran, `false` when fell through to bare echo.

## Verification

- `bash -n super-gsd/scripts/sgsd-stop-handoff.sh` — exit 0
- `bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run` — exit 0
- `grep -q 'canonicalize_path'` — exit 0
- `grep -q 'canonical_path_resolved'` — exit 0

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| T1   | 908151c | fix(22-01/T1): SEC-01 symlink canonicalize on handoff paths + audit field |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — this plan closes a threat surface rather than opening one.

## Self-Check: PASSED

- `super-gsd/scripts/sgsd-stop-handoff.sh` — FOUND (modified)
- Commit 908151c — FOUND
