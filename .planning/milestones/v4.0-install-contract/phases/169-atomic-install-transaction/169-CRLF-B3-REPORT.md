PATCH_BEGIN
diff --git a/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs b/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
--- a/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
+++ b/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
@@ -2908,11 +2908,15 @@ function assertWitnessDigestLineEndingBehavior(audit, fixture, targetWitness, so
 
   try {
     fs.writeFileSync(targetWitness, lineEndingVariant);
-    const accepted = audit.runAudit({
+    const acceptedSnapshot = audit.runAudit({
       projectDir: fixture.projectRoot,
-    }).claude_substrate_capability;
-    assert.equal(accepted.witness_status, 'current', 'line-ending-only witness drift was not reported CURRENT');
-    assert.equal(accepted.capability_status, 'current', 'line-ending-only capability was not reported CURRENT');
-    assert.deepEqual(accepted.reasons, [], 'line-ending-only witness produced a drift reason');
-    assert.equal(accepted.substrate_granted, true, 'line-ending-only witness lost substrate capability');
+    });
+    const acceptedWitness = acceptedSnapshot.claude_substrate_witness;
+    const acceptedCapability = acceptedSnapshot.claude_substrate_capability;
+    assert.equal(acceptedWitness.status, 'current', 'line-ending-only witness drift was not reported CURRENT');
+    assert.equal(acceptedCapability.status, 'current', 'line-ending-only capability was not reported CURRENT');
+    assert.deepEqual(acceptedWitness.reasons, [], 'line-ending-only witness produced a drift reason');
+    assert.deepEqual(acceptedCapability.reasons, [], 'line-ending-only capability produced a drift reason');
 
     const tampered = Buffer.from(lineEndingVariant);
     const tamperIndex = tampered.indexOf(Buffer.from('use strict'));
@@ -2925,16 +2929,19 @@ function assertWitnessDigestLineEndingBehavior(audit, fixture, targetWitness, so
       'one-byte witness tamper did not change canonical content',
     );
     fs.writeFileSync(targetWitness, tampered);
-    const rejected = audit.runAudit({
+    const rejectedSnapshot = audit.runAudit({
       projectDir: fixture.projectRoot,
-    }).claude_substrate_capability;
+    });
+    const rejectedWitness = rejectedSnapshot.claude_substrate_witness;
+    const rejectedCapability = rejectedSnapshot.claude_substrate_capability;
     assert.equal(
-      rejected.reasons.includes('source_drift'),
+      rejectedWitness.reasons.includes('source_drift'),
       true,
       'one-byte witness tamper was not rejected as source_drift',
     );
-    assert.notEqual(rejected.witness_status, 'current', 'tampered witness remained CURRENT');
-    assert.equal(rejected.substrate_granted, false, 'tampered witness retained substrate capability');
+    assert.equal(rejectedWitness.status, 'missing_or_stale', 'tampered witness remained CURRENT');
+    assert.equal(
+      rejectedCapability.status,
+      'missing_or_stale',
+      'tampered witness retained substrate capability',
+    );
   } finally {
     fs.writeFileSync(targetWitness, sourceBytes);
   }
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
VERIFICATION:
Not run; executor was restricted to the supplied read-pack.
DEVIATIONS:
Used capability status as the snapshot-equivalent grant assertion.
BLOCKERS:
None.
ONE_LINER:
Corrected witness and capability snapshot fields for line-ending acceptance and tamper rejection.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
