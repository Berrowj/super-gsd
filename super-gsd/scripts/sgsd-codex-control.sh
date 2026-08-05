#!/usr/bin/env bash
# Operator control surface for SGSD Codex CLI profiles.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
RESOLVER="$REPO_ROOT/super-gsd/tools/codex-pro/profile-resolver.cjs"
REGISTRY_PATH="${SGSD_CODEX_PROFILES_REGISTRY:-$REPO_ROOT/super-gsd/registry/codex-profiles.yaml}"
SELF_TEST=false
SGSD_CODEX_CONTROL_CONFIRM_PHRASE=""

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

usage() {
    cat <<'EOF'
Usage:
  sgsd-codex-control.sh show [--registry <path>]
  sgsd-codex-control.sh set <profile> <field> <value> [--registry <path>]
  sgsd-codex-control.sh --self-test

Guarded mutations require an interactive terminal and exact confirmation:
  CONFIRM SGSD CODEX PROFILE <profile> <field> <value>
EOF
}

log_control() {
    local action="$1" status="$2" profile="${3:-}" field="${4:-}" value="${5:-}" reason="${6:-}"
    local payload
    payload="{\"control_action\":\"$(json_escape "$action")\",\"status\":\"$(json_escape "$status")\",\"profile\":\"$(json_escape "$profile")\",\"field\":\"$(json_escape "$field")\",\"value\":\"$(json_escape "$value")\",\"reason\":\"$(json_escape "$reason")\",\"registry_path\":\"$(json_escape "$REGISTRY_PATH")\"}"
    node "$RESOLVER" --log-cli-control "$payload" >/dev/null 2>&1 || true
}

fingerprint() {
    if [[ -f "$1" ]]; then
        sha256sum "$1" | awk '{ print $1 }'
    else
        echo "missing"
    fi
}

is_guarded_field() {
    local field="$1" value="$2"
    if [[ "$field" == "sandbox" && "$value" == "danger-full-access" ]]; then
        return 0
    fi
    case "$field" in
        trust|trust_required|hook_trust|hooks_required|approval|*trust*|*approval*|*hook*) return 0 ;;
    esac
    return 1
}

require_confirmation_if_guarded() {
    local profile="$1" field="$2" value="$3"
    local phrase typed
    if ! is_guarded_field "$field" "$value"; then
        return 0
    fi
    phrase="CONFIRM SGSD CODEX PROFILE $profile $field $value"
    SGSD_CODEX_CONTROL_CONFIRM_PHRASE=""
    if [[ ! -t 0 || ! -t 1 ]]; then
        echo "sgsd-codex-control: refusing guarded mutation; run in an interactive terminal and type exactly: $phrase" >&2
        log_control "refuse" "refuse" "$profile" "$field" "$value" "non_tty_guarded_mutation"
        return 2
    fi
    printf 'Type exactly: %s\n> ' "$phrase"
    if ! IFS= read -r typed; then
        echo "sgsd-codex-control: confirmation input closed" >&2
        log_control "refuse" "refuse" "$profile" "$field" "$value" "confirmation_input_closed"
        return 2
    fi
    if [[ "$typed" != "$phrase" ]]; then
        echo "sgsd-codex-control: confirmation mismatch" >&2
        log_control "refuse" "refuse" "$profile" "$field" "$value" "confirmation_mismatch"
        return 2
    fi
    SGSD_CODEX_CONTROL_CONFIRM_PHRASE="$phrase"
    return 0
}

run_show() {
    node "$RESOLVER" --show-cli --registry "$REGISTRY_PATH"
    local rc=$?
    if [[ $rc -eq 0 ]]; then
        log_control "show" "show" "" "" "" "ok"
    else
        log_control "show" "error" "" "" "" "resolver_failed"
    fi
    return $rc
}

run_set() {
    local profile="$1" field="$2" value="$3"
    require_confirmation_if_guarded "$profile" "$field" "$value" || return $?
    if [[ -n "$SGSD_CODEX_CONTROL_CONFIRM_PHRASE" ]]; then
        node "$RESOLVER" --set-cli "$profile" "$field" "$value" --confirm "$SGSD_CODEX_CONTROL_CONFIRM_PHRASE" --registry "$REGISTRY_PATH"
    else
        node "$RESOLVER" --set-cli "$profile" "$field" "$value" --registry "$REGISTRY_PATH"
    fi
}

run_self_test() {
    local tmp st_registry st_project st_prompt st_report canonical_before canonical_after before after out
    tmp="$(mktemp -d)"
    st_registry="$tmp/codex-profiles.yaml"
    st_project="$tmp/project"
    st_prompt="$tmp/prompt.txt"
    st_report="$tmp/report.txt"
    mkdir -p "$st_project/.planning/metrics"
    cp "$REPO_ROOT/super-gsd/registry/codex-profiles.yaml" "$st_registry"
    printf 'triage prompt\n' > "$st_prompt"
    canonical_before="$(fingerprint "$REPO_ROOT/super-gsd/registry/codex-profiles.yaml")"

    SGSD_CODEX_PROFILES_REGISTRY="$st_registry" SGSD_CODEX_PROFILE_LOG="$tmp/codex-profile-resolution-log.jsonl" "$0" show >/dev/null
    SGSD_CODEX_PROFILES_REGISTRY="$st_registry" SGSD_CODEX_PROFILE_LOG="$tmp/codex-profile-resolution-log.jsonl" "$0" set triage ephemeral true >/dev/null
    out="$(SGSD_CODEX_PROFILES_REGISTRY="$st_registry" SGSD_CODEX_FORCE_LAUNCHER=direct "$SCRIPT_DIR/codex-exec.sh" --dry-run --profile triage --prompt-file "$st_prompt" --report-out "$st_report" --project "$st_project" --timeout 30)"
    if [[ "$out" != *'--ephemeral'* ]]; then
        echo "sgsd-codex-control self-test: triage ephemeral=true did not reach dry-run" >&2
        rm -rf "$tmp"
        return 1
    fi

    SGSD_CODEX_PROFILES_REGISTRY="$st_registry" SGSD_CODEX_PROFILE_LOG="$tmp/codex-profile-resolution-log.jsonl" "$0" set triage ephemeral false >/dev/null
    out="$(SGSD_CODEX_PROFILES_REGISTRY="$st_registry" SGSD_CODEX_FORCE_LAUNCHER=direct "$SCRIPT_DIR/codex-exec.sh" --dry-run --profile triage --prompt-file "$st_prompt" --report-out "$st_report" --project "$st_project" --timeout 30)"
    if [[ "$out" == *'--ephemeral'* ]]; then
        echo "sgsd-codex-control self-test: triage ephemeral=false still emitted --ephemeral" >&2
        rm -rf "$tmp"
        return 1
    fi

    before="$(fingerprint "$st_registry")"
    if printf '' | SGSD_CODEX_PROFILES_REGISTRY="$st_registry" SGSD_CODEX_PROFILE_LOG="$tmp/codex-profile-resolution-log.jsonl" "$0" set triage sandbox danger-full-access >/dev/null 2>/dev/null; then
        echo "sgsd-codex-control self-test: non-TTY danger mutation succeeded" >&2
        rm -rf "$tmp"
        return 1
    fi
    after="$(fingerprint "$st_registry")"
    if [[ "$before" != "$after" ]]; then
        echo "sgsd-codex-control self-test: danger refusal mutated registry" >&2
        rm -rf "$tmp"
        return 1
    fi

    if printf '' | SGSD_CODEX_PROFILES_REGISTRY="$st_registry" SGSD_CODEX_PROFILE_LOG="$tmp/codex-profile-resolution-log.jsonl" "$0" set triage trust_required true >/dev/null 2>/dev/null; then
        echo "sgsd-codex-control self-test: non-TTY trust mutation succeeded" >&2
        rm -rf "$tmp"
        return 1
    fi
    after="$(fingerprint "$st_registry")"
    if [[ "$before" != "$after" ]]; then
        echo "sgsd-codex-control self-test: trust refusal mutated registry" >&2
        rm -rf "$tmp"
        return 1
    fi

    canonical_after="$(fingerprint "$REPO_ROOT/super-gsd/registry/codex-profiles.yaml")"
    if [[ "$canonical_before" != "$canonical_after" ]]; then
        echo "sgsd-codex-control self-test: canonical registry changed" >&2
        rm -rf "$tmp"
        return 1
    fi
    if ! grep -q '"status":"refuse"' "$tmp/codex-profile-resolution-log.jsonl" 2>/dev/null; then
        echo "sgsd-codex-control self-test: refusal log row missing" >&2
        rm -rf "$tmp"
        return 1
    fi
    rm -rf "$tmp"
    echo "sgsd-codex-control self-test: PASS"
    return 0
}

POSITIONAL=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --registry) REGISTRY_PATH="$2"; shift 2 ;;
        --self-test) SELF_TEST=true; shift ;;
        --help|-h) usage; exit 0 ;;
        *) POSITIONAL+=("$1"); shift ;;
    esac
done
set -- "${POSITIONAL[@]}"
if [[ "$SELF_TEST" == true ]]; then
    run_self_test
    exit $?
fi

cmd="${1:-}"
case "$cmd" in
    show)
        shift
        run_show
        ;;
    set)
        if [[ $# -ne 4 ]]; then usage >&2; exit 1; fi
        run_set "$2" "$3" "$4"
        ;;
    *)
        usage >&2
        exit 1
        ;;
esac