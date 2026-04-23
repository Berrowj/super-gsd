#!/usr/bin/env bash
# ============================================================================
# codex-exec — bash wrapper around `codex exec` for Phase 14 provider substrate
# ============================================================================
# One shell primitive for the Codex-CLI review path: takes a prompt file,
# pipes it on stdin to `codex exec`, wraps with GNU `timeout`, parses the
# 5-field `code-reviewer-v1` report contract, writes the parsed report
# atomically, and appends one provenance row to .planning/metrics/codex-log.jsonl.
#
# OAuth-only (D-02/D-02a): if $OPENAI_API_KEY is set the wrapper refuses to
# run (exit 4). It does NOT unset-then-run; that would silently degrade the
# operator's expectation that API-key auth works. OAuth token is resolved by
# the `codex` binary from its own config (~/.codex/config.json or $CODEX_HOME).
#
# Invocation shape (P4 deviation from D-01): codex exec has NO --prompt-file
# flag per RESEARCH §1a. Prompt is piped on stdin with the `-` sentinel:
#   cat "$PROMPT_FILE" | codex exec --sandbox read-only --ephemeral \
#     --skip-git-repo-check --cd "$PROJECT" -
# The wrapper keeps its OWN --prompt-file flag as the external contract; only
# the internal transport to `codex exec` changes.
#
# Usage:
#   codex-exec.sh --prompt-file <p> --report-out <p> [--timeout N] [--dry-run]
#                 [--project <p>] [--phase N] [--plan NN-PP] [--step LABEL]
#
# Exit codes (D-01a):
#   0 — success, report parsed + written + JSONL row appended
#   1 — generic codex failure (non-zero RC, non-auth, non-timeout)
#   3 — `codex` binary not on $PATH
#   4 — auth-denied: $OPENAI_API_KEY set OR codex stderr matched /auth|401|unauthori[sz]ed/i
#   5 — timeout (GNU timeout returned 124)
#   6 — report contract violation (one or more of the 5 required fields missing)
#
# See super-gsd/scripts/codex-exec.README.md for the full reference.
# ============================================================================

set -u

# ── Defaults ────────────────────────────────────────────────────────────────
PROMPT_FILE=""
REPORT_OUT=""
TIMEOUT_SECONDS=""
DRY_RUN=false
PROJECT=""
PHASE_TAG=""
PLAN_TAG=""
STEP_TAG=""

# ── Arg parse (pattern: sgsd-curate.sh:42-57) ───────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --prompt-file) PROMPT_FILE="$2"; shift 2 ;;
        --report-out)  REPORT_OUT="$2";  shift 2 ;;
        --timeout)     TIMEOUT_SECONDS="$2"; shift 2 ;;
        --dry-run)     DRY_RUN=true; shift ;;
        --project)     PROJECT="$2"; shift 2 ;;
        --phase)       PHASE_TAG="$2"; shift 2 ;;
        --plan)        PLAN_TAG="$2"; shift 2 ;;
        --step)        STEP_TAG="$2"; shift 2 ;;
        --help|-h)     head -40 "$0" | tail -35; exit 0 ;;
        -*)            echo "codex-exec: unknown flag $1" >&2; exit 1 ;;
        *)             echo "codex-exec: unexpected positional arg '$1'" >&2; exit 1 ;;
    esac
done

# ── Required flags ──────────────────────────────────────────────────────────
if [[ -z "$PROMPT_FILE" || -z "$REPORT_OUT" ]]; then
    echo "codex-exec: --prompt-file and --report-out are required" >&2
    echo "Usage: codex-exec.sh --prompt-file <p> --report-out <p> [--timeout N] [--dry-run] [--project <p>] [--phase N] [--plan NN-PP] [--step LABEL]" >&2
    exit 1
fi

# ── OAuth hygiene gate (D-02a) — refuse-to-run, do NOT unset-then-run ───────
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    echo "codex-exec: ERR — codex-exec is OAuth-only per D-02/D-02a; unset OPENAI_API_KEY before invoking." >&2
    exit 4
fi

# ── Root detection (pattern: sgsd-curate.sh:101-126) ────────────────────────
detect_root() {
    local d
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" ]]; then echo "$d"; return 0; fi
        d="$(dirname "$d")"
    done
    return 1
}

ROOT="$(detect_root || true)"

if [[ -z "$PROJECT" ]]; then
    if [[ -n "$ROOT" ]]; then
        PROJECT="$ROOT"
    else
        echo "codex-exec: --project not given and no .planning/ found by walk-up from $(pwd)" >&2
        exit 1
    fi
fi

# ── Path translation (D-04a) — Windows → WSL POSIX, idempotent on POSIX ─────
# If PROJECT looks like a Windows path (^C:\) or an /mnt/c/ path, run wslpath -u.
# On POSIX inputs that don't match either pattern, leave it alone.
if [[ "$PROJECT" =~ ^[A-Za-z]:\\ ]] || [[ "$PROJECT" =~ ^/mnt/[a-z]/ ]]; then
    if command -v wslpath >/dev/null 2>&1; then
        PROJECT_TRANSLATED="$(wslpath -u "$PROJECT" 2>/dev/null || echo "$PROJECT")"
        PROJECT="$PROJECT_TRANSLATED"
    fi
fi

# ── Config-driven timeout (D-01b) ───────────────────────────────────────────
# Default 30s fallback. Config path: .planning/config.json → review_providers.codex_timeout_seconds
if [[ -z "$TIMEOUT_SECONDS" ]]; then
    TIMEOUT_SECONDS=30
    if [[ -n "$ROOT" && -f "$ROOT/.planning/config.json" ]] && command -v node >/dev/null 2>&1; then
        cfg_val="$(node -e '
            try {
                const fs = require("fs");
                const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
                const v = j && j.review_providers && j.review_providers.codex_timeout_seconds;
                if (Number.isFinite(v) && v > 0) process.stdout.write(String(Math.floor(v)));
            } catch (e) { /* silent: fall back to 30 */ }
        ' "$ROOT/.planning/config.json" 2>/dev/null || true)"
        if [[ -n "$cfg_val" ]]; then
            TIMEOUT_SECONDS="$cfg_val"
        fi
    fi
fi

# ── Prompt file must exist (except in dry-run against /dev/null) ────────────
if [[ ! -e "$PROMPT_FILE" ]]; then
    echo "codex-exec: --prompt-file '$PROMPT_FILE' not found" >&2
    exit 1
fi

# ── `codex` binary presence (exit 3 if missing) ─────────────────────────────
CODEX_BIN="$(command -v codex 2>/dev/null || true)"
if [[ -z "$CODEX_BIN" && "$DRY_RUN" == false ]]; then
    echo "codex-exec: 'codex' CLI not found on \$PATH — install via 'npm i -g @openai/codex' or see Codex CLI README." >&2
    exit 3
fi

# ── Resolved command line (also used for dry-run display) ───────────────────
RESOLVED_CMD="timeout ${TIMEOUT_SECONDS}s bash -c 'cat \"\$0\" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check --cd \"\$1\" -' \"$PROMPT_FILE\" \"$PROJECT\""

# ── Dry-run short-circuit ───────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
    echo "codex-exec DRY RUN"
    echo "  resolved: $RESOLVED_CMD"
    echo "  auth:     OAuth-only (OPENAI_API_KEY not set) ✓"
    echo "  timeout:  ${TIMEOUT_SECONDS}s"
    echo "  project:  $PROJECT"
    echo "  codex:    ${CODEX_BIN:-<not-on-PATH>}"
    echo "  report-out: $REPORT_OUT"
    exit 0
fi

# ── Real invocation ─────────────────────────────────────────────────────────
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_MS="$(date +%s%3N 2>/dev/null || echo 0)"

STDOUT_TMP="$(mktemp -t codex-stdout.XXXXXX)"
STDERR_TMP="$(mktemp -t codex-stderr.XXXXXX)"
trap 'rm -f "$STDOUT_TMP" "$STDERR_TMP" "${REPORT_OUT}.tmp" 2>/dev/null || true' EXIT

set +e
timeout "${TIMEOUT_SECONDS}s" bash -c 'cat "$0" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -' \
    "$PROMPT_FILE" "$PROJECT" \
    >"$STDOUT_TMP" 2>"$STDERR_TMP"
RC=$?
set -e

END_MS="$(date +%s%3N 2>/dev/null || echo 0)"
if [[ "$START_MS" -gt 0 && "$END_MS" -ge "$START_MS" ]]; then
    DURATION_MS=$((END_MS - START_MS))
else
    DURATION_MS=0
fi

PROMPT_BYTES=0
if [[ -f "$PROMPT_FILE" ]]; then
    PROMPT_BYTES=$(wc -c < "$PROMPT_FILE" | tr -d ' ')
fi

# ── Pre-compute stderr preview (first 200 bytes, JSON-safe) ─────────────────
stderr_preview_raw="$(head -c 200 "$STDERR_TMP" 2>/dev/null || echo '')"
# Escape backslash, double-quote, and control chars for JSON embedding.
stderr_preview_json="$(printf '%s' "$stderr_preview_raw" | awk '
    BEGIN { RS="\0" }
    {
        gsub(/\\/, "\\\\")
        gsub(/"/,  "\\\"")
        gsub(/\t/, "\\t")
        gsub(/\r/, "\\r")
        gsub(/\n/, "\\n")
        printf "%s", $0
    }
')"

# ── JSONL append helper (fires on every exit path except 3/4-env/1-usage) ──
METRICS_LOG="$PROJECT/.planning/metrics/codex-log.jsonl"
append_jsonl() {
    local wrapper_exit="$1" timeout_hit="$2" report_bytes="$3"
    local phase_field plan_field step_field
    if [[ -z "$PHASE_TAG" ]]; then phase_field="null"; else phase_field="$PHASE_TAG"; fi
    if [[ -z "$PLAN_TAG" ]];  then plan_field="null";  else plan_field="\"$PLAN_TAG\""; fi
    if [[ -z "$STEP_TAG" ]];  then step_field="null";  else step_field="\"$STEP_TAG\""; fi
    mkdir -p "$(dirname "$METRICS_LOG")"
    printf '{"ts":"%s","phase":%s,"plan":%s,"step":%s,"exit":%d,"duration_ms":%d,"prompt_bytes":%d,"report_bytes":%d,"timeout_hit":%s,"fallback_triggered":false,"stderr_preview":"%s"}\n' \
        "$TS" "$phase_field" "$plan_field" "$step_field" \
        "$wrapper_exit" "$DURATION_MS" "$PROMPT_BYTES" "$report_bytes" \
        "$timeout_hit" "$stderr_preview_json" \
        >> "$METRICS_LOG"
}

# ── Exit remap (D-01a) ──────────────────────────────────────────────────────
if [[ $RC -eq 124 ]]; then
    append_jsonl 5 "true" 0
    echo "codex-exec: timeout after ${TIMEOUT_SECONDS}s" >&2
    exit 5
fi

if [[ $RC -ne 0 ]]; then
    # Check for auth-denial patterns in stderr first
    if grep -qiE '(auth|401|unauthori[sz]ed)' "$STDERR_TMP" 2>/dev/null; then
        append_jsonl 4 "false" 0
        echo "codex-exec: auth-denied (codex stderr matched auth/401/unauthorized)" >&2
        head -c 200 "$STDERR_TMP" >&2 ; echo >&2
        exit 4
    fi
    append_jsonl 1 "false" 0
    echo "codex-exec: codex exit=$RC (generic failure)" >&2
    head -c 200 "$STDERR_TMP" >&2 ; echo >&2
    exit 1
fi

# ── Report parse (D-03) — extract the 5 fields from stdout ─────────────────
# code-reviewer-v1 contract lines:
#   FINDINGS: ...
#   CRITICAL: ...
#   WARNINGS: ...
#   PASS_RATE: ...
#   ONE_LINER: ...
# Take the LAST occurrence of each (codex may echo prompt). Preserve line text.
parsed="$(awk '
    /^FINDINGS:/  { findings  = $0 }
    /^CRITICAL:/  { critical  = $0 }
    /^WARNINGS:/  { warnings  = $0 }
    /^PASS_RATE:/ { pass_rate = $0 }
    /^ONE_LINER:/ { one_liner = $0 }
    END {
        if (findings == "" || critical == "" || warnings == "" || pass_rate == "" || one_liner == "") {
            # Print a machine marker on stderr so the wrapper can detect missing fields.
            print "CONTRACT_VIOLATION" > "/dev/stderr"
            exit 6
        }
        print findings
        print critical
        print warnings
        print pass_rate
        print one_liner
    }
' "$STDOUT_TMP" 2>/dev/null)"
awk_rc=$?

if [[ $awk_rc -ne 0 || -z "$parsed" ]]; then
    append_jsonl 6 "false" 0
    echo "codex-exec: report contract violation — one or more of FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER missing from codex stdout" >&2
    exit 6
fi

# ── Atomic write (pattern: sgsd-muda-audit.sh:225-229) ──────────────────────
mkdir -p "$(dirname "$REPORT_OUT")"
printf '%s\n' "$parsed" > "$REPORT_OUT.tmp"
mv "$REPORT_OUT.tmp" "$REPORT_OUT"

REPORT_BYTES=$(wc -c < "$REPORT_OUT" | tr -d ' ')

# ── JSONL append on success ─────────────────────────────────────────────────
append_jsonl 0 "false" "$REPORT_BYTES"

echo "codex-exec: OK — $REPORT_OUT written (${REPORT_BYTES}B), codex took ${DURATION_MS}ms"
exit 0
