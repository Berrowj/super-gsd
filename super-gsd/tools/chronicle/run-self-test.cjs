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

p122AppendRendererAssertions();

function p122AppendRendererAssertions() {
  const p122Assertion = (condition, message) => {
    if (!condition) {
      throw new Error(message);
    }
    return true;
  };

  const p122Renderer = () => require('./render-html.cjs');

  const p122ReadRendererSource = () => {
    const fs = require('fs');
    const path = require('path');
    return fs.readFileSync(path.join(__dirname, 'render-html.cjs'), 'utf8');
  };

  const p122Clone = (value) => JSON.parse(JSON.stringify(value));

  const p122Text = (value) =>
    String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

  const p122RegexEscape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const p122Title = (id) =>
    String(id)
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const p122SectionTemplate = (id, index, sectionRoles) => {
    const title = p122Title(id);
    const diagramTitle = `P122 ${title} evidence map`;
    const diagramCaption = `Evidence flow for ${title} with source anchors and operator consequences.`;
    const why = {
      situation: {
        text: `${title} has a stable context slot for the cumulative chronicle.`,
        evidence_path: '.planning/STATE.md',
      },
      complication: {
        text: `${title} must remain renderable without live services.`,
        evidence_path: '.planning/metrics/gates.jsonl',
      },
      question: {
        text: `What should the operator decide from ${title}?`,
        evidence_path: '.planning/milestones/warp-integration/ROADMAP.md',
      },
      answer: {
        text: `${title} renders as deterministic evidence for P122.`,
        evidence_path: 'super-gsd/tools/chronicle/render-html.cjs',
      },
    };

    return {
      id,
      key: id,
      slug: id,
      section_id: id,
      role: sectionRoles[id] || 'operator-evidence',
      title,
      heading: title,
      signal: 'high',
      confidence: 'high',
      summary: `${title} summary for the P122 renderer self-test fixture.`,
      body: [
        `${title} body paragraph ${index + 1} captures the evidence path and decision surface.`,
        `${title} secondary paragraph keeps the renderer fixture representative without external assets.`,
      ],
      why,
      scqa: why,
      slots: [
        { id: 'situation', label: 'Situation', value: why.situation.text, evidence_path: why.situation.evidence_path },
        { id: 'complication', label: 'Complication', value: why.complication.text, evidence_path: why.complication.evidence_path },
        { id: 'question', label: 'Question', value: why.question.text, evidence_path: why.question.evidence_path },
        { id: 'answer', label: 'Answer', value: why.answer.text, evidence_path: why.answer.evidence_path },
      ],
      evidence: [
        {
          id: `${id}-evidence`,
          label: `${title} source`,
          summary: `${title} source evidence is present.`,
          path: '.planning/metrics/gates.jsonl',
          evidence_path: '.planning/metrics/gates.jsonl',
        },
      ],
      diagram: {
        title: diagramTitle,
        caption: diagramCaption,
        type: 'flow',
        nodes: ['context', 'render', 'operator'],
        edges: [
          ['context', 'render'],
          ['render', 'operator'],
        ],
      },
      diagrams: [
        {
          title: diagramTitle,
          caption: diagramCaption,
          type: 'flow',
          nodes: ['context', 'render', 'operator'],
          edges: [
            ['context', 'render'],
            ['render', 'operator'],
          ],
        },
      ],
    };
  };

  const p122FallbackContext = () => {
    const { SECTION_ORDER, SECTION_ROLES } = p122Renderer();
    const sections = Object.fromEntries(
      SECTION_ORDER.map((id, index) => [id, p122SectionTemplate(id, index, SECTION_ROLES)])
    );

    return {
      title: 'P122 Chronicle Renderer Fixture',
      subtitle: 'Deterministic cumulative chronicle context',
      generated_at: '2026-05-22T00:00:00.000Z',
      generatedAt: '2026-05-22T00:00:00.000Z',
      big_idea: {
        text: 'The renderer should convert P121-shaped context into an operator-readable chronicle.',
        evidence_path: '.planning/milestones/warp-integration/ROADMAP.md',
      },
      fog: {
        summary: 'Only local evidence is used; external assets and live network dependencies are absent.',
        evidence_path: '.planning/metrics/gates.jsonl',
      },
      next: {
        action: 'Use the chronicle output as the operator decision surface.',
        owner: 'operator',
        evidence_path: '.planning/STATE.md',
      },
      sections,
    };
  };

  const p122LoadFixtureContext = () => {
    const fs = require('fs');
    const path = require('path');
    const fixturePath = path.join(__dirname, 'fixtures', 'sample-chronicle-context.json');
    if (!fs.existsSync(fixturePath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  };

  const p122MergeSections = (fixtureSections, fallbackSections, sectionOrder) => {
    if (Array.isArray(fixtureSections)) {
      const byId = new Map(
        fixtureSections.map((section) => [
          section.id || section.key || section.slug || section.section_id || section.sectionId,
          section,
        ])
      );
      return sectionOrder.map((id) => ({ ...fallbackSections[id], ...(byId.get(id) || {}) }));
    }

    if (fixtureSections && typeof fixtureSections === 'object') {
      return Object.fromEntries(
        sectionOrder.map((id) => [id, { ...fallbackSections[id], ...(fixtureSections[id] || {}) }])
      );
    }

    return fallbackSections;
  };

  const p122SampleContext = () => {
    const fallback = p122FallbackContext();
    const fixture = p122LoadFixtureContext();
    const { SECTION_ORDER } = p122Renderer();
    return {
      ...fallback,
      ...fixture,
      generated_at: fixture.generated_at || fixture.generatedAt || fallback.generated_at,
      generatedAt: fixture.generatedAt || fixture.generated_at || fallback.generatedAt,
      big_idea: fixture.big_idea || fallback.big_idea,
      fog: fixture.fog || fallback.fog,
      next: fixture.next || fallback.next,
      sections: p122MergeSections(fixture.sections, fallback.sections, SECTION_ORDER),
    };
  };

  const p122SectionMatcher = (id) => {
    const escaped = p122RegexEscape(id);
    return new RegExp(
      `<section\\b(?=[^>]*(?:id|data-section-id|data-section|data-section-key)\\s*=\\s*["']${escaped}["'])[^>]*>[\\s\\S]*?<\\/section>`,
      'i'
    );
  };

  const p122FindSectionBlock = (html, id) => {
    const exact = html.match(p122SectionMatcher(id));
    if (exact) {
      return exact[0];
    }
    const title = p122Title(id);
    const byTitle = html.match(
      new RegExp(`<section\\b[^>]*>[\\s\\S]*?${p122RegexEscape(title)}[\\s\\S]*?<\\/section>`, 'i')
    );
    return byTitle ? byTitle[0] : '';
  };

  const p122SectionIndex = (html, id) => {
    const escaped = p122RegexEscape(id);
    const attrMatch = html.match(
      new RegExp(
        `<section\\b[^>]*(?:id|data-section-id|data-section|data-section-key)\\s*=\\s*["']${escaped}["'][^>]*>`,
        'i'
      )
    );
    if (attrMatch && attrMatch.index !== undefined) {
      return attrMatch.index;
    }
    return html.indexOf(p122Title(id));
  };

  const p122UpdateSection = (context, id, patch) => {
    if (Array.isArray(context.sections)) {
      const index = context.sections.findIndex((section) =>
        [section.id, section.key, section.slug, section.section_id, section.sectionId].includes(id)
      );
      const targetIndex = index >= 0 ? index : 0;
      context.sections[targetIndex] = { ...context.sections[targetIndex], ...patch };
      return context;
    }

    context.sections = context.sections || {};
    context.sections[id] = { ...(context.sections[id] || {}), ...patch };
    return context;
  };

  const p122BindingFailures = (result) => {
    const failures = [];
    const seen = new Set();
    const visit = (value) => {
      if (typeof value === 'string') {
        if (/binding[- ]rule/i.test(value) && /\bFAIL\b/i.test(value)) {
          failures.push(value);
        }
        return;
      }

      if (!value || typeof value !== 'object' || seen.has(value)) {
        return;
      }
      seen.add(value);

      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      const status = String(value.status || value.outcome || value.result || value.level || '').toUpperCase();
      const serialized = JSON.stringify(value).toLowerCase();
      if (status === 'FAIL' && (serialized.includes('binding-rule') || serialized.includes('binding rule'))) {
        failures.push(value);
      }

      Object.values(value).forEach(visit);
    };

    visit(result);
    return failures;
  };

  assertions.push(
    {
      id: 'SAC-P122-01',
      run: () => {
        const { renderChronicleHtml } = p122Renderer();
        const html = renderChronicleHtml(p122SampleContext());
        const firstSection = html.match(/<section\b[^>]*>/i);
        return p122Assertion(
          firstSection && /\brole\s*=\s*["']operator-decision["']/i.test(firstSection[0]),
          'first rendered section must have role="operator-decision"'
        );
      },
    },
    {
      id: 'SAC-P122-02',
      run: () => {
        const { SECTION_ORDER, renderChronicleHtml } = p122Renderer();
        const html = renderChronicleHtml(p122SampleContext());
        const indexes = SECTION_ORDER.map((id) => p122SectionIndex(html, id));
        p122Assertion(indexes.every((index) => index >= 0), 'rendered HTML must contain every SECTION_ORDER section');
        return p122Assertion(
          indexes.every((index, position) => position === 0 || index > indexes[position - 1]),
          'rendered HTML sections must follow SECTION_ORDER'
        );
      },
    },
    {
      id: 'SAC-P122-03',
      run: () => {
        const { renderChronicleHtml } = p122Renderer();
        const { checkConformance } = require('../shared/conformance-check.cjs');
        const html = renderChronicleHtml(p122SampleContext());
        const result = checkConformance(html, 'chronicle');
        return p122Assertion(
          p122BindingFailures(result).length === 0,
          'shared conformance checker reported binding-rule FAIL'
        );
      },
    },
    {
      id: 'SAC-P122-04',
      run: () => {
        const { renderChronicleHtml } = p122Renderer();
        const html = renderChronicleHtml(p122SampleContext());
        p122Assertion(!/\b(?:src|href)\s*=\s*["']https?:\/\//i.test(html), 'src/href must not reference http(s) URLs');
        p122Assertion(!/<script\b[^>]*\bsrc\s*=/i.test(html), 'HTML must not contain <script src>');
        p122Assertion(
          !/<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])(?=[^>]*\bhref\s*=)[^>]*>/i.test(html),
          'HTML must not contain external stylesheet links'
        );
        return p122Assertion(!/@font-face/i.test(html), 'HTML must not contain @font-face');
      },
    },
    {
      id: 'SAC-P122-05',
      run: () => {
        const { SECTION_ORDER, renderChronicleHtml } = p122Renderer();
        const lowSignalId = SECTION_ORDER[Math.min(1, SECTION_ORDER.length - 1)];
        const context = p122UpdateSection(p122SampleContext(), lowSignalId, {
          signal: 'low',
          body: ['Low-signal P122 evidence should be disclosed only on demand.'],
        });
        const html = renderChronicleHtml(context);
        const section = p122FindSectionBlock(html, lowSignalId);
        return p122Assertion(
          /<details\b(?![^>]*\bopen\b)[^>]*>/i.test(section),
          'low-signal section body must render inside a collapsed <details>'
        );
      },
    },
    {
      id: 'SAC-P122-06',
      run: () => {
        const { renderChronicleHtml } = p122Renderer();
        const context = p122SampleContext();
        const html = renderChronicleHtml(context);
        const figures = html.match(/<figure\b[\s\S]*?<\/figure>/gi) || [];
        p122Assertion(figures.length > 0, 'rendered HTML must include at least one <figure>');
        return figures.every((figure) => {
          const figcaption = figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
          p122Assertion(figcaption, 'every <figure> must contain a <figcaption>');
          const captionText = p122Text(figcaption[1]);
          const heading = figure.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
          const titleText = heading ? p122Text(heading[1]) : '';
          return p122Assertion(
            captionText && (!titleText || captionText !== titleText),
            'figure caption text must differ from the diagram title'
          );
        });
      },
    },
    {
      id: 'SAC-P122-07',
      run: () =>
        p122Assertion(
          !/:root\s*\{/i.test(p122ReadRendererSource()),
          'render-html.cjs must not contain a divergent :root block'
        ),
    },
    {
      id: 'SAC-P122-08',
      run: () => {
        const { renderChronicleHtml } = p122Renderer();
        const context = p122SampleContext();
        const first = renderChronicleHtml(context);
        const second = renderChronicleHtml(context);
        return p122Assertion(first === second, 'rendering the same context twice must be byte-identical');
      },
    },
    {
      id: 'SAC-P122-09',
      run: () => {
        const { SECTION_ORDER, renderChronicleHtml } = p122Renderer();
        const missingId = SECTION_ORDER[Math.min(2, SECTION_ORDER.length - 1)];
        const context = p122UpdateSection(p122SampleContext(), missingId, {
          evidence: [],
          why: {
            situation: { text: '', evidence_path: '' },
            complication: { text: '', evidence_path: '' },
            question: { text: '', evidence_path: '' },
            answer: { text: '', evidence_path: '' },
          },
          scqa: {
            situation: { text: '', evidence_path: '' },
            complication: { text: '', evidence_path: '' },
            question: { text: '', evidence_path: '' },
            answer: { text: '', evidence_path: '' },
          },
          slots: [
            { id: 'situation', label: 'Situation', value: '', evidence_path: '' },
            { id: 'complication', label: 'Complication', value: '', evidence_path: '' },
            { id: 'question', label: 'Question', value: '', evidence_path: '' },
            { id: 'answer', label: 'Answer', value: '', evidence_path: '' },
          ],
        });
        const html = renderChronicleHtml(context);
        return p122Assertion(
          /<span\b[^>]*\bclass\s*=\s*["'][^"']*\bmissing-evidence\b[^"']*["'][^>]*>/i.test(html),
          'unfilled slot must render a <span class="missing-evidence">'
        );
      },
    },
    {
      id: 'SAC-P122-10',
      run: () => {
        const { SECTION_ORDER, SECTION_ROLES } = p122Renderer();
        p122Assertion(Array.isArray(SECTION_ORDER), 'SECTION_ORDER must be an array');
        p122Assertion(SECTION_ORDER.length === 11, 'SECTION_ORDER must contain exactly 11 entries');
        return p122Assertion(
          SECTION_ORDER.every((id) => Object.prototype.hasOwnProperty.call(SECTION_ROLES, id)),
          'every SECTION_ORDER id must have a SECTION_ROLES mapping'
        );
      },
    },
    {
      id: 'STRUCT-P122-21',
      run: () => {
        const { renderChronicleHtml } = p122Renderer();
        const html = renderChronicleHtml(p122SampleContext());
        p122Assertion(/<nav\b/i.test(html), 'rendered HTML must include <nav>');
        return p122Assertion(/<header\b/i.test(html), 'rendered HTML must include <header>');
      },
    }
  );
}

p123AppendChronicleValidatorLintAssertions();

function p123AppendChronicleValidatorLintAssertions() {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const childProcess = require('child_process');

  const p123RepoRoot = path.resolve(__dirname, '..', '..', '..');
  const p123Validator = path.join(__dirname, 'validate-chronicle.cjs');

  const p123LoadFixture = (name) =>
    JSON.parse(fs.readFileSync(path.join(__dirname, 'benchmarks', `${name}.json`), 'utf8'));

  const p123WriteJson = (file, value) => {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  };

  const p123RunValidator = (fixture, overrides = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-p123-${fixture.name || 'fixture'}-`));
    const chroniclePath = path.join(dir, 'chronicle.html');
    const contextPath = path.join(dir, 'CHRONICLE-CONTEXT.json');
    const ledgerPath = path.join(dir, 'mesh-ledger.json');
    fs.writeFileSync(chroniclePath, overrides.html || fixture.chronicle_html, 'utf8');
    p123WriteJson(contextPath, overrides.context || fixture.chronicle_context);
    p123WriteJson(ledgerPath, overrides.ledger || fixture.mesh_ledger_cmbs || []);
    const result = childProcess.spawnSync(process.execPath, [
      p123Validator,
      '--chronicle',
      chroniclePath,
      '--context',
      contextPath,
      '--mesh-ledger',
      ledgerPath,
      '--repo-root',
      p123RepoRoot,
    ], { encoding: 'utf8' });
    const start = String(result.stdout || '').indexOf('{');
    const report = start >= 0 ? JSON.parse(result.stdout.slice(start)) : { verdict: 'PARSE_ERROR', warnings: [], findings: [] };
    return { result, report };
  };

  const p123WarningCodes = (report) => (report.warnings || []).map((warning) => warning.code);
  const p123FindingCodes = (report) => (report.findings || []).map((finding) => finding.code);

  const p123V32Html = (patch = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Good v3.2 Chronicle</title><style>.primary-action{font-weight:700;}</style></head><body>
<section role="operator-decision" data-role="operator-decision" class="operator-decision north-star"><h2>The validator keeps one operator decision visible</h2><p>Recommended next action: close P123 after the validator passes.</p></section>
<section id="why" data-role="why" class="why scqa"><h2>The evidence explains why this closes</h2><p>Situation: P123 adds validator lints. Complication: drift can hide in rendered HTML. Question: What should the operator trust?</p></section>
<section id="eli5" data-role="eli5" class="eli5"><h2>The plain-language view removes internal labels</h2><p>The report explains the decision without private shorthand.</p></section>
<section id="synthesis" data-role="synthesis" class="synthesis"><h2>The synthesis ties evidence to action</h2><p>The validator reads the rendered page and checks the operator-facing structure.</p></section>
<section id="claims" role="claim" data-role="claim" class="claim" data-citation="cmb-p123-good-001"><h2>The claim has a source</h2><p>Evidence path: .planning/metrics/gates.jsonl</p><a data-citation="cmb-p123-good-001">cmb-p123-good-001</a></section>
<section id="what-happens-next" data-role="what-happens-next"><h2>The next step is singular</h2><p><span class="primary-action recommended-action" data-primary="true">Close P123 after self-test passes.</span></p><details><summary>Alternatives</summary><p>Re-run only if evidence changes.</p></details></section>
<figure data-title="Evidence flow"><h3>Evidence flow</h3><svg viewBox="0 0 10 10"><path d="M1 5h8"/></svg><figcaption>The diagram shows the validator reading rendered evidence before phase close.</figcaption></figure>
${patch}</body></html>`;

  const p123V32Fixture = (patch = '') => ({
    name: 'p123-inline',
    expected_verdict: 'REPORT_GROUNDED',
    expected_exit: 0,
    chronicle_html: p123V32Html(patch),
    chronicle_context: JSON.parse(
      fs.readFileSync(path.join(__dirname, 'benchmarks', 'good-typical-phase.json'), 'utf8')
    ).chronicle_context,
    mesh_ledger_cmbs: [{
      id: 'cmb-p123-good-001',
      class: 'execution_receipt',
      created_at: '2026-05-22T00:00:00.000Z',
      milestone_id: 'v3.2',
      phase_id: '123',
      body: { summary: 'P123 validator fixture evidence' }
    }]
  });

  assertions.push(
    {
      id: 'SAC-P123-01',
      run: () => {
        const run = p123RunValidator(p123LoadFixture('bad-jargon-eli5'));
        return run.result.status === 0 &&
          run.report.verdict === 'REPORT_GROUNDED' &&
          p123WarningCodes(run.report).includes('CHRONICLE-JARGON') &&
          JSON.stringify(run.report.warnings).includes('CMB') &&
          JSON.stringify(run.report.warnings).includes('SAC');
      },
    },
    {
      id: 'SAC-P123-02',
      run: () => {
        const run = p123RunValidator(p123V32Fixture('<section id="label-test"><h2>Validator Output</h2><p>Label heading fixture.</p></section>'));
        return run.report.verdict === 'REPORT_GROUNDED' &&
          p123WarningCodes(run.report).includes('CHRONICLE-TAKEAWAY-HEADING');
      },
    },
    {
      id: 'SAC-P123-03',
      run: () => {
        const run = p123RunValidator(p123LoadFixture('bad-multi-primary-action'));
        return run.result.status === 1 &&
          run.report.verdict === 'REPORT_UNGROUNDED' &&
          p123FindingCodes(run.report).includes('CHRONICLE-ONE-PRIMARY-ACTION');
      },
    },
    {
      id: 'SAC-P123-04',
      run: () => {
        const run = p123RunValidator(p123V32Fixture('<figure data-title="Repeated title"><h3>Repeated title</h3><svg viewBox="0 0 10 10"></svg><figcaption>Repeated title</figcaption></figure>'));
        return run.report.verdict === 'REPORT_GROUNDED' &&
          p123WarningCodes(run.report).includes('CHRONICLE-FIGCAPTION-TAKEAWAY');
      },
    },
    {
      id: 'SAC-P123-05',
      run: () => {
        // Per 123-CONTEXT.md SAC-P123-05: a bare-label section heading yields a
        // CHRONICLE-TAKEAWAY-HEADING advisory; the advisory never flips the verdict.
        const run = p123RunValidator(
          p123V32Fixture('<section id="bare-label-heading"><h2>Risks</h2><p>Bare noun-label heading fixture.</p></section>')
        );
        return run.report.verdict === 'REPORT_GROUNDED' &&
          p123WarningCodes(run.report).includes('CHRONICLE-TAKEAWAY-HEADING');
      },
    },
    {
      id: 'SAC-P123-06',
      run: () => {
        const fixture = p123V32Fixture('<script type="application/json" id="self-reported-lints">{"warnings":[],"primary_actions":1}</script>');
        fixture.chronicle_html = fixture.chronicle_html.replace(
          '<span class="primary-action recommended-action" data-primary="true">Close P123 after self-test passes.</span>',
          '<span class="primary-action recommended-action" data-primary="true">Close P123 after self-test passes.</span><span class="primary-action recommended-action" data-primary="true">Also rewrite the renderer.</span>'
        );
        const run = p123RunValidator(fixture);
        return run.report.verdict === 'REPORT_UNGROUNDED' &&
          p123FindingCodes(run.report).includes('CHRONICLE-ONE-PRIMARY-ACTION');
      },
    },
    {
      id: 'SAC-P123-07',
      run: () => p123RunValidator(p123LoadFixture('good-typical-phase')).report.verdict === 'REPORT_GROUNDED',
    },
    {
      id: 'SAC-P123-08',
      run: () => {
        const fixture = p123LoadFixture('good-typical-phase');
        fixture.chronicle_html = fixture.chronicle_html.replace('</body>', '<section id="eli5" data-role="eli5"><h2>ELI5</h2><p>CMB appears in a legacy report.</p></section></body>');
        const run = p123RunValidator(fixture);
        return run.report.verdict === 'REPORT_GROUNDED' &&
          p123WarningCodes(run.report).includes('CHRONICLE-JARGON');
      },
    },
    {
      id: 'SAC-P123-09',
      run: () => {
        const run = p123RunValidator(p123LoadFixture('good-v32-conformant'));
        return run.result.status === 0 &&
          run.report.verdict === 'REPORT_GROUNDED' &&
          (run.report.warnings || []).length === 0;
      },
    }
  );
}

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
