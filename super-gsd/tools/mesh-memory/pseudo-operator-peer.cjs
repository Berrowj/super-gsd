#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { checkCarveOuts } = require('./escalation-gate.cjs');

const DEFAULT_LEDGER = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '.planning',
  'mesh',
  'memory',
  'cmbs.jsonl'
);

function requireDependency(name) {
  const candidates = [
    path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
    path.resolve(__dirname, 'node_modules', name),
    name,
  ];

  const errors = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }

  const failure = new Error(
    `Unable to load dependency "${name}" from candidates:\n${errors.join('\n')}`
  );
  failure.candidates = candidates;
  throw failure;
}

function parseArgs(argv) {
  const args = {
    ledger: DEFAULT_LEDGER,
    evidenceKey: null,
    help: false,
    selfTest: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      args.help = true;
    } else if (arg === '--ledger') {
      const ledgerArg = argv[++index];
      if (!ledgerArg) {
        throw new Error('--ledger requires a path');
      }
      args.ledger = path.resolve(ledgerArg);
    } else if (arg === '--evidence-key') {
      args.evidenceKey = argv[++index];
      if (!args.evidenceKey) {
        throw new Error('--evidence-key requires a CMB key');
      }
    } else if (arg === '--self-test-verified-path') {
      args.selfTest = 'verified';
    } else if (arg === '--self-test-refuted-path') {
      args.selfTest = 'refuted';
    } else if (arg === '--self-test-fixture-d') {
      args.selfTest = 'fixture-d';
    } else if (arg === '--self-test-low-confidence') {
      args.selfTest = 'low-confidence';
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  process.stdout.write(`Usage: node pseudo-operator-peer.cjs [--help] [--evidence-key <cmb-key>] [--ledger PATH] [--self-test-verified-path] [--self-test-refuted-path] [--self-test-fixture-d] [--self-test-low-confidence]

Consumes evidence_verdict CMBs and emits decision_recommendation CMBs gated by escalation carve-outs.

Options:
  --evidence-key <cmb-key>          Evidence verdict key to load from the ledger.
  --ledger PATH                     JSONL CMB ledger path. Defaults to .planning/metrics/mesh-memory-lite.jsonl.
  --self-test-verified-path         Emit a benign VERIFIED_CRIT decision recommendation.
  --self-test-refuted-path          Emit a PASS_WITH_REFUTED_REVIEW recommendation.
  --self-test-fixture-d             Prove production_mutation requires a real operator despite high confidence.
  --self-test-low-confidence        Prove low confidence requires a real operator.
  --help                           Show this help.
`);
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `Invalid JSONL in ${filePath} line ${index + 1}: ${error.message}`
        );
      }
    });
}

function appendJsonl(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

function shortHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 12);
}

function uniqueKey(prefix, payload) {
  return `${prefix}-${Date.now()}-${shortHash(payload)}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizeVerdict(value) {
  return String(value || '').toUpperCase();
}

function getVerdict(evidence) {
  return normalizeVerdict(
    firstDefined(
      evidence.verdict,
      evidence.body && evidence.body.verdict,
      evidence.body && evidence.body.evidence_status,
      evidence.body && evidence.body.evidence_verdict,
      evidence.body && evidence.body.result,
      evidence.body && evidence.body.status,
      evidence.status
    )
  );
}

function getEvidenceRefs(evidence, lineage) {
  const refs = [
    ...asArray(evidence.evidence_refs),
    ...asArray(evidence.body && evidence.body.evidence_refs),
    ...asArray(evidence.body && evidence.body.refs),
    ...asArray(evidence.body && evidence.body.refuting_evidence),
    ...asArray(evidence.body && evidence.body.tests_refuting),
  ];

  for (const item of lineage) {
    refs.push(...asArray(item.evidence_refs));
    refs.push(...asArray(item.body && item.body.evidence_refs));
  }

  const normalized = refs.filter((ref) => typeof ref === 'string' && ref);
  return normalized.length > 0 ? [...new Set(normalized)] : ['self-test:1'];
}

function loadEvidence(ledger, evidenceKey) {
  const evidence = evidenceKey
    ? ledger.find((entry) => entry && entry.key === evidenceKey)
    : [...ledger].reverse().find((entry) => entry && entry.type === 'evidence_verdict');

  if (!evidence) {
    throw new Error(
      evidenceKey
        ? `No evidence_verdict found for key ${evidenceKey}`
        : 'No evidence_verdict found in ledger'
    );
  }

  if (evidence.type && evidence.type !== 'evidence_verdict') {
    throw new Error(`${evidence.key || evidenceKey} is not an evidence_verdict CMB`);
  }

  return evidence;
}

function walkLineage(ledger, evidence) {
  const byKey = new Map(
    ledger.filter((entry) => entry && entry.key).map((entry) => [entry.key, entry])
  );
  const visited = new Set();
  const found = [];

  function visit(entry) {
    const parents = asArray(entry && entry.lineage && entry.lineage.parents);
    const ancestors = asArray(entry && entry.lineage && entry.lineage.ancestors);
    for (const key of [...parents, ...ancestors]) {
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const parent = byKey.get(key);
      if (parent) {
        found.push(parent);
        visit(parent);
      }
    }
  }

  visit(evidence);
  return found;
}

function findOperatorPrecedents(ledger, evidence) {
  const evidenceTags = new Set([
    ...asArray(evidence.tags),
    ...asArray(evidence.body && evidence.body.tags),
  ]);
  const decisionBasis = String(
    firstDefined(evidence.body && evidence.body.decision_basis, evidence.decision_basis, '')
  ).toLowerCase();

  return ledger.filter((entry) => {
    if (!entry || entry.type !== 'operator_precedent') {
      return false;
    }
    const tags = [
      ...asArray(entry.tags),
      ...asArray(entry.body && entry.body.tags),
    ];
    if (tags.some((tag) => evidenceTags.has(tag))) {
      return true;
    }
    const precedentText = [
      entry.body && entry.body.precedent,
      entry.body && entry.body.decision_basis,
      entry.body && entry.body.scope,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return Boolean(decisionBasis && precedentText && precedentText.includes(decisionBasis));
  });
}

function countCorroboratingVerdicts(evidence, lineage) {
  const verdict = getVerdict(evidence);
  return [evidence, ...lineage].filter(
    (entry) => entry && entry.type === 'evidence_verdict' && getVerdict(entry) === verdict
  ).length;
}

function computeTier1Decision(evidence, lineage) {
  const verdict = getVerdict(evidence);
  const corroboratingVerdicts = countCorroboratingVerdicts(evidence, lineage);
  const suppliedConfidence = Number(
    firstDefined(evidence.body && evidence.body.confidence, evidence.confidence)
  );

  if (verdict === 'VERIFIED_CRIT') {
    return {
      recommendation: 'PASS',
      authority_level: 3,
      confidence: Number.isFinite(suppliedConfidence)
        ? suppliedConfidence
        : corroboratingVerdicts > 1
          ? 0.88
          : 0.82,
    };
  }

  if (verdict === 'REFUTED_CRIT') {
    return {
      recommendation: 'PASS_WITH_REFUTED_REVIEW',
      authority_level: 2,
      confidence: Number.isFinite(suppliedConfidence) ? suppliedConfidence : 0.74,
    };
  }

  return {
    recommendation: 'NEEDS_OPERATOR',
    authority_level: 1,
    confidence: Number.isFinite(suppliedConfidence) ? suppliedConfidence : 0.55,
  };
}

function collectDecisionContext(evidence, lineage, confidence) {
  const contexts = [
    evidence.body && evidence.body.decision_context,
    evidence.body && evidence.body.context,
    evidence.body,
    evidence,
    ...lineage.map((entry) => entry.body && entry.body.decision_context),
    ...lineage.map((entry) => entry.body && entry.body.context),
    ...lineage.map((entry) => entry.body),
    ...lineage,
  ].filter(Boolean);

  const targetSystems = [];
  const targetFiles = [];
  let decisionType;
  const milestoneState = {
    scope_change: false,
    commercial_impact: false,
    legal_impact: false,
  };
  let destructive = false;

  for (const context of contexts) {
    decisionType = firstDefined(decisionType, context.decision_type);
    targetSystems.push(...asArray(context.target_systems));
    targetFiles.push(...asArray(context.target_files));
    if (context.milestone_state) {
      milestoneState.scope_change =
        milestoneState.scope_change || context.milestone_state.scope_change === true;
      milestoneState.commercial_impact =
        milestoneState.commercial_impact ||
        context.milestone_state.commercial_impact === true;
      milestoneState.legal_impact =
        milestoneState.legal_impact || context.milestone_state.legal_impact === true;
    }
    destructive = destructive || context.destructive === true;
  }

  return {
    decision_type: decisionType || 'doc_update',
    target_systems: [...new Set(targetSystems.filter(Boolean))],
    target_files: [...new Set(targetFiles.filter(Boolean))],
    milestone_state: milestoneState,
    confidence,
    destructive,
  };
}

function buildContextPack(evidence, lineage, precedents) {
  return {
    id: `ctx-${shortHash({
      evidence: evidence.key,
      lineage: lineage.map((entry) => entry.key),
      precedents: precedents.map((entry) => entry.key),
    })}`,
    evidence_key: evidence.key,
    lineage_keys: lineage.map((entry) => entry.key).filter(Boolean),
    operator_precedent_keys: precedents.map((entry) => entry.key).filter(Boolean),
  };
}

function precedentEvidenceRefs(precedents) {
  return precedents.flatMap((precedent) => [
    ...asArray(precedent.evidence_refs),
    ...asArray(precedent.body && precedent.body.evidence_refs),
  ]);
}

function formatRecommendation(baseRecommendation, precedents) {
  if (!precedents.length) {
    return baseRecommendation;
  }
  const cited = precedents
    .map((precedent) => {
      const scope = precedent.body && precedent.body.scope ? `:${precedent.body.scope}` : '';
      return `${precedent.key}${scope}`;
    })
    .join(',');
  return `${baseRecommendation} | cites operator_precedent ${cited}`;
}

function buildDecisionRecommendation({ evidence, ledger, now = new Date() }) {
  const lineage = walkLineage(ledger, evidence);
  const precedents = findOperatorPrecedents(ledger, evidence);
  const contextPack = buildContextPack(evidence, lineage, precedents);
  const tier1 = computeTier1Decision(evidence, lineage);
  const confidence = Math.max(0, Math.min(1, Number(tier1.confidence)));
  const decisionContext = collectDecisionContext(evidence, lineage, confidence);
  const gate = checkCarveOuts(decisionContext);
  const evidenceRefs = [
    ...new Set([...getEvidenceRefs(evidence, lineage), ...precedentEvidenceRefs(precedents)]),
  ];
  const recommendation = formatRecommendation(tier1.recommendation, precedents);
  const precedentKeys = precedents.map((entry) => entry.key).filter(Boolean);
  const lineageKeys = lineage.map((entry) => entry.key).filter(Boolean);
  const parentKeys = [...new Set([evidence.key, ...precedentKeys].filter(Boolean))];
  const ancestorKeys = [...new Set(lineageKeys)];

  const payloadForKey = {
    evidence: evidence.key,
    recommendation,
    confidence,
    gate,
    precedents: precedentKeys,
  };

  return {
    key: uniqueKey('cmb', payloadForKey),
    type: 'decision_recommendation',
    created_at: now.toISOString(),
    created_by: 'pseudo_operator',
    role: 'pseudo_operator',
    milestone_id: firstDefined(evidence.milestone_id, 'v3.0'),
    phase_id: firstDefined(evidence.phase_id, '109'),
    cat7: {
      focus: 'decision layer',
      issue: 'autonomous recommendation must respect operator carve-outs',
      intent: 'emit a gated decision recommendation from evidence verdicts',
      motivation: 'preserve high-confidence automation without bypassing real operator authority',
      commitment: 'route production, credential, scope, policy, destructive, and low-confidence cases to a real operator',
      perspective: 'pseudo-operator',
      mood: gate.real_operator_required ? 'restrained' : 'decisive',
    },
    body: {
      recommendation,
      authority_level: tier1.authority_level,
      confidence,
      real_operator_required: gate.real_operator_required,
      context_pack_id: contextPack.id,
      evidence_refs: evidenceRefs,
      carve_outs_triggered: gate.carve_outs_triggered,
    },
    lineage: {
      parents: parentKeys,
      ancestors: ancestorKeys,
    },
    authority_level: 'decision',
    evidence_refs: evidenceRefs,
    status: 'emitted',
  };
}

let cachedValidator = null;

function getValidator() {
  if (cachedValidator) {
    return cachedValidator;
  }

  const Ajv = requireDependency('ajv');
  const addFormats = requireDependency('ajv-formats');
  const addErrors = requireDependency('ajv-errors');
  const schemaPath = path.resolve(__dirname, '..', '..', 'schemas', 'cmb.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  addErrors(ajv);
  cachedValidator = ajv.compile(schema);
  return cachedValidator;
}

function validateCmb(cmb) {
  const validate = getValidator();
  if (!validate(cmb)) {
    const message = validate.errors
      .map((error) => `${error.instancePath || '/'} ${error.message}`)
      .join('; ');
    throw new Error(`decision_recommendation failed CMB schema validation: ${message}`);
  }
}

function syntheticEvidence({ key, verdict, confidence, targetSystems = [], targetFiles = [] }) {
  return {
    key,
    type: 'evidence_verdict',
    created_at: new Date().toISOString(),
    created_by: 'evidence_validator',
    role: 'evidence_validator',
    milestone_id: 'v3.0',
    phase_id: '109',
    cat7: {
      focus: 'self-test',
      issue: 'synthetic evidence verdict',
      intent: 'exercise pseudo operator recommendation path',
      motivation: 'prove deterministic decision behavior',
      commitment: 'emit schema-conformant test evidence',
      perspective: 'verifier',
      mood: 'neutral',
    },
    body: {
      evidence_status: verdict,
      tier_used: 1,
      decision_basis: `self-test ${verdict}`,
      confidence,
      decision_context: {
        decision_type: 'doc_update',
        target_systems: targetSystems,
        target_files: targetFiles,
        milestone_state: {
          scope_change: false,
          commercial_impact: false,
          legal_impact: false,
        },
        destructive: false,
      },
      evidence_refs: ['self-test:1'],
    },
    lineage: {
      parents: [],
      ancestors: [],
    },
    authority_level: 'claim_with_authority',
    evidence_refs: ['self-test:1'],
    status: 'emitted',
  };
}

function runSelfTest(kind, ledgerPath) {
  const scenarios = {
    verified: syntheticEvidence({
      key: `cmb-self-test-verified-${Date.now()}`,
      verdict: 'VERIFIED_CRIT',
      confidence: 0.86,
    }),
    refuted: syntheticEvidence({
      key: `cmb-self-test-refuted-${Date.now()}`,
      verdict: 'REFUTED_CRIT',
      confidence: 0.76,
    }),
    'fixture-d': syntheticEvidence({
      key: `cmb-self-test-fixture-d-${Date.now()}`,
      verdict: 'VERIFIED_CRIT',
      confidence: 0.95,
      targetSystems: ['sap'],
    }),
    'low-confidence': syntheticEvidence({
      key: `cmb-self-test-low-confidence-${Date.now()}`,
      verdict: 'VERIFIED_CRIT',
      confidence: 0.5,
    }),
  };

  const evidence = scenarios[kind];
  if (!evidence) {
    throw new Error(`Unknown self-test scenario: ${kind}`);
  }

  const ledger = readJsonl(ledgerPath);
  const recommendation = buildDecisionRecommendation({
    evidence,
    ledger: [...ledger, evidence],
  });
  validateCmb(recommendation);
  appendJsonl(ledgerPath, recommendation);

  if (
    kind === 'verified' &&
    !(
      recommendation.body.authority_level === 3 &&
      recommendation.body.confidence >= 0.8 &&
      recommendation.body.real_operator_required === false &&
      recommendation.body.carve_outs_triggered.length === 0
    )
  ) {
    throw new Error('verified path self-test failed');
  }

  if (
    kind === 'refuted' &&
    recommendation.body.recommendation !== 'PASS_WITH_REFUTED_REVIEW'
  ) {
    throw new Error('refuted path self-test failed');
  }

  if (
    kind === 'fixture-d' &&
    !(
      recommendation.body.confidence >= 0.95 &&
      recommendation.body.real_operator_required === true &&
      recommendation.body.carve_outs_triggered.includes('production_mutation')
    )
  ) {
    throw new Error('fixture D self-test failed');
  }

  if (
    kind === 'low-confidence' &&
    !(
      recommendation.body.real_operator_required === true &&
      recommendation.body.carve_outs_triggered.includes('low_confidence')
    )
  ) {
    throw new Error('low confidence self-test failed');
  }

  process.stdout.write(`${JSON.stringify(recommendation, null, 2)}\n`);
  return recommendation;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || argv.length === 0) {
    printHelp();
    return 0;
  }

  if (args.selfTest) {
    runSelfTest(args.selfTest, args.ledger);
    return 0;
  }

  const ledger = readJsonl(args.ledger);
  const evidence = loadEvidence(ledger, args.evidenceKey);
  const recommendation = buildDecisionRecommendation({ evidence, ledger });
  validateCmb(recommendation);
  appendJsonl(args.ledger, recommendation);
  process.stdout.write(`${JSON.stringify(recommendation, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildDecisionRecommendation,
  checkCarveOuts,
  collectDecisionContext,
  computeTier1Decision,
  requireDependency,
};
