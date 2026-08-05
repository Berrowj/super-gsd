# Complete the incomplete trap guard — codex-executor.sh line 61-63

The previous patch added `export SGSD_CODEX_EXECUTOR_CREATOR_PID=$$` in the
re-exec block but did NOT use it. The EXIT trap at lines 61-63 STILL deletes the
shared temp copy unconditionally, so self-test child dry-run invocations
(which inherit the exported temp-copy path) still delete the running parent's
script → "cmd dry-run parity: FAIL, actual: (empty)".

Current lines 61-63:
    if [[ -n "${SGSD_CODEX_EXECUTOR_TEMP_COPY:-}" ]]; then
        trap 'rm -f "$SGSD_CODEX_EXECUTOR_TEMP_COPY" 2>/dev/null || true' EXIT
    fi

REQUIRED: gate the trap on the creating PID so ONLY the process that created the
temp copy removes it. Fix:
    if [[ -n "${SGSD_CODEX_EXECUTOR_TEMP_COPY:-}" && "$$" == "${SGSD_CODEX_EXECUTOR_CREATOR_PID:-}" ]]; then
        trap 'rm -f "$SGSD_CODEX_EXECUTOR_TEMP_COPY" 2>/dev/null || true' EXIT
    fi

That is the ONLY change. After it, `bash super-gsd/scripts/codex-executor.sh
--self-test` must print BOTH "direct dry-run parity: PASS" and "cmd dry-run
parity: PASS" and exit 0.

Output a single unified git diff touching ONLY super-gsd/scripts/codex-executor.sh.
