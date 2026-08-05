# Surgical one-line fix — codex-executor.sh self-test temp-copy race

DIAGNOSIS (confirmed by orchestrator): the WARNING-1 self-modification re-exec
guard at the top of super-gsd/scripts/codex-executor.sh exports
SGSD_CODEX_EXECUTOR_TEMP_COPY and sets `trap 'rm -f "$SGSD_CODEX_EXECUTOR_TEMP_COPY"' EXIT`.
Because the var is EXPORTED, every child subprocess inherits the SAME temp-copy
path. In `--self-test`, the script invokes `"$0" --dry-run` twice (direct then
cmd). When the first (direct) child exits, its inherited EXIT trap deletes the
shared temp-copy file — which IS the running self-test's `$0`. The second (cmd)
invocation then executes a deleted file → empty output → "cmd dry-run parity:
FAIL, actual: (empty)". Standalone (non-self-test) invocation is unaffected and
verified working.

REQUIRED FIX (minimal, surgical): ensure ONLY the process that created the temp
copy removes it. Two acceptable approaches — pick the smaller:
(a) do NOT export SGSD_CODEX_EXECUTOR_TEMP_COPY (keep it a plain shell var so
    child subprocesses don't inherit it), and keep SGSD_CODEX_EXECUTOR_REEXECED
    exported so re-exec still fires once; OR
(b) record the creating PID ($$) and make the trap `rm` only when
    [[ $$ == $SGSD_CODEX_EXECUTOR_CREATOR_PID ]].

Do NOT change any dispatch behavior, flag construction, or the direct-launcher
path. After the fix, ALL of these must pass:
  bash super-gsd/scripts/codex-executor.sh --self-test   (direct AND cmd parity PASS)
  bash super-gsd/scripts/codex-exec.sh --self-test --skip-network
  bash super-gsd/scripts/sgsd-codex-control.sh --self-test

Output a single unified diff (git diff format) touching ONLY
super-gsd/scripts/codex-executor.sh. Nothing else.
