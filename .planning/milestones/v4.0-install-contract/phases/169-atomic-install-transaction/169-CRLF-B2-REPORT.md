PATCH_BEGIN
diff --git a/super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs b/super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs
--- a/super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs
+++ b/super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs
@@ -38,7 +38,7 @@ function sha256(value) {
 }
 
 function sourceDigest(filePath) {
-  return sha256(fs.readFileSync(filePath));
+  return sha256(fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n'));
 }
 
 function mkdir(directory) {
diff --git a/super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs b/super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs
--- a/super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs
+++ b/super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs
@@ -84,7 +84,7 @@ function createProject(name, env) {
   mkdir(path.join(project, 'super-gsd'));
   installRuntimeSources(project);
   const installedHook = installHookSource(project);
-  const sourceDigest = sha256(fs.readFileSync(installedHook));
+  const sourceDigest = sha256(fs.readFileSync(installedHook, 'utf8').replace(/\r\n/g, '\n'));
   const settings = {
     hooks: {
       PreToolUse: [hookRegistration('PreToolUse', PRE_HOOK_ID, project, sourceDigest)],
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs
super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs
VERIFICATION:
Not run per executor constraint. Statically verified both source-file pin computations now canonicalize CRLF to LF before SHA-256 hashing.
DEVIATIONS:
None.
BLOCKERS:
None.
ONE_LINER:
Updated sourceDigest and createProject hook-source pinning to hash LF-normalized source text without changing HMAC, payload, record-digest, or assertion semantics.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
