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
    row="{\"ts\":\"$ts\",\"from_session_id\":\"$from_session\",\"to_session_id\":null,\"reason\":\"$reason\",\"chain_depth\":$chain_depth,\"checkpoint_path\":\"$CHECKPOINT\"${extra}}"
    echo "$row" >> "$LOG_PATH"
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
