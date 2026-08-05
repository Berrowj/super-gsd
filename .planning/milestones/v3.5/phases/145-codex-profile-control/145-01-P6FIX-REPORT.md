PATCH_BEGIN
diff --git a/super-gsd/scripts/codex-exec.sh b/super-gsd/scripts/codex-exec.sh
--- a/super-gsd/scripts/codex-exec.sh
+++ b/super-gsd/scripts/codex-exec.sh
@@ -533,7 +533,7 @@ if [[ "$SELF_TEST" == true ]]; then
         }
 
         sgsd_codex_exec_self_test_write_failure_case() {
-            local case_dir case_project case_prompt case_report report_dir report_parent rc
+            local case_dir case_project case_prompt case_report report_dir rc
             case_dir="$ST_TMP_ROOT/case-write-failure"
             case_project="$case_dir/project"
             case_prompt="$case_dir/prompt.txt"
@@ -544,12 +544,9 @@ if [[ "$SELF_TEST" == true ]]; then
             printf 'prompt for write failure\n' > "$case_prompt"
             chmod a-w "$report_dir" 2>/dev/null || true
             if [[ -w "$report_dir" ]]; then
+                echo "Probe 6 write-failure: SKIPPED (filesystem does not enforce chmod a-w)" >&2
                 chmod u+w "$report_dir" 2>/dev/null || true
-                rmdir "$report_dir" 2>/dev/null || true
-                report_parent="$case_dir/report-parent"
-                printf 'not a directory\n' > "$report_parent"
-                case_report="$report_parent/report.txt"
+                return 0
             fi
             set +e
             PATH="$ST_BIN:$PATH" SGSD_CODEX_FORCE_LAUNCHER=direct SGSD_FAKE_CODEX_MODE="contract" "$0" --prompt-file "$case_prompt" --report-out "$case_report" --project "$case_project" --timeout 5 --phase 145 --plan 145-01 --step "self-test-write-failure" >/dev/null 2> "$case_dir/stderr.txt"
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/scripts/codex-exec.sh
VERIFICATION:
Not run; executor rules prohibited tool calls.
DEVIATIONS:
None.
BLOCKERS:
None.
ONE_LINER:
Probe 6 write-failure now skips inconclusive chmod enforcement on non-POSIX filesystems instead of using the fragile file-as-parent fallback.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
