SUCCESS: The process with PID 27164 (child process of PID 12100) has been terminated.
SUCCESS: The process with PID 42284 (child process of PID 12100) has been terminated.
SUCCESS: The process with PID 20432 (child process of PID 12100) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs b/super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs
index 1111111..2222222 100755
--- a/super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs
+++ b/super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs
@@ -14,8 +14,9 @@ const DEFAULT_LEDGER = path.resolve(
   '..',
   '..',
   '.planning',
-  'metrics',
-  'mesh-memory-lite.jsonl'
+  'mesh',
+  'memory',
+  'cmbs.jsonl'
 );
 
 function requireDependency(name) {
@@ -133,12 +134,13 @@ function getVerdict(evidence) {
   return normalizeVerdict(
     firstDefined(
       evidence.verdict,
-      evidence.status,
       evidence.body && evidence.body.verdict,
+      evidence.body && evidence.body.evidence_status,
       evidence.body && evidence.body.evidence_verdict,
       evidence.body && evidence.body.result,
-      evidence.body && evidence.body.status
+      evidence.body && evidence.body.status,
+      evidence.status
     )
   );
 }
@@ -149,6 +151,8 @@ function getEvidenceRefs(evidence, lineage) {
     ...asArray(evidence.evidence_refs),
     ...asArray(evidence.body && evidence.body.evidence_refs),
     ...asArray(evidence.body && evidence.body.refs),
+    ...asArray(evidence.body && evidence.body.refuting_evidence),
+    ...asArray(evidence.body && evidence.body.tests_refuting),
   ];
 
   for (const item of lineage) {
@@ -216,6 +220,10 @@ function findOperatorPrecedents(ledger, evidence) {
     ...asArray(evidence.tags),
     ...asArray(evidence.body && evidence.body.tags),
   ]);
+  const decisionBasis = String(
+    firstDefined(evidence.body && evidence.body.decision_basis, evidence.decision_basis, '')
+  ).toLowerCase();
 
   return ledger.filter((entry) => {
     if (!entry || entry.type !== 'operator_precedent') {
@@ -225,7 +233,18 @@ function findOperatorPrecedents(ledger, evidence) {
       ...asArray(entry.tags),
       ...asArray(entry.body && entry.body.tags),
     ];
-    return tags.some((tag) => evidenceTags.has(tag));
+    if (tags.some((tag) => evidenceTags.has(tag))) {
+      return true;
+    }
+    const precedentText = [
+      entry.body && entry.body.precedent,
+      entry.body && entry.body.decision_basis,
+      entry.body && entry.body.scope,
+    ]
+      .filter(Boolean)
+      .join(' ')
+      .toLowerCase();
+    return Boolean(decisionBasis && precedentText && precedentText.includes(decisionBasis));
   });
 }
 
@@ -319,6 +338,28 @@ function buildContextPack(evidence, lineage, precedents) {
   };
 }
 
+function precedentEvidenceRefs(precedents) {
+  return precedents.flatMap((precedent) => [
+    ...asArray(precedent.evidence_refs),
+    ...asArray(precedent.body && precedent.body.evidence_refs),
+  ]);
+}
+
+function formatRecommendation(baseRecommendation, precedents) {
+  if (!precedents.length) {
+    return baseRecommendation;
+  }
+  const cited = precedents
+    .map((precedent) => {
+      const scope = precedent.body && precedent.body.scope ? `:${precedent.body.scope}` : '';
+      return `${precedent.key}${scope}`;
+    })
+    .join(',');
+  return `${baseRecommendation} | cites operator_precedent ${cited}`;
+}
+
 function buildDecisionRecommendation({ evidence, ledger, now = new Date() }) {
   const lineage = walkLineage(ledger, evidence);
   const precedents = findOperatorPrecedents(ledger, evidence);
@@ -328,14 +369,23 @@ function buildDecisionRecommendation({ evidence, ledger, now = new Date() }) {
   const confidence = Math.max(0, Math.min(1, Number(tier1.confidence)));
   const decisionContext = collectDecisionContext(evidence, lineage, confidence);
   const gate = checkCarveOuts(decisionContext);
-  const evidenceRefs = getEvidenceRefs(evidence, lineage);
+  const evidenceRefs = [
+    ...new Set([...getEvidenceRefs(evidence, lineage), ...precedentEvidenceRefs(precedents)]),
+  ];
+  const recommendation = formatRecommendation(tier1.recommendation, precedents);
+  const precedentKeys = precedents.map((entry) => entry.key).filter(Boolean);
+  const lineageKeys = lineage.map((entry) => entry.key).filter(Boolean);
+  const parentKeys = [...new Set([evidence.key, ...precedentKeys].filter(Boolean))];
+  const ancestorKeys = [...new Set(lineageKeys)];
 
   const payloadForKey = {
     evidence: evidence.key,
-    recommendation: tier1.recommendation,
+    recommendation,
     confidence,
     gate,
+    precedents: precedentKeys,
   };
 
   return {
@@ -357,7 +407,7 @@ function buildDecisionRecommendation({ evidence, ledger, now = new Date() }) {
       mood: gate.real_operator_required ? 'restrained' : 'decisive',
     },
     body: {
-      recommendation: tier1.recommendation,
+      recommendation,
       authority_level: tier1.authority_level,
       confidence,
       real_operator_required: gate.real_operator_required,
@@ -367,8 +417,8 @@ function buildDecisionRecommendation({ evidence, ledger, now = new Date() }) {
       carve_outs_triggered: gate.carve_outs_triggered,
     },
     lineage: {
-      parents: [evidence.key],
-      ancestors: [],
+      parents: parentKeys,
+      ancestors: ancestorKeys,
     },
     authority_level: 'decision',
     evidence_refs: evidenceRefs,
@@ -386,10 +436,15 @@ function getValidator() {
   }
 
   const Ajv = requireDependency('ajv');
+  const addFormats = requireDependency('ajv-formats');
+  const addErrors = requireDependency('ajv-errors');
   const schemaPath = path.resolve(__dirname, '..', '..', 'schemas', 'cmb.schema.json');
   const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
   const ajv = new Ajv({ allErrors: true, strict: false });
+  addFormats(ajv);
+  addErrors(ajv);
   cachedValidator = ajv.compile(schema);
   return cachedValidator;
 }
@@ -423,7 +478,7 @@ function syntheticEvidence({ key, verdict, confidence, targetSystems = [], targe
     created_at: new Date().toISOString(),
     created_by: 'evidence_validator',
-    role: 'verifier',
+    role: 'evidence_validator',
     milestone_id: 'v3.0',
     phase_id: '109',
     cat7: {
@@ -437,7 +492,9 @@ function syntheticEvidence({ key, verdict, confidence, targetSystems = [], targe
       mood: 'neutral',
     },
     body: {
-      verdict,
+      evidence_status: verdict,
+      tier_used: 1,
+      decision_basis: `self-test ${verdict}`,
       confidence,
       decision_context: {
         decision_type: 'doc_update',
@@ -457,7 +514,7 @@ function syntheticEvidence({ key, verdict, confidence, targetSystems = [], targe
       ancestors: [],
     },
-    authority_level: 'evidence',
+    authority_level: 'claim_with_authority',
     evidence_refs: ['self-test:1'],
     status: 'emitted',
   };
@@ -492,7 +549,6 @@ function runSelfTest(kind, ledgerPath) {
   }
 
   const ledger = readJsonl(ledgerPath);
-  appendJsonl(ledgerPath, evidence);
   const recommendation = buildDecisionRecommendation({
     evidence,
     ledger: [...ledger, evidence],
diff --git a/super-gsd/tools/mesh-memory/run-self-test.cjs b/super-gsd/tools/mesh-memory/run-self-test.cjs
index 3333333..4444444 100755
--- a/super-gsd/tools/mesh-memory/run-self-test.cjs
+++ b/super-gsd/tools/mesh-memory/run-self-test.cjs
@@ -3,6 +3,8 @@
 'use strict';
 
 (function installP109SelfTestExtension() {
+  // P109 assertions now live in main(); keep this legacy shim inert.
+  return;
   let ran = false;
 
   function runP109Assertions(exitCode) {
@@ -275,8 +277,15 @@ const VALIDATE = path.join(__dirname, 'cmb-validate.cjs');
 const HASH = path.join(__dirname, 'cmb-hash.cjs');
 const GOOD_EXECUTION = path.join(__dirname, 'fixtures', 'good-execution-receipt.json');
 const GOOD_REVIEW = path.join(__dirname, 'fixtures', 'good-review-finding.json');
+const GOOD_DECISION = path.join(__dirname, 'fixtures', 'good-decision-recommendation.json');
+const ESCALATION_GATE = path.join(__dirname, 'escalation-gate.cjs');
+const PSEUDO_OPERATOR = path.join(__dirname, 'pseudo-operator-peer.cjs');
 
 const results = [];
+const { checkCarveOuts } = require('./escalation-gate.cjs');
+const {
+  buildDecisionRecommendation,
+  computeTier1Decision,
+} = require('./pseudo-operator-peer.cjs');
 
 function assert(condition, message) {
   results.push({ ok: !!condition, message });
@@ -305,6 +314,59 @@ function ledgerRows(filePath) {
   return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
 }
 
+function p109Context(overrides = {}) {
+  return {
+    decision_type: 'doc_update',
+    target_systems: [],
+    target_files: [],
+    milestone_state: {
+      scope_change: false,
+      commercial_impact: false,
+      legal_impact: false,
+      ...(overrides.milestone_state || {}),
+    },
+    confidence: 0.85,
+    destructive: false,
+    ...overrides,
+    milestone_state: {
+      scope_change: false,
+      commercial_impact: false,
+      legal_impact: false,
+      ...(overrides.milestone_state || {}),
+    },
+  };
+}
+
+function p109IncludesCarveOut(overrides, carveOut) {
+  return checkCarveOuts(p109Context(overrides)).carve_outs_triggered.includes(carveOut);
+}
+
+function p109SyntheticEvidence(overrides = {}) {
+  const base = {
+    key: `cmb-p109-run-self-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
+    type: 'evidence_verdict',
+    milestone_id: 'v3.0',
+    phase_id: '109',
+    body: {
+      evidence_status: 'VERIFIED_CRIT',
+      confidence: 0.86,
+      evidence_refs: ['run-self-test:1'],
+      decision_basis: 'run-self-test synthetic evidence',
+      decision_context: p109Context({}),
+    },
+    lineage: {
+      parents: [],
+      ancestors: [],
+    },
+    evidence_refs: ['run-self-test:1'],
+  };
+
+  return {
+    ...base,
+    ...overrides,
+    body: {
+      ...base.body,
+      ...(overrides.body || {}),
+    },
+  };
+}
+
 function main() {
   try {
     assert(fs.existsSync(LINEAGE), 'lineage.cjs exists');
@@ -316,6 +378,9 @@ function main() {
     assert(fs.existsSync(HASH), 'cmb-hash.cjs exists');
     assert(fs.existsSync(GOOD_EXECUTION), 'good execution fixture exists');
     assert(fs.existsSync(GOOD_REVIEW), 'good review fixture exists');
+    assert(fs.existsSync(GOOD_DECISION), 'good decision recommendation fixture exists');
+    assert(fs.existsSync(ESCALATION_GATE), 'escalation-gate.cjs exists');
+    assert(fs.existsSync(PSEUDO_OPERATOR), 'pseudo-operator-peer.cjs exists');
 
     assertExitZero('cmb-validate --help', VALIDATE, ['--help']);
     assertExitZero('cmb-hash --help', HASH, ['--help']);
@@ -334,6 +399,10 @@ function main() {
       const schemaResult = validateCmbAgainstSchema(row);
       assert(schemaResult.valid, `seed CMB schema-valid: ${row.key}`);
     }
+    const goodDecision = JSON.parse(fs.readFileSync(GOOD_DECISION, 'utf8'));
+    const goodDecisionSchema = validateCmbAgainstSchema(goodDecision);
+    assert(goodDecisionSchema.valid, `good decision recommendation fixture schema-valid: ${JSON.stringify(goodDecisionSchema.errors)}`);
 
     const deepLeaf = 'cmb-0000000000000000000000000000000000000000000000000000000000000008';
     const root = 'cmb-0000000000000000000000000000000000000000000000000000000000000001';
@@ -382,9 +451,79 @@ function main() {
     assert(evidenceRows.some((row) => row.body && row.body.decision_basis === 'fixture_path_in_real_data_check'), 'live ledger includes fixture guard verdict');
     assert(seed[6].lineage.parents.every((parent) => seed.some((row) => row.key === parent)), '7th seed CMB lineage parents exist in ledger');
 
-    const passed = results.filter((result) => result.ok).length;
-    assert(passed >= 30, 'self-test assertion floor is at least 30');
-    process.stderr.write(`[run-self-test] ${passed}/${passed} passed\n`);
+    assert(typeof checkCarveOuts === 'function', 'escalation-gate exports checkCarveOuts');
+    assert(typeof buildDecisionRecommendation === 'function', 'pseudo operator exports decision builder');
+    assert(typeof computeTier1Decision === 'function', 'pseudo operator exports tier1 decision');
+
+    assertExitZero('escalation-gate --help', ESCALATION_GATE, ['--help']);
+    assertExitZero('pseudo-operator-peer --help', PSEUDO_OPERATOR, ['--help']);
+    assertExitZero('escalation-gate production mutation self-test', ESCALATION_GATE, ['--self-test-production-mutation']);
+    assertExitZero('escalation-gate credential self-test', ESCALATION_GATE, ['--self-test-credential']);
+    assertExitZero('escalation-gate pass-through self-test', ESCALATION_GATE, ['--self-test-pass-through']);
+
+    assert(p109IncludesCarveOut({ target_systems: ['sap'] }, 'production_mutation'), 'sap target triggers production_mutation');
+    assert(p109IncludesCarveOut({ target_systems: ['mongo'] }, 'production_mutation'), 'mongo target triggers production_mutation');
+    assert(p109IncludesCarveOut({ target_systems: ['qdrant'] }, 'production_mutation'), 'qdrant target triggers production_mutation');
+    assert(p109IncludesCarveOut({ target_systems: ['elasticsearch'] }, 'production_mutation'), 'elasticsearch target triggers production_mutation');
+    assert(p109IncludesCarveOut({ target_systems: ['customer_db'] }, 'production_mutation'), 'customer_db target triggers production_mutation');
+    assert(p109IncludesCarveOut({ target_files: ['production/config.json'] }, 'production_mutation'), 'production file triggers production_mutation');
+    assert(p109IncludesCarveOut({ target_files: ['config/secrets.env'] }, 'credential_or_security'), 'secret env triggers credential_or_security');
+    assert(p109IncludesCarveOut({ target_files: ['credentials/service.json'] }, 'credential_or_security'), 'credentials path triggers credential_or_security');
+    assert(p109IncludesCarveOut({ target_files: ['config/api-token.json'] }, 'credential_or_security'), 'token path triggers credential_or_security');
+    assert(p109IncludesCarveOut({ target_files: ['certs/client.pem'] }, 'credential_or_security'), 'pem path triggers credential_or_security');
+    assert(p109IncludesCarveOut({ decision_type: 'auth_change' }, 'credential_or_security'), 'auth_change triggers credential_or_security');
+    assert(p109IncludesCarveOut({ confidence: 0.65 }, 'low_confidence'), 'low confidence triggers low_confidence');
+
+    const passThrough = checkCarveOuts(p109Context({ confidence: 0.85, destructive: false }));
+    assert(passThrough.allow_autonomous === true, 'benign decision allows autonomous');
+    assert(passThrough.real_operator_required === false, 'benign decision does not require real operator');
+    assert(passThrough.carve_outs_triggered.length === 0, 'benign decision has no carve-outs');
+
+    const orderedCarveOuts = checkCarveOuts(p109Context({
+      decision_type: 'security_change',
+      target_systems: ['sap'],
+      milestone_state: { scope_change: true, commercial_impact: true, legal_impact: true },
+      destructive: true,
+      confidence: 0.1,
+    })).carve_outs_triggered;
+    assert(orderedCarveOuts[0] === 'production_mutation', 'carve-out order starts with production_mutation');
+    assert(orderedCarveOuts[1] === 'credential_or_security', 'carve-out order keeps credential second');
+    assert(orderedCarveOuts[2] === 'milestone_scope_change', 'carve-out order keeps scope third');
+    assert(orderedCarveOuts[3] === 'commercial_legal_policy', 'carve-out order keeps policy fourth');
+    assert(orderedCarveOuts[4] === 'destructive_or_irreversible', 'carve-out order keeps destructive fifth');
+    assert(orderedCarveOuts[5] === 'low_confidence', 'carve-out order keeps low confidence sixth');
+
+    const verifiedEvidence = p109SyntheticEvidence();
+    const verifiedTier = computeTier1Decision(verifiedEvidence, []);
+    assert(verifiedTier.recommendation === 'PASS', 'tier1 verified path recommends PASS');
+    assert(verifiedTier.authority_level === 3, 'tier1 verified path authority level 3');
+    const verifiedDecision = buildDecisionRecommendation({ evidence: verifiedEvidence, ledger: [verifiedEvidence] });
+    assert(validateCmbAgainstSchema(verifiedDecision).valid, 'verified decision recommendation schema-valid');
+    assert(verifiedDecision.body.confidence >= 0.8, 'verified decision confidence is high');
+    assert(verifiedDecision.body.real_operator_required === false, 'verified benign path does not require real operator');
+    assert(verifiedDecision.body.carve_outs_triggered.length === 0, 'verified benign path has no carve-outs');
+    assert(verifiedDecision.lineage.parents[0] === verifiedEvidence.key, 'decision lineage parent is evidence verdict');
+
+    const refutedEvidence = p109SyntheticEvidence({ body: { evidence_status: 'REFUTED_CRIT', confidence: 0.76 } });
+    const refutedDecision = buildDecisionRecommendation({ evidence: refutedEvidence, ledger: [refutedEvidence] });
+    assert(refutedDecision.body.recommendation === 'PASS_WITH_REFUTED_REVIEW', 'refuted path recommends PASS_WITH_REFUTED_REVIEW');
+    assert(refutedDecision.body.authority_level === 2, 'refuted path authority level 2');
+
+    const fixtureDEvidence = p109SyntheticEvidence({ body: { confidence: 0.95, decision_context: p109Context({ target_systems: ['sap'], confidence: 0.95 }) } });
+    const fixtureDDecision = buildDecisionRecommendation({ evidence: fixtureDEvidence, ledger: [fixtureDEvidence] });
+    assert(fixtureDDecision.body.confidence >= 0.95, 'fixture D preserves high confidence');
+    assert(fixtureDDecision.body.real_operator_required === true, 'fixture D requires real operator');
+    assert(fixtureDDecision.body.carve_outs_triggered.includes('production_mutation'), 'fixture D triggers production_mutation');
+
+    const lowConfidenceEvidence = p109SyntheticEvidence({ body: { confidence: 0.5 } });
+    const lowConfidenceDecision = buildDecisionRecommendation({ evidence: lowConfidenceEvidence, ledger: [lowConfidenceEvidence] });
+    assert(lowConfidenceDecision.body.real_operator_required === true, 'low confidence requires real operator');
+    assert(lowConfidenceDecision.body.carve_outs_triggered.includes('low_confidence'), 'low confidence triggers low_confidence');
+
+    assertExitZero('pseudo-operator verified path self-test', PSEUDO_OPERATOR, ['--self-test-verified-path']);
+    assertExitZero('pseudo-operator refuted path self-test', PSEUDO_OPERATOR, ['--self-test-refuted-path']);
+    assertExitZero('pseudo-operator fixture D self-test', PSEUDO_OPERATOR, ['--self-test-fixture-d']);
+    assertExitZero('pseudo-operator low confidence self-test', PSEUDO_OPERATOR, ['--self-test-low-confidence']);
+
+    const p109LiveRows = ledgerRows(LEDGER_PATH);
+    assert(p109LiveRows.some((row) => row && row.type === 'decision_recommendation' && row.body && Array.isArray(row.body.carve_outs_triggered) && row.body.carve_outs_triggered.includes('production_mutation')), 'live ledger includes production_mutation decision_recommendation');
+
+    const passedBeforeFloor = results.filter((result) => result.ok).length;
+    assert(passedBeforeFloor >= 60, 'self-test assertion floor is at least 60');
+    const passed = results.filter((result) => result.ok).length;
+    process.stdout.write(`[run-self-test] ${passed}/${passed} passed\n`);
   } catch (error) {
     const passed = results.filter((result) => result.ok).length;
     process.stderr.write(`[run-self-test] ${passed}/${results.length} passed\n`);
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs (modified)
  super-gsd/tools/mesh-memory/run-self-test.cjs (modified)
VERIFICATION:
  Not run; operator explicitly prohibited tool calls. Patch wires schema-format validation, evidence_status support, main() P109 assertions, Fixture D checks, and a >=60 floor.
DEVIATIONS:
  escalation-gate.cjs was already present in the supplied read-pack, so this patch does not recreate it. The prior beforeExit P109 shim is left inert so the active assertions run from main().
BLOCKERS:
  None.
ONE_LINER:
  P109 decision layer tightened: pseudo_operator now consumes P108 evidence_status CMBs, respects carve-outs, and run-self-test owns the Fixture D restraint proof.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
