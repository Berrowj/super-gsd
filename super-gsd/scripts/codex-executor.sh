#!/usr/bin/env bash
# ============================================================================
# codex-executor.sh — Codex-CLI wrapper for EXECUTOR work (file-mutating)
# ============================================================================
# Sibling of codex-exec.sh. While codex-exec.sh is locked to the 5-field
# code-reviewer-v1 contract (FINDINGS / CRITICAL / WARNINGS / PASS_RATE /
# ONE_LINER), this wrapper invokes Codex for OPEN-ENDED EXECUTOR work — Codex
# edits files in the workspace, runs commands, and returns a free-form report.
#
# Why a separate wrapper:
#   - Different contract (no 5-field structure)
#   - Different sandbox (workspace-write, not read-only)
#   - Different timeout default (executor work can take 10-20+ min, not 30s)
#   - Different log file (.planning/metrics/codex-executor-log.jsonl)
#
# Usage:
#   codex-executor.sh --prompt-file <p> --report-out <p> [--workspace <dir>]
#                     [--timeout N] [--phase N] [--plan NN-PP] [--dry-run]
#
# Required:
#   --prompt-file   path to executor prompt (open-ended; describes what to do)
#   --report-out    where to write codex's stdout (post-completion report)
#   --workspace     project root that codex can write into (default: cwd)
#
# Optional:
#   --timeout N     seconds (default: 1200 = 20 min, vs 60s for review)
#   --phase N       JSONL log tag (numeric)
#   --plan NN-PP    JSONL log tag (string)
#   --dry-run       print resolved invocation, exit 0 without calling codex
#
# Exit codes (mirror codex-exec.sh shapes where applicable):
#   0  success — codex completed, report written, JSONL row appended
#   1  generic codex failure (non-zero exit, non-auth, non-timeout)
#   3  codex binary not on PATH
#   4  auth-denied (OPENAI_API_KEY set OR codex stderr matched auth/401/unauth)
#   5  timeout (GNU timeout returned 124)
#
# OAuth hygiene: same as codex-exec.sh — refuses to run if OPENAI_API_KEY is
# set in environment (would silently degrade auth provenance). Use OAuth via
# `codex login` only.
# ============================================================================

set -u

PROMPT_FILE=""
REPORT_OUT=""
WORKSPACE=""
TIMEOUT_SECONDS="1200"
DRY_RUN=false
PHASE_TAG=""
PLAN_TAG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --prompt-file) PROMPT_FILE="$2"; shift 2 ;;
        --report-out)  REPORT_OUT="$2";  shift 2 ;;
        --workspace)   WORKSPACE="$2";   shift 2 ;;
        --timeout)     TIMEOUT_SECONDS="$2"; shift 2 ;;
        --phase)       PHASE_TAG="$2";   shift 2 ;;
        --plan)        PLAN_TAG="$2";    shift 2 ;;
        --dry-run)     DRY_RUN=true;     shift ;;
        --help|-h)     head -50 "$0" | tail -45; exit 0 ;;
        *)             echo "codex-executor: unexpected arg '$1'" >&2; exit 1 ;;
    esac
done

if [[ -z "$PROMPT_FILE" || -z "$REPORT_OUT" ]]; then
    echo "codex-executor: --prompt-file and --report-out are required" >&2
    exit 1
fi
if [[ ! -e "$PROMPT_FILE" ]]; then
    echo "codex-executor: prompt file not found: $PROMPT_FILE" >&2
    exit 1
fi

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    echo "codex-executor: ERR — OAuth-only; unset OPENAI_API_KEY before invoking" >&2
    exit 4
fi

if [[ -z "$WORKSPACE" ]]; then WORKSPACE="$(pwd -P)"; fi
if [[ ! -d "$WORKSPACE" ]]; then
    echo "codex-executor: workspace dir not found: $WORKSPACE" >&2
    exit 1
fi

# Resolve project root (.planning/ ancestor) for log writes.
PROJECT="$WORKSPACE"
d="$WORKSPACE"
while [[ "$d" != "/" && "$d" != "" ]]; do
    if [[ -d "$d/.planning" ]]; then PROJECT="$d"; break; fi
    d="$(dirname "$d")"
done

# Codex runtime config — mirrors codex-exec.sh defaults so Codex is stable
# across review and executor calls.
CODEX_MODEL="gpt-5.5"
CODEX_REASONING_EFFORT="xhigh"
if [[ -f "$PROJECT/.planning/config.json" ]] && command -v node >/dev/null 2>&1; then
    cfg="$(node -e '
        try {
            const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
            const r=j.review_providers||{};
            if (r.codex_executor_model) process.stdout.write("M="+r.codex_executor_model+"\n");
            if (r.codex_executor_reasoning_effort) process.stdout.write("E="+r.codex_executor_reasoning_effort+"\n");
        } catch (e) {}
    ' "$PROJECT/.planning/config.json" 2>/dev/null || true)"
    while IFS='=' read -r key val; do
        case "$key" in
            M) [[ -n "$val" ]] && CODEX_MODEL="$val" ;;
            E) [[ -n "$val" ]] && CODEX_REASONING_EFFORT="$val" ;;
        esac
    done <<< "$cfg"
fi

# Path translation: Windows → POSIX for Bash, Windows → wsl path → Win for cmd.exe.
if [[ "$WORKSPACE" =~ ^[A-Za-z]:\\ ]] && command -v wslpath >/dev/null 2>&1; then
    WORKSPACE="$(wslpath -u "$WORKSPACE" 2>/dev/null || echo "$WORKSPACE")"
fi
CODEX_CD="$WORKSPACE"
CODEX_LAUNCHER="direct"
CODEX_BIN="codex"
if [[ -r /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null && command -v cmd.exe >/dev/null 2>&1; then
    CODEX_LAUNCHER="cmd"
    CODEX_BIN="cmd.exe"
    if command -v wslpath >/dev/null 2>&1; then
        CODEX_CD="$(wslpath -w "$WORKSPACE" 2>/dev/null || echo "$WORKSPACE")"
    fi
fi

# codex binary check
if [[ "$CODEX_LAUNCHER" == "direct" ]] && ! command -v codex >/dev/null 2>&1; then
    echo "codex-executor: 'codex' CLI not on \$PATH" >&2
    exit 3
fi

# Resolved invocation. --full-auto enables workspace-write + auto-approve.
RESOLVED="timeout ${TIMEOUT_SECONDS}s bash -c 'cat \"\$0\" | $([[ "$CODEX_LAUNCHER" == "cmd" ]] && echo "cmd.exe /c codex" || echo "codex") exec --full-auto --model \"\$1\" -c \"model_reasoning_effort=\\\"\$2\\\"\" --skip-git-repo-check --cd \"\$3\" -' \"$PROMPT_FILE\" \"$CODEX_MODEL\" \"$CODEX_REASONING_EFFORT\" \"$CODEX_CD\""

if [[ "$DRY_RUN" == true ]]; then
    echo "codex-executor DRY RUN"
    echo "  resolved: $RESOLVED"
    echo "  model:    $CODEX_MODEL"
    echo "  effort:   $CODEX_REASONING_EFFORT"
    echo "  timeout:  ${TIMEOUT_SECONDS}s"
    echo "  workspace: $WORKSPACE  (codex --cd: $CODEX_CD)"
    echo "  prompt:   $PROMPT_FILE"
    echo "  report:   $REPORT_OUT"
    exit 0
fi

# Real invocation
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_MS="$(date +%s%3N 2>/dev/null || echo 0)"
STDOUT_TMP="$(mktemp -t codex-exec-stdout.XXXXXX)"
STDERR_TMP="$(mktemp -t codex-exec-stderr.XXXXXX)"
# Live tee target so a watching pane can follow codex output in real time.
# Path is project-rooted + stable (overwritten each invocation), so the
# operator runs `Get-Content -Wait` on it ONCE in a separate pane and follows
# every subsequent codex executor session.
LIVE_OUT="$PROJECT/.planning/metrics/codex-executor-live.txt"
mkdir -p "$(dirname "$LIVE_OUT")"
{
    echo "============================================================"
    echo "codex-executor START  ts=$TS  phase=${PHASE_TAG:-?}  plan=${PLAN_TAG:-?}"
    echo "model=$CODEX_MODEL  effort=$CODEX_REASONING_EFFORT  timeout=${TIMEOUT_SECONDS}s"
    echo "workspace=$CODEX_CD  prompt=$PROMPT_FILE  report=$REPORT_OUT"
    echo "============================================================"
} > "$LIVE_OUT"

trap 'rm -f "$STDOUT_TMP" "$STDERR_TMP" "${REPORT_OUT}.tmp" 2>/dev/null || true' EXIT

set +e
if [[ "$CODEX_LAUNCHER" == "cmd" ]]; then
    timeout "${TIMEOUT_SECONDS}s" bash -c 'cat "$0" | cmd.exe /c codex exec --full-auto --model "$1" -c "model_reasoning_effort=\"$2\"" --skip-git-repo-check --cd "$3" -' \
        "$PROMPT_FILE" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" "$CODEX_CD" \
        2> "$STDERR_TMP" \
        | tee -a "$LIVE_OUT" \
        > "$STDOUT_TMP"
    RC=${PIPESTATUS[0]}
else
    timeout "${TIMEOUT_SECONDS}s" bash -c 'cat "$0" | codex exec --full-auto --model "$1" -c "model_reasoning_effort=\"$2\"" --skip-git-repo-check --cd "$3" -' \
        "$PROMPT_FILE" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" "$CODEX_CD" \
        2> "$STDERR_TMP" \
        | tee -a "$LIVE_OUT" \
        > "$STDOUT_TMP"
    RC=${PIPESTATUS[0]}
fi
{
    echo ""
    echo "============================================================"
    echo "codex-executor END    exit=$RC  duration=$(( ($(date +%s%3N 2>/dev/null || echo 0) - START_MS) / 1000 ))s"
    echo "============================================================"
} >> "$LIVE_OUT"
set -e

END_MS="$(date +%s%3N 2>/dev/null || echo 0)"
DURATION_MS=$([[ "$START_MS" -gt 0 && "$END_MS" -ge "$START_MS" ]] && echo $((END_MS - START_MS)) || echo 0)

# Write report atomically
mkdir -p "$(dirname "$REPORT_OUT")"
cp "$STDOUT_TMP" "$REPORT_OUT.tmp"
mv "$REPORT_OUT.tmp" "$REPORT_OUT"
REPORT_BYTES=$(wc -c < "$REPORT_OUT" | tr -d ' ')

# JSONL log
LOG="$PROJECT/.planning/metrics/codex-executor-log.jsonl"
mkdir -p "$(dirname "$LOG")"
phase_field="${PHASE_TAG:-null}"
[[ "$phase_field" == "null" ]] || phase_field="$phase_field"  # numeric stays as numeric
plan_field=$([[ -z "$PLAN_TAG" ]] && echo "null" || echo "\"$PLAN_TAG\"")
stderr_preview="$(head -c 200 "$STDERR_TMP" 2>/dev/null | tr -d '\r' | tr '\n' ' ' | sed 's/"/\\"/g')"
timeout_hit="false"
[[ $RC -eq 124 ]] && timeout_hit="true"

printf '{"ts":"%s","phase":%s,"plan":%s,"role":"executor","model":"%s","reasoning_effort":"%s","exit":%d,"duration_ms":%d,"prompt_bytes":%d,"report_bytes":%d,"timeout_hit":%s,"stderr_preview":"%s"}\n' \
    "$TS" "$phase_field" "$plan_field" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" \
    "$RC" "$DURATION_MS" "$(wc -c < "$PROMPT_FILE" | tr -d ' ')" "$REPORT_BYTES" \
    "$timeout_hit" "$stderr_preview" \
    >> "$LOG"

# Exit handling
if [[ $RC -eq 124 ]]; then
    echo "codex-executor: timeout after ${TIMEOUT_SECONDS}s" >&2
    exit 5
fi
if [[ $RC -ne 0 ]]; then
    if grep -qiE '(auth|401|unauthori[sz]ed)' "$STDERR_TMP" 2>/dev/null; then
        echo "codex-executor: auth-denied" >&2
        head -c 200 "$STDERR_TMP" >&2; echo >&2
        exit 4
    fi
    echo "codex-executor: codex exit=$RC" >&2
    head -c 200 "$STDERR_TMP" >&2; echo >&2
    exit 1
fi

echo "codex-executor: OK — $REPORT_OUT (${REPORT_BYTES}B), codex took ${DURATION_MS}ms"
exit 0
