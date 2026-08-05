#!/usr/bin/env bash
# Shared Codex CLI profile resolver glue for SGSD Bash wrappers.
# Consumes resolver KEY=VALUE output through whitelisted assignments only.

sgsd_codex_profile_json_escape() {
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

sgsd_codex_profile_find_root() {
    local start="${1:-$(pwd -P)}"
    local d="$start"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" ]]; then echo "$d"; return 0; fi
        d="$(dirname "$d")"
    done
    return 1
}

sgsd_codex_profile_log_path() {
    local project="${1:-}"
    if [[ -n "${SGSD_CODEX_PROFILE_LOG:-}" ]]; then
        echo "$SGSD_CODEX_PROFILE_LOG"
        return 0
    fi
    if [[ -z "$project" ]]; then
        project="$(sgsd_codex_profile_find_root "$(pwd -P)" 2>/dev/null || pwd -P)"
    fi
    echo "$project/.planning/metrics/codex-profile-resolution-log.jsonl"
}

sgsd_codex_profile_append_fallback_log() {
    local project="$1" requested="$2" resolved="$3" reason="$4" registry_path="$5"
    local log ts requested_json resolved_json reason_json registry_json
    log="$(sgsd_codex_profile_log_path "$project")"
    ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    requested_json="$(sgsd_codex_profile_json_escape "$requested")"
    resolved_json="$(sgsd_codex_profile_json_escape "$resolved")"
    reason_json="$(sgsd_codex_profile_json_escape "$reason")"
    registry_json="$(sgsd_codex_profile_json_escape "$registry_path")"
    mkdir -p "$(dirname "$log")" 2>/dev/null || true
    printf '{"ts":"%s","subsystem":"codex-profile-resolution","action":"resolve-cli","status":"fallback","reason":"%s","requested_profile":"%s","resolved_profile":"%s","registry_path":"%s","source":"shell-builtin"}\n' \
        "$ts" "$reason_json" "$requested_json" "$resolved_json" "$registry_json" >> "$log" 2>/dev/null || true
}

sgsd_codex_profile_builtin_name() {
    local requested="$1" default_profile="$2"
    [[ -z "$requested" ]] && requested="$default_profile"
    case "$requested" in
        executor|review|triage) echo "$requested" ;;
        codex.review.native) echo "review" ;;
        *) echo "review" ;;
    esac
}

sgsd_codex_profile_apply_builtin() {
    local requested="$1" default_profile="$2" reason="$3"
    SGSD_CODEX_RESOLVED_PROFILE="$(sgsd_codex_profile_builtin_name "$requested" "$default_profile")"
    SGSD_CODEX_PROFILE_REQUESTED="$requested"
    SGSD_CODEX_PROFILE_STATUS="fallback"
    SGSD_CODEX_PROFILE_REASON="$reason"
    SGSD_CODEX_PROFILE_SOURCE="shell-builtin"
    case "$SGSD_CODEX_RESOLVED_PROFILE" in
        executor)
            SGSD_CODEX_PROFILE_MODEL="gpt-5.5"
            SGSD_CODEX_PROFILE_REASONING_EFFORT="xhigh"
            SGSD_CODEX_PROFILE_SANDBOX="workspace-write"
            SGSD_CODEX_PROFILE_EPHEMERAL="false"
            SGSD_CODEX_PROFILE_APPROVAL="full-auto"
            SGSD_CODEX_PROFILE_FULL_AUTO="true"
            ;;
        review)
            SGSD_CODEX_PROFILE_MODEL="gpt-5.5"
            SGSD_CODEX_PROFILE_REASONING_EFFORT="xhigh"
            SGSD_CODEX_PROFILE_SANDBOX="read-only"
            SGSD_CODEX_PROFILE_EPHEMERAL="true"
            SGSD_CODEX_PROFILE_APPROVAL="never"
            SGSD_CODEX_PROFILE_FULL_AUTO="false"
            ;;
        triage)
            SGSD_CODEX_PROFILE_MODEL="gpt-5.5"
            SGSD_CODEX_PROFILE_REASONING_EFFORT="xhigh"
            SGSD_CODEX_PROFILE_SANDBOX="read-only"
            SGSD_CODEX_PROFILE_EPHEMERAL="false"
            SGSD_CODEX_PROFILE_APPROVAL="never"
            SGSD_CODEX_PROFILE_FULL_AUTO="false"
            ;;
    esac
}

sgsd_codex_profile_resolver_path() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
    echo "$(cd "$script_dir/../.." && pwd -P)/tools/codex-pro/profile-resolver.cjs"
}

sgsd_codex_load_cli_profile() {
    local requested="$1" default_profile="$2" project="${3:-}"
    local resolver resolver_output resolver_rc saw_required had_errexit

    SGSD_CODEX_PROFILE_REQUESTED=""
    SGSD_CODEX_RESOLVED_PROFILE=""
    SGSD_CODEX_PROFILE_STATUS=""
    SGSD_CODEX_PROFILE_REASON=""
    SGSD_CODEX_PROFILE_SOURCE=""
    SGSD_CODEX_PROFILE_MODEL=""
    SGSD_CODEX_PROFILE_REASONING_EFFORT=""
    SGSD_CODEX_PROFILE_SANDBOX=""
    SGSD_CODEX_PROFILE_EPHEMERAL=""
    SGSD_CODEX_PROFILE_APPROVAL=""
    SGSD_CODEX_PROFILE_FULL_AUTO=""

    resolver="$(sgsd_codex_profile_resolver_path)"
    local -a registry_arg=()
    if [[ -n "${SGSD_CODEX_PROFILES_REGISTRY:-}" ]]; then
        registry_arg=(--registry "$SGSD_CODEX_PROFILES_REGISTRY")
    fi

    if [[ -f "$resolver" ]] && command -v node >/dev/null 2>&1; then
        had_errexit=false
        case "$-" in *e*) had_errexit=true ;; esac
        set +e
        resolver_output="$(node "$resolver" --resolve-cli "$requested" --default-cli "$default_profile" "${registry_arg[@]}" 2>/dev/null)"
        resolver_rc=$?
        if [[ "$had_errexit" == true ]]; then set -e; else set +e; fi
        if [[ $resolver_rc -eq 0 ]]; then
            while IFS='=' read -r key val; do
                case "$key" in
                    CODEX_PROFILE_REQUESTED) SGSD_CODEX_PROFILE_REQUESTED="$val" ;;
                    CODEX_PROFILE) SGSD_CODEX_RESOLVED_PROFILE="$val" ;;
                    CODEX_PROFILE_STATUS) SGSD_CODEX_PROFILE_STATUS="$val" ;;
                    CODEX_PROFILE_REASON) SGSD_CODEX_PROFILE_REASON="$val" ;;
                    CODEX_PROFILE_SOURCE) SGSD_CODEX_PROFILE_SOURCE="$val" ;;
                    CODEX_MODEL) SGSD_CODEX_PROFILE_MODEL="$val" ;;
                    CODEX_REASONING_EFFORT) SGSD_CODEX_PROFILE_REASONING_EFFORT="$val" ;;
                    CODEX_SANDBOX) SGSD_CODEX_PROFILE_SANDBOX="$val" ;;
                    CODEX_EPHEMERAL) SGSD_CODEX_PROFILE_EPHEMERAL="$val" ;;
                    CODEX_APPROVAL) SGSD_CODEX_PROFILE_APPROVAL="$val" ;;
                    CODEX_FULL_AUTO) SGSD_CODEX_PROFILE_FULL_AUTO="$val" ;;
                esac
            done <<< "$resolver_output"
            saw_required=true
            [[ -z "$SGSD_CODEX_RESOLVED_PROFILE" ]] && saw_required=false
            [[ -z "$SGSD_CODEX_PROFILE_MODEL" ]] && saw_required=false
            [[ -z "$SGSD_CODEX_PROFILE_REASONING_EFFORT" ]] && saw_required=false
            [[ -z "$SGSD_CODEX_PROFILE_SANDBOX" ]] && saw_required=false
            [[ -z "$SGSD_CODEX_PROFILE_EPHEMERAL" ]] && saw_required=false
            [[ -z "$SGSD_CODEX_PROFILE_APPROVAL" ]] && saw_required=false
            if [[ "$saw_required" == true ]]; then
                return 0
            fi
        fi
    fi

    sgsd_codex_profile_apply_builtin "$requested" "$default_profile" "resolver_unavailable"
    sgsd_codex_profile_append_fallback_log "$project" "$requested" "$SGSD_CODEX_RESOLVED_PROFILE" "resolver_unavailable" "${SGSD_CODEX_PROFILES_REGISTRY:-}"
    return 0
}