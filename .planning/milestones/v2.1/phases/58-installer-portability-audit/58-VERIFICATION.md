---
phase: 58
name: Installer Portability Audit
milestone: v2.1
type: verification
verified_at: 2026-04-29
verifier: gsd-executor (compressed-phase dispatch)
verdict: PASS
---

# Phase 58 Verification - Installer Portability Audit

## Verdict

**PASS** - 10 must-haves green, 0 deviations, 0 blockers, 0 CRITICAL,
0 HIGH, 0 MEDIUM, 0 LOW deferred. v2.1 first-gate green (12/12
self-test PASS + 12 probes >= 9 + mandatory_floor_met=true). v1.9
dual-gate + v2.0 sept-gate exit 0 unchanged (no regression).

## Must-haves

| # | Must-have                                                     | Result                                                       |
| - | ------------------------------------------------------------- | ------------------------------------------------------------ |
| 1 | audit.cjs --self-test exits 0 with 8-12/8-12 PASS green       | PASS - 12/12 PASS green sub-1s                               |
| 2 | audit.cjs --run reports >=9 dependency probes                 | PASS - 12 probes (mandatory_floor_met=true)                  |
| 3 | run-self-test.cjs delegates correctly via spawnSync           | PASS - exit 0 same 12/12 output                              |
| 4 | clean-room.sh runs end-to-end on tmpdir                       | PASS - 9 steps, 24s wall-clock, exit 0                       |
| 5 | clean-room.sh captures every prompt/manual step               | PASS - 3 prompt-tagged steps (byterover/claude/restart)      |
| 6 | INSTALLER-AUDIT.md includes probe results AND friction log    | PASS - sections 1, 2, 3 all present                          |
| 7 | sgsd-complete-milestone --milestone v2.1 first-gate green     | PASS - exit 0 + 'v2.1 first-gate (installer-audit) green'    |
| 8 | sgsd-complete-milestone --milestone v1.9 (no regression)      | PASS - exit 0 same dual-gate emission                        |
| 9 | sgsd-complete-milestone --milestone v2.0 (no regression)      | PASS - exit 0 same sept-gate emission (score=97 GREEN)       |
| 10| ASCII-only across all 4 changed files + clean-room.sh         | PASS - first_nonascii_idx=-1 on each (audit.cjs A7 verifies) |

## Frozen surfaces (Lock 11)

- `PROBE_NAMES`: 12-entry ordered array (Object.freeze). length >=9 floor met.
- `SOURCE_VALUES`: 3-entry ordered array (`'present'`, `'missing'`, `'optional'`).
- `REASON_NOTES`: 8-entry frozen vocabulary.
- `MANDATORY_PROBES`: 3-entry frozen array (`'node_version'`, `'npm'`, `'git'`).
- `NODE_FLOOR_MAJOR`: locked at 20.
- `SCHEMA_VERSION`: locked at 1.

## Self-test inventory (12 assertions)

1. `probe_names_min_9_and_frozen` - len=12 frozen=true
2. `every_probe_canonical_shape` - count=12 (all entries match {name, ok, version, source, note})
3. `get_probe_bad_name_degraded` - note=probe_internal_error_degraded (Lock 13)
4. `get_probe_non_string_degraded` - threw=false (Lock 13)
5. `node_version_present` - version=v22.22.2
6. `super_gsd_tree_detected` - path matches working tree
7. `ascii_only_source` - first_nonascii_idx=-1
8. `read_only_invariant` - hasWrite=false (zero fs mutation primitives in code-only scan)
9. `source_values_frozen_3_entries` - SOURCE_VALUES locked
10. `reason_notes_frozen_8_entries` - REASON_NOTES locked
11. `summary_shape_ok` - summary {total, present, missing, optional, mandatory_missing, mandatory_floor_met} canonical
12. `schema_version_locked` - SCHEMA_VERSION === 1

## Live invocation evidence

```
$ node super-gsd/tools/installer-audit/audit.cjs --self-test
... 12/12 PASS ... exit 0

$ node super-gsd/tools/installer-audit/audit.cjs --run
... audit_summary total=12 present=9 missing=0 optional=3 mandatory_floor_met=true ... exit 0

$ bash super-gsd/tools/installer-audit/clean-room.sh
... 9 steps (6 auto + 3 prompt) ... exit_code=0

$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1
... milestone_close_gate: v2.1 first-gate (installer-audit) green ... exit 0

$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9
... milestone_close_gate: v1.9 dual-gate (context-bench + redis-adapter) green ... exit 0

$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0
... milestone_close_gate: v2.0 sept-gate (... + release-readiness) green ... score=97 GREEN ... exit 0
```

## Lock invariants verified

| Lock | Invariant                                              | Verified by                                                          |
| ---- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| 4    | Phase 41-57 byte-untouched                             | sgsd-complete-milestone.cjs is the only Phase-N file modified; the v2.1 branch is added BEFORE the existing v1.9/v2.0 dispatch points (preserves byte-equality up to those insertion points); zero touches to context-bench/context-cache/failure-injection/chaos-restart/provider-circuit/scenario-suite/release-readiness trees |
| 11   | byte-equality on closed-vocab enums                    | SOURCE_VALUES + REASON_NOTES + MANDATORY_PROBES + PROBE_NAMES all Object.freeze; self-test A1 + A9 + A10 |
| 13   | never throws upward                                    | self-test A3 (bad name) + A4 (non-string); every probe + public API try/catch wrapped; spawnSync timeout + .error catch; require.resolve() in try/catch for better-sqlite3 |
| ASCII| first_nonascii_idx === -1 across all 4 changed files   | self-test A7; manual scan of clean-room.sh (no smart quotes / em-dash / emoji) |
| READ-ONLY | audit.cjs zero fs mutation primitives             | self-test A8 (code-only scan for fs.write/append/unlink/mkdir/rm/rmdir tokens); hasWrite=false |
| TMPDIR-CONFINED | clean-room.sh mutations confined to mktemp  | rm -rf cleanup gated on `*/sgsd-cleanroom-*` signature-prefix; trap EXIT INT TERM |

## Acceptance against 58-CONTEXT.md

| # | Acceptance                                                  | Met |
| - | ----------------------------------------------------------- | --- |
| 1 | Audit reports >=9 dependency probes                         | YES (12 shipped) |
| 2 | Clean-room test runs end-to-end on a temp dir; captures every prompt / manual step | YES (9 steps; 6 auto + 3 prompt; exit 0) |
| 3 | INSTALLER-AUDIT.md includes both probe results AND clean-room friction log | YES (sections 1 + 2 + 3) |

## Deferred items (none)

No CRITICAL, HIGH, MEDIUM, or LOW items deferred. Phase 58 closes clean
with a 0-debt outcome. Phase 59 inherits the audit and friction log as
input artifacts (no carry-forward defects).
