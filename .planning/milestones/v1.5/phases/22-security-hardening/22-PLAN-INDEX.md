# Phase 22: Security Hardening — Plan Index

**Milestone:** v1.5 VTP Knowledge Primacy + Post-v1.4 Hardening
**Phase:** 22-security-hardening
**Requirements covered:** SEC-01, SEC-02
**Schema:** v2 (tasks[] array, SCHEMA-02 required fields)

---

## Wave Structure

```
Wave 1:
  22-01  SEC-01 symlink canonicalize (no deps)

Wave 2 (sequential — same file):
  22-02  SEC-02 fs flock concurrent-write guard (depends_on: ["22-01"])
```

Both plans touch only `super-gsd/scripts/sgsd-stop-handoff.sh`. 22-02 must follow
22-01 to avoid merge conflict on the `_log_row()` function body.

## Plan Summary

| Plan | File | Requirements | Tasks | Depends On | Key Output |
|------|------|-------------|-------|------------|------------|
| 22-01 | 22-01-symlink-canonicalize-PLAN.md | SEC-01 | T1 | — | canonicalize_path() helper + path reassignment + canonical_path_resolved audit field |
| 22-02 | 22-02-flock-concurrent-write-PLAN.md | SEC-02 | T1 | 22-01 | flock-wrapped _log_row() + Node fallback + lock_fallback audit field |

## Dependency Graph

```
22-01 (no deps)
  |
  +---> 22-02 (same file, _log_row() section)
```

## Source Audit

| Source | Item | Plan | Status |
|--------|------|------|--------|
| GOAL | Close 2 Codex-acknowledged security surfaces from Phase 20 Round 5 | 22-01 + 22-02 | COVERED |
| SEC-01 | Symlink canonicalize on $LOG_PATH / $CHECKPOINT / $ABORT_FILE | 22-01 | COVERED |
| SEC-02 | fs flock concurrent-write guard on handoff-log.jsonl | 22-02 | COVERED |
| CONTEXT D-01 | 2 plans, one per REQ | 22-01 + 22-02 | COVERED |
| CONTEXT D-02 | readlink -f primary, realpath fallback, raw-path last-resort | 22-01-T1 | COVERED |
| CONTEXT D-03 | flock -x -w 5 primary, Node O_EXLOCK fallback, unlocked last-resort | 22-02-T1 | COVERED |
| CONTEXT D-04 | canonical_path_resolved + lock_fallback audit-row fields | 22-01-T1 + 22-02-T1 | COVERED |
| CONTEXT D-05 | Dry-run path tests each guard's graceful-fallback | 22-01-T1 + 22-02-T1 | COVERED (--dry-run verify) |
| CONTEXT D-06 | Backward-compat with pre-Phase-22 handoff-log rows | 22-01-T1 + 22-02-T1 | COVERED (extra fields only, no schema break) |

Deferred (not gaps): cross-platform symlink semantics beyond Linux/Mac/WSL,
formal security audit, symlink hardening on edge-guard-log / commit-reviews.jsonl.

## Validation Commands

```bash
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/22-security-hardening/22-01-symlink-canonicalize-PLAN.md --mode load
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/22-security-hardening/22-02-flock-concurrent-write-PLAN.md --mode load
```
