PATCH_BEGIN
diff --git a/super-gsd/scripts/lib/hook-install-contract.cjs b/super-gsd/scripts/lib/hook-install-contract.cjs
--- a/super-gsd/scripts/lib/hook-install-contract.cjs
+++ b/super-gsd/scripts/lib/hook-install-contract.cjs
@@ -14,6 +14,12 @@ const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');
 const DOUBLE_QUOTE = String.fromCharCode(34);
 const SINGLE_QUOTE = String.fromCharCode(39);
 
+// Runtime assets and spawn roots are invisible to require-expression lexing.
+const DECLARED_ROOTS = Object.freeze([
+  Object.freeze({ relative_path: 'schemas/vtp-mcp-input-schemas.v2.json', walk: false }),
+  Object.freeze({ relative_path: 'scripts/lib/decision-state.cjs', walk: true }),
+]);
+
 function posix(value) {
   return value.replace(/\\/g, '/');
 }
@@ -296,6 +302,58 @@ function packageName(request) {
   return bare.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
 }
 
+function vendoredPackageDescriptor(sgsdRoot, candidatePath) {
+  const resolved = path.resolve(candidatePath);
+  if (!inside(sgsdRoot, resolved)) return null;
+  const parts = path.relative(sgsdRoot, resolved).split(path.sep);
+  let markerIndex = -1;
+  for (let index = 0; index < parts.length; index += 1) {
+    if (parts[index].toLowerCase() === 'node_modules') markerIndex = index;
+  }
+  if (markerIndex < 0 || markerIndex + 1 >= parts.length) return null;
+  const scoped = parts[markerIndex + 1].startsWith('@');
+  const packageEnd = markerIndex + (scoped ? 3 : 2);
+  if (packageEnd > parts.length) return null;
+  const name = parts.slice(markerIndex + 1, packageEnd).join('/');
+  const packageRoot = path.join(sgsdRoot, ...parts.slice(0, packageEnd));
+  const packagePath = path.join(packageRoot, 'package.json');
+  try {
+    if (!fs.statSync(packagePath).isFile()) return null;
+  } catch (_) {
+    return null;
+  }
+  return {
+    name,
+    packageRoot,
+    modulesRoot: path.join(sgsdRoot, ...parts.slice(0, markerIndex + 1)),
+  };
+}
+
+function resolveVendoredPackageRoot(name, fromPackageRoot, vendoredModulesRoot) {
+  const modulesRoot = path.resolve(vendoredModulesRoot);
+  const boundary = path.dirname(modulesRoot);
+  const nameParts = name.split('/');
+  let current = path.resolve(fromPackageRoot);
+  while (inside(boundary, current)) {
+    const searchRoot = path.basename(current).toLowerCase() === 'node_modules'
+      ? current
+      : path.join(current, 'node_modules');
+    const candidate = path.join(searchRoot, ...nameParts);
+    const packagePath = path.join(candidate, 'package.json');
+    try {
+      if (inside(modulesRoot, candidate)
+          && fs.statSync(candidate).isDirectory()
+          && fs.statSync(packagePath).isFile()) {
+        return candidate;
+      }
+    } catch (_) {
+      // Continue through the bounded vendored Node resolution ancestry.
+    }
+    if (current === boundary) break;
+    const parent = path.dirname(current);
+    if (parent === current) break;
+    current = parent;
+  }
+  return null;
+}
+
 function loadManifest(options, sgsdRoot) {
   if (options.manifest) return JSON.parse(JSON.stringify(options.manifest));
   const manifestPath = path.resolve(options.manifestPath
@@ -306,6 +364,21 @@ function computeHookDependencyGraph(options = {}) {
   const sgsdRoot = path.resolve(options.sgsdRoot || DEFAULT_ROOT);
   const runtimeRoot = path.resolve(options.projectDir || path.dirname(sgsdRoot));
   const runtimeSgsdRoot = path.join(runtimeRoot, 'super-gsd');
+  const declaredRoots = DECLARED_ROOTS.map((row) => {
+    const absolutePath = path.resolve(sgsdRoot, row.relative_path);
+    let present = false;
+    try {
+      present = inside(sgsdRoot, absolutePath) && fs.statSync(absolutePath).isFile();
+    } catch (_) {
+      present = false;
+    }
+    if (!present) {
+      throw dependencyError('MODULE_NOT_FOUND', row.relative_path, row.relative_path,
+        row.relative_path, path.join(runtimeSgsdRoot, row.relative_path),
+        inside(sgsdRoot, absolutePath) ? 'declared root is missing' : 'declared root escapes root');
+    }
+    return { ...row, absolute_path: absolutePath };
+  });
   const manifest = loadManifest(options, sgsdRoot);
   const selected = manifest.entries.filter((entry) => Array.isArray(entry.distribution_targets)
     && entry.distribution_targets.some((target) => PROJECT_TARGETS.has(target)));
@@ -325,6 +398,7 @@ function computeHookDependencyGraph(options = {}) {
     const closure = new Set();
     const visited = new Set();
     const entryPackages = new Set();
+    const visitedPackages = new Set();
 
     function addFile(absolutePath) {
       const resolved = path.resolve(absolutePath);
@@ -335,6 +409,65 @@ function computeHookDependencyGraph(options = {}) {
       closure.add(posix(path.relative(sgsdRoot, resolved)));
     }
 
+    function recordPackage(name, location) {
+      if (!packages.has(name)) packages.set(name, new Set());
+      packages.get(name).add(rootRelative);
+      entryPackages.add(name);
+      if (!packageLocations.has(name) || (!packageLocations.get(name) && location)) {
+        packageLocations.set(name, location || null);
+      }
+    }
+
+    function addPackageFiles(directory) {
+      const children = fs.readdirSync(directory, { withFileTypes: true })
+        .sort((left, right) => left.name.localeCompare(right.name));
+      for (const child of children) {
+        if (child.isDirectory() && child.name.toLowerCase() === 'node_modules') continue;
+        const childPath = path.join(directory, child.name);
+        if (child.isDirectory()) {
+          addPackageFiles(childPath);
+        } else if (child.isFile() || child.isSymbolicLink()) {
+          let file = false;
+          try { file = fs.statSync(childPath).isFile(); } catch (_) { file = false; }
+          if (file) addFile(childPath);
+        }
+      }
+    }
+
+    function addVendoredPackageClosure(descriptor, vendoredModulesRoot = descriptor.modulesRoot) {
+      const canonicalRoot = path.resolve(descriptor.packageRoot);
+      if (visitedPackages.has(canonicalRoot)) return;
+      visitedPackages.add(canonicalRoot);
+      recordPackage(descriptor.name, canonicalRoot);
+
+      const packagePath = path.join(canonicalRoot, 'package.json');
+      let packageRow;
+      try {
+        packageRow = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
+      } catch (error) {
+        throw dependencyError(error && error.code || 'MODULE_NOT_FOUND',
+          posix(path.relative(sgsdRoot, packagePath)), packagePath, descriptor.name,
+          path.join(runtimeSgsdRoot, path.relative(sgsdRoot, packagePath)),
+          'vendored package metadata is unreadable');
+      }
+      addPackageFiles(canonicalRoot);
+
+      const declaredDependencies = packageRow
+        && packageRow.dependencies
+        && typeof packageRow.dependencies === 'object'
+        && !Array.isArray(packageRow.dependencies)
+        ? Object.keys(packageRow.dependencies).sort()
+        : [];
+      for (const dependencyName of declaredDependencies) {
+        const dependencyRoot = resolveVendoredPackageRoot(
+          dependencyName,
+          canonicalRoot,
+          vendoredModulesRoot,
+        );
+        if (!dependencyRoot) {
+          throw dependencyError('MODULE_NOT_FOUND',
+            posix(path.relative(sgsdRoot, packagePath)), dependencyName, dependencyName,
+            path.join(runtimeSgsdRoot, path.relative(
+              sgsdRoot,
+              path.join(vendoredModulesRoot, ...dependencyName.split('/')),
+            )), 'vendored package dependency is missing');
+        }
+        addVendoredPackageClosure({
+          name: dependencyName,
+          packageRoot: dependencyRoot,
+          modulesRoot: vendoredModulesRoot,
+        }, vendoredModulesRoot);
+      }
+    }
+
     function walk(sourcePath) {
       const canonical = path.resolve(sourcePath);
       if (visited.has(canonical)) return;
@@ -351,26 +484,18 @@ function computeHookDependencyGraph(options = {}) {
         }
         if (BUILTINS.has(request)) continue;
         if (!request.startsWith('.') && !path.isAbsolute(request)) {
-          const name = packageName(request);
-          if (!packages.has(name)) packages.set(name, new Set());
-          packages.get(name).add(rootRelative);
-          entryPackages.add(name);
-          if (!packageLocations.has(name)) {
-            let location = null;
-            try { location = require.resolve(request, { paths: [path.dirname(canonical)] }); } catch (_) { /* Classified absent package. */ }
-            packageLocations.set(name, location);
+          const name = packageName(request);
+          let location = null;
+          try {
+            location = require.resolve(request, { paths: [path.dirname(canonical)] });
+          } catch (_) {
+            // Classified as an absent package after graph construction.
           }
-          continue;
-        }
-        if (posix(request).includes('/node_modules/')) {
-          const name = packageName(request);
-          if (!packages.has(name)) packages.set(name, new Set());
-          packages.get(name).add(rootRelative);
-          entryPackages.add(name);
-          if (!packageLocations.has(name)) packageLocations.set(name, request);
+          recordPackage(name, location);
+          const vendored = location && vendoredPackageDescriptor(sgsdRoot, location);
+          if (vendored) addVendoredPackageClosure(vendored);
           continue;
         }
         let requestedPath;
@@ -400,13 +525,20 @@ function computeHookDependencyGraph(options = {}) {
             expression, request, targetMissingPath, 'source module is missing');
         }
+        const vendored = vendoredPackageDescriptor(sgsdRoot, resolution.file);
+        if (vendored) {
+          addVendoredPackageClosure(vendored);
+          continue;
+        }
         for (const supportPath of resolution.support) addFile(supportPath);
         addFile(resolution.file);
         walk(resolution.file);
       }
     }
 
     walk(rootSource);
+    for (const declaredRoot of declaredRoots) {
+      addFile(declaredRoot.absolute_path);
+      if (declaredRoot.walk) walk(declaredRoot.absolute_path);
+    }
     closure.delete(rootRelative);
     const dependencies = [...closure].sort();
     const entryRow = {
diff --git a/super-gsd/hooks/sgsd-substrate-invocation-witness.cjs b/super-gsd/hooks/sgsd-substrate-invocation-witness.cjs
--- a/super-gsd/hooks/sgsd-substrate-invocation-witness.cjs
+++ b/super-gsd/hooks/sgsd-substrate-invocation-witness.cjs
@@ -26,6 +26,38 @@ function loadProjectRuntime(projectRoot) {
   };
 }
 
+function boundedOneLine(value, maxBytes = 512) {
+  const oneLine = String(value || '')
+    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
+    .replace(/\s+/g, ' ')
+    .trim();
+  const bytes = Buffer.from(oneLine, 'utf8');
+  if (bytes.length <= maxBytes) return oneLine;
+  return bytes.subarray(0, maxBytes).toString('utf8').replace(/\uFFFD$/u, '');
+}
+
+function runtimeLoadFailureReason(error) {
+  const rawCode = error && error.code ? error.code : 'RUNTIME_LOAD_FAILED';
+  const code = String(rawCode).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 64)
+    || 'RUNTIME_LOAD_FAILED';
+  const rawMessage = error && typeof error.message === 'string'
+    ? error.message
+    : 'project runtime failed to load';
+  const kept = [];
+  for (const line of rawMessage.replace(/\r\n?/g, '\n').split('\n')) {
+    if (/^\s*Require stack:\s*$/i.test(line) || /^\s*at\s+/.test(line)) break;
+    if (/^\s*-\s+/.test(line) && kept.length > 0) break;
+    kept.push(line);
+  }
+  const message = boundedOneLine(kept.join(' ')) || 'project runtime failed to load';
+  return 'project_runtime_unavailable;underlying_error=' + JSON.stringify({
+    code,
+    message,
+  });
+}
+
 function preDecision(decision, reason) {
   const output = {
     hookEventName: 'PreToolUse',
@@ -266,11 +298,11 @@ function processHookPayload(payload, options = {}) {
   let runtime;
   try {
     runtime = loadProjectRuntime(projectRoot);
-  } catch (_) {
+  } catch (error) {
+    const reason = runtimeLoadFailureReason(error);
     return payload.hook_event_name === 'PostToolUse'
-      ? rewriteFailure('project_runtime_unavailable')
-      : deny('project_runtime_unavailable');
+      ? rewriteFailure(reason)
+      : deny(reason);
   }
   const env = options.env || process.env;
   if (payload.hook_event_name === 'PreToolUse') return handlePre(payload, projectRoot, runtime, env);
diff --git a/super-gsd/scripts/lib/hook-registration-preflight.cjs b/super-gsd/scripts/lib/hook-registration-preflight.cjs
--- a/super-gsd/scripts/lib/hook-registration-preflight.cjs
+++ b/super-gsd/scripts/lib/hook-registration-preflight.cjs
@@ -75,10 +75,13 @@ function sanitizedBoundedLine(value, maxBytes = 2048) {
 
 function moduleFailureDetail(output, options = {}) {
   const message = sanitizedBoundedLine(output);
-  if (!/MODULE_NOT_FOUND|Cannot find module/.test(message)) return {
+  const codeMatch = message.match(/\b(ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND)\b/);
+  if (!codeMatch && !/Cannot find (?:module|package)/.test(message)) return {
     code: 'HOOK_PROCESS_FAILED',
     request: null,
     path: null,
     message,
   };
-  const requestMatch = message.match(/Cannot find module\s+['\u0022]([^'\u0022]+)['\u0022]/);
+  const requestMatch = message.match(
+    /Cannot find (?:module|package)\s+['\u0022]([^'\u0022]+)['\u0022]/,
+  );
   const request = requestMatch ? requestMatch[1] : null;
   let resolvedPath = request && path.isAbsolute(request) ? path.resolve(request) : null;
   if (resolvedPath && options.candidateRoot && options.targetRoot) {
@@ -89,13 +92,34 @@ function moduleFailureDetail(output, options = {}) {
     }
   }
   return {
-    code: 'MODULE_NOT_FOUND',
+    code: codeMatch ? codeMatch[1] : 'MODULE_NOT_FOUND',
     request,
     path: resolvedPath,
     message,
   };
 }
 
+function carriedRuntimeLoadFailureDetail(output, options = {}) {
+  const message = sanitizedBoundedLine(output);
+  const runtimeUnavailable = /substrate_witness_(?:denied|rewrite_failed):project_runtime_unavailable\b/i
+    .test(message);
+  const carriesUnderlyingError = /\bunderlying_?error(?:_code)?\b/i.test(message);
+  if (!runtimeUnavailable && !carriesUnderlyingError) return null;
+
+  const moduleFailure = moduleFailureDetail(message, options);
+  if (moduleFailure.code === 'MODULE_NOT_FOUND'
+      || moduleFailure.code === 'ERR_MODULE_NOT_FOUND') {
+    return moduleFailure;
+  }
+  if (!runtimeUnavailable) return null;
+  return {
+    code: 'PROJECT_RUNTIME_UNAVAILABLE',
+    request: null,
+    path: null,
+    message,
+  };
+}
+
 function isCleanPolicyDecision(output) {
   const decision = String(output || '').replace(/\r\n?/g, '\n').trim();
   if (!decision || decision.includes('\n')) return false;
@@ -732,7 +756,15 @@ async function smokeHookRegistrations(descriptors, adapters = {}) {
       })
     ));
     const failureDetails = results.map((result) => {
+      const carriedFailure = carriedRuntimeLoadFailureDetail(result.output, {
+        candidateRoot: adapters.candidateRoot,
+        targetRoot: adapters.targetRoot,
+      });
+      if (carriedFailure) return carriedFailure;
       if (result.passed) return null;
       const raw = result.launchError && result.launchError.message
         ? result.launchError.message
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/scripts/lib/hook-install-contract.cjs; super-gsd/hooks/sgsd-substrate-invocation-witness.cjs; super-gsd/scripts/lib/hook-registration-preflight.cjs
VERIFICATION:
Not executed per bounded read-pack rules. Diff is limited to the three allowed files.
DEVIATIONS:
None. Declared roots are one authoritative two-row list; vendored traversal excludes nested node_modules trees and resolves declared package dependencies within the originating vendored directory.
BLOCKERS:
None. Expected computed Ajv package closure: ajv, fast-deep-equal, fast-uri, json-schema-traverse, require-from-string.
ONE_LINER:
Delivers computed vendored/runtime/spawn closure, preserves diagnostic load errors, and prevents runtime-unavailable denies from laundering through smoke.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
