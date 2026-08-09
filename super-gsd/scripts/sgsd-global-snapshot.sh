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
resolved_path_allow_missing() {
  local candidate="$1" cursor leaf suffix=""
  if command -v realpath >/dev/null 2>&1 && realpath -m -- "$candidate" 2>/dev/null; then return
  elif command -v readlink >/dev/null 2>&1 && readlink -m -- "$candidate" 2>/dev/null; then return
  fi
  cursor="$candidate"
  while [[ ! -e "$cursor" && ! -L "$cursor" ]]; do
    leaf="$(basename -- "$cursor")"
    [[ "$leaf" != "." && "$leaf" != ".." ]] || return 1
    suffix="/$leaf$suffix"
    cursor="$(dirname -- "$cursor")"
  done
  [[ -d "$cursor" ]] || return 1
  cursor="$(resolved_dir "$cursor")" || return 1
  if [[ "$cursor" == "/" ]]; then
    printf '/%s\n' "${suffix#/}"
  else
    printf '%s%s\n' "${cursor%/}" "$suffix"
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
  local node_installer
  node_installer="$(node_path_arg "$INSTALLER")"
  SGSD_INSTALLER="$node_installer" \
  SGSD_SNAPSHOT_TARGETS="$(printf '%s\n' "${TARGETS[@]}")" node <<'NODE' || die "install.sh contract mismatch: unknown global mutation target"
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = fs.readFileSync(process.env.SGSD_INSTALLER, 'utf8');
const installerContractDigest = crypto.createHash('sha256')
  .update(source.replace(/\r\n/g, '\n')).digest('hex');
if (installerContractDigest !== '7f9fe48d71e8eb209b02603582f5d647f30bc9c2303d784605d5eab1554dbc49') {
  console.error(`unknown installer contract digest: ${installerContractDigest}`);
  process.exit(1);
}
const lines = source.split(/\r?\n/);
const targets = process.env.SGSD_SNAPSHOT_TARGETS.split('\n').filter(Boolean);
const roots = Object.freeze({
  HOME: '',
  CLAUDE_DIR: '.claude',
  GSD_DIR: '.claude/get-shit-done',
  HOOKS_DIR: '.claude/hooks',
  AGENTS_DIR: '.claude/agents',
  COMMANDS_DIR: '.claude/commands',
  TEMPLATES_DIR: '.claude/get-shit-done/templates/super-gsd',
  GLOBAL_SCRIPTS_DIR: '.claude/super-gsd/scripts',
  LOCAL_BIN_DIR: '.local/bin',
  SETTINGS_FILE: '.claude/settings.json',
});
function functionBody(name) {
  const start = lines.findIndex((line) => line.trim() === `${name}() {`);
  if (start < 0) throw new Error(`installer mutation function is missing: ${name}`);
  const end = lines.findIndex((line, index) => index > start && line === '}');
  if (end < 0) throw new Error(`installer mutation function is unterminated: ${name}`);
  return lines.slice(start + 1, end);
}
function allowed(pathValue, statement) {
  return targets.some((target) => pathValue === target || pathValue.startsWith(`${target}/`)
    || (statement.includes('mkdir -p') && target.startsWith(`${pathValue}/`)));
}
const rootNames = Object.keys(roots).join('|');
const reference = new RegExp(`\\$(?:\\{(${rootNames})\\}|(${rootNames}))((?:/[A-Za-z0-9_.$}{-]+)*)`, 'g');
const destinationReference = new RegExp(
  `^\\$(?:\\{(${rootNames})\\}|(${rootNames}))((?:/[A-Za-z0-9_.$}{-]+)*)$`,
);
function hasUnsafeExecutionSyntax(value) {
  return value.includes('$(') || value.includes('`') || value.includes('<(') || value.includes('>(');
}
function quotedArgumentsOnly(value, marker, allowedResidues = ['']) {
  const tail = value.slice(value.indexOf(marker) + marker.length);
  const argumentsFound = [];
  const residue = tail.replace(/"([^"]+)"/g, (_whole, argument) => {
    argumentsFound.push(argument);
    return '';
  }).trim();
  const unsafeExpansion = argumentsFound.some(hasUnsafeExecutionSyntax);
  return allowedResidues.includes(residue) && !unsafeExpansion ? argumentsFound : [];
}
function mutationDestinations(value) {
  if (value.startsWith('copy_file ')) return quotedArgumentsOnly(value, 'copy_file ').slice(-1);
  if (value.startsWith('remove_path_if_exists ')) return quotedArgumentsOnly(value, 'remove_path_if_exists ');
  if (value.includes('mkdir -p ')) return quotedArgumentsOnly(value, 'mkdir -p ');
  if (value.includes('chmod +x ')) return quotedArgumentsOnly(value, 'chmod +x ', ['', ';;']);
  if (value.startsWith('node "$MERGE_SCRIPT" ')) {
    return value === 'node "$MERGE_SCRIPT" "$OVERLAY_FILE" "$SETTINGS_FILE" 2>&1 | sed \'s/^/  /\''
      ? ['$SETTINGS_FILE'] : [];
  }
  return null;
}
function expandDestination(expression) {
  const match = destinationReference.exec(expression);
  if (!match) return null;
  const root = match[1] || match[2];
  return `${roots[root]}${match[3]}`.replace(/^\//, '');
}
const mutationLines = [
  ...functionBody('ensure_gsd_base'),
  ...functionBody('remove_legacy_global_assets'),
  ...functionBody('install_global_assets'),
];
function safeLogStatement(value) {
  if (!/^log "[^"\r\n]*"$/.test(value)) return false;
  if (value === 'log "DRY RUN: Node.js available ($(node -v))"') return true;
  if (hasUnsafeExecutionSyntax(value)) return false;
  return true;
}
function safeControlStatement(value) {
  if (value === 'if command -v node >/dev/null 2>&1; then') return true;
  if (hasUnsafeExecutionSyntax(value) || /[<>]/.test(value)) return false;
  return /^(?:if|elif) \[ [^;&|<>\r\n]* \]; then$/.test(value)
    || /^for [a-z_]+ in [^;&|<>\r\n]+; do$/.test(value)
    || /^case "\$[a-z_]+" in$/.test(value)
    || /^(?:sonnet\|haiku|\*\.sh)\)$/.test(value)
    || /^\[ [^;&|<>\r\n]+ \] (?:\|\||&&) continue$/.test(value)
    || /^(?:else|fi|done|esac|continue|;;)$/.test(value);
}
function recognizedStatement(value) {
  return !value || value.startsWith('#') || safeLogStatement(value) || value === 'echo ""'
    || safeControlStatement(value)
    || value === 'ensure_gsd_base' || value === 'remove_legacy_global_assets'
    || value === 'require_node_22' || value === 'run npx get-shit-done-cc@latest'
    || value.startsWith('copy_file ') || value.startsWith('remove_path_if_exists ')
    || /^(?:is_legacy_brv_asset "\$(?:template|ow)" && continue)$/.test(value)
    || value.startsWith('node "$MERGE_SCRIPT" ')
    || value.startsWith('chmod +x ')
    || /^(?:AGENT_COUNT|SKILL_COUNT|HOOK_COUNT|SCRIPT_COUNT)=0$/.test(value)
    || /^(?:AGENT_COUNT|SKILL_COUNT|HOOK_COUNT|SCRIPT_COUNT)=\$\(\([A-Z_]+ \+ 1\)\)$/.test(value)
    || /^name="\$\(basename "\$[a-z_]+"\)"$/.test(value)
    || /^agent_model="\$\(frontmatter_field "\$agent" model\)"$/.test(value)
    || value === 'SETTINGS_FILE="$CLAUDE_DIR/settings.json"'
    || value === 'OVERLAY_FILE="$SCRIPT_DIR/config/settings-overlay.json"'
    || value === 'MERGE_SCRIPT="$SCRIPT_DIR/scripts/merge-settings.js"';
}
for (const line of mutationLines) {
  const trimmed = line.trim();
  const destinations = mutationDestinations(trimmed);
  if (destinations !== null) {
    if (destinations.length === 0) {
      console.error(`unknown mutation destination syntax: ${trimmed}`);
      process.exit(1);
    }
    for (const destination of destinations) {
      const expanded = expandDestination(destination);
      if (expanded === null || !allowed(expanded, line)) {
        console.error(`unknown mutation destination: ${destination}`);
        process.exit(1);
      }
    }
  }
  const knownReadOnlyRoot = trimmed === 'if [ ! -d "$GSD_DIR" ]; then';
  if (!trimmed.startsWith('log ') && !knownReadOnlyRoot) {
    reference.lastIndex = 0;
    for (let match; (match = reference.exec(line));) {
      const root = match[1] || match[2];
      const expanded = `${roots[root]}${match[3]}`.replace(/^\//, '');
      if (!allowed(expanded, line)) {
        console.error(`unknown mutation destination via ${match[0]}: ${expanded}`);
        process.exit(1);
      }
    }
  }
  if (destinations === null && !recognizedStatement(trimmed)) {
    console.error(`unknown mutation statement: ${trimmed}`);
    process.exit(1);
  }
}
NODE
}
validate_storage_path() {
  local label="$1" raw="$2" home="$3" normalized resolved target live
  normalized="$(normalize_path_arg "$raw")"
  require_absolute_safe_dir_value "$label" "$normalized"
  resolved="$(resolved_path_allow_missing "$normalized")" || die "cannot resolve $label: $normalized"
  require_absolute_safe_dir_value "$label" "$resolved"
  for target in "${TARGETS[@]}"; do
    live="$(resolved_path_allow_missing "$home/$target")" ||
      die "cannot resolve live install target $target"
    case "$resolved/" in "$live/"*) die "$label must remain outside live install target $target" ;; esac
    case "$live/" in "$resolved/"*) die "$label must not contain live install target $target" ;; esac
  done
  printf '%s\n' "$resolved"
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
  const type = stat.isSymbolicLink() ? 'symlink'
    : stat.isDirectory() ? 'directory'
      : stat.isFile() ? 'file'
        : null;
  if (type === null) throw new Error(`unsupported filesystem type in snapshot: ${relative}`);
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

write_archive_digest() {
  local archive="$1" digest="$2" node_archive node_digest
  node_archive="$(node_path_arg "$archive")"
  node_digest="$(node_path_arg "$digest")"
  SGSD_ARCHIVE="$node_archive" SGSD_ARCHIVE_DIGEST="$node_digest" node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const archive = process.env.SGSD_ARCHIVE;
const digest = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
fs.writeFileSync(process.env.SGSD_ARCHIVE_DIGEST, `${digest}  archive.tar\n`);
NODE
}
validate_archive() {
  local snapshot="$1" archive manifest digest listing
  archive="$snapshot/archive.tar"
  manifest="$snapshot/manifest-before.jsonl"
  digest="$snapshot/archive.sha256"
  [[ -r "$manifest" ]] || die "manifest-before.jsonl is missing or unreadable"
  [[ -r "$archive" ]] || die "archive does not exist or is unreadable"
  [[ -r "$digest" ]] || die "archive.sha256 is missing or unreadable"
  listing="$(mktemp)" || die "could not allocate archive membership listing"
  if ! tar -tf "$archive" >"$listing"; then
    rm -f -- "$listing"
    die "archive exists but is not readable by tar"
  fi
  local node_archive node_manifest node_digest node_listing
  node_archive="$(node_path_arg "$archive")"
  node_manifest="$(node_path_arg "$manifest")"
  node_digest="$(node_path_arg "$digest")"
  node_listing="$(node_path_arg "$listing")"
  if ! SGSD_ARCHIVE="$node_archive" SGSD_ARCHIVE_MANIFEST="$node_manifest" \
    SGSD_ARCHIVE_DIGEST="$node_digest" SGSD_ARCHIVE_LISTING="$node_listing" \
    SGSD_SNAPSHOT_TARGETS="$(printf '%s\n' "${TARGETS[@]}")" node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const targets = process.env.SGSD_SNAPSHOT_TARGETS.split('\n').filter(Boolean);
const digestText = fs.readFileSync(process.env.SGSD_ARCHIVE_DIGEST, 'utf8').trim();
const digestMatch = /^([0-9a-f]{64})(?:\s+archive\.tar)?$/.exec(digestText);
if (!digestMatch) throw new Error('archive.sha256 has an invalid format');
const actualDigest = crypto.createHash('sha256')
  .update(fs.readFileSync(process.env.SGSD_ARCHIVE)).digest('hex');
if (actualDigest !== digestMatch[1]) throw new Error('archive SHA-256 mismatch');
const manifest = fs.readFileSync(process.env.SGSD_ARCHIVE_MANIFEST, 'utf8')
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
function checkedPath(raw, kind) {
  const value = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  if (!value || value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.includes('\\')) {
    throw new Error(`${kind} has an absolute or non-portable path: ${JSON.stringify(raw)}`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`${kind} has an unsafe path segment: ${JSON.stringify(raw)}`);
  }
  if (!targets.some((target) => value === target || value.startsWith(`${target}/`))) {
    throw new Error(`${kind} is outside the snapshot target prefixes: ${value}`);
  }
  return value;
}
const expected = new Set();
for (const row of manifest) {
  const value = checkedPath(row.path, 'manifest');
  if (row.type !== 'absent') {
    if (expected.has(value)) throw new Error(`manifest has duplicate path: ${value}`);
    expected.add(value);
  }
}
const archived = new Set();
const members = fs.readFileSync(process.env.SGSD_ARCHIVE_LISTING, 'utf8')
  .split(/\r?\n/).filter(Boolean);
for (const member of members) {
  const value = checkedPath(member, 'archive membership');
  if (archived.has(value)) throw new Error(`archive has duplicate member: ${value}`);
  if (!expected.has(value)) throw new Error(`archive member is absent from manifest: ${value}`);
  archived.add(value);
}
const missing = [...expected].filter((value) => !archived.has(value));
if (missing.length) throw new Error(`manifest paths are absent from archive: ${missing.join(', ')}`);
NODE
  then
    rm -f -- "$listing"
    die "archive digest or membership verification failed"
  fi
  rm -f -- "$listing"
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
  write_archive_digest "$output/archive.tar" "$output/archive.sha256"
  validate_archive "$output"
  printf 'snapshot=%s\nmanifest=%s\narchive=%s\n' \
    "$output" "$output/manifest-before.jsonl" "$output/archive.tar"
}
verify_snapshot() {
  local home="$1" snapshot="$2"
  [[ -d "$snapshot" ]] || die "--snapshot-dir does not exist: $snapshot"
  snapshot="$(resolved_dir "$snapshot")"
  [[ -r "$snapshot/manifest-before.jsonl" ]] || die "manifest-before.jsonl is missing or unreadable"
  [[ -r "$snapshot/scripts-extra-before.jsonl" ]] || die "scripts-extra-before.jsonl is missing or unreadable"
  validate_archive "$snapshot"
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
  local home="$1" snapshot="$2" failed="$3" target live quarantine staging staged_manifest staged_live
  [[ -d "$snapshot" ]] || die "--snapshot-dir does not exist: $snapshot"
  snapshot="$(resolved_dir "$snapshot")"
  [[ -r "$snapshot/manifest-before.jsonl" ]] || die "manifest-before.jsonl is missing or unreadable"
  validate_archive "$snapshot"

  staging="$(mktemp -d "$snapshot/.restore-stage.XXXXXX")" ||
    die "could not allocate restore staging directory"
  staged_manifest="$staging/manifest-staged.jsonl"
  if ! tar -xf "$snapshot/archive.tar" -C "$staging"; then
    rm -rf -- "$staging"
    die "archive extraction into restore staging failed"
  fi
  if ! write_manifest "$staging" "$staged_manifest"; then
    rm -rf -- "$staging"
    die "could not manifest the staged archive"
  fi
  if ! cmp -s "$snapshot/manifest-before.jsonl" "$staged_manifest"; then
    rm -rf -- "$staging"
    die "staged archive does not match the exact pre-install manifest; live targets were not changed"
  fi

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
  for target in "${TARGETS[@]}"; do
    staged_live="$staging/$target"
    live="$home/$target"
    if [[ -e "$staged_live" || -L "$staged_live" ]]; then
      mkdir -p -- "$(dirname "$live")"
      mv -- "$staged_live" "$live"
    fi
  done
  rm -rf -- "$staging"
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
    [[ -d "$home/.claude/get-shit-done" ]] ||
      die "create requires a pre-existing ~/.claude/get-shit-done; external bootstrap mutations are outside the snapshot boundary"
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
