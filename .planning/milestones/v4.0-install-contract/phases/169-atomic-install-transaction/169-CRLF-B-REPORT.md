PATCH_BEGIN
diff --git a/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs b/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
index 0000000..0000000 100755
--- a/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
+++ b/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
@@ -137,6 +137,14 @@ function sha256(bytes) {
   return crypto.createHash('sha256').update(bytes).digest('hex');
 }
 
+function crlfNormalizedSha256(bytes) {
+  return sha256(Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8'));
+}
+
+function oppositeLineEndingBytes(bytes) {
+  const text = bytes.toString('utf8');
+  return Buffer.from(text.includes('\r\n') ? text.replace(/\r\n/g, '\n') : text.replace(/\n/g, '\r\n'), 'utf8');
+}
+
 function readBytes(filePath) {
   return fs.readFileSync(filePath);
 }
@@ -637,6 +645,51 @@ function hookManifestSnapshot() {
   };
 }
 
+function collectRowsWithKey(value, key, rows = []) {
+  if (Array.isArray(value)) {
+    value.forEach((child) => collectRowsWithKey(child, key, rows));
+    return rows;
+  }
+  if (!value || typeof value !== 'object') return rows;
+  if (Object.prototype.hasOwnProperty.call(value, key)) rows.push(value);
+  Object.values(value).forEach((child) => collectRowsWithKey(child, key, rows));
+  return rows;
+}
+
+function assertCommittedSourcePinsCanonical() {
+  const overlay = JSON.parse(fs.readFileSync(REPO_OVERLAY_PATH, 'utf8'));
+  const overlayRows = collectRowsWithKey(overlay, 'sgsd_source_sha256');
+  assert.ok(overlayRows.length > 0, 'repo settings overlay contains no source pins');
+  for (const row of overlayRows) {
+    assert.match(row.sgsd_source_sha256, /^[0-9a-f]{64}$/, 'repo settings overlay contains an invalid source pin');
+    const commandHooks = (row.hooks || []).filter((hook) => hook.type === 'command');
+    assert.equal(commandHooks.length, 1, 'pinned repo settings row must contain exactly one command hook');
+    const sourcePath = commandSourcePath(commandHooks[0].command, commandHooks[0].args);
+    assert.ok(sourcePath, 'pinned repo settings row does not resolve to a shipped source');
+    assert.equal(
+      row.sgsd_source_sha256,
+      crlfNormalizedSha256(readBytes(path.join(SUPER_GSD_ROOT, sourcePath))),
+      `repo settings source pin is not CRLF-normalized for ${sourcePath}`,
+    );
+  }
+
+  const manifest = JSON.parse(fs.readFileSync(HOOK_MANIFEST_PATH, 'utf8'));
+  const manifestRows = collectRowsWithKey(manifest, 'sha256');
+  assert.ok(manifestRows.length > 0, 'hook manifest contains no source digests');
+  for (const row of manifestRows) {
+    assert.equal(
+      typeof row.source_path,
+      'string',
+      'hook manifest digest row does not identify its source',
+    );
+    assert.match(row.sha256, /^[0-9a-f]{64}$/, `hook manifest contains an invalid digest for ${row.source_path}`);
+    assert.equal(
+      row.sha256,
+      crlfNormalizedSha256(readBytes(path.join(SUPER_GSD_ROOT, row.source_path))),
+      `hook manifest digest is not CRLF-normalized for ${row.source_path}`,
+    );
+  }
+}
+
 function assertManifestMutationRefused(base, mutate, code, sourcePath, surface) {
   const fixture = deepClone(base);
   mutate(fixture);
@@ -684,6 +737,7 @@ function assertFixtureBarePackageSupport() {
 }
 
 function runHookManifestCompleteness() {
+  assertCommittedSourcePinsCanonical();
   assertFixtureBarePackageSupport();
   const snapshot = hookManifestSnapshot();
   assert.deepEqual(validateHookManifest(snapshot), { entries: 22, registrations: 26, smoke: 15 });
@@ -2205,10 +2259,54 @@ function assertClarityRecoveryRunbook() {
   );
 }
 
+function assertWitnessDigestLineEndingBehavior(audit, fixture, targetWitness, sourceBytes) {
+  const lineEndingVariant = oppositeLineEndingBytes(sourceBytes);
+  assert.notDeepEqual(lineEndingVariant, sourceBytes, 'witness line-ending fixture did not change raw bytes');
+  assert.equal(
+    crlfNormalizedSha256(lineEndingVariant),
+    crlfNormalizedSha256(sourceBytes),
+    'witness line-ending fixture changed canonical content',
+  );
+
+  try {
+    fs.writeFileSync(targetWitness, lineEndingVariant);
+    const accepted = audit.runAudit({
+      projectDir: fixture.projectRoot,
+    }).claude_substrate_capability;
+    assert.equal(accepted.witness_status, 'current', 'line-ending-only witness drift was not reported CURRENT');
+    assert.equal(accepted.capability_status, 'current', 'line-ending-only capability was not reported CURRENT');
+    assert.deepEqual(accepted.reasons, [], 'line-ending-only witness produced a drift reason');
+    assert.equal(accepted.substrate_granted, true, 'line-ending-only witness lost substrate capability');
+
+    const tampered = Buffer.from(lineEndingVariant);
+    const tamperIndex = tampered.indexOf(Buffer.from('use strict'));
+    assert.notEqual(tamperIndex, -1, 'witness fixture lacks the bounded one-byte tamper marker');
+    tampered[tamperIndex] ^= 1;
+    assert.notEqual(
+      crlfNormalizedSha256(tampered),
+      crlfNormalizedSha256(sourceBytes),
+      'one-byte witness tamper did not change canonical content',
+    );
+    fs.writeFileSync(targetWitness, tampered);
+    const rejected = audit.runAudit({
+      projectDir: fixture.projectRoot,
+    }).claude_substrate_capability;
+    assert.equal(
+      rejected.reasons.includes('source_drift'),
+      true,
+      'one-byte witness tamper was not rejected as source_drift',
+    );
+    assert.notEqual(rejected.witness_status, 'current', 'tampered witness remained CURRENT');
+    assert.equal(rejected.substrate_granted, false, 'tampered witness retained substrate capability');
+  } finally {
+    fs.writeFileSync(targetWitness, sourceBytes);
+  }
+}
+
 function runBrokeredSubstrateCapability() {
   const overlay = JSON.parse(fs.readFileSync(REPO_OVERLAY_PATH, 'utf8'));
   const manifest = JSON.parse(fs.readFileSync(HOOK_MANIFEST_PATH, 'utf8'));
   const sourcePath = path.join(SUPER_GSD_ROOT, 'hooks', 'sgsd-substrate-invocation-witness.cjs');
-  const sourceDigest = sha256(readBytes(sourcePath));
+  const sourceBytes = readBytes(sourcePath);
+  const sourceDigest = crlfNormalizedSha256(sourceBytes);
   const matcher = ['mcp__vtp-kb__vtp', 'search', 'substrate'].join('_');
   const expected = [
     ['PreToolUse', 'pre-tool-use-substrate-invocation-witness'],
@@ -2329,7 +2427,8 @@ function runBrokeredSubstrateCapability() {
     const firstOutput = `${first.stderr || ''}\n${first.stdout || ''}`;
     assert.equal(first.status, 0, `brokered capability install failed:\n${firstOutput}`);
     assert.equal(firstOutput.includes(secret), false, 'installer output exposed private upstream data');
-    assert.equal(sha256(readBytes(targetWitness)), sourceDigest, 'installer did not refresh the stale witness source');
+    assert.deepEqual(readBytes(targetWitness), sourceBytes, 'installer did not refresh the stale witness source');
+    assertWitnessDigestLineEndingBehavior(audit, fixture, targetWitness, sourceBytes);
     assert.deepEqual(readBytes(configPath), customisedConfig, 'substrate repair rewrote customised config bytes');
 
     const installedRepo = JSON.parse(readBytes(fixture.repoSettings).toString('utf8'));
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
VERIFICATION:
Not run; patch-only executor rules prohibited tools. Added 20 assertion sites across hook-manifest-completeness and brokered-substrate-capability.
DEVIATIONS:
None.
BLOCKERS:
None.
ONE_LINER:
Pins now prove LF-canonical digests; witness CRLF/LF variants remain current while a one-byte tamper is rejected as source_drift.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
