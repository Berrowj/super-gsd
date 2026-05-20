SUCCESS: The process with PID 36504 (child process of PID 40784) has been terminated.
SUCCESS: The process with PID 30784 (child process of PID 40784) has been terminated.
SUCCESS: The process with PID 2420 (child process of PID 40784) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/tools/mesh-memory/evidence-validator.cjs b/super-gsd/tools/mesh-memory/evidence-validator.cjs
index 0000000..0000000 100755
--- a/super-gsd/tools/mesh-memory/evidence-validator.cjs
+++ b/super-gsd/tools/mesh-memory/evidence-validator.cjs
@@ -39,6 +39,18 @@ function keyFor(payload) {
   return `cmb-${hash}`;
 }
 
+function defaultCat7(type) {
+  if (type === 'evidence_verdict') {
+    return {
+      focus: 'evidence validation',
+      issue: 'review finding status',
+      intent: 'adjudicate evidence',
+      motivation: 'separate claim from authority',
+      commitment: 'schema-conformant verdict',
+      perspective: 'evidence-validator',
+      mood: 'calm',
+    };
+  }
+  return {
+    focus: 'mesh memory',
+    issue: type,
+    intent: 'emit context memory block',
+    motivation: 'preserve auditable evidence',
+    commitment: 'schema-conformant record',
+    perspective: roleFromType(type),
+    mood: 'calm',
+  };
+}
+
+function roleFromType(type) {
+  if (type === 'evidence_verdict') return 'evidence-validator';
+  return 'mesh-memory';
+}
+
 function makeCmb(type, createdBy, role, parentKeys, body, extra = {}) {
   const createdAt = extra.created_at || new Date().toISOString();
+  const parents = Array.isArray(parentKeys) ? parentKeys : [];
   const draft = {
     type,
     created_at: createdAt,
     created_by: createdBy,
     role,
+    milestone_id: extra.milestone_id || 'v3.0',
+    phase_id: extra.phase_id === undefined ? '108' : extra.phase_id,
+    cat7: extra.cat7 || defaultCat7(type),
+    body,
+    lineage: {
+      parents,
+      ancestors: extra.ancestors || [],
+    },
     authority_level: extra.authority_level || 'claim_with_authority',
-    status: extra.status || 'active',
-    lineage: { parents: parentKeys },
-    body,
+    evidence_refs: extra.evidence_refs || [],
+    status: extra.status || 'emitted',
   };
   return { key: keyFor(draft), ...draft };
 }
@@ -174,13 +197,18 @@ function evaluateFinding(ledger, finding) {
 }
 
 function buildEvidenceVerdict(finding, evaluation) {
-  return makeCmb('evidence_verdict', 'evidence_validator', 'evidence_validator', [finding.key], {
-    evidence_status: evaluation.evidence_status,
-    tier_used: evaluation.tier_used,
-    decision_basis: evaluation.decision_basis,
-    refuting_evidence: evaluation.refuting_evidence || [],
-    tests_refuting: [],
-  });
+  return makeCmb(
+    'evidence_verdict',
+    'evidence_validator',
+    'evidence_validator',
+    [finding.key],
+    {
+      evidence_status: evaluation.evidence_status,
+      tier_used: evaluation.tier_used,
+      decision_basis: evaluation.decision_basis,
+    },
+    { authority_level: 'claim_with_authority', evidence_refs: [] },
+  );
 }
 
 function validateCmbAgainstSchema(cmb) {
diff --git a/super-gsd/tools/mesh-memory/echo-detector.cjs b/super-gsd/tools/mesh-memory/echo-detector.cjs
index 0000000..0000000 100755
--- a/super-gsd/tools/mesh-memory/echo-detector.cjs
+++ b/super-gsd/tools/mesh-memory/echo-detector.cjs
@@ -41,10 +41,15 @@ function processIncoming(ledgerPath, incomingKey, receiverRole) {
 
   const persisted = JSON.parse(JSON.stringify(incoming));
   persisted.lineage = persisted.lineage || {};
+  if (!Array.isArray(persisted.lineage.parents)) persisted.lineage.parents = [];
+  if (!Array.isArray(persisted.lineage.ancestors)) persisted.lineage.ancestors = incomingAncestors;
+  if (!persisted.status || persisted.status === 'active') persisted.status = 'emitted';
+  if (!Array.isArray(persisted.evidence_refs)) persisted.evidence_refs = [];
+
   if (echoDetected) {
-    persisted.lineage.echo_detected = true;
+    persisted.evidence_refs = Array.from(new Set([...persisted.evidence_refs, ...incomingAncestors]));
     persisted.status = 'superseded';
   } else {
-    persisted.status = persisted.status || 'active';
+    persisted.status = persisted.status || 'emitted';
   }
   appendCmb(ledgerPath, persisted);
   return { echoDetected, incoming: persisted, ancestors: incomingAncestors };
@@ -111,7 +116,7 @@ function runSelfTestEchoHit() {
   const result = processIncoming(ledgerPath, incoming.key, 'reviewer_a');
   assert(result.echoDetected === true, 'expected echoDetected=true');
-  assert(result.incoming.lineage.echo_detected === true, 'incoming CMB was not marked with lineage.echo_detected');
+  assert(result.incoming.status === 'superseded', 'incoming CMB was not marked superseded');
   process.stderr.write('[echo-detector] self-test echo hit passed\n');
 }
 
@@ -126,7 +131,7 @@ function runSelfTestEchoMiss() {
   const result = processIncoming(ledgerPath, incoming.key, 'reviewer_a');
   assert(result.echoDetected === false, 'expected echoDetected=false');
-  assert(!result.incoming.lineage.echo_detected, 'incoming CMB should not be marked as echo');
+  assert(result.incoming.status !== 'superseded', 'incoming CMB should not be superseded without echo');
   process.stderr.write('[echo-detector] self-test echo miss passed\n');
 }
 
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/evidence-validator.cjs (modified)
  super-gsd/tools/mesh-memory/echo-detector.cjs (modified)
VERIFICATION:
  Not run per executor constraint: no tools. Patch makes evidence_verdict emit required milestone_id, phase_id, full cat7, evidence_refs, lineage.ancestors, status=emitted, authority_level=claim_with_authority, and body limited to evidence_status/tier_used/decision_basis.
DEVIATIONS:
  Echo detector no longer writes lineage.echo_detected because lineage.additionalProperties is false; echo state is represented by status=superseded and ancestor evidence_refs.
BLOCKERS:
  None.
ONE_LINER:
  evidence-validator now emits schema-conformant evidence_verdict CMBs with full CAT7, milestone/phase IDs, evidence_refs, lineage.ancestors, emitted status, and a strict three-field verdict body.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
