#!/usr/bin/env bash
# sgsd-stop-handoff.sh -- Claude Code Stop hook for autonomous session handoff
# Fires on every session stop. Spawns fresh claude session if checkpoint signals
# emergency_halt and all safety pre-conditions pass.
# Usage: sgsd-stop-handoff.sh [--dry-run]
#
# Pre-conditions (evaluated in order):
#   1. config.json handoff.enabled == true   (default: false -- safe by default)
#   2. .planning/ORCHESTRATOR-CHECKPOINT.md exists with emergency_halt: true
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
# false when fell through to bare echo (used for audit field in _log_row).
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

# SEC-01 round 5: Node lstat-walk strict path validator. Walks every component
# of `target` from filesystem root → leaf and lstat() each. If ANY component
# is a symlink (intermediate or final), refuses. Closes the deepest symlink-
# attack surfaces:
#   - .planning itself being a symlink (canonicalize_path resolves but
#     doesn't flag — Codex round 5 CRIT)
#   - metrics intermediate symlink (O_NOFOLLOW only protects final
#     component — Codex round 5 CRIT)
# Returns 0 if path has no symlink components OR Node unavailable
# (defense-in-depth, not crash). Returns 1 if symlink detected.
_path_has_no_symlink_components() {
    local target="$1"
    if ! command -v node >/dev/null 2>&1; then
        # No Node — can't lstat-walk. Defense-in-depth degradation,
        # not crash. canonicalize_path + _assert_contained provide
        # weaker coverage on this code path.
        return 0
    fi
    node -e "
        const fs   = require('fs');
        const path = require('path');
        const target = process.argv[1];
        try {
            const abs = path.resolve(target);
            const parts = abs.split(path.sep).filter(Boolean);
            let cur = path.isAbsolute(abs) ? path.parse(abs).root : '';
            for (const p of parts) {
                cur = path.join(cur, p);
                let st;
                try {
                    st = fs.lstatSync(cur);
                } catch (e) {
                    // Doesn't exist yet — fine (file may not be created until first write).
                    break;
                }
                if (st.isSymbolicLink()) {
                    process.stderr.write('SYMLINK_COMPONENT:' + cur + '\n');
                    process.exit(1);
                }
            }
            process.exit(0);
        } catch (e) {
            process.exit(1);
        }
    " "$target" 2>&1 >/dev/null
}

# Wraps _path_has_no_symlink_components with stderr audit + Node O_NOFOLLOW
# audit-row append to a SAFE log path inside the canonical .planning tree
# (never the raw caller path). Requires PLANNING_DIR_CANONICAL to be set
# before first invocation.
_assert_no_symlink_components() {
    local target="$1"
    local label="$2"
    if _path_has_no_symlink_components "$target"; then
        return 0
    fi
    local ts
    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
    echo "sgsd-stop-handoff: SYMLINK COMPONENT detected on $label path ('$target'). Refusing handoff." >&2
    if command -v node >/dev/null 2>&1; then
        local safe_log_dir="$PLANNING_DIR_CANONICAL/metrics"
        local safe_log_path="$safe_log_dir/handoff-log.jsonl"
        mkdir -p "$safe_log_dir" 2>/dev/null || true
        node -e "
          const fs = require('fs');
          const p = process.argv[1];
          const row = process.argv[2] + '\n';
          try {
            const fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
            fs.writeSync(fd, row);
            fs.closeSync(fd);
          } catch (e) {}
        " "$safe_log_path" \
          "{\"ts\":\"$ts\",\"from_session_id\":\"pid-$$\",\"to_session_id\":null,\"reason\":\"refused\",\"chain_depth\":0,\"refused\":\"symlink_component\",\"path_label\":\"$label\"}" \
          2>/dev/null || true
    fi
    exit 0
}

PROJECT_DIR="$(_detect_root || true)"
if [[ -z "$PROJECT_DIR" ]]; then
    # No .planning directory found -- not a GSD project, silently exit
    exit 0
fi

PLANNING_DIR="$PROJECT_DIR/.planning"
CONFIG_FILE="$PLANNING_DIR/config.json"
CHECKPOINT="$PLANNING_DIR/ORCHESTRATOR-CHECKPOINT.md"
LOG_DIR="$PLANNING_DIR/metrics"
LOG_PATH="$LOG_DIR/handoff-log.jsonl"
ABORT_FILE="$PLANNING_DIR/STOP-HANDOFF"

# SEC-01 round 5 strict validation: lstat-walk every component of every raw
# handoff path BEFORE canonicalization or any read. Catches intermediate-
# component symlink attacks (e.g. .planning itself, or metrics being a
# symlink to /etc/cron.d/) that O_NOFOLLOW + canonicalize+contain alone
# cannot detect. Must be PRE-canonicalize because canonicalization resolves
# the very symlinks we're trying to detect.
# PLANNING_DIR_CANONICAL is set inline here (we need it for the audit-write
# fallback path inside _assert_no_symlink_components).
PLANNING_DIR_CANONICAL="$(canonicalize_path "$PLANNING_DIR")"
_assert_no_symlink_components "$PLANNING_DIR" "PLANNING_DIR"
_assert_no_symlink_components "$LOG_DIR" "LOG_DIR"
_assert_no_symlink_components "$LOG_PATH" "LOG_PATH"
_assert_no_symlink_components "$CHECKPOINT" "CHECKPOINT"
_assert_no_symlink_components "$ABORT_FILE" "ABORT_FILE"

# Canonicalize all handoff paths (SEC-01 symlink-attack hardening) — second
# layer after lstat-walk. Containment check below gates final write target.
LOG_DIR="$(canonicalize_path "$LOG_DIR")"
LOG_PATH="$(canonicalize_path "$LOG_PATH")"
CHECKPOINT="$(canonicalize_path "$CHECKPOINT")"
ABORT_FILE="$(canonicalize_path "$ABORT_FILE")"

# SEC-01 containment assertion: any canonical path escaping PLANNING_DIR is
# a symlink attack → refuse immediately. CRIT-fix re-review 2: DO NOT write
# the refusal to $LOG_DIR/handoff-log.jsonl — that path may itself be the
# compromised symlink. Instead (a) log to stderr (ephemeral, no attack
# surface) and (b) write audit row via Node with O_NOFOLLOW flag which
# refuses to write through any symlink in the target path. If Node
# unavailable, exit silently (security > audit detail).
_assert_contained() {
    local target="$1"
    local label="$2"
    case "$target" in
        "$PLANNING_DIR_CANONICAL"/*|"$PLANNING_DIR_CANONICAL") return 0 ;;
        *)
            local ts
            ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
            # Attack warning to stderr — visible in Claude Code stderr capture
            echo "sgsd-stop-handoff: SYMLINK ESCAPE detected on $label ('$target' not under '$PLANNING_DIR_CANONICAL'). Refusing handoff." >&2
            # CRIT-fix re-review 3: write the refusal audit row to the
            # PLANNING_DIR_CANONICAL trusted path, NOT $LOG_DIR (which may
            # itself be the escaped target). This guarantees the audit row
            # lands inside .planning/ even when LOG_DIR was the attack vector.
            # O_NOFOLLOW additionally rejects the final-component symlink case.
            if command -v node >/dev/null 2>&1; then
                local safe_log_dir="$PLANNING_DIR_CANONICAL/metrics"
                local safe_log_path="$safe_log_dir/handoff-log.jsonl"
                mkdir -p "$safe_log_dir" 2>/dev/null || true
                node -e "
                  const fs = require('fs');
                  const p = process.argv[1];
                  const row = process.argv[2] + '\n';
                  try {
                    const fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
                    fs.writeSync(fd, row);
                    fs.closeSync(fd);
                  } catch (e) {
                    // ELOOP / EEXIST / EACCES — refuse silently, stderr already logged
                  }
                " "$safe_log_path" \
                  "{\"ts\":\"$ts\",\"from_session_id\":\"pid-$$\",\"to_session_id\":null,\"reason\":\"refused\",\"chain_depth\":0,\"refused\":\"symlink_escape\",\"path_label\":\"$label\"}" \
                  2>/dev/null || true
            fi
            exit 0
            ;;
    esac
}
_assert_contained "$LOG_DIR" "LOG_DIR"
_assert_contained "$LOG_PATH" "LOG_PATH"
_assert_contained "$CHECKPOINT" "CHECKPOINT"
_assert_contained "$ABORT_FILE" "ABORT_FILE"

# --- Read config (all optional; hard defaults apply if block absent) ---
ENABLED="false"
MIN_COOLDOWN=30
MAX_CHAIN_DEPTH=5

if [[ -f "$CONFIG_FILE" ]]; then
    _enabled=$(node -e "try{var c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));var v=c.handoff&&c.handoff.enabled!=null?c.handoff.enabled:false;console.log(String(v))}catch(e){console.log('false')}" 2>/dev/null || echo "false")
    ENABLED="$_enabled"

    _cool=$(node -e "try{var c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));var v=c.handoff&&c.handoff.min_cooldown_seconds!=null?c.handoff.min_cooldown_seconds:30;console.log(Number(v))}catch(e){console.log(30)}" 2>/dev/null || echo "30")
    MIN_COOLDOWN="$_cool"

    _depth=$(node -e "try{var c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));var v=c.handoff&&c.handoff.max_chain_depth!=null?c.handoff.max_chain_depth:5;console.log(Number(v))}catch(e){console.log(5)}" 2>/dev/null || echo "5")
    MAX_CHAIN_DEPTH="$_depth"
fi

# --- Helper: append JSON row to handoff-log.jsonl ---
# SEC-02: flock-guarded append to serialise concurrent Stop hook invocations.
# Fallback chain: flock (preferred) → Node appendFileSync → unlocked echo+lock_fallback.
# lock_fallback field only present in the row when the unlocked last-resort path fires.
_log_row() {
    local reason="$1"
    local chain_depth="${2:-0}"
    local extra="${3:-}"
    local ts from_session row

    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
    # CLAUDE_SESSION_ID is NOT propagated to hook subprocesses (RESEARCH V2).
    # Use PID as fallback -- unique per Stop hook invocation.
    from_session="pid-$$"

    mkdir -p "$LOG_DIR"
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
        exec {LOG_FD}>>"$LOG_PATH"
        if flock -x -w 5 "$LOG_FD" 2>/dev/null; then
            echo "${row_prefix},\"lock_fallback\":false}" >&"$LOG_FD"
            flock -u "$LOG_FD" 2>/dev/null || true
            exec {LOG_FD}>&-
            return 0
        fi
        exec {LOG_FD}>&-
        # Lock timeout — fall through to Node path with lock_fallback:true marker
        if command -v node >/dev/null 2>&1; then
            local row_fb="${row_prefix},\"lock_fallback\":true}"
            node -e "require('fs').appendFileSync(process.argv[1], process.argv[2]+String.fromCharCode(10))" \
              "$LOG_PATH" "$row_fb" 2>/dev/null || echo "$row_fb" >> "$LOG_PATH"
        else
            echo "${row_prefix},\"lock_fallback\":true}" >> "$LOG_PATH"
        fi
        return 0
    elif command -v node >/dev/null 2>&1; then
        # Fallback: Node fs.appendFileSync — atomic for small writes on POSIX (O_APPEND).
        # lock_fallback:false when Node write succeeds. CRIT-fix re-review 2:
        # on Node failure, unlocked echo path must rebuild row with
        # lock_fallback:true — previously mislabeled the last-resort write.
        local row_node="${row_prefix},\"lock_fallback\":false}"
        if ! node -e "require('fs').appendFileSync(process.argv[1], process.argv[2]+String.fromCharCode(10))" \
             "$LOG_PATH" "$row_node" 2>/dev/null; then
            # Node call itself failed — rebuild row with accurate lock_fallback:true
            echo "${row_prefix},\"lock_fallback\":true}" >> "$LOG_PATH"
        fi
    else
        # Last-resort: no bash-fd / no flock / no node. Truly unlocked append.
        echo "${row_prefix},\"lock_fallback\":true}" >> "$LOG_PATH"
    fi
}

# --- PRE-CONDITION 1: enabled check ---
# Default is false -- safe by default. No log noise when disabled.
if [[ "$ENABLED" != "true" ]]; then
    exit 0
fi

# --- PRE-CONDITION 2: checkpoint must exist with emergency_halt: true ---
if [[ ! -f "$CHECKPOINT" ]]; then
    exit 0
fi

EMERGENCY_HALT=$(grep -m1 "^emergency_halt:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]')
if [[ "$EMERGENCY_HALT" != "true" ]]; then
    exit 0
fi

# --- PRE-CONDITION 3: discuss-phase guard ---
# If session stopped during /gsd-discuss-phase, handoff must refuse.
# Discuss-phase is interactive -- operator must resume manually.
PHASE_STATE=$(grep -m1 "^phase_state:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]"')
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
    _log_row "dry_run" "$CHAIN_DEPTH" ",\"would_spawn\":\"$SPAWN_CMD\""
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

_log_row "spawned" "$CHAIN_DEPTH" ",\"cumulative_runtime_s\":$CUMULATIVE_S"
(claude --print --dangerously-skip-permissions "/sgsd-orchestrate go" >/dev/null 2>&1 &) &

exit 0
