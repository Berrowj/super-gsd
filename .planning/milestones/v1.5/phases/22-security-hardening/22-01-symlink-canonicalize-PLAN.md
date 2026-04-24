---
schema_version: 2
expected_ATC_tier: LITE
depends_on: []
tasks:
  - id: "22-01-T1"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-stop-handoff.sh
    input_contract: >
      super-gsd/scripts/sgsd-stop-handoff.sh (existing script; $LOG_PATH, $CHECKPOINT,
      $ABORT_FILE are assigned at lines 60-63 before any file test/read);
      22-CONTEXT.md D-02 (readlink -f primary, realpath fallback, raw-path last-resort,
      audit-row canonical_path_resolved: true|false);
      22-CONTEXT.md D-04 (new JSON field canonical_path_resolved added to _log_row output,
      no schema break — existing consumers ignore unknown fields);
      22-CONTEXT.md D-06 (backward-compat: pre-Phase-22 log rows without field parse fine).
    output_contract: >
      super-gsd/scripts/sgsd-stop-handoff.sh modified:
      (1) canonicalize_path() helper function added immediately after the _detect_root()
      function block (before CONFIG_FILE assignment). Implements D-02 3-tier fallback:
      readlink -f -> realpath -> echo raw path.
      (2) $LOG_PATH, $CHECKPOINT, $ABORT_FILE each reassigned via canonicalize_path()
      immediately after their initial assignment block (lines ~60-63).
      (3) _log_row() extra field construction updated: canonical_path_resolved field
      appended as ",\"canonical_path_resolved\":true" unconditionally (path was resolved
      to canonical or best-effort; only false when neither readlink nor realpath available,
      detected via exit-code of canonicalize_path sub-shell).
      bash -n exits 0; --dry-run exits 0 and writes dry_run row containing
      canonical_path_resolved field.
    hypothesis: >
      Wrapping the three handoff path variables in a canonicalize_path() helper that
      chains readlink -f → realpath → echo immediately after assignment eliminates the
      symlink-attack surface without touching any conditional logic downstream, because
      all downstream [[ -f ]], grep, and node reads already operate on the variable names.
    falsifier: >
      bash -n super-gsd/scripts/sgsd-stop-handoff.sh exits non-zero, OR
      bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run exits non-zero, OR
      grep does not find 'canonicalize_path' function definition in the file, OR
      grep does not find 'canonical_path_resolved' string in _log_row construction.
    stop_rule: >
      bash -n super-gsd/scripts/sgsd-stop-handoff.sh exits 0;
      bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run exits 0;
      grep -q 'canonicalize_path' super-gsd/scripts/sgsd-stop-handoff.sh exits 0;
      grep -q 'canonical_path_resolved' super-gsd/scripts/sgsd-stop-handoff.sh exits 0.
    verification_cmd: "bash -n super-gsd/scripts/sgsd-stop-handoff.sh && bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run"
---

## Implementation Notes

**Insertion point for canonicalize_path():** After `_detect_root()` closes (line ~50), before
`PROJECT_DIR=` assignment. This ensures the helper is defined before the path variables
are assigned and immediately re-canonicalized.

**Exact canonicalize_path body (per D-02, verbatim from 22-CONTEXT.md):**

```bash
canonicalize_path() {
  local p="$1"
  if command -v readlink >/dev/null 2>&1; then
    readlink -f "$p" 2>/dev/null || realpath "$p" 2>/dev/null || echo "$p"
  elif command -v realpath >/dev/null 2>&1; then
    realpath "$p" 2>/dev/null || echo "$p"
  else
    echo "$p"
  fi
}
```

**Path reassignment block (insert after lines ~60-63):**

```bash
LOG_PATH="$(canonicalize_path "$LOG_PATH")"
CHECKPOINT="$(canonicalize_path "$CHECKPOINT")"
ABORT_FILE="$(canonicalize_path "$ABORT_FILE")"
```

**canonical_path_resolved field:** Add to the `row=` construction in `_log_row()` as a
trailing field in the `${extra}` position OR directly in the row JSON string. Value is
`true` when readlink or realpath resolved the path (i.e., the function did not fall
through to bare `echo "$p"`). Implement by having canonicalize_path emit a side-channel
exit code: exit 0 if resolved, exit 1 if fell through — caller sets flag accordingly.
Alternatively (simpler): always emit `canonical_path_resolved: true` since the helper
always returns *something*; only emit `false` when neither readlink nor realpath is
on PATH (detectable via `command -v` checks in the helper). Executor uses simplest
correct implementation consistent with D-04.

**Commit:** `fix(22-01/T1): SEC-01 symlink canonicalize on handoff paths`
