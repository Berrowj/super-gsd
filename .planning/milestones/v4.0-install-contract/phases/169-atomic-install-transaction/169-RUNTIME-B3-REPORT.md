PATCH_BEGIN
diff --git a/super-gsd/tests/install-contract/assert-install-contract.cjs b/super-gsd/tests/install-contract/assert-install-contract.cjs
--- a/super-gsd/tests/install-contract/assert-install-contract.cjs
+++ b/super-gsd/tests/install-contract/assert-install-contract.cjs
@@ -298,12 +298,24 @@ async function generatedTransitiveManifest() {
   const root = fixtureRoot('generated');
   try {
     const fixture = generatedResolutionFixture(root);
+    const declaredRootEntry = 'hooks/generated-declared-root-entry.cjs';
+    write(path.join(fixture.sgsdRoot, declaredRootEntry), 'module.exports = true;\n');
+    const declaredRootGraph = contract.computeHookDependencyGraph({
+      sgsdRoot: fixture.sgsdRoot,
+      manifest: syntheticManifest(declaredRootEntry),
+      projectDir: path.join(root, 'target project'),
+    });
+    fs.rmSync(path.join(fixture.sgsdRoot, declaredRootEntry));
+    const expectedDependencies = [...new Set([
+      ...fixture.generated,
+      ...declaredRootGraph.entries[0].dependencies,
+    ])].sort();
     const graph = contract.computeHookDependencyGraph({
       sgsdRoot: fixture.sgsdRoot,
       manifest: fixture.manifest,
       projectDir: path.join(root, 'target project'),
     });
-    assert.deepEqual(graph.entries[0].dependencies, fixture.generated);
+    assert.deepEqual(graph.entries[0].dependencies, expectedDependencies);
     for (const observed of loaderTrace(
       path.join(fixture.sgsdRoot, 'hooks', 'generated-entry.cjs'), fixture.sgsdRoot,
     )) {
@@ -313,7 +325,7 @@ async function generatedTransitiveManifest() {
     assert.deepEqual(graph.packages.map((row) => row.package), ['fixture-package']);
     assert.deepEqual(
       contract.renderManifestDependencies(fixture.manifest, graph).entries[0].dependencies,
-      fixture.generated,
+      expectedDependencies,
     );
     const report = contract.inspectProjectInstall({
       sgsdRoot: fixture.sgsdRoot,
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/tests/install-contract/assert-install-contract.cjs (14 lines added, 2 changed)
VERIFICATION:
Not run; executor was instructed not to call tools.
DEVIATIONS:
None.
BLOCKERS:
None.
ONE_LINER:
Expected dependencies now union synthetic files with independently computed declared-root closure.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
