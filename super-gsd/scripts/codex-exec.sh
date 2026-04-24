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
TIMEOUT_TIER=""
DRY_RUN=false
SELF_TEST=false
SKIP_NETWORK=false
PROJECT=""
PHASE_TAG=""
PLAN_TAG=""
STEP_TAG=""
RETRY_ON_TIMEOUT_ESCALATE=false
SELF_TEST_EXIT_PRIORITY=false

json_escape() {
    printf '%s' "${1:-}" | awk '
        BEGIN { RS="\0" }
        {
            gsub(/\\/, "\\\\")
            gsub(/"/,  "\\\"")
            gsub(/\t/, "\\t")
            gsub(/\r/, "\\r")
            gsub(/\n/, "\\n")
            printf "%s", $0
        }
    '
}

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
        --step)         STEP_TAG="$2"; shift 2 ;;
        --timeout-tier) TIMEOUT_TIER="$2"; shift 2 ;;
        --self-test)    SELF_TEST=true;    shift ;;
        --skip-network) SKIP_NETWORK=true; shift ;;
        --retry-on-timeout-escalate)    RETRY_ON_TIMEOUT_ESCALATE=true;  shift ;;
        --no-retry-on-timeout-escalate) RETRY_ON_TIMEOUT_ESCALATE=false; shift ;;
        --self-test-exit-priority)      SELF_TEST_EXIT_PRIORITY=true;    shift ;;
        --help|-h)      head -40 "$0" | tail -35; exit 0 ;;
        -*)             echo "codex-exec: unknown flag $1" >&2; exit 1 ;;
        *)             echo "codex-exec: unexpected positional arg '$1'" >&2; exit 1 ;;
    esac
done

# ── W-4 fix: validate --phase is numeric before interpolating into JSONL ────
if [[ -n "$PHASE_TAG" && ! "$PHASE_TAG" =~ ^[0-9]+$ ]]; then
  echo "ERR: --phase must be numeric, got: $PHASE_TAG" >&2
  exit 1
fi

# ── Required flags ──────────────────────────────────────────────────────────
if [[ "$SELF_TEST" == false ]] && [[ -z "$PROMPT_FILE" || -z "$REPORT_OUT" ]]; then
    echo "codex-exec: --prompt-file and --report-out are required" >&2
    echo "Usage: codex-exec.sh --prompt-file <p> --report-out <p> [--timeout N] [--dry-run] [--project <p>] [--phase N] [--plan NN-PP] [--step LABEL]" >&2
    exit 1
fi

# ── OAuth hygiene gate (D-02a) — refuse-to-run, do NOT unset-then-run ───────
if [[ "$SELF_TEST" == false ]] && [[ -n "${OPENAI_API_KEY:-}" ]]; then
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

# ── D-03 timeout-tier resolver ───────────────────────────────────────────────
# Precedence: --timeout-tier custom:N > --timeout-tier named > step-name map > codex_timeout_seconds fallback
# Tier values are config-backed (review_providers.codex_timeout_tiers.{default,review,analysis})
# with hardcoded fallbacks that match the D-03 spec if config keys are absent.
TIER_DEFAULT=60
TIER_REVIEW=120
TIER_ANALYSIS=180
if [[ -n "$ROOT" && -f "$ROOT/.planning/config.json" ]] && command -v node >/dev/null 2>&1; then
    cfg_tiers="$(node -e '
        try {
            const fs = require("fs");
            const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
            const t = j && j.review_providers && j.review_providers.codex_timeout_tiers;
            if (t) {
                if (Number.isFinite(t.default)  && t.default  > 0) process.stdout.write("TIER_DEFAULT="  + Math.floor(t.default)  + "\n");
                if (Number.isFinite(t.review)   && t.review   > 0) process.stdout.write("TIER_REVIEW="   + Math.floor(t.review)   + "\n");
                if (Number.isFinite(t.analysis) && t.analysis > 0) process.stdout.write("TIER_ANALYSIS=" + Math.floor(t.analysis) + "\n");
            }
        } catch (e) { /* silent: keep hardcoded defaults */ }
    ' "$ROOT/.planning/config.json" 2>/dev/null || true)"
    # Parse KEY=VALUE lines with numeric-only sanitisation — no eval on config input
    while IFS='=' read -r key val; do
        val="${val%%[^0-9]*}"  # keep only leading digits
        case "$key" in
            TIER_DEFAULT)  [[ -n "$val" ]] && TIER_DEFAULT="$val"  ;;
            TIER_REVIEW)   [[ -n "$val" ]] && TIER_REVIEW="$val"   ;;
            TIER_ANALYSIS) [[ -n "$val" ]] && TIER_ANALYSIS="$val" ;;
        esac
    done <<< "$cfg_tiers"
fi

resolve_timeout_tier() {
    local tier="$1"
    case "$tier" in
        default)  echo "$TIER_DEFAULT"  ;;
        review)   echo "$TIER_REVIEW"   ;;
        analysis) echo "$TIER_ANALYSIS" ;;
        custom:*) echo "${tier#custom:}" ;;
        *)        echo ""  ;;
    esac
}

resolve_step_timeout() {
    local step="$1"
    case "$step" in
        smoke|self-test)
            echo "$TIER_DEFAULT" ;;
        per-dispatch-ATC|adversarial)
            echo "$TIER_REVIEW" ;;
        phase-level-ATC)
            # D-05 #3: phase-level-ATC uses analysis tier (90s), not review (120s)
            echo "$TIER_ANALYSIS" ;;
        muda-qualitative|qualitative-*)
            echo "$TIER_ANALYSIS" ;;
        *)
            echo "" ;;
    esac
}

# ── D-05 #6: --self-test-exit-priority — print probe order table, exit 0 ────
if [[ "$SELF_TEST_EXIT_PRIORITY" == true ]]; then
    echo "codex-exec: self-test exit priority table"
    echo "  Probe 1: PATH check         (exit 10 on failure -- highest priority)"
    echo "  Probe 2: auth check         (exit 11 on failure)"
    echo "  Probe 3: timeout-math check (exit 12 on failure)"
    echo "  Probe 4: contract check     (exit 13 on failure -- lowest priority)"
    echo "  Note: PATH failure takes precedence over auth failure when both conditions hold."
    exit 0
fi

# ── Self-test harness (CXOPS-01 / D-02) ─────────────────────────────────────
# Placed here so detect_root, TIER_REVIEW, and resolve_timeout_tier are all
# defined before the harness executes. Probes: 1=PATH(10) 2=auth(11)
# 3=timeout-math(12) 4=contract(13 or skipped when --skip-network).
if [[ "$SELF_TEST" == true ]]; then
    ST_PATH=false
    ST_AUTH=false
    ST_TIMEOUT=false
    ST_CONTRACT=false
    EXIT_CODE=0

    # Probe 1 — codex on PATH (exit 10)
    if command -v codex >/dev/null 2>&1; then
        ST_PATH=true
    else
        EXIT_CODE=10
    fi

    # Probe 2 — auth: no OPENAI_API_KEY set (exit 11); OAuth config file
    # checked only in network-on mode (config file is only needed for real calls).
    if [[ "$EXIT_CODE" -eq 0 ]]; then
        if [[ -n "${OPENAI_API_KEY:-}" ]]; then
            # OPENAI_API_KEY set — would trigger exit 4 in normal mode;
            # surfaced as exit 11 (auth probe failure) in self-test mode.
            EXIT_CODE=11
        elif [[ "$SKIP_NETWORK" == true ]]; then
            # Offline mode: key-absence check is sufficient; config file not needed.
            ST_AUTH=true
        else
            CODEX_CFG="${CODEX_HOME:-$HOME/.codex}/config.json"
            if [[ -f "$CODEX_CFG" ]]; then
                ST_AUTH=true
            else
                EXIT_CODE=11
            fi
        fi
    fi

    # Probe 3 — timeout math: resolve_timeout_tier review must return >0 (exit 12)
    # Calls resolve_timeout_tier with canonical tier name (NOT step number label)
    # to avoid step-label mismatch (RESEARCH gap #3).
    tier_check="$(resolve_timeout_tier review)"
    if [[ -n "$tier_check" && "$tier_check" -gt 0 ]] 2>/dev/null; then
        ST_TIMEOUT=true
    else
        EXIT_CODE=12
    fi

    # Probe 4 — known-good contract: real Codex call; skipped when --skip-network (exit 13)
    if [[ "$SKIP_NETWORK" == true ]]; then
        ST_CONTRACT=true  # treated as pass in offline/CI mode
    elif [[ "$EXIT_CODE" -eq 0 ]]; then
        ST_PROMPT_TMP="$(mktemp -t codex-self-test.XXXXXX)"
        ST_REPORT_TMP="$(mktemp -t codex-self-test-report.XXXXXX)"
        printf 'Output exactly five lines:\nFINDINGS: 0\nCRITICAL: 0\nWARNINGS: 0\nPASS_RATE: 0/0\nONE_LINER: self-test\n' > "$ST_PROMPT_TMP"
        set +e
        timeout 60s bash -c 'cat "$0" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -' \
            "$ST_PROMPT_TMP" "${PROJECT:-$(pwd)}" > "$ST_REPORT_TMP" 2>/dev/null
        ST_RC=$?
        set -e
        if [[ $ST_RC -eq 0 ]] && \
           grep -q "^FINDINGS:"  "$ST_REPORT_TMP" && \
           grep -q "^CRITICAL:"  "$ST_REPORT_TMP" && \
           grep -q "^WARNINGS:"  "$ST_REPORT_TMP" && \
           grep -q "^PASS_RATE:" "$ST_REPORT_TMP" && \
           grep -q "^ONE_LINER:" "$ST_REPORT_TMP"; then
            ST_CONTRACT=true
        else
            EXIT_CODE=13
        fi
        rm -f "$ST_PROMPT_TMP" "$ST_REPORT_TMP"
    fi

    # Structured stdout
    echo "=== codex-exec --self-test ==="
    printf "Probe 1 PATH:     %s\n" "$([ "$ST_PATH"     = true ] && echo PASS || echo FAIL)"
    printf "Probe 2 auth:     %s\n" "$([ "$ST_AUTH"     = true ] && echo PASS || echo FAIL)"
    printf "Probe 3 timeout:  %s (tier_review=%s)\n" "$([ "$ST_TIMEOUT"  = true ] && echo PASS || echo FAIL)" "${TIER_REVIEW}"
    printf "Probe 4 contract: %s%s\n" \
        "$([ "$ST_CONTRACT" = true ] && echo PASS || echo FAIL)" \
        "$([ "$SKIP_NETWORK" = true ] && echo ' (skipped)' || echo '')"
    echo "Exit: $EXIT_CODE"

    # Append JSONL row to codex-log.jsonl (D-05)
    if [[ -n "$ROOT" ]]; then
        ST_LOG="$ROOT/.planning/metrics/codex-log.jsonl"
        ST_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        mkdir -p "$(dirname "$ST_LOG")"
        printf '{"ts":"%s","step":"self-test","exit":%d,"skip_network":%s,"self_test_probes":{"path":%s,"auth":%s,"timeout":%s,"contract":%s}}\n' \
            "$ST_TS" "$EXIT_CODE" \
            "$([ "$SKIP_NETWORK" = true ] && echo true || echo false)" \
            "$([ "$ST_PATH"     = true ] && echo true || echo false)" \
            "$([ "$ST_AUTH"     = true ] && echo true || echo false)" \
            "$([ "$ST_TIMEOUT"  = true ] && echo true || echo false)" \
            "$([ "$ST_CONTRACT" = true ] && echo true || echo false)" \
            >> "$ST_LOG"
    fi
    exit $EXIT_CODE
fi

TIMEOUT="$TIMEOUT_SECONDS"

if [[ -n "$TIMEOUT_TIER" ]]; then
    tier_val="$(resolve_timeout_tier "$TIMEOUT_TIER")"
    if [[ -n "$tier_val" ]]; then
        TIMEOUT="$tier_val"
    else
        echo "codex-exec: unknown --timeout-tier '$TIMEOUT_TIER'; valid: default|review|analysis|custom:N" >&2
        exit 1
    fi
elif [[ -n "$STEP_TAG" ]]; then
    step_val="$(resolve_step_timeout "$STEP_TAG")"
    if [[ -n "$step_val" ]]; then
        TIMEOUT="$step_val"
    else
        echo "step '$STEP_TAG' has no tier mapping, using default" >&2
        TIMEOUT="${TIMEOUT_SECONDS:-60}"
    fi
fi

# ── Prompt file must exist (except in dry-run against /dev/null) ────────────
if [[ ! -e "$PROMPT_FILE" ]]; then
    echo "codex-exec: --prompt-file '$PROMPT_FILE' not found" >&2
    exit 1
fi

PROMPT_BYTES=0
if [[ -f "$PROMPT_FILE" ]]; then
    PROMPT_BYTES=$(wc -c < "$PROMPT_FILE" | tr -d ' ')
fi

# ── `codex` binary presence (exit 3 if missing) ─────────────────────────────
CODEX_BIN="$(command -v codex 2>/dev/null || true)"
if [[ -z "$CODEX_BIN" && "$DRY_RUN" == false ]]; then
    echo "codex-exec: 'codex' CLI not found on \$PATH — install via 'npm i -g @openai/codex' or see Codex CLI README." >&2
    exit 3
fi

# ── Resolved command line (also used for dry-run display) ───────────────────
RESOLVED_CMD="timeout ${TIMEOUT}s bash -c 'cat \"\$0\" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check --cd \"\$1\" -' \"$PROMPT_FILE\" \"$PROJECT\""

# ── Dry-run short-circuit ───────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
    echo "codex-exec DRY RUN"
    echo "  resolved: $RESOLVED_CMD"
    echo "  auth:     OAuth-only (OPENAI_API_KEY not set) ✓"
    echo "  timeout:  ${TIMEOUT}s"
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
timeout "${TIMEOUT}s" bash -c 'cat "$0" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -' \
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
stderr_preview_json="$(json_escape "$stderr_preview_raw")"

# ── JSONL append helper (fires on every exit path except 3/4-env/1-usage) ──
METRICS_LOG="$PROJECT/.planning/metrics/codex-log.jsonl"
LIVE_FILE="$PROJECT/.planning/metrics/codex-live.json"
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

# ── MC-03: narrative.md event writer ────────────────────────────────────────
NARRATIVE_FILE="$PROJECT/.planning/metrics/narrative.md"

append_narrative_event() {
    local event_type="$1"   # codex_started | codex_completed | codex_timeout | codex_fallback
    local detail="$2"       # short description string (no newlines)
    local update_field="$3" # "latest" | "lastfail" | "" (no field update)

    # Initialize narrative.md if missing
    if [[ ! -f "$NARRATIVE_FILE" ]]; then
        mkdir -p "$(dirname "$NARRATIVE_FILE")"
        printf '# Narrative\n\nlatest: \nlastfail: \n\n## Events\n' > "$NARRATIVE_FILE"
    fi

    # Append event entry to ## Events section
    local entry="- [$TS] $event_type: $detail"
    printf '%s\n' "$entry" >> "$NARRATIVE_FILE"

    # Update latest or lastfail field (sed in-place)
    if [[ "$update_field" == "latest" ]]; then
        sed -i "s|^latest:.*|latest: $detail|" "$NARRATIVE_FILE"
    elif [[ "$update_field" == "lastfail" ]]; then
        sed -i "s|^lastfail:.*|lastfail: $detail|" "$NARRATIVE_FILE"
    fi
}

write_live_state() {
    local live_state="$1" wrapper_exit="$2" timeout_hit="$3" report_bytes="$4"
    local prompt_json report_json project_json command_json stderr_json phase_json plan_json step_json
    prompt_json="$(json_escape "$PROMPT_FILE")"
    report_json="$(json_escape "$REPORT_OUT")"
    project_json="$(json_escape "$PROJECT")"
    command_json="$(json_escape "$RESOLVED_CMD")"
    stderr_json="$(json_escape "$stderr_preview_raw")"
    phase_json="$(json_escape "$PHASE_TAG")"
    plan_json="$(json_escape "$PLAN_TAG")"
    step_json="$(json_escape "$STEP_TAG")"
    mkdir -p "$(dirname "$LIVE_FILE")"
    {
        printf '{\n'
        printf '  "provider": "codex-cli-reviewer",\n'
        printf '  "invocation": "shell",\n'
        printf '  "toolbox": "bash -> codex exec",\n'
        printf '  "state": "%s",\n' "$live_state"
        printf '  "phase": "%s",\n' "$phase_json"
        printf '  "plan": "%s",\n' "$plan_json"
        printf '  "step": "%s",\n' "$step_json"
        printf '  "project": "%s",\n' "$project_json"
        printf '  "prompt_file": "%s",\n' "$prompt_json"
        printf '  "report_out": "%s",\n' "$report_json"
        printf '  "timeout_seconds": %s,\n' "$TIMEOUT"
        printf '  "prompt_bytes": %s,\n' "$PROMPT_BYTES"
        printf '  "report_bytes": %s,\n' "$report_bytes"
        printf '  "command_preview": "%s",\n' "$command_json"
        printf '  "started_at": "%s",\n' "$TS"
        printf '  "updated_at": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf '  "duration_ms": %s,\n' "$DURATION_MS"
        printf '  "exit": %s,\n' "$wrapper_exit"
        printf '  "timeout_hit": %s,\n' "$timeout_hit"
        printf '  "fallback_triggered": false,\n'
        printf '  "stderr_preview": "%s"\n' "$stderr_json"
        printf '}\n'
    } > "$LIVE_FILE.tmp"
    mv "$LIVE_FILE.tmp" "$LIVE_FILE"
}

write_live_state "running" -1 "false" 0
append_narrative_event "codex_started" "step=$STEP_TAG plan=$PLAN_TAG phase=$PHASE_TAG" ""

# ── Exit remap (D-01a) ──────────────────────────────────────────────────────
if [[ $RC -eq 124 ]]; then
    # D-05 #5: if --retry-on-timeout-escalate set and step=phase-level-ATC, retry once
    # with analysis tier. exec replaces process — no fork bomb. --no-retry flag prevents loop.
    if [[ "$RETRY_ON_TIMEOUT_ESCALATE" == true && "$STEP_TAG" == "phase-level-ATC" ]]; then
        echo "codex-exec: timeout on review tier -- retrying once with analysis tier" >&2
        CODEX_TIMEOUT_TIER_OVERRIDE=analysis exec "$0" "$@" --no-retry-on-timeout-escalate
        # exec replaces process; reached only if exec itself fails
    fi
    write_live_state "timeout" 5 "true" 0
    append_jsonl 5 "true" 0
    append_narrative_event "codex_timeout" "timeout after ${TIMEOUT}s step=$STEP_TAG" "lastfail"
    echo "codex-exec: timeout after ${TIMEOUT}s" >&2
    exit 5
fi

if [[ $RC -ne 0 ]]; then
    # Check for auth-denial patterns in stderr first
    if grep -qiE '(auth|401|unauthori[sz]ed)' "$STDERR_TMP" 2>/dev/null; then
        write_live_state "auth-denied" 4 "false" 0
        append_jsonl 4 "false" 0
        append_narrative_event "codex_fallback" "auth-denied step=$STEP_TAG" "lastfail"
        echo "codex-exec: auth-denied (codex stderr matched auth/401/unauthorized)" >&2
        head -c 200 "$STDERR_TMP" >&2 ; echo >&2
        exit 4
    fi
    write_live_state "error" 1 "false" 0
    append_jsonl 1 "false" 0
    append_narrative_event "codex_fallback" "error exit=$RC step=$STEP_TAG" "lastfail"
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
    write_live_state "contract-violation" 6 "false" 0
    append_jsonl 6 "false" 0
    append_narrative_event "codex_fallback" "parse_failure step=$STEP_TAG" "lastfail"
    echo "codex-exec: report contract violation — one or more of FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER missing from codex stdout" >&2
    exit 6
fi

# ── Atomic write (pattern: sgsd-muda-audit.sh:225-229) ──────────────────────
mkdir -p "$(dirname "$REPORT_OUT")"
printf '%s\n' "$parsed" > "$REPORT_OUT.tmp"
mv "$REPORT_OUT.tmp" "$REPORT_OUT"

REPORT_BYTES=$(wc -c < "$REPORT_OUT" | tr -d ' ')

# ── JSONL append on success ─────────────────────────────────────────────────
write_live_state "ok" 0 "false" "$REPORT_BYTES"
append_jsonl 0 "false" "$REPORT_BYTES"
append_narrative_event "codex_completed" "ok step=$STEP_TAG dur=${DURATION_MS}ms bytes=$REPORT_BYTES" "latest"

echo "codex-exec: OK — $REPORT_OUT written (${REPORT_BYTES}B), codex took ${DURATION_MS}ms"
exit 0
