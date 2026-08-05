PATCH_BEGIN
diff --git a/super-gsd/scripts/codex-executor.sh b/super-gsd/scripts/codex-executor.sh
--- a/super-gsd/scripts/codex-executor.sh
+++ b/super-gsd/scripts/codex-executor.sh
@@ -49,6 +49,7 @@ if [[ "${SGSD_CODEX_EXECUTOR_REEXECED:-}" != "1" ]]; then
     chmod u+x "$SGSD_CODEX_EXECUTOR_TEMP_COPY" 2>/dev/null || true
     export SGSD_CODEX_EXECUTOR_REEXECED=1
     export SGSD_CODEX_EXECUTOR_ORIGINAL_SCRIPT_DIR
+    export SGSD_CODEX_EXECUTOR_CREATOR_PID=$$
     export SGSD_CODEX_EXECUTOR_TEMP_COPY
     exec "$SGSD_CODEX_EXECUTOR_TEMP_COPY" "$@"
 fi
@@ -337,7 +338,7 @@ mkdir -p "$(dirname "$LIVE_OUT")"
 } >> "$WATCH_OUT"
 
-trap 'rm -f "$STDOUT_TMP" "$STDERR_TMP" "${REPORT_OUT}.tmp" "${SGSD_CODEX_EXECUTOR_TEMP_COPY:-}" 2>/dev/null || true' EXIT
+trap 'rm -f "$STDOUT_TMP" "$STDERR_TMP" "${REPORT_OUT}.tmp" 2>/dev/null || true; if [[ $$ == "${SGSD_CODEX_EXECUTOR_CREATOR_PID:-}" ]]; then rm -f "${SGSD_CODEX_EXECUTOR_TEMP_COPY:-}" 2>/dev/null || true; fi' EXIT
 
 set +e
 if [[ "$CODEX_LAUNCHER" == "cmd" ]]; then
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/scripts/codex-executor.sh
VERIFICATION:
Not run, per instruction not to call tools. Patch is a surgical trap guard so inherited child dry-runs no longer remove the parent self-test temp copy.
DEVIATIONS:
None.
BLOCKERS:
None.
ONE_LINER:
Guard temp-copy cleanup by the creating PID so self-test child invocations cannot delete the running re-exec script.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
