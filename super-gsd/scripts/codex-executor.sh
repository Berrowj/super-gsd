#!/usr/bin/env bash
# ============================================================================
# codex-executor.sh — Codex-CLI wrapper for EXECUTOR work (file-mutating)
# ============================================================================
# Sibling of codex-exec.sh. While codex-exec.sh is locked to the
# code-reviewer-v1 summary contract (FINDINGS / CRITICAL / WARNINGS /
# PASS_RATE / ONE_LINER, plus optional FINDINGS_DETAIL rows), this wrapper
# invokes Codex for OPEN-ENDED EXECUTOR work — Codex edits files in the
# workspace, runs commands, and returns a free-form report.
#
# Why a separate wrapper:
#   - Different contract (no 5-field structure)
#   - Executor role authorizes scoped implementation under the active plan
#   - Different timeout default (executor work can take 10-20+ min, not 30s)
#   - Different log file (.planning/metrics/codex-executor-log.jsonl)
#
# Usage:
#   codex-executor.sh --prompt-file <p> --report-out <p> [--workspace <dir>]
#                     [--timeout N] [--phase N] [--plan NN-PP] [--profile NAME] [--dry-run]
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
#   --patch-fallback-files <p>
#                  legacy compatibility flag; explicit patch mode is a separate launch
#   --profile NAME  CLI dispatch profile (default: executor)
#   --dry-run       print resolved invocation, exit 0 without calling codex
#
# Exit codes (mirror codex-exec.sh shapes where applicable):
#   0  success — codex completed, report written, JSONL row appended
#   1  generic codex failure (non-zero exit, non-auth, non-timeout)
#   3  codex binary not on PATH
#   4  auth-denied (OPENAI_API_KEY set OR codex stderr matched auth/401/unauth)
#   5  timeout (worker adapter returned 124)
#   8  worker file-read failure requiring explicit recovery
#   9  wrapper completion receipt could not be persisted
#
# OAuth hygiene: same as codex-exec.sh — refuses to run if OPENAI_API_KEY is
# set in environment (would silently degrade auth provenance). Use OAuth via
# `codex login` only.
# ============================================================================

set -u

SCRIPT_DIR="${SGSD_CODEX_EXECUTOR_ORIGINAL_SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)}"
source "$SCRIPT_DIR/lib/codex-worker-shell.sh"
sgsd_codex_worker_bootstrap "$@" || exit $?

if [[ "${SGSD_CODEX_EXECUTOR_REEXECED:-}" != "1" ]]; then
    SGSD_CODEX_EXECUTOR_ORIGINAL_SCRIPT_DIR="$SCRIPT_DIR"
    SGSD_CODEX_EXECUTOR_TEMP_COPY="$(mktemp -t codex-executor.XXXXXX.sh)"
    cp "$0" "$SGSD_CODEX_EXECUTOR_TEMP_COPY"
    chmod u+x "$SGSD_CODEX_EXECUTOR_TEMP_COPY" 2>/dev/null || true
    export SGSD_CODEX_EXECUTOR_REEXECED=1
    export SGSD_CODEX_EXECUTOR_ORIGINAL_SCRIPT_DIR
    export SGSD_CODEX_EXECUTOR_CREATOR_PID=$$
    export SGSD_CODEX_EXECUTOR_TEMP_COPY
    exec "$SGSD_CODEX_EXECUTOR_TEMP_COPY" "$@"
fi
if [[ -n "${SGSD_CODEX_EXECUTOR_TEMP_COPY:-}" && "$$" == "${SGSD_CODEX_EXECUTOR_CREATOR_PID:-}" ]]; then
    trap 'rm -f "$SGSD_CODEX_EXECUTOR_TEMP_COPY" 2>/dev/null || true' EXIT
fi

source "$SCRIPT_DIR/lib/codex-profile-shell.sh"

PROMPT_FILE=""
REPORT_OUT=""
WORKSPACE=""
TIMEOUT_SECONDS="1200"
DRY_RUN=false
SELF_TEST=false
SKIP_NETWORK=false
PROFILE_OVERRIDE=""
PHASE_TAG=""
PLAN_TAG=""
STEP_TAG=""
PATCH_FALLBACK_FILES=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --prompt-file) PROMPT_FILE="$2"; shift 2 ;;
        --report-out)  REPORT_OUT="$2";  shift 2 ;;
        --workspace)   WORKSPACE="$2";   shift 2 ;;
        --timeout)     TIMEOUT_SECONDS="$2"; shift 2 ;;
        --phase)       PHASE_TAG="$2";   shift 2 ;;
        --plan)        PLAN_TAG="$2";    shift 2 ;;
        --step)        STEP_TAG="$2";    shift 2 ;;
        --owner)       export SGSD_WORKER_OWNER="$2"; shift 2 ;;
        --patch-fallback-files) PATCH_FALLBACK_FILES="$2"; shift 2 ;;
        --dry-run)     DRY_RUN=true;     shift ;;
        --profile)     PROFILE_OVERRIDE="$2"; shift 2 ;;
        --self-test)   SELF_TEST=true;   shift ;;
        --skip-network) SKIP_NETWORK=true; shift ;;
        --help|-h)     head -50 "$0" | tail -45; exit 0 ;;
        *)             echo "codex-executor: unexpected arg '$1'" >&2; exit 1 ;;
    esac
done

if [[ "$SELF_TEST" == true ]]; then
    ST_TMP="$(mktemp -d)"
    mkdir -p "$ST_TMP/project/.planning"
    printf 'executor self-test fixture\n' > "$ST_TMP/prompt"
    ST_FIXTURE="$SCRIPT_DIR/../tools/codex-worker/fixtures/app-server.cjs"
    ST_PREFIX="$(node -e 'process.stdout.write(JSON.stringify([process.argv[1]]))' "$ST_FIXTURE")"
    SGSD_CODEX_APP_SERVER_COMMAND="$(command -v node)" SGSD_CODEX_APP_SERVER_ARGS="$ST_PREFIX" \
        WORKER_FIXTURE_MODE=complete WORKER_FIXTURE_REPORT="executor self-test complete" SGSD_ATLAS_DISABLED=1 \
        "$0" --workspace "$ST_TMP/project" --prompt-file "$ST_TMP/prompt" --report-out "$ST_TMP/report" --timeout 10
    ST_RC=$?
    if [[ "$ST_RC" -eq 0 ]] && grep -q 'executor self-test complete' "$ST_TMP/report"; then
        echo "codex-executor self-test: full-access worker completion PASS"
    else
        echo "codex-executor self-test: worker completion FAIL" >&2
        ST_RC=1
    fi
    rm -rf "$ST_TMP"
    exit "$ST_RC"
fi
if [[ "$SELF_TEST" == false && ( -z "$PROMPT_FILE" || -z "$REPORT_OUT" ) ]]; then
    echo "codex-executor: --prompt-file and --report-out are required" >&2
    exit 1
fi
if [[ "$SELF_TEST" == false && ! -e "$PROMPT_FILE" ]]; then
    echo "codex-executor: prompt file not found: $PROMPT_FILE" >&2
    exit 1
fi

if [[ "$SELF_TEST" == false && -n "${OPENAI_API_KEY:-}" ]]; then
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

PROFILE_REQUESTED="${PROFILE_OVERRIDE:-${SGSD_CODEX_PROFILE:-executor}}"
sgsd_codex_load_cli_profile "$PROFILE_REQUESTED" "executor" "$PROJECT"
CODEX_MODEL="$SGSD_CODEX_PROFILE_MODEL"
CODEX_REASONING_EFFORT="$SGSD_CODEX_PROFILE_REASONING_EFFORT"
CODEX_PROFILE_SANDBOX="$SGSD_CODEX_PROFILE_SANDBOX"
CODEX_PROFILE_EPHEMERAL="$SGSD_CODEX_PROFILE_EPHEMERAL"
CODEX_PROFILE_APPROVAL="$SGSD_CODEX_PROFILE_APPROVAL"
CODEX_PROFILE_FULL_AUTO="$SGSD_CODEX_PROFILE_FULL_AUTO"

# Path translation
if [[ "$WORKSPACE" =~ ^[A-Za-z]:\\ ]] && command -v wslpath >/dev/null 2>&1; then
    WORKSPACE="$(wslpath -u "$WORKSPACE" 2>/dev/null || echo "$WORKSPACE")"
fi
sgsd_codex_worker_prepare "$PROJECT" "$WORKSPACE" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" "$TIMEOUT_SECONDS" executor || exit $?
RESOLVED="$(sgsd_codex_worker_preview) < $(printf %q "$PROMPT_FILE")"
if [[ "$DRY_RUN" == true ]]; then
    echo "codex-executor DRY RUN"
    echo "  resolved: $RESOLVED"
    echo "  profile:  $SGSD_CODEX_RESOLVED_PROFILE ($SGSD_CODEX_PROFILE_STATUS:$SGSD_CODEX_PROFILE_REASON)"
    echo "  model:    $CODEX_MODEL"
    echo "  effort:   $CODEX_REASONING_EFFORT"
    echo "  timeout:  ${TIMEOUT_SECONDS}s"
    echo "  workspace: $WORKSPACE  (codex --cd: $CODEX_CD)"
    echo "  prompt:   $PROMPT_FILE"
    echo "  report:   $REPORT_OUT"
    if [[ -n "$PATCH_FALLBACK_FILES" ]]; then
        echo "  patch-fallback-files: $PATCH_FALLBACK_FILES"
    fi
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
WATCH_OUT="$PROJECT/.planning/metrics/codex-live-output.txt"
mkdir -p "$(dirname "$LIVE_OUT")"
{
    echo "============================================================"
    echo "codex-executor START  ts=$TS  phase=${PHASE_TAG:-?}  plan=${PLAN_TAG:-?}"
    echo "model=$CODEX_MODEL  effort=$CODEX_REASONING_EFFORT  timeout=${TIMEOUT_SECONDS}s"
    echo "workspace=$CODEX_CD  prompt=$PROMPT_FILE  report=$REPORT_OUT"
    echo "============================================================"
} > "$LIVE_OUT"
{
    echo ""
    echo "============================================================"
    echo "codex-executor START  ts=$TS  phase=${PHASE_TAG:-?}  plan=${PLAN_TAG:-?}"
    echo "model=$CODEX_MODEL  effort=$CODEX_REASONING_EFFORT  timeout=${TIMEOUT_SECONDS}s"
    echo "workspace=$CODEX_CD  prompt=$PROMPT_FILE  report=$REPORT_OUT"
    echo "============================================================"
} >> "$WATCH_OUT"

trap 'wrapper_exit=$?; sgsd_codex_worker_finish "$wrapper_exit" || { [[ "$wrapper_exit" -ne 0 ]] || wrapper_exit=9; }; rm -f "$STDOUT_TMP" "$STDERR_TMP" "${REPORT_OUT}.tmp" 2>/dev/null || true; if [[ $$ == "${SGSD_CODEX_EXECUTOR_CREATOR_PID:-}" ]]; then rm -f "${SGSD_CODEX_EXECUTOR_TEMP_COPY:-}" 2>/dev/null || true; fi; exit "$wrapper_exit"' EXIT
sgsd_codex_worker_begin || exit $?

sgsd_atlas_codex_args() { SGSD_ATLAS_CODEX_ARGS=(); }
ATLAS_HELPER="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)}/lib/atlas-shell.sh"
if [[ -f "$ATLAS_HELPER" ]]; then
    source "$ATLAS_HELPER"
    sgsd_atlas_attach executor openai "$PROJECT"
fi
set +e
sgsd_codex_worker_run "$PROMPT_FILE" \
    2> >(tee -a "$LIVE_OUT" -a "$WATCH_OUT" > "$STDERR_TMP") \
    | tee -a "$LIVE_OUT" -a "$WATCH_OUT" > "$STDOUT_TMP"
RC=${PIPESTATUS[0]}
if declare -F sgsd_atlas_finish >/dev/null; then sgsd_atlas_finish; fi
{
    echo ""
    echo "============================================================"
    echo "codex-executor END    exit=$RC  duration=$(( ($(date +%s%3N 2>/dev/null || echo 0) - START_MS) / 1000 ))s"
    echo "============================================================"
} >> "$LIVE_OUT"
{
    echo ""
    echo "============================================================"
    echo "codex-executor END    exit=$RC  duration=$(( ($(date +%s%3N 2>/dev/null || echo 0) - START_MS) / 1000 ))s"
    echo "============================================================"
} >> "$WATCH_OUT"
set -e

END_MS="$(date +%s%3N 2>/dev/null || echo 0)"
DURATION_MS=$([[ "$START_MS" -gt 0 && "$END_MS" -ge "$START_MS" ]] && echo $((END_MS - START_MS)) || echo 0)

# Write report atomically
mkdir -p "$(dirname "$REPORT_OUT")"
cp "$STDOUT_TMP" "$REPORT_OUT.tmp"
mv "$REPORT_OUT.tmp" "$REPORT_OUT"
REPORT_BYTES=$(wc -c < "$REPORT_OUT" | tr -d ' ')

codex_read_block_detected() {
    grep -qiE '(CreateProcessAsUserW|error[ =:]?216|os error 216|file read.*blocked|cannot read file)' \
        "$STDERR_TMP" "$STDOUT_TMP" "$REPORT_OUT" 2>/dev/null
}

# Codex CLI on Windows can return exit 0 while placing the read-block failure
# in stdout/report text. Detect this before success handling or telemetry would
# falsely record a completed executor run.
if [[ $RC -ne 124 ]] && codex_read_block_detected; then
    echo "codex-executor: worker file-read failure; explicit recovery required, no automatic replacement worker" >&2
    exit 8
fi

# JSONL log
LOG="$PROJECT/.planning/metrics/codex-executor-log.jsonl"
mkdir -p "$(dirname "$LOG")"
phase_field="${PHASE_TAG:-null}"
[[ "$phase_field" == "null" ]] || phase_field="$phase_field"  # numeric stays as numeric
plan_field=$([[ -z "$PLAN_TAG" ]] && echo "null" || echo "\"$PLAN_TAG\"")
stderr_preview="$(head -c 200 "$STDERR_TMP" 2>/dev/null | tr -d '\r' | tr '\n' ' ' | sed 's/"/\\"/g')"
timeout_hit="false"
[[ $RC -eq 124 ]] && timeout_hit="true"
PROMPT_BYTES=0
if [[ -f "$PROMPT_FILE" ]]; then PROMPT_BYTES=$(wc -c < "$PROMPT_FILE" | tr -d ' '); fi

printf '{"ts":"%s","phase":%s,"plan":%s,"role":"executor","model":"%s","reasoning_effort":"%s","exit":%d,"duration_ms":%d,"prompt_bytes":%d,"report_bytes":%d,"timeout_hit":%s,"stderr_preview":"%s"}\n' \
    "$TS" "$phase_field" "$plan_field" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" \
    "$RC" "$DURATION_MS" "$PROMPT_BYTES" "$REPORT_BYTES" \
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

sgsd_codex_worker_finish 0 || exit 9
echo "codex-executor: OK — $REPORT_OUT (${REPORT_BYTES}B), codex took ${DURATION_MS}ms"
exit 0
