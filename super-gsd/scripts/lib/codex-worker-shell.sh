#!/usr/bin/env bash
# Shared source/installed worker transport. No one-shot or Windows-interoperability fallback.
SGSD_WORKER_WRAPPER_FINISHED=true

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
    CODEX_BIN="$(command -v "$CODEX_COMMAND" 2>/dev/null || true)"
    node_platform="$(node -p 'process.platform' 2>/dev/null)"
    # Crossing cmd.exe/Windows Node loses POSIX cwd, stdio and private mailbox
    # semantics. A native CLI earlier on PATH is used without an interop shim.
    if [[ "$node_platform" == "win32" || "$CODEX_BIN" == *.exe || "$CODEX_BIN" == *.cmd || "$CODEX_BIN" == *.bat ]]; then
        echo "SGSD_WORKER: unsupported Windows interop; use native Node and Codex in this shell" >&2
        return 3
    fi
    if [[ -r /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null && [[ "$CODEX_BIN" == /mnt/* ]]; then
        echo "SGSD_WORKER: unsupported Windows interop Codex shim; install native Codex in WSL" >&2
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
