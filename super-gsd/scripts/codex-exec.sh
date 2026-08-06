#!/usr/bin/env bash
# ============================================================================
# codex-exec — bash wrapper around `codex exec` for Phase 14 provider substrate
# ============================================================================
# One shell primitive for the Codex-CLI review path: takes a prompt file,
# pipes it on stdin to `codex exec`, wraps with GNU `timeout`, parses the
# required `code-reviewer-v1` summary fields, preserves additive
# FINDINGS_DETAIL rows, writes the parsed report atomically, and appends one
# provenance row to .planning/metrics/codex-log.jsonl.
#
# OAuth-only (D-02/D-02a): if $OPENAI_API_KEY is set the wrapper refuses to
# run (exit 4). It does NOT unset-then-run; that would silently degrade the
# operator's expectation that API-key auth works. OAuth token is resolved by
# the `codex` binary from its own config (~/.codex/config.json or $CODEX_HOME).
#
# Invocation shape (P4 deviation from D-01): codex exec has NO --prompt-file
# flag per RESEARCH §1a. Prompt is piped on stdin with the `-` sentinel:
#   cat "$PROMPT_FILE" | codex exec --model "$CODEX_MODEL" \
#     -c "model_reasoning_effort=\"$CODEX_REASONING_EFFORT\"" \
#     --sandbox read-only --ephemeral \
#     --skip-git-repo-check --cd "$PROJECT" -
# The wrapper keeps its OWN --prompt-file flag as the external contract; only
# the internal transport to `codex exec` changes.
#
# Usage:
#   codex-exec.sh --prompt-file <p> --report-out <p> [--timeout N] [--dry-run]
#                 [--project <p>] [--phase N] [--plan NN-PP] [--step LABEL] [--profile NAME]
#
# Exit codes (D-01a):
#   0 — success, report parsed + written + JSONL row appended
#   1 — generic codex failure (non-zero RC, non-auth, non-timeout)
#   3 — `codex` binary not on $PATH
#   4 — auth-denied: $OPENAI_API_KEY set OR codex stderr matched /auth|401|unauthori[sz]ed/i
#   5 — timeout (GNU timeout returned 124)
#   6 — report contract violation (one or more of the 5 required fields missing)
#   9 — report write failure (host-side persistence failure after valid output)
#
# See super-gsd/scripts/codex-exec.README.md for the full reference.
# ============================================================================

set -u

# SSH/non-login shells on dev boxes often skip ~/.bashrc user PATH additions.
# Codex is installed as a user-local Node shim, so make that path deterministic
# before probing `codex` or invoking scripts with /usr/bin/env node.
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$SCRIPT_DIR/lib/codex-profile-shell.sh"

# ── Defaults ────────────────────────────────────────────────────────────────
PROMPT_FILE=""
REPORT_OUT=""
TIMEOUT_SECONDS=""
EXPLICIT_TIMEOUT=false
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
# Report contract selector. Default preserves the Phase 14 byte-equivalent
# code-reviewer-v1 awk path. `rd-memo-v1` (R&D Board Treaty §4.5) switches to a
# raw-YAML passthrough validated by scripts/lib/rd-memo-schema.cjs — the board
# memo shape has nothing in common with the 5-field reviewer contract.
CONTRACT="code-reviewer-v1"
# Per-seat model override. The R&D Board seats four DIFFERENT model IDs across
# two providers (treaty §4.5 rules 1-2), so the config-pinned single model is
# not sufficient. Empty = keep the config/default value.
MODEL_OVERRIDE=""
REASONING_OVERRIDE=""
PROFILE_OVERRIDE=""
# Phase 55-01: provider-circuit milestone tag. Optional. When unset OR set to
# the literal string "none", the circuit-breaker pre-check is a no-op (legacy
# Phase 14-54 byte-equivalent path). When set, codex-exec consults
# provider-circuit.cjs.shouldFallback({milestone, provider:"codex"}) BEFORE
# invoking the codex CLI; if fallback_active, exit 7 (provider_fallback_active)
# so the caller can route to Claude. After every codex invocation, the result
# is recorded via provider-circuit.cjs.recordProviderResult.
MILESTONE_TAG=""

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
        --timeout)     TIMEOUT_SECONDS="$2"; EXPLICIT_TIMEOUT=true; shift 2 ;;
        --dry-run)     DRY_RUN=true; shift ;;
        --project)     PROJECT="$2"; shift 2 ;;
        --phase)       PHASE_TAG="$2"; shift 2 ;;
        --plan)        PLAN_TAG="$2"; shift 2 ;;
        --step)         STEP_TAG="$2"; shift 2 ;;
        --timeout-tier) TIMEOUT_TIER="$2"; shift 2 ;;
        --milestone)    MILESTONE_TAG="$2"; shift 2 ;;
        --contract)     CONTRACT="$2"; shift 2 ;;
        --model)        MODEL_OVERRIDE="$2"; shift 2 ;;
        --reasoning)    REASONING_OVERRIDE="$2"; shift 2 ;;
        --profile)      PROFILE_OVERRIDE="$2"; shift 2 ;;
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
    echo "Usage: codex-exec.sh --prompt-file <p> --report-out <p> [--timeout N] [--dry-run] [--project <p>] [--phase N] [--plan NN-PP] [--step LABEL] [--profile NAME]" >&2
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
# If PROJECT looks like a Windows path (^C:\), run wslpath -u.
# POSIX inputs such as /mnt/c/... and /c/... are already usable by Bash.
if [[ "$PROJECT" =~ ^[A-Za-z]:\\ ]]; then
    if command -v wslpath >/dev/null 2>&1; then
        PROJECT_TRANSLATED="$(wslpath -u "$PROJECT" 2>/dev/null || echo "$PROJECT")"
        PROJECT="$PROJECT_TRANSLATED"
    fi
fi

PROFILE_REQUESTED="${PROFILE_OVERRIDE:-${SGSD_CODEX_PROFILE:-review}}"
sgsd_codex_load_cli_profile "$PROFILE_REQUESTED" "review" "$PROJECT"
CODEX_MODEL="$SGSD_CODEX_PROFILE_MODEL"
CODEX_REASONING_EFFORT="$SGSD_CODEX_PROFILE_REASONING_EFFORT"
CODEX_PROFILE_SANDBOX="$SGSD_CODEX_PROFILE_SANDBOX"
CODEX_PROFILE_EPHEMERAL="$SGSD_CODEX_PROFILE_EPHEMERAL"
CODEX_PROFILE_APPROVAL="$SGSD_CODEX_PROFILE_APPROVAL"
CODEX_PROFILE_FULL_AUTO="$SGSD_CODEX_PROFILE_FULL_AUTO"

# Explicit per-invocation overrides beat profile defaults. Applied last so an
# R&D Board seat gets its own treaty-assigned model without mutating registry.
[[ -n "$MODEL_OVERRIDE"     ]] && CODEX_MODEL="$MODEL_OVERRIDE"
[[ -n "$REASONING_OVERRIDE" ]] && CODEX_REASONING_EFFORT="$REASONING_OVERRIDE"
# Validate the contract selector early — an unknown value must fail loudly
# rather than silently falling through to the reviewer parser.
case "$CONTRACT" in
    code-reviewer-v1|rd-memo-v1) ;;
    *) echo "codex-exec: unknown --contract '$CONTRACT' (expected code-reviewer-v1 | rd-memo-v1)" >&2; exit 1 ;;
esac

CODEX_COMMAND="codex"
CODEX_LAUNCHER="direct"
CODEX_PROJECT="$PROJECT"
# Under WSL, prefer a native-Linux codex over the Windows interop shim. The
# Linux build sandboxes via landlock, avoiding the CreateProcessAsUserW/error-216
# file-read block that the cmd.exe->Windows-codex path hits. A /mnt/* resolution
# IS the Windows shim; only then fall back to cmd.exe.
if [[ -r /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
    CODEX_ON_PATH="$(command -v codex 2>/dev/null || true)"
    if [[ -n "$CODEX_ON_PATH" && "$CODEX_ON_PATH" != /mnt/* ]]; then
        : # native-Linux codex present — keep direct launcher (POSIX --cd, no 216)
    elif command -v cmd.exe >/dev/null 2>&1; then
        CODEX_COMMAND="cmd.exe"
        CODEX_LAUNCHER="cmd"
        if command -v wslpath >/dev/null 2>&1; then
            CODEX_PROJECT="$(wslpath -w "$PROJECT" 2>/dev/null || echo "$PROJECT")"
        fi
    fi
fi

case "${SGSD_CODEX_FORCE_LAUNCHER:-}" in
    direct)
        CODEX_COMMAND="codex"
        CODEX_LAUNCHER="direct"
        CODEX_PROJECT="$PROJECT"
        ;;
    cmd)
        CODEX_COMMAND="cmd.exe"
        CODEX_LAUNCHER="cmd"
        CODEX_PROJECT="$PROJECT"
        ;;
    "") ;;
    *) echo "codex-exec: invalid SGSD_CODEX_FORCE_LAUNCHER='${SGSD_CODEX_FORCE_LAUNCHER}'" >&2; exit 1 ;;
esac
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
# Precedence: --timeout-tier custom:N == --timeout N > --timeout-tier named > step-name map > codex_timeout_seconds fallback
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
    if command -v "$CODEX_COMMAND" >/dev/null 2>&1; then
        ST_PATH=true
    else
        EXIT_CODE=10
    fi

    # Probe 2 — auth: behavioral check.
    # Per architectural rule: probes must NOT infer availability from private
    # file layout. The canonical auth oracle is `codex login status`. File
    # checks (auth.json / config.toml / config.json) are diagnostic-only and
    # logged separately for triage; they never gate PASS/FAIL alone.
    #
    # Decision tree:
    #   1. OPENAI_API_KEY set → exit 11 (we want OAuth-only).
    #   2. SKIP_NETWORK mode → key-absence is sufficient.
    #   3. `codex login status` → primary oracle: any "Logged in" → PASS.
    #   4. Else fall through to Probe 4 contract canary (real exec call) which
    #      is the secondary behavioral check; if it succeeds, auth is fine.
    #   5. If neither oracle yields evidence → FAIL.
    #
    # Diagnostic file inventory captured into ST_AUTH_DIAG_* for the JSONL row.
    if [[ "$EXIT_CODE" -eq 0 ]]; then
        CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
        ST_AUTH_DIAG_AUTH_JSON=$([ -f "$CODEX_HOME_DIR/auth.json" ] && echo true || echo false)
        ST_AUTH_DIAG_CONFIG_TOML=$([ -f "$CODEX_HOME_DIR/config.toml" ] && echo true || echo false)
        ST_AUTH_DIAG_CONFIG_JSON=$([ -f "$CODEX_HOME_DIR/config.json" ] && echo true || echo false)
        ST_AUTH_METHOD="unknown"

        if [[ -n "${OPENAI_API_KEY:-}" ]]; then
            EXIT_CODE=11
            ST_AUTH_METHOD="api_key_set_unwanted"
        elif [[ "$SKIP_NETWORK" == true ]]; then
            ST_AUTH=true
            ST_AUTH_METHOD="skip_network"
        elif command -v "$CODEX_COMMAND" >/dev/null 2>&1; then
            # Primary oracle: `codex login status`. Capture stdout+stderr; any
            # "Logged in" line means auth works.
            CODEX_STATUS_OUT="$("$CODEX_COMMAND" login status 2>&1 || true)"
            if echo "$CODEX_STATUS_OUT" | grep -qiE "logged in"; then
                ST_AUTH=true
                ST_AUTH_METHOD="codex_login_status"
            else
                # Secondary oracle deferred to Probe 4 (contract canary).
                # Mark unverified for now; Probe 4 will set ST_AUTH=true if it succeeds.
                ST_AUTH_METHOD="deferred_to_canary"
                ST_AUTH=false
                # Don't set EXIT_CODE yet; let Probe 4 confirm or deny.
            fi
        else
            EXIT_CODE=11
            ST_AUTH_METHOD="codex_command_missing"
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

    # Probe 4 — known-good contract: real Codex call; skipped when --skip-network (exit 13).
    # Also serves as the secondary auth oracle when Probe 2 deferred to canary.
    ST_CONTRACT_STDERR=""
    ST_CONTRACT_RC=""
    if [[ "$SKIP_NETWORK" == true ]]; then
        ST_CONTRACT=true  # treated as pass in offline/CI mode
    elif [[ "$EXIT_CODE" -eq 0 || "$EXIT_CODE" -eq 11 ]]; then
        # Run canary even if Probe 2 deferred (EXIT_CODE may be 0 with ST_AUTH=false
        # in deferred_to_canary mode). Canary success retroactively sets ST_AUTH=true.
        ST_PROMPT_TMP="$(mktemp -t codex-self-test.XXXXXX)"
        ST_REPORT_TMP="$(mktemp -t codex-self-test-report.XXXXXX)"
        ST_STDERR_TMP="$(mktemp -t codex-self-test-stderr.XXXXXX)"
        printf 'Output exactly five lines:\nFINDINGS: 0\nCRITICAL: 0\nWARNINGS: 0\nPASS_RATE: 0/0\nONE_LINER: self-test\n' > "$ST_PROMPT_TMP"
        set +e
        timeout 60s bash -c 'if [[ "$2" == "cmd" ]]; then cat "$0" | cmd.exe /c codex exec --model "$4" -c "model_reasoning_effort=\"$5\"" --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -; else cat "$0" | "$3" exec --model "$4" -c "model_reasoning_effort=\"$5\"" --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -; fi' \
            "$ST_PROMPT_TMP" "${CODEX_PROJECT:-${PROJECT:-$(pwd)}}" "$CODEX_LAUNCHER" "$CODEX_COMMAND" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" > "$ST_REPORT_TMP" 2> "$ST_STDERR_TMP"
        ST_RC=$?
        set -e
        ST_CONTRACT_RC="$ST_RC"
        ST_CONTRACT_STDERR="$(head -c 200 "$ST_STDERR_TMP" 2>/dev/null | tr -d '\r' | tr '\n' ' ' | sed 's/"/\\"/g')"
        if [[ $ST_RC -eq 0 ]] && \
           grep -q "^FINDINGS:"  "$ST_REPORT_TMP" && \
           grep -q "^CRITICAL:"  "$ST_REPORT_TMP" && \
           grep -q "^WARNINGS:"  "$ST_REPORT_TMP" && \
           grep -q "^PASS_RATE:" "$ST_REPORT_TMP" && \
           grep -q "^ONE_LINER:" "$ST_REPORT_TMP"; then
            ST_CONTRACT=true
            # Retroactive auth confirmation: if Probe 2 deferred, canary success
            # IS the secondary behavioral oracle. Promote auth method.
            if [[ "$ST_AUTH" == false ]] && [[ "${ST_AUTH_METHOD:-}" == "deferred_to_canary" ]]; then
                ST_AUTH=true
                ST_AUTH_METHOD="contract_canary_passed"
                EXIT_CODE=0
            fi
        else
            # Canary failed. If Probe 2 deferred, this is the FAIL.
            if [[ "${ST_AUTH_METHOD:-}" == "deferred_to_canary" ]]; then
                EXIT_CODE=11
                ST_AUTH_METHOD="contract_canary_failed"
            else
                EXIT_CODE=13
            fi
        fi
        rm -f "$ST_PROMPT_TMP" "$ST_REPORT_TMP" "$ST_STDERR_TMP"
    fi

    ST_PROFILE=false
    ST_FINALIZE=false
    ST_REPORT_WRITE=false
    if [[ "$SKIP_NETWORK" == true && "$EXIT_CODE" -eq 0 ]]; then
        ST_TMP_ROOT="$(mktemp -d)"
        ST_PROJECT="$ST_TMP_ROOT/project"
        ST_PROMPT="$ST_TMP_ROOT/prompt.txt"
        ST_REPORT="$ST_TMP_ROOT/report.txt"
        mkdir -p "$ST_PROJECT/.planning/metrics"
        printf 'codex-exec self-test prompt\n' > "$ST_PROMPT"

        ST_REVIEW_DIRECT="$(SGSD_CODEX_FORCE_LAUNCHER=direct "$0" --dry-run --prompt-file "$ST_PROMPT" --report-out "$ST_REPORT" --project "$ST_PROJECT" --timeout 30 | awk -F'resolved: ' '/resolved:/ { print $2; exit }')"
        ST_REVIEW_CMD="$(SGSD_CODEX_FORCE_LAUNCHER=cmd "$0" --dry-run --prompt-file "$ST_PROMPT" --report-out "$ST_REPORT" --project "$ST_PROJECT" --timeout 30 | awk -F'resolved: ' '/resolved:/ { print $2; exit }')"
        ST_TRIAGE_DIRECT="$(SGSD_CODEX_FORCE_LAUNCHER=direct "$0" --dry-run --profile triage --prompt-file "$ST_PROMPT" --report-out "$ST_REPORT" --project "$ST_PROJECT" --timeout 30 | awk -F'resolved: ' '/resolved:/ { print $2; exit }')"
        ST_TIMEOUT_DRY="$(SGSD_CODEX_FORCE_LAUNCHER=direct "$0" --dry-run --profile triage --prompt-file "$ST_PROMPT" --report-out "$ST_REPORT" --project "$ST_PROJECT" --timeout 77 | awk -F'resolved: ' '/resolved:/ { print $2; exit }')"
        if [[ "$ST_REVIEW_DIRECT" == *'"direct" "codex" "gpt-5.5" "xhigh"' && "$ST_REVIEW_DIRECT" == *'--sandbox read-only --ephemeral --skip-git-repo-check'* && "$ST_REVIEW_CMD" == *'"cmd" "cmd.exe" "gpt-5.5" "xhigh"' && "$ST_TRIAGE_DIRECT" == *'--sandbox read-only --skip-git-repo-check'* && "$ST_TRIAGE_DIRECT" != *'--ephemeral'* && "$ST_TIMEOUT_DRY" == timeout\ 77s* ]]; then
            ST_PROFILE=true
        else
            EXIT_CODE=14
        fi

        ST_BIN="$ST_TMP_ROOT/bin"
        mkdir -p "$ST_BIN"
        cat > "$ST_BIN/codex" <<'EOS'
#!/usr/bin/env bash
if [[ "$1" == "--version" ]]; then echo "codex-cli-fake 0.0.0"; exit 0; fi
if [[ "$1" == "login" && "$2" == "status" ]]; then echo "Logged in"; exit 0; fi
if [[ "$1" == "exec" ]]; then
    case "${SGSD_FAKE_CODEX_MODE:-success}" in
        success)
            printf 'FINDINGS: 0\nCRITICAL: 0\nWARNINGS: 0\nPASS_RATE: 1/1\nONE_LINER: fake success\n'
            exit 0
            ;;
        contract)
            printf 'missing contract fields\n'
            exit 0
            ;;
        generic)
            printf 'generic stdout\n'
            printf 'generic stderr\n' >&2
            exit 2
            ;;
        auth)
            printf 'auth stdout\n'
            printf 'unauthorized\n' >&2
            exit 2
            ;;
        timeout)
            printf 'before timeout\n'
            sleep 2
            exit 0
            ;;
    esac
fi
exit 0
EOS
        chmod +x "$ST_BIN/codex"

        sgsd_codex_exec_self_test_case() {
            local mode="$1" expected="$2" timeout_value="$3"
            local case_dir case_project case_prompt case_report before_rows after_rows rc report_bytes
            case_dir="$ST_TMP_ROOT/case-$mode"
            case_project="$case_dir/project"
            case_prompt="$case_dir/prompt.txt"
            case_report="$case_dir/report.txt"
            mkdir -p "$case_project/.planning/metrics"
            printf 'prompt for %s\n' "$mode" > "$case_prompt"
            before_rows=0
            [[ -f "$case_project/.planning/metrics/codex-log.jsonl" ]] && before_rows="$(wc -l < "$case_project/.planning/metrics/codex-log.jsonl" | tr -d ' ')"
            set +e
            PATH="$ST_BIN:$PATH" SGSD_CODEX_FORCE_LAUNCHER=direct SGSD_FAKE_CODEX_MODE="$mode" "$0" --prompt-file "$case_prompt" --report-out "$case_report" --project "$case_project" --timeout "$timeout_value" --phase 145 --plan 145-01 --step "self-test-$mode" >/dev/null 2> "$case_dir/stderr.txt"
            rc=$?
            set -e
            after_rows=0
            [[ -f "$case_project/.planning/metrics/codex-log.jsonl" ]] && after_rows="$(wc -l < "$case_project/.planning/metrics/codex-log.jsonl" | tr -d ' ')"
            if [[ "$rc" -ne "$expected" || ! -s "$case_report" || $((after_rows - before_rows)) -ne 1 ]]; then
                return 1
            fi
            report_bytes="$(wc -c < "$case_report" | tr -d ' ')"
            [[ "$report_bytes" -gt 0 ]]
        }

        sgsd_codex_exec_self_test_write_failure_case() {
            local case_dir case_project case_prompt case_report report_dir rc
            case_dir="$ST_TMP_ROOT/case-write-failure"
            case_project="$case_dir/project"
            case_prompt="$case_dir/prompt.txt"
            report_dir="$case_dir/read-only-report-dir"
            case_report="$report_dir/report.txt"
            mkdir -p "$case_project/.planning/metrics" "$report_dir"
            printf 'prompt for write failure\n' > "$case_prompt"
            chmod a-w "$report_dir" 2>/dev/null || true
            if [[ -w "$report_dir" ]]; then
                echo "Probe 6 write-failure: SKIPPED (filesystem does not enforce chmod a-w)" >&2
                chmod u+w "$report_dir" 2>/dev/null || true
                return 0
            fi
            set +e
            PATH="$ST_BIN:$PATH" SGSD_CODEX_FORCE_LAUNCHER=direct SGSD_FAKE_CODEX_MODE="contract" "$0" --prompt-file "$case_prompt" --report-out "$case_report" --project "$case_project" --timeout 5 --phase 145 --plan 145-01 --step "self-test-write-failure" >/dev/null 2> "$case_dir/stderr.txt"
            rc=$?
            chmod u+w "$report_dir" 2>/dev/null || true
            set -e
            [[ "$rc" -eq 6 ]] && grep -q 'report contract violation' "$case_dir/stderr.txt"
        }

        sgsd_codex_exec_self_test_report_write_failure_case() {
            local case_dir case_project case_prompt report_parent case_report rc
            case_dir="$ST_TMP_ROOT/case-report-write-failure"
            case_project="$case_dir/project"
            case_prompt="$case_dir/prompt.txt"
            report_parent="$case_dir/report-parent-is-file"
            case_report="$report_parent/report.txt"
            mkdir -p "$case_project/.planning/metrics"
            printf 'prompt for report write failure\n' > "$case_prompt"
            printf 'not a directory\n' > "$report_parent"
            set +e
            PATH="$ST_BIN:$PATH" SGSD_CODEX_FORCE_LAUNCHER=direct SGSD_FAKE_CODEX_MODE="success" "$0" --prompt-file "$case_prompt" --report-out "$case_report" --project "$case_project" --timeout 5 --phase 145 --plan 145-01 --step "self-test-report-write-failure" > "$case_dir/stdout.txt" 2> "$case_dir/stderr.txt"
            rc=$?
            set -e
            [[ "$rc" -eq 9 ]] && ! grep -q '^codex-exec: OK' "$case_dir/stdout.txt" && grep -q 'report write failure' "$case_dir/stderr.txt"
        }
        if sgsd_codex_exec_self_test_case success 0 5 && \
           sgsd_codex_exec_self_test_case contract 6 5 && \
           sgsd_codex_exec_self_test_case generic 1 5 && \
           sgsd_codex_exec_self_test_case auth 4 5 && \
           sgsd_codex_exec_self_test_case timeout 5 1 && \
           sgsd_codex_exec_self_test_write_failure_case; then
            ST_FINALIZE=true
        else
            EXIT_CODE=15
        fi
        if sgsd_codex_exec_self_test_report_write_failure_case; then
            ST_REPORT_WRITE=true
        elif [[ "$EXIT_CODE" -eq 0 ]]; then
            EXIT_CODE=16
        fi
        rm -rf "$ST_TMP_ROOT"
    fi
    # Structured stdout
    echo "=== codex-exec --self-test ==="
    printf "Model:            %s\n" "$CODEX_MODEL"
    printf "Reasoning effort: %s\n" "$CODEX_REASONING_EFFORT"
    printf "Probe 1 PATH:     %s\n" "$([ "$ST_PATH"     = true ] && echo PASS || echo FAIL)"
    printf "Probe 2 auth:     %s\n" "$([ "$ST_AUTH"     = true ] && echo PASS || echo FAIL)"
    printf "Probe 3 timeout:  %s (tier_review=%s)\n" "$([ "$ST_TIMEOUT"  = true ] && echo PASS || echo FAIL)" "${TIER_REVIEW}"
    printf "Probe 4 contract: %s%s\n" \
        "$([ "$ST_CONTRACT" = true ] && echo PASS || echo FAIL)" \
        "$([ "$SKIP_NETWORK" = true ] && echo ' (skipped)' || echo '')"
    printf "Probe 5 profiles: %s\n" "$([ "$ST_PROFILE" = true ] && echo PASS || echo FAIL)"
    printf "Probe 6 finalize: %s\n" "$([ "$ST_FINALIZE" = true ] && echo PASS || echo FAIL)"
    printf "Probe 7 report write: %s\n" "$([ "$ST_REPORT_WRITE" = true ] && echo PASS || echo FAIL)"
    echo "Exit: $EXIT_CODE"

    # Append JSONL row to codex-log.jsonl (D-05) with probe metadata for triage.
    # Schema additions per architectural rule: probe_version, codex_version,
    # auth_method, checked_files, command_exit, stderr_excerpt.
    if [[ -n "$ROOT" ]]; then
        ST_LOG="$ROOT/.planning/metrics/codex-log.jsonl"
        ST_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        mkdir -p "$(dirname "$ST_LOG")"
        model_json="$(json_escape "$CODEX_MODEL")"
        effort_json="$(json_escape "$CODEX_REASONING_EFFORT")"
        # Probe metadata
        PROBE_VERSION="2"
        CODEX_VERSION="$("$CODEX_COMMAND" --version 2>/dev/null | head -1 || echo unknown)"
        codex_version_json="$(json_escape "$CODEX_VERSION")"
        auth_method_json="$(json_escape "${ST_AUTH_METHOD:-unknown}")"
        stderr_json="$(json_escape "${ST_CONTRACT_STDERR:-}")"
        contract_rc_json="${ST_CONTRACT_RC:-null}"
        printf '{"ts":"%s","step":"self-test","model":"%s","reasoning_effort":"%s","exit":%d,"skip_network":%s,"self_test_probes":{"path":%s,"auth":%s,"timeout":%s,"contract":%s},"probe_version":"%s","codex_version":"%s","auth_method":"%s","checked_files":{"auth_json":%s,"config_toml":%s,"config_json":%s},"command_exit":%s,"stderr_excerpt":"%s"}\n' \
            "$ST_TS" "$model_json" "$effort_json" "$EXIT_CODE" \
            "$([ "$SKIP_NETWORK" = true ] && echo true || echo false)" \
            "$([ "$ST_PATH"     = true ] && echo true || echo false)" \
            "$([ "$ST_AUTH"     = true ] && echo true || echo false)" \
            "$([ "$ST_TIMEOUT"  = true ] && echo true || echo false)" \
            "$([ "$ST_CONTRACT" = true ] && echo true || echo false)" \
            "$PROBE_VERSION" \
            "$codex_version_json" \
            "$auth_method_json" \
            "${ST_AUTH_DIAG_AUTH_JSON:-false}" \
            "${ST_AUTH_DIAG_CONFIG_TOML:-false}" \
            "${ST_AUTH_DIAG_CONFIG_JSON:-false}" \
            "$contract_rc_json" \
            "$stderr_json" \
            >> "$ST_LOG"
    fi
    exit $EXIT_CODE
fi

TIMEOUT="$TIMEOUT_SECONDS"

if [[ -n "$TIMEOUT_TIER" ]]; then
    if [[ "$EXPLICIT_TIMEOUT" == true ]]; then
        echo "codex-exec: --timeout ${TIMEOUT_SECONDS}s overridden by --timeout-tier '$TIMEOUT_TIER'" >&2
    fi
    tier_val="$(resolve_timeout_tier "$TIMEOUT_TIER")"
    if [[ -n "$tier_val" ]]; then
        TIMEOUT="$tier_val"
    else
        echo "codex-exec: unknown --timeout-tier '$TIMEOUT_TIER'; valid: default|review|analysis|custom:N" >&2
        exit 1
    fi
elif [[ "$EXPLICIT_TIMEOUT" == true ]]; then
    TIMEOUT="$TIMEOUT_SECONDS"
elif [[ -n "$STEP_TAG" ]]; then
    step_val="$(resolve_step_timeout "$STEP_TAG")"
    if [[ -n "$step_val" ]]; then
        TIMEOUT="$step_val"
    else
        TIMEOUT="$TIER_DEFAULT"
        echo "step '$STEP_TAG' has no tier mapping, using default (${TIMEOUT}s)" >&2
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
CODEX_BIN="$(command -v "$CODEX_COMMAND" 2>/dev/null || true)"
if [[ -z "$CODEX_BIN" && "$DRY_RUN" == false ]]; then
    echo "codex-exec: '$CODEX_COMMAND' CLI not found on \$PATH — install via 'npm i -g @openai/codex' or see Codex CLI README." >&2
    exit 3
fi

# ── Resolved command line (also used for dry-run display) ───────────────────
CODEX_REVIEW_PROFILE_FLAGS="--sandbox ${CODEX_PROFILE_SANDBOX}"
if [[ "$CODEX_PROFILE_EPHEMERAL" == "true" ]]; then
    CODEX_REVIEW_PROFILE_FLAGS="$CODEX_REVIEW_PROFILE_FLAGS --ephemeral"
fi
RESOLVED_CMD="timeout ${TIMEOUT}s bash -c 'if [[ \"\$2\" == \"cmd\" ]]; then cat \"\$0\" | cmd.exe /c codex exec --model \"\$4\" -c \"model_reasoning_effort=\\\"\$5\\\"\" ${CODEX_REVIEW_PROFILE_FLAGS} --skip-git-repo-check --cd \"\$1\" -; else cat \"\$0\" | \"\$3\" exec --model \"\$4\" -c \"model_reasoning_effort=\\\"\$5\\\"\" ${CODEX_REVIEW_PROFILE_FLAGS} --skip-git-repo-check --cd \"\$1\" -; fi' \"$PROMPT_FILE\" \"$CODEX_PROJECT\" \"$CODEX_LAUNCHER\" \"$CODEX_COMMAND\" \"$CODEX_MODEL\" \"$CODEX_REASONING_EFFORT\""
# ── Dry-run short-circuit ───────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
    echo "codex-exec DRY RUN"
    echo "  resolved: $RESOLVED_CMD"
    echo "  auth:     OAuth-only (OPENAI_API_KEY not set) ✓"
    echo "  model:    ${CODEX_MODEL}"
    echo "  effort:   ${CODEX_REASONING_EFFORT}"
    echo "  timeout:  ${TIMEOUT}s"
    echo "  project:  $PROJECT"
    echo "  codex-cd: ${CODEX_PROJECT}"
    echo "  command:  $([ "$CODEX_LAUNCHER" = "cmd" ] && echo 'cmd.exe /c codex' || echo "$CODEX_COMMAND")"
    echo "  codex:    ${CODEX_BIN:-<not-on-PATH>}"
    echo "  report-out: $REPORT_OUT"
    exit 0
fi

# ── Phase 55-01: Provider Circuit Breaker pre-check ─────────────────────────
# When --milestone is set (and not "none"), consult provider-circuit.cjs.
# shouldFallback({milestone, provider:"codex"}) BEFORE invoking the codex CLI.
# If the circuit is open (fallback_active=true), exit 7 immediately so the
# caller can route to Claude. Lock 13: any error in the probe is degraded to
# "no fallback" -- we never block a codex invocation because the probe broke.
# Lock 4: when --milestone is unset OR equals "none", this block is a no-op
# (preserves Phase 14-54 byte-equivalent invocation path).
provider_circuit_should_fallback() {
    local milestone="$1"
    if [[ -z "$milestone" || "$milestone" == "none" ]]; then
        echo "false"
        return 0
    fi
    if ! command -v node >/dev/null 2>&1; then
        echo "false"
        return 0
    fi
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd 2>/dev/null || echo "")"
    if [[ -z "$script_dir" || ! -f "$script_dir/lib/provider-circuit.cjs" ]]; then
        echo "false"
        return 0
    fi
    local result
    result="$(SGSD_CIRCUIT_PROBE_MILESTONE="$milestone" node -e '
        try {
            var pc = require(process.argv[1]);
            var r = pc.shouldFallback({
                milestone: process.env.SGSD_CIRCUIT_PROBE_MILESTONE,
                provider: "codex",
            });
            process.stdout.write(r && r.fallback_active === true ? "true" : "false");
        } catch (e) {
            process.stdout.write("false");
        }
    ' "$script_dir/lib/provider-circuit.cjs" 2>/dev/null || echo "false")"
    echo "$result"
}

provider_circuit_record_result() {
    # $1 = milestone, $2 = "true" for ok, "false" for failure
    local milestone="$1"
    local ok_flag="$2"
    if [[ -z "$milestone" || "$milestone" == "none" ]]; then
        return 0
    fi
    if ! command -v node >/dev/null 2>&1; then
        return 0
    fi
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd 2>/dev/null || echo "")"
    if [[ -z "$script_dir" || ! -f "$script_dir/lib/provider-circuit.cjs" ]]; then
        return 0
    fi
    SGSD_CIRCUIT_REC_MILESTONE="$milestone" \
    SGSD_CIRCUIT_REC_OK="$ok_flag" \
    node -e '
        try {
            var pc = require(process.argv[1]);
            pc.recordProviderResult({
                milestone: process.env.SGSD_CIRCUIT_REC_MILESTONE,
                provider: "codex",
                ok: process.env.SGSD_CIRCUIT_REC_OK === "true",
            });
        } catch (e) { /* Lock 13: never throw upward */ }
    ' "$script_dir/lib/provider-circuit.cjs" >/dev/null 2>&1 || true
}

if [[ -n "$MILESTONE_TAG" && "$MILESTONE_TAG" != "none" ]]; then
    PCIRCUIT_PRECHECK="$(provider_circuit_should_fallback "$MILESTONE_TAG")"
    if [[ "$PCIRCUIT_PRECHECK" == "true" ]]; then
        echo "codex-exec: provider_fallback_active milestone=$MILESTONE_TAG provider=codex" >&2
        echo "codex-exec: circuit breaker open -- caller should route to Claude reviewer" >&2
        exit 7
    fi
fi

# ── Real invocation ─────────────────────────────────────────────────────────
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_MS="$(date +%s%3N 2>/dev/null || echo 0)"

STDOUT_TMP="$(mktemp -t codex-stdout.XXXXXX)"
STDERR_TMP="$(mktemp -t codex-stderr.XXXXXX)"
trap 'rm -f "$STDOUT_TMP" "$STDERR_TMP" "${REPORT_OUT}.tmp" 2>/dev/null || true' EXIT
WATCH_OUT="$PROJECT/.planning/metrics/codex-live-output.txt"
mkdir -p "$(dirname "$WATCH_OUT")"
{
    echo ""
    echo "============================================================"
    echo "codex-review START  ts=$TS  phase=${PHASE_TAG:-?}  plan=${PLAN_TAG:-?}  step=${STEP_TAG:-?}"
    echo "model=$CODEX_MODEL  effort=$CODEX_REASONING_EFFORT  timeout=${TIMEOUT}s"
    echo "project=$CODEX_PROJECT  prompt=$PROMPT_FILE  report=$REPORT_OUT"
    echo "============================================================"
} >> "$WATCH_OUT"

set +e
timeout "${TIMEOUT}s" bash -c 'if [[ "$2" == "cmd" ]]; then if [[ "$7" == "true" ]]; then cat "$0" | cmd.exe /c codex exec --model "$4" -c "model_reasoning_effort=\"$5\"" --sandbox "$6" --ephemeral --skip-git-repo-check --cd "$1" -; else cat "$0" | cmd.exe /c codex exec --model "$4" -c "model_reasoning_effort=\"$5\"" --sandbox "$6" --skip-git-repo-check --cd "$1" -; fi; else if [[ "$7" == "true" ]]; then cat "$0" | "$3" exec --model "$4" -c "model_reasoning_effort=\"$5\"" --sandbox "$6" --ephemeral --skip-git-repo-check --cd "$1" -; else cat "$0" | "$3" exec --model "$4" -c "model_reasoning_effort=\"$5\"" --sandbox "$6" --skip-git-repo-check --cd "$1" -; fi; fi' \
    "$PROMPT_FILE" "$CODEX_PROJECT" "$CODEX_LAUNCHER" "$CODEX_COMMAND" "$CODEX_MODEL" "$CODEX_REASONING_EFFORT" "$CODEX_PROFILE_SANDBOX" "$CODEX_PROFILE_EPHEMERAL" \
    2> >(tee -a "$WATCH_OUT" > "$STDERR_TMP") \
    | tee -a "$WATCH_OUT" \
    > "$STDOUT_TMP"
RC=${PIPESTATUS[0]}
set +e
END_MS="$(date +%s%3N 2>/dev/null || echo 0)"
if [[ "$START_MS" -gt 0 && "$END_MS" -ge "$START_MS" ]]; then
    DURATION_MS=$((END_MS - START_MS))
else
    DURATION_MS=0
fi
{
    echo ""
    echo "============================================================"
    echo "codex-review END    exit=$RC  duration=$(( DURATION_MS / 1000 ))s"
    echo "============================================================"
} >> "$WATCH_OUT"

PROMPT_BYTES=0
if [[ -f "$PROMPT_FILE" ]]; then
    PROMPT_BYTES=$(wc -c < "$PROMPT_FILE" | tr -d ' ')
fi

# ── Pre-compute stderr preview (first 200 bytes, JSON-safe) ─────────────────
stderr_preview_raw="$(head -c 200 "$STDERR_TMP" 2>/dev/null || echo '')"
# Escape backslash, double-quote, and control chars for JSON embedding.
stderr_preview_json="$(json_escape "$stderr_preview_raw")"
codex_model_json="$(json_escape "$CODEX_MODEL")"
codex_reasoning_effort_json="$(json_escape "$CODEX_REASONING_EFFORT")"

# ── JSONL append helper (fires on every exit path except 3/4-env/1-usage) ──
METRICS_LOG="$PROJECT/.planning/metrics/codex-log.jsonl"
LIVE_FILE="$PROJECT/.planning/metrics/codex-live.json"
append_jsonl() {
    local wrapper_exit="$1" timeout_hit="$2" report_bytes="$3"
    local phase_field plan_field step_field
    if [[ -z "$PHASE_TAG" ]]; then phase_field="null"; else phase_field="$PHASE_TAG"; fi
    if [[ -z "$PLAN_TAG" ]];  then plan_field="null";  else plan_field="\"$PLAN_TAG\""; fi
    if [[ -z "$STEP_TAG" ]];  then step_field="null";  else step_field="\"$STEP_TAG\""; fi
    mkdir -p "$(dirname "$METRICS_LOG")" 2>/dev/null || true
    printf '{"ts":"%s","phase":%s,"plan":%s,"step":%s,"model":"%s","reasoning_effort":"%s","exit":%d,"duration_ms":%d,"prompt_bytes":%d,"report_bytes":%d,"timeout_hit":%s,"fallback_triggered":false,"stderr_preview":"%s"}\n' \
        "$TS" "$phase_field" "$plan_field" "$step_field" \
        "$codex_model_json" "$codex_reasoning_effort_json" \
        "$wrapper_exit" "$DURATION_MS" "$PROMPT_BYTES" "$report_bytes" \
        "$timeout_hit" "$stderr_preview_json" \
        >> "$METRICS_LOG" 2>/dev/null || true
}

# ── MC-03: narrative.md event writer ────────────────────────────────────────
write_report_payload() {
    local body="$1"
    mkdir -p "$(dirname "$REPORT_OUT")" 2>/dev/null || true
    if printf '%s\n' "$body" > "$REPORT_OUT.tmp" 2>/dev/null && mv "$REPORT_OUT.tmp" "$REPORT_OUT" 2>/dev/null; then
        wc -c < "$REPORT_OUT" 2>/dev/null | tr -d ' ' || printf '0'
    else
        rm -f "$REPORT_OUT.tmp" 2>/dev/null || true
        printf '0'
    fi
}

write_raw_report_payload() {
    local summary="$1"
    mkdir -p "$(dirname "$REPORT_OUT")" 2>/dev/null || true
    if {
        printf '%s\n' "$summary"
        printf '\n--- codex stdout ---\n'
        cat "$STDOUT_TMP" 2>/dev/null || true
        printf '\n--- codex stderr ---\n'
        cat "$STDERR_TMP" 2>/dev/null || true
    } > "$REPORT_OUT.tmp" 2>/dev/null && mv "$REPORT_OUT.tmp" "$REPORT_OUT" 2>/dev/null; then
        wc -c < "$REPORT_OUT" 2>/dev/null | tr -d ' ' || printf '0'
    else
        rm -f "$REPORT_OUT.tmp" 2>/dev/null || true
        printf '0'
    fi
}

REPORT_WRITE_FAILURE_EXIT=9

report_bytes_positive() {
    [[ "${1:-}" =~ ^[1-9][0-9]*$ ]]
}

report_bytes_for_json() {
    if [[ "${1:-}" =~ ^[0-9]+$ ]]; then
        printf '%s' "$1"
    else
        printf '0'
    fi
}

note_report_write_failure() {
    echo "codex-exec: report write failure — could not write $REPORT_OUT" >&2
}

handle_report_write_failure() {
    if report_bytes_positive "$REPORT_BYTES"; then
        return 0
    fi
    REPORT_BYTES="$(report_bytes_for_json "$REPORT_BYTES")"
    note_report_write_failure
    return 1
}
NARRATIVE_FILE="$PROJECT/.planning/metrics/narrative.md"

append_narrative_event() {
    local event_type="$1"   # codex_started | codex_completed | codex_timeout | codex_fallback
    local detail="$2"       # short description string (no newlines)
    local update_field="$3" # "latest" | "lastfail" | "" (no field update)

    # Initialize narrative.md if missing
    if [[ ! -f "$NARRATIVE_FILE" ]]; then
        mkdir -p "$(dirname "$NARRATIVE_FILE")" 2>/dev/null || true
        printf '# Narrative\n\nlatest: \nlastfail: \n\n## Events\n' > "$NARRATIVE_FILE" 2>/dev/null || true
    fi

    # Append event entry to ## Events section
    local entry="- [$TS] $event_type: $detail"
    printf '%s\n' "$entry" >> "$NARRATIVE_FILE" 2>/dev/null || true

    # Update latest or lastfail field (sed in-place)
    if [[ "$update_field" == "latest" ]]; then
        sed -i "s|^latest:.*|latest: $detail|" "$NARRATIVE_FILE" 2>/dev/null || true
    elif [[ "$update_field" == "lastfail" ]]; then
        sed -i "s|^lastfail:.*|lastfail: $detail|" "$NARRATIVE_FILE" 2>/dev/null || true
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
    mkdir -p "$(dirname "$LIVE_FILE")" 2>/dev/null || true
    if {
        printf '{\n'
        printf '  "provider": "codex-cli-reviewer",\n'
        printf '  "invocation": "shell",\n'
        printf '  "toolbox": "bash -> codex exec",\n'
        printf '  "model": "%s",\n' "$codex_model_json"
        printf '  "reasoning_effort": "%s",\n' "$codex_reasoning_effort_json"
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
    } > "$LIVE_FILE.tmp" 2>/dev/null; then
        mv "$LIVE_FILE.tmp" "$LIVE_FILE" 2>/dev/null || true
    else
        rm -f "$LIVE_FILE.tmp" 2>/dev/null || true
    fi
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
    REPORT_BYTES="$(write_raw_report_payload "codex-exec: timeout after ${TIMEOUT}s")"
    handle_report_write_failure || true
    write_live_state "timeout" 5 "true" "$REPORT_BYTES"
    append_jsonl 5 "true" "$REPORT_BYTES"
    append_narrative_event "codex_timeout" "timeout after ${TIMEOUT}s step=$STEP_TAG" "lastfail"
    # INSTR-03 (v1.5 Phase 25): timeout observability emit — feeds dashboard
    # tile "timeout rate by tier" so operator sees chronic under-budgeting.
    OBS_LOG=""
    if [[ -n "$ROOT" ]]; then
        OBS_LOG="$ROOT/.planning/metrics/codex-timeout-observability.jsonl"
        mkdir -p "$(dirname "$OBS_LOG")" 2>/dev/null || true
        OBS_TIER_REQUESTED="${TIMEOUT_TIER:-${STEP_TAG:-default}}"
        OBS_TIER_ACTUAL="$OBS_TIER_REQUESTED"
        # If retry-on-escalate was set + step is phase-level-ATC, the actual
        # tier we ran was the original (we're about to exec retry). Mark it.
        [[ "$RETRY_ON_TIMEOUT_ESCALATE" == true && "$STEP_TAG" == "phase-level-ATC" ]] && OBS_TIER_ACTUAL="${OBS_TIER_REQUESTED}->analysis(retry)"
        OBS_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf '{"ts":"%s","tier_requested":"%s","tier_actual_via_retry":"%s","duration_ms":%d,"exit_code":124,"step":"%s","phase":"%s","plan":"%s"}\n' \
            "$OBS_TS" "$OBS_TIER_REQUESTED" "$OBS_TIER_ACTUAL" $((TIMEOUT * 1000)) "${STEP_TAG:-null}" "${PHASE_TAG:-null}" "${PLAN_TAG:-null}" \
            >> "$OBS_LOG" 2>/dev/null || true
    fi
    echo "codex-exec: timeout after ${TIMEOUT}s" >&2
    # Phase 55-01: record failure into provider-circuit (Lock 13 internal).
    provider_circuit_record_result "$MILESTONE_TAG" "false"
    exit 5
fi

if [[ $RC -ne 0 ]]; then
    # Check for auth-denial patterns in stderr first
    if grep -qiE '(auth|401|unauthori[sz]ed)' "$STDERR_TMP" 2>/dev/null; then
        REPORT_BYTES="$(write_raw_report_payload "codex-exec: auth-denied")"
        handle_report_write_failure || true
        write_live_state "auth-denied" 4 "false" "$REPORT_BYTES"
        append_jsonl 4 "false" "$REPORT_BYTES"
        append_narrative_event "codex_fallback" "auth-denied step=$STEP_TAG" "lastfail"
        echo "codex-exec: auth-denied (codex stderr matched auth/401/unauthorized)" >&2
        head -c 200 "$STDERR_TMP" >&2 ; echo >&2
        # Phase 55-01: auth-denied is a provider failure; record it.
        provider_circuit_record_result "$MILESTONE_TAG" "false"
        exit 4
    fi
    REPORT_BYTES="$(write_raw_report_payload "codex-exec: codex exit=$RC (generic failure)")"
    handle_report_write_failure || true
    write_live_state "error" 1 "false" "$REPORT_BYTES"
    append_jsonl 1 "false" "$REPORT_BYTES"
    append_narrative_event "codex_fallback" "error exit=$RC step=$STEP_TAG" "lastfail"
    echo "codex-exec: codex exit=$RC (generic failure)" >&2
    head -c 200 "$STDERR_TMP" >&2 ; echo >&2
    # Phase 55-01: generic provider failure; record it.
    provider_circuit_record_result "$MILESTONE_TAG" "false"
    exit 1
fi

# ── Report parse (D-03) — extract required fields + additive details ────────
# code-reviewer-v1 contract lines:
#   FINDINGS: ...
#   CRITICAL: ...
#   WARNINGS: ...
#   PASS_RATE: ...
#   ONE_LINER: ...
#   FINDINGS_DETAIL: ...   (optional, repeatable, preserved)
# Use the last FINDINGS-started contract block (codex may echo the prompt or
# retry in stdout). Preserve line text so citations and severity tags survive.
#
# rd-memo-v1 (R&D Board) takes a different route entirely: the payload is a
# YAML memo, so we slice from the last top-level `verdict:` to EOF, strip any
# markdown fences codex wrapped it in, and hand the result to
# rd-memo-schema.cjs for field/blind-ballot/superlative validation.
set +e
if [[ "$CONTRACT" == "rd-memo-v1" ]]; then
    parsed="$(awk '
        /^verdict:[[:space:]]/ { start = NR }
        { lines[NR] = $0 }
        END {
            if (start == 0) { print "CONTRACT_VIOLATION" > "/dev/stderr"; exit 6 }
            for (i = start; i <= NR; i++) {
                if (lines[i] ~ /^[[:space:]]*```/) continue
                print lines[i]
            }
        }
    ' "$STDOUT_TMP" 2>/dev/null)"
    awk_rc=$?

    if [[ $awk_rc -eq 0 && -n "$parsed" ]] && command -v node >/dev/null 2>&1; then
        schema_lib="$(dirname "$0")/lib/rd-memo-schema.cjs"
        if [[ -f "$schema_lib" ]]; then
            validation_errors="$(printf '%s\n' "$parsed" | node -e '
                const fs = require("fs");
                const schema = require(process.argv[1]);
                const body = fs.readFileSync(0, "utf8");
                const r = schema.validate(body, { enforceBlindBallot: true });
                if (!r.valid) process.stdout.write(r.errors.join("; "));
            ' "$schema_lib" 2>/dev/null || true)"
            if [[ -n "$validation_errors" ]]; then
                REPORT_BYTES="$(write_raw_report_payload "codex-exec: report contract violation")"
                handle_report_write_failure || true
                write_live_state "contract-violation" 6 "false" "$REPORT_BYTES"
                append_jsonl 6 "false" "$REPORT_BYTES"
                append_narrative_event "codex_fallback" "rd_memo_schema_fail step=$STEP_TAG" "lastfail"
                echo "codex-exec: rd-memo-v1 schema violation — $validation_errors" >&2
                provider_circuit_record_result "$MILESTONE_TAG" "false"
                exit 6
            fi
        fi
    fi
else
parsed="$(awk '
    /^FINDINGS:/ {
        in_block = 1
        findings = $0
        critical = ""
        warnings = ""
        pass_rate = ""
        one_liner = ""
        detail = ""
        next
    }
    /^CRITICAL:/  { if (in_block) critical  = $0; next }
    /^WARNINGS:/  { if (in_block) warnings  = $0; next }
    /^PASS_RATE:/ { if (in_block) pass_rate = $0; next }
    /^ONE_LINER:/ { if (in_block) one_liner = $0; next }
    /^FINDINGS_DETAIL:/ {
        if (in_block) {
            if (detail != "") detail = detail "\n"
            detail = detail $0
        }
        next
    }
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
        if (detail != "") print detail
    }
' "$STDOUT_TMP" 2>/dev/null)"
awk_rc=$?
fi

set +e
if [[ $awk_rc -ne 0 || -z "$parsed" ]]; then
    REPORT_BYTES="$(write_raw_report_payload "codex-exec: report contract violation")"
    handle_report_write_failure || true
    write_live_state "contract-violation" 6 "false" "$REPORT_BYTES"
    append_jsonl 6 "false" "$REPORT_BYTES"
    append_narrative_event "codex_fallback" "parse_failure step=$STEP_TAG" "lastfail"
    if [[ "$CONTRACT" == "rd-memo-v1" ]]; then
        echo "codex-exec: report contract violation — no top-level 'verdict:' line found in codex stdout (rd-memo-v1)" >&2
    else
        echo "codex-exec: report contract violation — one or more of FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER missing from codex stdout" >&2
    fi
    # Phase 55-01: contract-violation is a provider failure; record it.
    provider_circuit_record_result "$MILESTONE_TAG" "false"
    exit 6
fi

REPORT_BYTES="$(write_report_payload "$parsed")"
if ! handle_report_write_failure; then
    write_live_state "report-write-failure" "$REPORT_WRITE_FAILURE_EXIT" "false" "$REPORT_BYTES"
    append_jsonl "$REPORT_WRITE_FAILURE_EXIT" "false" "$REPORT_BYTES"
    append_narrative_event "codex_fallback" "report_write_failure step=$STEP_TAG" "lastfail"
    # Host-side persistence failure; provider returned valid output, so do not update provider circuit.
    exit "$REPORT_WRITE_FAILURE_EXIT"
fi

# ── JSONL append on success ─────────────────────────────────────────────────
write_live_state "ok" 0 "false" "$REPORT_BYTES"
append_jsonl 0 "false" "$REPORT_BYTES"
append_narrative_event "codex_completed" "ok step=$STEP_TAG dur=${DURATION_MS}ms bytes=$REPORT_BYTES" "latest"

echo "codex-exec: OK — $REPORT_OUT written (${REPORT_BYTES}B), codex took ${DURATION_MS}ms"
# Phase 55-01: success closes the circuit (resets consecutive_failures to 0).
provider_circuit_record_result "$MILESTONE_TAG" "true"
exit 0
