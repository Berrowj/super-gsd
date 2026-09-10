#!/usr/bin/env bash
# Shared source/installed worker transport. No one-shot or Windows-interoperability fallback.
SGSD_WORKER_WRAPPER_FINISHED=true

sgsd_codex_worker_nvm_bin() {
    [[ -d "$HOME/.nvm/versions/node" ]] || return 1
    find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -1
}

sgsd_codex_worker_absolute_executable() {
    local requested="$1" resolved directory name
    resolved="$(command -v -- "$requested" 2>/dev/null || true)"
    [[ -n "$resolved" && -f "$resolved" && -x "$resolved" ]] || return 1
    if [[ "$resolved" == /* ]]; then
        printf '%s\n' "$resolved"
        return 0
    fi
    directory="${resolved%/*}"
    name="${resolved##*/}"
    [[ "$directory" != "$resolved" ]] || directory="."
    directory="$(cd -- "$directory" 2>/dev/null && pwd -P)" || return 1
    printf '%s/%s\n' "$directory" "$name"
}

sgsd_codex_worker_is_interop() {
    local executable="$1" proc_version=""
    case "${executable,,}" in
        *.exe|*.cmd|*.bat) return 0 ;;
    esac
    if [[ -r /proc/version ]]; then IFS= read -r proc_version < /proc/version || true; fi
    [[ "${proc_version,,}" == *microsoft* && "$executable" == /mnt/* ]]
}

# Optional operator-approved OS-user pin. Return 1 for absent, 2 for invalid.
# Read at most 4097 bytes with Bash builtins, never source/eval/probe the contents.
sgsd_codex_worker_runtime_pin() {
    local pin_file="$HOME/.config/sgsd/codex-command" pin_value="" ancestor
    local LC_ALL=C
    [[ -e "$pin_file" || -L "$pin_file" ]] || return 1
    ancestor="$pin_file"
    while [[ "$ancestor" != / ]]; do
        [[ ! -L "$ancestor" ]] || return 2
        ancestor="${ancestor%/*}"
        [[ -n "$ancestor" ]] || ancestor=/
    done
    [[ -f "$pin_file" && -r "$pin_file" ]] || return 2
    # Success means a NUL delimiter or the byte limit was reached: both refuse.
    # EOF is the only accepted read termination. Redirect errors before opening.
    if IFS= read -r -d '' -n 4097 pin_value 2>/dev/null < "$pin_file"; then return 2; fi
    pin_value="${pin_value%$'\n'}"
    [[ "$pin_value" == /* && "$pin_value" != *[[:cntrl:]]* ]] || return 2
    [[ -f "$pin_value" && -x "$pin_value" ]] || return 2
    ! sgsd_codex_worker_is_interop "$pin_value" || return 2
    printf '%s' "$pin_value"
}

sgsd_codex_worker_invalid_pin() {
    CODEX_COMMAND="" CODEX_BIN=""
    export SGSD_CODEX_SELECTION_STATUS=invalid_pin
    echo "SGSD_WORKER: invalid configured Codex runtime pin" >&2
    return 3
}

# Pin the explicitly selected, operator-pinned, or caller-visible native Codex
# before adding user-local Node paths. The
# adapter reads its selector from the environment, so exporting the absolute
# result is part of selection rather than a later availability check.
sgsd_codex_worker_bootstrap() {
    local argument expect_value=false self_test=false dry_run=false offline_only=false explicit=false
    local selected candidate="" incoming="" nvm_bin="" configured_pin=false pin_status
    for argument in "$@"; do
        if [[ "$expect_value" == true ]]; then expect_value=false; continue; fi
        case "$argument" in
            --help|-h) return 0 ;;
            --self-test) self_test=true ;;
            --self-test-exit-priority) offline_only=true ;;
            --dry-run) dry_run=true ;;
            --prompt-file|--report-out|--timeout|--project|--workspace|--phase|--plan|--step|--profile|--owner|--files|--contract|--model|--reasoning|--timeout-tier|--milestone|--patch-fallback-files)
                expect_value=true ;;
        esac
    done

    if [[ -n "${SGSD_CODEX_APP_SERVER_COMMAND:-}" ]]; then
        selected="$SGSD_CODEX_APP_SERVER_COMMAND"
        explicit=true
    elif [[ -n "${SGSD_CODEX_COMMAND:-}" ]]; then
        selected="$SGSD_CODEX_COMMAND"
        explicit=true
    else
        selected="codex"
        if [[ "$offline_only" != true ]]; then
            if selected="$(sgsd_codex_worker_runtime_pin)"; then
                explicit=true
                configured_pin=true
            else
                pin_status=$?
                if [[ "$pin_status" != 1 ]]; then sgsd_codex_worker_invalid_pin; return 3; fi
                selected="codex"
            fi
        fi
    fi
    CODEX_COMMAND="$selected"
    SGSD_CODEX_SELECTION_STATUS="offline"

    if [[ "$offline_only" != true ]]; then
        incoming="$(sgsd_codex_worker_absolute_executable "$selected" || true)"
        if [[ -z "$incoming" ]]; then
            SGSD_CODEX_SELECTION_STATUS="missing"
        elif sgsd_codex_worker_is_interop "$incoming"; then
            SGSD_CODEX_SELECTION_STATUS="interop"
        else
            candidate="$incoming"
            SGSD_CODEX_SELECTION_STATUS="ready"
        fi
        if [[ -z "$candidate" && "$configured_pin" == true ]]; then
            sgsd_codex_worker_invalid_pin
            return 3
        fi
        if [[ -z "$candidate" && "$explicit" == true ]]; then
            if [[ "$self_test" != true ]]; then
                export SGSD_CODEX_SELECTION_STATUS
                if [[ "$SGSD_CODEX_SELECTION_STATUS" == "interop" ]]; then
                    echo "SGSD_WORKER: unsupported Windows interop; use native Node and Codex in this shell" >&2
                else
                    echo "SGSD_WORKER: '$selected' CLI not found on incoming PATH" >&2
                fi
                return 3
            fi
        elif [[ -z "$candidate" ]]; then
            candidate="$(sgsd_codex_worker_absolute_executable "$HOME/.local/bin/codex" || true)"
            [[ -z "$candidate" ]] || ! sgsd_codex_worker_is_interop "$candidate" || candidate=""
            nvm_bin="$(sgsd_codex_worker_nvm_bin || true)"
            if [[ -z "$candidate" && -n "$nvm_bin" ]]; then
                candidate="$(sgsd_codex_worker_absolute_executable "$nvm_bin/codex" || true)"
                [[ -z "$candidate" ]] || ! sgsd_codex_worker_is_interop "$candidate" || candidate=""
            fi
            if [[ -n "$candidate" ]]; then SGSD_CODEX_SELECTION_STATUS="ready"; fi
            if [[ -z "$candidate" && "$dry_run" != true && "$self_test" != true ]]; then
                export SGSD_CODEX_SELECTION_STATUS
                if [[ "$SGSD_CODEX_SELECTION_STATUS" == "interop" ]]; then
                    echo "SGSD_WORKER: unsupported Windows interop Codex shim; install native Codex in WSL" >&2
                else
                    echo "SGSD_WORKER: 'codex' CLI not found on incoming PATH or native fallback locations" >&2
                fi
                return 3
            fi
        fi
        if [[ -n "$candidate" ]]; then
            CODEX_COMMAND="$candidate"
            CODEX_BIN="$candidate"
            export SGSD_CODEX_APP_SERVER_COMMAND="$candidate"
        fi
    fi
    export SGSD_CODEX_SELECTION_STATUS

    if [[ -d "$HOME/.local/bin" ]]; then PATH="$HOME/.local/bin:$PATH"; fi
    [[ -n "$nvm_bin" ]] || nvm_bin="$(sgsd_codex_worker_nvm_bin || true)"
    if [[ -n "$nvm_bin" ]]; then
        SGSD_NODE_BIN="$nvm_bin"
        PATH="$SGSD_NODE_BIN:$PATH"
    fi
    export PATH
}

sgsd_codex_worker_prepare() {
    local project="$1" workspace="$2" model="$3" reasoning="$4" deadline="$5" role="$6"
    local helper_dir node_platform
    helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
    SGSD_CODEX_WORKER_RUN="$(cd "$helper_dir/../.." && pwd -P)/tools/codex-worker/run.cjs"
    if [[ ! -f "$SGSD_CODEX_WORKER_RUN" ]] || ! command -v node >/dev/null 2>&1; then
        echo "SGSD_WORKER: runtime unavailable; install the complete SGSD worker runtime and native Node" >&2
        return 3
    fi
    case "${SGSD_CODEX_FORCE_LAUNCHER:-}" in
        cmd) echo "SGSD_WORKER: unsupported Windows interop; use native Node and Codex in this shell" >&2; return 3 ;;
        direct|"") ;;
        *) echo "SGSD_WORKER: invalid SGSD_CODEX_FORCE_LAUNCHER" >&2; return 3 ;;
    esac
    CODEX_COMMAND="${SGSD_CODEX_APP_SERVER_COMMAND:-${SGSD_CODEX_COMMAND:-codex}}"
    CODEX_LAUNCHER="direct"
    CODEX_PROJECT="$project"
    CODEX_CD="$workspace"
    CODEX_BIN="$(sgsd_codex_worker_absolute_executable "$CODEX_COMMAND" || true)"
    node_platform="$(node -p 'process.platform' 2>/dev/null)"
    # Crossing cmd.exe/Windows Node loses POSIX cwd, stdio and private mailbox
    # semantics. A native CLI earlier on PATH is used without an interop shim.
    if [[ "$node_platform" == "win32" ]] || { [[ -n "$CODEX_BIN" ]] && sgsd_codex_worker_is_interop "$CODEX_BIN"; }; then
        echo "SGSD_WORKER: unsupported Windows interop; use native Node and Codex in this shell" >&2
        return 3
    fi
    if [[ -z "$CODEX_BIN" && "${DRY_RUN:-false}" != true ]]; then
        echo "SGSD_WORKER: '$CODEX_COMMAND' CLI not found on PATH" >&2
        return 3
    fi
    export SGSD_WORKER_OWNER="${SGSD_WORKER_OWNER:-orchestrator}"
    export SGSD_WORKER_ROLE="$role"
    export SGSD_WORKER_PHASE="${PHASE_TAG:-${SGSD_WORKER_PHASE:-}}"
    export SGSD_WORKER_PLAN="${PLAN_TAG:-${SGSD_WORKER_PLAN:-}}"
    export SGSD_WORKER_STEP="${STEP_TAG:-${SGSD_WORKER_STEP:-}}"
    SGSD_CODEX_WORKER_WATCHDOG_SECONDS="$(node -e 'const n=Number(process.argv[1]); if (!Number.isInteger(n)||n<1||n>86400) process.exit(2); process.stdout.write(String(n+3));' "$deadline")" || {
        echo "SGSD_WORKER: timeout must be an integer from 1 to 86400 seconds" >&2
        return 2
    }
    SGSD_CODEX_WORKER_ARGS=(node "$SGSD_CODEX_WORKER_RUN" --project "$project" --workspace "$workspace"
        --model "$model" --reasoning "$reasoning" --timeout "$deadline"
        --owner "$SGSD_WORKER_OWNER" --role "$role" --sandbox danger-full-access --ask-for-approval never)
}

sgsd_codex_worker_run() {
    local prompt_file="$1" worker_exit
    sgsd_atlas_codex_args
    # Open the prompt inside the watchdog too: a FIFO can block before Node
    # starts. The adapter owns the normal deadline; allow three seconds for its
    # cleanup, then terminate this process group (KILL after two more seconds).
    # Keep prompt paths and all worker arguments as positional argv, never code.
    timeout --kill-after=2s "${SGSD_CODEX_WORKER_WATCHDOG_SECONDS}s" \
        bash -c 'exec "${@:2}" < "$1"' sgsd-codex-worker "$prompt_file" \
        "${SGSD_CODEX_WORKER_ARGS[@]}" "${SGSD_ATLAS_CODEX_ARGS[@]}"
    worker_exit=$?
    [[ "$worker_exit" -ne 137 ]] || worker_exit=124
    return "$worker_exit"
}

sgsd_codex_worker_preview() {
    printf '%q ' "${SGSD_CODEX_WORKER_ARGS[@]}"
}

sgsd_codex_worker_begin() {
    SGSD_WORKER_WRAPPER_ID="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')" || return 3
    export SGSD_WORKER_WRAPPER_ID
    SGSD_WORKER_WRAPPER_FINISHED=false
}

# Completion is separate from the core turn status: report validation and patch
# application can fail after a model turn completes. A hash binds recovery to
# this exact report even if a caller later reuses --report-out.
sgsd_codex_worker_finish() {
    local wrapper_exit="$1"
    [[ -n "${SGSD_WORKER_WRAPPER_ID:-}" && "${SGSD_WORKER_WRAPPER_FINISHED:-false}" != true ]] || return 0
    node - "$SGSD_CODEX_WORKER_RUN" "$PROJECT" "$REPORT_OUT" "$SGSD_WORKER_WRAPPER_ID" "$wrapper_exit" <<'NODE'
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
try {
    const [runtime, project, report, attempt, code] = process.argv.slice(2);
    const mailbox = require(path.join(path.dirname(runtime), 'mailbox.cjs'));
    const { resolveContainedPath } = require(path.resolve(path.dirname(runtime), '../../scripts/lib/sgsd-state.cjs'));
    const root = mailbox.projectRoot(project), exit = Number(code);
    const records = mailbox.list(root).filter(row => row.wrapper_attempt_id === attempt);
    if (records.length !== 1) throw new Error('wrapper_worker_binding_unavailable');
    const record = records[0];
    if (exit === 0 && record.status !== 'completed') throw new Error('wrapper_turn_not_completed');
    const reportPath = path.resolve(report);
    let body = null;
    try {
        if (!fs.statSync(reportPath).isFile() || fs.statSync(reportPath).size > 4 * 1024 * 1024) throw new Error('wrapper_report_unavailable');
        body = fs.readFileSync(reportPath);
    } catch (error) { if (exit === 0) throw error; }
    const receipt = { schema_version: 1, wrapper_attempt_id: attempt, worker_id: record.worker_id,
        project: root, thread_id: record.thread_id, turn_id: record.turn_id, exit_code: exit,
        report_path: reportPath, sha256: body ? crypto.createHash('sha256').update(body).digest('hex') : null,
        bytes: body ? body.length : null, finished_at: new Date().toISOString() };
    const file = resolveContainedPath(root, path.join('.planning/worker-sessions', record.worker_id, 'wrapper-result.json'));
    if (!file) throw new Error('wrapper_receipt_escapes_project');
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o600 });
        // Every attempt has one immutable result. Never replace an existing receipt.
        fs.linkSync(temporary, file);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
} catch {
    process.stderr.write('SGSD_WORKER: wrapper receipt unavailable; do not infer wrapper success from the core turn\n');
    process.exitCode = 9;
}
NODE
    local receipt_exit=$?
    if [[ "$receipt_exit" -eq 0 ]]; then SGSD_WORKER_WRAPPER_FINISHED=true; fi
    return "$receipt_exit"
}
