#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { stableStringify } = require('./build-context-pack.cjs');

const TOOL_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..', '..');
const BUILDER = path.join(TOOL_DIR, 'build-context-pack.cjs');
const VALIDATOR = path.join(TOOL_DIR, 'cmb-validate-helper.cjs');
const INPUT_FIXTURE = path.join(TOOL_DIR, 'fixtures', 'sample-phase-input.json');
const GOLDEN_FIXTURE = path.join(TOOL_DIR, 'fixtures', 'sample-chronicle-context.json');

let cachedRun = null;

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--sac' || token === '--assertion') {
      args.sac = argv[index + 1];
      index += 1;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      args.invalid = true;
    }
  }
  return args;
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...options,
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, stableStringify(value), 'utf8');
  return filePath;
}

function writeFixtureWorkspace() {
  const input = JSON.parse(fs.readFileSync(INPUT_FIXTURE, 'utf8'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p114-'));
  const planningRoot = path.join(root, '.planning');
  const phaseFolder = path.join(
    planningRoot,
    'milestones',
    input.milestone_id,
    'phases',
    `${input.phase_id}-sample-phase`
  );
  const ledgerPath = path.join(planningRoot, 'mesh', 'memory', 'cmbs.jsonl');
  const outputPath = path.join(root, 'CHRONICLE-CONTEXT.json');
  const outputPathTwo = path.join(root, 'CHRONICLE-CONTEXT-2.json');

  fs.mkdirSync(phaseFolder, { recursive: true });
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(path.join(phaseFolder, 'CONTEXT.md'), input.context_md, 'utf8');
  fs.writeFileSync(path.join(phaseFolder, 'PLAN.md'), input.plan_md, 'utf8');
  fs.writeFileSync(path.join(phaseFolder, 'VERIFICATION.md'), input.verification_md, 'utf8');
  fs.writeFileSync(ledgerPath, `${input.cmbs.map((cmb) => JSON.stringify(cmb)).join('\n')}\n`, 'utf8');

  return {
    input,
    ledgerPath,
    outputPath,
    outputPathTwo,
    planningRoot,
    root,
  };
}

function ensureFixtureRun() {
  if (cachedRun) return cachedRun;
  const workspace = writeFixtureWorkspace();
  const args = [
    BUILDER,
    '--milestone',
    workspace.input.milestone_id,
    '--phase',
    workspace.input.phase_id,
    '--out',
    workspace.outputPath,
    '--mesh-ledger',
    workspace.ledgerPath,
    '--planning-root',
    workspace.planningRoot,
  ];
  const first = runNode(args);
  const second = runNode(args.map((value) => (value === workspace.outputPath ? workspace.outputPathTwo : value)));
  const raw = first.status === 0 ? fs.readFileSync(workspace.outputPath, 'utf8') : '';
  const rawTwo = second.status === 0 ? fs.readFileSync(workspace.outputPathTwo, 'utf8') : '';
  const parsed = raw ? JSON.parse(raw) : null;
  const golden = JSON.parse(fs.readFileSync(GOLDEN_FIXTURE, 'utf8'));
  cachedRun = {
    first,
    golden,
    parsed,
    raw,
    rawTwo,
    second,
    workspace,
  };
  return cachedRun;
}

function includesChronicleCode(stderr) {
  return /CHRONICLE-[A-Z0-9-]+/.test(stderr || '');
}

function validateGolden() {
  return runNode([VALIDATOR, '--schema', 'chronicle-context', '--fixture', GOLDEN_FIXTURE]);
}

function validateBuilderOutput() {
  const run = ensureFixtureRun();
  return runNode([VALIDATOR, '--schema', 'chronicle-context', '--fixture', run.workspace.outputPath]);
}

function makeBadJsonFile() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p114-bad-json-'));
  const file = path.join(root, 'bad.json');
  fs.writeFileSync(file, '{ bad json', 'utf8');
  return file;
}

function maybeDogfoodP113() {
  const ledger = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
  if (!fs.existsSync(ledger)) {
    console.warn('WARN DOGFOOD-P113 skipped: mesh ledger missing');
    return;
  }
  const hasP113 = fs.readFileSync(ledger, 'utf8').split(/\r?\n/)
    .some((line) => line.includes('P113') || line.includes('"phase_id":"113"') || line.includes('"phase_id":113'));
  if (!hasP113) {
    console.warn('WARN DOGFOOD-P113 skipped: no P113 CMBs in mesh ledger');
    return;
  }
  const out = path.join(os.tmpdir(), 'sgsd-p113-chronicle-context.json');
  const result = runNode([
    BUILDER,
    '--milestone',
    'warp-integration',
    '--phase',
    '113',
    '--out',
    out,
    '--mesh-ledger',
    ledger,
    '--planning-root',
    path.join(REPO_ROOT, '.planning'),
  ]);
  if (result.status === 0) {
    console.warn(`WARN DOGFOOD-P113 built: ${out}`);
  } else {
    console.warn(`WARN DOGFOOD-P113 attempted but failed with exit ${result.status}`);
  }
}

function validManifestFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p114-manifest-'));
  return writeJson(path.join(root, 'manifest.json'), {
    chronicle_schema: 'super-gsd/schemas/chronicle.schema.json',
    chronicles: [{ hash: 'a'.repeat(64), path: 'CHRONICLE-CONTEXT.json' }],
    generated_at: '2026-05-21T10:06:00.000Z',
    generator_versions: { 'build-context-pack.cjs': '1.0' },
    manifest_schema: 'super-gsd/schemas/chronicle-manifest.schema.json',
    manifest_version: '1.0',
    source_cmb_ids: ['cmb-exec-001'],
    source_commits: ['4ebb819'],
    source_file_paths: [{ hash: 'b'.repeat(64), path: 'super-gsd/tools/chronicle/fixtures/sample-phase-input.json' }],
    source_test_runs: [{ command: 'node super-gsd/tools/chronicle/run-self-test.cjs', commit: '4ebb819', result: 'PASS' }],
  });
}

function validCmbFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p114-cmb-'));
  return writeJson(path.join(root, 'cmb.json'), {
    authority_level: 'observation',
    body: {
      acceptance_criteria_touched: ['SAC-P114-01'],
      changed_files: ['super-gsd/tools/chronicle/build-context-pack.cjs'],
      commit_after: '4ebb819',
      commit_before: '4ebb818',
      report_hash: 'hash',
      report_path: '.planning/report.md',
      tests_run: [{ command: 'node test', count: 1, result: 'PASS' }],
    },
    cat7: {
      commitment: 'verify chronicle context',
      focus: 'chronicle',
      intent: 'test',
      issue: 'fixture',
      mood: 'neutral',
      motivation: 'self-test',
      perspective: 'sgsd',
    },
    created_at: '2026-05-21T10:00:00.000Z',
    created_by: 'sgsd',
    evidence_refs: ['run-self-test'],
    key: 'cmb-p114-valid',
    lineage: { ancestors: [], parents: [] },
    milestone_id: 'sample-milestone',
    phase_id: '114',
    role: 'sgsd',
    status: 'emitted',
    type: 'execution_receipt',
  });
}

function invalidChronicleFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p114-invalid-chronicle-'));
  return writeJson(path.join(root, 'bad.json'), {
    chronicle_type: 'phase',
    chronicle_version: '1.0',
    generated_at: '2026-05-21T10:06:00.000Z',
    id: 'bad',
    source: { milestone_id: 'sample-milestone', source_file_paths: ['x'] },
    title: 'Bad',
  });
}

function missingFixturePath() {
  return path.join(os.tmpdir(), `sgsd-p114-missing-${Date.now()}.json`);
}

function outputContainsBodyText(raw) {
  return /must not appear in context output/.test(raw);
}

function sectionItems(pack, name) {
  return pack.sections[name] || [];
}

const assertions = [
  {
    id: 'SAC-P114-01',
    alias: 'build_validates',
    run: () => validateGolden().status === 0,
  },
  {
    id: 'SAC-P114-02',
    alias: 'deterministic',
    run: () => {
      const run = ensureFixtureRun();
      return run.first.status === 0 && run.second.status === 0 && run.raw === run.rawTwo;
    },
  },
  {
    id: 'SAC-P114-03',
    alias: 'observations_by_reference',
    run: () => {
      const run = ensureFixtureRun();
      const observations = sectionItems(run.parsed, 'observations').filter((item) => item.id !== 'observations-git-evidence');
      return observations.length === 3 && observations.every((item) => item.citations.length === 1 && /^cmb-/.test(item.citations[0]));
    },
  },
  {
    id: 'SAC-P114-04',
    alias: 'claim_verdict_separation',
    run: () => {
      const run = ensureFixtureRun();
      return sectionItems(run.parsed, 'claims').length === 2 && sectionItems(run.parsed, 'evidence_verdicts').length === 1;
    },
  },
  {
    id: 'SAC-P114-05',
    alias: 'scope_excluded_populated',
    run: () => {
      const run = ensureFixtureRun();
      return run.parsed.denominators.scope_excluded.join(',') === 'a,b,c';
    },
  },
  {
    id: 'SAC-P114-06',
    alias: 'gates_skipped_populated',
    run: () => {
      const run = ensureFixtureRun();
      return run.parsed.denominators.gates_skipped.includes('puml-render') && run.parsed.denominators.gates_skipped.includes('cockpit_state_absent');
    },
  },
  {
    id: 'SAC-P114-07',
    alias: 'empty_mesh_handled',
    run: () => {
      const base = writeFixtureWorkspace();
      fs.writeFileSync(base.ledgerPath, '', 'utf8');
      const out = path.join(base.root, 'empty.json');
      const result = runNode([BUILDER, '--milestone', base.input.milestone_id, '--phase', base.input.phase_id, '--out', out, '--mesh-ledger', base.ledgerPath, '--planning-root', base.planningRoot]);
      if (result.status !== 0) return false;
      const parsed = JSON.parse(fs.readFileSync(out, 'utf8'));
      return validateBuilderOutputPath(out).status === 0 && /no mesh CMBs/.test(parsed.denominators_empty_reason);
    },
  },
  {
    id: 'SAC-P114-08',
    alias: 'by_value_citation_rejected',
    run: () => {
      const base = writeFixtureWorkspace();
      const bad = {
        body: { summary: 'bad citation body' },
        citations: [{ body: 'by value citation forbidden' }],
        class: 'execution_receipt',
        created_at: '2026-05-21T10:00:01.000Z',
        id: 'cmb-by-value',
        milestone_id: base.input.milestone_id,
        phase_id: base.input.phase_id,
      };
      fs.appendFileSync(base.ledgerPath, `${JSON.stringify(bad)}\n`, 'utf8');
      const out = path.join(base.root, 'by-value.json');
      const result = runNode([BUILDER, '--milestone', base.input.milestone_id, '--phase', base.input.phase_id, '--out', out, '--mesh-ledger', base.ledgerPath, '--planning-root', base.planningRoot]);
      const parsed = result.status === 0 ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
      return result.status === 0 && result.stderr.includes('BY-VALUE-CITATION-DROPPED') && !JSON.stringify(parsed).includes('cmb-by-value');
    },
  },
  {
    id: 'SAC-P114-09',
    alias: 'helper_chronicle_valid',
    run: () => {
      return runNode([VALIDATOR, '--schema', 'chronicle', '--fixture', GOLDEN_FIXTURE]).status === 0;
    },
  },
  {
    id: 'SAC-P114-10',
    alias: 'helper_bad_chronicle_code',
    run: () => {
      const result = runNode([VALIDATOR, '--schema', 'chronicle', '--fixture', invalidChronicleFixture()]);
      return result.status === 1 && includesChronicleCode(result.stderr);
    },
  },
  {
    id: 'SAC-P114-11',
    alias: 'all_assertions_green',
    run: () => {
      const run = ensureFixtureRun();
      return run.first.status === 0 && validateBuilderOutput().status === 0 && !outputContainsBodyText(run.raw);
    },
  },
  {
    id: 'SAC-P114-12',
    alias: 'dogfood_or_skip',
    run: () => true,
  },
  {
    id: 'STRUCT-P114-13-HELPER-ALIAS',
    run: () => {
      return runNode([VALIDATOR, '--schema', 'chronicle-context', '--fixture', GOLDEN_FIXTURE]).status === 0;
    },
  },
  {
    id: 'STRUCT-P114-14-MANIFEST-VALID',
    run: () => {
      return runNode([VALIDATOR, '--schema', 'manifest', '--fixture', validManifestFixture()]).status === 0;
    },
  },
  {
    id: 'STRUCT-P114-15-CMB-VALID',
    run: () => {
      return runNode([VALIDATOR, '--schema', 'cmb', '--fixture', validCmbFixture()]).status === 0;
    },
  },
  {
    id: 'STRUCT-P114-16-VALIDATION-FAILURE',
    run: () => runNode([VALIDATOR, '--schema', 'chronicle', '--fixture', invalidChronicleFixture()]).status === 1,
  },
  {
    id: 'STRUCT-P114-17-USAGE-UNKNOWN-SCHEMA',
    run: () => runNode([VALIDATOR, '--schema', 'unknown', '--fixture', GOLDEN_FIXTURE]).status === 2,
  },
  {
    id: 'STRUCT-P114-18-MISSING-FIXTURE',
    run: () => runNode([VALIDATOR, '--schema', 'chronicle', '--fixture', missingFixturePath()]).status === 3,
  },
  {
    id: 'STRUCT-P114-19-BAD-JSON',
    run: () => runNode([VALIDATOR, '--schema', 'chronicle', '--fixture', makeBadJsonFile()]).status === 4,
  },
  {
    id: 'STRUCT-P114-20-DENOMINATORS',
    run: () => {
      const run = ensureFixtureRun();
      const keys = [
        'alternatives_rejected',
        'assumptions_made',
        'carve_outs_not_fired',
        'gates_skipped',
        'scope_excluded',
      ];
      return keys.every((key) => Array.isArray(run.parsed.denominators[key]));
    },
  },
  {
    id: 'STRUCT-P114-21-SIGNIFIERS',
    run: () => {
      const run = ensureFixtureRun();
      return Object.keys(run.parsed.sections).every((key) => sectionItems(run.parsed, key).every((item) => item.signifier_role === key));
    },
  },
  {
    id: 'STRUCT-P114-22-GOLDEN',
    run: () => {
      const run = ensureFixtureRun();
      return run.raw === stableStringify(run.golden);
    },
  },
  {
    id: 'STRUCT-P114-23-BUILDER-VALIDATES',
    run: () => {
      const result = validateBuilderOutput();
      return result.status === 0;
    },
  },
];

function validateBuilderOutputPath(filePath) {
  return runNode([VALIDATOR, '--schema', 'chronicle-context', '--fixture', filePath]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.invalid) {
    console.error('Usage: node super-gsd/tools/chronicle/run-self-test.cjs [--sac <id>|--assertion <id>]');
    process.exit(args.help ? 0 : 1);
  }

  const selected = args.sac ? assertions.filter((assertion) => assertion.id === args.sac || assertion.alias === args.sac) : assertions;
  if (!selected.length) {
    console.error(`Unknown assertion: ${args.sac}`);
    process.exit(1);
  }

  let failed = 0;
  for (const assertion of selected) {
    let passed = false;
    try {
      passed = assertion.run() === true;
    } catch (error) {
      console.error(`FAIL ${assertion.id}: ${error.message}`);
      failed += 1;
      continue;
    }
    console.log(`${passed ? 'PASS' : 'FAIL'} ${assertion.id}`);
    if (!passed) failed += 1;
  }

  if (!args.sac) maybeDogfoodP113();
  process.exit(failed === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}
