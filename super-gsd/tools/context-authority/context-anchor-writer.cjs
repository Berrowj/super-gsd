#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..', '..');
const LEDGER_PATH = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const SCHEMA_PATH = path.join(REPO_ROOT, 'super-gsd', 'schemas', 'cmb.schema.json');
const CMB_VALIDATE_PATH = path.join(REPO_ROOT, 'super-gsd', 'tools', 'mesh-memory', 'cmb-validate.cjs');
const DEFAULT_PHASE_ID = '112';

function usage() {
  return [
    'Usage:',
    '  node context-anchor-writer.cjs [--help]',
    '  node context-anchor-writer.cjs --source PATH --milestone vX.Y [--phase NN]',
    '  node context-anchor-writer.cjs --check-staleness <anchor-key>',
    '  node context-anchor-writer.cjs --self-test',
    '  node context-anchor-writer.cjs --self-test-stale'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') args.help = true;
    else if (token === '--self-test') args.selfTest = true;
    else if (token === '--self-test-stale') args.selfTestStale = true;
    else if (token === '--source') args.source = argv[++i];
    else if (token === '--milestone') args.milestone = argv[++i];
    else if (token === '--phase') args.phase = argv[++i];
    else if (token === '--check-staleness') args.checkStaleness = argv[++i];
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function requireDependency(name) {
  const candidates = [
    path.join(REPO_ROOT, 'super-gsd', 'tools', 'plan-schema', 'node_modules', name),
    path.join(TOOL_DIR, 'node_modules', name),
    path.join(REPO_ROOT, 'node_modules', name),
    name
  ];

  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }

  throw new Error(`Unable to load dependency "${name}". Tried:\n${failures.join('\n')}`);
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, '/');
}

function resolveFromRepo(filePath) {
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(REPO_ROOT, filePath);
}

function toRepoRelative(filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(REPO_ROOT, resolved);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    return normalizeSlashes(relative);
  }
  return normalizeSlashes(resolved);
}

function parseYamlMaybe(sourceText) {
  try {
    const yaml = requireDependency('js-yaml');
    return yaml.load(sourceText) || {};
  } catch (_error) {
    return {};
  }
}

function countKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 0;
}

function projectionSummary(canonicalSourcePath, sourceText) {
  const basename = path.basename(canonicalSourcePath);
  const parsed = parseYamlMaybe(sourceText);

  if (basename === 'MILESTONE-CONTEXT.yaml') {
    const milestone = parsed.milestone_id || 'milestone';
    const title = parsed.title || basename;
    return `Milestone context capsule for ${milestone}: ${title}.`;
  }
  if (basename === 'PERSONA-MATRIX.yaml') {
    return `Persona matrix covering ${countKeys(parsed.personas)} personas and their retrieval biases.`;
  }
  if (basename === 'DOMAIN-ONTOLOGY.yaml') {
    return `Domain ontology covering ${countKeys(parsed.entities)} entities and their invariants.`;
  }
  if (basename === 'LEXICON.yaml') {
    return `Lexicon defining ${countKeys(parsed.terms)} overloaded or milestone-critical terms.`;
  }
  if (basename === 'SOURCE-OF-TRUTH.yaml') {
    return `Source-of-truth registry covering ${countKeys(parsed.data_classes)} data classes.`;
  }
  if (basename === 'NON-GOALS.yaml') {
    const count = Array.isArray(parsed.non_goals) ? parsed.non_goals.length : 0;
    return `Non-goals capsule covering ${count} explicit scope exclusions.`;
  }

  return `Context authority projection from ${basename}.`;
}

function buildContextAnchor(options) {
  if (!options.source) throw new Error('--source is required');
  if (!options.milestone) throw new Error('--milestone is required');

  const absoluteSourcePath = resolveFromRepo(options.source);
  const sourceText = fs.readFileSync(absoluteSourcePath, 'utf8');
  const canonicalSourcePath = toRepoRelative(absoluteSourcePath);
  const canonicalSourceHash = sha256(sourceText);
  const summary = projectionSummary(canonicalSourcePath, sourceText);
  const phaseId = String(options.phase || DEFAULT_PHASE_ID);
  const canonicalPayload = JSON.stringify({
    type: 'context_anchor',
    milestone_id: options.milestone,
    phase_id: phaseId,
    canonical_source_path: canonicalSourcePath,
    canonical_source_hash: canonicalSourceHash,
    projection_summary: summary
  });

  return {
    key: `cmb-${sha256(canonicalPayload)}`,
    type: 'context_anchor',
    milestone_id: options.milestone,
    phase_id: phaseId,
    created_at: new Date().toISOString(),
    created_by: 'context_authority',
    role: 'context_authority',
    authority_level: 'projection',
    cat7: {
      focus: path.basename(canonicalSourcePath),
      issue: 'projection',
      intent: 'context anchor',
      motivation: 'preserve milestone context authority in mesh memory',
      commitment: 'project canonical capsule content without changing source truth',
      perspective: 'context authority',
      mood: 'neutral'
    },
    body: {
      canonical_source_path: canonicalSourcePath,
      canonical_source_hash: canonicalSourceHash,
      projection_summary: summary
    },
    lineage: {
      parents: [],
      ancestors: []
    },
    evidence_refs: [canonicalSourcePath],
    status: 'emitted'
  };
}

function makeAjv() {
  const rawSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const AjvModule = rawSchema.$schema && rawSchema.$schema.includes('2020')
    ? requireDependency('ajv/dist/2020')
    : requireDependency('ajv');
  const AjvBase = AjvModule.default || AjvModule;
  const addFormatsModule = requireDependency('ajv-formats');
  const addErrorsModule = requireDependency('ajv-errors');
  const addFormats = addFormatsModule.default || addFormatsModule;
  const addErrors = addErrorsModule.default || addErrorsModule;
  const ajv = new AjvBase({ allErrors: true, strict: false });
  addFormats(ajv);
  addErrors(ajv);
  return { ajv, rawSchema };
}

function validateAgainstSchema(cmb) {
  const { ajv, rawSchema } = makeAjv();
  const validate = ajv.compile(rawSchema);
  if (!validate(cmb)) {
    const errors = (validate.errors || []).map((error) => {
      const target = error.instancePath || '/';
      return `${target} ${error.message}`;
    });
    throw new Error(`context_anchor CMB failed schema validation:\n${errors.join('\n')}`);
  }
}

function validateWithCmbValidator(cmb) {
  if (!fs.existsSync(CMB_VALIDATE_PATH)) {
    throw new Error(`Missing CMB validator: ${toRepoRelative(CMB_VALIDATE_PATH)}`);
  }
  const validator = require(CMB_VALIDATE_PATH);
  if (!validator || typeof validator.validateCmb !== 'function') {
    throw new Error('cmb-validate.cjs does not export validateCmb');
  }
  const result = validator.validateCmb(cmb);
  if (!result.valid) {
    const errors = (result.errors || []).map((error) => (
      validator.formatError ? validator.formatError('context_anchor', error) : `${error.instancePath || '/'} ${error.message || 'schema validation failed'}`
    ));
    throw new Error(`context_anchor CMB failed cmb-validate:\n${errors.join('\n')}`);
  }
}

function validateCmb(cmb) {
  validateAgainstSchema(cmb);
  validateWithCmbValidator(cmb);
}

function appendCmb(cmb) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(cmb)}\n`, 'utf8');
}

function emitAnchor(options) {
  const cmb = buildContextAnchor(options);
  validateCmb(cmb);
  appendCmb(cmb);
  return cmb;
}

function loadLedgerCmbs() {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  return fs.readFileSync(LEDGER_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean);
}

function checkStaleness(anchorKey) {
  if (!anchorKey) throw new Error('--check-staleness requires an anchor key');
  const anchors = loadLedgerCmbs().filter((cmb) => cmb.key === anchorKey);
  if (anchors.length === 0) throw new Error(`No anchor found for key: ${anchorKey}`);
  const anchor = anchors[anchors.length - 1];
  const sourcePath = anchor.body && anchor.body.canonical_source_path;
  const originalHash = anchor.body && anchor.body.canonical_source_hash;
  if (!sourcePath || !originalHash) throw new Error(`Anchor ${anchorKey} is missing canonical source metadata`);

  const absoluteSourcePath = resolveFromRepo(sourcePath);
  const currentHash = sha256(fs.readFileSync(absoluteSourcePath, 'utf8'));
  return currentHash === originalHash ? 'fresh' : 'stale';
}

function runSelfTest(expectStale) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-context-authority-'));
  const sourcePath = path.join(tempDir, 'fixture.yaml');
  fs.writeFileSync(sourcePath, 'name: context-authority-fixture\npurpose: self-test\n', 'utf8');
  const anchor = emitAnchor({ source: sourcePath, milestone: 'self-test', phase: '112' });

  if (expectStale) {
    fs.appendFileSync(sourcePath, 'mutated: true\n', 'utf8');
    const status = checkStaleness(anchor.key);
    console.log(status);
    if (status !== 'stale') throw new Error(`Expected stale, got ${status}`);
    return;
  }

  console.log(anchor.key);
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    if (args.selfTest) {
      runSelfTest(false);
      return;
    }
    if (args.selfTestStale) {
      runSelfTest(true);
      return;
    }
    if (args.checkStaleness) {
      console.log(checkStaleness(args.checkStaleness));
      return;
    }
    if (args.source || args.milestone) {
      const anchor = emitAnchor({ source: args.source, milestone: args.milestone, phase: args.phase });
      console.log(anchor.key);
      return;
    }

    console.log(usage());
  } catch (error) {
    console.error(`[context-anchor-writer] ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildContextAnchor,
  checkStaleness,
  emitAnchor,
  validateCmb,
  requireDependency
};
