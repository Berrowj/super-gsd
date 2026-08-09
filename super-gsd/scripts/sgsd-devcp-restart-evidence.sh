#!/usr/bin/env bash
# Identity-verified one-shot restart evidence for devcp SGSD runtimes.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: sgsd-devcp-restart-evidence.sh \
  --project ABSOLUTE_PROJECT --session TMUX_SESSION \
  --scripts-dir ABSOLUTE_SCRIPTS --agents-dir ABSOLUTE_AGENTS \
  --source-dir ABSOLUTE_SOURCE --evidence ABSOLUTE_JSON

The helper displays canonical MCP and cockpit command lines, requires KILL,
then invokes sgsd-remote-tmux.sh with --reset --greet --no-attach.
EOF
}

die() { printf 'sgsd-devcp-restart-evidence: ERROR: %s\n' "$*" >&2; exit 1; }

project=""
session=""
scripts_dir=""
agents_dir=""
source_dir=""
evidence=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) [[ $# -ge 2 ]] || die '--project requires a value'; project="$2"; shift 2 ;;
    --session) [[ $# -ge 2 ]] || die '--session requires a value'; session="$2"; shift 2 ;;
    --scripts-dir) [[ $# -ge 2 ]] || die '--scripts-dir requires a value'; scripts_dir="$2"; shift 2 ;;
    --agents-dir) [[ $# -ge 2 ]] || die '--agents-dir requires a value'; agents_dir="$2"; shift 2 ;;
    --source-dir) [[ $# -ge 2 ]] || die '--source-dir requires a value'; source_dir="$2"; shift 2 ;;
    --evidence) [[ $# -ge 2 ]] || die '--evidence requires a value'; evidence="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

for required in project session scripts_dir agents_dir source_dir evidence; do
  [[ -n "${!required}" ]] || die "missing --${required//_/-}"
done
for directory in project scripts_dir agents_dir source_dir; do
  value="${!directory}"
  [[ "$value" == /* && "$value" != / && -d "$value" ]] ||
    die "--${directory//_/-} must be an existing absolute directory"
  printf -v "$directory" '%s' "$(cd "$value" && pwd -P)"
done
[[ "$evidence" == /* && "$evidence" != / ]] || die '--evidence must be an absolute file path'
[[ -d "$project/.planning" ]] || die "project has no .planning directory: $project"
remote_tmux="$scripts_dir/sgsd-remote-tmux.sh"
[[ -r "$remote_tmux" ]] || die "sgsd-remote-tmux.sh is missing: $remote_tmux"
command -v node >/dev/null 2>&1 || die 'node is required'
command -v tmux >/dev/null 2>&1 || die 'tmux is required'

runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/sgsd-restart-evidence.XXXXXX")"
cleanup() { rm -rf -- "$runtime_dir"; }
trap cleanup EXIT
before_mcp="$runtime_dir/before-mcp.jsonl"
after_mcp="$runtime_dir/after-mcp.jsonl"
before_cockpit="$runtime_dir/before-cockpit.json"
after_cockpit="$runtime_dir/after-cockpit.json"

load_proc_identity() {
  local pid="$1" stat_line stat_tail
  [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/stat" && -r "/proc/$pid/cmdline" ]] || return 1
  IFS= read -r stat_line < "/proc/$pid/stat" || return 1
  stat_tail="${stat_line##*) }"
  read -r -a stat_fields <<< "$stat_tail"
  [[ ${#stat_fields[@]} -ge 20 ]] || return 1
  PROC_PID="$pid"
  PROC_PPID="${stat_fields[1]}"
  PROC_START_TICKS="${stat_fields[19]}"
  printf -v PROC_CMDLINE '%s' "$(tr '\0' ' ' < "/proc/$pid/cmdline")"
  PROC_CMDLINE="${PROC_CMDLINE% }"
  [[ -n "$PROC_CMDLINE" ]] || return 1
}

append_identity() {
  local destination="$1"
  SGSD_IDENTITY_DEST="$destination" SGSD_IDENTITY_PID="$PROC_PID" \
  SGSD_IDENTITY_PPID="$PROC_PPID" SGSD_IDENTITY_START="$PROC_START_TICKS" \
  SGSD_IDENTITY_CMDLINE="$PROC_CMDLINE" node <<'NODE'
const fs = require('node:fs');
const row = {
  pid: Number(process.env.SGSD_IDENTITY_PID),
  parent_pid: Number(process.env.SGSD_IDENTITY_PPID),
  start_ticks: process.env.SGSD_IDENTITY_START,
  command_line: process.env.SGSD_IDENTITY_CMDLINE,
  live_at_write: true,
};
fs.appendFileSync(process.env.SGSD_IDENTITY_DEST, JSON.stringify(row) + '\n');
NODE
}

collect_mcp_identities() {
  local destination="$1" stat_file pid lower_cmd
  : > "$destination"
  mcp_count=0
  for stat_file in /proc/[0-9]*/stat; do
    pid="${stat_file#/proc/}"
    pid="${pid%/stat}"
    load_proc_identity "$pid" || continue
    lower_cmd="${PROC_CMDLINE,,}"
    if [[ "$lower_cmd" == *mcp* && "$PROC_CMDLINE" == *"$source_dir"* ]]; then
      append_identity "$destination"
      mcp_count=$((mcp_count + 1))
    fi
  done
}

write_cockpit_identity() {
  local destination="$1" require_canonical="$2" pid_file="$project/.planning/runtime/cockpit-server.pid" pid
  [[ -r "$pid_file" ]] || return 1
  IFS= read -r pid < "$pid_file"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  load_proc_identity "$pid" || return 1
  [[ "$PROC_CMDLINE" == *cockpit-sidecar/serve.cjs* && "$PROC_CMDLINE" == *"$project"* ]] || return 1
  if [[ "$require_canonical" == true ]]; then
    [[ "$PROC_CMDLINE" == *"$scripts_dir"* ]] || return 1
  fi
  : > "$destination"
  append_identity "$destination"
}

print_identity_cmdlines() {
  local label="$1" file="$2"
  SGSD_IDENTITY_FILE="$file" SGSD_IDENTITY_LABEL="$label" node <<'NODE'
const fs = require('node:fs');
const rows = fs.readFileSync(process.env.SGSD_IDENTITY_FILE, 'utf8')
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
for (const row of rows) {
  process.stdout.write(`${process.env.SGSD_IDENTITY_LABEL} PID=${row.pid} start_ticks=${row.start_ticks} cmdline=${row.command_line}\n`);
}
NODE
}

identity_live() {
  local pid="$1" expected_start="$2" kind="$3"
  kill -0 "$pid" 2>/dev/null || return 1
  load_proc_identity "$pid" || return 1
  [[ "$PROC_START_TICKS" == "$expected_start" ]] || return 1
  case "$kind" in
    mcp) [[ "${PROC_CMDLINE,,}" == *mcp* && "$PROC_CMDLINE" == *"$source_dir"* ]] ;;
    cockpit) [[ "$PROC_CMDLINE" == *cockpit-sidecar/serve.cjs* && "$PROC_CMDLINE" == *"$project"* ]] ;;
    *) return 1 ;;
  esac
}

terminate_identities() {
  local file="$1" kind="$2" pid start_ticks expected_cmdline
  while IFS=$'\t' read -r pid start_ticks expected_cmdline; do
    identity_live "$pid" "$start_ticks" "$kind" ||
      die "$kind identity changed before termination: $pid|$start_ticks"
    [[ "$PROC_CMDLINE" == "$expected_cmdline" ]] ||
      die "$kind command line changed before termination: $pid|$start_ticks"
    kill -TERM "$pid"
    for _ in {1..50}; do
      identity_live "$pid" "$start_ticks" "$kind" || break
      sleep 0.1
    done
    identity_live "$pid" "$start_ticks" "$kind" &&
      die "$kind identity remained live after termination: $pid|$start_ticks"
  done < <(SGSD_IDENTITY_FILE="$file" node <<'NODE'
const fs = require('node:fs');
for (const line of fs.readFileSync(process.env.SGSD_IDENTITY_FILE, 'utf8').split(/\r?\n/).filter(Boolean)) {
  const row = JSON.parse(line);
  process.stdout.write(`${row.pid}\t${row.start_ticks}\t${row.command_line.replaceAll('\t', ' ')}\n`);
}
NODE
  )
}

tmux has-session -t "$session" 2>/dev/null || die "tmux session is not live: $session"
read -r before_session_id before_creation_epoch before_server_pid < <(
  tmux display-message -p -t "$session" '#{session_id} #{session_created} #{pid}'
)
[[ -n "$before_session_id" && -n "$before_creation_epoch" && -n "$before_server_pid" ]] ||
  die 'could not capture tmux session_id, creation_epoch, and server_pid'

collect_mcp_identities "$before_mcp"
if [[ "$mcp_count" -lt 1 ]]; then
  die "no canonical MCP process uses source root: $source_dir"
fi
write_cockpit_identity "$before_cockpit" false ||
  die "cockpit-server.pid does not identify a live cockpit for $project"
printf 'Verified command lines selected for termination:\n'
print_identity_cmdlines 'MCP cmdline' "$before_mcp"
print_identity_cmdlines 'cockpit cmdline' "$before_cockpit"
read -r -p 'Type KILL to terminate only these verified identities: ' confirmation
[[ "$confirmation" == KILL ]] || die 'confirmation declined; no signal sent'

terminate_identities "$before_mcp" mcp
terminate_identities "$before_cockpit" cockpit

exact_command="$remote_tmux --project $project --session $session --scripts-dir $scripts_dir --agents-dir $agents_dir --source-dir $source_dir --reset --greet --no-attach"
set +e
restart_output="$("$remote_tmux" --project "$project" --session "$session" \
  --scripts-dir "$scripts_dir" --agents-dir "$agents_dir" --source-dir "$source_dir" \
  --reset --greet --no-attach 2>&1)"
restart_code=$?
set -e
[[ $restart_code -eq 0 ]] || die "sgsd-remote-tmux.sh restart failed with status $restart_code"

deadline=$((SECONDS + 60))
after_ready=false
while (( SECONDS < deadline )); do
  collect_mcp_identities "$after_mcp"
  if [[ "$mcp_count" -ge 1 ]] && write_cockpit_identity "$after_cockpit" true; then
    after_ready=true
    break
  fi
  sleep 1
done
[[ "$after_ready" == true ]] || die 'timed out waiting for canonical after MCP and cockpit identities'

tmux has-session -t "$session" 2>/dev/null || die 'tmux session is absent after restart'
read -r after_session_id after_creation_epoch after_server_pid < <(
  tmux display-message -p -t "$session" '#{session_id} #{session_created} #{pid}'
)
tmux_session_identity_changed=false
tmux_server_pid_changed=false
if [[ "$after_session_id" != "$before_session_id" || "$after_creation_epoch" != "$before_creation_epoch" ]]; then
  tmux_session_identity_changed=true
fi
if [[ "$after_server_pid" != "$before_server_pid" ]]; then
  tmux_server_pid_changed=true
fi
if [[ "$tmux_session_identity_changed" != true && "$tmux_server_pid_changed" != true ]]; then
  die 'tmux session ID, creation epoch, and server PID tuple did not change'
fi

identity_intersection="$(SGSD_BEFORE="$before_mcp" SGSD_AFTER="$after_mcp" node <<'NODE'
const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const before = new Set(read(process.env.SGSD_BEFORE).map((row) => `${row.pid}|${row.start_ticks}`));
const overlap = read(process.env.SGSD_AFTER)
  .map((row) => `${row.pid}|${row.start_ticks}`).filter((key) => before.has(key));
process.stdout.write(JSON.stringify(overlap));
NODE
)"
[[ "$identity_intersection" == '[]' ]] || die "MCP identity_intersection is not empty: $identity_intersection"

cockpit_identity_changed="$(SGSD_BEFORE="$before_cockpit" SGSD_AFTER="$after_cockpit" node <<'NODE'
const fs = require('node:fs');
const before = JSON.parse(fs.readFileSync(process.env.SGSD_BEFORE, 'utf8'));
const after = JSON.parse(fs.readFileSync(process.env.SGSD_AFTER, 'utf8'));
process.stdout.write(String(before.pid !== after.pid || before.start_ticks !== after.start_ticks));
NODE
)"
[[ "$cockpit_identity_changed" == true ]] || die 'cockpit_identity_changed is false'

after_identities_live=true
while IFS=$'\t' read -r pid start_ticks; do
  identity_live "$pid" "$start_ticks" mcp || after_identities_live=false
done < <(SGSD_IDENTITY_FILE="$after_mcp" node <<'NODE'
const fs = require('node:fs');
for (const line of fs.readFileSync(process.env.SGSD_IDENTITY_FILE, 'utf8').split(/\r?\n/).filter(Boolean)) {
  const row = JSON.parse(line);
  process.stdout.write(`${row.pid}\t${row.start_ticks}\n`);
}
NODE
)
read -r cockpit_pid cockpit_ticks < <(SGSD_IDENTITY_FILE="$after_cockpit" node <<'NODE'
const fs = require('node:fs');
const row = JSON.parse(fs.readFileSync(process.env.SGSD_IDENTITY_FILE, 'utf8'));
process.stdout.write(`${row.pid} ${row.start_ticks}\n`);
NODE
)
identity_live "$cockpit_pid" "$cockpit_ticks" cockpit || after_identities_live=false
[[ "$after_identities_live" == true ]] || die 'after_identities_live check failed'
canonical_mcp_provenance=true

set +e
doctor_output="$("$remote_tmux" --project "$project" --session "$session" \
  --scripts-dir "$scripts_dir" --agents-dir "$agents_dir" --source-dir "$source_dir" \
  --doctor 2>&1)"
doctor_code=$?
set -e
[[ $doctor_code -eq 0 ]] || die "sgsd-remote-tmux.sh doctor failed with status $doctor_code"

captured_utc="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
machine="$(hostname)"
redacted_output="$(printf '%s\n%s\n' "$restart_output" "$doctor_output" |
  sed -E 's/((api[_-]?key|token|password|secret)[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1<redacted>/Ig')"
mkdir -p -- "$(dirname "$evidence")"
temporary_evidence="$evidence.tmp.$$"
SGSD_SCHEMA='sgsd.restart-evidence.v1' SGSD_PROJECT="$project" \
SGSD_SESSION="$session" SGSD_SOURCE_DIR="$source_dir" SGSD_EXACT_COMMAND="$exact_command" \
SGSD_CAPTURED_UTC="$captured_utc" SGSD_MACHINE="$machine" SGSD_OUTPUT="$redacted_output" \
SGSD_BEFORE_MCP="$before_mcp" SGSD_AFTER_MCP="$after_mcp" \
SGSD_BEFORE_COCKPIT="$before_cockpit" SGSD_AFTER_COCKPIT="$after_cockpit" \
SGSD_IDENTITY_INTERSECTION="$identity_intersection" \
SGSD_COCKPIT_CHANGED="$cockpit_identity_changed" \
SGSD_TMUX_SESSION_CHANGED="$tmux_session_identity_changed" \
SGSD_TMUX_SERVER_CHANGED="$tmux_server_pid_changed" \
SGSD_BEFORE_SESSION_ID="$before_session_id" SGSD_BEFORE_CREATION="$before_creation_epoch" \
SGSD_BEFORE_SERVER_PID="$before_server_pid" SGSD_AFTER_SESSION_ID="$after_session_id" \
SGSD_AFTER_CREATION="$after_creation_epoch" SGSD_AFTER_SERVER_PID="$after_server_pid" \
SGSD_EVIDENCE_TEMP="$temporary_evidence" node <<'NODE'
const fs = require('node:fs');
const readLines = (file) => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const readOne = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const base = {
  exit_status: 'passed',
  exact_command: process.env.SGSD_EXACT_COMMAND,
  captured_utc: process.env.SGSD_CAPTURED_UTC,
  machine: process.env.SGSD_MACHINE,
  live_at_write: true,
  redacted_output: process.env.SGSD_OUTPUT,
};
const mcp = {
  ...base,
  before_mcp_present: true,
  after_mcp_present: true,
  identity_intersection: JSON.parse(process.env.SGSD_IDENTITY_INTERSECTION),
  canonical_mcp_provenance: true,
  after_identities_live: true,
  before: readLines(process.env.SGSD_BEFORE_MCP),
  after: readLines(process.env.SGSD_AFTER_MCP),
};
const cockpit = {
  ...base,
  cockpit_identity_changed: process.env.SGSD_COCKPIT_CHANGED === 'true',
  after_identities_live: true,
  before: readOne(process.env.SGSD_BEFORE_COCKPIT),
  after: readOne(process.env.SGSD_AFTER_COCKPIT),
};
const tmux = {
  ...base,
  tmux_session_identity_changed: process.env.SGSD_TMUX_SESSION_CHANGED === 'true',
  tmux_server_pid_changed: process.env.SGSD_TMUX_SERVER_CHANGED === 'true',
  before: {
    session_id: process.env.SGSD_BEFORE_SESSION_ID,
    creation_epoch: Number(process.env.SGSD_BEFORE_CREATION),
    server_pid: Number(process.env.SGSD_BEFORE_SERVER_PID),
  },
  after: {
    session_id: process.env.SGSD_AFTER_SESSION_ID,
    creation_epoch: Number(process.env.SGSD_AFTER_CREATION),
    server_pid: Number(process.env.SGSD_AFTER_SERVER_PID),
  },
};
const evidence = {
  schema: process.env.SGSD_SCHEMA,
  exit_status: 'passed',
  project: process.env.SGSD_PROJECT,
  session: process.env.SGSD_SESSION,
  source_dir: process.env.SGSD_SOURCE_DIR,
  exact_command: process.env.SGSD_EXACT_COMMAND,
  captured_utc: process.env.SGSD_CAPTURED_UTC,
  machine: process.env.SGSD_MACHINE,
  live_at_write: true,
  redacted_output: process.env.SGSD_OUTPUT,
  components: { mcp_restart: mcp, cockpit_restart: cockpit, tmux_restart: tmux },
};
fs.writeFileSync(process.env.SGSD_EVIDENCE_TEMP, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
NODE
mv -- "$temporary_evidence" "$evidence"
printf 'restart_evidence=%s\n' "$evidence"
