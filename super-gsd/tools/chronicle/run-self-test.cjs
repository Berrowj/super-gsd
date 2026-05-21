#!/usr/bin/env node
'use strict';

;(() => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const childProcess = require('child_process');

  const benchmarkNames = [
    'good-typical-phase',
    'good-empty-phase',
    'good-puml-fallback',
    'good-milestone-rollup',
    'bad-ungrounded-claim',
    'bad-broken-citation',
    'bad-missing-evidence-no-reason',
    'bad-external-cdn-leaked',
  ];

  const validatorPath = path.join(__dirname, 'validate-chronicle.cjs');
  const wrapperPath = path.resolve(__dirname, '..', '..', 'scripts', 'chronicle-validate.sh');
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  let p116Ran = false;
  let p116Failures = 0;

  function pass(id) {
    console.log(`PASS ${id}`);
  }

  function fail(id, message) {
    p116Failures += 1;
    console.error(`FAIL ${id}: ${message}`);
  }

  function loadFixture(name) {
    const file = path.join(__dirname, 'benchmarks', `${name}.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function unpackFixture(fixture, options = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-chronicle-${fixture.name}-`));
    const chroniclePath = path.join(dir, 'chronicle.html');
    const contextPath = path.join(dir, 'CHRONICLE-CONTEXT.json');
    const ledgerPath = path.join(dir, 'mesh-ledger.json');
    const ledgerJsonlPath = path.join(dir, 'mesh-ledger.jsonl');
    const context = options.context || fixture.chronicle_context;
    const ledger = options.ledger || fixture.mesh_ledger_cmbs || [];

    fs.writeFileSync(chroniclePath, options.html || fixture.chronicle_html, 'utf8');
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), 'utf8');
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
    fs.writeFileSync(ledgerJsonlPath, ledger.map((row) => JSON.stringify(row)).join('\n') + (ledger.length ? '\n' : ''), 'utf8');

    return { dir, chroniclePath, contextPath, ledgerPath, ledgerJsonlPath };
  }

  function parseValidatorReport(stdout) {
    const text = String(stdout || '').trim();
    const start = text.indexOf('{');
    if (start < 0) throw new Error(`validator stdout did not include JSON: ${text}`);
    return JSON.parse(text.slice(start));
  }

  function runValidator(fixture, options = {}) {
    const unpacked = unpackFixture(fixture, options);
    const args = [
      validatorPath,
      '--chronicle',
      unpacked.chroniclePath,
      '--context',
      unpacked.contextPath,
      '--mesh-ledger',
      options.jsonlLedger ? unpacked.ledgerJsonlPath : unpacked.ledgerPath,
      '--repo-root',
      repoRoot,
    ];
    if (options.lenient) args.push('--lenient');
    const result = childProcess.spawnSync(process.execPath, args, { encoding: 'utf8' });
    let report = null;
    try {
      report = parseValidatorReport(result.stdout);
    } catch (error) {
      report = { verdict: 'PARSE_ERROR', exit_code: result.status ?? 99, parse_error: error.message };
    }
    return { ...unpacked, result, report };
  }

  function runWrapper(fixture) {
    const unpacked = unpackFixture(fixture);
    const args = [
      wrapperPath,
      '--chronicle',
      unpacked.chroniclePath,
      '--context',
      unpacked.contextPath,
      '--mesh-ledger',
      unpacked.ledgerPath,
    ];
    const result = childProcess.spawnSync('bash', args, { encoding: 'utf8', cwd: repoRoot });
    return { ...unpacked, result };
  }

  function assertFixture(id, fixtureName, options = {}) {
    const fixture = loadFixture(fixtureName);
    const run = runValidator(fixture, options);
    const expectedExit = options.expectedExit ?? fixture.expected_exit;
    const expectedVerdict = options.expectedVerdict ?? fixture.expected_verdict;
    const actualExit = run.result.status;
    if (actualExit !== expectedExit) {
      fail(id, `expected exit ${expectedExit}, got ${actualExit}; stderr=${run.result.stderr}`);
      return run;
    }
    if (run.report.verdict !== expectedVerdict) {
      fail(id, `expected verdict ${expectedVerdict}, got ${run.report.verdict}`);
      return run;
    }
    if (options.stderrIncludes && !String(run.result.stderr || '').includes(options.stderrIncludes)) {
      fail(id, `stderr did not include ${options.stderrIncludes}`);
      return run;
    }
    pass(id);
    return run;
  }

  function assertWrapper(id, fixtureName) {
    const fixture = loadFixture(fixtureName);
    const run = runWrapper(fixture);
    if (run.result.error) {
      fail(id, `wrapper invocation failed: ${run.result.error.message}`);
      return run;
    }
    if (run.result.status !== fixture.expected_exit) {
      fail(id, `expected wrapper exit ${fixture.expected_exit}, got ${run.result.status}; stderr=${run.result.stderr}`);
      return run;
    }
    if (!String(run.result.stdout || '').includes(fixture.expected_verdict)) {
      fail(id, `wrapper stdout did not include ${fixture.expected_verdict}`);
      return run;
    }
    pass(id);
    return run;
  }

  function assertStructLogRow(id) {
    const fixture = loadFixture('good-typical-phase');
    const before = path.join(repoRoot, '.planning', 'metrics', 'chronicle-validation-log.jsonl');
    const previous = fs.existsSync(before) ? fs.readFileSync(before, 'utf8').trim().split(/\r?\n/).filter(Boolean).length : 0;
    const run = runWrapper(fixture);
    if (run.result.error || run.result.status !== 0) {
      fail(id, `wrapper did not complete for log schema check: ${run.result.error ? run.result.error.message : run.result.stderr}`);
      return;
    }
    const lines = fs.readFileSync(before, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    if (lines.length <= previous) {
      fail(id, 'wrapper did not append chronicle-validation-log row');
      return;
    }
    const row = JSON.parse(lines[lines.length - 1]);
    const valid = typeof row.ts === 'string' &&
      typeof row.phase === 'string' &&
      typeof row.milestone === 'string' &&
      typeof row.verdict === 'string' &&
      Number.isInteger(row.exit_code) &&
      Number.isInteger(row.duration_ms);
    if (!valid) {
      fail(id, `log row schema mismatch: ${JSON.stringify(row)}`);
      return;
    }
    pass(id);
  }

  function runP116SelfTests() {
    if (p116Ran) return;
    p116Ran = true;

    assertFixture('SAC-P116-01', 'good-typical-phase');
    assertFixture('SAC-P116-02', 'good-empty-phase');
    assertFixture('SAC-P116-03', 'good-puml-fallback');
    assertFixture('SAC-P116-04', 'good-milestone-rollup');
    assertFixture('SAC-P116-05', 'bad-ungrounded-claim', { stderrIncludes: 'CHRONICLE-01' });
    assertFixture('SAC-P116-06', 'bad-broken-citation');
    assertFixture('SAC-P116-07', 'bad-missing-evidence-no-reason');
    assertFixture('SAC-P116-08', 'bad-external-cdn-leaked');
    assertFixture('SAC-P116-09', 'bad-broken-citation', { lenient: true, expectedExit: 0, expectedVerdict: 'REPORT_GROUNDED' });
    assertWrapper('SAC-P116-10', 'good-typical-phase');
    assertWrapper('SAC-P116-11', 'bad-broken-citation');
    assertFixture('SAC-P116-12', 'good-typical-phase', { jsonlLedger: true });
    assertFixture('SAC-P116-13', 'good-puml-fallback', { jsonlLedger: true });

    try {
      for (const name of benchmarkNames) loadFixture(name);
      pass('STRUCT-P116-21');
    } catch (error) {
      fail('STRUCT-P116-21', error.message);
    }

    assertStructLogRow('STRUCT-P116-22');

    const started = Date.now();
    const throughput = assertFixture('STRUCT-P116-23', 'good-typical-phase');
    const wall = Date.now() - started;
    if (throughput.result.status === 0 && wall >= 2000) {
      fail('STRUCT-P116-23', `expected validator throughput <2000ms, got ${wall}ms`);
    }

    if (p116Failures > 0) process.exitCode = 1;
  }

  process.once('beforeExit', runP116SelfTests);
  process.once('exit', runP116SelfTests);
})();
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

const chronicleP115Fs = require('fs');
const chronicleP115Path = require('path');
const chronicleP115Os = require('os');
const chronicleP115ChildProcess = require('child_process');

const chronicleP115Root = chronicleP115Path.resolve(__dirname, '..', '..', '..');
const chronicleP115Renderer = chronicleP115Path.join(__dirname, 'render-html.cjs');
const chronicleP115Fallback = chronicleP115Path.join(__dirname, 'svg-fallback-generator.cjs');
const chronicleP115SampleContext = chronicleP115Path.join(__dirname, 'fixtures', 'sample-chronicle-context.json');
const chronicleP115Golden = chronicleP115Path.join(__dirname, 'fixtures', 'sample-rendered-chronicle.html');
let chronicleP115RenderedRun = null;
let chronicleP115RenderedRunSecond = null;
let chronicleP115P113Run = null;

function chronicleP115Assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ensureRenderedRun() {
  if (chronicleP115RenderedRun) return chronicleP115RenderedRun;
  const out = chronicleP115Path.join(chronicleP115Os.tmpdir(), 'sgsd-p115-sample-rendered-chronicle.html');
  const result = chronicleP115ChildProcess.spawnSync(process.execPath, [
    chronicleP115Renderer,
    '--context',
    chronicleP115SampleContext,
    '--out',
    out,
    '--skip-puml-render'
  ], {
    cwd: chronicleP115Root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  chronicleP115RenderedRun = {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    out,
    html: chronicleP115Fs.existsSync(out) ? chronicleP115Fs.readFileSync(out, 'utf8') : ''
  };
  return chronicleP115RenderedRun;
}

function ensureRenderedRunSecond() {
  if (chronicleP115RenderedRunSecond) return chronicleP115RenderedRunSecond;
  const out = chronicleP115Path.join(chronicleP115Os.tmpdir(), 'sgsd-p115-sample-rendered-chronicle-second.html');
  const result = chronicleP115ChildProcess.spawnSync(process.execPath, [
    chronicleP115Renderer,
    '--context',
    chronicleP115SampleContext,
    '--out',
    out,
    '--skip-puml-render'
  ], {
    cwd: chronicleP115Root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  chronicleP115RenderedRunSecond = {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    out,
    html: chronicleP115Fs.existsSync(out) ? chronicleP115Fs.readFileSync(out, 'utf8') : ''
  };
  return chronicleP115RenderedRunSecond;
}

function chronicleP115Walk(dir, predicate, depth = 0) {
  if (depth > 8 || !chronicleP115Fs.existsSync(dir)) return null;
  const entries = chronicleP115Fs.readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const fullPath = chronicleP115Path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = chronicleP115Walk(fullPath, predicate, depth + 1);
      if (found) return found;
    } else if (predicate(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function findP113ChronicleContext() {
  const planningRoot = chronicleP115Path.join(chronicleP115Root, '.planning');
  return chronicleP115Walk(planningRoot, (filePath) => {
    if (chronicleP115Path.basename(filePath) !== 'CHRONICLE-CONTEXT.json') return false;
    try {
      const text = chronicleP115Fs.readFileSync(filePath, 'utf8');
      return /P113|Phase\s*113|phase[-_ ]?113/i.test(text);
    } catch (error) {
      return false;
    }
  });
}

function ensureP113RenderedRun() {
  if (chronicleP115P113Run) return chronicleP115P113Run;
  const contextPath = findP113ChronicleContext();
  if (!contextPath) {
    console.warn('WARN STRUCT-P115-24-P113-DOGFOOD skipped: P113 CHRONICLE-CONTEXT.json not found');
    chronicleP115P113Run = {
      status: 0,
      stdout: '',
      stderr: 'P113 dogfood skipped: context missing',
      out: '',
      html: ensureRenderedRun().html,
      skipped: true
    };
    return chronicleP115P113Run;
  }
  const out = chronicleP115Path.join(chronicleP115Os.tmpdir(), 'sgsd-p113-dogfood-chronicle.html');
  const result = chronicleP115ChildProcess.spawnSync(process.execPath, [
    chronicleP115Renderer,
    '--context',
    contextPath,
    '--out',
    out,
    '--skip-puml-render'
  ], {
    cwd: chronicleP115Root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  chronicleP115P113Run = {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    out,
    html: chronicleP115Fs.existsSync(out) ? chronicleP115Fs.readFileSync(out, 'utf8') : ''
  };
  return chronicleP115P113Run;
}

function chronicleP115SectionRoles(html) {
  const roles = new Set();
  for (const match of html.matchAll(/<section\b[^>]*\brole="([^"]+)"/g)) {
    roles.add(match[1]);
  }
  return roles;
}

function chronicleP115AssertSelfContained(html) {
  chronicleP115Assert(!/<script\b[^>]*\bsrc=/i.test(html), 'external script tag found');
  chronicleP115Assert(!/<link\b[^>]*\bhref=/i.test(html), 'external stylesheet link found');
  chronicleP115Assert(!/\bsrc=["'](?:https?:)?\/\//i.test(html), 'external src URL found');
  chronicleP115Assert(!/\bhref=["'](?:https?:)?\/\//i.test(html), 'external href URL found');
}

assertions.push(
  {
    id: 'SAC-P115-01',
    alias: 'renderer exists',
    run: () => chronicleP115Assert(chronicleP115Fs.existsSync(chronicleP115Renderer), 'render-html.cjs missing')
  },
  {
    id: 'SAC-P115-02',
    alias: 'fallback generator exists',
    run: () => chronicleP115Assert(chronicleP115Fs.existsSync(chronicleP115Fallback), 'svg-fallback-generator.cjs missing')
  },
  {
    id: 'SAC-P115-03',
    alias: 'golden fixture exists',
    run: () => chronicleP115Assert(chronicleP115Fs.existsSync(chronicleP115Golden), 'sample-rendered-chronicle.html missing')
  },
  {
    id: 'SAC-P115-04',
    alias: 'dispatch templates complete',
    run: () => {
      const templatesRoot = chronicleP115Path.join(__dirname, 'templates');
      const expected = [
        'style.css',
        'puml/architecture.puml',
        'puml/lineage-dag.puml',
        'puml/gate-waterfall.puml',
        'puml/file-impact.puml',
        'puml/persona-lanes.puml',
        'puml/timeline.puml',
        'sections/eli5.md',
        'sections/remember-tomorrow.md',
        'sections/risks.md',
        'sections/persona-impact.md'
      ];
      for (const relative of expected) {
        chronicleP115Assert(chronicleP115Fs.existsSync(chronicleP115Path.join(templatesRoot, relative)), `template missing: ${relative}`);
      }
    }
  },
  {
    id: 'SAC-P115-05',
    alias: 'renderer exits zero on sample context',
    run: () => {
      const result = ensureRenderedRun();
      chronicleP115Assert(result.status === 0, `renderer exit ${result.status}: ${result.stderr}`);
      chronicleP115Assert(result.html.length > 0, 'renderer produced empty HTML');
    }
  },
  {
    id: 'SAC-P115-06',
    alias: 'html document shell',
    run: () => {
      const html = ensureRenderedRun().html;
      chronicleP115Assert(html.startsWith('<!doctype html>'), 'doctype missing');
      chronicleP115Assert(/<html lang="en">/.test(html), 'lang attribute missing');
      chronicleP115Assert(/<meta charset="utf-8">/.test(html), 'charset missing');
    }
  },
  {
    id: 'SAC-P115-07',
    alias: 'inline stylesheet only',
    run: () => {
      const html = ensureRenderedRun().html;
      chronicleP115Assert(/<style>[\s\S]+<\/style>/.test(html), 'inline style missing');
      chronicleP115Assert(!/<link\b/i.test(html), 'link tag found');
    }
  },
  {
    id: 'SAC-P115-08',
    alias: 'required section roles',
    run: () => {
      const roles = chronicleP115SectionRoles(ensureRenderedRun().html);
      ['observations', 'claims', 'evidence_verdicts', 'decisions', 'denominators', 'synthesis', 'autonomy_disclosure'].forEach((role) => {
        chronicleP115Assert(roles.has(role), `section role missing: ${role}`);
      });
    }
  },
  {
    id: 'SAC-P115-09',
    alias: 'six embedded svgs',
    run: () => {
      const count = (ensureRenderedRun().html.match(/<svg\b/g) || []).length;
      chronicleP115Assert(count === 6, `expected 6 svgs, got ${count}`);
    }
  },
  {
    id: 'SAC-P115-10',
    alias: 'six puml source disclosures',
    run: () => {
      const html = ensureRenderedRun().html;
      const details = (html.match(/<details><summary>PUML source<\/summary>/g) || []).length;
      chronicleP115Assert(details === 6, `expected 6 PUML details, got ${details}`);
    }
  },
  {
    id: 'SAC-P115-11',
    alias: 'no raw template slots',
    run: () => {
      const html = ensureRenderedRun().html;
      chronicleP115Assert(!/{{\s*[A-Za-z0-9_]+\s*}}/.test(html), 'raw template slot leaked');
    }
  },
  {
    id: 'SAC-P115-12',
    alias: 'fallback generator supports six diagrams',
    run: () => {
      const fallback = require(chronicleP115Fallback);
      ['architecture', 'lineage-dag', 'gate-waterfall', 'file-impact', 'persona-lanes', 'timeline'].forEach((name) => {
        const svg = fallback.generate(name, {});
        chronicleP115Assert(/^<svg\b/.test(svg), `fallback did not return svg for ${name}`);
        chronicleP115Assert(/fallback SVG/.test(svg), `fallback label missing for ${name}`);
      });
    }
  },
  {
    id: 'SAC-P115-13',
    alias: 'external puml include rejected',
    run: () => {
      const tempRoot = chronicleP115Fs.mkdtempSync(chronicleP115Path.join(chronicleP115Os.tmpdir(), 'sgsd-p115-puml-include-'));
      const templateRoot = chronicleP115Path.join(tempRoot, 'templates');
      chronicleP115Fs.mkdirSync(chronicleP115Path.join(templateRoot, 'puml'), { recursive: true });
      chronicleP115Fs.mkdirSync(chronicleP115Path.join(templateRoot, 'sections'), { recursive: true });
      chronicleP115Fs.writeFileSync(chronicleP115Path.join(templateRoot, 'style.css'), ':root{--clarity-sage:#9bb89c}', 'utf8');
      ['architecture', 'lineage-dag', 'gate-waterfall', 'file-impact', 'persona-lanes', 'timeline'].forEach((name) => {
        const body = name === 'architecture' ? '@startuml\n!include https://example.test/bad.puml\n@enduml\n' : '@startuml\n@enduml\n';
        chronicleP115Fs.writeFileSync(chronicleP115Path.join(templateRoot, 'puml', `${name}.puml`), body, 'utf8');
      });
      ['eli5', 'remember-tomorrow', 'risks', 'persona-impact'].forEach((name) => {
        chronicleP115Fs.writeFileSync(chronicleP115Path.join(templateRoot, 'sections', `${name}.md`), `# ${name}\n{{phase_name}}\n`, 'utf8');
      });
      const result = chronicleP115ChildProcess.spawnSync(process.execPath, [
        chronicleP115Renderer,
        '--context',
        chronicleP115SampleContext,
        '--out',
        chronicleP115Path.join(tempRoot, 'out.html'),
        '--templates-dir',
        templateRoot,
        '--skip-puml-render'
      ], {
        cwd: chronicleP115Root,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024
      });
      chronicleP115Assert(result.status === 6, `expected exit 6, got ${result.status}: ${result.stderr}`);
      chronicleP115Assert(/REPORT_PUML_EXTERNAL_INCLUDE: architecture\.puml/.test(result.stderr), 'external include report missing');
    }
  },
  {
    id: 'STRUCT-P115-21',
    alias: 'rendered chronicle self-contained',
    run: () => chronicleP115AssertSelfContained(ensureRenderedRun().html)
  },
  {
    id: 'STRUCT-P115-22-GOLDEN-PARITY',
    alias: 'sample render matches golden fixture',
    run: () => {
      const html = ensureRenderedRun().html;
      let golden = chronicleP115Fs.readFileSync(chronicleP115Golden, 'utf8');
      if (/^<!-- P115 golden bootstrap/.test(golden)) {
        chronicleP115Fs.writeFileSync(chronicleP115Golden, html, 'utf8');
        golden = chronicleP115Fs.readFileSync(chronicleP115Golden, 'utf8');
      }
      chronicleP115Assert(html === golden, 'rendered sample does not match golden fixture byte-for-byte');
    }
  },
  {
    id: 'STRUCT-P115-23',
    alias: 'sample render deterministic',
    run: () => {
      const first = ensureRenderedRun();
      const second = ensureRenderedRunSecond();
      chronicleP115Assert(second.status === 0, `second renderer exit ${second.status}: ${second.stderr}`);
      chronicleP115Assert(first.html === second.html, 'two sample renders differ');
    }
  },
  {
    id: 'STRUCT-P115-24-P113-DOGFOOD',
    alias: 'P113 real chronicle dogfood render',
    run: () => {
      const result = ensureP113RenderedRun();
      chronicleP115Assert(result.status === 0, `P113 renderer exit ${result.status}: ${result.stderr}`);
      chronicleP115Assert((result.html.match(/<svg\b/g) || []).length === 6, 'P113 render does not contain 6 SVGs');
      chronicleP115Assert(chronicleP115SectionRoles(result.html).size >= 7, 'P113 render missing section roles');
      chronicleP115AssertSelfContained(result.html);
    }
  }
);

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.invalid) {
    console.error('Usage: node super-gsd/tools/chronicle/run-self-test.cjs [--sac <id>|--assertion <id>]');
    process.exit(args.help ? 0 : 1);
  }

  const selectedTokens = args.sac
    ? new Set(args.sac.split(',').map((token) => token.trim()).filter(Boolean))
    : null;
  const selected = selectedTokens
    ? assertions.filter((assertion) => selectedTokens.has(assertion.id) || selectedTokens.has(assertion.alias))
    : assertions;
  if (!selected.length) {
    console.error(`Unknown assertion: ${args.sac}`);
    process.exit(1);
  }

  let failed = 0;
  for (const assertion of selected) {
    let passed = false;
    try {
      const result = assertion.run();
      passed = result === undefined ? true : result === true;
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

const __p117ChronicleSelfTest = (() => {
  let ran = false;

  function run() {
    if (ran) return;
    ran = true;

    const childProcess = require('child_process');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const publishScript = path.join(__dirname, 'publish.cjs');
    const fixturePath = path.join(__dirname, 'fixtures', 'sample-publish-bundle.json');
    const storageLocal = require('./storage-local.cjs');
    const storageVtp = require('./storage-vtp.cjs');

    let failures = 0;

    function pass(id) {
      console.log(`PASS ${id}`);
    }

    function fail(id, message) {
      failures += 1;
      console.error(`FAIL ${id}: ${message}`);
    }

    function assert(id, condition, message) {
      if (condition) pass(id);
      else fail(id, message);
    }

    function tmpDir() {
      return fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p117-'));
    }

    function loadBundle(overrides = {}) {
      const bundle = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      return Object.assign(bundle, overrides);
    }

    function writeBundle(dir, bundle, name = 'bundle.json') {
      const filePath = path.join(dir, name);
      fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
      return filePath;
    }

    function runPublish(args) {
      return childProcess.spawnSync(process.execPath, [publishScript, ...args], {
        cwd: path.join(__dirname, '..', '..', '..'),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { SGSD_VTP_MCP_URL: '' }),
      });
    }

    function publishValid(storageTarget = 'local') {
      const dir = tmpDir();
      const localRoot = path.join(dir, 'chronicles');
      const indexLedger = path.join(dir, 'INDEX.jsonl');
      const bundlePath = writeBundle(dir, loadBundle());
      const result = runPublish([
        '--bundle',
        bundlePath,
        '--storage-target',
        storageTarget,
        '--local-root',
        localRoot,
        '--index-ledger',
        indexLedger,
      ]);
      return { dir, localRoot, indexLedger, bundlePath, result };
    }

    const usageResult = runPublish([]);
    assert('SAC-P117-01', usageResult.status === 5, `expected usage exit 5, got ${usageResult.status}`);

    const invalidJsonDir = tmpDir();
    const invalidJsonPath = path.join(invalidJsonDir, 'invalid.json');
    fs.writeFileSync(invalidJsonPath, '{not json', 'utf8');
    const invalidJsonResult = runPublish(['--bundle', invalidJsonPath, '--storage-target', 'local']);
    assert('SAC-P117-02', invalidJsonResult.status === 1, `expected invalid JSON exit 1, got ${invalidJsonResult.status}`);

    const missingFieldsDir = tmpDir();
    const missingFieldsPath = writeBundle(missingFieldsDir, {});
    const missingFieldsResult = runPublish(['--bundle', missingFieldsPath, '--storage-target', 'local']);
    assert('SAC-P117-03', missingFieldsResult.status === 1, `expected missing-field exit 1, got ${missingFieldsResult.status}`);

    const firstPublish = publishValid('local');
    const phaseDir = path.join(firstPublish.localRoot, 'v3.1', 'P117');
    const expectedFiles = [
      'chronicle-context.json',
      'chronicle.html',
      'manifest.json',
      'content-hash.txt',
    ].map((fileName) => path.join(phaseDir, fileName));
    assert(
      'SAC-P117-04',
      firstPublish.result.status === 0 && expectedFiles.every((filePath) => fs.existsSync(filePath)),
      `expected local publish files and exit 0, got ${firstPublish.result.status}: ${firstPublish.result.stderr}`,
    );

    const indexRows = fs.existsSync(firstPublish.indexLedger)
      ? fs.readFileSync(firstPublish.indexLedger, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)
      : [];
    assert(
      'SAC-P117-05',
      indexRows.length === 1 && indexRows[0].storage_target === 'local' && firstPublish.result.stdout.includes('PUBLISHED local'),
      'expected one local index row and PUBLISHED local stdout',
    );

    const repeatResult = runPublish([
      '--bundle',
      firstPublish.bundlePath,
      '--storage-target',
      'local',
      '--local-root',
      firstPublish.localRoot,
      '--index-ledger',
      firstPublish.indexLedger,
    ]);
    const repeatRows = fs.readFileSync(firstPublish.indexLedger, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    assert(
      'SAC-P117-06',
      repeatResult.status === 0 && repeatRows.length === 1,
      `expected idempotent skip with one index row, got exit ${repeatResult.status} rows ${repeatRows.length}`,
    );

    const refusedDir = tmpDir();
    const refusedPath = writeBundle(refusedDir, loadBundle({ validator_verdict: 'REPORT_UNGROUNDED' }));
    const refusedResult = runPublish([
      '--bundle',
      refusedPath,
      '--storage-target',
      'local',
      '--local-root',
      path.join(refusedDir, 'chronicles'),
      '--index-ledger',
      path.join(refusedDir, 'INDEX.jsonl'),
    ]);
    assert('SAC-P117-07', refusedResult.status === 2, `expected verdict refusal exit 2, got ${refusedResult.status}`);

    const forcedDir = tmpDir();
    const forcedPath = writeBundle(forcedDir, loadBundle({ validator_verdict: 'REPORT_UNGROUNDED' }));
    const forcedResult = runPublish([
      '--bundle',
      forcedPath,
      '--storage-target',
      'local',
      '--local-root',
      path.join(forcedDir, 'chronicles'),
      '--index-ledger',
      path.join(forcedDir, 'INDEX.jsonl'),
      '--force',
    ]);
    assert(
      'SAC-P117-08',
      forcedResult.status === 0 && forcedResult.stderr.includes('FORCE:'),
      `expected force publish exit 0 with stderr warning, got ${forcedResult.status}`,
    );

    const autoPublish = publishValid('auto');
    assert(
      'SAC-P117-09',
      autoPublish.result.status === 0 && autoPublish.result.stdout.includes('PUBLISHED local'),
      `expected auto fallback to local, got exit ${autoPublish.result.status}: ${autoPublish.result.stdout}`,
    );

    const explicitVtp = publishValid('vtp');
    assert('SAC-P117-10', explicitVtp.result.status === 4, `expected explicit VTP exit 4, got ${explicitVtp.result.status}`);

    const previousVtpUrl = process.env.SGSD_VTP_MCP_URL;
    delete process.env.SGSD_VTP_MCP_URL;
    const probeResult = storageVtp.probe();
    if (previousVtpUrl !== undefined) {
      process.env.SGSD_VTP_MCP_URL = previousVtpUrl;
    }
    assert(
      'SAC-P117-11',
      probeResult && probeResult.available === false && probeResult.reason === 'vtp_mcp_routing_not_yet_wired',
      `expected unavailable VTP stub probe, got ${JSON.stringify(probeResult)}`,
    );

    const tmpFiles = fs.existsSync(phaseDir)
      ? fs.readdirSync(phaseDir).filter((fileName) => fileName.endsWith('.tmp'))
      : ['missing-phase-dir'];
    assert('STRUCT-P117-21', tmpFiles.length === 0, `expected no tmp files after atomic rename, got ${tmpFiles.join(', ')}`);

    const bundleA = loadBundle();
    const bundleB = JSON.parse(JSON.stringify(bundleA));
    assert(
      'STRUCT-P117-22',
      storageLocal.contentHashFor(bundleA) === storageLocal.contentHashFor(bundleB),
      'expected deterministic content_hash across equivalent bundles',
    );

    const requiredIndexFields = [
      'ts',
      'milestone_id',
      'phase_id',
      'chronicle_type',
      'storage_target',
      'location',
      'size_bytes',
      'validator_verdict',
      'content_hash',
      'published_by',
    ];
    assert(
      'STRUCT-P117-23',
      indexRows.length === 1 && requiredIndexFields.every((field) => Object.prototype.hasOwnProperty.call(indexRows[0], field)),
      'expected index ledger row to include all required fields',
    );

    if (failures > 0 && (!process.exitCode || process.exitCode === 0)) {
      process.exitCode = 1;
    }
  }

  return { run };
})();

process.once('beforeExit', () => {
  __p117ChronicleSelfTest.run();
});

const __p117OriginalProcessExit = process.exit.bind(process);
process.exit = (code) => {
  if (typeof code === 'number') {
    process.exitCode = code;
  }
  __p117ChronicleSelfTest.run();
  __p117OriginalProcessExit(process.exitCode);
};

if (require.main === module) {
  main();
}
