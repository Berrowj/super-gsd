#!/usr/bin/env node
'use strict';

const PRODUCTION_SYSTEMS = new Set([
  'sap',
  'mongo',
  'qdrant',
  'elasticsearch',
  'customer_db',
  'production',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function matchesProductionFile(file) {
  const normalized = normalizePath(file);
  return (
    /^prod[^/]*/.test(normalized) ||
    /(^|\/)prod[^/]*(\/|$)/.test(normalized) ||
    normalized.startsWith('production/') ||
    /(^|\/)production\//.test(normalized)
  );
}

function matchesCredentialFile(file) {
  const normalized = normalizePath(file);
  return (
    /\.env$/.test(normalized) ||
    /(^|\/)(secrets|credentials)(\/|$)/.test(normalized) ||
    normalized.includes('token') ||
    normalized.includes('key') ||
    /\.pem$/.test(normalized) ||
    /\.crt$/.test(normalized)
  );
}

function checkCarveOuts(context = {}) {
  const targetSystems = asArray(context.target_systems).map((system) =>
    String(system || '').toLowerCase()
  );
  const targetFiles = asArray(context.target_files);
  const milestoneState = context.milestone_state || {};
  const decisionType = String(context.decision_type || '').toLowerCase();
  const confidence = Number(context.confidence);
  const carveOuts = [];

  if (
    targetSystems.some((system) => PRODUCTION_SYSTEMS.has(system)) ||
    targetFiles.some(matchesProductionFile)
  ) {
    carveOuts.push('production_mutation');
  }

  if (
    targetFiles.some(matchesCredentialFile) ||
    decisionType === 'auth_change' ||
    decisionType === 'security_change'
  ) {
    carveOuts.push('credential_or_security');
  }

  if (milestoneState.scope_change === true) {
    carveOuts.push('milestone_scope_change');
  }

  if (
    milestoneState.commercial_impact === true ||
    milestoneState.legal_impact === true
  ) {
    carveOuts.push('commercial_legal_policy');
  }

  if (context.destructive === true) {
    carveOuts.push('destructive_or_irreversible');
  }

  if (Number.isFinite(confidence) && confidence < 0.7) {
    carveOuts.push('low_confidence');
  }

  const realOperatorRequired = carveOuts.length > 0;
  return {
    allow_autonomous: !realOperatorRequired,
    real_operator_required: realOperatorRequired,
    carve_outs_triggered: carveOuts,
  };
}

function printHelp() {
  process.stdout.write(`Usage: node escalation-gate.cjs [--help] [--check <json>] [--self-test-production-mutation] [--self-test-credential] [--self-test-pass-through]

Pure carve-out checker for pseudo-operator decisions.

Options:
  --check <json>                         Parse a decision context JSON string and print gate result.
  --self-test-production-mutation        Assert production_mutation requires a real operator.
  --self-test-credential                 Assert credential_or_security triggers for secret-like paths.
  --self-test-pass-through               Assert benign context allows autonomous handling.
  --help                                 Show this help.
`);
}

function assertSelfTest(name, condition) {
  if (!condition) {
    throw new Error(`[escalation-gate] ${name} failed`);
  }
}

function baseContext(overrides = {}) {
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

function runSelfTestProductionMutation() {
  const result = checkCarveOuts(
    baseContext({ target_systems: ['mongo'], confidence: 0.95 })
  );
  assertSelfTest(
    'production mutation',
    result.real_operator_required === true &&
      result.allow_autonomous === false &&
      result.carve_outs_triggered.includes('production_mutation')
  );
}

function runSelfTestCredential() {
  const result = checkCarveOuts(
    baseContext({ target_files: ['config/secrets.env'] })
  );
  assertSelfTest(
    'credential',
    result.real_operator_required === true &&
      result.carve_outs_triggered.includes('credential_or_security')
  );
}

function runSelfTestPassThrough() {
  const result = checkCarveOuts(baseContext());
  assertSelfTest(
    'pass-through',
    result.allow_autonomous === true &&
      result.real_operator_required === false &&
      result.carve_outs_triggered.length === 0
  );
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.length === 0) {
    printHelp();
    return 0;
  }

  const checkIndex = argv.indexOf('--check');
  if (checkIndex !== -1) {
    const raw = argv[checkIndex + 1];
    if (!raw) {
      throw new Error('--check requires a JSON string');
    }
    const parsed = JSON.parse(raw);
    process.stdout.write(`${JSON.stringify(checkCarveOuts(parsed), null, 2)}\n`);
    return 0;
  }

  if (argv.includes('--self-test-production-mutation')) {
    runSelfTestProductionMutation();
    return 0;
  }

  if (argv.includes('--self-test-credential')) {
    runSelfTestCredential();
    return 0;
  }

  if (argv.includes('--self-test-pass-through')) {
    runSelfTestPassThrough();
    return 0;
  }

  throw new Error(`Unknown arguments: ${argv.join(' ')}`);
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  checkCarveOuts,
};
