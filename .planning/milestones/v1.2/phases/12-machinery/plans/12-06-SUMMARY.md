---
phase: 12-machinery
plan: "06"
subsystem: installer-script
tags: [erg-02, known-top-level, bash-installer, idempotent, cross-repo]
requirements: [ERG-02]

dependency_graph:
  requires:
    - .planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml
    - C:/Users/user/.claude/get-shit-done/bin/lib/core.cjs (cross-repo target)
  provides:
    - super-gsd/scripts/patch-gsd-tools-known-keys.sh
    - super-gsd/README.md § Post-install section
  affects: []

tech_stack:
  added: []
  patterns:
    - Node-in-bash patcher (tmpfile approach avoids single-quote escaping in heredocs)
    - Idempotency via pre-check before mutation
    - .bak backup before in-place file edit

key_files:
  created:
    - super-gsd/scripts/patch-gsd-tools-known-keys.sh
    - .planning/phases/12-machinery/plans/12-06-SUMMARY.md
  modified:
    - super-gsd/README.md

decisions:
  - "Node-in-bash via tempfile (not inline -e string) to avoid bash single-quote escaping complexity"
  - "Dry-run does not write .bak — only live run writes backup before mutation"
  - "Cross-repo probe uses git rev-parse comparison to detect separate repos"

metrics:
  duration_minutes: 12
  completed_date: "2026-04-22"
  tasks_completed: 2
  files_changed: 3
---

# Phase 12 Plan 06: KNOWN_TOP_LEVEL Installer Script (ERG-02) Summary

**One-liner:** Idempotent bash installer patches cross-repo core.cjs KNOWN_TOP_LEVEL Set with 7 SGSD v2 config keys via Node-in-bash tmpfile patcher.

---

## ERG-02 Closure

**Status: CLOSED**

`super-gsd/scripts/patch-gsd-tools-known-keys.sh` ships as an operator-runnable
one-time installer that adds the 7 SGSD v2 top-level config keys to the
`KNOWN_TOP_LEVEL` Set in the installed `gsd-tools` binary's `core.cjs`. These keys
(`safety`, `model_routing`, `token_efficiency`, `deliberation`, `atc`,
`browser_verify`, `overwatcher`) are present in `.planning/config.json` but were
absent from `KNOWN_TOP_LEVEL`, causing "unknown config key" warnings on every
config-set invocation.

Phase 10's 10-03-04 task deferred this action because `core.cjs` lives in a separate
git repo — the executor cannot auto-commit there. This plan delivers the operator-side
tool that closes that deferral.

---

## Idempotency Contract (D-20)

- First run: detects keys absent → writes `.bak` → patches → post-verify → exits 0
- Second run: detects all 7 keys already present → emits `ALREADY_PATCHED` → exits 0
- `--dry-run`: reads file, shows PREVIEW diff, never writes anything → exits 0

Verified: `bash patch-gsd-tools-known-keys.sh --dry-run` exits 0 on this host, showing
the correct diff against the live `core.cjs` at line 326.

---

## Cross-Repo Context (10-03-01-cross-repo-probe.yaml = separate)

Per `.planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml`:
- `repo_status: separate`
- `core.cjs` is in `C:/Users/user/.claude` (a different git repo from GSDedits)

The script detects this at runtime via `git -C "$CORE_DIR" rev-parse --show-toplevel`
compared to the current repo root. When different, it prints:

```
NOTE: core.cjs lives in a separate git repo at C:/Users/user/.claude
      The patch will be applied but NOT auto-committed there.
      After this script completes, run:
        cd C:/Users/user/.claude && git add bin/lib/core.cjs && git commit ...
```

**Operator action required after running the script:** commit `bin/lib/core.cjs` in
the `~/.claude` repo. The README section added by this plan documents this step.

---

## Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Installer script | `super-gsd/scripts/patch-gsd-tools-known-keys.sh` | Created, executable |
| README section | `super-gsd/README.md` § "Post-install: patch gsd-tools KNOWN_TOP_LEVEL" | Added |

### Script invariants verified

| Check | Result |
|-------|--------|
| `test -x` | PASS |
| `bash -n` syntax | PASS |
| 7 keys grep-present | PASS (all 7) |
| `ANCHOR_NOT_FOUND` marker | PASS |
| `.bak` marker | PASS |
| `ALREADY_PATCHED` marker | PASS |
| `--dry-run` exits 0 | PASS (shows correct diff) |
| README `patch-gsd-tools-known-keys.sh` | PASS |
| README `KNOWN_TOP_LEVEL` | PASS |

---

## Commit SHAs

| Task | Description | Commit |
|------|-------------|--------|
| 12-06-01 | Create patch-gsd-tools-known-keys.sh | cb9e5ae |
| 12-06-02 | README section + SUMMARY | 9136add |

---

## Wave 1 Peers

This plan ran in Wave 1 alongside:
- **12-01** — MACH-01 classifier-cache (`super-gsd/scripts/lib/classifier-cache.cjs`)
- **12-05** — ERG-01 WR-01/02/03 fix-ups (`edge-guard.cjs`, `gates-registry.cjs`, SKILL.md)

All three Wave 1 plans have disjoint file sets (verified in 12-RESEARCH.md §D-23a):
12-06 creates a new `scripts/` entry with zero SKILL.md edits — no merge conflicts.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Node-in-bash quoting failure**

- **Found during:** Task 12-06-01 dry-run smoke test
- **Issue:** Original implementation used `node -e "$NODE_SCRIPT"` where `NODE_SCRIPT` was a single-quoted bash variable containing `'"'"'` escape sequences. When expanded by bash's `$()` substitution, the regex `['\"]` was misinterpreted, causing a Node syntax error (`Expected ',', got ']'`).
- **Fix:** Rewrote to write the Node script to a `mktemp` temp file and invoke `node "$TMPSCRIPT"` instead of inline `-e`. This eliminates all shell-quoting interaction with the JS source.
- **Files modified:** `super-gsd/scripts/patch-gsd-tools-known-keys.sh`
- **Commit:** cb9e5ae (included in task commit, same file)

---

## Known Stubs

None.

---

## Self-Check: PASSED
