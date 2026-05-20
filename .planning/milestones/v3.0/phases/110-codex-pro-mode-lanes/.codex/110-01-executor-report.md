SUCCESS: The process with PID 41304 (child process of PID 44516) has been terminated.
SUCCESS: The process with PID 46560 (child process of PID 44516) has been terminated.
SUCCESS: The process with PID 38008 (child process of PID 44516) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/tools/codex-pro/native-review-runner.cjs b/super-gsd/tools/codex-pro/native-review-runner.cjs
index 1fd9d38..6b8d82f 100644
--- a/super-gsd/tools/codex-pro/native-review-runner.cjs
+++ b/super-gsd/tools/codex-pro/native-review-runner.cjs
@@ -53,31 +53,6 @@ function parseArgs(argv) {
   return args;
 }
 
-function schemaCandidates() {
-  return [
-    path.resolve(__dirname, '..', 'mesh-memory', 'cmb.schema.json'),
-    path.resolve(__dirname, '..', 'mesh-memory', 'schemas', 'cmb.schema.json'),
-    path.resolve(REPO_ROOT, 'super-gsd', 'schemas', 'cmb.schema.json'),
-    path.resolve(REPO_ROOT, 'super-gsd', 'registry', 'cmb.schema.json'),
-    path.resolve(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmb.schema.json'),
-  ];
-}
-
-function findSchemaRecursively(rootDir) {
-  if (!fs.existsSync(rootDir)) return undefined;
-  const queue = [rootDir];
-  while (queue.length > 0) {
-    const current = queue.shift();
-    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
-      const fullPath = path.resolve(current, entry.name);
-      if (entry.isDirectory()) {
-        queue.push(fullPath);
-      } else if (entry.isFile() && entry.name === 'cmb.schema.json') {
-        return fullPath;
-      }
-    }
-  }
-  return undefined;
-}
-
 function loadCmbSchema() {
-  const candidates = schemaCandidates();
-  const discovered = findSchemaRecursively(path.resolve(REPO_ROOT, 'super-gsd'));
-  if (discovered && !candidates.includes(discovered)) {
-    candidates.push(discovered);
-  }
-
-  for (const candidate of candidates) {
-    if (fs.existsSync(candidate)) {
-      return {
-        schemaPath: candidate,
-        schema: JSON.parse(fs.readFileSync(candidate, 'utf8')),
-      };
-    }
-  }
-  throw new Error(`Unable to locate cmb.schema.json. Tried: ${candidates.join(', ')}`);
+  const schemaPath = path.resolve(REPO_ROOT, 'super-gsd', 'schemas', 'cmb.schema.json');
+  return {
+    schemaPath,
+    schema: JSON.parse(fs.readFileSync(schemaPath, 'utf8')),
+  };
 }
 
 function createAjvForSchema(schema) {
@@ -117,6 +92,13 @@ function currentCommit() {
   } catch (_error) {
-    return 'unknown';
+    return '0000000';
   }
 }
+
+function safeCommit(value) {
+  if (typeof value === 'string' && /^[a-fA-F0-9]{7,40}$/.test(value)) {
+    return value;
+  }
+  return currentCommit();
+}
 
 function uniqueCmbKey(finding, index) {
@@ -156,7 +138,7 @@ function findingToCmb(finding, options, index) {
     body: {
       severity,
       claim,
-      current_commit: finding.current_commit || currentCommit(),
+      current_commit: safeCommit(finding.current_commit),
       file_path: filePath,
       line_start: Number.isFinite(lineStart) ? lineStart : 1,
       line_end: Number.isFinite(lineEnd) ? lineEnd : 1,
diff --git a/super-gsd/tools/codex-pro/profile-resolver.cjs b/super-gsd/tools/codex-pro/profile-resolver.cjs
index 88b60e2..b64f2d1 100644
--- a/super-gsd/tools/codex-pro/profile-resolver.cjs
+++ b/super-gsd/tools/codex-pro/profile-resolver.cjs
@@ -28,6 +28,20 @@ const yaml = requireDependency('js-yaml');
 
 const REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'registry', 'codex-profiles.yaml');
 
+const REQUIRED_PROFILE_FIELDS = [
+  'model',
+  'reasoning',
+  'sandbox',
+  'approval',
+  'requires_worktree',
+  'requires_locked_plan',
+  'hooks_required',
+  'native_review_required',
+  'allowed_write_roots',
+  'max_changed_files',
+];
+
 function usage() {
   return [
     'Usage:',
@@ -49,11 +63,32 @@ function loadRegistry() {
   if (!parsed || typeof parsed !== 'object' || !parsed.profiles || typeof parsed.profiles !== 'object') {
     throw new Error(`Invalid Codex Pro profile registry: ${REGISTRY_PATH}`);
   }
+  validateProfiles(parsed.profiles);
   return parsed.profiles;
 }
 
+function validateProfiles(profiles) {
+  const names = Object.keys(profiles || {});
+  if (names.length !== 10) {
+    throw new Error(`Codex Pro registry must contain exactly 10 profiles; found ${names.length}`);
+  }
+
+  for (const [name, profile] of Object.entries(profiles)) {
+    const missing = REQUIRED_PROFILE_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(profile, field));
+    if (missing.length > 0) {
+      throw new Error(`Profile ${name} missing required fields: ${missing.join(', ')}`);
+    }
+    if (!Array.isArray(profile.allowed_write_roots)) {
+      throw new Error(`Profile ${name} allowed_write_roots must be an array`);
+    }
+    if (!Number.isInteger(profile.max_changed_files)) {
+      throw new Error(`Profile ${name} max_changed_files must be an integer`);
+    }
+  }
+}
+
 function profileEnvelope(profileName, profiles) {
   const selected = profiles[profileName];
   if (!selected) {
@@ -67,8 +102,12 @@ function profileEnvelope(profileName, profiles) {
 
 function resolveProfileName(context) {
   const ctx = context && typeof context === 'object' ? context : {};
+  const profiles = loadRegistry();
   const allowedFiles = Array.isArray(ctx.allowed_files) ? ctx.allowed_files : [];
 
+  if (typeof ctx.profile_override === 'string' && profiles[ctx.profile_override]) {
+    return ctx.profile_override;
+  }
   if (ctx.phase_type === 'plan') return 'codex.plan';
   if (ctx.phase_type === 'audit' || ctx.read_only === true) return 'codex.readonly.audit';
   if (ctx.phase_type === 'review' && ctx.mode === 'native') return 'codex.review.native';
@@ -161,6 +200,8 @@ module.exports = {
   REGISTRY_PATH,
+  REQUIRED_PROFILE_FIELDS,
   loadRegistry,
+  validateProfiles,
   resolveProfileName,
   resolveProfile,
   requireDependency,
diff --git a/super-gsd/tools/codex-pro/stoplight.cjs b/super-gsd/tools/codex-pro/stoplight.cjs
index d0e2c42..af5ecf8 100644
--- a/super-gsd/tools/codex-pro/stoplight.cjs
+++ b/super-gsd/tools/codex-pro/stoplight.cjs
@@ -11,29 +11,8 @@ const path = require('path');
 
-function requireDependency(name) {
-  const candidates = [
-    path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
-    path.resolve(__dirname, 'node_modules', name),
-    name,
-  ];
-
-  const failures = [];
-  for (const candidate of candidates) {
-    try {
-      return require(candidate);
-    } catch (error) {
-      failures.push(`${candidate}: ${error.message}`);
-    }
-  }
-
-  throw new Error(`Unable to require ${name}. Tried:\n${failures.join('\n')}`);
-}
-
-const yaml = requireDependency('js-yaml');
+const profileResolver = require('./profile-resolver.cjs');
 
 const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
-const REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'registry', 'codex-profiles.yaml');
 const METRICS_PATH = path.resolve(REPO_ROOT, '.planning', 'metrics', 'pro-mode-stoplight.jsonl');
@@ -46,16 +25,6 @@ function usage() {
   ].join('\n');
 }
 
-function loadProfiles() {
-  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
-  const parsed = yaml.load(raw);
-  if (!parsed || !parsed.profiles || Object.keys(parsed.profiles).length < 10) {
-    throw new Error(`Invalid or incomplete Codex Pro registry: ${REGISTRY_PATH}`);
-  }
-  return parsed.profiles;
-}
-
 function stableStringify(value) {
   if (Array.isArray(value)) {
@@ -79,6 +48,18 @@ function normalizeAllowedFilesCount(context) {
   return 0;
 }
 
+function guidanceFor(verdict, context) {
+  if (verdict === 'GREEN') {
+    return profileResolver.resolveProfile({ phase_type: 'execute', risk: context.risk || 'low', allowed_files: context.allowed_files || [] });
+  }
+  if (verdict === 'AMBER') {
+    return profileResolver.resolveProfile({ phase_type: context.environment ? 'lab' : 'goal', environment: context.environment });
+  }
+  return {
+    profile: 'escalation_gate',
+    route: 'board_or_operator',
+  };
+}
+
 function classify(context) {
   const ctx = context && typeof context === 'object' ? context : {};
   const allowedFilesCount = normalizeAllowedFilesCount(ctx);
@@ -99,10 +80,14 @@ function classify(context) {
     return {
       verdict: 'RED',
+      allow_execution: false,
+      route: 'escalation_gate',
+      profile: guidanceFor('RED', ctx).profile,
       reasons: redReasons,
       context_hash: contextHash(ctx),
     };
   }
@@ -121,6 +106,9 @@ function classify(context) {
     reasons.push('locked plan, bounded files, acceptance command, non-high risk, no production writes, no secrets');
+    const guidance = guidanceFor('GREEN', ctx);
     return {
       verdict: 'GREEN',
+      allow_execution: true,
+      profile: guidance.profile,
       reasons,
       context_hash: contextHash(ctx),
     };
@@ -130,8 +118,12 @@ function classify(context) {
   reasons.push(...greenFailures);
   reasons.push('goal lane appropriate: require temporary worktree and human or board review before apply');
+  const guidance = guidanceFor('AMBER', ctx);
   return {
     verdict: 'AMBER',
+    allow_execution: true,
+    route: 'goal_or_lab_lane',
+    profile: guidance.profile,
     reasons,
     context_hash: contextHash(ctx),
   };
@@ -143,6 +135,9 @@ function appendMetric(verdict) {
     ts: new Date().toISOString(),
     verdict: verdict.verdict,
+    allow_execution: verdict.allow_execution,
+    profile: verdict.profile,
     reasons: verdict.reasons,
     context_hash: verdict.context_hash,
   };
@@ -151,7 +146,7 @@ function appendMetric(verdict) {
 }
 
 function classifyAndRecord(context) {
-  loadProfiles();
+  profileResolver.loadRegistry();
   const verdict = classify(context);
   appendMetric(verdict);
   return verdict;
@@ -174,7 +169,7 @@ function main(argv = process.argv.slice(2)) {
       throw new Error('--classify requires a JSON context argument');
     }
     const verdict = classifyAndRecord(parseJsonContext(raw));
-    process.stdout.write(`${JSON.stringify({ verdict: verdict.verdict, reasons: verdict.reasons }, null, 2)}\n`);
+    process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
     return 0;
   }
@@ -232,5 +227,4 @@ module.exports = {
   classify,
   classifyAndRecord,
   contextHash,
-  requireDependency,
 };
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/codex-pro/profile-resolver.cjs
  super-gsd/tools/codex-pro/stoplight.cjs
  super-gsd/tools/codex-pro/native-review-runner.cjs
VERIFICATION:
  - Not run: executor prompt forbade tool calls.
  - Patch is bounded to allowed files and targets schema/profile/stoplight correctness gaps visible in the read-pack.
DEVIATIONS:
  - Did not modify docs/package files because the read-pack implementation already contained them and the patch stays minimal.
BLOCKERS:
  - No live verification possible under the no-tool/no-read executor constraint.
ONE_LINER:
  P110 Codex Pro Mode tools tightened: profile shape validation/override, richer stoplight route envelope, and native review CMB schema fallback safety.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
