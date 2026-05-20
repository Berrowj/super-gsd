SUCCESS: The process with PID 34536 (child process of PID 45712) has been terminated.
SUCCESS: The process with PID 44264 (child process of PID 45712) has been terminated.
SUCCESS: The process with PID 28048 (child process of PID 45712) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/tools/mesh-memory/lineage.cjs b/super-gsd/tools/mesh-memory/lineage.cjs
index 0000000..0000000 100755
--- a/super-gsd/tools/mesh-memory/lineage.cjs
+++ b/super-gsd/tools/mesh-memory/lineage.cjs
@@ -62,6 +62,17 @@ function provenance(ledger, key) {
   return ordered;
 }
 
+function provenanceKeys(ledger, key) {
+  return provenance(ledger, key).map((cmb) => cmb.key);
+}
+
+function ancestorsForLineage(ledger, key, parents) {
+  const out = [];
+  const seen = new Set();
+  for (const parent of parents || []) {
+    if (!seen.has(parent)) { seen.add(parent); out.push(parent); }
+    for (const ancestor of ancestors(ledger, parent)) if (!seen.has(ancestor)) { seen.add(ancestor); out.push(ancestor); }
+  }
+  return out.slice(0, 50);
+}
+
 function siblings(ledger, key) {
   const target = findCmb(ledger, key);
   if (!target) return [];
@@ -108,17 +119,17 @@ function runSelfTestAncestors() {
   const ledger = loadLedger(SEED_LEDGER);
-  const deepLeaf = 'cmb-0000000000000000000000000000000000000000000000000000000000000008';
+  const deepLeaf = '0000000000000000000000000000000000000000000000000000000000000008';
   const expected = [
-    'cmb-0000000000000000000000000000000000000000000000000000000000000007',
-    'cmb-0000000000000000000000000000000000000000000000000000000000000006',
-    'cmb-0000000000000000000000000000000000000000000000000000000000000005',
-    'cmb-0000000000000000000000000000000000000000000000000000000000000004',
-    'cmb-0000000000000000000000000000000000000000000000000000000000000003',
-    'cmb-0000000000000000000000000000000000000000000000000000000000000002',
-    'cmb-0000000000000000000000000000000000000000000000000000000000000001',
+    '0000000000000000000000000000000000000000000000000000000000000007',
+    '0000000000000000000000000000000000000000000000000000000000000006',
+    '0000000000000000000000000000000000000000000000000000000000000005',
+    '0000000000000000000000000000000000000000000000000000000000000004',
+    '0000000000000000000000000000000000000000000000000000000000000003',
+    '0000000000000000000000000000000000000000000000000000000000000002',
+    '0000000000000000000000000000000000000000000000000000000000000001',
   ];
   assert(JSON.stringify(ancestors(ledger, deepLeaf)) === JSON.stringify(expected), 'deep leaf ancestors are not in expected BFS order');
   assert(JSON.stringify(ancestors(ledger, deepLeaf, 3)) === JSON.stringify(expected.slice(0, 3)), 'max-depth did not stop at depth 3');
-  assert(ancestors(ledger, 'cmb-0000000000000000000000000000000000000000000000000000000000000011', 50).length <= 2, 'cycle guard failed');
+  assert(ancestors(ledger, '0000000000000000000000000000000000000000000000000000000000000011', 50).length <= 2, 'cycle guard failed');
   process.stderr.write('[lineage] self-test ancestors passed\n');
 }
@@ -160,5 +171,7 @@ module.exports = {
   ancestors,
   descendants,
   provenance,
+  provenanceKeys,
+  ancestorsForLineage,
   siblings,
 };
diff --git a/super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl b/super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl
index 0000000..0000000 100644
--- a/super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl
+++ b/super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl
@@ -1,11 +1,11 @@
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000001","type":"execution_receipt","created_at":"2026-05-20T00:00:00.000Z","created_by":"p108_seed","role":"executor","authority_level":"claim_with_authority","status":"active","lineage":{"parents":[]},"body":{"command":"node super-gsd/tools/mesh-memory/run-self-test.cjs","exit_code":0,"summary":"Root execution receipt for P108 seed lineage."}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000002","type":"review_finding","created_at":"2026-05-20T00:01:00.000Z","created_by":"p108_seed_review","role":"reviewer","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000001"]},"body":{"claim":"good execution receipt fixture exists","severity":"medium","file_path":"super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json","line_start":1,"line_end":1,"quoted_excerpt":"{"}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000009","type":"review_finding","created_at":"2026-05-20T00:02:00.000Z","created_by":"p108_seed_review","role":"reviewer","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000001"]},"body":{"claim":"good review finding fixture exists","severity":"low","file_path":"super-gsd/tools/mesh-memory/fixtures/good-review-finding.json","line_start":1,"line_end":1,"quoted_excerpt":"{"}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000003","type":"evidence_verdict","created_at":"2026-05-20T00:03:00.000Z","created_by":"evidence_validator","role":"evidence_validator","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000002"]},"body":{"evidence_status":"VERIFIED_CRIT","tier_used":0,"decision_basis":"Seed review finding admitted for lineage testing.","refuting_evidence":[],"tests_refuting":[]}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000004","type":"decision_recommendation","created_at":"2026-05-20T00:04:00.000Z","created_by":"p108_seed_decider","role":"decisioner","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000003"]},"body":{"recommendation":"Promote verified evidence chain for self-test coverage.","rationale":"The verdict is linked to a concrete review finding."}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000005","type":"promotion_decision","created_at":"2026-05-20T00:05:00.000Z","created_by":"p108_seed_promoter","role":"promoter","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000004"]},"body":{"decision":"promote","rationale":"Seed chain is sufficient for lineage traversal tests."}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000006","type":"execution_receipt","created_at":"2026-05-20T00:06:00.000Z","created_by":"p108_seed","role":"executor","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000005"]},"body":{"command":"seed deep branch step 1","exit_code":0,"summary":"First deep lineage extension."}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000007","type":"execution_receipt","created_at":"2026-05-20T00:07:00.000Z","created_by":"p108_seed","role":"executor","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000006"]},"body":{"command":"seed deep branch step 2","exit_code":0,"summary":"Second deep lineage extension."}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000008","type":"execution_receipt","created_at":"2026-05-20T00:08:00.000Z","created_by":"p108_seed","role":"executor","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000007"]},"body":{"command":"seed deep branch leaf","exit_code":0,"summary":"Deep leaf at depth seven from root."}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000010","type":"execution_receipt","created_at":"2026-05-20T00:09:00.000Z","created_by":"p108_seed_cycle","role":"executor","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000011"]},"body":{"command":"seed cycle attempt a","exit_code":0,"summary":"Cycle attempt node A."}}
-{"key":"cmb-0000000000000000000000000000000000000000000000000000000000000011","type":"execution_receipt","created_at":"2026-05-20T00:10:00.000Z","created_by":"p108_seed_cycle","role":"executor","authority_level":"claim_with_authority","status":"active","lineage":{"parents":["cmb-0000000000000000000000000000000000000000000000000000000000000010"]},"body":{"command":"seed cycle attempt b","exit_code":0,"summary":"Cycle attempt node B."}}
+{"key":"0000000000000000000000000000000000000000000000000000000000000001","type":"execution_receipt","created_at":"2026-05-20T00:00:00.000Z","created_by":"sgsd-wrapper","role":"sgsd","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"lineage seed","issue":"root execution","intent":"record execution","motivation":"exercise lineage","commitment":"schema valid seed","perspective":"system","mood":"neutral"},"body":{"commit_before":"0000001","commit_after":"0000002","changed_files":["super-gsd/tools/mesh-memory/lineage.cjs"],"tests_run":[{"command":"node super-gsd/tools/mesh-memory/run-self-test.cjs","result":"pass","count":1}],"report_path":".planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md","report_hash":"sha256-seed-root","acceptance_criteria_touched":["SAC-P108-04"]},"lineage":{"parents":[],"ancestors":[]},"authority_level":"observation","evidence_refs":[],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000002","type":"review_finding","created_at":"2026-05-20T00:01:00.000Z","created_by":"atc-v4","role":"reviewer","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"review claim","issue":"schema evidence","intent":"claim source line","motivation":"test validator","commitment":"bounded claim","perspective":"reviewer","mood":"focused"},"body":{"claim":"good execution receipt fixture exists","severity":"WARN","current_commit":"0000002","file_path":"super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json","line_start":1,"line_end":1,"quoted_excerpt":"{"},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000001"],"ancestors":["0000000000000000000000000000000000000000000000000000000000000001"]},"authority_level":"claim","evidence_refs":[],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000009","type":"review_finding","created_at":"2026-05-20T00:02:00.000Z","created_by":"reviewer-seed","role":"reviewer","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"review claim","issue":"sibling evidence","intent":"claim sibling source line","motivation":"test siblings","commitment":"bounded claim","perspective":"reviewer","mood":"focused"},"body":{"claim":"good review finding fixture exists","severity":"INFO","current_commit":"0000002","file_path":"super-gsd/tools/mesh-memory/fixtures/good-review-finding.json","line_start":1,"line_end":1,"quoted_excerpt":"{"},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000001"],"ancestors":["0000000000000000000000000000000000000000000000000000000000000001"]},"authority_level":"claim","evidence_refs":[],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000003","type":"evidence_verdict","created_at":"2026-05-20T00:03:00.000Z","created_by":"evidence_validator","role":"evidence_validator","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"claim validation","issue":"review admission","intent":"admit evidence","motivation":"test verdict lineage","commitment":"validated verdict","perspective":"validator","mood":"neutral"},"body":{"evidence_status":"VERIFIED_CRIT","tier_used":0,"decision_basis":"Seed review finding admitted for lineage testing.","refuting_evidence":[],"tests_refuting":[]},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000002"],"ancestors":["0000000000000000000000000000000000000000000000000000000000000002","0000000000000000000000000000000000000000000000000000000000000001"]},"authority_level":"claim_with_authority","evidence_refs":["0000000000000000000000000000000000000000000000000000000000000002"],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000004","type":"decision_recommendation","created_at":"2026-05-20T00:04:00.000Z","created_by":"pseudo_operator","role":"pseudo_operator","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"decision recommendation","issue":"promotion readiness","intent":"recommend promotion","motivation":"test decision chain","commitment":"schema valid decision","perspective":"pseudo operator","mood":"neutral"},"body":{"recommendation":"Promote verified evidence chain for self-test coverage.","authority_level":2,"confidence":0.9,"real_operator_required":false,"context_pack_id":"p108-seed","evidence_refs":["0000000000000000000000000000000000000000000000000000000000000003"],"carve_outs_triggered":[]},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000003"],"ancestors":["0000000000000000000000000000000000000000000000000000000000000003","0000000000000000000000000000000000000000000000000000000000000002","0000000000000000000000000000000000000000000000000000000000000001"]},"authority_level":"decision","evidence_refs":["0000000000000000000000000000000000000000000000000000000000000003"],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000005","type":"promotion_decision","created_at":"2026-05-20T00:05:00.000Z","created_by":"sgsd","role":"sgsd","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"promotion decision","issue":"phase readiness","intent":"record promotion decision","motivation":"test promotion chain","commitment":"schema valid promotion","perspective":"system","mood":"neutral"},"body":{"verdict":"PASS","phase":"108"},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000004"],"ancestors":["0000000000000000000000000000000000000000000000000000000000000004","0000000000000000000000000000000000000000000000000000000000000003","0000000000000000000000000000000000000000000000000000000000000002","0000000000000000000000000000000000000000000000000000000000000001"]},"authority_level":"decision","evidence_refs":["0000000000000000000000000000000000000000000000000000000000000004"],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000006","type":"execution_receipt","created_at":"2026-05-20T00:06:00.000Z","created_by":"sgsd-wrapper","role":"sgsd","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"deep lineage","issue":"depth step one","intent":"extend chain","motivation":"test depth","commitment":"schema valid receipt","perspective":"system","mood":"neutral"},"body":{"commit_before":"0000002","commit_after":"0000003","changed_files":["super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl"],"tests_run":[{"command":"seed deep branch step 1","result":"pass","count":1}],"report_path":".planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md","report_hash":"sha256-seed-step-1","acceptance_criteria_touched":["SAC-P108-04"]},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000005"],"ancestors":["0000000000000000000000000000000000000000000000000000000000000005","0000000000000000000000000000000000000000000000000000000000000004","0000000000000000000000000000000000000000000000000000000000000003","0000000000000000000000000000000000000000000000000000000000000002","0000000000000000000000000000000000000000000000000000000000000001"]},"authority_level":"observation","evidence_refs":[],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000007","type":"execution_receipt","created_at":"2026-05-20T00:07:00.000Z","created_by":"sgsd-wrapper","role":"sgsd","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"deep lineage","issue":"depth step two","intent":"extend chain","motivation":"test depth","commitment":"schema valid receipt","perspective":"system","mood":"neutral"},"body":{"commit_before":"0000003","commit_after":"0000004","changed_files":["super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl"],"tests_run":[{"command":"seed deep branch step 2","result":"pass","count":1}],"report_path":".planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md","report_hash":"sha256-seed-step-2","acceptance_criteria_touched":["SAC-P108-04"]},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000006"],"ancestors":["0000000000000000000000000000000000000000000000000000000000000006","0000000000000000000000000000000000000000000000000000000000000005","0000000000000000000000000000000000000000000000000000000000000004","0000000000000000000000000000000000000000000000000000000000000003","0000000000000000000000000000000000000000000000000000000000000002","0000000000000000000000000000000000000000000000000000000000000001"]},"authority_level":"observation","evidence_refs":[],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000008","type":"execution_receipt","created_at":"2026-05-20T00:08:00.000Z","created_by":"sgsd-wrapper","role":"sgsd","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"deep lineage","issue":"deep leaf","intent":"cap traversal","motivation":"test depth bound","commitment":"schema valid receipt","perspective":"system","mood":"neutral"},"body":{"commit_before":"0000004","commit_after":"0000005","changed_files":["super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl"],"tests_run":[{"command":"seed deep branch leaf","result":"pass","count":1}],"report_path":".planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md","report_hash":"sha256-seed-leaf","acceptance_criteria_touched":["SAC-P108-04"]},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000007"],"ancestors":["0000000000000000000000000000000000000000000000000000000000000007","0000000000000000000000000000000000000000000000000000000000000006","0000000000000000000000000000000000000000000000000000000000000005","0000000000000000000000000000000000000000000000000000000000000004","0000000000000000000000000000000000000000000000000000000000000003","0000000000000000000000000000000000000000000000000000000000000002","0000000000000000000000000000000000000000000000000000000000000001"]},"authority_level":"observation","evidence_refs":[],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000010","type":"execution_receipt","created_at":"2026-05-20T00:09:00.000Z","created_by":"sgsd-wrapper","role":"sgsd","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"cycle guard","issue":"cycle attempt a","intent":"exercise guard","motivation":"avoid unbounded walk","commitment":"schema valid receipt","perspective":"system","mood":"neutral"},"body":{"commit_before":"0000005","commit_after":"0000006","changed_files":["super-gsd/tools/mesh-memory/lineage.cjs"],"tests_run":[{"command":"seed cycle attempt a","result":"pass","count":1}],"report_path":".planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md","report_hash":"sha256-seed-cycle-a","acceptance_criteria_touched":["SAC-P108-04"]},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000011"],"ancestors":[]},"authority_level":"observation","evidence_refs":[],"status":"emitted"}
+{"key":"0000000000000000000000000000000000000000000000000000000000000011","type":"execution_receipt","created_at":"2026-05-20T00:10:00.000Z","created_by":"sgsd-wrapper","role":"sgsd","milestone_id":"v3.0","phase_id":"108","cat7":{"focus":"cycle guard","issue":"cycle attempt b","intent":"exercise guard","motivation":"avoid unbounded walk","commitment":"schema valid receipt","perspective":"system","mood":"neutral"},"body":{"commit_before":"0000006","commit_after":"0000007","changed_files":["super-gsd/tools/mesh-memory/lineage.cjs"],"tests_run":[{"command":"seed cycle attempt b","result":"pass","count":1}],"report_path":".planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md","report_hash":"sha256-seed-cycle-b","acceptance_criteria_touched":["SAC-P108-04"]},"lineage":{"parents":["0000000000000000000000000000000000000000000000000000000000000010"],"ancestors":[]},"authority_level":"observation","evidence_refs":[],"status":"emitted"}
diff --git a/super-gsd/tools/mesh-memory/evidence-validator.cjs b/super-gsd/tools/mesh-memory/evidence-validator.cjs
index 0000000..0000000 100755
--- a/super-gsd/tools/mesh-memory/evidence-validator.cjs
+++ b/super-gsd/tools/mesh-memory/evidence-validator.cjs
@@ -6,7 +6,8 @@ const fs = require('fs');
 const os = require('os');
 const path = require('path');
 
-const { loadLedger, findCmb } = require('./lineage.cjs');
+const { canonicalHash } = require('./cmb-hash.cjs');
+const { loadLedger, findCmb, ancestorsForLineage } = require('./lineage.cjs');
 
 const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
 const DEFAULT_LEDGER = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
@@ -36,27 +37,48 @@ function appendCmb(ledgerPath, cmb) {
   fs.appendFileSync(ledgerPath, `${JSON.stringify(cmb)}\n`, 'utf8');
 }
 
-function keyFor(payload) {
-  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
-  return `cmb-${hash}`;
+function cat7(overrides = {}) {
+  return {
+    focus: overrides.focus || 'claim validation',
+    issue: overrides.issue || 'evidence admission',
+    intent: overrides.intent || 'adjudicate review claim',
+    motivation: overrides.motivation || 'separate claim from authority',
+    commitment: overrides.commitment || 'schema valid verdict',
+    perspective: overrides.perspective || 'validator',
+    mood: overrides.mood || 'neutral',
+  };
 }
 
-function makeCmb(type, createdBy, role, parentKeys, body, extra = {}) {
+function makeCmb(type, createdBy, role, parentKeys, body, extra = {}, ledger = []) {
   const createdAt = extra.created_at || new Date().toISOString();
   const draft = {
     type,
     created_at: createdAt,
     created_by: createdBy,
     role,
+    milestone_id: extra.milestone_id || 'v3.0',
+    phase_id: extra.phase_id || '108',
+    cat7: extra.cat7 || cat7(),
+    body,
+    lineage: {
+      parents: parentKeys,
+      ancestors: extra.ancestors || ancestorsForLineage(ledger, null, parentKeys),
+    },
     authority_level: extra.authority_level || 'claim_with_authority',
-    status: extra.status || 'active',
-    lineage: { parents: parentKeys },
-    body,
+    evidence_refs: extra.evidence_refs || parentKeys,
+    status: extra.status || 'emitted',
   };
-  return { key: keyFor(draft), ...draft };
+  return { key: canonicalHash(draft), ...draft };
 }
 
 function createReviewFinding(body, parentKeys = []) {
-  return makeCmb('review_finding', 'p108_self_test', 'reviewer', parentKeys, {
+  return makeCmb('review_finding', 'reviewer-p108-self-test', 'reviewer', parentKeys, {
     claim: body.claim || 'self-test review finding',
-    severity: body.severity || 'medium',
+    severity: body.severity || 'WARN',
+    current_commit: body.current_commit || '0000002',
     file_path: body.file_path,
     line_start: body.line_start,
     line_end: body.line_end,
     quoted_excerpt: body.quoted_excerpt,
+  }, {
+    authority_level: 'claim',
+    evidence_refs: [],
+    cat7: cat7({ focus: 'review claim', issue: 'self-test finding', perspective: 'reviewer' }),
   });
 }
@@ -168,7 +190,7 @@ function evaluateFinding(ledger, finding) {
 }
 
 function buildEvidenceVerdict(finding, evaluation) {
-  return makeCmb('evidence_verdict', 'evidence_validator', 'evidence_validator', [finding.key], {
+  return makeCmb('evidence_verdict', 'evidence_validator', 'evidence_validator', [finding.key], {
     evidence_status: evaluation.evidence_status,
     tier_used: evaluation.tier_used,
     decision_basis: evaluation.decision_basis,
@@ -176,7 +198,7 @@ function buildEvidenceVerdict(finding, evaluation) {
     tests_refuting: [],
-  });
+  }, {}, [finding]);
 }
 
 function validateCmbAgainstSchema(cmb) {
@@ -204,6 +226,8 @@ function validateFindingKey(ledgerPath, findingKey) {
   const evaluation = evaluateFinding(ledger, finding);
   const verdict = buildEvidenceVerdict(finding, evaluation);
+  const schemaResult = validateCmbAgainstSchema(verdict);
+  if (!schemaResult.valid) throw new Error(`evidence_verdict failed schema validation: ${JSON.stringify(schemaResult.errors)}`);
   appendCmb(ledgerPath, verdict);
   return verdict;
 }
diff --git a/super-gsd/tools/mesh-memory/echo-detector.cjs b/super-gsd/tools/mesh-memory/echo-detector.cjs
index 0000000..0000000 100755
--- a/super-gsd/tools/mesh-memory/echo-detector.cjs
+++ b/super-gsd/tools/mesh-memory/echo-detector.cjs
@@ -6,11 +6,11 @@ const fs = require('fs');
 const os = require('os');
 const path = require('path');
 
+const { canonicalHash } = require('./cmb-hash.cjs');
 const { loadLedger, findCmb, ancestors } = require('./lineage.cjs');
 
 const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
 const DEFAULT_LEDGER = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
+const ECHO_BODY_MARKER = 'lineage.echo_detected=true';
 
 function ensureLedgerDir(ledgerPath) {
   fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
@@ -23,23 +23,65 @@ function appendCmb(ledgerPath, cmb) {
 }
 
 function keyFor(payload) {
-  return `cmb-${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
+  return canonicalHash(payload);
+}
+
+function cat7(overrides = {}) {
+  return {
+    focus: overrides.focus || 'echo detection',
+    issue: overrides.issue || 'incoming CMB lineage',
+    intent: overrides.intent || 'record receiver attempt',
+    motivation: overrides.motivation || 'preserve audit trail',
+    commitment: overrides.commitment || 'bounded echo check',
+    perspective: overrides.perspective || 'receiver',
+    mood: overrides.mood || 'neutral',
+  };
 }
 
 function makeCmb(type, createdBy, role, parentKeys, body) {
+  const authority = type === 'execution_receipt' ? 'observation' : type === 'review_finding' ? 'claim' : type === 'decision_recommendation' ? 'decision' : 'claim_with_authority';
   const draft = {
     type,
     created_at: new Date().toISOString(),
     created_by: createdBy,
     role,
-    authority_level: 'claim_with_authority',
-    status: 'active',
-    lineage: { parents: parentKeys },
+    milestone_id: 'v3.0',
+    phase_id: '108',
+    cat7: cat7(),
     body,
+    lineage: { parents: parentKeys, ancestors: parentKeys.slice(0, 50) },
+    authority_level: authority,
+    evidence_refs: parentKeys,
+    status: 'emitted',
   };
   return { key: keyFor(draft), ...draft };
 }
 
+function makeReceipt(createdBy, role, parentKeys, summary) {
+  return makeCmb('execution_receipt', createdBy, 'sgsd', parentKeys, {
+    commit_before: '0000001',
+    commit_after: '0000002',
+    changed_files: ['super-gsd/tools/mesh-memory/echo-detector.cjs'],
+    tests_run: [{ command: summary, result: 'pass', count: 1 }],
+    report_path: '.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md',
+    report_hash: crypto.createHash('sha256').update(summary).digest('hex'),
+    acceptance_criteria_touched: ['SAC-P108-05'],
+  });
+}
+
+function makeDecision(createdBy, parentKeys, recommendation) {
+  return makeCmb('decision_recommendation', createdBy, 'pseudo_operator', parentKeys, {
+    recommendation,
+    authority_level: 2,
+    confidence: 0.9,
+    real_operator_required: false,
+    context_pack_id: 'p108-echo-self-test',
+    evidence_refs: parentKeys,
+    carve_outs_triggered: [],
+  });
+}
+
 function processIncoming(ledgerPath, incomingKey, receiverRole) {
@@ -58,10 +100,13 @@ function processIncoming(ledgerPath, incomingKey, receiverRole) {
 
   const persisted = JSON.parse(JSON.stringify(incoming));
-  persisted.lineage = persisted.lineage || {};
+  persisted.lineage = {
+    parents: Array.isArray(persisted.lineage && persisted.lineage.parents) ? persisted.lineage.parents : [],
+    ancestors: Array.isArray(persisted.lineage && persisted.lineage.ancestors) ? persisted.lineage.ancestors : incomingAncestors,
+  };
   if (echoDetected) {
-    persisted.lineage.echo_detected = true;
+    persisted.body = { ...persisted.body, echo_detected: true, echo_marker: ECHO_BODY_MARKER };
     persisted.status = 'superseded';
   } else {
-    persisted.status = persisted.status || 'active';
+    persisted.status = persisted.status || 'emitted';
   }
   appendCmb(ledgerPath, persisted);
@@ -108,17 +153,17 @@ function assert(condition, message) {
 }
 
 function runSelfTestEchoHit() {
-  const receiverRoot = makeCmb('execution_receipt', 'reviewer_a', 'reviewer_a', [], { command: 'self', exit_code: 0, summary: 'self root' });
+  const receiverRoot = makeReceipt('reviewer_a', 'sgsd', [], 'self root');
   const middle = makeCmb('review_finding', 'other_role', 'reviewer_b', [receiverRoot.key], {
     claim: 'middle claim',
-    severity: 'low',
+    severity: 'WARN',
+    current_commit: '0000002',
     file_path: 'super-gsd/schemas/cmb.schema.json',
   });
-  const incoming = makeCmb('decision_recommendation', 'other_role', 'decisioner', [middle.key], {
-    recommendation: 'check echo',
-    rationale: 'ancestor intersects receiver role',
-  });
+  const incoming = makeDecision('pseudo_operator', [middle.key], 'check echo');
   const ledgerPath = writeLedger([receiverRoot, middle, incoming]);
   const result = processIncoming(ledgerPath, incoming.key, 'reviewer_a');
   assert(result.echoDetected === true, 'expected echoDetected=true');
-  assert(result.incoming.lineage.echo_detected === true, 'incoming CMB was not marked with lineage.echo_detected');
+  assert(result.incoming.body.echo_detected === true, 'incoming CMB was not marked with echo detection result');
+  assert(result.incoming.status === 'superseded', 'echo attempt was not persisted as superseded');
   process.stderr.write('[echo-detector] self-test echo hit passed\n');
 }
 
 function runSelfTestEchoMiss() {
-  const root = makeCmb('execution_receipt', 'writer_a', 'writer_a', [], { command: 'other', exit_code: 0, summary: 'other root' });
-  const incoming = makeCmb('decision_recommendation', 'writer_b', 'decisioner', [root.key], {
-    recommendation: 'check miss',
-    rationale: 'ancestor does not intersect receiver role',
-  });
+  const root = makeReceipt('sgsd-wrapper', 'sgsd', [], 'other root');
+  const incoming = makeDecision('pseudo_operator', [root.key], 'check miss');
   const ledgerPath = writeLedger([root, incoming]);
   const result = processIncoming(ledgerPath, incoming.key, 'reviewer_a');
   assert(result.echoDetected === false, 'expected echoDetected=false');
-  assert(!result.incoming.lineage.echo_detected, 'incoming CMB should not be marked as echo');
+  assert(!result.incoming.body.echo_detected, 'incoming CMB should not be marked as echo');
   process.stderr.write('[echo-detector] self-test echo miss passed\n');
 }
diff --git a/super-gsd/tools/mesh-memory/run-self-test.cjs b/super-gsd/tools/mesh-memory/run-self-test.cjs
index 0000000..0000000 100755
--- a/super-gsd/tools/mesh-memory/run-self-test.cjs
+++ b/super-gsd/tools/mesh-memory/run-self-test.cjs
@@ -75,13 +75,13 @@ function main() {
       assert(schemaResult.valid, `seed CMB schema-valid: ${row.key}`);
     }
 
-    const deepLeaf = 'cmb-0000000000000000000000000000000000000000000000000000000000000008';
-    const root = 'cmb-0000000000000000000000000000000000000000000000000000000000000001';
-    const revA = 'cmb-0000000000000000000000000000000000000000000000000000000000000002';
-    const revB = 'cmb-0000000000000000000000000000000000000000000000000000000000000009';
-    const verdict = 'cmb-0000000000000000000000000000000000000000000000000000000000000003';
-    const decision = 'cmb-0000000000000000000000000000000000000000000000000000000000000004';
-    const promotion = 'cmb-0000000000000000000000000000000000000000000000000000000000000005';
+    const deepLeaf = '0000000000000000000000000000000000000000000000000000000000000008';
+    const root = '0000000000000000000000000000000000000000000000000000000000000001';
+    const revA = '0000000000000000000000000000000000000000000000000000000000000002';
+    const revB = '0000000000000000000000000000000000000000000000000000000000000009';
+    const verdict = '0000000000000000000000000000000000000000000000000000000000000003';
+    const decision = '0000000000000000000000000000000000000000000000000000000000000004';
+    const promotion = '0000000000000000000000000000000000000000000000000000000000000005';
 
     const deepAncestors = ancestors(seed, deepLeaf);
-    assert(deepAncestors[0] === 'cmb-0000000000000000000000000000000000000000000000000000000000000007', 'deep ancestors start at direct parent');
+    assert(deepAncestors[0] === '0000000000000000000000000000000000000000000000000000000000000007', 'deep ancestors start at direct parent');
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/lineage.cjs
  super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl
  super-gsd/tools/mesh-memory/evidence-validator.cjs
  super-gsd/tools/mesh-memory/echo-detector.cjs
  super-gsd/tools/mesh-memory/run-self-test.cjs
VERIFICATION:
  - Not run by Codex per operator rule: no tools.
  - Expected operator commands: node super-gsd/tools/mesh-memory/lineage.cjs --help; node super-gsd/tools/mesh-memory/evidence-validator.cjs --help; node super-gsd/tools/mesh-memory/echo-detector.cjs --help; node super-gsd/tools/mesh-memory/run-self-test.cjs
DEVIATIONS:
  - Echo result is persisted in CMB body as echo_detected/echo_marker, not lineage.echo_detected, because cmb.schema.json forbids extra lineage properties.
  - No SKILL.md patch included because the read-pack already contains the requested Layer 4 soft wire-in text.
BLOCKERS:
  - None.
ONE_LINER:
  P108 patch fixes schema-shaped seed/evidence data, uses canonical sha256 CMB keys, validates emitted evidence verdicts, and keeps self-test constants aligned with schema-valid ledger keys.
REPORT_END
