PATCH_BEGIN
diff --git a/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs b/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
--- a/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
+++ b/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
@@ -170,18 +170,27 @@ function operatorRowsBytes(settings) {
   }));
 }
 
-let classifiedFixturePackageRows = null;
+let classifiedFixtureDependencyGraph = null;
 
-function fixturePackageRows() {
-  if (classifiedFixturePackageRows === null) {
+function fixtureDependencyGraph() {
+  if (classifiedFixtureDependencyGraph === null) {
     const { computeHookDependencyGraph } = require(HOOK_INSTALL_CONTRACT_PATH);
-    classifiedFixturePackageRows = computeHookDependencyGraph({ sgsdRoot: SUPER_GSD_ROOT }).packages;
+    classifiedFixtureDependencyGraph = computeHookDependencyGraph({
+      sgsdRoot: SUPER_GSD_ROOT,
+    });
   }
-  return classifiedFixturePackageRows;
+  return classifiedFixtureDependencyGraph;
 }
 
-function resolveFixturePackageRoot(packageName) {
+function fixturePackageRows() {
+  return fixtureDependencyGraph().packages;
+}
+
+function resolveFixturePackageRoot(packageName, sourcePath = null) {
   let resolvedEntry;
-  try {
-    resolvedEntry = require.resolve(packageName, { paths: [REPOSITORY_ROOT] });
-  } catch (cause) {
+  const preferredEntry = typeof sourcePath === 'string'
+    ? (path.isAbsolute(sourcePath) ? sourcePath : path.resolve(SUPER_GSD_ROOT, sourcePath))
+    : null;
+  if (preferredEntry && fs.existsSync(preferredEntry)) {
+    resolvedEntry = preferredEntry;
+  } else try {
+    resolvedEntry = require.resolve(packageName, { paths: [SUPER_GSD_ROOT, REPOSITORY_ROOT] });
+  } catch (cause) {
     const error = new Error(`fixture bare package is missing: ${packageName}: ${cause.message}`);
     error.code = 'FIXTURE_PACKAGE_MISSING';
     error.package = packageName;
@@ -223,29 +232,16 @@ function resolveFixturePackageRoot(packageName) {
   throw error;
 }
 
-function linkFixturePackage(packageName, sourceRoot, fixturePath) {
+function copyFixturePackage(packageName, sourceRoot, fixturePath) {
   fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
-  let mechanism = process.platform === 'win32' ? 'junction' : 'symlink';
   try {
-    fs.symlinkSync(sourceRoot, fixturePath, process.platform === 'win32' ? 'junction' : 'dir');
-  } catch (linkError) {
-    mechanism = 'copy';
-    try {
-      fs.cpSync(sourceRoot, fixturePath, { recursive: true });
-    } catch (copyError) {
-      const error = new Error(
-        `fixture bare package provisioning failed: ${packageName}: `
-        + `link=${linkError.message}; copy=${copyError.message}`,
-      );
-      error.code = 'FIXTURE_PACKAGE_PROVISION_FAILED';
-      error.package = packageName;
-      error.cause = copyError;
-      throw error;
-    }
+    fs.cpSync(sourceRoot, fixturePath, { recursive: true, dereference: true });
+  } catch (cause) {
+    const error = new Error(`fixture bare package provisioning failed: ${packageName}: ${cause.message}`);
+    error.code = 'FIXTURE_PACKAGE_PROVISION_FAILED';
+    error.package = packageName;
+    error.cause = cause;
+    throw error;
   }
   return {
     fixture_path: fixturePath,
-    mechanism,
+    mechanism: 'copy',
     package: packageName,
     source_root: sourceRoot,
   };
@@ -254,9 +250,9 @@ function linkFixturePackage(packageName, sourceRoot, fixturePath) {
 function provisionFixtureHookPackages(fixtureRoot) {
   return fixturePackageRows().map((packageRow) => {
     const packageName = packageRow.package;
-    const sourceRoot = resolveFixturePackageRoot(packageName);
+    const sourceRoot = resolveFixturePackageRoot(packageName, packageRow.source_path);
     const fixturePath = path.join(fixtureRoot, 'node_modules', ...packageName.split('/'));
-    return linkFixturePackage(packageName, sourceRoot, fixturePath);
+    return copyFixturePackage(packageName, sourceRoot, fixturePath);
   });
 }
 
@@ -288,17 +284,51 @@ function fixturePackageRelativePath(packageRow) {
   }
 }
 
+function fixtureDependencyRelativeFiles() {
+  const relativeFiles = new Set();
+  const visited = new Set();
+  const visit = (value) => {
+    if (typeof value === 'string') {
+      const absolute = path.isAbsolute(value)
+        ? path.resolve(value)
+        : path.resolve(SUPER_GSD_ROOT, value);
+      const relative = path.relative(SUPER_GSD_ROOT, absolute);
+      if (!relative || path.isAbsolute(relative) || relative === '..'
+          || relative.startsWith(`..${path.sep}`)
+          || relative.split(path.sep).includes('node_modules')) return;
+      try {
+        if (fs.statSync(absolute).isFile()) relativeFiles.add(relative);
+      } catch (_) { /* Graph metadata also contains non-path strings. */ }
+      return;
+    }
+    if (!value || typeof value !== 'object' || visited.has(value)) return;
+    visited.add(value);
+    if (value instanceof Map || value instanceof Set) {
+      for (const child of value.values()) visit(child);
+      return;
+    }
+    for (const child of Object.values(value)) visit(child);
+  };
+  // This covers graph files, union rows, entry roots/dependencies, and declared
+  // roots without maintaining a second fixture inventory.
+  visit(fixtureDependencyGraph());
+  return [...relativeFiles].sort();
+}
+
+function copyFixtureDependencyFiles(vendoredRoot) {
+  for (const relative of fixtureDependencyRelativeFiles()) {
+    const target = path.join(vendoredRoot, relative);
+    fs.mkdirSync(path.dirname(target), { recursive: true });
+    fs.copyFileSync(path.join(SUPER_GSD_ROOT, relative), target);
+  }
+}
+
 function provisionFixtureSourcePackages(vendoredRoot) {
   return fixturePackageRows().map((packageRow) => {
     const packageName = packageRow.package;
-    const sourceRoot = resolveFixturePackageRoot(packageName);
-    return linkFixturePackage(
+    const sourceRoot = resolveFixturePackageRoot(packageName, packageRow.source_path);
+    return copyFixturePackage(
       packageName,
       sourceRoot,
       path.join(vendoredRoot, fixturePackageRelativePath(packageRow)),
@@ -337,6 +367,7 @@ function copyFixtureSupport(projectRoot, options = {}) {
     path.join(vendoredRoot, 'tools', 'substrate-capability-broker.cjs'),
   );
+  copyFixtureDependencyFiles(vendoredRoot);
   if (options.provisionPackages !== false) provisionFixtureSourcePackages(vendoredRoot);
   return vendoredRoot;
 }
@@ -669,23 +700,13 @@ function assertFixtureBarePackageSupport() {
     const provisioned = provisionFixtureHookPackages(root);
     assert.deepEqual(provisioned.map((row) => row.package).sort(), expected);
     for (const row of provisioned) {
-      assert.ok(fs.existsSync(row.fixture_path), `fixture package link is missing: ${row.package}`);
-      assert.ok(['junction', 'symlink', 'copy'].includes(row.mechanism),
-        `fixture package used an unknown provisioning mechanism: ${row.package}`);
-      if (row.mechanism === 'copy') {
-        assert.equal(fs.lstatSync(row.fixture_path).isSymbolicLink(), false,
-          `fixture package copy fallback remained a link: ${row.package}`);
-      } else {
-        assert.equal(fs.lstatSync(row.fixture_path).isSymbolicLink(), true,
-          `fixture package was copied while linking was available: ${row.package}`);
-        assert.equal(
-          fs.realpathSync(row.fixture_path),
-          fs.realpathSync(row.source_root),
-          `fixture package link does not target the resolved package root: ${row.package}`,
-        );
-      }
+      assert.ok(fs.existsSync(row.fixture_path), `fixture package copy is missing: ${row.package}`);
+      assert.equal(row.mechanism, 'copy',
+        `fixture package was not provisioned as a copy: ${row.package}`);
+      assert.equal(fs.lstatSync(row.fixture_path).isSymbolicLink(), false,
+        `fixture package copy remained a link: ${row.package}`);
       assert.ok(
         require.resolve(row.package, { paths: [path.join(root, 'consumer with spaces')] }),
         `fixture package cannot be required: ${row.package}`,
diff --git a/super-gsd/tests/install-contract/assert-install-contract.cjs b/super-gsd/tests/install-contract/assert-install-contract.cjs
--- a/super-gsd/tests/install-contract/assert-install-contract.cjs
+++ b/super-gsd/tests/install-contract/assert-install-contract.cjs
@@ -54,6 +54,91 @@ function copyTree(source, target) {
   fs.cpSync(source, target, { recursive: true });
 }
 
+function computedFixtureRelativeFiles(graph, sourceRoot) {
+  const files = new Set();
+  const visited = new Set();
+  const visit = (value) => {
+    if (typeof value === 'string') {
+      const absolute = path.isAbsolute(value)
+        ? path.resolve(value)
+        : path.resolve(sourceRoot, value);
+      const relative = path.relative(sourceRoot, absolute);
+      if (!relative || path.isAbsolute(relative) || relative === '..'
+          || relative.startsWith(`..${path.sep}`)
+          || relative.split(path.sep).includes('node_modules')) return;
+      try {
+        if (fs.statSync(absolute).isFile()) files.add(relative);
+      } catch (_) { /* Graph metadata also contains non-path strings. */ }
+      return;
+    }
+    if (!value || typeof value !== 'object' || visited.has(value)) return;
+    visited.add(value);
+    if (value instanceof Map || value instanceof Set) {
+      for (const child of value.values()) visit(child);
+      return;
+    }
+    for (const child of Object.values(value)) visit(child);
+  };
+  // Walk files, union, entry dependencies, packages, and declared roots from
+  // the computed graph instead of maintaining a parallel fixture list.
+  visit(graph);
+  return [...files].sort();
+}
+
+function resolvedFixturePackageRoot(packageRow, sourceRoot) {
+  let resolved = typeof packageRow.source_path === 'string'
+    ? (path.isAbsolute(packageRow.source_path)
+      ? packageRow.source_path
+      : path.resolve(sourceRoot, packageRow.source_path))
+    : null;
+  if (!resolved || !fs.existsSync(resolved)) {
+    resolved = require.resolve(packageRow.package, {
+      paths: [sourceRoot, path.dirname(sourceRoot)],
+    });
+  }
+  let current = fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
+  while (true) {
+    const packageJsonPath = path.join(current, 'package.json');
+    if (fs.existsSync(packageJsonPath)) {
+      try {
+        if (JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).name === packageRow.package) {
+          return current;
+        }
+      } catch (_) { /* Continue to the resolved package root. */ }
+    }
+    const parent = path.dirname(current);
+    if (parent === current) break;
+    current = parent;
+  }
+  throw new Error(`fixture package root is missing: ${packageRow.package}`);
+}
+
+function fixturePackageRelativeRoot(packageRow, packageRoot, sourceRoot) {
+  const relative = path.relative(sourceRoot, packageRoot);
+  if (relative && !path.isAbsolute(relative) && relative !== '..'
+      && !relative.startsWith(`..${path.sep}`)) return relative;
+  return path.join('node_modules', ...packageRow.package.split('/'));
+}
+
+function copyComputedFixtureClosure(targetRoot) {
+  const contract = require(CONTRACT_PATH);
+  const graph = contract.computeHookDependencyGraph({ sgsdRoot: SUPER_GSD_ROOT });
+  for (const relative of computedFixtureRelativeFiles(graph, SUPER_GSD_ROOT)) {
+    const target = path.join(targetRoot, relative);
+    fs.mkdirSync(path.dirname(target), { recursive: true });
+    fs.copyFileSync(path.join(SUPER_GSD_ROOT, relative), target);
+  }
+  for (const packageRow of graph.packages) {
+    const packageRoot = resolvedFixturePackageRoot(packageRow, SUPER_GSD_ROOT);
+    const target = path.join(
+      targetRoot,
+      fixturePackageRelativeRoot(packageRow, packageRoot, SUPER_GSD_ROOT),
+    );
+    fs.mkdirSync(path.dirname(target), { recursive: true });
+    fs.cpSync(packageRoot, target, { recursive: true, dereference: true });
+  }
+}
+
 function run(command, args, options = {}) {
   return spawnSync(command, args, {
     cwd: options.cwd,
@@ -91,6 +176,7 @@ function syntheticManifest(sourcePath) {
 
 function generatedResolutionFixture(root) {
   const sgsdRoot = path.join(root, 'upstream seed', 'super-gsd');
+  copyComputedFixtureClosure(sgsdRoot);
   const generated = [];
   const add = (relative, source) => {
     write(path.join(sgsdRoot, relative), source);
PATCH_END
REPORT_BEGIN
FILES_CHANGED: Both allowed fixture-builder tests.
VERIFICATION: Not run; executor was restricted to the supplied read-pack.
DEVIATIONS: None.
BLOCKERS: None.
ONE_LINER: Fixtures now copy computed closure files, declared roots, and resolved package roots without symlinks.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
