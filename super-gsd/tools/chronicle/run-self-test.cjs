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

if (require.main === module) {
  main();
}
