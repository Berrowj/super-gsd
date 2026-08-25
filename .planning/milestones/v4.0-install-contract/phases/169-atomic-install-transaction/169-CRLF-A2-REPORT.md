PATCH_BEGIN
diff --git a/super-gsd/scripts/lib/substrate-invocation-witness-store.cjs b/super-gsd/scripts/lib/substrate-invocation-witness-store.cjs
--- a/super-gsd/scripts/lib/substrate-invocation-witness-store.cjs
+++ b/super-gsd/scripts/lib/substrate-invocation-witness-store.cjs
@@ -19,6 +19,11 @@ function sha256(value) {
   return crypto.createHash('sha256').update(value).digest('hex');
 }
 
+function normalizedSourceBytes(value) {
+  // Canonical source digests normalize CRLF to LF only.
+  return Buffer.from(value.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
+}
+
 function hmac(key, value) {
   return crypto.createHmac('sha256', key).update(value).digest('hex');
 }
@@ -231,7 +236,7 @@ function inspectWitnessReadiness(projectRoot, env = process.env) {
 
   let digest;
   try {
-    digest = sha256(fs.readFileSync(sourcePath));
+    digest = sha256(normalizedSourceBytes(fs.readFileSync(sourcePath)));
   } catch (_) {
     return unavailableReadiness(resolvedRoot, 'source_unreadable');
   }
PATCH_END
REPORT_BEGIN
FILES_CHANGED: super-gsd/scripts/lib/substrate-invocation-witness-store.cjs — lines 22-25 added; line 239 changed.
VERIFICATION: Not run; patch-only execution from the supplied read-pack.
DEVIATIONS: None.
BLOCKERS: None.
ONE_LINER: Normalize CRLF to LF before comparing the installed hook’s source digest.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
