PATCH_BEGIN
diff --git a/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs b/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
--- a/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
+++ b/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
@@ -2872,6 +2872,9 @@ function assertWitnessDigestLineEndingBehavior(audit, fixture, targetWitness, sou
     'witness line-ending fixture changed canonical content',
   );
 
+  const savedProfileEnv = Object.fromEntries(
+    ['HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME'].map((name) => [name, process.env[name]]),
+  );
   try {
+    process.env.HOME = fixture.homeRoot;
+    process.env.USERPROFILE = fixture.homeRoot;
+    process.env.APPDATA = path.join(fixture.homeRoot, 'AppData', 'Roaming');
+    process.env.XDG_CONFIG_HOME = path.join(fixture.homeRoot, '.config');
     fs.writeFileSync(targetWitness, lineEndingVariant);
     const acceptedSnapshot = audit.runAudit({
       projectDir: fixture.projectRoot,
@@ -2880,8 +2883,16 @@ function assertWitnessDigestLineEndingBehavior(audit, fixture, targetWitness, sou
     });
     const acceptedWitness = acceptedSnapshot.claude_substrate_witness;
     const acceptedCapability = acceptedSnapshot.claude_substrate_capability;
-    assert.equal(acceptedWitness.status, 'current', 'line-ending-only witness drift was not reported CURRENT');
-    assert.equal(acceptedCapability.status, 'current', 'line-ending-only capability was not reported CURRENT');
+    assert.equal(
+      acceptedWitness.status,
+      'current',
+      `line-ending-only witness drift was not reported CURRENT: ${JSON.stringify(acceptedWitness.reasons)}`,
+    );
+    assert.equal(
+      acceptedCapability.status,
+      'current',
+      `line-ending-only capability was not reported CURRENT: ${JSON.stringify(acceptedCapability.reasons)}`,
+    );
     assert.deepEqual(acceptedWitness.reasons, [], 'line-ending-only witness produced a drift reason');
     assert.deepEqual(acceptedCapability.reasons, [], 'line-ending-only capability produced a drift reason');
 
@@ -2913,7 +2924,13 @@ function assertWitnessDigestLineEndingBehavior(audit, fixture, targetWitness, sou
       'tampered witness retained substrate capability',
     );
   } finally {
-    fs.writeFileSync(targetWitness, sourceBytes);
+    try {
+      fs.writeFileSync(targetWitness, sourceBytes);
+    } finally {
+      for (const [name, value] of Object.entries(savedProfileEnv)) {
+        if (value === undefined) delete process.env[name]; else process.env[name] = value;
+      }
+    }
   }
 }
 
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs

VERIFICATION:
Static trace only, per no-tools constraint. The probe now uses the same isolated profile paths as the installer.

DEVIATIONS:
None.

BLOCKERS:
None.

ONE_LINER:
`upstream_missing` fired because the installer wrote the private upstream manifest under the fixture profile, while the in-process audit resolved it from the host profile. The test now scopes HOME/USERPROFILE/APPDATA/XDG_CONFIG_HOME around both probes, restores them safely, and includes reason arrays in both CURRENT assertion messages.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
