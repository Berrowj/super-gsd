#!/usr/bin/env bash
# ============================================================================
# Super GSD remote tmux launcher
# ============================================================================
# Starts SGSD for a project inside a named tmux session. This is intended for
# SSH hosts. When the project worktree vendors super-gsd/, scripts are loaded
# from that worktree; otherwise the launcher falls back to the global install:
#   ~/.claude/super-gsd/scripts
#
# Example:
#   bash ~/.claude/super-gsd/scripts/sgsd-remote-tmux.sh \
#     --project /opt/clarity/project-clarity-erp \
#     --session clarity-sgsd \
#     --greet
# ============================================================================

set -u

PROJECT_DIR="${SGSD_PROJECT_DIR:-/opt/clarity/project-clarity-erp}"
SESSION="${SGSD_TMUX_SESSION:-clarity-sgsd}"
SCRIPTS_DIR="${SGSD_SCRIPTS_DIR:-}"
AGENTS_DIR="${SGSD_AGENTS_DIR:-}"
SOURCE_DIR="${SGSD_SOURCE_DIR:-}"
CLAUDE_MODE="greet"
ATTACH=true
RESET=false
DOCTOR=false

usage() {
  cat <<'EOF'
Super GSD remote tmux launcher

Usage:
  sgsd-remote-tmux.sh [options]

Options:
  --project PATH       SGSD project root. Default: /opt/clarity/project-clarity-erp
  --session NAME       tmux session name. Default: clarity-sgsd
  --scripts-dir PATH   Authoritative SGSD scripts path.
  --agents-dir PATH    Authoritative SGSD agents path.
  --source-dir PATH    Authoritative canonical source checkout.
  --greet              Start Claude with the SGSD greeting prompt. Default.
  --go                 Start Claude and immediately send "go" for auto mode.
  --shell              Do not start Claude; leave operator pane at a shell.
  --no-attach          Create/reuse the tmux session but do not attach.
  --reset              Kill the existing tmux session first.
  --doctor             Print environment checks only.
  --help               Show this help.

Recommended:
  ssh devcp -t 'bash ~/.claude/super-gsd/scripts/sgsd-remote-tmux.sh --project /opt/clarity/project-clarity-erp --greet'
EOF
}

die() {
  echo "sgsd-remote-tmux: ERROR: $*" >&2
  exit 1
}

warn() {
  echo "sgsd-remote-tmux: WARN: $*" >&2
}

q() {
  printf "%q" "$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      [[ $# -ge 2 ]] || die "--project requires a path"
      PROJECT_DIR="$2"
      shift 2
      ;;
    --session)
      [[ $# -ge 2 ]] || die "--session requires a name"
      SESSION="$2"
      shift 2
      ;;
    --scripts-dir)
      [[ $# -ge 2 ]] || die "--scripts-dir requires a path"
      SCRIPTS_DIR="$2"
      shift 2
      ;;
    --agents-dir)
      [[ $# -ge 2 ]] || die "--agents-dir requires a path"
      AGENTS_DIR="$2"
      shift 2
      ;;
    --source-dir)
      [[ $# -ge 2 ]] || die "--source-dir requires a path"
      SOURCE_DIR="$2"
      shift 2
      ;;
    --greet)
      CLAUDE_MODE="greet"
      shift
      ;;
    --go)
      CLAUDE_MODE="go"
      shift
      ;;
    --shell)
      CLAUDE_MODE="shell"
      shift
      ;;
    --no-attach)
      ATTACH=false
      shift
      ;;
    --reset)
      RESET=true
      shift
      ;;
    --doctor)
      DOCTOR=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

# SSH/non-login shells on dev boxes often skip profile PATH additions.
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

PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd -P)" || die "project not found: $PROJECT_DIR"
[[ -d "$PROJECT_DIR/.planning" ]] || die "missing .planning/ under $PROJECT_DIR"
if [[ -z "$SCRIPTS_DIR" ]]; then
  if [[ -d "$PROJECT_DIR/super-gsd/scripts" ]]; then
    SCRIPTS_DIR="$PROJECT_DIR/super-gsd/scripts"
  else
    SCRIPTS_DIR="$HOME/.claude/super-gsd/scripts"
  fi
fi
if [[ -z "$AGENTS_DIR" ]]; then
  if [[ -d "$PROJECT_DIR/super-gsd/agents" ]]; then
    AGENTS_DIR="$PROJECT_DIR/super-gsd/agents"
  else
    AGENTS_DIR="$HOME/.claude/agents"
  fi
fi
if [[ -z "$SOURCE_DIR" ]]; then
  if [[ -d "$PROJECT_DIR/super-gsd" ]]; then
    SOURCE_DIR="$PROJECT_DIR"
  else
    SOURCE_DIR="$HOME/.claude/super-gsd/source"
  fi
fi
[[ -d "$SCRIPTS_DIR" ]] || die "missing SGSD scripts dir: $SCRIPTS_DIR"
[[ -d "$AGENTS_DIR" ]] || die "missing SGSD agents dir: $AGENTS_DIR"
[[ -d "$SOURCE_DIR" ]] || die "missing SGSD source dir: $SOURCE_DIR"
SCRIPTS_DIR="$(cd "$SCRIPTS_DIR" 2>/dev/null && pwd -P)" || die "cannot resolve scripts dir: $SCRIPTS_DIR"
AGENTS_DIR="$(cd "$AGENTS_DIR" 2>/dev/null && pwd -P)" || die "cannot resolve agents dir: $AGENTS_DIR"
SOURCE_DIR="$(cd "$SOURCE_DIR" 2>/dev/null && pwd -P)" || die "cannot resolve source dir: $SOURCE_DIR"

FRAMEWORK_HEAD="$(git -C "$SOURCE_DIR" rev-parse --verify 'HEAD^{commit}' 2>/dev/null)" \
  || die "cannot resolve canonical source HEAD: $SOURCE_DIR"
[[ "$FRAMEWORK_HEAD" =~ ^[0-9a-fA-F]{40}$ ]] \
  || die "canonical source HEAD is not a full commit SHA: $FRAMEWORK_HEAD"
PROJECT_PIN="not-pinned"
if [[ -e "$PROJECT_DIR/.super-gsd-version" ]]; then
  [[ -f "$PROJECT_DIR/.super-gsd-version" ]] \
    || die "project pin is not a file: $PROJECT_DIR/.super-gsd-version"
  PROJECT_PIN="$(tr -d '[:space:]' < "$PROJECT_DIR/.super-gsd-version")"
  [[ "$PROJECT_PIN" =~ ^[0-9a-fA-F]{40}$ ]] \
    || die "project pin is not a full commit SHA: $PROJECT_PIN"
  [[ "$PROJECT_PIN" == "$FRAMEWORK_HEAD" ]] \
    || die "framework provenance mismatch: source HEAD $FRAMEWORK_HEAD != project pin $PROJECT_PIN"
fi

export SGSD_PROJECT_DIR="$PROJECT_DIR"
export SGSD_SCRIPTS_DIR="$SCRIPTS_DIR"
export SGSD_AGENTS_DIR="$AGENTS_DIR"
export SGSD_SOURCE_DIR="$SOURCE_DIR"

COCKPIT_SERVER_START="$SCRIPTS_DIR/start-cockpit-server.sh"

if [[ "$SESSION" =~ [^A-Za-z0-9_.:-] ]]; then
  die "session name contains unsupported characters: $SESSION"
fi

check_cmd() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    printf "  [OK]   %s: %s\n" "$name" "$(command -v "$name")"
    return 0
  fi
  printf "  [MISS] %s\n" "$name"
  return 1
}

doctor() {
  echo "SGSD remote tmux doctor"
  echo "  project:    $PROJECT_DIR"
  echo "  scripts:    $SCRIPTS_DIR"
  echo "  agents:     $AGENTS_DIR"
  echo "  source:     $SOURCE_DIR"
  echo "  Framework HEAD: $FRAMEWORK_HEAD"
  echo "  Project Pin: $PROJECT_PIN"
  echo "  session:    $SESSION"
  echo "  mode:       $CLAUDE_MODE"
  check_cmd tmux || true
  check_cmd bash || true
  check_cmd node || true
  check_cmd claude || true
  check_cmd codex || true
  check_cmd pwsh || true
  [[ -f "$COCKPIT_SERVER_START" ]] && echo "  [OK]   localhost cockpit start script: $COCKPIT_SERVER_START" || echo "  [MISS] localhost cockpit start script"
  if [[ -f "$PROJECT_DIR/.planning/runtime/cockpit-server.url" ]]; then
    echo "  [OK]   cockpit url: $(head -n 1 "$PROJECT_DIR/.planning/runtime/cockpit-server.url" 2>/dev/null)"
  fi
  [[ -f "$SCRIPTS_DIR/sgsd-mission-control.ps1" ]] && echo "  [OK]   mission control script" || echo "  [MISS] mission control script"
  [[ -f "$SCRIPTS_DIR/sgsd-codex-monitor.ps1" ]] && echo "  [OK]   codex monitor script" || echo "  [MISS] codex monitor script"
  [[ -f "$SCRIPTS_DIR/sgsd-narrative.ps1" ]] && echo "  [OK]   narrative script" || echo "  [MISS] narrative script"
}

start_localhost_cockpit() {
  if [[ ! -f "$COCKPIT_SERVER_START" ]]; then
    warn "localhost cockpit start script missing: $COCKPIT_SERVER_START"
    return 0
  fi

  echo "SGSD localhost cockpit"
  local out rc url
  out="$(bash "$COCKPIT_SERVER_START" --workspace "$PROJECT_DIR" 2>&1)"
  rc=$?
  printf '%s\n' "$out" | sed 's/^/  /'
  if [[ "$rc" -ne 0 ]]; then
    warn "localhost cockpit failed to start (exit $rc)"
    return 0
  fi
  if [[ -f "$PROJECT_DIR/.planning/runtime/cockpit-server.url" ]]; then
    url="$(head -n 1 "$PROJECT_DIR/.planning/runtime/cockpit-server.url" 2>/dev/null || true)"
    echo "SGSD localhost cockpit healthy: ${url:-http://localhost:7777/}"
  else
    echo "SGSD localhost cockpit healthy"
  fi
}

if [[ "$DOCTOR" = true ]]; then
  doctor
  exit 0
fi

command -v tmux >/dev/null 2>&1 || die "tmux is not installed"
command -v claude >/dev/null 2>&1 || warn "Claude CLI not on PATH; operator pane will open a shell"
command -v codex >/dev/null 2>&1 || warn "Codex CLI not on PATH; Codex execution will fail until fixed"

mkdir -p "$PROJECT_DIR/.planning/metrics"
touch "$PROJECT_DIR/.planning/metrics/codex-live-output.txt" 2>/dev/null || true
touch "$PROJECT_DIR/.planning/metrics/narrative.md" 2>/dev/null || true
touch "$PROJECT_DIR/.planning/ORCHESTRATOR-LIVE.jsonl" 2>/dev/null || true

if [[ "$RESET" = true ]] && tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
fi

start_localhost_cockpit

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "SGSD tmux session already running: $SESSION"
  if [[ "$ATTACH" = true ]]; then
    exec tmux attach-session -t "$SESSION"
  fi
  exit 0
fi

PROJECT_Q="$(q "$PROJECT_DIR")"
SCRIPTS_Q="$(q "$SCRIPTS_DIR")"

GREET_PROMPT="You are booting in Super GSD mode inside tmux on devcp. Do these four things in your first response: (1) read .planning/STATE.md frontmatter and report current milestone status in one line, (2) report active agent count grouped by model from .planning/resource-registry/agents.jsonl, (3) confirm Codex is the coding executor and Sonnet/Haiku are not active SGSD routes, (4) ask the operator what they want to build. Do not enter auto mode unless the operator says go."

if command -v claude >/dev/null 2>&1; then
  case "$CLAUDE_MODE" in
    go)
      OPERATOR_CMD="cd $PROJECT_Q; echo '[SGSD operator] starting Claude auto mode'; claude --dangerously-skip-permissions 'go'; exec bash -l"
      ;;
    greet)
      OPERATOR_CMD="cd $PROJECT_Q; echo '[SGSD operator] starting Claude SGSD greeting'; claude --dangerously-skip-permissions $(q "$GREET_PROMPT"); exec bash -l"
      ;;
    shell)
      OPERATOR_CMD="cd $PROJECT_Q; echo '[SGSD operator shell]'; echo 'Run: claude --dangerously-skip-permissions'; exec bash -l"
      ;;
    *)
      die "unsupported Claude mode: $CLAUDE_MODE"
      ;;
  esac
else
  OPERATOR_CMD="cd $PROJECT_Q; echo '[SGSD operator shell] Claude CLI is not on PATH'; exec bash -l"
fi

MISSION_CMD="cd $PROJECT_Q; if command -v pwsh >/dev/null 2>&1 && [ -f $SCRIPTS_Q/sgsd-mission-control.ps1 ]; then pwsh -NoLogo -NoProfile -File $SCRIPTS_Q/sgsd-mission-control.ps1 -ProjectDir $PROJECT_Q; else while true; do clear; echo '[SGSD mission fallback - install pwsh for full cockpit]'; echo; sed -n '1,90p' .planning/STATE.md 2>/dev/null || true; sleep 5; done; fi"

CODEX_CMD="cd $PROJECT_Q; if command -v pwsh >/dev/null 2>&1 && [ -f $SCRIPTS_Q/sgsd-codex-monitor.ps1 ]; then pwsh -NoLogo -NoProfile -File $SCRIPTS_Q/sgsd-codex-monitor.ps1 -ProjectDir $PROJECT_Q; else while true; do clear; echo '[SGSD Codex fallback - install pwsh for full cockpit]'; echo; tail -n 80 .planning/metrics/codex-live-output.txt .planning/metrics/codex-log.jsonl 2>/dev/null || true; sleep 5; done; fi"

NARRATIVE_CMD="cd $PROJECT_Q; if command -v pwsh >/dev/null 2>&1 && [ -f $SCRIPTS_Q/sgsd-narrative.ps1 ]; then pwsh -NoLogo -NoProfile -File $SCRIPTS_Q/sgsd-narrative.ps1 -ProjectDir $PROJECT_Q; else clear; echo '[SGSD live tails]'; tail -n 80 -F .planning/ORCHESTRATOR-LIVE.jsonl .planning/metrics/narrative.md .planning/metrics/codex-live-output.txt .planning/metrics/codex-executor-live.txt 2>/dev/null; fi"

tmux new-session -d -s "$SESSION" -n SGSD -c "$PROJECT_DIR" "$OPERATOR_CMD"
OPERATOR_PANE="$(tmux display-message -p -t "$SESSION:0" "#{pane_id}")"
tmux set-window-option -t "$SESSION:0" remain-on-exit on >/dev/null
tmux set-option -t "$SESSION" status on >/dev/null
tmux set-option -t "$SESSION" status-left "[SGSD:$SESSION] " >/dev/null
tmux set-option -t "$SESSION" status-right "#H %H:%M" >/dev/null

CODEX_PANE="$(tmux split-window -t "$OPERATOR_PANE" -h -c "$PROJECT_DIR" -P -F "#{pane_id}" "$CODEX_CMD")"
MISSION_PANE="$(tmux split-window -t "$OPERATOR_PANE" -v -c "$PROJECT_DIR" -P -F "#{pane_id}" "$MISSION_CMD")"
NARRATIVE_PANE="$(tmux split-window -t "$CODEX_PANE" -v -c "$PROJECT_DIR" -P -F "#{pane_id}" "$NARRATIVE_CMD")"
tmux select-pane -t "$OPERATOR_PANE" -T "operator"
tmux select-pane -t "$MISSION_PANE" -T "mission"
tmux select-pane -t "$CODEX_PANE" -T "codex"
tmux select-pane -t "$NARRATIVE_PANE" -T "narrative"
tmux select-layout -t "$SESSION:0" tiled >/dev/null
tmux select-pane -t "$OPERATOR_PANE"

echo "SGSD tmux session started: $SESSION"
echo "Project: $PROJECT_DIR"
echo "Attach:  tmux attach -t $SESSION"

if [[ "$ATTACH" = true ]]; then
  exec tmux attach-session -t "$SESSION"
fi
