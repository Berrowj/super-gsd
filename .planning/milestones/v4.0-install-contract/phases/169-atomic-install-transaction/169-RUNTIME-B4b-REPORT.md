PATCH_BEGIN
diff --git a/super-gsd/tests/install-contract/assert-install-contract.cjs b/super-gsd/tests/install-contract/assert-install-contract.cjs
--- a/super-gsd/tests/install-contract/assert-install-contract.cjs
+++ b/super-gsd/tests/install-contract/assert-install-contract.cjs
@@ -468,13 +468,24 @@ async function emptyModuleTreeRealInstall() {
     assertSpawn(result, 'real empty-tree installation failed');
     const report = contract.inspectProjectInstall({ projectDir, sgsdRoot: SUPER_GSD_ROOT });
     assert.equal(report.requiredFiles.every((row) => row.status === 'current'), true);
-    assert.equal(report.requiredFiles.filter(
+    const computedFiles = computedFixtureRelativeFiles(report.graph, SUPER_GSD_ROOT)
+      .map((relative) => relative.replace(/\\/g, '/'));
+    const expectedHookFiles = computedFiles.filter(
+      (relative) => relative.startsWith('hooks/'),
+    );
+    const expectedModuleFiles = computedFiles.filter(
+      (relative) => relative.startsWith('scripts/lib/'),
+    );
+    const deliveredHookFiles = report.requiredFiles.filter(
       (row) => row.relative_path.startsWith('hooks/'),
-    ).length, 17, 'real install did not deliver all 17 hook files');
-    assert.equal(report.requiredFiles.filter(
+    ).map((row) => row.relative_path).sort();
+    const deliveredModuleFiles = report.requiredFiles.filter(
       (row) => row.relative_path.startsWith('scripts/lib/'),
-    ).length, 9, 'real install did not deliver all 9 scripts/lib modules');
+    ).map((row) => row.relative_path).sort();
+    assert.deepEqual(deliveredHookFiles, expectedHookFiles,
+      `real install did not deliver all ${expectedHookFiles.length} computed hook files`);
+    assert.deepEqual(deliveredModuleFiles, expectedModuleFiles,
+      `real install did not deliver all ${expectedModuleFiles.length} computed scripts/lib modules`);
     assert.deepEqual(inventory(decoy), [], 'explicit project install touched decoy cwd');
     assert.ok(finalHookExecutions(projectDir, env) > 0, 'no final installed hook was executed');
 
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/tests/install-contract/assert-install-contract.cjs
VERIFICATION:
Not run; executor was restricted to the supplied read-pack.
DEVIATIONS:
None.
BLOCKERS:
None.
ONE_LINER:
Replaced literal closure counts with exact runtime-derived hook and module file-list assertions.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
