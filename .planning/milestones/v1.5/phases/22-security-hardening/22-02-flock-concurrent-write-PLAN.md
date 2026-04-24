---
schema_version: 2
expected_ATC_tier: LITE
depends_on: ["22-01"]
tasks:
  - id: "22-02-T1"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-stop-handoff.sh
    input_contract: >
      super-gsd/scripts/sgsd-stop-handoff.sh as modified by 22-01-T1 (canonicalize_path
      helper present; _log_row() at lines ~82-96 appends via echo "$row" >> "$LOG_PATH");
      22-CONTEXT.md D-03 (flock -x -w 5 primary; Node O_EXLOCK fallback; unlocked
      last-resort with audit-row lock_fallback: true);
      22-CONTEXT.md D-04 (lock_fallback field only present in row when lock could not
      be acquired; no schema break);
      22-CONTEXT.md D-06 (backward-compat: pre-Phase-22 rows without lock_fallback parse fine).
    output_contract: >
      super-gsd/scripts/sgsd-stop-handoff.sh modified:
      _log_row() body replaced with flock-wrapped append per D-03:
      (1) open LOG_FD via exec {LOG_FD}>>"$LOG_PATH";
      (2) if flock available: flock -x -w 5 $LOG_FD, echo "$row" >&$LOG_FD, flock -u $LOG_FD;
      (3) elif node available: node -e appendFileSync fallback (no lock_fallback field needed
      — Node appendFileSync is atomic on POSIX for small writes);
      (4) else: echo "$row" >> "$LOG_PATH" + lock_fallback: true appended to row JSON.
      exec {LOG_FD}>&- always runs to close fd.
      lock_fallback field: injected into the row JSON string only on path (4).
      bash -n exits 0; --dry-run exits 0; simulated concurrent writes (two subshells
      appending simultaneously) produce valid JSONL with no truncated lines.
    hypothesis: >
      Wrapping the _log_row append in flock -x -w 5 on an fd opened against $LOG_PATH
      serialises concurrent Stop hook invocations (two claude sessions stopping near-
      simultaneously) at the OS level, eliminating the race on the JSONL append without
      any change to callers of _log_row().
    falsifier: >
      bash -n super-gsd/scripts/sgsd-stop-handoff.sh exits non-zero, OR
      bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run exits non-zero, OR
      grep does not find 'flock' in _log_row body, OR
      concurrent-write test (two subshells, same LOG_PATH) produces a truncated/merged
      JSONL line (detectable via node -e JSON.parse on each line).
    stop_rule: >
      bash -n super-gsd/scripts/sgsd-stop-handoff.sh exits 0;
      bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run exits 0;
      grep -q 'flock' super-gsd/scripts/sgsd-stop-handoff.sh exits 0;
      concurrent-write smoke test: for i in 1 2 3 4 5; do (bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run &); done; wait; all lines in LOG_PATH valid JSON.
    verification_cmd: "bash -n super-gsd/scripts/sgsd-stop-handoff.sh && bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run"
---

## Implementation Notes

**_log_row() replacement body (per D-03, verbatim from 22-CONTEXT.md):**

```bash
_log_row() {
  local reason="$1"
  local chain_depth="${2:-0}"
  local extra="${3:-}"
  local ts from_session row

  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
  from_session="pid-$$"

  mkdir -p "$LOG_DIR"
  row="{\"ts\":\"$ts\",\"from_session_id\":\"$from_session\",\"to_session_id\":null,\"reason\":\"$reason\",\"chain_depth\":$chain_depth,\"checkpoint_path\":\"$CHECKPOINT\"${extra}}"

  local LOG_FD
  exec {LOG_FD}>>"$LOG_PATH"
  if command -v flock >/dev/null 2>&1; then
    flock -x -w 5 "$LOG_FD"
    echo "$row" >&$LOG_FD
    flock -u "$LOG_FD"
  else
    # Fallback: Node fs.appendFileSync (atomic for small POSIX writes)
    node -e "require('fs').appendFileSync('$LOG_PATH', process.argv[1]+String.fromCharCode(10))" "$row" 2>/dev/null \
      || echo "$row" >> "$LOG_PATH"  # last-resort unlocked
  fi
  exec {LOG_FD}>&-
}
```

**lock_fallback field:** Only present when the unlocked last-resort path executes.
Inject by replacing the last-resort echo line with a row mutation:

```bash
    local lock_fallback_row="${row%\}},\"lock_fallback\":true}"
    echo "$lock_fallback_row" >> "$LOG_PATH"
```

**exec {LOG_FD} portability:** bash ≥ 4.1 supports `exec {var}>>file` automatic fd
allocation. All target platforms (Linux/Mac/WSL with bash ≥ 4.1) support this.
Add guard: if bash < 4.1, fall through to Node/last-resort path (same as flock-absent).

**Commit:** `fix(22-02/T1): SEC-02 fs flock concurrent-write guard on handoff-log`
