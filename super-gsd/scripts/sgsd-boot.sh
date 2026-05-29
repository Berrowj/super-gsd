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

# SSH/non-login shells on dev boxes often skip ~/.bashrc user PATH additions.
# Keep boot health checks consistent with interactive Warp tabs.
if [[ -d "$HOME/.local/bin" ]]; then
    PATH="$HOME/.local/bin:$PATH"
fi
if [[ -d "$HOME/.nvm/versions/node" ]]; then
    SGSD_NODE_BIN="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -1)"
    if [[ -n "$SGSD_NODE_BIN" ]]; then
        PATH="$SGSD_NODE_BIN:$PATH"
    fi
fi
export PATH

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
COCKPIT_SERVER_START="$SCRIPTS/start-cockpit-server.sh"

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

    MEMORY="$PROJECT/.planning/memory/MEMORY.md"
    LEGACY_INDEX="$PROJECT/.brv/context-tree/INDEX.md"
    if [[ -f "$MEMORY" ]]; then
        step OK ".planning/memory/MEMORY.md present"
    elif [[ -f "$LEGACY_INDEX" ]]; then
        step WARN "legacy .brv/context-tree detected - run /sgsd-memory-migrate inside Claude Code"
    else
        step FAIL "memory tier not initialized"
        exit 3
    fi

    # Curate smoke test
    SMOKE_SLUG="boot-smoke-test"
    if [[ -f "$MEMORY" ]]; then
        SMOKE_FILE="$PROJECT/.planning/memory/architecture/patterns/$SMOKE_SLUG.md"
        INDEX="$MEMORY"
        ROW_PATTERN="(architecture/patterns/$SMOKE_SLUG.md)"
    else
        SMOKE_FILE="$PROJECT/.brv/context-tree/patterns/$SMOKE_SLUG.md"
        INDEX="$LEGACY_INDEX"
        ROW_PATTERN="| $SMOKE_SLUG |"
    fi
    rm -f "$SMOKE_FILE" 2>/dev/null
    tmp="$INDEX.tmp.$$"
    grep -Fv "$ROW_PATTERN" "$INDEX" > "$tmp" 2>/dev/null || true
    mv "$tmp" "$INDEX" 2>/dev/null || true

    if echo "boot smoke body" | bash "$SCRIPTS/sgsd-curate.sh" \
           --type pattern --slug "$SMOKE_SLUG" \
           --summary "boot preflight — delete after verification" \
           --root "$PROJECT" >/dev/null 2>&1 \
       && grep -Fq "$ROW_PATTERN" "$INDEX" \
       && [[ -f "$SMOKE_FILE" ]]; then
        step OK "curate write-pipe smoke test"
        rm -f "$SMOKE_FILE"
        tmp="$INDEX.tmp.$$"
        grep -Fv "$ROW_PATTERN" "$INDEX" > "$tmp" || true
        mv "$tmp" "$INDEX"
    else
        step FAIL "curate write-pipe smoke test — DLB-04 Day 0 blocker"
        exit 4
    fi

    # Registry sync
    if [[ -x "$SCRIPTS/sgsd-registry-sync.sh" ]]; then
        MANIFEST="$PROJECT/.planning/resource-registry/agents.jsonl"
        AGENTS_DIR="$PROJECT/super-gsd/agents"
        AGENT_COUNT=$(find "$AGENTS_DIR" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
        MANIFEST_COUNT=$(grep -c '^{' "$MANIFEST" 2>/dev/null || echo 0)
        NEWER_AGENT=$(find "$AGENTS_DIR" -maxdepth 1 -type f -name '*.md' -newer "$MANIFEST" -print -quit 2>/dev/null || true)
        if [[ -f "$MANIFEST" && "$MANIFEST_COUNT" -eq "$AGENT_COUNT" && -z "$NEWER_AGENT" ]]; then
            step OK "Agents registry fresh ($AGENT_COUNT agents)"
        else
            SYNC_OUT="$(bash "$SCRIPTS/sgsd-registry-sync.sh" --root "$PROJECT" 2>&1)"
            if [[ $? -eq 0 ]]; then
                COUNT=$(echo "$SYNC_OUT" | grep -oE '[0-9]+ agent records' | grep -oE '^[0-9]+')
                step OK "Agents registry synced (${COUNT:-?} agents)"
            else
                step WARN "Agents registry sync failed (non-blocking)"
            fi
        fi
    fi

    # SSH readiness: non-login shells must see the same SGSD runtime as the
    # interactive workstation. Repair safe drift before Claude auto mode starts.
    if command -v node >/dev/null 2>&1; then
        step OK "Node.js available ($(node --version 2>/dev/null || echo unknown))"
    else
        step FAIL "Node.js missing from PATH - SGSD health checks cannot run"
        exit 5
    fi

    if command -v claude >/dev/null 2>&1; then
        step OK "Claude CLI available"
    else
        step FAIL "Claude CLI missing from PATH"
        exit 6
    fi

    if command -v codex >/dev/null 2>&1; then
        step OK "Codex CLI available"
    else
        step FAIL "Codex CLI missing from PATH"
        exit 7
    fi
    CODEX_LOGIN_STATUS="$(codex login status 2>&1 || true)"
    if printf '%s' "$CODEX_LOGIN_STATUS" | grep -qi '^Logged in'; then
        step OK "Codex auth ready ($(printf '%s' "$CODEX_LOGIN_STATUS" | head -1))"
    else
        step FAIL "Codex auth missing - run codex login before SGSD auto mode"
        exit 8
    fi

    FEATURE_AUDIT="$PROJECT/super-gsd/tools/feature-propagation/audit.cjs"
    if [[ -f "$FEATURE_AUDIT" ]]; then
        AUDIT_JSON="$(node "$FEATURE_AUDIT" --project-dir "$PROJECT" --repair-safe --json 2>/dev/null || true)"
        AUDIT_OK="$(printf '%s' "$AUDIT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{let j=JSON.parse(s);process.stdout.write(j.ok?"ok":"drift")}catch(e){process.stdout.write("parse_fail")}})' 2>/dev/null || echo parse_fail)"
        AUDIT_ISSUES="$(printf '%s' "$AUDIT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{let j=JSON.parse(s);process.stdout.write((j.issues||[]).join(","))}catch(e){process.stdout.write("parse_fail")}})' 2>/dev/null || echo parse_fail)"
        if [[ "$AUDIT_OK" == "ok" ]]; then
            step OK "Feature propagation OK (Codex executor + gates + global agents)"
        else
            step WARN "Feature propagation drift detected: ${AUDIT_ISSUES:-unknown}"
            if printf '%s' "$AUDIT_ISSUES" | grep -Eq 'legacy_gsd_executor_not_disabled|orchestrator_protocol_markers_missing_or_stale'; then
                step FAIL "Executor/gate protocol drift remains after safe repair"
                exit 9
            fi
        fi
    else
        step FAIL "Feature propagation audit missing"
        exit 10
    fi

    # Substrate one-liner via a tiny inline reader
    if [[ -f "$PROJECT/.planning/resource-registry/agents.jsonl" ]]; then
        AGENTS=$(grep -c '^{' "$PROJECT/.planning/resource-registry/agents.jsonl" 2>/dev/null)
    else
        AGENTS=0
    fi
    HYP=$(ls "$PROJECT/.planning/memory/trajectory/hypothesis/"*.md 2>/dev/null | wc -l)
    CAND=$(ls "$PROJECT/.planning/memory/trajectory/candidate/"*.md 2>/dev/null | wc -l)
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
if [[ -f "$COCKPIT_SERVER_START" ]]; then
    echo "LOCALHOST COCKPIT"
    echo "-----------------"
    COCKPIT_OUT="$(bash "$COCKPIT_SERVER_START" --workspace "$PROJECT" 2>&1)"
    COCKPIT_RC=$?
    printf '%s\n' "$COCKPIT_OUT" | sed 's/^/  /'
    if [[ "$COCKPIT_RC" -eq 0 ]]; then
        if [[ -f "$PROJECT/.planning/runtime/cockpit-server.url" ]]; then
            COCKPIT_URL="$(head -n 1 "$PROJECT/.planning/runtime/cockpit-server.url" 2>/dev/null || true)"
            step OK "localhost cockpit healthy (${COCKPIT_URL:-url file empty})"
        else
            step OK "localhost cockpit healthy"
        fi
    else
        step WARN "localhost cockpit failed to start (exit $COCKPIT_RC)"
    fi
    echo ""
else
    step WARN "localhost cockpit startup script missing: $COCKPIT_SERVER_START"
    echo ""
fi

echo "Bash on Linux/macOS cannot portably open new terminal windows."
echo "Run each dashboard in its own terminal:"
echo ""
echo "  # Terminal 1 — SGSD1 Mission Control"
echo "  pwsh -NoLogo -NoProfile -File $SCRIPTS/sgsd-mission-control.ps1 -ProjectDir '$PROJECT'"
echo ""
echo "  # Terminal 2 — SGSD2 Narrative"
echo "  pwsh -NoLogo -NoProfile -File $SCRIPTS/sgsd-narrative.ps1       -ProjectDir '$PROJECT'"
echo ""
echo "  # Terminal 3 - SGSD3 Codex + VTP/MCP"
echo "  pwsh -NoLogo -NoProfile -File $SCRIPTS/sgsd-codex-monitor.ps1   -ProjectDir '$PROJECT'"
echo ""
echo "On Windows with Windows Terminal installed, prefer the PowerShell version:"
echo "  powershell -File super-gsd/scripts/sgsd-boot.ps1"
echo "It opens a single cockpit window with all three panes."
echo ""
echo "Next: in a separate terminal, run  claude  then say  go"
echo ""
