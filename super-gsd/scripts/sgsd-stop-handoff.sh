#!/usr/bin/env bash
# sgsd-stop-handoff.sh -- Claude Code Stop hook for autonomous session handoff
# Fires on every session stop. Spawns fresh claude session if checkpoint signals
# emergency_halt and all safety pre-conditions pass.
# Usage: sgsd-stop-handoff.sh [--dry-run]
#
# Pre-conditions (evaluated in order):
#   1. config.json handoff.enabled == true   (default: false -- safe by default)
#   2a. .planning/ORCHESTRATOR-CHECKPOINT.md exists with emergency_halt: true
#       OR
#   2b. handoff.recover_unexpected_auto_stop == true AND latest
#       orchestrator-pulse row is fresh (model stopped without a checkpoint)
#   3. phase_state != "discussing" (discuss-phase is interactive, must not auto-resume)
#   4a. .planning/STOP-HANDOFF abort file absent
#   4b. chain_depth < max_chain_depth
#   4c. cooldown elapsed since last handoff row in handoff-log.jsonl
#
# Spawn command (if all pass):
#   (claude --print --dangerously-skip-permissions "/sgsd-orchestrate go" >/dev/null 2>&1 &) &
# Double-background: parent exits immediately, no 60s Stop hook timeout risk.
#
# Dry-run flag (--dry-run):
#   Walks all pre-conditions, writes "dry_run" row to handoff-log.jsonl, prints
#   would-spawn message to stderr. Does NOT invoke claude CLI.

set -euo pipefail

DRY_RUN=0
while [[ $# -gt 0 ]]; do
    case "${1:-}" in
        --dry-run) DRY_RUN=1; shift ;;
        --help|-h)
            head -30 "$0" | tail -25
            exit 0
            ;;
        *) echo "sgsd-stop-handoff: unknown flag $1" >&2; exit 1 ;;
    esac
done

# Resolve project root: cwd when Stop hook fires is the project directory.
# Walk up to find .planning/ directory.
_detect_root() {
    local d
    d="$(pwd -P 2>/dev/null || pwd)"
    while [[ -n "$d" && "$d" != "/" ]]; do
        if [[ -d "$d/.planning" ]]; then
            echo "$d"
            return 0
        fi
        d="$(dirname "$d")"
    done
    return 1
}

# SEC-01: canonicalize_path resolves symlinks via readlink -f with fallbacks.
# Returns raw path if no canonicalizer available (defense-in-depth, not crash).
# Sets module-scope _CANON_RESOLVED=true when readlink/realpath ran successfully,
# false when canonicalization fell back to the raw path (audit metadata).
_CANON_RESOLVED=true
canonicalize_path() {
  local p="$1"
  [[ -z "$p" ]] && { echo ""; return; }
  if command -v readlink >/dev/null 2>&1; then
    local result
    result=$(readlink -f "$p" 2>/dev/null) \
      || result=$(realpath "$p" 2>/dev/null) \
      || { _CANON_RESOLVED=false; echo "$p"; return; }
    echo "$result"
  elif command -v realpath >/dev/null 2>&1; then
    local result
    result=$(realpath "$p" 2>/dev/null) \
      || { _CANON_RESOLVED=false; echo "$p"; return; }
    echo "$result"
  else
    _CANON_RESOLVED=false
    echo "$p"
  fi
}

# SEC-01 Round 7: lstat-walk every existing component of a raw path before
# canonicalization. Refusals are stderr-only because when .planning or metrics
# is a symlink, every .planning-derived audit path is already untrusted.
_path_has_no_symlink_components() {
    local target="$1"
    if command -v node >/dev/null 2>&1; then
        node -e "
            const fs = require('fs');
            const path = require('path');
            const target = process.argv[1];
            try {
                const abs = path.resolve(target);
                const parts = abs.split(path.sep).filter(Boolean);
                let cur = path.isAbsolute(abs) ? path.parse(abs).root : '';
                for (const p of parts) {
                    cur = path.join(cur, p);
                    let st;
                    try { st = fs.lstatSync(cur); } catch (_) { break; }
                    if (st.isSymbolicLink()) {
                        process.stderr.write('SYMLINK_COMPONENT:' + cur + '\n');
                        process.exit(1);
                    }
                }
                process.exit(0);
            } catch (_) {
                process.exit(1);
            }
        " "$target" >/dev/null
        return $?
    fi

    local abs cur part
    case "$target" in
        /*) abs="$target" ;;
        *) abs="$(pwd -P 2>/dev/null || pwd)/$target" ;;
    esac

    cur=""
    IFS='/' read -r -a __sgsd_parts <<< "$abs"
    for part in "${__sgsd_parts[@]}"; do
        [[ -z "$part" || "$part" == "." ]] && continue
        if [[ "$part" == ".." ]]; then
            cur="$(dirname "$cur")"
            [[ "$cur" == "." ]] && cur=""
            continue
        fi
        cur="$cur/$part"
        if [[ -L "$cur" ]]; then
            echo "SYMLINK_COMPONENT:$cur" >&2
            return 1
        fi
        if [[ ! -e "$cur" ]]; then
            break
        fi
    done
    return 0
}

_assert_no_symlink_components() {
    local target="$1"
    local label="$2"
    if _path_has_no_symlink_components "$target"; then
        return 0
    fi
    local ts
    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
    echo "sgsd-stop-handoff: SYMLINK COMPONENT detected on $label path ('$target') at $ts. Refusing handoff. No audit row written because path trust is compromised." >&2
    exit 0
}

PROJECT_DIR="$(_detect_root || true)"
if [[ -z "$PROJECT_DIR" ]]; then
    # No .planning directory found -- not a GSD project, silently exit
    exit 0
fi

PLANNING_DIR_RAW="$PROJECT_DIR/.planning"
CONFIG_FILE_RAW="$PLANNING_DIR_RAW/config.json"
CHECKPOINT_RAW="$PLANNING_DIR_RAW/ORCHESTRATOR-CHECKPOINT.md"
LOG_DIR_RAW="$PLANNING_DIR_RAW/metrics"
LOG_PATH_RAW="$LOG_DIR_RAW/handoff-log.jsonl"
LOG_LOCK_RAW="$LOG_DIR_RAW/handoff-log.lock"
ABORT_FILE_RAW="$PLANNING_DIR_RAW/STOP-HANDOFF"

PLANNING_DIR="$PLANNING_DIR_RAW"
CONFIG_FILE="$CONFIG_FILE_RAW"
CHECKPOINT="$CHECKPOINT_RAW"
LOG_DIR="$LOG_DIR_RAW"
LOG_PATH="$LOG_PATH_RAW"
ABORT_FILE="$ABORT_FILE_RAW"

# SEC-01 round 5 strict validation: lstat-walk every component of every raw
# handoff path BEFORE canonicalization or any read. Catches intermediate-
# component symlink attacks (e.g. .planning itself, or metrics being a
# symlink to /etc/cron.d/) that O_NOFOLLOW + canonicalize+contain alone
# cannot detect. Must be PRE-canonicalize because canonicalization resolves
# the very symlinks we're trying to detect.
_assert_no_symlink_components "$PLANNING_DIR" "PLANNING_DIR"
_assert_no_symlink_components "$CONFIG_FILE" "CONFIG_FILE"
_assert_no_symlink_components "$LOG_DIR" "LOG_DIR"
_assert_no_symlink_components "$LOG_PATH" "LOG_PATH"
_assert_no_symlink_components "$LOG_LOCK_RAW" "LOG_LOCK"
_assert_no_symlink_components "$CHECKPOINT" "CHECKPOINT"
_assert_no_symlink_components "$ABORT_FILE" "ABORT_FILE"

# PLANNING_DIR_CANONICAL is retained only for containment checks; refusal paths
# must not write to paths derived from it.
PLANNING_DIR_CANONICAL="$(canonicalize_path "$PLANNING_DIR")"

# Canonicalize all handoff paths (SEC-01 symlink-attack hardening) — second
# layer after lstat-walk. Containment check below gates final write target.
LOG_DIR="$(canonicalize_path "$LOG_DIR")"
LOG_PATH="$(canonicalize_path "$LOG_PATH")"
CHECKPOINT="$(canonicalize_path "$CHECKPOINT")"
ABORT_FILE="$(canonicalize_path "$ABORT_FILE")"

# SEC-01 containment assertion: canonicalized targets are used only to detect
# escapes. Refusals are stderr-only; no audit path is safe once containment
# has failed.
_assert_contained() {
    local target="$1"
    local label="$2"
    case "$target" in
        "$PLANNING_DIR_CANONICAL"/*|"$PLANNING_DIR_CANONICAL") return 0 ;;
        *)
            local ts
            ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
            echo "sgsd-stop-handoff: SYMLINK ESCAPE detected on $label ('$target' not under '$PLANNING_DIR_CANONICAL') at $ts. Refusing handoff. No audit row written because path trust is compromised." >&2
            exit 0
            ;;
    esac
}
_assert_contained "$LOG_DIR" "LOG_DIR"
_assert_contained "$LOG_PATH" "LOG_PATH"
_assert_contained "$CHECKPOINT" "CHECKPOINT"
_assert_contained "$ABORT_FILE" "ABORT_FILE"

# Use raw, prevalidated project paths for all later reads/writes. The canonical
# values above are only for escape detection. Writing to PLANNING_DIR_CANONICAL
# would be unsafe if .planning was the original symlink attack vector.
LOG_DIR_CANONICAL="$LOG_DIR"
LOG_PATH_CANONICAL="$LOG_PATH"
CHECKPOINT_CANONICAL="$CHECKPOINT"
ABORT_FILE_CANONICAL="$ABORT_FILE"
CONFIG_FILE="$CONFIG_FILE_RAW"
LOG_DIR="$LOG_DIR_RAW"
LOG_PATH="$LOG_PATH_RAW"
CHECKPOINT="$CHECKPOINT_RAW"
ABORT_FILE="$ABORT_FILE_RAW"

# --- Read config (all optional; hard defaults apply if block absent) ---
ENABLED="false"
MIN_COOLDOWN=30
MAX_CHAIN_DEPTH=5
RECOVER_UNEXPECTED_AUTO_STOP="true"
UNEXPECTED_STOP_MAX_PULSE_AGE=900

if [[ -f "$CONFIG_FILE" ]]; then
    _enabled=$(node -e "try{var c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));var v=c.handoff&&c.handoff.enabled!=null?c.handoff.enabled:false;console.log(String(v))}catch(e){console.log('false')}" "$CONFIG_FILE" 2>/dev/null || echo "false")
    ENABLED="$_enabled"

    _cool=$(node -e "try{var c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));var v=c.handoff&&c.handoff.min_cooldown_seconds!=null?c.handoff.min_cooldown_seconds:30;console.log(Number(v))}catch(e){console.log(30)}" "$CONFIG_FILE" 2>/dev/null || echo "30")
    MIN_COOLDOWN="$_cool"

    _depth=$(node -e "try{var c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));var v=c.handoff&&c.handoff.max_chain_depth!=null?c.handoff.max_chain_depth:5;console.log(Number(v))}catch(e){console.log(5)}" "$CONFIG_FILE" 2>/dev/null || echo "5")
    MAX_CHAIN_DEPTH="$_depth"

    _recover=$(node -e "try{var c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));var v=c.handoff&&c.handoff.recover_unexpected_auto_stop!=null?c.handoff.recover_unexpected_auto_stop:true;console.log(String(v))}catch(e){console.log('true')}" "$CONFIG_FILE" 2>/dev/null || echo "true")
    RECOVER_UNEXPECTED_AUTO_STOP="$_recover"

    _pulse_age=$(node -e "try{var c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));var v=c.handoff&&c.handoff.unexpected_stop_max_pulse_age_seconds!=null?c.handoff.unexpected_stop_max_pulse_age_seconds:900;console.log(Number(v))}catch(e){console.log(900)}" "$CONFIG_FILE" 2>/dev/null || echo "900")
    UNEXPECTED_STOP_MAX_PULSE_AGE="$_pulse_age"
fi

# --- Helper: append JSON row to handoff-log.jsonl ---
_node_append_no_symlink() {
    local path="$1"
    local row="$2"
    command -v node >/dev/null 2>&1 || return 1
    node -e "
      const fs = require('fs');
      const path = require('path');
      const target = process.argv[1];
      const row = process.argv[2] + '\n';
      function assertNoSymlink(p) {
        const abs = path.resolve(p);
        const parts = abs.split(path.sep).filter(Boolean);
        let cur = path.isAbsolute(abs) ? path.parse(abs).root : '';
        for (const part of parts) {
          cur = path.join(cur, part);
          try {
            const st = fs.lstatSync(cur);
            if (st.isSymbolicLink()) process.exit(11);
          } catch (_) {
            break;
          }
        }
      }
      const dir = path.dirname(target);
      assertNoSymlink(dir);
      fs.mkdirSync(dir, { recursive: true });
      assertNoSymlink(dir);
      assertNoSymlink(target);
      const nofollow = fs.constants.O_NOFOLLOW || 0;
      const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | nofollow;
      const fd = fs.openSync(target, flags, 0o600);
      try { fs.writeSync(fd, row); } finally { fs.closeSync(fd); }
    " "$path" "$row" 2>/dev/null
}

# SEC-02: flock-guarded append to serialise concurrent Stop hook invocations.
# Fallback chain: flock (preferred) plus secure Node O_APPEND write; on lock
# timeout/unavailable, secure Node O_APPEND write with lock_fallback:true. If
# no secure append helper exists, refuse the audit write rather than echoing
# through a potentially redirected path.
_log_row() {
    local reason="$1"
    local chain_depth="${2:-0}"
    local extra="${3:-}"
    local ts from_session row

    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
    # CLAUDE_SESSION_ID is NOT propagated to hook subprocesses (RESEARCH V2).
    # Use PID as fallback -- unique per Stop hook invocation.
    from_session="pid-$$"

    # Revalidate raw path components immediately before every audit append.
    # This prevents normal rows from writing through a canonicalized symlink
    # target and catches later swaps of .planning / metrics / log leaf.
    _assert_no_symlink_components "$PLANNING_DIR_RAW" "PLANNING_DIR"
    _assert_no_symlink_components "$LOG_DIR_RAW" "LOG_DIR"
    mkdir -p "$LOG_DIR_RAW"
    _assert_no_symlink_components "$LOG_DIR_RAW" "LOG_DIR"
    _assert_no_symlink_components "$LOG_PATH_RAW" "LOG_PATH"
    _assert_no_symlink_components "$LOG_LOCK_RAW" "LOG_LOCK"
    LOG_DIR="$LOG_DIR_RAW"
    LOG_PATH="$LOG_PATH_RAW"
    # CRIT-fix: row construction now deferred until we know lock outcome, so
    # lock_fallback field accurately reflects whether the write was synchronized.
    # Prefix carries all fields except the final lock_fallback boolean.
    local row_prefix="{\"ts\":\"$ts\",\"from_session_id\":\"$from_session\",\"to_session_id\":null,\"reason\":\"$reason\",\"chain_depth\":$chain_depth,\"checkpoint_path\":\"$CHECKPOINT\",\"canonical_path_resolved\":${_CANON_RESOLVED}${extra}"

    # exec {var}>>file automatic fd allocation requires bash >= 4.1.
    # Guard: fall through to Node/last-resort on older bash.
    local bash_major bash_minor
    bash_major="${BASH_VERSINFO[0]:-0}"
    bash_minor="${BASH_VERSINFO[1]:-0}"

    if (( bash_major > 4 || ( bash_major == 4 && bash_minor >= 1 ) )) && command -v flock >/dev/null 2>&1; then
        # Preferred path: open fd, attempt 5s exclusive lock, write on success.
        # CRIT-fix: previously wrote unconditionally after flock failure via
        # `flock ... || true; echo row` — silent corruption surface. Now we
        # CHECK the flock exit code and only write in the acquired branch;
        # on fail we fall through to Node fallback with lock_fallback:true.
        local LOG_FD
        exec {LOG_FD}>>"$LOG_LOCK_RAW"
        if flock -x -w 5 "$LOG_FD" 2>/dev/null; then
            if ! command -v node >/dev/null 2>&1; then
                echo "sgsd-stop-handoff: secure audit append unavailable; refusing unsafe fallback write." >&2
            elif ! _node_append_no_symlink "$LOG_PATH" "${row_prefix},\"lock_fallback\":false}"; then
                echo "sgsd-stop-handoff: secure audit append failed while lock was held; refusing unsafe fallback write." >&2
            fi
            flock -u "$LOG_FD" 2>/dev/null || true
            exec {LOG_FD}>&-
            return 0
        fi
        exec {LOG_FD}>&-
        # Lock timeout — fall through to Node path with lock_fallback:true marker
        if command -v node >/dev/null 2>&1; then
            local row_fb="${row_prefix},\"lock_fallback\":true}"
            _node_append_no_symlink "$LOG_PATH" "$row_fb" || echo "sgsd-stop-handoff: secure audit append failed after lock timeout; refusing unsafe fallback write." >&2
        else
            echo "sgsd-stop-handoff: secure audit append failed; refusing unsafe fallback write." >&2
        fi
        return 0
    elif command -v node >/dev/null 2>&1; then
        # Fallback: secure Node O_APPEND append after lstat-walking path
        # components and using O_NOFOLLOW where available.
        local row_node="${row_prefix},\"lock_fallback\":false}"
        if ! _node_append_no_symlink "$LOG_PATH" "$row_node"; then
            # Node call itself failed — rebuild row with accurate lock_fallback:true
            echo "sgsd-stop-handoff: secure audit append failed; refusing unsafe fallback write." >&2
        fi
    else
        # Last-resort: no bash-fd / no flock / no node. Do not write.
        echo "sgsd-stop-handoff: secure audit append unavailable; refusing unsafe fallback write." >&2
    fi
}

# --- PRE-CONDITION 1: enabled check ---
# Default is false -- safe by default. No log noise when disabled.
if [[ "$ENABLED" != "true" ]]; then
    exit 0
fi

_should_recover_unexpected_auto_stop() {
    local pulse_file="$PLANNING_DIR_RAW/metrics/orchestrator-pulse.jsonl"
    local state_file="$PLANNING_DIR_RAW/STATE.md"
    local max_age="${1:-900}"

    [[ "$RECOVER_UNEXPECTED_AUTO_STOP" == "true" ]] || return 1
    [[ -f "$pulse_file" ]] || return 1
    [[ -f "$state_file" ]] || return 1
    [[ -f "$ABORT_FILE" ]] && return 1

    node -e "
      const fs = require('fs');
      const pulsePath = process.argv[1];
      const statePath = process.argv[2];
      const maxAge = Number(process.argv[3] || 900);
      function lastJson(path) {
        const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try { return JSON.parse(lines[i]); } catch (_) {}
        }
        return null;
      }
      try {
        const pulse = lastJson(pulsePath);
        if (!pulse || !pulse.ts) process.exit(1);
        const age = (Date.now() - Date.parse(pulse.ts)) / 1000;
        if (!Number.isFinite(age) || age < 0 || age > maxAge) process.exit(1);
        const state = fs.readFileSync(statePath, 'utf8');
        if (/roadmap_run:\s*[\s\S]*?completed:/m.test(state)) process.exit(1);
        if (/status:\s*(complete|completed|all phases complete)/i.test(state)) process.exit(1);
        process.exit(0);
      } catch (_) {
        process.exit(1);
      }
    " "$pulse_file" "$state_file" "$max_age" >/dev/null 2>&1
}

# --- PRE-CONDITION 2: checkpoint OR unexpected autopilot stop ---
UNEXPECTED_AUTO_STOP=0
if [[ ! -f "$CHECKPOINT" ]]; then
    if _should_recover_unexpected_auto_stop "$UNEXPECTED_STOP_MAX_PULSE_AGE"; then
        UNEXPECTED_AUTO_STOP=1
        EMERGENCY_HALT="true"
    else
        exit 0
    fi
fi

if [[ "$UNEXPECTED_AUTO_STOP" != "1" ]]; then
    EMERGENCY_HALT=$(grep -m1 "^emergency_halt:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]')
    if [[ "$EMERGENCY_HALT" != "true" ]]; then
        exit 0
    fi
fi

# --- PRE-CONDITION 3: discuss-phase guard ---
# If session stopped during /gsd-discuss-phase, handoff must refuse.
# Discuss-phase is interactive -- operator must resume manually.
PHASE_STATE=""
if [[ -f "$CHECKPOINT" ]]; then
    PHASE_STATE=$(grep -m1 "^phase_state:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]"')
fi
if [[ "$PHASE_STATE" == "discussing" ]]; then
    _log_row "refused" 0 ",\"refused\":\"discuss_phase_interactive\""
    exit 0
fi

# --- PRE-CONDITION 4a: operator-abort file (cheapest guard first) ---
if [[ -f "$ABORT_FILE" ]]; then
    _log_row "refused" 0 ",\"refused\":\"operator_abort\""
    exit 0
fi

# --- PRE-CONDITION 4b: chain depth check ---
# CRITICAL fix (Phase 20 ATC): chain_depth is NOT written to checkpoint by the
# orchestrator. Reading it from checkpoint always returned 0, so MAX_CHAIN_DEPTH
# never triggered. Correct source is handoff-log.jsonl spawn lineage: find the
# most recent row with reason=='spawned' and use its chain_depth + 1 as the
# proposed depth for this handoff. Refused/dry_run rows are IGNORED — they
# don't advance the chain. This also gives us a natural reset: when the last
# spawned row is older than cooldown (i.e. operator took over), the depth is
# still read as N+1, but the cooldown guard will refuse — the handoff never
# fires on operator-resumed sessions.
PREV_CHAIN_DEPTH=0
# Defensive guard (Codex 3rd re-review): if checkpoint signals emergency_halt
# AND the log FILE is missing but the log DIR exists, the log was likely
# deleted/tampered between halts. Treat as chain-integrity violation. Only
# truly-fresh state (no log dir at all, OR first-ever project run) gets the
# legitimate "start chain at 1" path.
if [[ ! -f "$LOG_PATH" ]] && [[ -d "$LOG_DIR" ]] && [[ "$EMERGENCY_HALT" == "true" ]]; then
    # Log dir exists but file is gone — suspicious. Look for ANY prior handoff
    # evidence (other files in log dir) to distinguish first-run from tampering.
    if find "$LOG_DIR" -maxdepth 1 -name "handoff-log.jsonl.*" -print -quit 2>/dev/null | grep -q .; then
        # Archived log exists somewhere but active log absent → tampered
        _log_row "refused" 0 ",\"refused\":\"log_tampered_active_missing\",\"log_dir\":\"$LOG_DIR\""
        exit 0
    fi
    # No log file, no archives — treat as first-run. Chain starts at 1.
fi
if [[ -f "$LOG_PATH" ]]; then
    # Defensive WARN fix (post-CRIT-fix re-review): a malformed spawned row in
    # handoff-log.jsonl could silently skip parse → filter → lineage, making the
    # last GOOD spawned row appear to be the most recent → PREV_CHAIN_DEPTH
    # undercount → MAX_CHAIN_DEPTH bypass. Mitigation: if ANY line in the log
    # fails to JSON.parse, emit sentinel 'MALFORMED' and refuse the handoff.
    # Operator must inspect + repair the log before handoff continues.
    PREV_CHAIN_DEPTH=$(node -e "
try {
  var lines = require('fs').readFileSync(process.argv[1],'utf8').split('\n').filter(Boolean);
  var malformed = false;
  var spawned = [];
  for (var i = 0; i < lines.length; i++) {
    try {
      var r = JSON.parse(lines[i]);
      if (r && r.reason === 'spawned') spawned.push(r);
    } catch (e) {
      malformed = true;
      break;
    }
  }
  if (malformed) {
    process.stdout.write('MALFORMED');
  } else {
    var last = spawned.length ? spawned[spawned.length-1] : null;
    var d = last && typeof last.chain_depth === 'number' ? last.chain_depth : 0;
    process.stdout.write(String(d));
  }
} catch (e) { process.stdout.write('READ_FAILED'); }
" "$LOG_PATH" 2>/dev/null || echo "READ_FAILED")
    # Fully fail-closed on any log-read failure — post-WARN-fix re-review
    # closed the per-line parse surface; this also closes the whole-log
    # read surface (e.g. ENOENT, ENOTDIR, permissions, Node absent).
    if [[ "$PREV_CHAIN_DEPTH" == "MALFORMED" ]]; then
        _log_row "refused" 0 ",\"refused\":\"malformed_log\",\"log_path\":\"$LOG_PATH\""
        exit 0
    fi
    if [[ "$PREV_CHAIN_DEPTH" == "READ_FAILED" ]]; then
        _log_row "refused" 0 ",\"refused\":\"log_read_failed\",\"log_path\":\"$LOG_PATH\""
        exit 0
    fi
    # Sanitize — non-numeric falls back to 0
    if ! [[ "$PREV_CHAIN_DEPTH" =~ ^[0-9]+$ ]]; then
        PREV_CHAIN_DEPTH=0
    fi
fi

# Proposed depth for THIS handoff is prior + 1. If it exceeds MAX, refuse.
CHAIN_DEPTH=$(( PREV_CHAIN_DEPTH + 1 ))

if (( CHAIN_DEPTH > MAX_CHAIN_DEPTH )); then
    _log_row "refused" "$CHAIN_DEPTH" ",\"refused\":\"max_chain_depth\",\"prev_depth\":$PREV_CHAIN_DEPTH"
    exit 0
fi

# --- PRE-CONDITION 4c: cooldown check ---
# Compare timestamp of last handoff-log row against current time.
if [[ -f "$LOG_PATH" ]]; then
    LAST_TS=$(tail -1 "$LOG_PATH" | node -e "
try {
    var lines = [];
    process.stdin.on('data', function(d){ lines.push(d); });
    process.stdin.on('end', function(){
        var r = JSON.parse(lines.join(''));
        console.log(r.ts || '');
    });
} catch(e){ console.log(''); }
" 2>/dev/null || echo "")

    if [[ -n "$LAST_TS" ]]; then
        NOW_EPOCH=$(date +%s 2>/dev/null || echo "0")
        # date -d works on Linux/WSL; gdate is macOS GNU fallback
        LAST_EPOCH=$(date -d "$LAST_TS" +%s 2>/dev/null || gdate -d "$LAST_TS" +%s 2>/dev/null || echo "0")
        ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
        if (( ELAPSED < MIN_COOLDOWN )); then
            _log_row "refused" "$CHAIN_DEPTH" ",\"refused\":\"cooldown\",\"elapsed_s\":$ELAPSED"
            exit 0
        fi
    fi
fi

# --- DRY RUN path ---
# Logs would-spawn row and prints to stderr. No claude CLI invocation.
if (( DRY_RUN )); then
    SPAWN_CMD="claude --print --dangerously-skip-permissions /sgsd-orchestrate go"
    _log_row "dry_run" "$CHAIN_DEPTH" ",\"would_spawn\":\"$SPAWN_CMD\",\"unexpected_auto_stop\":$([[ "$UNEXPECTED_AUTO_STOP" == "1" ]] && echo true || echo false)"
    echo "[sgsd-stop-handoff] DRY RUN: all pre-conditions passed. Would spawn: $SPAWN_CMD" >&2
    exit 0
fi

# --- SPAWN: fire-and-forget double-background ---
# Double-background ensures parent shell exits immediately, avoiding the 60s
# Stop hook timeout. Spawn output is discarded (>/dev/null 2>&1).

# Compute cumulative_runtime_s (sum of prior spawned rows in current chain)
CUMULATIVE_S=0
if [[ -f "$LOG_PATH" ]]; then
    CUMULATIVE_S=$(node -e "
try {
  var rows = require('fs').readFileSync(process.argv[1],'utf8')
    .split('\n').filter(Boolean)
    .map(function(l){ try { return JSON.parse(l); } catch(e) { return null; } })
    .filter(Boolean);
  var total = rows.reduce(function(s,r){ return s + (r.reason==='spawned' ? (r.cumulative_runtime_s||0) : 0); }, 0);
  process.stdout.write(String(total));
} catch(e) { process.stdout.write('0'); }
" "$LOG_PATH" 2>/dev/null || echo "0")
fi

if [[ "$UNEXPECTED_AUTO_STOP" == "1" ]]; then
    _log_row "unexpected_auto_stop" "$CHAIN_DEPTH" ",\"cumulative_runtime_s\":$CUMULATIVE_S,\"recovery\":\"spawned_without_checkpoint\",\"pulse_age_limit_s\":$UNEXPECTED_STOP_MAX_PULSE_AGE"
else
    _log_row "spawned" "$CHAIN_DEPTH" ",\"cumulative_runtime_s\":$CUMULATIVE_S"
fi
(claude --print --dangerously-skip-permissions "/sgsd-orchestrate go" >/dev/null 2>&1 &) &

exit 0
