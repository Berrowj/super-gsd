#!/usr/bin/env node
'use strict';

(function installP109SelfTestExtension() {
  // P109 assertions now live in main(); keep this legacy shim inert.
  return;
  let ran = false;

  function runP109Assertions(exitCode) {
    if (ran) {
      return exitCode;
    }
    ran = true;

    const fs = require('fs');
    const path = require('path');
    const { spawnSync } = require('child_process');
    const root = path.resolve(__dirname, '..', '..', '..');
    const escalationGatePath = path.resolve(__dirname, 'escalation-gate.cjs');
    const pseudoOperatorPath = path.resolve(__dirname, 'pseudo-operator-peer.cjs');
    const ledgerPath = path.resolve(root, '.planning', 'metrics', 'mesh-memory-lite.jsonl');
    const gate = require(escalationGatePath);
    const pseudo = require(pseudoOperatorPath);
    const assertions = [];
    let passed = 0;

    function assert(condition, label) {
      assertions.push(label);
      if (!condition) {
        throw new Error(`[run-self-test] ${label}`);
      }
      passed += 1;
    }

    function runNode(script, args) {
      return spawnSync(process.execPath, [script, ...args], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
      });
    }

    function readJsonl(filePath) {
      if (!fs.existsSync(filePath)) {
        return [];
      }
      return fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    }

    function context(overrides) {
      return {
        decision_type: 'doc_update',
        target_systems: [],
        target_files: [],
        milestone_state: {
          scope_change: false,
          commercial_impact: false,
          legal_impact: false,
        },
        confidence: 0.85,
        destructive: false,
        ...overrides,
      };
    }

    function includesCarveOut(overrides, carveOut) {
      return gate.checkCarveOuts(context(overrides)).carve_outs_triggered.includes(carveOut);
    }

    function syntheticEvidence(overrides) {
      return {
        key: `cmb-p109-extension-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: 'evidence_verdict',
        milestone_id: 'v3.0',
        phase_id: '109',
        body: {
          verdict: 'VERIFIED_CRIT',
          confidence: 0.86,
          evidence_refs: ['run-self-test:1'],
          decision_context: context({}),
        },
        lineage: { parents: [], ancestors: [] },
        evidence_refs: ['run-self-test:1'],
        ...overrides,
      };
    }

    try {
      assert(fs.existsSync(escalationGatePath), 'P109 escalation gate file exists');
      assert(fs.existsSync(pseudoOperatorPath), 'P109 pseudo operator file exists');
      assert(typeof gate.checkCarveOuts === 'function', 'escalation-gate exports checkCarveOuts');
      assert(typeof pseudo.buildDecisionRecommendation === 'function', 'pseudo operator exports builder');
      assert(typeof pseudo.computeTier1Decision === 'function', 'pseudo operator exports tier1 decision');

      assert(runNode(escalationGatePath, ['--help']).status === 0, 'escalation-gate --help exit 0');
      assert(runNode(pseudoOperatorPath, ['--help']).status === 0, 'pseudo-operator-peer --help exit 0');
      assert(
        runNode(escalationGatePath, ['--self-test-production-mutation']).status === 0,
        'escalation-gate production mutation self-test exit 0'
      );
      assert(
        runNode(escalationGatePath, ['--self-test-credential']).status === 0,
        'escalation-gate credential self-test exit 0'
      );
      assert(
        runNode(escalationGatePath, ['--self-test-pass-through']).status === 0,
        'escalation-gate pass-through self-test exit 0'
      );

      assert(includesCarveOut({ target_systems: ['sap'] }, 'production_mutation'), 'sap triggers production_mutation');
      assert(includesCarveOut({ target_systems: ['mongo'] }, 'production_mutation'), 'mongo triggers production_mutation');
      assert(includesCarveOut({ target_systems: ['qdrant'] }, 'production_mutation'), 'qdrant triggers production_mutation');
      assert(includesCarveOut({ target_systems: ['elasticsearch'] }, 'production_mutation'), 'elasticsearch triggers production_mutation');
      assert(includesCarveOut({ target_systems: ['customer_db'] }, 'production_mutation'), 'customer_db triggers production_mutation');
      assert(includesCarveOut({ target_systems: ['production'] }, 'production_mutation'), 'production system triggers production_mutation');
      assert(includesCarveOut({ target_files: ['prod-config.json'] }, 'production_mutation'), 'prod* file triggers production_mutation');
      assert(includesCarveOut({ target_files: ['production/config.json'] }, 'production_mutation'), 'production directory triggers production_mutation');

      assert(includesCarveOut({ target_files: ['.env'] }, 'credential_or_security'), '.env triggers credential_or_security');
      assert(includesCarveOut({ target_files: ['config/secrets.env'] }, 'credential_or_security'), 'secrets env triggers credential_or_security');
      assert(includesCarveOut({ target_files: ['secrets/api.json'] }, 'credential_or_security'), 'secrets directory triggers credential_or_security');
      assert(includesCarveOut({ target_files: ['credentials/api.json'] }, 'credential_or_security'), 'credentials directory triggers credential_or_security');
      assert(includesCarveOut({ target_files: ['config/service-token.json'] }, 'credential_or_security'), 'token path triggers credential_or_security');
      assert(includesCarveOut({ target_files: ['config/private-key.json'] }, 'credential_or_security'), 'key path triggers credential_or_security');
      assert(includesCarveOut({ target_files: ['certs/client.pem'] }, 'credential_or_security'), 'pem path triggers credential_or_security');
      assert(includesCarveOut({ target_files: ['certs/client.crt'] }, 'credential_or_security'), 'crt path triggers credential_or_security');
      assert(includesCarveOut({ decision_type: 'auth_change' }, 'credential_or_security'), 'auth_change triggers credential_or_security');
      assert(includesCarveOut({ decision_type: 'security_change' }, 'credential_or_security'), 'security_change triggers credential_or_security');

      assert(
        includesCarveOut({ milestone_state: { scope_change: true, commercial_impact: false, legal_impact: false } }, 'milestone_scope_change'),
        'scope change triggers milestone_scope_change'
      );
      assert(
        includesCarveOut({ milestone_state: { scope_change: false, commercial_impact: true, legal_impact: false } }, 'commercial_legal_policy'),
        'commercial impact triggers commercial_legal_policy'
      );
      assert(
        includesCarveOut({ milestone_state: { scope_change: false, commercial_impact: false, legal_impact: true } }, 'commercial_legal_policy'),
        'legal impact triggers commercial_legal_policy'
      );
      assert(includesCarveOut({ destructive: true }, 'destructive_or_irreversible'), 'destructive triggers destructive_or_irreversible');
      assert(includesCarveOut({ confidence: 0.65 }, 'low_confidence'), 'confidence below 0.70 triggers low_confidence');

      const passThrough = gate.checkCarveOuts(context({ confidence: 0.85, destructive: false }));
      assert(passThrough.allow_autonomous === true, 'benign context allows autonomous');
      assert(passThrough.real_operator_required === false, 'benign context does not require real operator');
      assert(passThrough.carve_outs_triggered.length === 0, 'benign context has no carve-outs');

      const blocked = gate.checkCarveOuts(context({ target_systems: ['sap'] }));
      assert(blocked.allow_autonomous === false, 'carve-out blocks autonomous handling');
      assert(blocked.real_operator_required === true, 'carve-out requires real operator');

      const ordered = gate.checkCarveOuts(
        context({
          decision_type: 'security_change',
          target_systems: ['sap'],
          milestone_state: { scope_change: true, commercial_impact: true, legal_impact: true },
          destructive: true,
          confidence: 0.1,
        })
      ).carve_outs_triggered;
      assert(ordered[0] === 'production_mutation', 'carve-out order starts with production_mutation');
      assert(ordered[1] === 'credential_or_security', 'carve-out order keeps credential second');
      assert(ordered[2] === 'milestone_scope_change', 'carve-out order keeps scope third');
      assert(ordered[3] === 'commercial_legal_policy', 'carve-out order keeps policy fourth');
      assert(ordered[4] === 'destructive_or_irreversible', 'carve-out order keeps destructive fifth');
      assert(ordered[5] === 'low_confidence', 'carve-out order keeps low confidence sixth');

      const verifiedEvidence = syntheticEvidence({});
      const verified = pseudo.buildDecisionRecommendation({ evidence: verifiedEvidence, ledger: [verifiedEvidence] });
      assert(verified.type === 'decision_recommendation', 'verified path emits decision_recommendation');
      assert(verified.created_by === 'pseudo_operator', 'decision recommendation created_by pseudo_operator');
      assert(verified.role === 'pseudo_operator', 'decision recommendation role pseudo_operator');
      assert(verified.milestone_id === 'v3.0', 'decision recommendation milestone v3.0');
      assert(verified.phase_id === '109', 'decision recommendation phase 109');
      assert(verified.authority_level === 'decision', 'decision recommendation top authority decision');
      assert(verified.status === 'emitted', 'decision recommendation emitted status');
      assert(verified.lineage.parents[0] === verifiedEvidence.key, 'decision recommendation parent evidence key');
      assert(Array.isArray(verified.lineage.ancestors), 'decision recommendation lineage ancestors array');
      assert(verified.body.recommendation === 'PASS', 'verified path recommends PASS');
      assert(verified.body.authority_level === 3, 'verified path authority level 3');
      assert(verified.body.confidence >= 0.8, 'verified path high confidence');
      assert(verified.body.real_operator_required === false, 'verified path no real operator');
      assert(verified.body.carve_outs_triggered.length === 0, 'verified path no carve-outs');
      assert(verified.body.context_pack_id.startsWith('ctx-'), 'verified path context pack id');
      assert(Array.isArray(verified.body.evidence_refs), 'verified path body evidence_refs array');
      assert(Array.isArray(verified.evidence_refs), 'verified path top evidence_refs array');
      assert(Object.keys(verified.cat7).length === 7, 'decision recommendation cat7 has seven fields');

      const refutedEvidence = syntheticEvidence({ body: { ...verifiedEvidence.body, verdict: 'REFUTED_CRIT', confidence: 0.76 } });
      const refuted = pseudo.buildDecisionRecommendation({ evidence: refutedEvidence, ledger: [refutedEvidence] });
      assert(refuted.body.recommendation === 'PASS_WITH_REFUTED_REVIEW', 'refuted path recommends review');
      assert(refuted.body.authority_level === 2, 'refuted path authority level 2');

      const fixtureDEvidence = syntheticEvidence({
        body: {
          ...verifiedEvidence.body,
          confidence: 0.95,
          decision_context: context({ target_systems: ['sap'], confidence: 0.95 }),
        },
      });
      const fixtureD = pseudo.buildDecisionRecommendation({ evidence: fixtureDEvidence, ledger: [fixtureDEvidence] });
      assert(fixtureD.body.confidence >= 0.95, 'fixture D keeps high confidence');
      assert(fixtureD.body.real_operator_required === true, 'fixture D requires real operator');
      assert(fixtureD.body.carve_outs_triggered.includes('production_mutation'), 'fixture D triggers production_mutation');

      const lowConfidenceEvidence = syntheticEvidence({ body: { ...verifiedEvidence.body, confidence: 0.5 } });
      const lowConfidence = pseudo.buildDecisionRecommendation({ evidence: lowConfidenceEvidence, ledger: [lowConfidenceEvidence] });
      assert(lowConfidence.body.real_operator_required === true, 'low confidence recommendation requires operator');
      assert(lowConfidence.body.carve_outs_triggered.includes('low_confidence'), 'low confidence recommendation triggers low_confidence');

      assert(runNode(pseudoOperatorPath, ['--self-test-verified-path']).status === 0, 'pseudo-operator verified path self-test exit 0');
      assert(runNode(pseudoOperatorPath, ['--self-test-refuted-path']).status === 0, 'pseudo-operator refuted path self-test exit 0');
      assert(runNode(pseudoOperatorPath, ['--self-test-fixture-d']).status === 0, 'pseudo-operator fixture D self-test exit 0');
      assert(runNode(pseudoOperatorPath, ['--self-test-low-confidence']).status === 0, 'pseudo-operator low confidence self-test exit 0');

      const liveLedgerEntries = readJsonl(ledgerPath);
      assert(
        liveLedgerEntries.some(
          (entry) =>
            entry &&
            entry.type === 'decision_recommendation' &&
            entry.body &&
            Array.isArray(entry.body.carve_outs_triggered) &&
            entry.body.carve_outs_triggered.length === 1 &&
            entry.body.carve_outs_triggered[0] === 'production_mutation'
        ),
        'live ledger contains production_mutation decision_recommendation'
      );

      const p109Floor = 60;
      assert(passed >= p109Floor, `P109 assertion floor ${p109Floor}`);
      process.stdout.write(`[run-self-test] ${passed}/${passed} passed\n`);
      return exitCode;
    } catch (error) {
      process.stderr.write(`${error.stack || error.message}\n`);
      return 1;
    }
  }

  const originalExit = process.exit.bind(process);
  process.exit = function patchedExit(code) {
    originalExit(runP109Assertions(code || 0));
  };
  process.on('beforeExit', (code) => {
    const nextCode = runP109Assertions(code || process.exitCode || 0);
    if (nextCode) {
      process.exitCode = nextCode;
    }
  });
})();

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  loadLedger,
  findCmb,
  ancestors,
  descendants,
  provenance,
  siblings,
} = require('./lineage.cjs');
const { validateCmbAgainstSchema } = require('./evidence-validator.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LEDGER_PATH = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const SEED_LEDGER_PATH = path.join(__dirname, 'fixtures', 'seed-ledger.jsonl');
const LINEAGE = path.join(__dirname, 'lineage.cjs');
const EVIDENCE = path.join(__dirname, 'evidence-validator.cjs');
const ECHO = path.join(__dirname, 'echo-detector.cjs');
const VALIDATE = path.join(__dirname, 'cmb-validate.cjs');
const HASH = path.join(__dirname, 'cmb-hash.cjs');
const GOOD_EXECUTION = path.join(__dirname, 'fixtures', 'good-execution-receipt.json');
const GOOD_REVIEW = path.join(__dirname, 'fixtures', 'good-review-finding.json');
const GOOD_DECISION = path.join(__dirname, 'fixtures', 'good-decision-recommendation.json');
const ESCALATION_GATE = path.join(__dirname, 'escalation-gate.cjs');
const PSEUDO_OPERATOR = path.join(__dirname, 'pseudo-operator-peer.cjs');

const results = [];
const { checkCarveOuts } = require('./escalation-gate.cjs');
const {
  buildDecisionRecommendation,
  computeTier1Decision,
} = require('./pseudo-operator-peer.cjs');

function assert(condition, message) {
  results.push({ ok: !!condition, message });
  if (!condition) throw new Error(message);
}

function runNode(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function assertExitZero(label, script, args = []) {
  const result = runNode(script, args);
  assert(result.status === 0, `${label} exited ${result.status}; stderr=${result.stderr}`);
  return result;
}

function ledgerRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function p109Context(overrides = {}) {
  return {
    decision_type: 'doc_update',
    target_systems: [],
    target_files: [],
    milestone_state: {
      scope_change: false,
      commercial_impact: false,
      legal_impact: false,
      ...(overrides.milestone_state || {}),
    },
    confidence: 0.85,
    destructive: false,
    ...overrides,
    milestone_state: {
      scope_change: false,
      commercial_impact: false,
      legal_impact: false,
      ...(overrides.milestone_state || {}),
    },
  };
}

function p109IncludesCarveOut(overrides, carveOut) {
  return checkCarveOuts(p109Context(overrides)).carve_outs_triggered.includes(carveOut);
}

function p109SyntheticEvidence(overrides = {}) {
  const base = {
    key: `cmb-p109-run-self-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'evidence_verdict',
    milestone_id: 'v3.0',
    phase_id: '109',
    body: {
      evidence_status: 'VERIFIED_CRIT',
      confidence: 0.86,
      evidence_refs: ['run-self-test:1'],
      decision_basis: 'run-self-test synthetic evidence',
      decision_context: p109Context({}),
    },
    lineage: {
      parents: [],
      ancestors: [],
    },
    evidence_refs: ['run-self-test:1'],
  };

  return {
    ...base,
    ...overrides,
    body: {
      ...base.body,
      ...(overrides.body || {}),
    },
  };
}

function main() {
  try {
    assert(fs.existsSync(LINEAGE), 'lineage.cjs exists');
    assert(fs.existsSync(EVIDENCE), 'evidence-validator.cjs exists');
    assert(fs.existsSync(ECHO), 'echo-detector.cjs exists');
    assert(fs.existsSync(SEED_LEDGER_PATH), 'seed-ledger.jsonl exists');
    assert(fs.existsSync(VALIDATE), 'cmb-validate.cjs exists');
    assert(fs.existsSync(HASH), 'cmb-hash.cjs exists');
    assert(fs.existsSync(GOOD_EXECUTION), 'good execution fixture exists');
    assert(fs.existsSync(GOOD_REVIEW), 'good review fixture exists');
    assert(fs.existsSync(GOOD_DECISION), 'good decision recommendation fixture exists');
    assert(fs.existsSync(ESCALATION_GATE), 'escalation-gate.cjs exists');
    assert(fs.existsSync(PSEUDO_OPERATOR), 'pseudo-operator-peer.cjs exists');

    assertExitZero('cmb-validate --help', VALIDATE, ['--help']);
    assertExitZero('cmb-hash --help', HASH, ['--help']);
    assertExitZero('lineage --help', LINEAGE, ['--help']);
    assertExitZero('evidence-validator --help', EVIDENCE, ['--help']);
    assertExitZero('echo-detector --help', ECHO, ['--help']);

    assertExitZero('lineage self-test ancestors', LINEAGE, ['--self-test-ancestors']);

    const seed = loadLedger(SEED_LEDGER_PATH);
    assert(seed.length >= 10, 'seed ledger has at least 10 CMB rows');
    assert(seed.every((row) => row.key && row.type && row.lineage), 'seed ledger rows have core CMB fields');
    for (const row of seed) {
      const schemaResult = validateCmbAgainstSchema(row);
      assert(schemaResult.valid, `seed CMB schema-valid: ${row.key}`);
    }
    const goodDecision = JSON.parse(fs.readFileSync(GOOD_DECISION, 'utf8'));
    const goodDecisionSchema = validateCmbAgainstSchema(goodDecision);
    assert(goodDecisionSchema.valid, `good decision recommendation fixture schema-valid: ${JSON.stringify(goodDecisionSchema.errors)}`);

    const deepLeaf = 'cmb-0000000000000000000000000000000000000000000000000000000000000008';
    const root = 'cmb-0000000000000000000000000000000000000000000000000000000000000001';
    const revA = 'cmb-0000000000000000000000000000000000000000000000000000000000000002';
    const revB = 'cmb-0000000000000000000000000000000000000000000000000000000000000009';
    const verdict = 'cmb-0000000000000000000000000000000000000000000000000000000000000003';
    const decision = 'cmb-0000000000000000000000000000000000000000000000000000000000000004';
    const promotion = 'cmb-0000000000000000000000000000000000000000000000000000000000000005';

    const deepAncestors = ancestors(seed, deepLeaf);
    assert(deepAncestors[0] === 'cmb-0000000000000000000000000000000000000000000000000000000000000007', 'deep ancestors start at direct parent');
    assert(deepAncestors.includes(root), 'deep ancestors include root');
    assert(deepAncestors.length === 7, 'deep leaf has seven ancestors');
    assert(ancestors(seed, deepLeaf, 3).length === 3, 'ancestors honours max-depth 3');
    assert(ancestors(seed, deepLeaf, 50).length <= 50, 'ancestors honours max-depth 50 cap');
    assert(descendants(seed, root).includes(deepLeaf), 'descendants includes deep leaf');
    assert(descendants(seed, verdict).includes(deepLeaf), 'descendants works through verdict chain');
    assert(provenance(seed, deepLeaf).map((row) => row.key)[0] === root, 'provenance starts at root');
    assert(provenance(seed, deepLeaf).map((row) => row.key).at(-1) === deepLeaf, 'provenance ends at target');
    assert(siblings(seed, revA).includes(revB), 'siblings finds shared parent');
    assert(findCmb(seed, promotion).lineage.parents[0] === decision, 'promotion links to decision recommendation');

    assertExitZero('evidence-validator verified self-test', EVIDENCE, ['--self-test-verified']);
    assertExitZero('evidence-validator refuted self-test', EVIDENCE, ['--self-test-refuted']);
    assertExitZero('evidence-validator fixture guard self-test', EVIDENCE, ['--self-test-fixture-guard']);
    assertExitZero('echo-detector echo hit self-test', ECHO, ['--self-test-echo-hit']);
    assertExitZero('echo-detector echo miss self-test', ECHO, ['--self-test-echo-miss']);

    const liveRows = ledgerRows(LEDGER_PATH);
    assert(liveRows.length >= 5, 'live mesh memory ledger has at least 5 CMB rows after self-tests');
    const evidenceRows = liveRows.filter((row) => row.type === 'evidence_verdict' && row.role === 'evidence_validator');
    assert(evidenceRows.length >= 3, 'evidence-validator emitted at least 3 evidence_verdict CMBs');
    assert(evidenceRows.every((row) => row.lineage && row.lineage.parents && row.lineage.parents.length === 1), 'evidence verdict rows link to one parent');
    assert(evidenceRows.some((row) => row.body && row.body.evidence_status === 'VERIFIED_CRIT'), 'live ledger includes VERIFIED_CRIT evidence verdict');
    assert(evidenceRows.some((row) => row.body && row.body.evidence_status === 'REFUTED_CRIT'), 'live ledger includes REFUTED_CRIT evidence verdict');
    assert(evidenceRows.some((row) => row.body && row.body.decision_basis === 'fixture_path_in_real_data_check'), 'live ledger includes fixture guard verdict');
    assert(seed[6].lineage.parents.every((parent) => seed.some((row) => row.key === parent)), '7th seed CMB lineage parents exist in ledger');

    assert(typeof checkCarveOuts === 'function', 'escalation-gate exports checkCarveOuts');
    assert(typeof buildDecisionRecommendation === 'function', 'pseudo operator exports decision builder');
    assert(typeof computeTier1Decision === 'function', 'pseudo operator exports tier1 decision');

    assertExitZero('escalation-gate --help', ESCALATION_GATE, ['--help']);
    assertExitZero('pseudo-operator-peer --help', PSEUDO_OPERATOR, ['--help']);
    assertExitZero('escalation-gate production mutation self-test', ESCALATION_GATE, ['--self-test-production-mutation']);
    assertExitZero('escalation-gate credential self-test', ESCALATION_GATE, ['--self-test-credential']);
    assertExitZero('escalation-gate pass-through self-test', ESCALATION_GATE, ['--self-test-pass-through']);

    assert(p109IncludesCarveOut({ target_systems: ['sap'] }, 'production_mutation'), 'sap target triggers production_mutation');
    assert(p109IncludesCarveOut({ target_systems: ['mongo'] }, 'production_mutation'), 'mongo target triggers production_mutation');
    assert(p109IncludesCarveOut({ target_systems: ['qdrant'] }, 'production_mutation'), 'qdrant target triggers production_mutation');
    assert(p109IncludesCarveOut({ target_systems: ['elasticsearch'] }, 'production_mutation'), 'elasticsearch target triggers production_mutation');
    assert(p109IncludesCarveOut({ target_systems: ['customer_db'] }, 'production_mutation'), 'customer_db target triggers production_mutation');
    assert(p109IncludesCarveOut({ target_files: ['production/config.json'] }, 'production_mutation'), 'production file triggers production_mutation');
    assert(p109IncludesCarveOut({ target_files: ['config/secrets.env'] }, 'credential_or_security'), 'secret env triggers credential_or_security');
    assert(p109IncludesCarveOut({ target_files: ['credentials/service.json'] }, 'credential_or_security'), 'credentials path triggers credential_or_security');
    assert(p109IncludesCarveOut({ target_files: ['config/api-token.json'] }, 'credential_or_security'), 'token path triggers credential_or_security');
    assert(p109IncludesCarveOut({ target_files: ['certs/client.pem'] }, 'credential_or_security'), 'pem path triggers credential_or_security');
    assert(p109IncludesCarveOut({ decision_type: 'auth_change' }, 'credential_or_security'), 'auth_change triggers credential_or_security');
    assert(p109IncludesCarveOut({ confidence: 0.65 }, 'low_confidence'), 'low confidence triggers low_confidence');

    const passThrough = checkCarveOuts(p109Context({ confidence: 0.85, destructive: false }));
    assert(passThrough.allow_autonomous === true, 'benign decision allows autonomous');
    assert(passThrough.real_operator_required === false, 'benign decision does not require real operator');
    assert(passThrough.carve_outs_triggered.length === 0, 'benign decision has no carve-outs');

    const orderedCarveOuts = checkCarveOuts(p109Context({
      decision_type: 'security_change',
      target_systems: ['sap'],
      milestone_state: { scope_change: true, commercial_impact: true, legal_impact: true },
      destructive: true,
      confidence: 0.1,
    })).carve_outs_triggered;
    assert(orderedCarveOuts[0] === 'production_mutation', 'carve-out order starts with production_mutation');
    assert(orderedCarveOuts[1] === 'credential_or_security', 'carve-out order keeps credential second');
    assert(orderedCarveOuts[2] === 'milestone_scope_change', 'carve-out order keeps scope third');
    assert(orderedCarveOuts[3] === 'commercial_legal_policy', 'carve-out order keeps policy fourth');
    assert(orderedCarveOuts[4] === 'destructive_or_irreversible', 'carve-out order keeps destructive fifth');
    assert(orderedCarveOuts[5] === 'low_confidence', 'carve-out order keeps low confidence sixth');

    const verifiedEvidence = p109SyntheticEvidence();
    const verifiedTier = computeTier1Decision(verifiedEvidence, []);
    assert(verifiedTier.recommendation === 'PASS', 'tier1 verified path recommends PASS');
    assert(verifiedTier.authority_level === 3, 'tier1 verified path authority level 3');
    const verifiedDecision = buildDecisionRecommendation({ evidence: verifiedEvidence, ledger: [verifiedEvidence] });
    assert(validateCmbAgainstSchema(verifiedDecision).valid, 'verified decision recommendation schema-valid');
    assert(verifiedDecision.body.confidence >= 0.8, 'verified decision confidence is high');
    assert(verifiedDecision.body.real_operator_required === false, 'verified benign path does not require real operator');
    assert(verifiedDecision.body.carve_outs_triggered.length === 0, 'verified benign path has no carve-outs');
    assert(verifiedDecision.lineage.parents[0] === verifiedEvidence.key, 'decision lineage parent is evidence verdict');

    const refutedEvidence = p109SyntheticEvidence({ body: { evidence_status: 'REFUTED_CRIT', confidence: 0.76 } });
    const refutedDecision = buildDecisionRecommendation({ evidence: refutedEvidence, ledger: [refutedEvidence] });
    assert(refutedDecision.body.recommendation === 'PASS_WITH_REFUTED_REVIEW', 'refuted path recommends PASS_WITH_REFUTED_REVIEW');
    assert(refutedDecision.body.authority_level === 2, 'refuted path authority level 2');

    const fixtureDEvidence = p109SyntheticEvidence({ body: { confidence: 0.95, decision_context: p109Context({ target_systems: ['sap'], confidence: 0.95 }) } });
    const fixtureDDecision = buildDecisionRecommendation({ evidence: fixtureDEvidence, ledger: [fixtureDEvidence] });
    assert(fixtureDDecision.body.confidence >= 0.95, 'fixture D preserves high confidence');
    assert(fixtureDDecision.body.real_operator_required === true, 'fixture D requires real operator');
    assert(fixtureDDecision.body.carve_outs_triggered.includes('production_mutation'), 'fixture D triggers production_mutation');

    const lowConfidenceEvidence = p109SyntheticEvidence({ body: { confidence: 0.5 } });
    const lowConfidenceDecision = buildDecisionRecommendation({ evidence: lowConfidenceEvidence, ledger: [lowConfidenceEvidence] });
    assert(lowConfidenceDecision.body.real_operator_required === true, 'low confidence requires real operator');
    assert(lowConfidenceDecision.body.carve_outs_triggered.includes('low_confidence'), 'low confidence triggers low_confidence');

    assertExitZero('pseudo-operator verified path self-test', PSEUDO_OPERATOR, ['--self-test-verified-path']);
    assertExitZero('pseudo-operator refuted path self-test', PSEUDO_OPERATOR, ['--self-test-refuted-path']);
    assertExitZero('pseudo-operator fixture D self-test', PSEUDO_OPERATOR, ['--self-test-fixture-d']);
    assertExitZero('pseudo-operator low confidence self-test', PSEUDO_OPERATOR, ['--self-test-low-confidence']);

    const p109LiveRows = ledgerRows(LEDGER_PATH);
    assert(p109LiveRows.some((row) => row && row.type === 'decision_recommendation' && row.body && Array.isArray(row.body.carve_outs_triggered) && row.body.carve_outs_triggered.includes('production_mutation')), 'live ledger includes production_mutation decision_recommendation');

    const passedBeforeFloor = results.filter((result) => result.ok).length;
    assert(passedBeforeFloor >= 60, 'self-test assertion floor is at least 60');
    const passed = results.filter((result) => result.ok).length;
    process.stdout.write(`[run-self-test] ${passed}/${passed} passed\n`);
  } catch (error) {
    const passed = results.filter((result) => result.ok).length;
    process.stderr.write(`[run-self-test] ${passed}/${results.length} passed\n`);
    process.stderr.write(`[run-self-test] ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
