SUCCESS: The process with PID 18152 (child process of PID 14508) has been terminated.
SUCCESS: The process with PID 43852 (child process of PID 14508) has been terminated.
SUCCESS: The process with PID 43824 (child process of PID 14508) has been terminated.
PATCH_BEGIN
diff --git a/.codex/hooks.json b/.codex/hooks.json
new file mode 100644
index 0000000..0c69cb4
--- /dev/null
+++ b/.codex/hooks.json
@@ -0,0 +1,18 @@
+{
+  "hooks": {
+    "UserPromptSubmit": [
+      "super-gsd/tools/codex-hooks/block-secret-leak.cjs"
+    ],
+    "PreToolUse": [
+      "super-gsd/tools/codex-hooks/block-forbidden-write.cjs",
+      "super-gsd/tools/codex-hooks/enforce-allowed-files.cjs"
+    ],
+    "PostToolUse": [
+      "super-gsd/tools/codex-hooks/log-tool-event.cjs"
+    ],
+    "Stop": [
+      "super-gsd/tools/codex-hooks/validate-stop-contract.cjs"
+    ]
+  }
+}
diff --git a/super-gsd/tools/plan-lock/validate-plan-locked.cjs b/super-gsd/tools/plan-lock/validate-plan-locked.cjs
index 6f994c1..3ec18a2 100755
--- a/super-gsd/tools/plan-lock/validate-plan-locked.cjs
+++ b/super-gsd/tools/plan-lock/validate-plan-locked.cjs
@@ -366,10 +366,14 @@ function runSelfTestIncomplete() {
   delete frontmatter.risk_rating;
   const planFile = writeTempPlan(frontmatter, "incomplete");
   const exitCode = runValidation(planFile);
-  if (exitCode === 0) {
+  if (exitCode !== 1) {
     console.error(`[${TOOL_NAME}] --self-test-incomplete expected REJECT`);
+    return 1;
   }
-  return 1;
+  console.error(`[${TOOL_NAME}] --self-test-incomplete observed expected REJECT`);
+  return 0;
 }
 
 function main() {
diff --git a/super-gsd/tools/codex-hooks/run-self-test.cjs b/super-gsd/tools/codex-hooks/run-self-test.cjs
index 55a67fe..1a5d938 100755
--- a/super-gsd/tools/codex-hooks/run-self-test.cjs
+++ b/super-gsd/tools/codex-hooks/run-self-test.cjs
@@ -149,10 +149,10 @@ function main() {
       const result = runNode(planLockValidator, ["--self-test-valid"]);
       expect(result.status === 0, `expected 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
     }),
-    assertion("plan-lock --self-test-incomplete exits 1", () => {
+    assertion("plan-lock --self-test-incomplete exits 0 after expected rejection", () => {
       const result = runNode(planLockValidator, ["--self-test-incomplete"]);
-      expect(result.status === 1, `expected 1, got ${result.status}`);
-      expect(/PLAN-LOCKED-\d{2}/.test(`${result.stdout}\n${result.stderr}`), "missing PLAN-LOCKED-XX error");
+      expect(result.status === 0, `expected 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
+      expect(/PLAN-LOCKED-\d{2}/.test(`${result.stdout}\n${result.stderr}`), "missing PLAN-LOCKED-XX error");
     }),
     assertion("codex-tool-events.jsonl has at least one row", () => {
       expect(lineCount(metricsPath) >= 1, "metrics file has no rows");
diff --git a/super-gsd/tools/codex-hooks/README.md b/super-gsd/tools/codex-hooks/README.md
index 8334aa0..eaa8e31 100644
--- a/super-gsd/tools/codex-hooks/README.md
+++ b/super-gsd/tools/codex-hooks/README.md
@@ -33,6 +33,8 @@ node super-gsd/tools/codex-hooks/run-self-test.cjs
 ```
 
 To add a hook, create a standalone `*.cjs` script with `--help`, a deterministic self-test mode, JSON stdin handling, and metrics logging. Then add it to `.codex/hooks.json` under the appropriate Codex event.
+
+The PLAN-LOCKED incomplete-plan self-test exits `0` when the invalid fixture is rejected with a `PLAN-LOCKED-XX` diagnostic.
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .codex/hooks.json (created)
  super-gsd/tools/plan-lock/validate-plan-locked.cjs (updated)
  super-gsd/tools/codex-hooks/run-self-test.cjs (updated)
  super-gsd/tools/codex-hooks/README.md (updated)
VERIFICATION:
  - Not run; operator instructed no tools/file reads.
  - Patch aligns --self-test-incomplete with the plan contract: expected rejection is a passing self-test exit 0.
DEVIATIONS:
  - Did not rewrite existing supplied implementations; only added missing hook config and corrected self-test exit semantics.
BLOCKERS:
  - None.
ONE_LINER:
  P111 hook config added and PLAN-LOCKED incomplete self-test semantics corrected to pass on expected rejection.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
