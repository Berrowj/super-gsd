#!/usr/bin/env bash
# ============================================================================
# sgsd-ctx — shell wrapper around sgsd-ctx.js
# ============================================================================
# Convenience caller so orchestrator loops and user scripts can use a stable
# command name instead of `node path/to/script.js`. Resolves project dir from
# CWD (walking up for .planning/) unless --project is passed through.
#
# Exit codes:
#   0 — below threshold (or no threshold set)
#   2 — above threshold (use with --threshold N)
#
# Usage:
#   sgsd-ctx.sh                  → {"tokens":...,"max":...,"pct":...}
#   sgsd-ctx.sh --pct            → 42
#   sgsd-ctx.sh --threshold 70   → exit 2 if pct > 70
# ============================================================================

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/sgsd-ctx.js" "$@"
