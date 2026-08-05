PATCH_BEGIN
diff --git a/super-gsd/scripts/codex-executor.sh b/super-gsd/scripts/codex-executor.sh
--- a/super-gsd/scripts/codex-executor.sh
+++ b/super-gsd/scripts/codex-executor.sh
@@ -58,7 +58,7 @@ if [[ "${SGSD_CODEX_EXECUTOR_REEXECED:-}" != "1" ]]; then
     export SGSD_CODEX_EXECUTOR_TEMP_COPY
     exec "$SGSD_CODEX_EXECUTOR_TEMP_COPY" "$@"
 fi
-if [[ -n "${SGSD_CODEX_EXECUTOR_TEMP_COPY:-}" ]]; then
+if [[ -n "${SGSD_CODEX_EXECUTOR_TEMP_COPY:-}" && "$$" == "${SGSD_CODEX_EXECUTOR_CREATOR_PID:-}" ]]; then
     trap 'rm -f "$SGSD_CODEX_EXECUTOR_TEMP_COPY" 2>/dev/null || true' EXIT
 fi
 
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/scripts/codex-executor.sh
VERIFICATION:
Not run; tool execution was disallowed by the executor prompt.
DEVIATIONS:
None.
BLOCKERS:
None.
ONE_LINER:
Gated the temp-copy EXIT cleanup so only the creator PID removes the shared re-exec script.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
