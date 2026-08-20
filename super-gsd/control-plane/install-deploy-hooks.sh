#!/usr/bin/env bash
set -euo pipefail

CLARITY_CP_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
CLARITY_HOOK_SOURCE="$CLARITY_CP_DIR/hooks/pre-merge-commit"
CLARITY_DRY_RUN=false

case "${1:-}" in
  "") ;;
  --dry-run) CLARITY_DRY_RUN=true ;;
  *) echo "Usage: $0 [--dry-run]" >&2; exit 1 ;;
esac
if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 1
fi

CLARITY_DEPLOY_CHECKOUT=$(PYTHONPATH="$CLARITY_CP_DIR${PYTHONPATH:+:$PYTHONPATH}" python3 -c 'from clarity_cp.config import load_config; print(load_config().deploy_checkout)')
CLARITY_GIT_DIR="$CLARITY_DEPLOY_CHECKOUT/.git"
CLARITY_TARGET="$CLARITY_GIT_DIR/hooks/pre-merge-commit"

if [ ! -d "$CLARITY_GIT_DIR" ]; then
  echo "ERROR: deploy checkout has no .git directory: $CLARITY_DEPLOY_CHECKOUT" >&2
  exit 2
fi

if [ "$CLARITY_DRY_RUN" = true ]; then
  echo "DRY RUN: deploy checkout: $CLARITY_DEPLOY_CHECKOUT"
  if [ -e "$CLARITY_TARGET" ]; then
    echo "DRY RUN: would back up existing $CLARITY_TARGET to $CLARITY_TARGET.bak-<UTC timestamp>"
  fi
  echo "DRY RUN: would copy $CLARITY_HOOK_SOURCE to $CLARITY_TARGET and make it executable"
  exit 0
fi

CLARITY_BACKUP=""
if [ -e "$CLARITY_TARGET" ]; then
  CLARITY_TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
  CLARITY_BACKUP="$CLARITY_TARGET.bak-$CLARITY_TIMESTAMP"
  if [ -e "$CLARITY_BACKUP" ]; then
    CLARITY_BACKUP="$CLARITY_BACKUP-$$"
  fi
  cp -- "$CLARITY_TARGET" "$CLARITY_BACKUP"
fi

mkdir -p -- "$CLARITY_GIT_DIR/hooks"
cp -- "$CLARITY_HOOK_SOURCE" "$CLARITY_TARGET"
chmod +x -- "$CLARITY_TARGET"

echo "Installed deploy hook: $CLARITY_TARGET"
if [ -n "$CLARITY_BACKUP" ]; then
  echo "Backed up previous hook: $CLARITY_BACKUP"
fi
echo "DLB-15 merge-commit protection is active; fast-forward merges are unaffected."
