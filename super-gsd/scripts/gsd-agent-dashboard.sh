#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Super GSD Agent Dashboard
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
#  Live view of every agent, what it's doing, and tokens used.
#  Refreshes every 3 seconds. Read-only.
#
#  Usage:
#    bash gsd-agent-dashboard.sh [project-dir]
#
#  Shows:
#    - Milestone + phase progress bar
#    - Every agent spawned this session (from token-log.jsonl)
#    - Current activity per agent (from most recent log entry)
#    - Token spend per agent + running total
#    - Context checkpoint status
#    - Most recent commits
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROJECT_DIR="${1:-.}"
REFRESH_SEC=3

if [ ! -d "$PROJECT_DIR/.planning" ]; then
  echo "ERROR: No .planning/ directory in $PROJECT_DIR"
  exit 1
fi

# Colors
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
PURPLE='\033[35m'
CYAN='\033[36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

while true; do
  clear

  # ── Header ──
  echo -e "${BOLD}${CYAN}================================================================${RESET}"
  echo -e "${BOLD}${CYAN}              SUPER GSD -- AGENT DASHBOARD                      ${RESET}"
  echo -e "${BOLD}${CYAN}================================================================${RESET}"
  echo -e "${DIM}$(date '+%Y-%m-%d %H:%M:%S') | Refreshes every ${REFRESH_SEC}s | Ctrl+C to quit${RESET}"
  echo ""

  # ── Milestone + Progress ──
  STATE_FILE="$PROJECT_DIR/.planning/STATE.md"
  ROADMAP_FILE="$PROJECT_DIR/.planning/ROADMAP.md"

  if [ -f "$STATE_FILE" ]; then
    MILESTONE=$(grep -m1 '^milestone:' "$STATE_FILE" 2>/dev/null | awk '{print $2}')
    CURRENT_PHASE=$(grep -m1 '^current_phase:' "$STATE_FILE" 2>/dev/null | awk '{print $2}')
    STATUS=$(grep -m1 '^status:' "$STATE_FILE" 2>/dev/null | awk '{print $2}')
  fi

  if [ -f "$ROADMAP_FILE" ]; then
    TOTAL=$(grep -c '^- \[' "$ROADMAP_FILE" 2>/dev/null || echo 0)
    DONE=$(grep -c '^- \[x\]' "$ROADMAP_FILE" 2>/dev/null || echo 0)
  fi

  if [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
    PCT=$((DONE * 100 / TOTAL))
    FILLED=$((PCT / 5))
    EMPTY=$((20 - FILLED))
    BAR=""
    for ((i=0; i<FILLED; i++)); do BAR="${BAR}#"; done
    for ((i=0; i<EMPTY; i++)); do BAR="${BAR}-"; done
    echo -e "${BOLD}Milestone:${RESET} ${MILESTONE:-?} ${DIM}|${RESET} ${BOLD}Phase:${RESET} ${CURRENT_PHASE:-?}/${TOTAL} ${DIM}|${RESET} ${BOLD}Status:${RESET} ${STATUS:-?}"
    echo -e "${GREEN}[${BAR}]${RESET} ${BOLD}${DONE}/${TOTAL}${RESET} phases (${PCT}%)"
  else
    echo -e "${DIM}No roadmap data${RESET}"
  fi

  echo ""

  # ── Checkpoint Status ──
  if [ -f "$PROJECT_DIR/.planning/ORCHESTRATOR-CHECKPOINT.md" ]; then
    LAST_COMPLETED=$(grep -m1 '^last_completed:' "$PROJECT_DIR/.planning/ORCHESTRATOR-CHECKPOINT.md" | sed 's/last_completed: //')
    NEXT_UNIT=$(grep -m1 '^next_unit:' "$PROJECT_DIR/.planning/ORCHESTRATOR-CHECKPOINT.md" | sed 's/next_unit: //')
    echo -e "${YELLOW}[CHECKPOINT ACTIVE]${RESET}"
    echo -e "  ${DIM}Last:${RESET} ${LAST_COMPLETED}"
    echo -e "  ${DIM}Next:${RESET} ${NEXT_UNIT}"
    echo ""
  fi

  # ── Active Agents (from token log) ──
  TOKEN_LOG="$PROJECT_DIR/.planning/metrics/token-log.jsonl"

  echo -e "${BOLD}AGENT ACTIVITY (last 10 dispatches)${RESET}"
  echo -e "${DIM}----------------------------------------------------------------${RESET}"

  if [ -f "$TOKEN_LOG" ] && [ -s "$TOKEN_LOG" ]; then
    # Get last 10 entries, format them
    tail -10 "$TOKEN_LOG" 2>/dev/null | node -e "
      const lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\n').filter(Boolean);
      if (lines.length === 0) { console.log('  (no entries yet)'); process.exit(0); }

      const colors = {
        opus: '\x1b[35m',     // purple
        sonnet: '\x1b[34m',    // blue
        haiku: '\x1b[36m',     // cyan
        reset: '\x1b[0m',
        dim: '\x1b[2m',
        bold: '\x1b[1m',
        green: '\x1b[32m',
        yellow: '\x1b[33m'
      };

      const total = { opus: 0, sonnet: 0, haiku: 0 };

      lines.reverse().forEach((line, i) => {
        try {
          const e = JSON.parse(line);
          const model = (e.model || 'unknown').toLowerCase();
          const color = colors[model] || colors.dim;
          const role = e.role || e.description || 'agent';
          const tokens = e.total || 0;
          const tokenStr = tokens < 1000 ? tokens + '' : Math.round(tokens/1000) + 'K';
          const time = e.ts ? new Date(e.ts).toLocaleTimeString() : '';
          const phase = e.phase ? ('P' + e.phase + (e.plan ? '.' + e.plan : '')) : '';
          const activity = (role + ' ' + phase).substring(0, 40);

          total[model] = (total[model] || 0) + tokens;

          console.log(
            '  ' + colors.dim + time + colors.reset + ' ' +
            color + model.padEnd(7) + colors.reset + ' ' +
            colors.bold + activity.padEnd(42) + colors.reset +
            colors.yellow + tokenStr.padStart(6) + colors.reset
          );
        } catch (err) {}
      });

      console.log('');
      console.log('  ' + colors.bold + 'SESSION TOTALS:' + colors.reset);
      console.log('  ' + colors.opus + 'Opus:   ' + colors.reset + Math.round((total.opus||0)/1000) + 'K tokens');
      console.log('  ' + colors.sonnet + 'Sonnet: ' + colors.reset + Math.round((total.sonnet||0)/1000) + 'K tokens');
      console.log('  ' + colors.haiku + 'Haiku:  ' + colors.reset + Math.round((total.haiku||0)/1000) + 'K tokens');
      const grand = (total.opus||0) + (total.sonnet||0) + (total.haiku||0);
      console.log('  ' + colors.bold + 'Total:  ' + Math.round(grand/1000) + 'K tokens' + colors.reset);
    " 2>/dev/null || echo -e "  ${DIM}(parse error)${RESET}"
  else
    echo -e "  ${DIM}No agents dispatched yet${RESET}"
  fi

  echo ""

  # ── Current Phase Work ──
  if [ -n "$CURRENT_PHASE" ]; then
    PHASE_DIR=$(find "$PROJECT_DIR/.planning/phases" -maxdepth 1 -type d -name "${CURRENT_PHASE}-*" 2>/dev/null | head -1)
    if [ -n "$PHASE_DIR" ]; then
      echo -e "${BOLD}CURRENT PHASE FILES${RESET} ${DIM}($(basename "$PHASE_DIR"))${RESET}"
      echo -e "${DIM}----------------------------------------------------------------${RESET}"

      # Show plans with status
      for plan in "$PHASE_DIR"/*-PLAN.md; do
        [ -f "$plan" ] || continue
        plan_name=$(basename "$plan" .md)
        summary="${plan/PLAN/SUMMARY}"
        if [ -f "$summary" ]; then
          echo -e "  ${GREEN}[done]${RESET} ${plan_name}"
        else
          echo -e "  ${YELLOW}[pending]${RESET} ${plan_name}"
        fi
      done
      echo ""
    fi
  fi

  # ── Recent Commits ──
  echo -e "${BOLD}RECENT COMMITS${RESET}"
  echo -e "${DIM}----------------------------------------------------------------${RESET}"
  cd "$PROJECT_DIR" 2>/dev/null && git log --oneline -5 2>/dev/null | while read hash msg; do
    echo -e "  ${CYAN}${hash}${RESET} ${msg:0:60}"
  done
  echo ""

  # ── Footer ──
  echo -e "${DIM}================================================================${RESET}"
  echo -e "${DIM}Project: $PROJECT_DIR${RESET}"

  sleep $REFRESH_SEC
done
