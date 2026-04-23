#!/usr/bin/env bash
# ERG-02 — Patch KNOWN_TOP_LEVEL in gsd-tools core.cjs so SGSD v2 config keys
# (safety, model_routing, token_efficiency, deliberation, atc, browser_verify,
#  overwatcher) stop emitting "unknown config key" warnings.
#
# Idempotent: running twice is a no-op (ALREADY_PATCHED exit 0).
# Cross-platform: bash (WSL / macOS / Linux). Node is an assumed dep.
#
# Exit codes:
#   0 — success (patched or already patched)
#   1 — core.cjs not found
#   2 — ANCHOR_NOT_FOUND (upstream drift guard; hand-apply the patch)
#   3 — unexpected error
set -euo pipefail

DRY_RUN=false
AUTO_YES=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -y|--yes)  AUTO_YES=true ;;
    -h|--help)
      cat <<'HELPEOF'
Usage: patch-gsd-tools-known-keys.sh [--dry-run] [-y|--yes] [-h|--help]

  --dry-run   Show what would change; do NOT write to core.cjs
  -y --yes    Skip confirmation prompt
  -h --help   Show this help

Purpose:
  Adds 7 SGSD v2 top-level config keys to the KNOWN_TOP_LEVEL Set in
  ~/.claude/get-shit-done/bin/lib/core.cjs so they no longer emit
  "unknown config key" warnings when present in .planning/config.json.

  Keys added: safety, model_routing, token_efficiency, deliberation,
              atc, browser_verify, overwatcher

Exit codes: 0=success/already-patched, 1=not-found, 2=anchor-not-found, 3=error
HELPEOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (try --help)" >&2
      exit 3
      ;;
  esac
done

# ---------------------------------------------------------------------------
# 1. Locate core.cjs
# ---------------------------------------------------------------------------
if command -v gsd-tools >/dev/null 2>&1; then
  BIN_PATH=$(command -v gsd-tools)
  CORE_CJS="$(dirname "$BIN_PATH")/lib/core.cjs"
else
  CORE_CJS="$HOME/.claude/get-shit-done/bin/lib/core.cjs"
fi

if [[ ! -f "$CORE_CJS" ]]; then
  echo "ERROR: core.cjs not found at $CORE_CJS" >&2
  echo "       Install gsd-tools first: npx get-shit-done-cc@latest" >&2
  exit 1
fi

echo "Target: $CORE_CJS"

# ---------------------------------------------------------------------------
# 2. Cross-repo probe — notice but do NOT auto-commit if in a separate repo
# ---------------------------------------------------------------------------
CORE_DIR=$(dirname "$CORE_CJS")
if REPO_ROOT=$(git -C "$CORE_DIR" rev-parse --show-toplevel 2>/dev/null); then
  THIS_REPO=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
  if [[ "$REPO_ROOT" != "$THIS_REPO" ]]; then
    echo "NOTE: core.cjs lives in a separate git repo at $REPO_ROOT"
    echo "      The patch will be applied but NOT auto-committed there."
    echo "      After this script completes, run:"
    echo "        cd $REPO_ROOT && git add bin/lib/core.cjs && git commit -m 'feat: add SGSD v2 top-level keys to KNOWN_TOP_LEVEL'"
    echo ""
  fi
fi

# ---------------------------------------------------------------------------
# 3. Node-in-bash patcher — idempotent, anchor-guarded, .bak-safe
#    Write Node script to a temp file to avoid single-quote escaping issues.
# ---------------------------------------------------------------------------
NEW_KEYS=(safety model_routing token_efficiency deliberation atc browser_verify overwatcher review_providers)
KEYS_CSV=$(IFS=,; echo "${NEW_KEYS[*]}")
DRY_RUN_ARG=""
if [[ "$DRY_RUN" == "true" ]]; then
  DRY_RUN_ARG="--dry-run"
fi

TMPSCRIPT=$(mktemp /tmp/patch-gsd-XXXXXX.cjs)
# Ensure temp file is cleaned up even on error
trap 'rm -f "$TMPSCRIPT"' EXIT

cat > "$TMPSCRIPT" << 'NODESCRIPT'
'use strict';
const fs = require('fs');
const corePath = process.argv[2];
const wantedKeys = process.argv[3].split(',');
const dryRun = process.argv[4] === '--dry-run';

const src = fs.readFileSync(corePath, 'utf8');

// Idempotency check — are all 7 keys already present in the KNOWN_TOP_LEVEL Set?
const allPresent = wantedKeys.every(function(k) {
  // Match the key as a quoted string token inside the Set literal
  var re = new RegExp('["\']' + k + '["\']');
  return re.test(src);
});
if (allPresent) {
  console.log('ALREADY_PATCHED');
  process.exit(0);
}

// Locate the anchor line: the 'git', 'workflow', 'planning', 'hooks', 'features' row
var anchorRe = /^(\s*)('git', 'workflow', 'planning', 'hooks', 'features',)(\s*)$/m;
var m = src.match(anchorRe);
if (!m) {
  process.stderr.write('ANCHOR_NOT_FOUND\n');
  process.exit(2);
}

var indent = m[1];
var anchorLine = m[2];
// Build the replacement: keep original anchor line, then add new keys on next line
var newKeysLine = indent + wantedKeys.map(function(k) { return "'" + k + "'"; }).join(', ') + ',';
var replacement = indent + anchorLine + '\n' + newKeysLine;

var patched = src.replace(anchorRe, replacement);

if (dryRun) {
  console.log('PREVIEW');
  console.log('--- old');
  console.log(m[0]);
  console.log('+++ new');
  console.log(replacement);
  process.exit(0);
}

// Write .bak BEFORE mutating (rollback: mv core.cjs.bak core.cjs)
fs.writeFileSync(corePath + '.bak', src);
fs.writeFileSync(corePath, patched);
console.log('PATCHED');
NODESCRIPT

RESULT=$(node "$TMPSCRIPT" "$CORE_CJS" "$KEYS_CSV" "$DRY_RUN_ARG" 2>&1) || {
  NODE_EXIT=$?
  if echo "$RESULT" | grep -q "^ANCHOR_NOT_FOUND"; then
    echo "ERROR: ANCHOR_NOT_FOUND — the expected anchor line" >&2
    echo "       'git', 'workflow', 'planning', 'hooks', 'features'," >&2
    echo "       was not found in $CORE_CJS" >&2
    echo "       This means gsd-tools was updated upstream and the anchor moved." >&2
    echo "       Manually add the 7 keys to KNOWN_TOP_LEVEL near that line:" >&2
    echo "         'safety', 'model_routing', 'token_efficiency', 'deliberation', 'atc', 'browser_verify', 'overwatcher', 'review_providers'," >&2
    echo "       Rollback (if .bak exists): mv $CORE_CJS.bak $CORE_CJS" >&2
    exit 2
  fi
  echo "ERROR: node patcher exited $NODE_EXIT — $RESULT" >&2
  exit 3
}

case "$RESULT" in
  ALREADY_PATCHED*)
    echo "PASS: KNOWN_TOP_LEVEL already contains all 7 SGSD v2 keys — nothing to do."
    exit 0
    ;;
  PREVIEW*)
    echo "$RESULT"
    echo ""
    echo "(Dry-run: no files were modified. Re-run without --dry-run to apply.)"
    exit 0
    ;;
  PATCHED*)
    echo "OK: patch applied (backup at ${CORE_CJS}.bak)"
    ;;
  ANCHOR_NOT_FOUND*)
    echo "ERROR: ANCHOR_NOT_FOUND — see guidance above." >&2
    exit 2
    ;;
  *)
    echo "ERROR: unexpected patcher result: $RESULT" >&2
    exit 3
    ;;
esac

# ---------------------------------------------------------------------------
# 4. Post-patch verification — re-parse core.cjs to confirm all 7 keys present
# ---------------------------------------------------------------------------
VERIFY_TMPSCRIPT=$(mktemp /tmp/patch-gsd-verify-XXXXXX.cjs)
trap 'rm -f "$TMPSCRIPT" "$VERIFY_TMPSCRIPT"' EXIT

cat > "$VERIFY_TMPSCRIPT" << 'VERIFYSCRIPT'
'use strict';
const fs = require('fs');
const corePath = process.argv[2];
const src = fs.readFileSync(corePath, 'utf8');
const need = ['safety','model_routing','token_efficiency','deliberation','atc','browser_verify','overwatcher','review_providers'];
const missing = need.filter(function(k) {
  return !new RegExp('["\']' + k + '["\']').test(src);
});
if (missing.length) {
  process.stderr.write('POST-VERIFY FAIL: missing keys: ' + missing.join(', ') + '\n');
  process.exit(1);
}
console.log('POST-VERIFY PASS: all 8 keys confirmed in core.cjs');
VERIFYSCRIPT

VERIFY_RESULT=$(node "$VERIFY_TMPSCRIPT" "$CORE_CJS" 2>&1) || {
  echo "ERROR: post-patch verification failed — $VERIFY_RESULT" >&2
  echo "       Rollback: mv $CORE_CJS.bak $CORE_CJS" >&2
  exit 3
}

echo "$VERIFY_RESULT"
echo ""
echo "Patch complete. If core.cjs is in a separate git repo, remember to commit:"
echo "  cd $CORE_DIR && git add lib/core.cjs && git commit -m 'feat: add SGSD v2 top-level keys to KNOWN_TOP_LEVEL'"
