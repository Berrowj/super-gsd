PATCH_BEGIN
diff --git a/super-gsd/scripts/codex-exec.sh b/super-gsd/scripts/codex-exec.sh
index 0000000..0000000 100755
--- a/super-gsd/scripts/codex-exec.sh
+++ b/super-gsd/scripts/codex-exec.sh
@@ -892,7 +892,7 @@ write_live_state() {
     plan_json="$(json_escape "$PLAN_TAG")"
     step_json="$(json_escape "$STEP_TAG")"
     mkdir -p "$(dirname "$LIVE_FILE")" 2>/dev/null || true
-    {
+    if {
         printf '{\n'
         printf '  "provider": "codex-cli-reviewer",\n'
         printf '  "invocation": "shell",\n'
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/scripts/codex-exec.sh
VERIFICATION:
Not run; executor prompt forbids tool use. Expected checks: bash -n super-gsd/scripts/codex-exec.sh and bash super-gsd/scripts/codex-exec.sh --self-test --skip-network.
DEVIATIONS:
None from requested code change.
BLOCKERS:
Runtime verification requires host command execution, which was explicitly prohibited.
ONE_LINER:
Restored the missing if token before the live-state write block.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
