#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadLedger, findCmb } = require('./lineage.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_LEDGER = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const SCHEMA_PATH = path.join(REPO_ROOT, 'super-gsd', 'schemas', 'cmb.schema.json');
const STATUSES = new Set(['UNVERIFIED_CRIT', 'STALE_CRIT', 'REFUTED_CRIT', 'VERIFIED_CRIT', 'GUARDED_CRIT']);

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
  throw new Error(`Unable to load dependency ${name}. Tried: ${errors.join('; ')}`);
}

function resolveInputPath(inputPath) {
  if (!inputPath) return null;
  return path.isAbsolute(inputPath) ? path.normalize(inputPath) : path.resolve(REPO_ROOT, inputPath);
}

function ensureLedgerDir(ledgerPath) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
}

function appendCmb(ledgerPath, cmb) {
  ensureLedgerDir(ledgerPath);
  fs.appendFileSync(ledgerPath, `${JSON.stringify(cmb)}\n`, 'utf8');
}

function keyFor(payload) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return `cmb-${hash}`;
}

function defaultCat7(type) {
  if (type === 'evidence_verdict') {
    return {
      focus: 'evidence validation',
      issue: 'review finding status',
      intent: 'adjudicate evidence',
      motivation: 'separate claim from authority',
      commitment: 'schema-conformant verdict',
      perspective: 'evidence-validator',
      mood: 'calm',
    };
  }
  return {
    focus: 'mesh memory',
    issue: type,
    intent: 'emit context memory block',
    motivation: 'preserve auditable evidence',
    commitment: 'schema-conformant record',
    perspective: roleFromType(type),
    mood: 'calm',
  };
}

function roleFromType(type) {
  if (type === 'evidence_verdict') return 'evidence-validator';
  return 'mesh-memory';
}

function makeCmb(type, createdBy, role, parentKeys, body, extra = {}) {
  const createdAt = extra.created_at || new Date().toISOString();
  const parents = Array.isArray(parentKeys) ? parentKeys : [];
  const draft = {
    type,
    created_at: createdAt,
    created_by: createdBy,
    role,
    milestone_id: extra.milestone_id || 'v3.0',
    phase_id: extra.phase_id === undefined ? '108' : extra.phase_id,
    cat7: extra.cat7 || defaultCat7(type),
    body,
    lineage: {
      parents,
      ancestors: extra.ancestors || [],
    },
    authority_level: extra.authority_level || 'claim_with_authority',
    evidence_refs: extra.evidence_refs || [],
    status: extra.status || 'emitted',
  };
  return { key: keyFor(draft), ...draft };
}

function createReviewFinding(body, parentKeys = []) {
  return makeCmb('review_finding', 'p108_self_test', 'reviewer', parentKeys, {
    claim: body.claim || 'self-test review finding',
    severity: body.severity || 'medium',
    file_path: body.file_path,
    line_start: body.line_start,
    line_end: body.line_end,
    quoted_excerpt: body.quoted_excerpt,
  });
}

function pathParts(resolvedPath) {
  return resolvedPath.split(path.sep).map((part) => part.toLowerCase());
}

function isWithin(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function isWhitelistedFixture(resolvedPath) {
  const whitelisted = [
    path.join(REPO_ROOT, 'super-gsd', 'tools', 'plan-schema', 'fixtures'),
    path.join(REPO_ROOT, 'super-gsd', 'tools', 'mesh-memory', 'fixtures'),
  ];
  return whitelisted.some((allowed) => isWithin(resolvedPath, allowed));
}

function isFixtureLikePath(resolvedPath) {
  if (isWhitelistedFixture(resolvedPath)) return false;
  const parts = pathParts(resolvedPath);
  return parts.some((part) => part === 'fixtures' || part === 'mock' || part === '__mocks__');
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function sourceSlice(content, lineStart, lineEnd) {
  const lines = content.split(/\r?\n/);
  const start = Math.max(1, Number(lineStart || 1));
  const end = Math.max(start, Number(lineEnd || lineStart || lines.length));
  return lines.slice(start - 1, end).join('\n');
}

function hasEchoParent(ledger, finding) {
  const claim = String(finding.body && finding.body.claim || '').toLowerCase();
  if (!claim) return false;
  return (finding.lineage && Array.isArray(finding.lineage.parents) ? finding.lineage.parents : [])
    .map((key) => findCmb(ledger, key))
    .filter((parent) => parent && parent.type === 'review_finding')
    .some((parent) => {
      const parentClaim = String(parent.body && parent.body.claim || '').toLowerCase();
      return parentClaim && (parentClaim.includes(claim) || claim.includes(parentClaim));
    });
}

function tier0(finding) {
  const body = finding.body || {};
  if (!body.file_path) {
    return {
      evidence_status: 'UNVERIFIED_CRIT',
      tier_used: 0,
      decision_basis: 'file_path missing',
      refuting_evidence: ['missing_file_path'],
    };
  }

  const resolved = resolveInputPath(body.file_path);
  if (isFixtureLikePath(resolved)) {
    return {
      evidence_status: 'UNVERIFIED_CRIT',
      tier_used: 0,
      decision_basis: 'fixture_path_in_real_data_check',
      refuting_evidence: ['fixture_path_in_real_data_check'],
    };
  }

  if (!fs.existsSync(resolved)) {
    return {
      evidence_status: 'STALE_CRIT',
      tier_used: 0,
      decision_basis: `file does not exist: ${body.file_path}`,
      refuting_evidence: [`missing_file:${body.file_path}`],
    };
  }

  const content = fs.readFileSync(resolved, 'utf8');
  const lines = content.split(/\r?\n/);
  const hasRange = body.line_start !== undefined || body.line_end !== undefined;
  if (hasRange) {
    const start = Number(body.line_start);
    const end = Number(body.line_end || body.line_start);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lines.length) {
      return {
        evidence_status: 'STALE_CRIT',
        tier_used: 0,
        decision_basis: 'line range exceeds file bounds',
        refuting_evidence: [`line_count:${lines.length}`],
      };
    }
  }

  if (body.quoted_excerpt !== undefined && body.quoted_excerpt !== null && body.quoted_excerpt !== '') {
    const actual = hasRange ? sourceSlice(content, body.line_start, body.line_end) : content;
    if (normalizeText(actual) === normalizeText(body.quoted_excerpt) || normalizeText(actual).includes(normalizeText(body.quoted_excerpt))) {
      return {
        evidence_status: 'VERIFIED_CRIT',
        tier_used: 0,
        decision_basis: 'quoted_excerpt matches source file',
        refuting_evidence: [],
      };
    }
    return {
      evidence_status: 'REFUTED_CRIT',
      tier_used: 0,
      decision_basis: 'quoted_excerpt does not match source file',
      refuting_evidence: [`actual:${normalizeText(actual).slice(0, 200)}`],
    };
  }

  return {
    evidence_status: 'GUARDED_CRIT',
    tier_used: 0,
    decision_basis: 'file exists; content was not asserted',
    refuting_evidence: [],
  };
}

function evaluateFinding(ledger, finding) {
  let verdict = tier0(finding);
  if (verdict.evidence_status === 'VERIFIED_CRIT' && hasEchoParent(ledger, finding)) {
    verdict = {
      ...verdict,
      evidence_status: 'GUARDED_CRIT',
      tier_used: 1,
      decision_basis: `${verdict.decision_basis}; potential echo from parent review_finding`,
    };
  }
  if (!STATUSES.has(verdict.evidence_status)) {
    throw new Error(`invalid evidence_status: ${verdict.evidence_status}`);
  }
  return verdict;
}

function buildEvidenceVerdict(finding, evaluation) {
  return makeCmb(
    'evidence_verdict',
    'evidence_validator',
    'evidence_validator',
    [finding.key],
    {
      evidence_status: evaluation.evidence_status,
      tier_used: evaluation.tier_used,
      decision_basis: evaluation.decision_basis,
    },
    { authority_level: 'claim_with_authority', evidence_refs: [] },
  );
}

function validateCmbAgainstSchema(cmb) {
  const Ajv = requireDependency('ajv');
  const addFormats = requireDependency('ajv-formats');
  const addErrors = requireDependency('ajv-errors');
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  addErrors(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(cmb);
  return { valid, errors: validate.errors || [] };
}

function validateFindingKey(ledgerPath, findingKey) {
  const ledger = loadLedger(ledgerPath);
  const finding = findCmb(ledger, findingKey);
  if (!finding) throw new Error(`review_finding not found: ${findingKey}`);
  if (finding.type !== 'review_finding') throw new Error(`CMB is not a review_finding: ${findingKey}`);
  const evaluation = evaluateFinding(ledger, finding);
  const verdict = buildEvidenceVerdict(finding, evaluation);
  appendCmb(ledgerPath, verdict);
  return verdict;
}

function parseArgs(argv) {
  const args = { ledger: DEFAULT_LEDGER };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') args.help = true;
    else if (arg === '--finding-key') args.findingKey = argv[++i];
    else if (arg === '--ledger') args.ledger = path.isAbsolute(argv[i + 1]) ? argv[++i] : path.resolve(process.cwd(), argv[++i]);
    else if (arg === '--self-test-verified') args.selfTestVerified = true;
    else if (arg === '--self-test-refuted') args.selfTestRefuted = true;
    else if (arg === '--self-test-fixture-guard') args.selfTestFixtureGuard = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write('Usage: node evidence-validator.cjs [--help] [--finding-key <cmb-key>] [--ledger PATH] [--self-test-verified|--self-test-refuted|--self-test-fixture-guard]\n');
}

function firstUsefulSchemaLine() {
  const content = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes('"type"') || line.includes('"properties"'));
  const lineIndex = index >= 0 ? index : 0;
  return { number: lineIndex + 1, text: lines[lineIndex] };
}

function appendSelfTestFinding(ledgerPath, finding) {
  appendCmb(ledgerPath, finding);
  return validateFindingKey(ledgerPath, finding.key);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTestVerified(ledgerPath) {
  const line = firstUsefulSchemaLine();
  const finding = createReviewFinding({
    claim: 'cmb schema has a JSON type declaration',
    file_path: 'super-gsd/schemas/cmb.schema.json',
    line_start: line.number,
    line_end: line.number,
    quoted_excerpt: line.text,
  });
  const verdict = appendSelfTestFinding(ledgerPath, finding);
  assert(verdict.body.evidence_status === 'VERIFIED_CRIT', `expected VERIFIED_CRIT, got ${verdict.body.evidence_status}`);
  const schemaResult = validateCmbAgainstSchema(verdict);
  assert(schemaResult.valid, `emitted CMB failed schema: ${JSON.stringify(schemaResult.errors)}`);
  process.stderr.write('[evidence-validator] self-test verified passed\n');
}

function runSelfTestRefuted(ledgerPath) {
  const line = firstUsefulSchemaLine();
  const finding = createReviewFinding({
    claim: 'cmb schema has a deliberately wrong line',
    file_path: 'super-gsd/schemas/cmb.schema.json',
    line_start: line.number,
    line_end: line.number,
    quoted_excerpt: '__not_the_schema_line__',
  });
  const verdict = appendSelfTestFinding(ledgerPath, finding);
  assert(verdict.body.evidence_status === 'REFUTED_CRIT', `expected REFUTED_CRIT, got ${verdict.body.evidence_status}`);
  process.stderr.write('[evidence-validator] self-test refuted passed\n');
}

function runSelfTestFixtureGuard(ledgerPath) {
  const finding = createReviewFinding({
    claim: 'mock path must be rejected before file existence checks',
    file_path: path.join(os.tmpdir(), '__mocks__', 'p108-fake.js'),
    quoted_excerpt: 'irrelevant',
  });
  const verdict = appendSelfTestFinding(ledgerPath, finding);
  assert(verdict.body.evidence_status === 'UNVERIFIED_CRIT', `expected UNVERIFIED_CRIT, got ${verdict.body.evidence_status}`);
  assert(verdict.body.decision_basis === 'fixture_path_in_real_data_check', 'fixture guard reason missing');
  process.stderr.write('[evidence-validator] self-test fixture guard passed\n');
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      return;
    }
    if (args.selfTestVerified) return runSelfTestVerified(args.ledger);
    if (args.selfTestRefuted) return runSelfTestRefuted(args.ledger);
    if (args.selfTestFixtureGuard) return runSelfTestFixtureGuard(args.ledger);
    if (!args.findingKey) throw new Error('--finding-key is required unless a self-test flag is used');
    const verdict = validateFindingKey(args.ledger, args.findingKey);
    process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`[evidence-validator] ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createReviewFinding,
  evaluateFinding,
  buildEvidenceVerdict,
  validateFindingKey,
  validateCmbAgainstSchema,
};
