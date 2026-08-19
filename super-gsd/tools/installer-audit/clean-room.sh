#!/usr/bin/env bash
# =============================================================================
# super-gsd/tools/installer-audit/clean-room.sh
# Phase 58-01: clean-room install simulation (READ-ONLY OUTSIDE TMPDIR).
#
# PURPOSE
#   Walk through the super-gsd install motions in a freshly created
#   temp directory and capture every interactive prompt or manual step
#   along the way. The result is a friction log: each step is timed and
#   tagged auto|prompt|error so the wizard owner (Phase 59) knows
#   precisely where human-in-the-loop touch points live.
#
# CONTRACT
#   - Confine ALL filesystem mutations to $TMPDIR. The repo's
#     working tree is NEVER modified by this script.
#   - Use rsync if available, otherwise cp -R, to mirror the super-gsd
#     tree into TMPDIR (we never `git clone`; the snapshot is
#     fixture-only and we want the working tree state, not HEAD).
#   - Capture each step as: `STEP <id> | <duration_ms>ms | <outcome> |
#     <description>`.
#   - Outcome enum: auto | prompt | error | skip.
#   - On exit (success or trap), `rm -rf` the tmpdir.
#
# USAGE
#   bash super-gsd/tools/installer-audit/clean-room.sh
#       [--repo-root <path>]    # default: walk up from script location
#       [--dry-run]             # don't actually invoke install.sh,
#                               # just print the planned steps
#       [--keep-tmp]            # leave tmpdir for inspection (debug)
#
# EXIT CODE
#   0  -> walk completed (with auto+prompt+skip outcomes only).
#   1  -> any step exited error.
#   2  -> precondition failure (mktemp / repo discovery / tool missing).
#
# ASCII-ONLY.
# =============================================================================

set -u

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
REPO_ROOT=""
DRY_RUN="false"
KEEP_TMP="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --repo-root)  REPO_ROOT="$2"; shift 2 ;;
    --dry-run)    DRY_RUN="true"; shift ;;
    --keep-tmp)   KEEP_TMP="true"; shift ;;
    --help|-h)
      sed -n '2,30p' "$0"
      exit 0 ;;
    *) echo "clean-room: unknown arg $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Repo discovery
# ---------------------------------------------------------------------------
if [ -z "$REPO_ROOT" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  # Walk up looking for super-gsd/install.sh as the canonical anchor.
  cur="$SCRIPT_DIR"
  for _ in 1 2 3 4 5 6 7 8; do
    if [ -f "$cur/super-gsd/install.sh" ]; then
      REPO_ROOT="$cur"
      break
    fi
    parent="$(cd "$cur/.." && pwd)"
    if [ "$parent" = "$cur" ]; then break; fi
    cur="$parent"
  done
fi

if [ -z "$REPO_ROOT" ] || [ ! -f "$REPO_ROOT/super-gsd/install.sh" ]; then
  echo "clean-room: precondition_failed reason=repo_root_not_found" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Tmpdir setup + cleanup trap
# ---------------------------------------------------------------------------
TMPDIR_ROOT="$(mktemp -d -t sgsd-cleanroom-XXXXXX 2>/dev/null || mktemp -d 2>/dev/null)"
if [ -z "$TMPDIR_ROOT" ] || [ ! -d "$TMPDIR_ROOT" ]; then
  echo "clean-room: precondition_failed reason=mktemp_failed" >&2
  exit 2
fi

cleanup() {
  if [ "$KEEP_TMP" = "true" ]; then
    echo "clean-room: keeping tmpdir for inspection: $TMPDIR_ROOT" >&2
    return 0
  fi
  if [ -n "${TMPDIR_ROOT:-}" ] && [ -d "$TMPDIR_ROOT" ]; then
    case "$TMPDIR_ROOT" in
      */sgsd-cleanroom-*)
        rm -rf "$TMPDIR_ROOT" 2>/dev/null || true ;;
      *)
        # Defensive: refuse to rm -rf any path that doesn't carry our
        # signature prefix.
        echo "clean-room: refusing to clean unexpected tmpdir: $TMPDIR_ROOT" >&2 ;;
    esac
  fi
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Friction log helpers
# ---------------------------------------------------------------------------
STEP_NUM=0
EXIT_CODE=0

step() {
  STEP_NUM=$((STEP_NUM + 1))
  local desc="$1"
  local cmd="$2"
  local expected_prompt="$3" # auto|prompt|skip
  local t0_ms t1_ms dur_ms outcome

  t0_ms=$(date +%s%3N 2>/dev/null || echo "0")

  if [ "$DRY_RUN" = "true" ] || [ "$expected_prompt" = "skip" ]; then
    outcome="skip"
    t1_ms=$(date +%s%3N 2>/dev/null || echo "0")
  else
    # Execute. Stdout is piped through; stderr captured for tagging.
    eval "$cmd" >/dev/null 2>"$TMPDIR_ROOT/.step-$STEP_NUM.err"
    local rc=$?
    t1_ms=$(date +%s%3N 2>/dev/null || echo "0")
    if [ $rc -eq 0 ]; then
      outcome="$expected_prompt"
    else
      outcome="error"
      EXIT_CODE=1
    fi
  fi

  if [ "$t0_ms" != "0" ] && [ "$t1_ms" != "0" ]; then
    dur_ms=$((t1_ms - t0_ms))
  else
    dur_ms=0
  fi

  printf 'STEP %02d | %5sms | %-6s | %s\n' \
    "$STEP_NUM" "$dur_ms" "$outcome" "$desc"
}

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo "============================================================"
echo "clean-room install walk"
echo "  repo_root  = $REPO_ROOT"
echo "  tmpdir     = $TMPDIR_ROOT"
echo "  dry_run    = $DRY_RUN"
echo "  keep_tmp   = $KEEP_TMP"
echo "  ts_started = $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "============================================================"

# ---------------------------------------------------------------------------
# Walk steps
# ---------------------------------------------------------------------------

# 1. Mirror the super-gsd tree into tmpdir (simulates a fresh checkout).
if command -v rsync >/dev/null 2>&1; then
  step "mirror super-gsd tree (rsync)" \
    "rsync -a --exclude node_modules '$REPO_ROOT/super-gsd/' '$TMPDIR_ROOT/super-gsd/'" \
    "auto"
else
  step "mirror super-gsd tree (cp -R)" \
    "cp -R '$REPO_ROOT/super-gsd' '$TMPDIR_ROOT/super-gsd'" \
    "auto"
fi

# 2. Synthesize a fresh .planning/ skeleton (simulates --init-project).
step "scaffold empty .planning/ skeleton" \
  "mkdir -p '$TMPDIR_ROOT/.planning/metrics' '$TMPDIR_ROOT/.planning/briefs' '$TMPDIR_ROOT/.planning/decisions' '$TMPDIR_ROOT/.planning/deliberations'" \
  "auto"

# 3. Probe the local environment via the audit (READ-ONLY).
step "run installer-audit probes" \
  "node '$REPO_ROOT/super-gsd/tools/installer-audit/audit.cjs' --run --project-root '$TMPDIR_ROOT'" \
  "auto"

# 4. Verify install.sh is executable + parseable (--dry-run).
step "install.sh --dry-run (no mutation)" \
  "bash '$TMPDIR_ROOT/super-gsd/install.sh' --dry-run --skip-brv 2>&1 | head -40" \
  "auto"

# 5. SGSD memory scaffold (local, no external login).
step "sgsd memory scaffold present" \
  "test -d '$TMPDIR_ROOT/.planning/memory' || mkdir -p '$TMPDIR_ROOT/.planning/memory'" \
  "auto"

# 6. Claude CLI login (interactive in real install). Marked PROMPT.
step "claude login (interactive prompt expected)" \
  "true" \
  "prompt"

# 7. Restart Claude Code (manual step in real install). Marked PROMPT.
step "restart Claude Code to pick up skills/hooks/permissions" \
  "true" \
  "prompt"

# 8. Verify CLAUDE.md overlay copy step (only mutates tmpdir).
step "copy CLAUDE-OVERLAY.md to project CLAUDE.md (tmpdir-only)" \
  "cp '$TMPDIR_ROOT/super-gsd/CLAUDE-OVERLAY.md' '$TMPDIR_ROOT/CLAUDE.md'" \
  "auto"

# 9. Final readiness check: re-run audit, confirm mandatory floor met.
step "post-install audit (mandatory floor met expected)" \
  "node '$REPO_ROOT/super-gsd/tools/installer-audit/audit.cjs' --run --project-root '$TMPDIR_ROOT'" \
  "auto"

# Emit install-layout evidence while the isolated tree still exists. Consumers
# must not infer this state from the filesystem after the cleanup trap runs.
if [ -d "$TMPDIR_ROOT/.planning/phases" ]; then
  echo "clean-room: legacy_phase_root=present"
else
  echo "clean-room: legacy_phase_root=absent"
fi

# ---------------------------------------------------------------------------
# Footer
# ---------------------------------------------------------------------------
echo "============================================================"
echo "clean-room walk completed"
echo "  steps      = $STEP_NUM"
echo "  exit_code  = $EXIT_CODE"
echo "  ts_finished= $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "============================================================"

exit $EXIT_CODE
