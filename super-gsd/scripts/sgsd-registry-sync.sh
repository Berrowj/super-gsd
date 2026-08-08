#!/usr/bin/env bash
# ============================================================================
# sgsd-registry-sync - materialise the Agents resource-registry manifest
# ============================================================================
# Walk super-gsd/agents/*.md, extract the minimal resource record, and
# atomically write .planning/resource-registry/agents.jsonl.
#
# Schema, one JSON object per line:
#   {"id","path","sha","mtime","model","tools","description","status"}
#
# Fresh-clone routing policy:
#   - Claude Sonnet/Haiku agent files are legacy declarations unless a future
#     file explicitly opts back in with a non-default status.
#   - Write/Edit/Bash-capable executor contracts with no Claude model are
#     logical Codex routes and remain active as model=codex.
#   - External Codex contracts remain active.
#
# Usage:
#   sgsd-registry-sync.sh [--root PATH] [--agents-dir PATH] [--dry-run]
# ============================================================================

set -u

ROOT=""
AGENTS_DIR="${SGSD_AGENTS_DIR:-}"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --root)
            [[ $# -ge 2 ]] || { echo "sgsd-registry-sync: --root requires a path" >&2; exit 2; }
            ROOT="$2"; shift 2
            ;;
        --agents-dir)
            [[ $# -ge 2 ]] || { echo "sgsd-registry-sync: --agents-dir requires a path" >&2; exit 2; }
            AGENTS_DIR="$2"; shift 2
            ;;
        --dry-run)  DRY_RUN=true; shift ;;
        --help|-h)  head -30 "$0" | tail -25; exit 0 ;;
        *) echo "sgsd-registry-sync: unknown argument: $1" >&2; exit 2 ;;
    esac
done

if [[ -z "$ROOT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" && ( -n "$AGENTS_DIR" || -d "$d/super-gsd/agents" ) ]]; then
            ROOT="$d"
            break
        fi
        d="$(dirname "$d")"
    done
fi

if [[ -z "$ROOT" || ! -d "$ROOT" ]]; then
    echo "sgsd-registry-sync: no project root found above $(pwd). Pass --root PATH." >&2
    exit 3
fi
ROOT="$(cd "$ROOT" 2>/dev/null && pwd -P)" || {
    echo "sgsd-registry-sync: cannot resolve project root: $ROOT" >&2
    exit 3
}
[[ -n "$AGENTS_DIR" ]] || AGENTS_DIR="$ROOT/super-gsd/agents"
if [[ ! -d "$AGENTS_DIR" ]]; then
    echo "sgsd-registry-sync: agents directory not found: $AGENTS_DIR" >&2
    exit 3
fi
AGENTS_DIR="$(cd "$AGENTS_DIR" 2>/dev/null && pwd -P)" || {
    echo "sgsd-registry-sync: cannot resolve agents directory: $AGENTS_DIR" >&2
    exit 3
}

NODE_BIN="${NODE_BIN:-}"
if [[ -z "$NODE_BIN" ]]; then
    if command -v node >/dev/null 2>&1; then
        NODE_BIN="node"
    elif command -v node.exe >/dev/null 2>&1; then
        NODE_BIN="node.exe"
    else
        echo "sgsd-registry-sync: node is required" >&2
        exit 4
    fi
fi

NODE_ROOT="$ROOT"
NODE_AGENTS_DIR="$AGENTS_DIR"
if [[ "$NODE_BIN" == *node.exe && "$NODE_ROOT" == /mnt/* ]] && command -v wslpath >/dev/null 2>&1; then
    NODE_ROOT="$(wslpath -w "$NODE_ROOT")"
    NODE_AGENTS_DIR="$(wslpath -w "$NODE_AGENTS_DIR")"
fi

"$NODE_BIN" - "$NODE_ROOT" "$NODE_AGENTS_DIR" "$DRY_RUN" <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2]);
const agentsDir = path.resolve(process.argv[3]);
const dryRun = process.argv[4] === 'true';
const registryDir = path.join(root, '.planning', 'resource-registry');
const manifest = path.join(registryDir, 'agents.jsonl');
const tmp = manifest + '.tmp';

function parseFrontmatter(text) {
  const out = {};
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return out;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') break;
    const m = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function gitBlobSha(buffer) {
  return crypto
    .createHash('sha1')
    .update(Buffer.from('blob ' + buffer.length + '\0'))
    .update(buffer)
    .digest('hex');
}

function hasMutatingTools(tools) {
  return /(^|[,\s])(Write|Edit|Bash)([,\s]|$)/.test(tools || '');
}

function deriveStatusAndModel(fm) {
  let model = fm.model || '';
  let status = fm.status || 'active';
  if (!model) {
    model = hasMutatingTools(fm.tools) ? 'codex' : 'unspecified';
  }
  if (status === 'active' && (model === 'sonnet' || model === 'haiku')) {
    status = 'legacy-disabled';
  }
  if ((fm.description || '').startsWith('DISABLED')) {
    status = 'disabled';
  }
  return { model, status };
}

const names = fs.readdirSync(agentsDir)
  .filter((name) => name.endsWith('.md'))
  .sort();

const rows = names.map((name) => {
  const file = path.join(agentsDir, name);
  const buffer = fs.readFileSync(file);
  const fm = parseFrontmatter(buffer.toString('utf8'));
  const derived = deriveStatusAndModel(fm);
  const st = fs.statSync(file);
  return {
    id: fm.name || name.replace(/\.md$/, ''),
    path: 'super-gsd/agents/' + name,
    sha: gitBlobSha(buffer),
    mtime: Math.floor(st.mtimeMs / 1000),
    model: derived.model,
    tools: fm.tools || '',
    description: fm.description || '',
    status: derived.status
  };
});

const body = rows.map((row) => JSON.stringify(row)).join('\n') + '\n';

if (dryRun) {
  process.stdout.write('DRY RUN - would write ' + manifest + ' (' + rows.length + ' records):\n');
  process.stdout.write(body);
  process.exit(0);
}

fs.mkdirSync(registryDir, { recursive: true });
fs.writeFileSync(tmp, body);
fs.renameSync(tmp, manifest);
process.stdout.write('sgsd-registry-sync: wrote ' + rows.length + ' agent records to ' + manifest + '\n');
NODE
