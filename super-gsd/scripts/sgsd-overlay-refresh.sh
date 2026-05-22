#!/usr/bin/env bash
# ============================================================================
# sgsd-overlay-refresh.sh — bash mirror of sgsd-overlay-refresh.ps1
# ============================================================================
# Keeps a project's CLAUDE.md in sync with canonical super-gsd CLAUDE-OVERLAY.md
# using HTML-comment markers for idempotent replacement.
#
# Usage:
#   sgsd-overlay-refresh.sh                         (current cwd)
#   sgsd-overlay-refresh.sh --project PATH
#   sgsd-overlay-refresh.sh --dry-run
#   sgsd-overlay-refresh.sh --force                 (first-run append)
#   sgsd-overlay-refresh.sh --source PATH           (override overlay source)
# ============================================================================

set -u

PROJECT="."
DRY_RUN=false
FORCE=false
SOURCE_OVERRIDE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project)   PROJECT="$2"; shift 2 ;;
        --dry-run)   DRY_RUN=true; shift ;;
        --force)     FORCE=true; shift ;;
        --source)    SOURCE_OVERRIDE="$2"; shift 2 ;;
        --help|-h)   head -20 "$0" | tail -15; exit 0 ;;
        *) echo "sgsd-overlay-refresh: unknown argument: $1" >&2; exit 2 ;;
    esac
done

if ! PROJECT=$(cd "$PROJECT" 2>/dev/null && pwd -P); then
    echo "ERROR: cannot resolve project directory: $PROJECT" >&2
    exit 1
fi

candidates=()
[[ -n "$SOURCE_OVERRIDE" ]] && candidates+=("$SOURCE_OVERRIDE")
candidates+=(
    "$HOME/.claude/super-gsd/source/super-gsd/CLAUDE-OVERLAY.md"
    "$(dirname "$0")/../CLAUDE-OVERLAY.md"
    "/c/Users/user/GSDedits/super-gsd/CLAUDE-OVERLAY.md"
)

OVERLAY_SRC=""
for c in "${candidates[@]}"; do
    if [[ -f "$c" ]]; then OVERLAY_SRC="$c"; break; fi
done

if [[ -z "$OVERLAY_SRC" ]]; then
    echo "ERROR: Cannot find CLAUDE-OVERLAY.md. Tried:" >&2
    printf '  %s\n' "${candidates[@]}" >&2
    echo "Run 'sgsd-update' first to clone the canonical source, or pass --source PATH." >&2
    exit 2
fi

OVERLAY_CONTENT=$(cat "$OVERLAY_SRC")
OVERLAY_HASH=$(sha1sum "$OVERLAY_SRC" 2>/dev/null | cut -c1-10 || shasum "$OVERLAY_SRC" 2>/dev/null | cut -c1-10)

echo ""
echo "=== sgsd-overlay-refresh ==="
echo "  Project      : $PROJECT"
echo "  Overlay src  : $OVERLAY_SRC"
echo "  Overlay hash : $OVERLAY_HASH"
echo ""

CLAUDE_MD="$PROJECT/CLAUDE.md"
START_MARKER="<!-- SUPER-GSD-OVERLAY-START -->"
END_MARKER="<!-- SUPER-GSD-OVERLAY-END -->"

WRAPPED="$START_MARKER
<!-- Auto-synced by sgsd-overlay-refresh. Hash: $OVERLAY_HASH -->
$OVERLAY_CONTENT
$END_MARKER"

if [[ ! -f "$CLAUDE_MD" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
        echo "DRY RUN: would CREATE $CLAUDE_MD"
        exit 0
    fi
    {
        echo "# Project CLAUDE.md"
        echo ""
        echo "The super-gsd overlay below is auto-synced — do not edit between the markers."
        echo ""
        echo "---"
        echo ""
        echo "$WRAPPED"
    } > "$CLAUDE_MD"
    echo "[+] CREATED $CLAUDE_MD"
    exit 0
fi

HAS_START=false
HAS_END=false
grep -qF "$START_MARKER" "$CLAUDE_MD" && HAS_START=true
grep -qF "$END_MARKER" "$CLAUDE_MD" && HAS_END=true

if [[ "$HAS_START" == true && "$HAS_END" == true ]]; then
    TMP=$(mktemp)
    awk -v start="$START_MARKER" -v end="$END_MARKER" -v replacement="$WRAPPED" '
        BEGIN { in_block = 0 }
        index($0, start) == 1 { print replacement; in_block = 1; next }
        in_block && index($0, end) == 1 { in_block = 0; next }
        !in_block { print }
    ' "$CLAUDE_MD" > "$TMP"

    if diff -q "$CLAUDE_MD" "$TMP" >/dev/null 2>&1; then
        echo "[=] CLAUDE.md already current with overlay hash $OVERLAY_HASH. No change."
        rm -f "$TMP"
        exit 0
    fi

    if [[ "$DRY_RUN" == true ]]; then
        echo "DRY RUN: would REPLACE block between markers"
        rm -f "$TMP"
        exit 0
    fi

    cp "$CLAUDE_MD" "$CLAUDE_MD.bak"
    mv "$TMP" "$CLAUDE_MD"
    echo "[~] REPLACED overlay block in CLAUDE.md"
    echo "    Backup: $CLAUDE_MD.bak"
    exit 0
fi

if [[ "$HAS_START" != "$HAS_END" ]]; then
    echo "ERROR: CLAUDE.md has only one of the markers (orphan)." >&2
    echo "  Start marker present: $HAS_START" >&2
    echo "  End marker present  : $HAS_END" >&2
    exit 3
fi

if [[ "$FORCE" != true ]]; then
    cat <<EOF
Existing CLAUDE.md has no super-gsd markers.

Options:
  1. If CLAUDE.md does NOT already contain the super-gsd overlay:
     Re-run with --force — appends the overlay with markers.

  2. If CLAUDE.md ALREADY contains an older super-gsd overlay (manually appended):
     a. Delete the old overlay section from CLAUDE.md manually
     b. Re-run with --force
     OR
     a. Add the markers manually around the existing overlay block
     b. Re-run without --force

  Use --dry-run with --force to preview without writing.
EOF
    exit 4
fi

if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN: would APPEND marker-wrapped overlay to $CLAUDE_MD"
    echo "WARNING: if CLAUDE.md already contains an unmarked overlay, this will duplicate content."
    exit 0
fi

cp "$CLAUDE_MD" "$CLAUDE_MD.bak"
{
    cat "$CLAUDE_MD"
    echo ""
    echo "---"
    echo ""
    echo "$WRAPPED"
} > "$CLAUDE_MD.tmp" && mv "$CLAUDE_MD.tmp" "$CLAUDE_MD"

echo "[+] APPENDED marker-wrapped overlay to CLAUDE.md"
echo "    Backup: $CLAUDE_MD.bak"
echo "    IMPORTANT: if the project already had an older overlay, check CLAUDE.md for duplication and delete the older unmarked copy."
