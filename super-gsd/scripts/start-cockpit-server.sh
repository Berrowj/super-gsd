#!/usr/bin/env bash
# ============================================================================
# Super GSD - localhost cockpit server startup
# ============================================================================
# Starts the v3.4 Node cockpit sidecar from a project worktree. The server binds
# 127.0.0.1 only, prefers port 7777, falls forward to the next free loopback
# port, writes .planning/runtime/cockpit-server.{pid,port,url}, and verifies
# /snapshot before reporting success.
#
# Usage:
#   bash super-gsd/scripts/start-cockpit-server.sh [--workspace PATH] [--port N]
# ============================================================================

set -u

PORT="${SGSD_COCKPIT_PORT:-7777}"
WORKSPACE=""
SOURCE_DIR="${SGSD_SOURCE_DIR:-}"
MAX_PORT_ATTEMPTS="${SGSD_COCKPIT_MAX_PORT_ATTEMPTS:-25}"

usage() {
  cat <<'EOF'
start-cockpit-server.sh - start the SGSD localhost cockpit

Options:
  --workspace PATH          Project worktree. Default: nearest parent with .planning/ and super-gsd/.
  --project PATH            Alias for --workspace.
  --port N                  Preferred loopback port. Default: 7777.
  --max-port-attempts N     Ports to try starting at --port. Default: 25.
  --help                    Show this help.
EOF
}

die() {
  echo "start-cockpit-server: ERROR: $*" >&2
  exit 1
}

warn() {
  echo "start-cockpit-server: WARN: $*" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace|--project)
      [[ $# -ge 2 ]] || die "$1 requires a path"
      WORKSPACE="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || die "--port requires a value"
      PORT="$2"
      shift 2
      ;;
    --max-port-attempts)
      [[ $# -ge 2 ]] || die "--max-port-attempts requires a value"
      MAX_PORT_ATTEMPTS="$2"
      shift 2
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

case "$PORT" in
  ''|*[!0-9]*) die "invalid port: $PORT" ;;
esac
case "$MAX_PORT_ATTEMPTS" in
  ''|*[!0-9]*) die "invalid max port attempts: $MAX_PORT_ATTEMPTS" ;;
esac
if [[ "$PORT" -lt 0 || "$PORT" -gt 65535 ]]; then
  die "invalid port: $PORT"
fi
if [[ "$MAX_PORT_ATTEMPTS" -lt 1 ]]; then
  die "max port attempts must be >= 1"
fi

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

command -v node >/dev/null 2>&1 || die "Node.js missing from PATH"

resolve_workspace() {
  if [[ -n "$WORKSPACE" ]]; then
    (cd "$WORKSPACE" 2>/dev/null && pwd -P) || return 1
    return 0
  fi

  local d
  d="$(pwd -P)"
  while [[ "$d" != "/" && "$d" != "" ]]; do
    if [[ -d "$d/.planning" && -d "$d/super-gsd/scripts" ]]; then
      printf '%s\n' "$d"
      return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

WORKSPACE="$(resolve_workspace)" || die "cannot resolve workspace; pass --workspace PATH"
if [[ -z "$SOURCE_DIR" ]]; then
  SOURCE_DIR="$WORKSPACE"
fi
SOURCE_DIR="$(cd "$SOURCE_DIR" 2>/dev/null && pwd -P)" ||
  die "cannot resolve canonical source directory: $SOURCE_DIR"
RUNTIME_DIR="$WORKSPACE/.planning/runtime"
SERVE_SCRIPT="$SOURCE_DIR/super-gsd/tools/cockpit-sidecar/serve.cjs"

[[ -d "$WORKSPACE/.planning" ]] || die "missing .planning/ under $WORKSPACE"
[[ -f "$SERVE_SCRIPT" ]] || die "canonical serve.cjs not found at $SERVE_SCRIPT"
mkdir -p "$RUNTIME_DIR" || die "cannot create runtime dir: $RUNTIME_DIR"

is_port_free() {
  local candidate="$1"
  node - "$candidate" <<'NODE'
const net = require('net');
const port = Number(process.argv[2]);
const server = net.createServer();
server.once('error', () => process.exit(1));
server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
  server.close(() => process.exit(0));
});
NODE
}

health_snapshot() {
  local candidate="$1"
  node - "$candidate" <<'NODE'
const http = require('http');
const port = Number(process.argv[2]);
const req = http.get({ host: '127.0.0.1', port, path: '/snapshot', timeout: 1500 }, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    if (res.statusCode !== 200) process.exit(1);
    try {
      const snapshot = JSON.parse(body);
      const milestone = snapshot.milestone || snapshot.state?.milestone || snapshot.frontmatter?.milestone || '?';
      const phase = snapshot.phase || snapshot.state?.phase || snapshot.frontmatter?.phase || '?';
      process.stdout.write(JSON.stringify({ milestone, phase }) + '\n');
      process.exit(0);
    } catch (_err) {
      process.exit(1);
    }
  });
});
req.on('timeout', () => req.destroy(new Error('timeout')));
req.on('error', () => process.exit(1));
NODE
}

pid_from_file() {
  local path="$1"
  [[ -f "$path" ]] || return 1
  local raw
  raw="$(head -n 1 "$path" 2>/dev/null | tr -d '[:space:]')"
  case "$raw" in
    ''|*[!0-9]*) return 1 ;;
  esac
  if kill -0 "$raw" >/dev/null 2>&1; then
    printf '%s\n' "$raw"
    return 0
  fi
  return 1
}

existing_pid_for_port() {
  local candidate="$1"
  local pid=""
  if [[ "$candidate" = "7777" ]]; then
    pid="$(pid_from_file "$RUNTIME_DIR/cockpit-server.pid" 2>/dev/null || true)"
  else
    pid="$(pid_from_file "$RUNTIME_DIR/cockpit-server-$candidate.pid" 2>/dev/null || true)"
  fi
  if [[ -z "$pid" ]]; then
    pid="$(pid_from_file "$RUNTIME_DIR/cockpit-server.pid" 2>/dev/null || true)"
  fi
  [[ -n "$pid" ]] && printf '%s\n' "$pid"
}

canonical_cockpit_pid() {
  local pid="$1" candidate="$2" arg previous=""
  local script_matches=false port_matches=false workspace_matches=false
  [[ -r "/proc/$pid/cmdline" ]] || return 1
  while IFS= read -r -d '' arg; do
    if [[ "$arg" == "$SERVE_SCRIPT" ]]; then
      script_matches=true
    fi
    if [[ "$previous" == --port && "$arg" == "$candidate" ]]; then
      port_matches=true
    fi
    if [[ "$previous" == --workspace && "$arg" == "$WORKSPACE" ]]; then
      workspace_matches=true
    fi
    previous="$arg"
  done < "/proc/$pid/cmdline"
  [[ "$script_matches" == true && "$port_matches" == true && "$workspace_matches" == true ]]
}

write_runtime_files() {
  local pid_value="$1"
  local actual_port="$2"
  if [[ -n "$pid_value" ]]; then
    printf '%s\n' "$pid_value" > "$RUNTIME_DIR/cockpit-server.pid"
  fi
  printf '%s\n' "$actual_port" > "$RUNTIME_DIR/cockpit-server.port"
  printf 'http://localhost:%s/\n' "$actual_port" > "$RUNTIME_DIR/cockpit-server.url"
}

select_free_port() {
  local start="$1"
  local attempts="$2"
  local offset candidate
  for ((offset = 0; offset < attempts; offset += 1)); do
    candidate=$((start + offset))
    if [[ "$candidate" -gt 65535 ]]; then
      break
    fi
    if is_port_free "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

existing_snapshot="$(health_snapshot "$PORT" 2>/dev/null || true)"
existing_pid="$(existing_pid_for_port "$PORT" || true)"
if [[ -n "$existing_snapshot" && -n "$existing_pid" ]] && canonical_cockpit_pid "$existing_pid" "$PORT"; then
  write_runtime_files "$existing_pid" "$PORT"
  echo "Cockpit server already healthy at http://localhost:$PORT/"
  echo "  Loopback health: http://127.0.0.1:$PORT/snapshot"
  node -e "const s=JSON.parse(process.argv[1]); console.log('  Snapshot: milestone ' + s.milestone + ' phase ' + s.phase)" "$existing_snapshot" 2>/dev/null || true
  echo "  Events: http://127.0.0.1:$PORT/events"
  if [[ -n "$existing_pid" ]]; then
    echo "  Stop with: kill $existing_pid"
  fi
  exit 0
fi
if [[ -n "$existing_snapshot" ]]; then
  warn "healthy listener on port $PORT is not the canonical cockpit; selecting another port"
fi

ACTUAL_PORT="$(select_free_port "$PORT" "$MAX_PORT_ATTEMPTS")" || \
  die "no free loopback port found from $PORT to $((PORT + MAX_PORT_ATTEMPTS - 1))"

STDOUT_PATH="$RUNTIME_DIR/cockpit-server-$ACTUAL_PORT.out.log"
STDERR_PATH="$RUNTIME_DIR/cockpit-server-$ACTUAL_PORT.err.log"

echo "Starting cockpit server on port $ACTUAL_PORT..."
node "$SERVE_SCRIPT" --port "$ACTUAL_PORT" --workspace "$WORKSPACE" >"$STDOUT_PATH" 2>"$STDERR_PATH" &
SERVER_PID="$!"
printf '%s\n' "$SERVER_PID" > "$RUNTIME_DIR/cockpit-server.pid"
echo "PID $SERVER_PID -> $RUNTIME_DIR/cockpit-server.pid"

snapshot=""
for _attempt in $(seq 1 60); do
  sleep 0.25
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    break
  fi
  snapshot="$(health_snapshot "$ACTUAL_PORT" 2>/dev/null || true)"
  if [[ -n "$snapshot" ]]; then
    break
  fi
done

if [[ -n "$snapshot" ]]; then
  write_runtime_files "$SERVER_PID" "$ACTUAL_PORT"
  echo "Cockpit server healthy at http://localhost:$ACTUAL_PORT/"
  echo "  Loopback health: http://127.0.0.1:$ACTUAL_PORT/snapshot"
  node -e "const s=JSON.parse(process.argv[1]); console.log('  Snapshot: milestone ' + s.milestone + ' phase ' + s.phase)" "$snapshot" 2>/dev/null || true
  echo "  Events: http://127.0.0.1:$ACTUAL_PORT/events"
  echo "  Stop with: kill $SERVER_PID"
  exit 0
fi

if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
  kill "$SERVER_PID" >/dev/null 2>&1 || true
fi
rm -f "$RUNTIME_DIR/cockpit-server.pid"
echo "ERROR: Cockpit server did not become healthy within 15 seconds" >&2
if [[ -f "$STDERR_PATH" ]]; then
  echo "Recent stderr:" >&2
  tail -n 20 "$STDERR_PATH" >&2 || true
fi
exit 1
