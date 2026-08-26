PATCH_BEGIN
diff --git a/super-gsd/tests/install-contract/assert-install-contract.cjs b/super-gsd/tests/install-contract/assert-install-contract.cjs
--- a/super-gsd/tests/install-contract/assert-install-contract.cjs
+++ b/super-gsd/tests/install-contract/assert-install-contract.cjs
@@ -536,7 +536,7 @@ async function doctorRealGitWorktreeStaleness() {
   const root = fixtureRoot('doctor worktree');
   try {
     const fakeRevision = 'a'.repeat(40);
-    const formatted = contract.formatProjectInstallStatus(Object.freeze({
+    const formattedRequiredFiles = [
+      { kind: 'hook', relative_path: 'hooks\\missing.cjs', status: 'missing',
+        expected_sha256: '1'.repeat(64), actual_sha256: null },
+      { kind: 'hook', relative_path: 'hooks/stale.cjs', status: 'stale',
+        expected_sha256: '2'.repeat(64), actual_sha256: '3'.repeat(64) },
+      { kind: 'module', relative_path: 'scripts\\lib\\missing.cjs', status: 'missing',
+        expected_sha256: '4'.repeat(64), actual_sha256: null },
+      { kind: 'module', relative_path: 'scripts/lib/stale.cjs', status: 'stale',
+        expected_sha256: '5'.repeat(64), actual_sha256: '6'.repeat(64) },
+      { kind: 'hook', relative_path: 'hooks/current.cjs', status: 'current',
+        expected_sha256: '7'.repeat(64), actual_sha256: '7'.repeat(64) },
+      { kind: 'module', relative_path: 'scripts/lib/current.cjs', status: 'current',
+        expected_sha256: '8'.repeat(64), actual_sha256: '8'.repeat(64) },
+    ];
+    const formatted = contract.formatProjectInstallStatus(Object.freeze({
       ok: false,
       project_dir: path.join(root, 'formatter project'),
       canonical_source_revision: fakeRevision,
-      requiredFiles: [
-        { kind: 'hook', relative_path: 'hooks\\missing.cjs', status: 'missing',
-          expected_sha256: '1'.repeat(64), actual_sha256: null },
-        { kind: 'hook', relative_path: 'hooks/stale.cjs', status: 'stale',
-          expected_sha256: '2'.repeat(64), actual_sha256: '3'.repeat(64) },
-        { kind: 'module', relative_path: 'scripts\\lib\\missing.cjs', status: 'missing',
-          expected_sha256: '4'.repeat(64), actual_sha256: null },
-        { kind: 'module', relative_path: 'scripts/lib/stale.cjs', status: 'stale',
-          expected_sha256: '5'.repeat(64), actual_sha256: '6'.repeat(64) },
-        { kind: 'hook', relative_path: 'hooks/current.cjs', status: 'current',
-          expected_sha256: '7'.repeat(64), actual_sha256: '7'.repeat(64) },
-        { kind: 'module', relative_path: 'scripts/lib/current.cjs', status: 'current',
-          expected_sha256: '8'.repeat(64), actual_sha256: '8'.repeat(64) },
-      ],
+      requiredFiles: formattedRequiredFiles,
     }));
+    const formattedCurrent = formattedRequiredFiles.filter((row) => row.status === 'current');
+    const formattedCurrentHooks = formattedCurrent.filter((row) => row.kind === 'hook');
+    const formattedCurrentModules = formattedCurrent.filter((row) => row.kind === 'module');
     assert.match(formatted, /Project install status: drift/);
     assert.equal(formatted.includes('Canonical source revision: ' + fakeRevision), true);
     assert.equal(formatted.includes(
@@ -559,7 +559,11 @@ async function doctorRealGitWorktreeStaleness() {
       + 'module path=scripts/lib/stale.cjs expected_sha256=' + '5'.repeat(64)
       + ' actual_sha256=' + '6'.repeat(64),
     ), true);
-    assert.match(formatted, /Current rows: hooks=1 modules=1 total=2\/6/);
+    assert.equal(formatted.includes(
+      `Current rows: hooks=${formattedCurrentHooks.length}`
+      + ` modules=${formattedCurrentModules.length}`
+      + ` total=${formattedCurrent.length}/${formattedRequiredFiles.length}`,
+    ), true);
     assert.doesNotMatch(formatted, /hooks\/current\.cjs|scripts\/lib\/current\.cjs/);
 
     const repository = path.join(root, 'primary repository');
@@ -456,14 +456,34 @@ async function emptyModuleTreeRealInstall() {
     ], { cwd: decoy, env });
     assertSpawn(result, 'real empty-tree installation failed');
     const report = contract.inspectProjectInstall({ projectDir, sgsdRoot: SUPER_GSD_ROOT });
+    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
+    const graph = contract.computeHookDependencyGraph({
+      sgsdRoot: SUPER_GSD_ROOT,
+      manifest,
+      projectDir,
+    });
+    const generatedManifest = contract.renderManifestDependencies(manifest, graph);
+    const projectEntries = generatedManifest.entries.filter(
+      (entry) => entry.distribution_targets.some((target) => target.endsWith('-project')),
+    );
+    const expectedHookFiles = [...new Set(projectEntries
+      .map((entry) => entry.source_path)
+      .filter((relative) => relative.startsWith('hooks/')))].sort();
+    const expectedModuleFiles = [...new Set(projectEntries
+      .flatMap((entry) => entry.dependencies || [])
+      .filter((relative) => relative.startsWith('scripts/lib/')))].sort();
+    const deliveredHookFiles = report.requiredFiles
+      .filter((row) => row.relative_path.startsWith('hooks/'))
+      .map((row) => row.relative_path)
+      .sort();
+    const deliveredModuleFiles = report.requiredFiles
+      .filter((row) => row.relative_path.startsWith('scripts/lib/'))
+      .map((row) => row.relative_path)
+      .sort();
     assert.equal(report.requiredFiles.every((row) => row.status === 'current'), true);
-    assert.equal(report.requiredFiles.filter(
-      (row) => row.relative_path.startsWith('hooks/'),
-    ).length, 17, 'real install did not deliver all 17 hook files');
-    assert.equal(report.requiredFiles.filter(
-      (row) => row.relative_path.startsWith('scripts/lib/'),
-    ).length, 9, 'real install did not deliver all 9 scripts/lib modules');
+    assert.deepEqual(deliveredHookFiles, expectedHookFiles,
+      'real install did not deliver the computed hook files');
+    assert.deepEqual(deliveredModuleFiles, expectedModuleFiles,
+      'real install did not deliver the computed scripts/lib modules');
     assert.deepEqual(inventory(decoy), [], 'explicit project install touched decoy cwd');
     assert.ok(finalHookExecutions(projectDir, env) > 0, 'no final installed hook was executed');
 
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/tests/install-contract/assert-install-contract.cjs
VERIFICATION:
Not run; bounded read-pack execution.
DEVIATIONS:
None.
BLOCKERS:
None.
ONE_LINER:
Derived installed hook/module file assertions from the runtime dependency graph and removed formatter row-count literals.
REPORT_END
