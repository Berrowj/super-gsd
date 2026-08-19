#!/bin/bash
# gsd-session-state.sh - SessionStart hook: inject resolver-validated state.

# Resolver failures are visible but non-blocking for SessionStart.
resolver_unavailable() {
  printf 'resolver unavailable: %s\n' "$1"
  exit 0
}

command -v node >/dev/null 2>&1 || resolver_unavailable "node is not available"
case "$0" in
  */*) HOOK_DIR="${0%/*}" ;;
  *) HOOK_DIR="." ;;
esac

ADAPTER=""
for CANDIDATE in "$HOOK_DIR/../scripts/lib/decision-state.cjs" "$HOOK_DIR/../super-gsd/scripts/lib/decision-state.cjs"; do
  if [ -f "$CANDIDATE" ]; then
    ADAPTER="$CANDIDATE"
    break
  fi
done
[ -n "$ADAPTER" ] || resolver_unavailable "decision-state adapter is not installed"

ADAPTER_STDERR="$(mktemp 2>/dev/null)" || resolver_unavailable "decision-state stderr capture is unavailable"
if node "$ADAPTER" --render session --project "$PWD" 2>"$ADAPTER_STDERR"; then
  rm -f "$ADAPTER_STDERR" 2>/dev/null || true
else
  ADAPTER_STATUS=$?
  ADAPTER_ERROR="$(sed -n '1p' "$ADAPTER_STDERR")"
  rm -f "$ADAPTER_STDERR" 2>/dev/null || true
  [ -n "$ADAPTER_ERROR" ] || ADAPTER_ERROR="no stderr detail"
  resolver_unavailable "decision-state command failed (exit $ADAPTER_STATUS: $ADAPTER_ERROR)"
fi
