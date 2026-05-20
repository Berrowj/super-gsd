#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function requireDependency(name) {
  const candidates = [
    path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
    path.resolve(__dirname, 'node_modules', name),
    name,
  ];

  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }

  throw new Error(`Unable to require ${name}. Tried:\n${failures.join('\n')}`);
}

const addFormats = requireDependency('ajv-formats');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CMB_LEDGER_PATH = path.resolve(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const MILESTONE_ID = 'v3.0';

function usage() {
  return [
    'Usage:',
    '  node native-review-runner.cjs [--help] [--phase NN] [--diff-path PATH]',
    '                                [--executor-receipt <cmb-key>] [--self-test]',
    '',
    'Runs or simulates the Codex native review lane and emits review_finding CMBs.',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    phase: '110',
    diffPath: undefined,
    executorReceipt: 'cmb-fixture-execution-receipt',
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--phase') {
      args.phase = argv[++index];
    } else if (arg === '--diff-path') {
      args.diffPath = argv[++index];
    } else if (arg === '--executor-receipt') {
      args.executorReceipt = argv[++index];
    } else if (arg === '--self-test') {
      args.selfTest = true;
    } else if (arg === '--help') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.phase) throw new Error('--phase requires a value');
  if (!args.executorReceipt) throw new Error('--executor-receipt requires a value');
  return args;
}

function loadCmbSchema() {
  const schemaPath = path.resolve(REPO_ROOT, 'super-gsd', 'schemas', 'cmb.schema.json');
  return {
    schemaPath,
    schema: JSON.parse(fs.readFileSync(schemaPath, 'utf8')),
  };
}

function createAjvForSchema(schema) {
  const schemaDialect = typeof schema.$schema === 'string' ? schema.$schema : '';
  const AjvCtor = schemaDialect.includes('2020')
    ? requireDependency('ajv/dist/2020')
    : requireDependency('ajv');
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function buildValidator() {
  const { schemaPath, schema } = loadCmbSchema();
  const ajv = createAjvForSchema(schema);
  const validate = ajv.compile(schema);
  return {
    schemaPath,
    validateCmb(cmb) {
      if (!validate(cmb)) {
        const details = ajv.errorsText(validate.errors, { separator: '\n' });
        throw new Error(`CMB failed schema validation against ${schemaPath}:\n${details}`);
      }
    },
  };
}

function currentCommit() {
  try {
    return childProcess.execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return '0000000';
  }
}

function safeCommit(value) {
  if (typeof value === 'string' && /^[a-fA-F0-9]{7,40}$/.test(value)) {
    return value;
  }
  return currentCommit();
}

function uniqueCmbKey(finding, index) {
  const hash = crypto
    .createHash('sha256')
    .update(`${Date.now()}:${process.pid}:${index}:${JSON.stringify(finding)}`)
    .digest('hex')
    .slice(0, 12);
  return `cmb-codex-native-review-${hash}`;
}

function normalizeSeverity(severity) {
  if (['CRIT', 'WARN', 'INFO'].includes(severity)) return severity;
  return 'WARN';
}

function findingToCmb(finding, options, index) {
  const createdAt = new Date().toISOString();
  const severity = normalizeSeverity(finding.severity);
  const claim = finding.claim || 'Codex native review finding';
  const filePath = finding.file_path || finding.filePath || 'unknown';
  const lineStart = Number.isInteger(finding.line_start) ? finding.line_start : Number(finding.lineStart || 1);
  const lineEnd = Number.isInteger(finding.line_end) ? finding.line_end : Number(finding.lineEnd || lineStart);

  return {
    key: uniqueCmbKey(finding, index),
    type: 'review_finding',
    created_at: createdAt,
    created_by: 'codex-review-native',
    role: 'reviewer',
    milestone_id: MILESTONE_ID,
    phase_id: String(options.phase),
    cat7: {
      focus: finding.focus || 'codex-pro-native-review',
      issue: finding.issue || claim,
      intent: finding.intent || 'Preserve SGSD invariants before apply',
      motivation: finding.motivation || 'Native Codex review must surface bounded, evidence-backed findings',
      commitment: finding.commitment || 'Emit schema-valid review_finding CMBs',
      perspective: 'native-codex-reviewer',
      mood: finding.mood || 'critical',
    },
    body: {
      severity,
      claim,
      current_commit: safeCommit(finding.current_commit),
      file_path: filePath,
      line_start: Number.isFinite(lineStart) ? lineStart : 1,
      line_end: Number.isFinite(lineEnd) ? lineEnd : 1,
      quoted_excerpt: finding.quoted_excerpt || '',
      violated_invariant: finding.violated_invariant || 'DLB-09.1 native review evidence',
      confidence: typeof finding.confidence === 'number' ? finding.confidence : 0.8,
    },
    lineage: {
      parents: [options.executorReceipt],
      ancestors: [],
    },
    authority_level: 'claim',
    evidence_refs: [],
    status: 'emitted',
  };
}

function appendCmbs(cmbs, validator = buildValidator()) {
  fs.mkdirSync(path.dirname(CMB_LEDGER_PATH), { recursive: true });
  for (const cmb of cmbs) {
    validator.validateCmb(cmb);
  }
  fs.appendFileSync(CMB_LEDGER_PATH, `${cmbs.map((cmb) => JSON.stringify(cmb)).join('\n')}\n`, 'utf8');
  return cmbs;
}

function selfTestFindings() {
  return [
    {
      severity: 'WARN',
      claim: 'Self-test finding confirms native review CMB emission path.',
      file_path: 'super-gsd/tools/codex-pro/native-review-runner.cjs',
      line_start: 1,
      line_end: 1,
      quoted_excerpt: '#!/usr/bin/env node',
      violated_invariant: 'CMB review findings must be schema-valid before ledger append',
      confidence: 0.91,
      focus: 'self-test',
      issue: 'schema-validation-path',
      mood: 'focused',
    },
    {
      severity: 'INFO',
      claim: 'Self-test finding confirms lineage parent is preserved.',
      file_path: 'super-gsd/tools/codex-pro/run-self-test.cjs',
      line_start: 1,
      line_end: 1,
      quoted_excerpt: '#!/usr/bin/env node',
      violated_invariant: 'Review findings must retain executor receipt lineage',
      confidence: 0.88,
      focus: 'self-test',
      issue: 'lineage-parent-path',
      mood: 'measured',
    },
  ];
}

function parseFindingsFromOutput(output) {
  const trimmed = String(output || '').trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.findings)) return parsed.findings;
  } catch (_error) {
    return [{
      severity: 'INFO',
      claim: 'Codex native review returned non-JSON output; preserved summary in review markdown.',
      file_path: 'CODEX-NATIVE-REVIEW.md',
      line_start: 1,
      line_end: 1,
      quoted_excerpt: trimmed.slice(0, 240),
      violated_invariant: 'Native review output should be review finding JSON when CMB emission is required',
      confidence: 0.5,
    }];
  }

  return [];
}

function wrapperCandidates() {
  return [
    path.resolve(REPO_ROOT, 'super-gsd', 'scripts', 'codex-exec.sh'),
    path.resolve(REPO_ROOT, 'super-gsd', 'scripts', 'codex-executor.sh'),
    path.resolve(REPO_ROOT, 'codex-exec.sh'),
  ];
}

function findWrapper() {
  return wrapperCandidates().find((candidate) => fs.existsSync(candidate));
}

function runNativeReview(options) {
  const wrapper = findWrapper();
  if (!wrapper) {
    throw new Error(`Unable to locate codex-exec wrapper. Tried: ${wrapperCandidates().join(', ')}`);
  }

  const args = [wrapper, '--profile', 'codex.review.native'];
  if (options.diffPath) args.push('--diff-path', options.diffPath);
  args.push('--phase', String(options.phase));

  const result = childProcess.spawnSync('bash', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      SGSD_CODEX_PROFILE: 'codex.review.native',
    },
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`codex.review.native wrapper exited ${result.status}: ${result.stderr || result.stdout}`);
  }

  const findings = parseFindingsFromOutput(result.stdout);
  const cmbs = findings.map((finding, index) => findingToCmb(finding, options, index));
  appendCmbs(cmbs);
  writeReviewMarkdown(options.phase, findings, result.stdout);
  return cmbs;
}

function phaseDir(phase) {
  const phasesRoot = path.resolve(REPO_ROOT, '.planning', 'milestones', MILESTONE_ID, 'phases');
  if (fs.existsSync(phasesRoot)) {
    const match = fs.readdirSync(phasesRoot).find((entry) => entry === String(phase) || entry.startsWith(`${phase}-`));
    if (match) return path.resolve(phasesRoot, match);
  }
  return path.resolve(phasesRoot, String(phase));
}

function writeReviewMarkdown(phase, findings, rawOutput) {
  const targetDir = phaseDir(phase);
  fs.mkdirSync(targetDir, { recursive: true });
  const lines = [
    '# Codex Native Review',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Profile: codex.review.native`,
    '',
    `Findings: ${findings.length}`,
    '',
  ];

  for (const [index, finding] of findings.entries()) {
    lines.push(`## Finding ${index + 1}`);
    lines.push('');
    lines.push(`- Severity: ${normalizeSeverity(finding.severity)}`);
    lines.push(`- Claim: ${finding.claim || 'Codex native review finding'}`);
    lines.push(`- File: ${finding.file_path || finding.filePath || 'unknown'}`);
    lines.push('');
  }

  if (rawOutput) {
    lines.push('## Raw Output');
    lines.push('');
    lines.push('```');
    lines.push(String(rawOutput).trim());
    lines.push('```');
  }

  fs.writeFileSync(path.resolve(targetDir, 'CODEX-NATIVE-REVIEW.md'), `${lines.join('\n')}\n`, 'utf8');
}

function runSelfTest(options) {
  const cmbs = selfTestFindings().map((finding, index) => findingToCmb(finding, options, index));
  appendCmbs(cmbs);
  process.stdout.write(`[native-review-runner] self-test emitted ${cmbs.length} review_finding CMBs\n`);
  return cmbs;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || argv.length === 0) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  if (args.selfTest) {
    runSelfTest(args);
    return 0;
  }

  const cmbs = runNativeReview(args);
  process.stdout.write(`[native-review-runner] emitted ${cmbs.length} review_finding CMBs\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`[native-review-runner] ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  CMB_LEDGER_PATH,
  appendCmbs,
  findingToCmb,
  parseFindingsFromOutput,
  runSelfTest,
  requireDependency,
};
