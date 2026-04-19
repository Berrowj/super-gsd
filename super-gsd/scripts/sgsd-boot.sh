#!/usr/bin/env bash
# ============================================================================
# Super GSD · Boot Command (bash fallback)
# ============================================================================
# For macOS / Linux / Git Bash on Windows. On pure Windows with PowerShell
# installed, prefer sgsd-boot.ps1 — it uses Windows Terminal natively and
# opens all three dashboards in one cockpit window.
#
# This fallback runs the preflight checks and prints the launch commands the
# operator should run in separate terminals. Bash can't easily spawn new
# terminal windows in a cross-platform way.
#
# Usage:
#   bash super-gsd/scripts/sgsd-boot.sh [--project PATH] [--skip-preflight]
# ============================================================================

set -u

PROJECT=""
SKIP_PREFLIGHT=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project)        PROJECT="$2"; shift 2 ;;
        --skip-preflight) SKIP_PREFLIGHT=true; shift ;;
        --help|-h)        head -20 "$0" | tail -15; exit 0 ;;
        *) echo "sgsd-boot: unknown argument: $1" >&2; exit 2 ;;
    esac
done

# Resolve project root
if [[ -z "$PROJECT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" && -d "$d/super-gsd/scripts" ]]; then
            PROJECT="$d"
            break
        fi
        d="$(dirname "$d")"
    done
fi
if [[ -z "$PROJECT" || ! -d "$PROJECT/super-gsd/scripts" ]]; then
    echo "sgsd-boot: no super-gsd project root found. Pass --project PATH." >&2
    exit 1
fi

SCRIPTS="$PROJECT/super-gsd/scripts"

# ── Banner ──
echo ""
echo "================================================"
echo "          SUPER GSD · Boot Command              "
echo "================================================"
echo "  Project: $PROJECT"
echo ""

step() {
    local status="$1" label="$2"
    case "$status" in
        OK)   printf '  [\033[32mOK\033[0m] %s\n'   "$label" ;;
        WARN) printf '  [\033[33mWARN\033[0m] %s\n' "$label" ;;
        FAIL) printf '  [\033[31mFAIL\033[0m] %s\n' "$label" ;;
    esac
}

if [[ "$SKIP_PREFLIGHT" != true ]]; then
    echo "PREFLIGHT"
    echo "---------"

    if [[ -d "$PROJECT/.planning" ]]; then
        step OK ".planning/ present"
    else
        step FAIL ".planning/ missing — run bash super-gsd/install.sh --init-project first"
        exit 2
    fi

    if [[ -f "$PROJECT/.brv/context-tree/INDEX.md" ]]; then
        step OK ".brv/context-tree/INDEX.md present"
    else
        step FAIL "memory tier not initialized"
        exit 3
    fi

    # Curate smoke test
    SMOKE_SLUG="boot-smoke-test"
    SMOKE_FILE="$PROJECT/.brv/context-tree/patterns/$SMOKE_SLUG.md"
    INDEX="$PROJECT/.brv/context-tree/INDEX.md"
    rm -f "$SMOKE_FILE" 2>/dev/null
    sed -i.bak "/| $SMOKE_SLUG |/d" "$INDEX" 2>/dev/null && rm -f "$INDEX.bak"

    if echo "boot smoke body" | bash "$SCRIPTS/sgsd-curate.sh" \
           --type pattern --slug "$SMOKE_SLUG" \
           --summary "boot preflight — delete after verification" \
           --root "$PROJECT" >/dev/null 2>&1 \
       && grep -q "| $SMOKE_SLUG |" "$INDEX" \
       && [[ -f "$SMOKE_FILE" ]]; then
        step OK "curate write-pipe smoke test"
        rm -f "$SMOKE_FILE"
        sed -i.bak "/| $SMOKE_SLUG |/d" "$INDEX" && rm -f "$INDEX.bak"
    else
        step FAIL "curate write-pipe smoke test — DLB-04 Day 0 blocker"
        exit 4
    fi

    # Registry sync
    if [[ -x "$SCRIPTS/sgsd-registry-sync.sh" ]]; then
        SYNC_OUT="$(bash "$SCRIPTS/sgsd-registry-sync.sh" --root "$PROJECT" 2>&1)"
        if [[ $? -eq 0 ]]; then
            COUNT=$(echo "$SYNC_OUT" | grep -oE '[0-9]+ agent records' | grep -oE '^[0-9]+')
            step OK "Agents registry synced (${COUNT:-?} agents)"
        else
            step WARN "Agents registry sync failed (non-blocking)"
        fi
    fi

    # Substrate one-liner via a tiny inline reader
    if [[ -f "$PROJECT/.planning/resource-registry/agents.jsonl" ]]; then
        AGENTS=$(grep -c '^{' "$PROJECT/.planning/resource-registry/agents.jsonl" 2>/dev/null)
    else
        AGENTS=0
    fi
    HYP=$(ls "$PROJECT/.brv/context-tree/trajectory-hypothesis/"*.md 2>/dev/null | wc -l)
    CAND=$(ls "$PROJECT/.brv/context-tree/trajectory-hypothesis/candidate/"*.md 2>/dev/null | wc -l)
    PROP=$(ls "$PROJECT/.planning/proposals/"*.md 2>/dev/null | wc -l)

    echo ""
    printf '  DLB-04 [reg %s agents] [sepl %s proposals] [distill %sh/%sq]\n' \
        "$AGENTS" "$PROP" "$HYP" "$CAND"
    echo ""
fi

# ── Launch instructions ──
echo "LAUNCH"
echo "------"
echo ""
echo "Bash on Linux/macOS cannot portably open new terminal windows."
echo "Run each dashboard in its own terminal:"
echo ""
echo "  # Terminal 1 — SGSD1 Mission Control"
echo "  powershell.exe -File $SCRIPTS/sgsd-mission-control.ps1 -ProjectDir '$PROJECT'"
echo ""
echo "  # Terminal 2 — SGSD2 Narrative"
echo "  powershell.exe -File $SCRIPTS/sgsd-narrative.ps1       -ProjectDir '$PROJECT'"
echo ""
echo "  # Terminal 3 — SGSD3 Gate Verdict"
echo "  powershell.exe -File $SCRIPTS/sgsd-gate-verdict.ps1    -ProjectDir '$PROJECT'"
echo ""
echo "On Windows with Windows Terminal installed, prefer the PowerShell version:"
echo "  powershell -File super-gsd/scripts/sgsd-boot.ps1"
echo "It opens a single cockpit window with all three panes."
echo ""
echo "Next: in a separate terminal, run  claude  then say  go"
echo ""
