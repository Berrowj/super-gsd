#!/usr/bin/env bash
# Scoped attachment at an SGSD-owned process launch. Provider output is never evaluated.
sgsd_atlas_attach() {
    local role="${1:-orchestrator}" provider="${2:-anthropic}" project="${3:-$PWD}"
    local base runtime output
    SGSD_ATLAS_CODEX_ARGS=()
    # Clear the previous project's endpoints even when node/bootstrap is unavailable.
    local key
    for key in ${!OTEL_@}; do unset "$key"; done
    unset BETA_TRACING_ENDPOINT CLAUDE_CODE_ENHANCED_TELEMETRY_BETA ENABLE_ENHANCED_TELEMETRY_BETA
    export CLAUDE_CODE_ENABLE_TELEMETRY=0 OTEL_LOGS_EXPORTER=none OTEL_METRICS_EXPORTER=none OTEL_TRACES_EXPORTER=none
    export SGSD_RUN_ID='' SGSD_ATLAS_STATE_DIR='' SGSD_ATLAS_ENDPOINT='' SGSD_ATLAS_RUN_ENDPOINT='' SGSD_ATLAS_PROJECT_ID=''
    export SGSD_ATLAS_CODEX_EXPORTER=""
    base="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
    runtime="$base/tools/telemetry-atlas/global.cjs"
    [[ -f "$runtime" ]] || runtime="$HOME/.claude/tools/telemetry-atlas/global.cjs"
    SGSD_ATLAS_RUNTIME="$runtime"
    if [[ ! -f "$runtime" ]] || ! command -v node >/dev/null 2>&1; then
        echo '[Atlas] capture unavailable: runtime missing' >&2
        return 0
    fi
    output="$(node "$runtime" prepare --project-dir "$project" --role "$role" --provider "$provider" --format shell)" || return 0
    # Output is generated from allowlisted keys and shell-quoted local registrations.
    if [[ "$output" == *'export CLAUDE_CODE_ENABLE_TELEMETRY='* ]]; then eval "$output"; fi
    export -f sgsd_atlas_codex_args
    return 0
}
sgsd_atlas_codex_args() {
    SGSD_ATLAS_CODEX_ARGS=(-c "${SGSD_ATLAS_CODEX_EXPORTER:-otel.exporter=\"none\"}" -c otel.log_user_prompt=false -c 'otel.trace_exporter="none"' -c 'otel.metrics_exporter="none"')
}
sgsd_atlas_finish() {
    if [[ -n "${SGSD_RUN_ID:-}" && -f "${SGSD_ATLAS_RUNTIME:-}" ]]; then
        node "$SGSD_ATLAS_RUNTIME" finish --run-id "$SGSD_RUN_ID" >/dev/null 2>&1 || true
    fi
    return 0
}
export -f sgsd_atlas_codex_args
