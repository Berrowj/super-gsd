#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Super GSD Headless Runner
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
#  Runs Claude Code in a loop. When context fills up or
#  it crashes, waits briefly then restarts. The checkpoint
#  file tells Claude where to resume. No human needed.
#
#  Usage:
#    bash gsd-headless.sh [project-dir]
#    bash gsd-headless.sh              # uses current directory
#    bash gsd-headless.sh --max-runs 10  # stop after 10 restarts
#    bash gsd-headless.sh --stop        # stop a running headless session
#
#  Run in tmux/screen so it survives terminal close:
#    tmux new-session -d -s gsd 'bash super-gsd/scripts/gsd-headless.sh'
#    tmux attach -t gsd   # to watch
#
#  Logs to: .planning/metrics/headless-log.txt
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# SSH/non-login shells on dev boxes often skip ~/.bashrc user PATH additions.
# Headless auto mode needs the same node/claude/codex shims as interactive SG.
if [[ -d "$HOME/.local/bin" ]]; then
  PATH="$HOME/.local/bin:$PATH"
fi
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  SGSD_NODE_BIN="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -1)"
  if [[ -n "$SGSD_NODE_BIN" ]]; then
    PATH="$SGSD_NODE_BIN:$PATH"
  fi
fi
export PATH

# ── Config ──
PROJECT_DIR="${1:-.}"
MAX_RUNS=50              # safety cap — stop after N restarts
RESTART_DELAY=10          # seconds between restarts
BACKOFF_MAX=120           # max delay after repeated failures
LOCKFILE="$PROJECT_DIR/.planning/.headless.lock"
LOGFILE="$PROJECT_DIR/.planning/metrics/headless-log.txt"
PROMPT="Read .planning/ORCHESTRATOR-CHECKPOINT.md if it exists, then enter auto mode: /sgsd-orchestrate go"

# ── Parse args ──
for arg in "$@"; do
  case "$arg" in
    --max-runs)
      shift; MAX_RUNS="$1"; shift ;;
    --stop)
      if [ -f "$LOCKFILE" ]; then
        PID=$(cat "$LOCKFILE")
        kill "$PID" 2>/dev/null && echo "Stopped headless session (PID $PID)" || echo "Process $PID not found"
        rm -f "$LOCKFILE"
      else
        echo "No headless session running (no lock file)"
      fi
      exit 0 ;;
    --*)
      ;; # skip unknown flags
    *)
      PROJECT_DIR="$arg" ;;
  esac
done

# ── Validate ──
if [ ! -d "$PROJECT_DIR/.planning" ]; then
  echo "ERROR: No .planning/ directory in $PROJECT_DIR"
  echo "Run: bash super-gsd/install.sh --init-project"
  exit 1
fi

if [ ! -f "$PROJECT_DIR/CLAUDE.md" ]; then
  echo "ERROR: No CLAUDE.md in $PROJECT_DIR"
  echo "Run: cp super-gsd/CLAUDE-OVERLAY.md CLAUDE.md"
  exit 1
fi

# ── Lock file (prevent double-runs) ──
if [ -f "$LOCKFILE" ]; then
  OLD_PID=$(cat "$LOCKFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "ERROR: Headless session already running (PID $OLD_PID)"
    echo "Stop it first: bash gsd-headless.sh --stop"
    exit 1
  else
    echo "Stale lock file found (PID $OLD_PID dead). Cleaning up."
    rm -f "$LOCKFILE"
  fi
fi

echo $$ > "$LOCKFILE"
trap "rm -f '$LOCKFILE'" EXIT

# ── Ensure log directory ──
mkdir -p "$(dirname "$LOGFILE")"

# ── Helper ──
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$LOGFILE"
}

check_all_done() {
  # Check if all phases are complete in ROADMAP.md
  local total=$(grep -c '^\- \[' "$PROJECT_DIR/.planning/ROADMAP.md" 2>/dev/null || echo "0")
  local done=$(grep -c '^\- \[x\]' "$PROJECT_DIR/.planning/ROADMAP.md" 2>/dev/null || echo "0")
  if [ "$total" -gt 0 ] && [ "$total" -eq "$done" ]; then
    return 0  # all done
  fi
  return 1  # not done
}

# ── Main Loop ──
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Super GSD Headless Runner — Starting"
log "Project: $PROJECT_DIR"
log "Max runs: $MAX_RUNS"
log "PID: $$"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RUN=0
CONSECUTIVE_FAILURES=0
DELAY=$RESTART_DELAY

while [ $RUN -lt $MAX_RUNS ]; do
  RUN=$((RUN + 1))

  # Check if all phases are done
  if check_all_done; then
    log "ALL PHASES COMPLETE — stopping headless runner"
    break
  fi

  # Check for checkpoint
  if [ -f "$PROJECT_DIR/.planning/ORCHESTRATOR-CHECKPOINT.md" ]; then
    log "Run $RUN/$MAX_RUNS — Resuming from checkpoint"
  else
    log "Run $RUN/$MAX_RUNS — Cold start (no checkpoint)"
  fi

  # Run Claude Code
  log "Launching: claude --print --dangerously-skip-permissions"
  START_TIME=$(date +%s)

  cd "$PROJECT_DIR"
  claude --print --dangerously-skip-permissions -p "$PROMPT" >> "$LOGFILE" 2>&1
  EXIT_CODE=$?

  END_TIME=$(date +%s)
  DURATION=$(( END_TIME - START_TIME ))

  log "Claude exited with code $EXIT_CODE after ${DURATION}s"

  # Check if work was done (new commits since start)
  COMMITS_AFTER=$(git log --oneline --since="$START_TIME" 2>/dev/null | wc -l | tr -d ' ')
  log "Commits this run: $COMMITS_AFTER"

  # Check if all phases complete after this run
  if check_all_done; then
    log "ALL PHASES COMPLETE — stopping headless runner"
    break
  fi

  # Backoff logic
  if [ "$COMMITS_AFTER" -eq 0 ] && [ $EXIT_CODE -ne 0 ]; then
    # No work done + error = probably stuck
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    DELAY=$(( RESTART_DELAY * CONSECUTIVE_FAILURES ))
    if [ $DELAY -gt $BACKOFF_MAX ]; then
      DELAY=$BACKOFF_MAX
    fi
    log "WARNING: No commits + error exit. Failure #$CONSECUTIVE_FAILURES. Delay: ${DELAY}s"
  else
    # Work was done — reset backoff
    CONSECUTIVE_FAILURES=0
    DELAY=$RESTART_DELAY
  fi

  # Too many consecutive failures = probably a real problem
  if [ $CONSECUTIVE_FAILURES -ge 5 ]; then
    log "ERROR: 5 consecutive failures with no commits. Stopping."
    log "Check the log for errors: $LOGFILE"
    break
  fi

  log "Waiting ${DELAY}s before restart..."
  sleep $DELAY
done

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Headless runner finished after $RUN runs"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

rm -f "$LOCKFILE"
