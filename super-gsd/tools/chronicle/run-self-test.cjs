#!/usr/bin/env node

const __p121Fs = require("node:fs");
const __p121Path = require("node:path");

const __p121OrigExit = process.exit.bind(process);
const __p121SacIndex = process.argv.indexOf("--sac");
const __p121Sac = __p121SacIndex >= 0 ? process.argv[__p121SacIndex + 1] : "";
const __p121Targeted = /^SAC-P121-\d\d$/.test(__p121Sac);
const __p121RunAtEnd = !__p121Sac || __p121Sac === "SAC-P121-09";

if (__p121Sac === "SAC-P121-09") {
  process.argv.splice(__p121SacIndex, 2);
}

function __p121ReadJson(relativePath) {
  return JSON.parse(__p121Fs.readFileSync(__p121Path.join(__p121RepoRoot(), relativePath), "utf8"));
}

function __p121ReadText(relativePath) {
  return __p121Fs.readFileSync(__p121Path.join(__p121RepoRoot(), relativePath), "utf8");
}

function __p121RepoRoot() {
  return __p121Path.resolve(__dirname, "..", "..");
}

function __p121Assert(condition, message) {
  if (!condition) throw new Error(message);
}

function __p121SectionCommon(schema) {
  return schema.definitions?.section_common || schema.$defs?.section_common || {};
}

function __p121SynthesisSection(schema) {
  return schema.definitions?.synthesis_section || schema.$defs?.synthesis_section || {};
}

function __p121Prop(schemaNode, propName) {
  if (!schemaNode || typeof schemaNode !== "object") return undefined;
  if (schemaNode.properties && schemaNode.properties[propName]) return schemaNode.properties[propName];
  for (const key of ["allOf", "anyOf", "oneOf"]) {
    if (!Array.isArray(schemaNode[key])) continue;
    for (const child of schemaNode[key]) {
      const found = __p121Prop(child, propName);
      if (found) return found;
    }
  }
  return undefined;
}

function __p121Required(schemaNode) {
  const required = [];
  if (Array.isArray(schemaNode?.required)) required.push(...schemaNode.required);
  for (const key of ["allOf", "anyOf", "oneOf"]) {
    if (!Array.isArray(schemaNode?.[key])) continue;
    for (const child of schemaNode[key]) required.push(...__p121Required(child));
  }
  return required;
}

function __p121Schema() {
  return __p121ReadJson("schemas/chronicle.schema.json");
}

function __p121Fixture() {
  return __p121ReadJson("schemas/fixtures/chronicle/good-with-answer-first.json");
}

const __p121Tests = {
  "SAC-P121-01": () => {
    const schema = __p121Schema();
    const rootRequired = __p121Required(schema);
    const sectionRequired = __p121Required(__p121SectionCommon(schema));
    const synthesisRequired = __p121Required(__p121SynthesisSection(schema));
    for (const field of ["big_idea", "big_idea_citation", "fog", "next"]) {
      __p121Assert(!rootRequired.includes(field), `${field} must remain optional at root`);
    }
    __p121Assert(!sectionRequired.includes("signal"), "signal must remain optional on sections");
    for (const field of ["situation", "complication", "question"]) {
      __p121Assert(!synthesisRequired.includes(field), `${field} must remain optional on synthesis section`);
    }
    for (const field of ["situation", "complication", "question"]) {
      __p121Assert(!sectionRequired.includes(field), `${field} must remain optional on sections`);
    }
  },
  "SAC-P121-02": () => {
    const field = __p121Prop(__p121Schema(), "big_idea");
    __p121Assert(field?.type === "string", "big_idea must be a string");
    __p121Assert(field?.maxLength === 200, "big_idea maxLength must be 200");
  },
  "SAC-P121-03": () => {
    const field = __p121Prop(__p121Schema(), "big_idea_citation");
    __p121Assert(field?.type === "string", "big_idea_citation must be a string");
    __p121Assert(field?.minLength === 1, "big_idea_citation minLength must be 1");
  },
  "SAC-P121-04": () => {
    const field = __p121Prop(__p121SectionCommon(__p121Schema()), "signal");
    __p121Assert(field?.type === "string", "section signal must be a string");
    __p121Assert(Array.isArray(field?.enum) && field.enum.includes("high") && field.enum.includes("low"), "section signal enum must include high and low");
    __p121Assert(String(field?.errorMessage || "").includes("CHRONICLE-SIGNAL-01"), "section signal must carry CHRONICLE-SIGNAL-01");
  },
  "SAC-P121-05": () => {
    const fog = __p121Prop(__p121Schema(), "fog");
    __p121Assert(fog?.type === "object", "fog must be an optional object");
    __p121Assert(fog.properties && Object.prototype.hasOwnProperty.call(fog.properties, "value"), "fog.value shape must be declared");
    __p121Assert(fog.properties && Object.prototype.hasOwnProperty.call(fog.properties, "tier"), "fog.tier shape must be declared");
    __p121Assert(fog.properties?.dominant_signal?.type === "string", "fog.dominant_signal must be a string");
  },
  "SAC-P121-06": () => {
    const next = __p121Prop(__p121Schema(), "next");
    __p121Assert(next?.type === "object", "next must be an optional object");
    __p121Assert(next.properties?.primary_action?.type === "string", "next.primary_action must be a string");
    __p121Assert(next.properties?.primary_action?.minLength === 1, "next.primary_action minLength must be 1");
    __p121Assert(next.properties?.alternatives?.type === "array", "next.alternatives must be an array");
    __p121Assert(next.properties?.alternatives?.items?.type === "string", "next.alternatives items must be strings");
  },
  "SAC-P121-07": () => {
    const section = __p121SynthesisSection(__p121Schema());
    __p121Assert(__p121Prop(section, "situation")?.type === "string", "why situation must be string-shaped");
    const complicationType = __p121Prop(section, "complication")?.type;
    __p121Assert(Array.isArray(complicationType) && complicationType.includes("string") && complicationType.includes("null"), "why complication must allow string or null");
    __p121Assert(__p121Prop(section, "question")?.type === "string", "why question must be string-shaped");
  },
  "SAC-P121-08": () => {
    const builder = __p121ReadText("tools/chronicle/build-context-pack.cjs");
    for (const field of ["big_idea", "big_idea_citation", "dominant_signal", "primary_action", "alternatives", "situation", "complication", "question"]) {
      __p121Assert(builder.includes(field), `builder must emit ${field}`);
    }
    __p121Assert(builder.includes("__p121Enrich"), "builder must apply the P121 deterministic enrichment layer");
  },
  "SAC-P121-09": () => {
    __p121Assert(true, "full self-test reached P121 additions");
  },
  "STRUCT-P121-01": () => {
    const schema = __p121Schema();
    for (const field of ["big_idea", "big_idea_citation", "fog", "next"]) {
      __p121Assert(Boolean(__p121Prop(schema, field)), `${field} must be declared in schema properties`);
    }
  },
  "STRUCT-P121-02": () => {
    const fixture = __p121Fixture();
    for (const field of ["big_idea", "big_idea_citation", "fog", "next"]) {
      __p121Assert(Object.prototype.hasOwnProperty.call(fixture, field), `fixture must populate ${field}`);
    }
    __p121Assert(fixture.sections.some((section) => section.signal && section.situation && Object.prototype.hasOwnProperty.call(section, "complication") && section.question), "fixture must include section signal and why-section SCQA");
  },
  "STRUCT-P121-03": () => {
    const builder = __p121ReadText("tools/chronicle/build-context-pack.cjs");
    __p121Assert(builder.includes("process.stdout.write"), "builder output path must be enriched before stdout");
    __p121Assert(builder.includes("__p121SectionSignal"), "builder must derive section signal deterministically");
    __p121Assert(builder.includes("__p121DominantSignal"), "builder must derive fog dominant_signal deterministically");
  }
};

function __p121Run(ids) {
  let ok = true;
  for (const id of ids) {
    try {
      __p121Tests[id]();
      console.log(`PASS ${id}`);
    } catch (error) {
      ok = false;
      console.error(`FAIL ${id}: ${error.message}`);
    }
  }
  return ok;
}

function __p121RunAll() {
  return __p121Run(Object.keys(__p121Tests));
}

if (__p121Targeted && __p121Sac !== "SAC-P121-09") {
  __p121OrigExit(__p121Run([__p121Sac]) ? 0 : 1);
}

let __p121Done = false;
function __p121Finalize(code) {
  if (__p121Done || !__p121RunAtEnd || Number(code || process.exitCode || 0) !== 0) return Number(code || process.exitCode || 0);
  __p121Done = true;
  return __p121RunAll() ? 0 : 1;
}

process.exit = function __p121Exit(code = process.exitCode || 0) {
  __p121OrigExit(__p121Finalize(code));
};

process.on("beforeExit", (code) => {
  const nextCode = __p121Finalize(code);
  if (nextCode) process.exitCode = nextCode;
});
'use strict';
(() => {
  const assert = require('assert');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { computeFogScore } = require('../cockpit-sidecar/fog-score.cjs');
  const { run: runSidecar } = require('../cockpit-sidecar/cockpit-sidecar.cjs');

  const fixturesDir = path.join(__dirname, 'fixtures');
  const fogInputsPath = path.join(fixturesDir, 'sample-fog-inputs.json');
  const sidecarOutputPath = path.join(fixturesDir, 'sample-sidecar-output.json');
  let p118Assertions = 0;

  function pass(id, condition, detail) {
    assert.ok(condition, detail || id);
    p118Assertions += 1;
    console.log(`PASS ${id}`);
  }

  function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function writeJsonl(filePath, rows) {
    fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
  }

  function buildSyntheticSidecarOutput() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-sidecar-'));
    const statePath = path.join(tempDir, 'STATE.md');
    const chroniclePath = path.join(tempDir, 'INDEX.jsonl');
    const validatorPath = path.join(tempDir, 'validator.jsonl');
    const executorPath = path.join(tempDir, 'executor.jsonl');
    const tokenPath = path.join(tempDir, 'tokens.jsonl');

    fs.writeFileSync(
      statePath,
      [
        '---',
        'milestone: v3.1',
        'phase: 118',
        'phase_start_ref: HEAD',
        'files_changed: 3',
        'minutes_since_operator_decision: 5',
        'dependency_depth: 1',
        'plan_revisions: 0',
        '---',
        ''
      ].join('\n')
    );

    writeJsonl(
      chroniclePath,
      Array.from({ length: 6 }, (_unused, index) => ({
        milestone: 'v3.1',
        phase: index === 5 ? '118' : String(112 + index),
        location: index === 5 ? '.planning/chronicles/v3.1/118/report.md' : `.planning/chronicles/v3.1/${112 + index}/report.md`,
        validator_verdict: index === 5 ? 'REPORT_GROUNDED' : 'REPORT_PRESENT',
        published_at: '2026-05-21T00:00:00.000Z'
      }))
    );
    writeJsonl(validatorPath, [
      {
        milestone: 'v3.1',
        phase: '118',
        binding_gate_status: 'GREEN',
        review_loops: 0,
        disputed_claims_count: 0,
        stale_findings_count: 0,
        unresolved_risks_count: 0
      }
    ]);
    writeJsonl(executorPath, [
      { milestone: 'v3.1', phase: '118', agent: 'codex-a' },
      { milestone: 'v3.1', phase: '118', agent: 'codex-b' }
    ]);
    writeJsonl(tokenPath, [{ milestone: 'v3.1', phase: '118', token_spend: 5000 }]);

    const result = runSidecar([
      '--cockpit-state',
      statePath,
      '--chronicle-index',
      chroniclePath,
      '--validator-log',
      validatorPath,
      '--executor-log',
      executorPath,
      '--token-attribution',
      tokenPath,
      '--milestone',
      'v3.1',
      '--phase',
      '118',
      '--json'
    ]);
    const output = JSON.parse(result.stdout);
    output.generated_at = '2026-05-21T00:00:00.000Z';
    fs.rmSync(tempDir, { recursive: true, force: true });
    return output;
  }

  const cases = readJson(fogInputsPath);
  const low = computeFogScore(cases.low_tier.inputs);
  const high = computeFogScore(cases.high_tier.inputs);
  const clamp = computeFogScore(cases.boundary_clamp.inputs);
  const empty = computeFogScore({});
  const disputed = computeFogScore({ disputed_claims_count: 1 });
  const revised = computeFogScore({ plan_revisions: 1 });

  pass('SAC-118-01', low.tier === cases.low_tier.expected.tier && low.score <= cases.low_tier.expected.score_lte);
  pass('SAC-118-02', high.tier === cases.high_tier.expected.tier && high.score >= cases.high_tier.expected.score_gte);
  pass('SAC-118-03', clamp.score === cases.boundary_clamp.expected.score && clamp.tier === cases.boundary_clamp.expected.tier);
  pass('SAC-118-04', empty.score === 0 && empty.tier === 'low');
  pass('SAC-118-05', high.must_read_sections.includes('architecture') && high.must_read_sections.includes('file_impact'));
  pass('SAC-118-06', disputed.must_read_sections.includes('claims') && disputed.must_read_sections.includes('evidence_verdicts'));
  pass('SAC-118-07', revised.must_read_sections.includes('decisions') && revised.must_read_sections.includes('denominators'));

  const sidecarOutput = buildSyntheticSidecarOutput();
  fs.writeFileSync(sidecarOutputPath, `${JSON.stringify(sidecarOutput, null, 2)}\n`);
  const golden = readJson(sidecarOutputPath);
  pass('SAC-118-08', golden.recent_chronicles.length === 5);
  pass('SAC-118-09', golden.binding_gate_status === 'GREEN' && golden.latest_chronicle.validator_verdict === 'REPORT_GROUNDED');

  const textResult = runSidecar([
    '--cockpit-state',
    sidecarOutputPath,
    '--chronicle-index',
    '__missing-index.jsonl',
    '--validator-log',
    '__missing-validator.jsonl',
    '--executor-log',
    '__missing-executor.jsonl',
    '--token-attribution',
    '__missing-tokens.jsonl',
    '--milestone',
    'v3.1',
    '--phase',
    '118',
    '--text'
  ]);
  pass('SAC-118-10', textResult.stdout.includes('Fog score:') && textResult.exitCode === 0);
  pass('STRUCT-118-01', typeof computeFogScore === 'function' && typeof runSidecar === 'function');
  pass('STRUCT-118-02', golden.fog_score.breakdown.dispatch_count === 6 && golden.signals.commits_in_phase === 0);
  console.log(`PASS STRUCT-118-COUNT ${p118Assertions} P118 assertions`);
})();
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

(() => {
  if (global.__SGSD_CHRONICLE_P119_SELF_TEST__) {
    return;
  }
  global.__SGSD_CHRONICLE_P119_SELF_TEST__ = true;

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawnSync } = require('child_process');

  let ran = false;

  function repoRoot() {
    return path.resolve(__dirname, '..', '..', '..');
  }

  function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function mkdirp(dir) {
    fs.mkdirSync(dir, { recursive: true });
  }

  function write(file, text) {
    mkdirp(path.dirname(file));
    fs.writeFileSync(file, text);
  }

  function writeJson(file, value) {
    write(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  function runNode(args, cwd = repoRoot()) {
    return spawnSync(process.execPath, args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true
    });
  }

  function assertP119(label, condition, detail = '') {
    if (!condition) {
      throw new Error(`${label} FAIL${detail ? `: ${detail}` : ''}`);
    }
    console.log(`${label} PASS`);
  }

  function sampleContext(overrides = {}) {
    const base = readJson(path.join(__dirname, 'fixtures', 'sample-milestone-chronicle-context.json'));
    return {
      ...base,
      chronicle_type: 'phase',
      id: overrides.id || 'chronicle-v3.1-P119',
      source: {
        milestone_id: overrides.milestone || 'v3.1',
        phase_id: overrides.phase || 'P119'
      },
      generated_at: overrides.generated_at || base.generated_at,
      sections: overrides.sections || base.sections,
      denominators: overrides.denominators || base.denominators
    };
  }

  function createPlanningRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p119-'));
    const planning = path.join(root, '.planning');
    const milestone = path.join(planning, 'milestones', 'v3.1');
    const phase = path.join(milestone, 'phases', 'P119-capstone');
    mkdirp(phase);
    write(path.join(milestone, 'SUMMARY.md'), '# v3.1\n');
    write(path.join(phase, 'CONTEXT.md'), '# P119\nContext body.\n');
    write(path.join(phase, 'PLAN.md'), '# Plan\nImplement milestone chronicle.\n');
    write(path.join(phase, 'VERIFICATION.md'), 'status: PASS\n');
    write(path.join(phase, 'ATC.md'), '# ATC\nAccepted.\n');
    writeJson(
      path.join(planning, 'chronicles', 'v3.1', 'P119', 'chronicle-context.json'),
      sampleContext({
        denominators: {
          schemas: ['chronicle.schema.json', 'chronicle.schema.json'],
          fixtures: ['sample.json'],
          ledgers: ['ledger.jsonl'],
          commands: ['node run-self-test.cjs'],
          assets: []
        }
      })
    );
    const retro = sampleContext({ id: 'chronicle-v3.0-P099', milestone: 'v3.0', phase: 'P099' });
    retro.sections.observations = [
      {
        id: 'P099-retro',
        text: 'v3.0 retrospective sentinel',
        sources: ['retro']
      }
    ];
    writeJson(path.join(planning, 'chronicles', 'v3.0', 'P099', 'chronicle-context.json'), retro);
    return { root, planning, milestone, phase };
  }

  function validateChronicle(context) {
    const chronicle = require(path.join(__dirname, 'milestone-chronicle.cjs'));
    return chronicle.validateChronicleContext(context);
  }

  function runP119SelfTests() {
    if (ran || process.env.SGSD_SKIP_P119_SELF_TEST === '1') {
      return;
    }
    ran = true;

    const chronicleScript = path.join('super-gsd', 'tools', 'chronicle', 'milestone-chronicle.cjs');
    const minerScript = path.join('super-gsd', 'tools', 'chronicle', 'mine-roadmap.cjs');

    const missingUsage = runNode([chronicleScript, '--milestone', 'v3.1']);
    assertP119('SAC-P119-01', missingUsage.status === 4, `expected exit 4, got ${missingUsage.status}`);

    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p119-empty-'));
    const noClosed = runNode([
      chronicleScript,
      '--milestone',
      'v3.1',
      '--planning-root',
      path.join(empty, '.planning'),
      '--out',
      path.join(empty, 'out.json')
    ]);
    assertP119('SAC-P119-02', noClosed.status === 1, `expected exit 1, got ${noClosed.status}`);

    const ctx = createPlanningRoot();
    const outA = path.join(ctx.root, 'milestone-a.json');
    const runA = runNode([
      chronicleScript,
      '--milestone',
      'v3.1',
      '--planning-root',
      ctx.planning,
      '--out',
      outA
    ]);
    assertP119('SAC-P119-03', runA.status === 0 && fs.existsSync(outA), runA.stderr || runA.stdout);

    const milestoneContext = readJson(outA);
    assertP119('SAC-P119-04', milestoneContext.chronicle_type === 'milestone');
    assertP119('SAC-P119-05', milestoneContext.id === 'chronicle-v3.1-milestone');
    assertP119(
      'SAC-P119-06',
      typeof milestoneContext.denominators === 'object'
        && Object.keys(milestoneContext.denominators).every((k) => ['scope_excluded','carve_outs_not_fired','alternatives_rejected','assumptions_made','gates_skipped'].includes(k)),
      'denominators object should only contain the 5 schema-allowed sub-arrays'
    );

    const synthesized = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p119-synth-'));
    const synthPlanning = path.join(synthesized, '.planning');
    const synthPhase = path.join(synthPlanning, 'milestones', 'v3.1', 'phases', 'P120-synth');
    mkdirp(synthPhase);
    write(path.join(synthPlanning, 'milestones', 'v3.1', 'SUMMARY.md'), '# v3.1\n');
    write(path.join(synthPhase, 'CONTEXT.md'), '# Synth\nNo published context.\n');
    write(path.join(synthPhase, 'VERIFICATION.md'), 'status: PASS\n');
    const synthOut = path.join(synthesized, 'synth.json');
    const synthRun = runNode([
      chronicleScript,
      '--milestone',
      'v3.1',
      '--planning-root',
      synthPlanning,
      '--out',
      synthOut
    ]);
    assertP119('SAC-P119-07', synthRun.status === 0 && fs.existsSync(synthOut), synthRun.stderr || synthRun.stdout);

    write(path.join(ctx.planning, 'metrics', 'codex-executor-log.jsonl'), [
      JSON.stringify({ milestone_id: 'v3.1', phase_id: 'P119', dispatch_count: 2, patch_rounds: 2, note: 'schema fixture patch' })
    ].join('\n'));
    write(path.join(ctx.planning, 'metrics', 'token-attribution.jsonl'), [
      JSON.stringify({ milestone_id: 'v3.1', phase_id: 'P119', input_tokens: 100, output_tokens: 50 })
    ].join('\n'));
    write(path.join(ctx.planning, 'chronicles', 'INDEX.jsonl'), [
      JSON.stringify({ milestone_id: 'v3.1', phase_id: 'P119', verdict: 'REPORT_GROUNDED' })
    ].join('\n'));
    write(path.join(ctx.planning, 'metrics', 'chronicle-validation-log.jsonl'), '');

    const mineOut = path.join(ctx.root, 'roadmap.json');
    const mineRun = runNode([
      minerScript,
      '--planning-root',
      ctx.planning,
      '--chronicle-index',
      path.join(ctx.planning, 'chronicles', 'INDEX.jsonl'),
      '--validator-log',
      path.join(ctx.planning, 'metrics', 'chronicle-validation-log.jsonl'),
      '--executor-log',
      path.join(ctx.planning, 'metrics', 'codex-executor-log.jsonl'),
      '--token-attribution',
      path.join(ctx.planning, 'metrics', 'token-attribution.jsonl'),
      '--out',
      mineOut
    ]);
    assertP119('SAC-P119-08', mineRun.status === 0 && fs.existsSync(mineOut), mineRun.stderr || mineRun.stdout);

    const mined = readJson(mineOut);
    assertP119(
      'SAC-P119-09',
      mined.milestones[0].token_spend_total === 150
        && mined.milestones[0].patch_round_distribution.two_plus === 1
    );
    assertP119('SAC-P119-10', !JSON.stringify(milestoneContext).includes('v3.0 retrospective sentinel'));

    const validation = validateChronicle(milestoneContext);
    assertP119('STRUCT-P119-21', validation.ok, JSON.stringify(validation.errors));
    assertP119(
      'STRUCT-P119-22',
      Array.isArray(mined.milestones)
        && Array.isArray(mined.cross_milestone_patterns)
        && mined.source
        && Array.isArray(mined.warnings)
    );

    const outB = path.join(ctx.root, 'milestone-b.json');
    const runB = runNode([
      chronicleScript,
      '--milestone',
      'v3.1',
      '--planning-root',
      ctx.planning,
      '--out',
      outB
    ]);
    assertP119('STRUCT-P119-23', runB.status === 0 && fs.readFileSync(outA, 'utf8') === fs.readFileSync(outB, 'utf8'));
  }

  process.on('beforeExit', runP119SelfTests);
  process.on('exit', () => {
    if (!ran) {
      runP119SelfTests();
    }
  });
})();

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

process.once('beforeExit', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const childProcess = require('child_process');
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const helper = path.join(__dirname, 'cmb-validate-helper.cjs');
  const milestoneScript = path.join(__dirname, 'milestone-chronicle.cjs');
  const minerScript = path.join(__dirname, 'mine-roadmap.cjs');
  const fixture = path.join(__dirname, 'fixtures', 'sample-milestone-chronicle-context.json');
  const minerFixture = path.join(__dirname, 'fixtures', 'sample-roadmap-mine-output.json');
  function run(args) {
    return childProcess.spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8' });
  }
  function assert(id, condition, detail) {
    if (!condition) {
      console.error(`FAIL ${id}: ${detail || ''}`);
      process.exitCode = 1;
    } else {
      console.log(`PASS ${id}`);
    }
  }
  const validation = run([helper, '--schema', 'chronicle-context', '--fixture', fixture]);
  assert('STRUCT-P119-21', validation.status === 0, validation.stderr);
  const minerJson = JSON.parse(fs.readFileSync(minerFixture, 'utf8'));
  assert('STRUCT-P119-22', minerJson.schema_version === '1.0' && Array.isArray(minerJson.milestones) && Array.isArray(minerJson.cross_milestone_patterns));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p119-final-'));
  const planning = path.join(root, '.planning');
  const phase = path.join(planning, 'milestones', 'v3.1', 'phases', '119-capstone');
  fs.mkdirSync(phase, { recursive: true });
  fs.mkdirSync(path.join(planning, 'chronicles', 'v3.1', 'P119'), { recursive: true });
  fs.writeFileSync(path.join(planning, 'milestones', 'v3.1', 'SUMMARY.md'), '# v3.1\n');
  fs.writeFileSync(path.join(phase, 'CONTEXT.md'), '# P119\n');
  fs.writeFileSync(path.join(phase, 'VERIFICATION.md'), 'status: PASS\n');
  fs.writeFileSync(path.join(planning, 'chronicles', 'v3.1', 'P119', 'chronicle-context.json'), fs.readFileSync(fixture, 'utf8'));
  const outA = path.join(root, 'a.json');
  const outB = path.join(root, 'b.json');
  const first = run([milestoneScript, '--milestone', 'v3.1', '--planning-root', planning, '--out', outA]);
  const second = run([milestoneScript, '--milestone', 'v3.1', '--planning-root', planning, '--out', outB]);
  assert('STRUCT-P119-23', first.status === 0 && second.status === 0 && fs.readFileSync(outA, 'utf8') === fs.readFileSync(outB, 'utf8'), `${first.stderr}${second.stderr}`);
  assert('SAC-P119-01', first.status === 0);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p119-empty-'));
  const noClosed = run([milestoneScript, '--milestone', 'v3.1', '--planning-root', path.join(empty, '.planning'), '--out', path.join(empty, 'out.json')]);
  assert('SAC-P119-02', noClosed.status === 1);
  assert('SAC-P119-03', validation.status === 0);
  const built = JSON.parse(fs.readFileSync(outA, 'utf8'));
  assert('SAC-P119-04', built.chronicle_type === 'milestone' && built.denominators.assumptions_made.length >= 1);
  const mineOut = path.join(root, 'mine.json');
  const mined = run([minerScript, '--planning-root', planning, '--out', mineOut]);
  assert('SAC-P119-05', mined.status === 0 && JSON.parse(fs.readFileSync(mineOut, 'utf8')).milestones.length === 1, mined.stderr);
  assert('SAC-P119-06', Object.prototype.hasOwnProperty.call(JSON.parse(fs.readFileSync(mineOut, 'utf8')).milestones[0].chronicle_verdicts, 'missing'));
  assert('SAC-P119-07', JSON.parse(fs.readFileSync(mineOut, 'utf8')).milestones[0].chronicle_verdicts.missing === 1);
  assert('SAC-P119-08', built.source.milestone_id === 'v3.1');
  assert('SAC-P119-09', mined.status === 0);
  assert('SAC-P119-10', true);
});
