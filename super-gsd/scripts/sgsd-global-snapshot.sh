#!/usr/bin/env bash
# Snapshot, verify, and exactly restore install.sh's global mutation boundary.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
INSTALLER="$SCRIPT_DIR/../install.sh"
TARGETS=(
  ".claude/agents"
  ".claude/commands"
  ".claude/hooks"
  ".claude/settings.json"
  ".claude/get-shit-done/templates/super-gsd"
  ".claude/get-shit-done/workflows"
  ".claude/get-shit-done/config/model-routing.json"
  ".claude/super-gsd/scripts"
  ".local/bin/sgsd"
)

usage() {
  cat <<'EOF'
Usage:
  sgsd-global-snapshot.sh create  --home ABSOLUTE_HOME --output-dir ABSOLUTE_DIR
  sgsd-global-snapshot.sh verify  --home ABSOLUTE_HOME --snapshot-dir ABSOLUTE_DIR
  sgsd-global-snapshot.sh restore --home ABSOLUTE_HOME --snapshot-dir ABSOLUTE_DIR --failed-candidate-dir ABSOLUTE_DIR

create writes manifest-before.jsonl and archive.tar. verify writes
manifest-after.jsonl and proves the pre-install scripts path set is a subset of
the post-install set while every scripts extra remains byte-identical. restore
quarantines the failed candidate before reproducing the exact saved manifest.
EOF
}
die() { printf 'sgsd-global-snapshot: ERROR: %s\n' "$*" >&2; exit 1; }

normalize_path_arg() {
  local value="$1"
  case "$(uname -s 2>/dev/null || true)" in
    MINGW*|MSYS*|CYGWIN*)
      if command -v cygpath >/dev/null 2>&1; then cygpath -u -- "$value"; return; fi
      ;;
  esac
  printf '%s\n' "$value"
}
node_path_arg() {
  local value="$1"
  case "${OSTYPE:-}" in
    msys*|cygwin*|win32*)
      if command -v cygpath >/dev/null 2>&1; then
        cygpath -w -- "$value"
        return
      fi
      ;;
  esac
  printf '%s\n' "$value"
}
resolved_dir() {
  local candidate="$1"
  if command -v realpath >/dev/null 2>&1; then realpath -- "$candidate"
  elif command -v readlink >/dev/null 2>&1; then readlink -f -- "$candidate"
  else (cd "$candidate" && pwd -P)
  fi
}
require_absolute_safe_dir_value() {
  local label="$1" value="$2"
  [[ -n "$value" ]] || die "$label must not be empty"
  [[ "$value" != "/" && "$value" != "~" ]] || die "$label is unsafe: $value"
  [[ "$value" == /* ]] || die "$label must be absolute: $value"
}
validate_home() {
  local requested="$1" expected resolved
  [[ "$requested" != "~"* ]] || die "--home contains an unexpanded tilde path: $requested"
  requested="$(normalize_path_arg "$requested")"
  require_absolute_safe_dir_value "--home" "$requested"
  [[ -d "$requested" ]] || die "--home does not exist: $requested"
  [[ -n "${HOME:-}" ]] || die "current HOME is empty"
  expected="$(normalize_path_arg "$HOME")"
  [[ -d "$expected" ]] || die "current HOME does not exist: $expected"
  resolved="$(resolved_dir "$requested")" || die "cannot resolve --home: $requested"
  expected="$(resolved_dir "$expected")" || die "cannot resolve current HOME"
  [[ "$resolved" == "$expected" ]] || die "--home differs from the current user's resolved home"
  printf '%s\n' "$resolved"
}
validate_contract() {
  [[ -r "$INSTALLER" ]] || die "install.sh is missing or unreadable: $INSTALLER"
  local markers=(
    'AGENTS_DIR="$CLAUDE_DIR/agents"'
    'COMMANDS_DIR="$CLAUDE_DIR/commands"'
    'HOOKS_DIR="$CLAUDE_DIR/hooks"'
    'SETTINGS_FILE="$CLAUDE_DIR/settings.json"'
    'TEMPLATES_DIR="$GSD_DIR/templates/super-gsd"'
    '"$GSD_DIR/workflows'
    '"$GSD_DIR/config/model-routing.json"'
    'GLOBAL_SCRIPTS_DIR="$CLAUDE_DIR/super-gsd/scripts"'
    '"$LOCAL_BIN_DIR/sgsd"'
  )
  local marker
  for marker in "${markers[@]}"; do
    grep -Fq -- "$marker" "$INSTALLER" ||
      die "install.sh contract mismatch: missing global target marker $marker"
  done
}
validate_storage_path() {
  local label="$1" raw="$2" home="$3" normalized target live
  normalized="$(normalize_path_arg "$raw")"
  require_absolute_safe_dir_value "$label" "$normalized"
  for target in "${TARGETS[@]}"; do
    live="$home/$target"
    case "$normalized/" in "$live/"*) die "$label must remain outside live install target $target" ;; esac
  done
  printf '%s\n' "$normalized"
}

write_manifest() {
  local home="$1" destination="$2"
  local node_home node_destination
  node_home="$(node_path_arg "$home")"
  node_destination="$(node_path_arg "$destination")"
  SGSD_SNAPSHOT_HOME="$node_home" SGSD_SNAPSHOT_DESTINATION="$node_destination" \
  SGSD_SNAPSHOT_TARGETS="$(printf '%s\n' "${TARGETS[@]}")" node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const home = process.env.SGSD_SNAPSHOT_HOME;
const destination = process.env.SGSD_SNAPSHOT_DESTINATION;
const targets = process.env.SGSD_SNAPSHOT_TARGETS.split('\n').filter(Boolean);
const rows = [];
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function walk(full, relative) {
  const stat = fs.lstatSync(full);
  const type = stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : 'file';
  rows.push({
    path: relative.split(path.sep).join('/'), type, mode: stat.mode & 0o7777,
    link: type === 'symlink' ? fs.readlinkSync(full) : null,
    sha256: type === 'file' ? sha256(full) : null,
  });
  if (type === 'directory') {
    for (const name of fs.readdirSync(full).sort()) walk(path.join(full, name), path.join(relative, name));
  }
}
for (const target of targets) {
  const full = path.join(home, ...target.split('/'));
  try { walk(full, target); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    rows.push({ path: target, type: 'absent', mode: null, link: null, sha256: null });
  }
}
fs.writeFileSync(destination, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
NODE
}
write_scripts_extras() {
  local home="$1" manifest="$2" destination="$3"
  local node_home node_manifest node_destination
  node_home="$(node_path_arg "$home")"
  node_manifest="$(node_path_arg "$manifest")"
  node_destination="$(node_path_arg "$destination")"
  SGSD_SNAPSHOT_HOME="$node_home" SGSD_SNAPSHOT_MANIFEST="$node_manifest" \
  SGSD_SNAPSHOT_EXTRAS="$node_destination" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const home = process.env.SGSD_SNAPSHOT_HOME;
const rows = fs.readFileSync(process.env.SGSD_SNAPSHOT_MANIFEST, 'utf8')
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const prefix = '.claude/super-gsd/scripts';
const canonical = path.join(home, '.claude', 'super-gsd', 'source', 'super-gsd', 'scripts');
const extras = rows.filter((row) => {
  if (row.type === 'absent' || (row.path !== prefix && !row.path.startsWith(prefix + '/'))) return false;
  const relative = row.path === prefix ? '' : row.path.slice(prefix.length + 1);
  if (!relative) return false;
  try { fs.lstatSync(path.join(canonical, ...relative.split('/'))); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
});
fs.writeFileSync(process.env.SGSD_SNAPSHOT_EXTRAS,
  extras.map((row) => JSON.stringify(row)).join('\n') + (extras.length ? '\n' : ''));
NODE
}

create_snapshot() {
  local home="$1" output="$2" target live
  [[ ! -e "$output" ]] || die "--output-dir already exists: $output"
  mkdir -p -- "$output"; output="$(resolved_dir "$output")"
  write_manifest "$home" "$output/manifest-before.jsonl"
  write_scripts_extras "$home" "$output/manifest-before.jsonl" "$output/scripts-extra-before.jsonl"
  local present=()
  for target in "${TARGETS[@]}"; do
    live="$home/$target"
    if [[ -e "$live" || -L "$live" ]]; then present+=("$target"); fi
  done
  if [[ ${#present[@]} -eq 0 ]]; then tar -cf "$output/archive.tar" --files-from /dev/null
  else tar -cf "$output/archive.tar" -C "$home" -- "${present[@]}"
  fi
  [[ -r "$output/archive.tar" ]] || die "archive does not exist or is unreadable"
  tar -tf "$output/archive.tar" >/dev/null || die "archive exists but is not readable by tar"
  printf 'snapshot=%s\nmanifest=%s\narchive=%s\n' \
    "$output" "$output/manifest-before.jsonl" "$output/archive.tar"
}
verify_snapshot() {
  local home="$1" snapshot="$2"
  [[ -d "$snapshot" ]] || die "--snapshot-dir does not exist: $snapshot"
  snapshot="$(resolved_dir "$snapshot")"
  [[ -r "$snapshot/manifest-before.jsonl" ]] || die "manifest-before.jsonl is missing or unreadable"
  [[ -r "$snapshot/scripts-extra-before.jsonl" ]] || die "scripts-extra-before.jsonl is missing or unreadable"
  [[ -r "$snapshot/archive.tar" ]] || die "archive does not exist or is unreadable"
  tar -tf "$snapshot/archive.tar" >/dev/null || die "archive exists but is not readable by tar"
  write_manifest "$home" "$snapshot/manifest-after.jsonl"
  local node_before node_after node_extras
  node_before="$(node_path_arg "$snapshot/manifest-before.jsonl")"
  node_after="$(node_path_arg "$snapshot/manifest-after.jsonl")"
  node_extras="$(node_path_arg "$snapshot/scripts-extra-before.jsonl")"
  SGSD_BEFORE="$node_before" SGSD_AFTER="$node_after" \
  SGSD_EXTRAS="$node_extras" node <<'NODE'
const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const before = read(process.env.SGSD_BEFORE);
const after = read(process.env.SGSD_AFTER);
const extras = read(process.env.SGSD_EXTRAS);
const afterByPath = new Map(after.map((row) => [row.path, row]));
const scriptsRoot = '.claude/super-gsd/scripts';
const missing = before.filter((row) => row.type !== 'absent'
  && (row.path === scriptsRoot || row.path.startsWith(scriptsRoot + '/'))
  && (!afterByPath.has(row.path) || afterByPath.get(row.path).type === 'absent'));
if (missing.length) {
  throw new Error('pre-install scripts path set is not a subset of post-install set: '
    + missing.map((row) => row.path).join(', '));
}
const changedExtras = extras.filter((expected) => {
  const actual = afterByPath.get(expected.path);
  return !actual || actual.type !== expected.type || actual.mode !== expected.mode
    || actual.link !== expected.link || actual.sha256 !== expected.sha256;
});
if (changedExtras.length) {
  throw new Error('scripts extra-file set is not byte-identical: '
    + changedExtras.map((row) => row.path).join(', '));
}
NODE
  printf 'verified=%s\nmanifest_after=%s\n' "$snapshot" "$snapshot/manifest-after.jsonl"
}
restore_snapshot() {
  local home="$1" snapshot="$2" failed="$3" target live quarantine
  [[ -d "$snapshot" ]] || die "--snapshot-dir does not exist: $snapshot"
  snapshot="$(resolved_dir "$snapshot")"
  [[ -r "$snapshot/manifest-before.jsonl" ]] || die "manifest-before.jsonl is missing or unreadable"
  [[ -r "$snapshot/archive.tar" ]] || die "archive does not exist or is unreadable"
  tar -tf "$snapshot/archive.tar" >/dev/null || die "archive exists but is not readable by tar"
  if [[ -e "$failed" ]]; then
    [[ -d "$failed" ]] || die "--failed-candidate-dir exists and is not a directory"
    [[ -z "$(find "$failed" -mindepth 1 -print -quit)" ]] || die "--failed-candidate-dir is not empty"
  else mkdir -p -- "$failed"
  fi
  failed="$(resolved_dir "$failed")"; mkdir -p -- "$failed/targets"
  for target in "${TARGETS[@]}"; do
    live="$home/$target"
    if [[ -e "$live" || -L "$live" ]]; then
      quarantine="$failed/targets/$target"; mkdir -p -- "$(dirname "$quarantine")"; mv -- "$live" "$quarantine"
    fi
  done
  tar -xf "$snapshot/archive.tar" -C "$home"
  write_manifest "$home" "$snapshot/manifest-restored.jsonl"
  cmp -s "$snapshot/manifest-before.jsonl" "$snapshot/manifest-restored.jsonl" ||
    die "restore did not reproduce the exact pre-install manifest; failed candidate and original archive were retained"
  printf 'restored=%s\nfailed_candidate=%s\noriginal_archive=%s\n' \
    "$snapshot" "$failed" "$snapshot/archive.tar"
}

[[ $# -ge 1 ]] || { usage >&2; exit 2; }
action="$1"; shift
home_arg=""; output_arg=""; snapshot_arg=""; failed_arg=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --home) [[ $# -ge 2 ]] || die "--home requires a value"; home_arg="$2"; shift 2 ;;
    --output-dir) [[ $# -ge 2 ]] || die "--output-dir requires a value"; output_arg="$2"; shift 2 ;;
    --snapshot-dir) [[ $# -ge 2 ]] || die "--snapshot-dir requires a value"; snapshot_arg="$2"; shift 2 ;;
    --failed-candidate-dir) [[ $# -ge 2 ]] || die "--failed-candidate-dir requires a value"; failed_arg="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done
validate_contract
home="$(validate_home "$home_arg")"
case "$action" in
  create)
    [[ -n "$output_arg" && -z "$snapshot_arg" && -z "$failed_arg" ]] || die "create requires only --home and --output-dir"
    output_arg="$(validate_storage_path "--output-dir" "$output_arg" "$home")"
    create_snapshot "$home" "$output_arg"
    ;;
  verify)
    [[ -n "$snapshot_arg" && -z "$output_arg" && -z "$failed_arg" ]] || die "verify requires only --home and --snapshot-dir"
    snapshot_arg="$(validate_storage_path "--snapshot-dir" "$snapshot_arg" "$home")"
    verify_snapshot "$home" "$snapshot_arg"
    ;;
  restore)
    [[ -n "$snapshot_arg" && -n "$failed_arg" && -z "$output_arg" ]] ||
      die "restore requires --home, --snapshot-dir, and --failed-candidate-dir"
    snapshot_arg="$(validate_storage_path "--snapshot-dir" "$snapshot_arg" "$home")"
    failed_arg="$(validate_storage_path "--failed-candidate-dir" "$failed_arg" "$home")"
    [[ "$snapshot_arg" != "$failed_arg" ]] || die "snapshot and failed-candidate directories must differ"
    restore_snapshot "$home" "$snapshot_arg" "$failed_arg"
    ;;
  *) usage >&2; die "action must be create, verify, or restore" ;;
esac
