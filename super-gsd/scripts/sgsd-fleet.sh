#!/usr/bin/env bash
# Super GSD Fleet Cockpit lifecycle wrapper. Read-only.

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "$0")"
SERVER_CJS="$SCRIPT_DIR/../tools/fleet-cockpit/server.cjs"
CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/super-gsd/fleet-cockpit"

usage() {
  echo "Usage: $0 start|stop|status [project-dir] [--host HOST] [--port PORT] [--interval SECONDS]"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

is_positive_integer() {
  case "$1" in
    ''|*[!0-9]*|0) return 1 ;;
    *) return 0 ;;
  esac
}

is_running() {
  local pid_file="$1"
  local pid
  [ -f "$pid_file" ] || return 1
  pid="$(sed -n '1p' "$pid_file" 2>/dev/null)"
  is_positive_integer "$pid" || return 1
  kill -0 "$pid" 2>/dev/null
}

producer_loop() {
  local project_dir="$1"
  local interval="$2"
  local porcelain_file="$3"
  while true; do
    if git -C "$project_dir" worktree list --porcelain >"$porcelain_file"; then
      printf '%s\n' 'SGSD_FLEET_FRAME_BEGIN'
      cat "$porcelain_file"
      printf '%s\n' 'SGSD_FLEET_FRAME_END'
    else
      echo "ERROR: Git worktree discovery failed; cache was not refreshed" >&2
    fi
    sleep "$interval"
  done
}

serve_internal() {
  local project_dir="$1"
  local host="$2"
  local port="$3"
  local interval="$4"
  local frame_pipe="$CACHE_ROOT/frame-$port-$$.fifo"
  local porcelain_file="$CACHE_ROOT/porcelain-$port-$$.tmp"
  local producer_pid=''
  local server_pid=''

  cleanup() {
    trap - EXIT
    if [ -n "$producer_pid" ]; then
      kill "$producer_pid" 2>/dev/null || true
      wait "$producer_pid" 2>/dev/null || true
    fi
    if [ -n "$server_pid" ]; then
      kill "$server_pid" 2>/dev/null || true
      wait "$server_pid" 2>/dev/null || true
    fi
    rm -f "$frame_pipe" "$porcelain_file"
  }

  trap cleanup EXIT
  trap 'exit 0' INT TERM
  rm -f "$frame_pipe"
  mkfifo "$frame_pipe" || fail "Could not create framing pipe: $frame_pipe"
  producer_loop "$project_dir" "$interval" "$porcelain_file" >"$frame_pipe" &
  producer_pid=$!
  SGSD_FLEET_FRAMED_STDIN=1 node "$SERVER_CJS" \
    --root "$project_dir" --host "$host" --port "$port" \
    --interval "$interval" <"$frame_pipe" &
  server_pid=$!
  wait "$server_pid"
}

if [ "${1:-}" = '__serve' ]; then
  shift
  serve_internal "$@"
  exit $?
fi

ACTION="${1:-status}"
if [ "$#" -gt 0 ]; then shift; fi
PROJECT_DIR='.'
HOST='127.0.0.1'
PORT='7777'
INTERVAL='20'

if [ "$#" -gt 0 ] && [ "${1#--}" = "$1" ]; then
  PROJECT_DIR="$1"
  shift
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      [ "$#" -ge 2 ] || fail '--host requires a value'
      HOST="$2"
      shift 2
      ;;
    --port)
      [ "$#" -ge 2 ] || fail '--port requires a value'
      PORT="$2"
      shift 2
      ;;
    --interval)
      [ "$#" -ge 2 ] || fail '--interval requires a value'
      INTERVAL="$2"
      shift 2
      ;;
    *)
      usage
      fail "Unknown argument: $1"
      ;;
  esac
done

case "$ACTION" in
  start|stop|status) ;;
  *) usage; fail "Unknown action: $ACTION" ;;
esac

PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd)" \
  || fail "Project directory does not exist"
is_positive_integer "$PORT" || fail 'Port must be a positive integer'
[ "$PORT" -le 65535 ] || fail 'Port must be no greater than 65535'
is_positive_integer "$INTERVAL" || fail 'Interval must be a positive integer'
[ "$INTERVAL" -le 86400 ] || fail 'Interval must be no greater than 86400'
[ -n "$HOST" ] || fail 'Host must not be empty'

PID_FILE="$CACHE_ROOT/fleet-$PORT.pid"
LOG_FILE="$CACHE_ROOT/fleet-$PORT.log"

case "$ACTION" in
  start)
    [ -d "$PROJECT_DIR/.planning" ] \
      || fail "No .planning/ directory in $PROJECT_DIR"
    command -v git >/dev/null 2>&1 || fail 'git is required'
    command -v node >/dev/null 2>&1 || fail 'node is required'
    command -v mkfifo >/dev/null 2>&1 || fail 'mkfifo is required'
    [ -f "$SERVER_CJS" ] || fail "Fleet server not found: $SERVER_CJS"
    git -C "$PROJECT_DIR" rev-parse --show-toplevel >/dev/null 2>&1 \
      || fail "Not a Git checkout: $PROJECT_DIR"
    mkdir -p "$CACHE_ROOT" || fail "Could not create cache directory: $CACHE_ROOT"
    if is_running "$PID_FILE"; then
      echo "SGSD Fleet Cockpit is already running (PID $(sed -n '1p' "$PID_FILE"))"
      exit 0
    fi
    rm -f "$PID_FILE"
    nohup bash "$SCRIPT_PATH" __serve "$PROJECT_DIR" "$HOST" "$PORT" \
      "$INTERVAL" >>"$LOG_FILE" 2>&1 &
    supervisor_pid=$!
    printf '%s\n' "$supervisor_pid" >"$PID_FILE"
    sleep 1
    if ! kill -0 "$supervisor_pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      fail "Fleet Cockpit failed to start; see $LOG_FILE"
    fi
    if [ "$HOST" = '0.0.0.0' ]; then
      echo "SGSD Fleet Cockpit: http://127.0.0.1:$PORT"
      echo 'WARNING: --host 0.0.0.0 exposes the read-only service to the LAN.'
    else
      echo "SGSD Fleet Cockpit: http://$HOST:$PORT"
    fi
    echo "Log: $LOG_FILE"
    ;;
  stop)
    if ! is_running "$PID_FILE"; then
      rm -f "$PID_FILE"
      echo 'SGSD Fleet Cockpit is already stopped'
      exit 0
    fi
    pid="$(sed -n '1p' "$PID_FILE")"
    kill "$pid" 2>/dev/null || true
    attempts=0
    while kill -0 "$pid" 2>/dev/null && [ "$attempts" -lt 50 ]; do
      sleep 0.1
      attempts=$((attempts + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
      fail "Fleet Cockpit did not stop; PID $pid remains live"
    fi
    rm -f "$PID_FILE"
    echo 'SGSD Fleet Cockpit stopped'
    ;;
  status)
    if is_running "$PID_FILE"; then
      echo "SGSD Fleet Cockpit is running (PID $(sed -n '1p' "$PID_FILE"))"
      echo "URL: http://$HOST:$PORT"
      exit 0
    fi
    rm -f "$PID_FILE"
    echo 'SGSD Fleet Cockpit is stopped'
    exit 1
    ;;
esac
