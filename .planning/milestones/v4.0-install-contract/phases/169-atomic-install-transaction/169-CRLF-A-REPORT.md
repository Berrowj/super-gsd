PATCH_BEGIN
diff --git a/super-gsd/tools/feature-propagation/audit.cjs b/super-gsd/tools/feature-propagation/audit.cjs
--- a/super-gsd/tools/feature-propagation/audit.cjs
+++ b/super-gsd/tools/feature-propagation/audit.cjs
@@ -11,6 +11,7 @@
 //   --repair-safe install/refresh global SGSD agents, project config, substrate
 //                 witness source/hooks/key, brokered capability, and derived grants
 //   --repair      repair-safe plus backup project-local agent shadows
+//   --write-source-pins regenerate normalized repo-overlay source digests
 //   --self-test   deterministic assertions
 //
 // The tool never deletes project-local agent files. Full repair moves shadowing
@@ -313,6 +314,14 @@ function sha256(p) {
   }
 }
 
+function normalizedSourceSha256(p) {
+  try {
+    return hookInstallContract.normalizedSourceDigest(fs.readFileSync(p));
+  } catch (_e) {
+    return null;
+  }
+}
+
 function sha256Bytes(value) {
   return crypto.createHash('sha256').update(value).digest('hex');
 }
@@ -352,6 +361,83 @@ function atomicJson(filePath, value) {
   fs.renameSync(temporary, filePath);
 }
 
+function sourcePinSourcePath(entry, sourceRoot) {
+  const configuredPaths = new Set();
+  for (const hook of entry.hooks || []) {
+    if (hook && Array.isArray(hook.args) && typeof hook.args[0] === 'string') {
+      configuredPaths.add(hook.args[0]);
+    }
+  }
+  if (configuredPaths.size !== 1) {
+    throw new Error('source-pinned hook must declare exactly one source path');
+  }
+  const configuredPath = [...configuredPaths][0].replace(/\\/g, '/');
+  const prefix = 'super-gsd/';
+  if (!configuredPath.startsWith(prefix)) {
+    throw new Error('source-pinned hook path must begin with super-gsd/: ' + configuredPath);
+  }
+  const sourcePath = path.resolve(sourceRoot, ...configuredPath.slice(prefix.length).split('/'));
+  const relative = path.relative(sourceRoot, sourcePath);
+  if (relative === '..' || path.isAbsolute(relative) || relative.startsWith('..' + path.sep)) {
+    throw new Error('source-pinned hook path escapes SGSD root: ' + configuredPath);
+  }
+  if (!exists(sourcePath) || !fs.statSync(sourcePath).isFile()) {
+    throw new Error('source-pinned hook source is missing: ' + sourcePath);
+  }
+  return sourcePath;
+}
+
+function writeSourcePins(options = {}) {
+  const overlayPath = path.resolve(options.overlayPath || REPO_HOOK_OVERLAY);
+  const sourceRoot = path.resolve(options.sgsdRoot || sgsdRoot());
+  const original = fs.readFileSync(overlayPath, 'utf8');
+  const overlay = JSON.parse(original);
+  const rows = [];
+  for (const [event, entries] of Object.entries(overlay.hooks || {})) {
+    if (!Array.isArray(entries)) continue;
+    for (const entry of entries) {
+      if (!entry || !Object.prototype.hasOwnProperty.call(entry, 'sgsd_source_sha256')) continue;
+      const sourcePath = sourcePinSourcePath(entry, sourceRoot);
+      const next = normalizedSourceSha256(sourcePath);
+      if (!next) throw new Error('could not digest source-pinned hook: ' + sourcePath);
+      rows.push({
+        event,
+        hook_id: entry.sgsd_hook_id || 'unidentified',
+        source_path: sourcePath,
+        old_sha256: entry.sgsd_source_sha256,
+        sha256: next,
+      });
+      entry.sgsd_source_sha256 = next;
+    }
+  }
+  if (!rows.length) throw new Error('repo settings overlay contains no source pins');
+
+  let index = 0;
+  const rendered = original.replace(
+    /("sgsd_source_sha256"\s*:\s*")([^"]*)(")/g,
+    (match, prefix, oldDigest, suffix) => {
+      const row = rows[index];
+      if (!row || oldDigest !== String(row.old_sha256)) {
+        throw new Error('source pin order does not match parsed repo settings overlay');
+      }
+      index += 1;
+      return prefix + row.sha256 + suffix;
+    },
+  );
+  if (index !== rows.length) {
+    throw new Error('not every parsed source pin was rewritten');
+  }
+  if (rendered !== original) {
+    const temporary = overlayPath + '.tmp';
+    fs.writeFileSync(temporary, rendered, 'utf8');
+    fs.renameSync(temporary, overlayPath);
+  }
+  return rows;
+}
+
 function readMcpDocument(filePath) {
   if (!exists(filePath)) return { doc: {}, malformed: false };
   try {
@@ -480,13 +566,15 @@ function auditClaudeSubstrateWitness(ctx) {
   }
   const installedSource = path.join(ctx.projectDir, witnessStore.HOOK_RELATIVE_PATH);
   const canonicalSource = path.join(ctx.sgsdRoot, witnessStore.HOOK_RELATIVE_PATH.replace(/^super-gsd[\\/]/, ''));
-  if (!samePath(installedSource, canonicalSource)
-      && (!exists(canonicalSource) || sha256(installedSource) !== sha256(canonicalSource))) {
+  if (!samePath(installedSource, canonicalSource) && (
+    !exists(canonicalSource)
+      || normalizedSourceSha256(installedSource) !== normalizedSourceSha256(canonicalSource)
+  )) {
     reason = 'source_drift';
     ready = false;
   }
   if (!readiness.ready && /stale$/.test(reason || '')) {
-    const sourceDigest = sha256(installedSource);
+    const sourceDigest = normalizedSourceSha256(installedSource);
     const managed = [];
     for (const event of ['PreToolUse', 'PostToolUse']) {
       for (const entry of ((settings && settings.hooks && settings.hooks[event]) || [])) {
@@ -519,8 +607,8 @@ function validateUpstreamManifest(ctx, manifest, options = {}) {
   const manifestPath = witnessStore.resolveWitnessPaths(ctx.projectDir, process.env).upstream_manifest_path;
   if (!manifest || manifest.schema_version !== witnessStore.UPSTREAM_MANIFEST_SCHEMA_VERSION
       || manifest.project_digest !== witnessStore.resolveWitnessPaths(ctx.projectDir, process.env).project_digest
-      || manifest.broker_sha256 !== sha256(brokerPath)
-      || manifest.witness_source_sha256 !== sha256(hookPath)
+      || manifest.broker_sha256 !== normalizedSourceSha256(brokerPath)
+      || manifest.witness_source_sha256 !== normalizedSourceSha256(hookPath)
       || typeof manifest.active_scope !== 'string' || !manifest.servers
       || typeof manifest.servers !== 'object' || Array.isArray(manifest.servers)) {
     return 'upstream_drift';
@@ -749,8 +837,8 @@ function repairClaudeSubstrateCapability(ctx, actions, options = {}) {
       active_scope: '',
       servers: {},
     };
-  manifest.broker_sha256 = sha256(expected.args[0]);
-  manifest.witness_source_sha256 = sha256(path.join(ctx.projectDir, witnessStore.HOOK_RELATIVE_PATH));
+  manifest.broker_sha256 = normalizedSourceSha256(expected.args[0]);
+  manifest.witness_source_sha256 = normalizedSourceSha256(path.join(ctx.projectDir, witnessStore.HOOK_RELATIVE_PATH));
   for (const scope of supported) {
     const definition = scopeDefinition(scope);
     manifest.servers[scope.id] = {
@@ -1405,6 +1493,20 @@ function main(argv) {
     process.exit(out.ok ? 0 : 1);
     return;
   }
+  if (args.indexOf('--write-source-pins') !== -1) {
+    const rows = writeSourcePins({
+      overlayPath: argValue(args, '--source-pin-overlay') || undefined,
+      sgsdRoot: argValue(args, '--sgsd-root') || undefined,
+    });
+    for (const row of rows) {
+      process.stdout.write(
+        'source_pin ' + row.hook_id + ' ' + row.old_sha256 + ' -> ' + row.sha256
+          + ' source=' + row.source_path + '\n',
+      );
+    }
+    process.exit(0);
+    return;
+  }
   const projectDir = argValue(args, '--project-dir');
   if (args.indexOf('--check-substrate-capability') !== -1) {
     const ctx = mkContext(projectDir);
@@ -1487,6 +1589,7 @@ module.exports = {
     mcpScopeDocuments,
     profilePaths,
+    writeSourcePins,
   },
 };
diff --git a/super-gsd/scripts/lib/hook-install-contract.cjs b/super-gsd/scripts/lib/hook-install-contract.cjs
--- a/super-gsd/scripts/lib/hook-install-contract.cjs
+++ b/super-gsd/scripts/lib/hook-install-contract.cjs
@@ -17,8 +17,21 @@ function posix(value) {
   return value.replace(/\\/g, '/');
 }
 
-function digest(value) {
-  return crypto.createHash('sha256').update(value).digest('hex');
+function normalizedSourceDigest(value) {
+  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
+  const hash = crypto.createHash('sha256');
+  let start = 0;
+  // Canonical source bytes differ only by CRLF becoming LF; preserve all other bytes.
+  for (let index = 0; index + 1 < bytes.length; index += 1) {
+    if (bytes[index] !== 0x0d || bytes[index + 1] !== 0x0a) continue;
+    hash.update(bytes.subarray(start, index));
+    hash.update('\n');
+    index += 1;
+    start = index + 1;
+  }
+  hash.update(bytes.subarray(start));
+  return hash.digest('hex');
 }
 
 function inside(root, candidate) {
@@ -409,7 +422,7 @@ function computeHookDependencyGraph(options = {}) {
       source_path: rootRelative,
       source_absolute_path: rootSource,
       target_path: path.join(runtimeSgsdRoot, rootRelative),
-      sha256: digest(fs.readFileSync(rootSource)),
+      sha256: normalizedSourceDigest(fs.readFileSync(rootSource)),
       dependencies,
       required_files: [rootRelative, ...dependencies].sort(),
       packages: [...entryPackages].sort(),
@@ -426,7 +439,7 @@ function computeHookDependencyGraph(options = {}) {
         relative_path: relative,
         source_path: sourcePath,
         target_path: path.join(runtimeSgsdRoot, relative),
-        sha256: digest(fs.readFileSync(sourcePath)),
+        sha256: normalizedSourceDigest(fs.readFileSync(sourcePath)),
         required_by: [...requiredBy].sort(),
       };
     });
@@ -451,11 +464,13 @@ function renderManifestDependencies(manifestOrGraph, maybeGraph) {
   const graph = maybeGraph || manifestOrGraph;
   const manifest = maybeGraph ? manifestOrGraph : graph.manifest;
-  const dependencies = new Map(graph.entries.map((entry) => [entry.source_path, entry.dependencies]));
+  const generated = new Map(graph.entries.map((entry) => [entry.source_path, entry]));
   const rendered = JSON.parse(JSON.stringify(manifest));
   for (const entry of rendered.entries) {
-    entry.dependencies = dependencies.get(posix(entry.source_path)) || [];
+    const row = generated.get(posix(entry.source_path));
+    if (!row) continue;
+    entry.dependencies = row.dependencies;
+    entry.sha256 = row.sha256;
   }
   return rendered;
 }
@@ -474,13 +489,18 @@ function manifestDependencyDrift(manifest, rendered) {
   for (let index = 0; index < rendered.entries.length; index += 1) {
     const expected = rendered.entries[index].dependencies || [];
     const actual = manifest.entries[index].dependencies || [];
-    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
+    const expectedSha256 = rendered.entries[index].sha256 || null;
+    const actualSha256 = manifest.entries[index].sha256 || null;
+    if (JSON.stringify(actual) !== JSON.stringify(expected)
+        || actualSha256 !== expectedSha256) {
       stale.push({
         source_path: rendered.entries[index].source_path,
         expected,
         actual,
+        expected_sha256: expectedSha256,
+        actual_sha256: actualSha256,
       });
     }
   }
@@ -516,7 +536,7 @@ function inspectProjectInstall(options = {}) {
   const requiredFiles = graph.files.map((row) => {
     let actual = null;
-    try { actual = digest(fs.readFileSync(row.target_path)); } catch (_) { /* Missing target. */ }
+    try { actual = normalizedSourceDigest(fs.readFileSync(row.target_path)); } catch (_) { /* Missing target. */ }
     return {
       ...row,
       kind: rootSources.has(row.relative_path) ? 'hook' : 'module',
@@ -601,7 +621,7 @@ function copyCandidateRows(report, candidateRoot) {
     rows.push({
       ...required,
       candidate_path: candidatePath,
-      candidate_sha256: digest(bytes),
+      candidate_sha256: normalizedSourceDigest(bytes),
       publication_path: required.target_path,
     });
   }
@@ -681,8 +701,8 @@ async function smokeCandidateProject(report, candidateRoot, options = {}) {
 
 function validateSealedRows(rows) {
   for (const row of rows) {
-    const sourceDigest = digest(fs.readFileSync(row.source_path));
-    const candidateDigest = digest(fs.readFileSync(row.candidate_path));
+    const sourceDigest = normalizedSourceDigest(fs.readFileSync(row.source_path));
+    const candidateDigest = normalizedSourceDigest(fs.readFileSync(row.candidate_path));
     if (sourceDigest !== row.expected_sha256 || candidateDigest !== row.expected_sha256) {
       const error = new Error(`candidate digest changed before publication: ${row.relative_path}`);
       error.code = 'HOOK_CANDIDATE_DIGEST_CHANGED';
@@ -893,5 +913,6 @@ module.exports = {
   formatProjectInstallStatus,
   inspectProjectInstall,
+  normalizedSourceDigest,
   renderManifestDependencies,
 };
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/tools/feature-propagation/audit.cjs
super-gsd/scripts/lib/hook-install-contract.cjs
VERIFICATION:
NOT RUN — bounded read-pack patch mode prohibited tool execution.
DEVIATIONS:
Committed JSON values were intentionally not hand-edited. Run audit.cjs --write-source-pins, then hook-install-contract.cjs --write-manifest. Expected regenerated witness pin: fd147b8d8abf4c3b84a012e62fee222b83f9adb53b289092e3636ae16b1139aa.
BLOCKERS:
Manifest pin values and final verification require the orchestrator to run the two generators after applying this patch.
ONE_LINER:
Canonicalized cross-platform source digests to CRLF-to-LF bytes across source pins, manifest generation, inspection, candidates, and delivery validation.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
