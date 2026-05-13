#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC="$SCRIPT_DIR/sgsd-registry-sync.sh"
NODE_BIN="${NODE_BIN:-}"
if [[ -z "$NODE_BIN" ]]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="node"
  elif command -v node.exe >/dev/null 2>&1; then
    NODE_BIN="node.exe"
  else
    echo "sgsd-registry-sync.test: node is required" >&2
    exit 4
  fi
fi

TMP="$PWD/.tmp/sgsd-registry-sync-test-$$"
rm -rf "$TMP"
mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/super-gsd/agents"

cat > "$TMP/super-gsd/agents/sonnet-reviewer.md" <<'EOF'
---
name: sonnet-reviewer
description: Legacy Claude review agent.
tools: Read, Grep, Glob
model: sonnet
---
EOF

cat > "$TMP/super-gsd/agents/haiku-classifier.md" <<'EOF'
---
name: haiku-classifier
description: Legacy Claude classifier.
tools: Read, Grep, Glob
model: haiku
---
EOF

cat > "$TMP/super-gsd/agents/codex-exec.md" <<'EOF'
---
name: codex-exec
description: Logical Codex executor contract.
tools: Read, Write, Edit, Bash, Grep, Glob
---
EOF

cat > "$TMP/super-gsd/agents/codex-reviewer.md" <<'EOF'
---
name: codex-reviewer
description: External Codex reviewer.
tools: Read, Grep, Glob
model: external
---
EOF

bash "$SYNC" --root "$TMP" >/tmp/sgsd-registry-sync-test.out

MANIFEST="$TMP/.planning/resource-registry/agents.jsonl"
MANIFEST_FOR_NODE="$MANIFEST"
if [[ "$NODE_BIN" == *node.exe && "$MANIFEST_FOR_NODE" == /mnt/* ]] && command -v wslpath >/dev/null 2>&1; then
  MANIFEST_FOR_NODE="$(wslpath -w "$MANIFEST_FOR_NODE")"
fi

"$NODE_BIN" - "$MANIFEST_FOR_NODE" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
function byId(id) {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error('missing row ' + id);
  return row;
}
if (byId('sonnet-reviewer').status !== 'legacy-disabled') {
  throw new Error('sonnet reviewer should be legacy-disabled');
}
if (byId('haiku-classifier').status !== 'legacy-disabled') {
  throw new Error('haiku classifier should be legacy-disabled');
}
if (byId('codex-exec').model !== 'codex' || byId('codex-exec').status !== 'active') {
  throw new Error('codex executor contract should stay active as model=codex');
}
if (byId('codex-reviewer').model !== 'external' || byId('codex-reviewer').status !== 'active') {
  throw new Error('external codex reviewer should stay active');
}
console.log('sgsd-registry-sync.test: pass');
NODE
