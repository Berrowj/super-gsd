SUCCESS: The process with PID 40012 (child process of PID 13548) has been terminated.
SUCCESS: The process with PID 45908 (child process of PID 13548) has been terminated.
SUCCESS: The process with PID 46584 (child process of PID 13548) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/templates/MILESTONE-CONTEXT.template.yaml b/super-gsd/templates/MILESTONE-CONTEXT.template.yaml
--- a/super-gsd/templates/MILESTONE-CONTEXT.template.yaml
+++ b/super-gsd/templates/MILESTONE-CONTEXT.template.yaml
@@ -6,6 +6,14 @@ business_why: |
   ...
 primary_user_outcome: |
   ...
+
+# Entry criteria describe what must already be true before this milestone starts.
+entry_criteria:
+  - "..."
+
+# Exit criteria describe what proves the milestone is complete.
+exit_criteria:
+  - "..."
 
 # Personas describe who the milestone serves and what each role is trying to avoid.
 personas:
diff --git a/.planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml b/.planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml
--- a/.planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml
+++ b/.planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml
@@ -8,6 +8,20 @@ primary_user_outcome: |
   Preserve milestone context across gates, validate claims against evidence,
   detect echoing or stale projections, and provide bounded pseudo-operator
   recommendations without replacing the real operator or SGSD control plane.
+entry_criteria:
+  - "DLB-07 semantic vs structural verification landed at commit 2fa3bbc"
+  - "plan-schema-v2 SCHEMA-09/-10 enforcement is live"
+  - "sgsd-audit v2 Layer 4 semantic-AC enforcement landed at commit 699936f"
+  - "Statusline reliability fixes landed at commits 5a26023 and 6cd6c2f"
+  - "SGSD-PRO master proposal is ingested under .planning/proposals/"
+  - "Pi2Pi transcript and Mesh Memory Protocol paper are ingested"
+exit_criteria:
+  - "All four MVP success fixtures are green: false-CRIT refutation, context-aware pseudo-operator recommendation, visible lineage chain, and production/SAP/Mongo/Qdrant carve-out escalation"
+  - "DLB-08 Mesh Memory Lite implementation complete"
+  - "DLB-09 first Codex Pro Mode phase shipped"
+  - "DLB-10 Context Authority capsule defined for v3.0 with all six YAML files"
+  - "Every v3.0 PLAN.md ships with semantic_acceptance_criteria from day one"
+
 personas:
   - id: operator
     priority: primary
diff --git a/super-gsd/tools/context-authority/README.md b/super-gsd/tools/context-authority/README.md
--- a/super-gsd/tools/context-authority/README.md
+++ b/super-gsd/tools/context-authority/README.md
@@ -2,8 +2,8 @@
 
 DLB-10.1 Context Authority turns per-milestone context capsules into typed
 `context_anchor` CMBs in mesh memory. The capsule files capture why a milestone
-exists, which personas matter, the domain ontology, overloaded terms, source of
-truth mappings, and explicit non-goals.
+exists, entry and exit criteria, which personas matter, the domain ontology,
+overloaded terms, source of truth mappings, and explicit non-goals.
 
 ## Author Capsules
 
diff --git a/super-gsd/tools/context-authority/context-anchor-writer.cjs b/super-gsd/tools/context-authority/context-anchor-writer.cjs
--- a/super-gsd/tools/context-authority/context-anchor-writer.cjs
+++ b/super-gsd/tools/context-authority/context-anchor-writer.cjs
@@ -1,7 +1,6 @@
 #!/usr/bin/env node
 'use strict';
 
-const childProcess = require('child_process');
 const crypto = require('crypto');
 const fs = require('fs');
 const os = require('os');
@@ -173,28 +172,21 @@ function validateAgainstSchema(cmb) {
   }
 }
 
-function tryCmbValidateCli(cmb) {
-  if (!fs.existsSync(CMB_VALIDATE_PATH)) return null;
-
-  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-cmb-validate-'));
-  const tempPath = path.join(tempDir, 'cmb.json');
-  fs.writeFileSync(tempPath, `${JSON.stringify(cmb, null, 2)}\n`, 'utf8');
-
-  const candidates = [
-    ['--file', tempPath],
-    ['--input', tempPath],
-    [tempPath]
-  ];
-
-  for (const args of candidates) {
-    const result = childProcess.spawnSync(process.execPath, [CMB_VALIDATE_PATH, ...args], {
-      cwd: REPO_ROOT,
-      encoding: 'utf8'
-    });
-    if (result.status === 0) return true;
-  }
-
-  return null;
+function validateWithCmbValidator(cmb) {
+  if (!fs.existsSync(CMB_VALIDATE_PATH)) {
+    throw new Error(`Missing CMB validator: ${toRepoRelative(CMB_VALIDATE_PATH)}`);
+  }
+  const validator = require(CMB_VALIDATE_PATH);
+  if (!validator || typeof validator.validateCmb !== 'function') {
+    throw new Error('cmb-validate.cjs does not export validateCmb');
+  }
+  const result = validator.validateCmb(cmb);
+  if (!result.valid) {
+    const errors = (result.errors || []).map((error) => (
+      validator.formatError ? validator.formatError('context_anchor', error) : `${error.instancePath || '/'} ${error.message || 'schema validation failed'}`
+    ));
+    throw new Error(`context_anchor CMB failed cmb-validate:\n${errors.join('\n')}`);
+  }
 }
 
 function validateCmb(cmb) {
   validateAgainstSchema(cmb);
-  tryCmbValidateCli(cmb);
+  validateWithCmbValidator(cmb);
 }
@@ -278,6 +270,7 @@ module.exports = {
   buildContextAnchor,
   checkStaleness,
   emitAnchor,
+  validateCmb,
   requireDependency
 };
diff --git a/super-gsd/tools/context-authority/run-self-test.cjs b/super-gsd/tools/context-authority/run-self-test.cjs
--- a/super-gsd/tools/context-authority/run-self-test.cjs
+++ b/super-gsd/tools/context-authority/run-self-test.cjs
@@ -76,6 +76,8 @@ test('MILESTONE-CONTEXT.template top-level keys', () => {
     'title',
     'business_why',
     'primary_user_outcome',
+    'entry_criteria',
+    'exit_criteria',
     'personas',
     'source_of_truth',
     'non_goals',
@@ -140,6 +142,15 @@ test('all 6 v3.0 capsule instances parse as YAML', () => {
   for (const fileName of CAPSULE_FILES) parseYaml(path.join(CONTEXT_DIR, fileName));
 });
 
+test('v3.0 milestone context has entry and exit criteria', () => {
+  const parsed = parseYaml(path.join(CONTEXT_DIR, 'MILESTONE-CONTEXT.yaml'));
+  for (const key of ['entry_criteria', 'exit_criteria']) {
+    assert(Array.isArray(parsed[key]) && parsed[key].length > 0,
+      `MILESTONE-CONTEXT.yaml missing non-empty ${key}`
+    );
+  }
+});
+
 test('context-composer --self-test emits 6 anchors', () => {
   const result = runNode(['super-gsd/tools/context-authority/context-composer.cjs', '--self-test']);
   assert(result.status === 0, result.stderr || result.stdout);
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/templates/MILESTONE-CONTEXT.template.yaml
  .planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml
  super-gsd/tools/context-authority/README.md
  super-gsd/tools/context-authority/context-anchor-writer.cjs
  super-gsd/tools/context-authority/run-self-test.cjs
VERIFICATION:
  - Not run: operator explicitly prohibited tool calls.
  - Patch authored from supplied read-pack only.
DEVIATIONS:
  - None from allowed-file boundary.
BLOCKERS:
  - None.
ONE_LINER:
  P112 Context Authority patch tightens milestone entry/exit coverage and validates emitted anchors through cmb-validate.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
