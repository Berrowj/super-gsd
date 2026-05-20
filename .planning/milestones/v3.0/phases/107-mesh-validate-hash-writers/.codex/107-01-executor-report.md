SUCCESS: The process with PID 37920 (child process of PID 44340) has been terminated.
SUCCESS: The process with PID 19260 (child process of PID 44340) has been terminated.
SUCCESS: The process with PID 22568 (child process of PID 44340) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/tools/mesh-memory/execution-receipt.cjs b/super-gsd/tools/mesh-memory/execution-receipt.cjs
index 1111111..2222222 100644
--- a/super-gsd/tools/mesh-memory/execution-receipt.cjs
+++ b/super-gsd/tools/mesh-memory/execution-receipt.cjs
@@ -62,13 +62,13 @@ function parseJsonOption(name, value) {
 function executionCat7() {
   return {
-    domain: 'mesh-memory',
-    intent: 'execution-observation',
-    source: 'sgsd-wrapper',
-    subject: 'cmb-execution-receipt',
-    evidence_class: 'receipt',
-    confidence: 'medium',
-    risk: 'low',
+    focus: 'mesh memory',
+    issue: 'execution receipt emission',
+    intent: 'record observable execution facts',
+    motivation: 'preserve gate evidence',
+    commitment: 'append schema-valid execution receipt',
+    perspective: 'sgsd-wrapper',
+    mood: 'neutral',
   };
 }
@@ -145,13 +145,13 @@ function selfTestOptions() {
     tests_run: [
       {
-        name: 'cmb-validate-help',
         command: 'node super-gsd/tools/mesh-memory/cmb-validate.cjs --help',
-        status: 'pass',
+        result: 'pass',
+        count: 1,
       },
       {
-        name: 'mesh-memory-self-test',
         command: 'node super-gsd/tools/mesh-memory/run-self-test.cjs',
-        status: 'pass',
+        result: 'pass',
+        count: 20,
       },
     ],
diff --git a/super-gsd/tools/mesh-memory/review-finding-writer.cjs b/super-gsd/tools/mesh-memory/review-finding-writer.cjs
index 3333333..4444444 100644
--- a/super-gsd/tools/mesh-memory/review-finding-writer.cjs
+++ b/super-gsd/tools/mesh-memory/review-finding-writer.cjs
@@ -60,38 +60,32 @@ function parseArgs(argv) {
 function reviewCat7() {
   return {
-    domain: 'mesh-memory',
-    intent: 'review-claim',
-    source: 'atc-v4',
-    subject: 'cmb-review-finding',
-    evidence_class: 'finding',
-    confidence: 'medium',
-    risk: 'medium',
+    focus: 'mesh memory',
+    issue: 'review finding claim',
+    intent: 'record reviewer claim',
+    motivation: 'preserve review evidence',
+    commitment: 'append schema-valid review finding',
+    perspective: 'reviewer',
+    mood: 'focused',
   };
 }
 
-function buildBodies(options) {
-  const flat = {
-    receipt_key: options.receipt_key,
+function buildBody(options) {
+  const body = {
     severity: options.severity,
     claim: options.claim,
     current_commit: options.current_commit,
-    file_path: options.file_path,
-    line_start: options.line_start,
-    line_end: options.line_end,
   };
 
-  const nestedLocation = {
-    receipt_key: options.receipt_key,
-    severity: options.severity,
-    claim: options.claim,
-    current_commit: options.current_commit,
-    location: {
-      file_path: options.file_path,
-      line_start: options.line_start,
-      line_end: options.line_end,
-    },
-  };
+  if (options.file_path !== undefined) body.file_path = options.file_path;
+  if (options.line_start !== undefined) body.line_start = options.line_start;
+  if (options.line_end !== undefined) body.line_end = options.line_end;
+  if (options.quoted_excerpt !== undefined) body.quoted_excerpt = options.quoted_excerpt;
+  if (options.violated_invariant !== undefined) body.violated_invariant = options.violated_invariant;
+  if (options.reproducer_command !== undefined) body.reproducer_command = options.reproducer_command;
+  if (options.confidence !== undefined) body.confidence = options.confidence;
 
-  return [flat, nestedLocation];
+  return body;
 }
 
 function buildBaseCmb(options, body) {
@@ -128,18 +122,18 @@ function finalizeCandidate(candidate, includeContentHash) {
 
 function buildValidatedCmb(options) {
   const failures = [];
-  for (const body of buildBodies(options)) {
-    const base = buildBaseCmb(options, body);
-    for (const includeContentHash of [true, false]) {
-      const candidate = finalizeCandidate(base, includeContentHash);
-      const result = validateCmb(candidate);
-      if (result.valid) {
-        return candidate;
-      }
-      failures.push(result.errors);
+  const base = buildBaseCmb(options, buildBody(options));
+  for (const includeContentHash of [true, false]) {
+    const candidate = finalizeCandidate(base, includeContentHash);
+    const result = validateCmb(candidate);
+    if (result.valid) {
+      return candidate;
     }
+    failures.push(result.errors);
   }
 
   const errors = failures[0] || [];
   throw new Error(errors.map((error) => formatError('<generated-review-finding>', error)).join('\n'));
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/execution-receipt.cjs
  super-gsd/tools/mesh-memory/review-finding-writer.cjs
VERIFICATION:
  Not run per executor constraint. Patch fixes writer CAT7 fields and schema body shapes so operator can run: node super-gsd/tools/mesh-memory/run-self-test.cjs
DEVIATIONS:
  No tools called; no npm install run.
BLOCKERS:
  None.
ONE_LINER:
  P107 writer self-tests now emit schema-valid CAT7/body shapes for execution_receipt and review_finding CMBs.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
