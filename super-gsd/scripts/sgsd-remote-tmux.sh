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

# Selection must observe the shell exactly as the caller supplied it. The
# shared helper adds Node recovery paths only after pinning that executable.
SGSD_CALLER_CWD="$(pwd -P)"
SGSD_CALLER_PATH="$PATH"

PROJECT_DIR="$SGSD_CALLER_CWD"
SESSION="${SGSD_TMUX_SESSION:-}"
SCRIPTS_DIR="${SGSD_SCRIPTS_DIR:-}"
AGENTS_DIR="${SGSD_AGENTS_DIR:-}"
SOURCE_DIR="${SGSD_SOURCE_DIR:-}"
CLAUDE_MODE="greet"
ATTACH=true
RESET=false
DOCTOR=false
CURRENT_TERMINAL=false
OPEN_COCKPIT=true
RESTORE_ID=""

usage() {
  cat <<'EOF'
Super GSD remote tmux launcher

Usage:
  sgsd-remote-tmux.sh [options]

Options:
  --project PATH       SGSD project root. Default: nearest .planning in caller CWD.
  --session NAME       tmux session name. Default: project name plus path digest.
  --current-terminal   Launch Claude here, without creating or nesting tmux.
  --no-cockpit         Do not start the separate cockpit server.
  --scripts-dir PATH   Authoritative SGSD scripts path.
  --agents-dir PATH    Authoritative SGSD agents path.
  --source-dir PATH    Authoritative canonical source checkout.
  --restore-id ID      Coordinator ticket; requires detached paused greeting.
  --greet              Start Claude with the SGSD greeting prompt. Default.
  --go                 Refused for fresh owners; greet, verify handover, then send go.
  --shell              Do not start Claude; leave operator pane at a shell.
  --no-attach          Create/reuse the tmux session but do not attach.
  --reset              Refused; existing owners require an acknowledged handover.
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
    --restore-id)
      [[ $# -ge 2 && -z "$RESTORE_ID" && "$2" =~ ^recovery-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]] \
        || die "--restore-id requires one valid recovery ticket"
      RESTORE_ID="$2"; shift 2 ;;
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
    --current-terminal)
      CURRENT_TERMINAL=true
      shift
      ;;
    --no-cockpit)
      OPEN_COCKPIT=false
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
if [[ -n "$RESTORE_ID" ]]; then
  [[ "$CURRENT_TERMINAL" == false && "$ATTACH" == false && "$CLAUDE_MODE" == greet && "$RESET" == false && "$DOCTOR" == false ]] \
    || die "recovery tickets require --greet --no-attach, never auto, shell, doctor or current-terminal mode"
fi

SGSD_LAUNCHER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)" \
  || die "cannot resolve launcher directory"

PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd -P)" || die "project not found: $PROJECT_DIR"
while [[ ! -d "$PROJECT_DIR/.planning" && "$PROJECT_DIR" != / ]]; do PROJECT_DIR="$(dirname "$PROJECT_DIR")"; done
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

select_codex() {
  local selector_helper="$SGSD_LAUNCHER_DIR/lib/codex-worker-shell.sh"
  [[ -f "$selector_helper" ]] || die "missing Codex selector helper: $selector_helper"
  PATH="$SGSD_CALLER_PATH"
  cd "$SGSD_CALLER_CWD" || die "cannot restore caller cwd: $SGSD_CALLER_CWD"
  # shellcheck source=lib/codex-worker-shell.sh
  source "$selector_helper"
  sgsd_codex_worker_bootstrap --dry-run
}

select_orchestrator() {
  node - "$SOURCE_DIR" <<'NODE'
const path = require('node:path');
try {
  const source = process.argv[2];
  const { loadRouting, resolveModel } = require(path.join(source, 'super-gsd/scripts/lib/model-routing.cjs'));
  const config = loadRouting(process.env.SGSD_MODEL_ROUTING_FILE || path.join(source, 'super-gsd/config/model-routing.json'));
  const override = process.env.SGSD_MODEL_OVERRIDE || process.env.SGSD_MODEL_ORCHESTRATOR;
  const selected = resolveModel({ config, role: 'orchestrator', override });
  if (selected.provider !== 'anthropic' || !['fable', 'opus', 'sonnet', 'haiku'].includes(selected.model)) {
    throw new Error('selected orchestrator requires an unsupported Claude model or provider');
  }
  process.stdout.write(selected.model);
} catch (error) {
  console.error(`SGSD orchestrator selection failed: ${error.message}`);
  process.exitCode = 1;
}
NODE
}

COCKPIT_SERVER_START="$SCRIPTS_DIR/start-cockpit-server.sh"

if [[ -z "$SESSION" ]]; then
  PROJECT_SLUG="$(basename "$PROJECT_DIR" | tr -c 'A-Za-z0-9_-' '-' | cut -c1-40)"
  PROJECT_DIGEST="$(printf '%s' "$PROJECT_DIR" | sha256sum)" || die "cannot derive project identity"
  SESSION="sgsd-${PROJECT_SLUG}-${PROJECT_DIGEST:0:12}"
fi
if [[ "$SESSION" =~ [^A-Za-z0-9_-] || ${#SESSION} -gt 80 ]]; then
  die "session name contains unsupported characters: $SESSION"
fi
# Do not propagate a stale inherited session label into a current-terminal owner.
if [[ "$CURRENT_TERMINAL" == true ]]; then unset SGSD_TMUX_SESSION; else export SGSD_TMUX_SESSION="$SESSION"; fi

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
  local model
  if model="$(select_orchestrator)"; then
    printf "  [OK]   orchestrator: %s\n" "$model"
  else
    printf "  [MISS] orchestrator selection is invalid\n"
  fi
  if [[ "${SGSD_CODEX_SELECTION_STATUS:-missing}" == ready ]]; then
    printf "  [OK]   codex: %s\n" "$SGSD_CODEX_APP_SERVER_COMMAND"
  else
    printf "  [MISS] codex (%s)\n" "${SGSD_CODEX_SELECTION_STATUS:-missing}"
  fi
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
  select_codex || die "explicit Codex selector is unavailable"
  doctor
  exit 0
fi

select_codex || die "explicit Codex selector is unavailable"
ORCHESTRATOR_MODEL=""
if [[ "$CLAUDE_MODE" != shell ]]; then
  ORCHESTRATOR_MODEL="$(select_orchestrator)" || die "cannot resolve a supported Claude orchestrator"
fi
if [[ "$CURRENT_TERMINAL" != true ]]; then command -v tmux >/dev/null 2>&1 || die "tmux is not installed"; fi
if [[ "$CLAUDE_MODE" != shell ]]; then command -v claude >/dev/null 2>&1 || die "Claude CLI not on PATH"; fi
[[ "${SGSD_CODEX_SELECTION_STATUS:-missing}" == ready ]] \
  || warn "Codex CLI not on incoming PATH or native fallback locations; Codex execution will fail until fixed"

mkdir -p "$PROJECT_DIR/.planning/metrics"
touch "$PROJECT_DIR/.planning/metrics/codex-live-output.txt" 2>/dev/null || true
touch "$PROJECT_DIR/.planning/metrics/narrative.md" 2>/dev/null || true
touch "$PROJECT_DIR/.planning/ORCHESTRATOR-LIVE.jsonl" 2>/dev/null || true

if [[ "$RESET" = true ]]; then die "managed sessions require an acknowledged handover; --reset does not establish safe ownership"; fi

ATLAS_GLOBAL="$SOURCE_DIR/super-gsd/tools/telemetry-atlas/global.cjs"
ATLAS_FLEET="$SOURCE_DIR/super-gsd/tools/telemetry-atlas/fleet.cjs"
if [[ "$CURRENT_TERMINAL" != true ]] && tmux has-session -t "=$SESSION" 2>/dev/null; then
  [[ -z "$RESTORE_ID" ]] || die "recovery session name already exists; coordinator must reconcile the exact owner"
  REUSE_PANE="$(tmux display-message -p -t "=$SESSION:0.0" '#{pane_id}')" || die "cannot inspect existing session"
  REUSE_PID="$(tmux display-message -p -t "=$SESSION:0.0" '#{pane_pid}')" || die "cannot inspect existing session process"
  node - "$ATLAS_FLEET" "$PROJECT_DIR" "$REUSE_PANE" "$REUSE_PID" <<'NODE' || die "existing session ownership is unverified; preserve it and use /sgsd-sessions for handover"
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
try {
  const [file, projectDir, pane, parent] = process.argv.slice(2);
  const root = process.env.SGSD_ATLAS_GLOBAL_ROOT || path.join(os.homedir(), '.local/state/sgsd/telemetry/global');
  const claims = require(file).status({root,projectDir}).claims;
  const claim = claims.find(row => row.status === 'bound' && row.active === true && row.tmux?.pane_id === pane);
  if (!claim || process.platform !== 'linux') throw Error('unverified');
  let pid = claim.identity.pid, related = false;
  for (let n=0; n<16 && pid>1; n++) {
    if (pid === Number(parent)) { related=true; break; }
    const stat=fs.readFileSync(`/proc/${pid}/stat`,'utf8');
    pid=Number(stat.slice(stat.lastIndexOf(')')+2).split(' ')[1]);
  }
  if (!related) throw Error('unverified');
} catch { process.exitCode=1; }
NODE
  echo "SGSD verified owned tmux session: $SESSION"
  if [[ "$ATTACH" = true ]]; then
    exec tmux attach-session -t "=$SESSION"
  fi
  exit 0
fi

# Shared Atlas prepares an exclusive registered run before any new provider.
ATLAS_ENV_PREFIX=""
ATLAS_EXIT_CMD=":"
ATLAS_ABORT_CMD=":"
if [[ "$CLAUDE_MODE" != shell ]]; then
  [[ "$PROJECT_PIN" != not-pinned ]] || die "project is not installed/pinned; run the normal sgsd-update before launch"
  [[ "$CLAUDE_MODE" != go ]] || die "fresh owned sessions start with a briefing; use --greet, verify identity/handover, then say go"
  [[ -f "$ATLAS_GLOBAL" ]] || die "shared Atlas runtime missing; run the normal sgsd-update"
  RESTORE_ARGS=()
  [[ -z "$RESTORE_ID" ]] || RESTORE_ARGS=(--restore-id "$RESTORE_ID")
  ATLAS_ENV_PREFIX="$(node "$ATLAS_GLOBAL" prepare --project-dir "$PROJECT_DIR" --require-managed --format prefix "${RESTORE_ARGS[@]}")" \
    || die "Atlas/ownership preparation refused; no provider started"
  [[ "$ATLAS_ENV_PREFIX" == env\ * && "$ATLAS_ENV_PREFIX" == *"SGSD_FLEET_MANAGED='1'"* ]] \
    || die "managed Atlas environment unavailable; no provider started"
  ATLAS_EXIT_CMD="$ATLAS_ENV_PREFIX node $(q "$ATLAS_GLOBAL") finish"
  ATLAS_ABORT_CMD="$ATLAS_ENV_PREFIX node $(q "$ATLAS_GLOBAL") abort"
  ATLAS_MONITOR="$(dirname "$ATLAS_GLOBAL")/monitor-schedule.cjs"
  if ! eval "$ATLAS_ENV_PREFIX node $(q "$ATLAS_MONITOR") include --project-dir $(q "$PROJECT_DIR") >/dev/null"; then
    eval "$ATLAS_ABORT_CMD" || warn "pending owner retained for explicit recovery"
    die "monitor enrollment failed; no provider started"
  fi
fi

PROJECT_Q="$(q "$PROJECT_DIR")"
SCRIPTS_Q="$(q "$SCRIPTS_DIR")"

GREET_PROMPT="You are the SGSD orchestrator. Use /sgsd-sessions for workspace/session health. Read this exact worktree's state and handover without resuming work. Report the original task, current hold, actual project/run ownership, shared receiver health, native delivery timestamp or pending, and operational delivery/gaps separately. Registry definitions are not running agents. Never claim registration is observed delivery. If state/checkpoint describes another worktree, mark context unresolved and ask before resuming. Keep the briefing short; no model probes or repeated full audits. Do not enter auto mode until ownership is bound, the handover is acknowledged and the operator says go."
if [[ -n "$RESTORE_ID" ]]; then
  GREET_PROMPT+=" This is a paused reboot recovery, not a resumed conversation. Read the recovery.previous_run_id and bounded context_refs in this SGSD_RUN_ID registration under SGSD_ATLAS_GLOBAL_ROOT. Missing or changed references mean context is unresolved. Preserve all existing approval holds. Do not replay workers, deployments, writes, payments or posting attempts. Give one short recovery briefing and wait."
fi

if [[ "$OPEN_COCKPIT" == true ]]; then start_localhost_cockpit; fi
if [[ "$CURRENT_TERMINAL" == true ]]; then
  [[ "$CLAUDE_MODE" != shell ]] || { echo "SGSD preflight only; no provider or Atlas run started"; exit 0; }
  cd "$PROJECT_DIR" || die "project disappeared before launch"
  # Run in the calling terminal, with a finish receipt after the provider exits.
  eval "$ATLAS_ENV_PREFIX claude --model $(q "$ORCHESTRATOR_MODEL") --dangerously-skip-permissions $(q "$GREET_PROMPT")"
  PROVIDER_EXIT=$?
  eval "$ATLAS_EXIT_CMD" || warn "owner release unverified; inspect fleet status before relaunch"
  exit "$PROVIDER_EXIT"
fi

if command -v claude >/dev/null 2>&1; then
  case "$CLAUDE_MODE" in
    go)
      OPERATOR_CMD="cd $PROJECT_Q; echo '[SGSD operator] starting Claude auto mode'; $ATLAS_ENV_PREFIX claude --model $(q "$ORCHESTRATOR_MODEL") --dangerously-skip-permissions 'go'; $ATLAS_EXIT_CMD; exec bash -l"
      ;;
    greet)
      OPERATOR_CMD="cd $PROJECT_Q; echo '[SGSD operator] starting Claude SGSD greeting'; $ATLAS_ENV_PREFIX claude --model $(q "$ORCHESTRATOR_MODEL") --dangerously-skip-permissions $(q "$GREET_PROMPT"); $ATLAS_EXIT_CMD; exec bash -l"
      ;;
    shell)
      OPERATOR_CMD="cd $PROJECT_Q; echo '[SGSD operator shell: unregistered]'; echo 'Run sg for a managed session'; exec bash -l"
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

tmux new-session \
  -e "PATH=$PATH" \
  -e "SGSD_TMUX_SESSION=$SESSION" \
  -e "SGSD_CODEX_APP_SERVER_COMMAND=${SGSD_CODEX_APP_SERVER_COMMAND-}" \
  -e "SGSD_CODEX_COMMAND=${SGSD_CODEX_COMMAND-}" \
  -e "SGSD_CODEX_APP_SERVER_ARGS=${SGSD_CODEX_APP_SERVER_ARGS-}" \
  -e "SGSD_CODEX_FORCE_LAUNCHER=${SGSD_CODEX_FORCE_LAUNCHER-}" \
  -d -s "$SESSION" -n SGSD -c "$PROJECT_DIR" "$OPERATOR_CMD" || {
    # No provider was created by this failed launch; release only its pending claim.
    if ! tmux has-session -t "=$SESSION" 2>/dev/null; then
      eval "$ATLAS_ABORT_CMD" || warn "pending owner retained for explicit recovery"
    else
      warn "session exists after failed creation response; owner retained for inspection"
    fi
    die "tmux session creation failed"
  }
OPERATOR_PANE="$(tmux display-message -p -t "=$SESSION:0" "#{pane_id}")"
tmux set-window-option -t "=$SESSION:0" remain-on-exit on >/dev/null
tmux set-option -t "=$SESSION" status on >/dev/null
tmux set-option -t "=$SESSION" status-left "[SGSD:$SESSION] " >/dev/null
tmux set-option -t "=$SESSION" status-right "#H %H:%M" >/dev/null

CODEX_PANE="$(tmux split-window -t "$OPERATOR_PANE" -h -c "$PROJECT_DIR" -P -F "#{pane_id}" "$CODEX_CMD")"
MISSION_PANE="$(tmux split-window -t "$OPERATOR_PANE" -v -c "$PROJECT_DIR" -P -F "#{pane_id}" "$MISSION_CMD")"
NARRATIVE_PANE="$(tmux split-window -t "$CODEX_PANE" -v -c "$PROJECT_DIR" -P -F "#{pane_id}" "$NARRATIVE_CMD")"
tmux select-pane -t "$OPERATOR_PANE" -T "operator"
tmux select-pane -t "$MISSION_PANE" -T "mission"
tmux select-pane -t "$CODEX_PANE" -T "codex"
tmux select-pane -t "$NARRATIVE_PANE" -T "narrative"
tmux select-layout -t "=$SESSION:0" tiled >/dev/null
tmux select-pane -t "$OPERATOR_PANE"

echo "SGSD tmux session started: $SESSION"
echo "Project: $PROJECT_DIR"
echo "Attach:  tmux attach -t =$SESSION"

if [[ "$ATTACH" = true ]]; then
  exec tmux attach-session -t "=$SESSION"
fi
