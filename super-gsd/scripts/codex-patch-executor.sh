#!/usr/bin/env bash
# ============================================================================
# codex-patch-executor.sh - Codex executor fallback for Windows read-blocks
# ============================================================================
# Some Windows Codex CLI hosts can write but fail every file-read attempt with
# CreateProcessAsUserW=216. This fallback keeps Codex as the code author:
# SGSD supplies a bounded read-pack, Codex returns a unified diff, and this
# wrapper validates/applies that patch locally.
# ============================================================================
# Usage:
#   codex-patch-executor.sh --prompt-file <p> --report-out <p> --files <manifest>
#                           [--workspace <dir>] [--timeout N] [--no-apply]
#                           [--phase N] [--plan NN-PP] [--dry-run]
#
# Flags:
#   --files <manifest>  REQUIRED. A FILE listing one repo-relative path per line
#                       (NOT a single path). It is ALSO the WRITE ALLOWLIST:
#                       Codex may only create/modify paths listed in it. To have
#                       Codex author a NEW file, add its target path here (and
#                       pre-create an empty placeholder if the path must exist).
#   --report-out <p>    Where Codex stdout is copied. Give each CONCURRENT run a
#                       UNIQUE path — two runs sharing it race on the report temp.
#   --no-apply          Generate + validate the patch but do NOT apply it.
# ============================================================================

set -euo pipefail

PROMPT_FILE=""
REPORT_OUT=""
WORKSPACE=""
FILES_LIST=""
TIMEOUT_SECONDS="1200"
PHASE_TAG=""
PLAN_TAG=""
DRY_RUN=false
APPLY_PATCH=true

while [[ $# -gt 0 ]]; do
    case "$1" in
        --prompt-file) PROMPT_FILE="$2"; shift 2 ;;
        --report-out) REPORT_OUT="$2"; shift 2 ;;
        --workspace) WORKSPACE="$2"; shift 2 ;;
        --files) FILES_LIST="$2"; shift 2 ;;
        --timeout) TIMEOUT_SECONDS="$2"; shift 2 ;;
        --phase) PHASE_TAG="$2"; shift 2 ;;
        --plan) PLAN_TAG="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --no-apply) APPLY_PATCH=false; shift ;;
        --help|-h) head -55 "$0" | tail -48; exit 0 ;;
        *) echo "codex-patch-executor: unexpected arg '$1'" >&2; exit 1 ;;
    esac
done

if [[ -z "$PROMPT_FILE" || -z "$REPORT_OUT" || -z "$FILES_LIST" ]]; then
    echo "codex-patch-executor: --prompt-file, --report-out, and --files are required" >&2
    echo "  --files = a MANIFEST FILE (one repo-relative path per line) that is ALSO the write allowlist" >&2
    exit 1
fi
if [[ ! -e "$PROMPT_FILE" ]]; then
    echo "codex-patch-executor: prompt file not found: $PROMPT_FILE" >&2
    exit 1
fi
if [[ ! -e "$FILES_LIST" ]]; then
    echo "codex-patch-executor: --files expects a MANIFEST FILE (one repo-relative path per line), not a path — not found: $FILES_LIST" >&2
    echo "  it is ALSO the write allowlist: Codex may only create/modify paths listed in it." >&2
    echo "  to author a NEW file, add its target path to the manifest (pre-create an empty placeholder if the path must exist)." >&2
    echo "  example: printf '%s\\n' src/a.ts src/b.ts > files.txt   then   --files files.txt" >&2
    exit 1
fi
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    echo "codex-patch-executor: ERR - OAuth-only; unset OPENAI_API_KEY before invoking" >&2
    exit 4
fi

if [[ -z "$WORKSPACE" ]]; then WORKSPACE="$(pwd -P)"; fi
if [[ "$WORKSPACE" =~ ^[A-Za-z]:\\ ]] && command -v wslpath >/dev/null 2>&1; then
    WORKSPACE="$(wslpath -u "$WORKSPACE" 2>/dev/null || echo "$WORKSPACE")"
fi
if [[ ! -d "$WORKSPACE" ]]; then
    echo "codex-patch-executor: workspace dir not found: $WORKSPACE" >&2
    exit 1
fi

PROJECT="$WORKSPACE"
d="$WORKSPACE"
while [[ "$d" != "/" && "$d" != "" ]]; do
    if [[ -d "$d/.planning" ]]; then PROJECT="$d"; break; fi
    d="$(dirname "$d")"
done

CODEX_MODEL="gpt-5.6-sol"
CODEX_REASONING_EFFORT="xhigh"
CODEX_CD="$WORKSPACE"
CODEX_LAUNCHER="direct"
if [[ -r /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null && command -v cmd.exe >/dev/null 2>&1; then
    CODEX_LAUNCHER="cmd"
    if command -v wslpath >/dev/null 2>&1; then
        CODEX_CD="$(wslpath -w "$WORKSPACE" 2>/dev/null || echo "$WORKSPACE")"
    fi
fi

if [[ "$CODEX_LAUNCHER" == "direct" ]] && ! command -v codex >/dev/null 2>&1; then
    echo "codex-patch-executor: 'codex' CLI not on \$PATH" >&2
    exit 3
fi

TMP_BASE="$PROJECT/.planning/tmp"
mkdir -p "$TMP_BASE"
READPACK_TMP="$(mktemp "$TMP_BASE/sgsd-codex-readpack.XXXXXX")"
PROMPT_TMP="$(mktemp "$TMP_BASE/sgsd-codex-patch-prompt.XXXXXX")"
STDOUT_TMP="$(mktemp "$TMP_BASE/sgsd-codex-patch-stdout.XXXXXX")"
STDERR_TMP="$(mktemp "$TMP_BASE/sgsd-codex-patch-stderr.XXXXXX")"
PATCH_TMP="$(mktemp "$TMP_BASE/sgsd-codex-patch.XXXXXX")"
trap 'rm -f "$READPACK_TMP" "$PROMPT_TMP" "$STDOUT_TMP" "$STDERR_TMP" "$PATCH_TMP" "${REPORT_OUT}.$$.tmp" 2>/dev/null || true' EXIT

MAX_BYTES="${SGSD_CODEX_PATCH_READPACK_MAX_BYTES:-240000}"
TOTAL_BYTES=0
ALLOWED_TMP="$(mktemp "$TMP_BASE/sgsd-codex-allowed.XXXXXX")"
trap 'rm -f "$READPACK_TMP" "$PROMPT_TMP" "$STDOUT_TMP" "$STDERR_TMP" "$PATCH_TMP" "$ALLOWED_TMP" "${REPORT_OUT}.$$.tmp" 2>/dev/null || true' EXIT

is_safe_relpath() {
    local p="$1"
    [[ -n "$p" ]] || return 1
    [[ "$p" != /* ]] || return 1
    [[ ! "$p" =~ ^[A-Za-z]: ]] || return 1
    [[ "$p" != *".."* ]] || return 1
    [[ "$p" != .git/* && "$p" != */.git/* ]] || return 1
    return 0
}

{
    echo "# SGSD Codex read-pack"
    echo
    echo "Codex must use only the file contents below. Do not read files from the host."
    echo
} > "$READPACK_TMP"

while IFS= read -r raw || [[ -n "$raw" ]]; do
    rel="$(printf '%s' "$raw" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [[ -z "$rel" || "$rel" == \#* ]] && continue
    if ! is_safe_relpath "$rel"; then
        echo "codex-patch-executor: unsafe path in --files list: $rel" >&2
        exit 7
    fi
    printf '%s\n' "$rel" >> "$ALLOWED_TMP"
    abs="$WORKSPACE/$rel"
    {
        echo
        echo "===== FILE: $rel ====="
    } >> "$READPACK_TMP"
    if [[ -f "$abs" ]]; then
        size=$(wc -c < "$abs" | tr -d ' ')
        TOTAL_BYTES=$((TOTAL_BYTES + size))
        if [[ "$TOTAL_BYTES" -gt "$MAX_BYTES" ]]; then
            echo "codex-patch-executor: read-pack exceeds ${MAX_BYTES} bytes" >&2
            exit 7
        fi
        cat "$abs" >> "$READPACK_TMP"
    else
        echo "[[MISSING_OR_NEW_FILE]]" >> "$READPACK_TMP"
    fi
    echo "===== END FILE: $rel =====" >> "$READPACK_TMP"
done < "$FILES_LIST"

if [[ ! -s "$ALLOWED_TMP" ]]; then
    echo "codex-patch-executor: --files list had no usable paths" >&2
    exit 7
fi

{
    echo "# SGSD Codex patch executor"
    echo
    echo "You are Codex GPT-5.5/xhigh acting as the code executor."
    echo "The host cannot support Codex file reads, so SGSD supplied a bounded read-pack."
    echo
    echo "Rules:"
    echo "- Do not call tools. Do not read files. Do not ask the operator questions."
    echo "- Author the code change as a unified git diff that applies with git apply."
    echo "- Touch only paths listed in ALLOWED FILES."
    echo "- If no safe patch is possible, return an empty PATCH block and explain why in REPORT."
    echo
    echo "ALLOWED FILES:"
    sed 's/^/- /' "$ALLOWED_TMP"
    echo
    echo "Return exactly this envelope:"
    echo "PATCH_BEGIN"
    echo "diff --git a/path b/path"
    echo "..."
    echo "PATCH_END"
    echo "REPORT_BEGIN"
    echo "FILES_CHANGED:"
    echo "VERIFICATION:"
    echo "DEVIATIONS:"
    echo "BLOCKERS:"
    echo "ONE_LINER:"
    echo "REPORT_END"
    echo
    echo "## Original executor prompt"
    cat "$PROMPT_FILE"
    echo
    echo "## Read-pack"
    cat "$READPACK_TMP"
} > "$PROMPT_TMP"

RESOLVED="timeout ${TIMEOUT_SECONDS}s codex exec --sandbox read-only --model ${CODEX_MODEL} -c model_reasoning_effort=${CODEX_REASONING_EFFORT} --skip-git-repo-check --cd ${CODEX_CD} -"

if [[ "$DRY_RUN" == true ]]; then
    echo "codex-patch-executor DRY RUN"
    echo "  resolved: $RESOLVED"
    echo "  model:    $CODEX_MODEL"
    echo "  effort:   $CODEX_REASONING_EFFORT"
    echo "  timeout:  ${TIMEOUT_SECONDS}s"
    echo "  workspace: $WORKSPACE  (codex --cd: $CODEX_CD)"
    echo "  files:    $FILES_LIST"
    echo "  report:   $REPORT_OUT"
    exit 0
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_MS="$(date +%s%3N 2>/dev/null || echo 0)"
LIVE_OUT="$PROJECT/.planning/metrics/codex-executor-live.txt"
WATCH_OUT="$PROJECT/.planning/metrics/codex-live-output.txt"
mkdir -p "$(dirname "$LIVE_OUT")"
{
    echo "============================================================"
    echo "codex-patch-executor START  ts=$TS  phase=${PHASE_TAG:-?}  plan=${PLAN_TAG:-?}"
    echo "model=$CODEX_MODEL  effort=$CODEX_REASONING_EFFORT  timeout=${TIMEOUT_SECONDS}s"
    echo "workspace=$CODEX_CD  prompt=$PROMPT_FILE  report=$REPORT_OUT"
    echo "============================================================"
} > "$LIVE_OUT"
cat "$LIVE_OUT" >> "$WATCH_OUT"

set +e
if [[ "$CODEX_LAUNCHER" == "cmd" ]]; then
    timeout "${TIMEOUT_SECONDS}s" bash -c 'cat "$0" | cmd.exe /c codex exec --sandbox read-only --model "$1" -c "model_reasoning_effort=\"$2\"" --skip-git-repo-check --cd "$3" -' \
        "$PROMPT_TMP" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" "$CODEX_CD" \
        2> >(tee -a "$LIVE_OUT" -a "$WATCH_OUT" > "$STDERR_TMP") \
        | tee -a "$LIVE_OUT" -a "$WATCH_OUT" \
        > "$STDOUT_TMP"
    RC=${PIPESTATUS[0]}
else
    timeout "${TIMEOUT_SECONDS}s" bash -c 'cat "$0" | codex exec --sandbox read-only --model "$1" -c "model_reasoning_effort=\"$2\"" --skip-git-repo-check --cd "$3" -' \
        "$PROMPT_TMP" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" "$CODEX_CD" \
        2> >(tee -a "$LIVE_OUT" -a "$WATCH_OUT" > "$STDERR_TMP") \
        | tee -a "$LIVE_OUT" -a "$WATCH_OUT" \
        > "$STDOUT_TMP"
    RC=${PIPESTATUS[0]}
fi
set -e

END_MS="$(date +%s%3N 2>/dev/null || echo 0)"
DURATION_MS=$([[ "$START_MS" -gt 0 && "$END_MS" -ge "$START_MS" ]] && echo $((END_MS - START_MS)) || echo 0)
{
    echo ""
    echo "============================================================"
    echo "codex-patch-executor END    exit=$RC  duration=$((DURATION_MS / 1000))s"
    echo "============================================================"
} >> "$LIVE_OUT"
tail -4 "$LIVE_OUT" >> "$WATCH_OUT"

mkdir -p "$(dirname "$REPORT_OUT")"
cp "$STDOUT_TMP" "${REPORT_OUT}.$$.tmp"
mv "${REPORT_OUT}.$$.tmp" "$REPORT_OUT"

LOG="$PROJECT/.planning/metrics/codex-executor-log.jsonl"
mkdir -p "$(dirname "$LOG")"
phase_field="${PHASE_TAG:-null}"
plan_field=$([[ -z "$PLAN_TAG" ]] && echo "null" || echo "\"$PLAN_TAG\"")
stderr_preview="$(head -c 200 "$STDERR_TMP" 2>/dev/null | tr -d '\r' | tr '\n' ' ' | sed 's/"/\\"/g')"
timeout_hit="false"
[[ $RC -eq 124 ]] && timeout_hit="true"

printf '{"ts":"%s","phase":%s,"plan":%s,"role":"executor","mode":"patch-readpack","model":"%s","reasoning_effort":"%s","exit":%d,"duration_ms":%d,"prompt_bytes":%d,"report_bytes":%d,"timeout_hit":%s,"stderr_preview":"%s"}\n' \
    "$TS" "$phase_field" "$plan_field" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" \
    "$RC" "$DURATION_MS" "$(wc -c < "$PROMPT_TMP" | tr -d ' ')" "$(wc -c < "$REPORT_OUT" | tr -d ' ')" \
    "$timeout_hit" "$stderr_preview" >> "$LOG"

if [[ $RC -eq 124 ]]; then
    echo "codex-patch-executor: timeout after ${TIMEOUT_SECONDS}s" >&2
    exit 5
fi
if [[ $RC -ne 0 ]]; then
    # Quota / rate-limit is NOT an auth failure — check it first, distinct exit.
    # (Quota exhaustion needs wait-and-retry, not credential recovery.)
    if grep -qiE '(usage limit|quota|rate.?limit|429|too many requests)' "$STDERR_TMP" 2>/dev/null; then
        echo "codex-patch-executor: quota-exhausted (rate/usage limit — retry later, NOT an auth failure)" >&2
        exit 6
    fi
    # Real auth signals only. Bare 'auth' is deliberately excluded — it
    # false-matches author/authority/authored in ordinary Codex output.
    if grep -qiE '(401|unauthori[sz]ed|invalid[[:space:]_-]*(api[[:space:]_-]*key|token|credential)|authentication[[:space:]]+failed|not[[:space:]]+authenticated|OPENAI_API_KEY)' "$STDERR_TMP" 2>/dev/null; then
        echo "codex-patch-executor: auth-denied" >&2
        exit 4
    fi
    echo "codex-patch-executor: codex exit=$RC" >&2
    head -c 200 "$STDERR_TMP" >&2; echo >&2
    exit 1
fi

awk '/^PATCH_BEGIN[[:space:]]*$/{flag=1;next}/^PATCH_END[[:space:]]*$/{flag=0}flag' "$STDOUT_TMP" > "$PATCH_TMP"
if [[ ! -s "$PATCH_TMP" ]]; then
    echo "codex-patch-executor: empty or missing PATCH_BEGIN/PATCH_END block" >&2
    exit 6
fi

while IFS= read -r touched || [[ -n "$touched" ]]; do
    [[ -z "$touched" || "$touched" == "/dev/null" ]] && continue
    if ! grep -Fxq "$touched" "$ALLOWED_TMP"; then
        echo "codex-patch-executor: patch touched non-allowlisted path: $touched" >&2
        exit 6
    fi
done < <(
    awk '
      /^diff --git / {
        if ($3 ~ /^a\//) { print substr($3, 3) }
        if ($4 ~ /^b\//) { print substr($4, 3) }
      }
      /^--- / {
        if ($2 ~ /^a\//) { print substr($2, 3) }
        else if ($2 == "/dev/null") { print "/dev/null" }
      }
      /^\+\+\+ / {
        if ($2 ~ /^b\//) { print substr($2, 3) }
        else if ($2 == "/dev/null") { print "/dev/null" }
      }
    ' "$PATCH_TMP" | sort -u
)

if [[ "$APPLY_PATCH" == true ]]; then
    GIT_WORKSPACE="$WORKSPACE"
    GIT_PATCH_TMP="$PATCH_TMP"
    if git --version 2>/dev/null | grep -qi 'windows' && command -v wslpath >/dev/null 2>&1; then
        GIT_WORKSPACE="$(wslpath -w "$WORKSPACE" 2>/dev/null || echo "$WORKSPACE")"
        GIT_PATCH_TMP="$(wslpath -w "$PATCH_TMP" 2>/dev/null || echo "$PATCH_TMP")"
    fi
    if ! git -C "$GIT_WORKSPACE" apply --recount --check "$GIT_PATCH_TMP"; then
        echo "codex-patch-executor: git apply --recount --check failed" >&2
        exit 6
    fi
    if ! git -C "$GIT_WORKSPACE" apply --recount "$GIT_PATCH_TMP"; then
        echo "codex-patch-executor: git apply --recount failed" >&2
        exit 6
    fi
    # Success must mean work landed: a non-empty patch that applied cleanly should
    # leave the working tree dirty. If it is pristine, the apply was a no-op —
    # do not report success. (Belt-and-suspenders over git apply's own semantics.)
    if [[ -z "$(git -C "$GIT_WORKSPACE" status --porcelain 2>/dev/null)" ]]; then
        echo "codex-patch-executor: ERR - patch applied but working tree shows no changes (no-op); refusing to signal success" >&2
        exit 6
    fi
    {
        echo
        echo "SGSD_PATCH_APPLY: success"
        echo "SGSD_PATCH_MODE: read-pack"
    } >> "$REPORT_OUT"
else
    echo "SGSD_PATCH_APPLY: skipped --no-apply" >> "$REPORT_OUT"
fi

# Success must mean work happened. Never signal OK on an empty report — guards
# the concurrent-run race (two runs sharing --report-out clobbering each other's
# temp/target) and any path where codex produced no usable stdout.
if [[ ! -s "$REPORT_OUT" ]]; then
    echo "codex-patch-executor: ERR - report is empty; refusing to signal success (give each concurrent run a unique --report-out)" >&2
    exit 6
fi

PATCH_FILES="$(awk '/^diff --git /{n++} END{print n+0}' "$PATCH_TMP")"
if [[ "$APPLY_PATCH" == true ]]; then
    echo "codex-patch-executor: OK - patch applied via read-pack mode (${PATCH_FILES} file(s))"
else
    echo "codex-patch-executor: OK - patch generated, NOT applied (--no-apply; ${PATCH_FILES} file(s))"
fi
exit 0
