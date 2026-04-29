#!/usr/bin/env node
// SGSD harness benchmark and failure-injection runner.
//
// This is deliberately deterministic by default. It stress-tests the mechanical
// contracts that SGSD already exposes before any live LLM build benchmark is
// added on top.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SGSD_ROOT = resolve(__dirname, '..', '..');
const PROJECT_ROOT = resolve(SGSD_ROOT, '..');
const GATES_YAML = join(SGSD_ROOT, 'registry', 'gates.yaml');
const VALIDATOR = join(SGSD_ROOT, 'tools', 'plan-schema', 'validate.cjs');
const CONTRACT_CHECK = join(SGSD_ROOT, 'tools', 'provider-contract', 'contract-check.mjs');

const {
  loadGates,
  shouldFire,
  resetCache,
} = require('../../scripts/lib/gates-registry.cjs');
const { evalPredicate } = require('../../scripts/lib/predicate-eval.cjs');
const { recordTransition } = require('../../scripts/lib/edge-guard.cjs');

const args = parseArgs(process.argv);
const runId = makeRunId();
const outputDir = resolve(args.outputDir || join(tmpdir(), 'sgsd-benchmark-runs', runId));
mkdirSync(outputDir, { recursive: true });

const startedAt = Date.now();
const results = [];
const gateCoverage = new Map();

main();

function main() {
  let plan;
  try {
    plan = profilePlan(args);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  let iteration = 0;

  do {
    iteration += 1;
    runSuite(iteration);
  } while (shouldContinue(plan, iteration));

  const summary = summarize();
  const report = {
    run_id: runId,
    started_at: new Date(startedAt).toISOString(),
    ended_at: new Date().toISOString(),
    profile: args.profile,
    iterations: iteration,
    duration_ms: Date.now() - startedAt,
    summary,
    gate_coverage: Array.from(gateCoverage.values()),
    prune_signals: computePruneSignals(),
    cases: results,
  };

  const jsonPath = join(outputDir, 'RUN.json');
  const mdPath = join(outputDir, 'REPORT.md');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(mdPath, renderMarkdown(report));

  const line = [
    `SGSD benchmark ${summary.failed === 0 && summary.blocked === 0 ? 'PASS' : 'FAIL'}`,
    `${summary.passed}/${summary.total} cases passed`,
    `hardness=${summary.hardness_score}`,
    `report=${mdPath}`,
  ].join(' | ');
  console.log(line);

  process.exit(summary.failed === 0 && summary.blocked === 0 ? 0 : 1);
}

function parseArgs(argv) {
  const out = {
    profile: 'smoke',
    outputDir: null,
    durationMin: null,
    iterations: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile') out.profile = argv[++i];
    else if (a === '--output-dir') out.outputDir = argv[++i];
    else if (a === '--duration-min') out.durationMin = parseNonNegativeNumber(argv[++i], '--duration-min');
    else if (a === '--iterations') out.iterations = parseNonNegativeInteger(argv[++i], '--iterations');
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`unknown flag: ${a}`);
      printUsage();
      process.exit(2);
    }
  }
  if (!['smoke', 'standard', 'hour'].includes(out.profile)) {
    console.error(`invalid --profile '${out.profile}'`);
    printUsage();
    process.exit(2);
  }
  return out;
}

function parseNonNegativeNumber(raw, flag) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(`${flag} must be a non-negative number, got '${raw}'`);
    process.exit(2);
  }
  return value;
}

function parseNonNegativeInteger(raw, flag) {
  const value = parseNonNegativeNumber(raw, flag);
  if (!Number.isInteger(value)) {
    console.error(`${flag} must be an integer, got '${raw}'`);
    process.exit(2);
  }
  return value;
}

function printUsage() {
  console.log(`
sgsd-harness-benchmark - deterministic SGSD gate and workflow stress test

Usage:
  node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs [options]

Options:
  --profile smoke|standard|hour   smoke=1 pass, standard=10 passes, hour=60 minutes
  --duration-min N                Override profile duration
  --iterations N                  Override profile iteration count
  --output-dir PATH               Directory for RUN.json and REPORT.md

Examples:
  node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs
  node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs --profile standard
  node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs --profile hour --duration-min 30
`);
}

function profilePlan(parsedArgs) {
  const defaults = {
    smoke: { iterations: 1, durationMin: 0 },
    standard: { iterations: 10, durationMin: 0 },
    hour: { iterations: Infinity, durationMin: 60 },
  };
  const base = defaults[parsedArgs.profile];
  const plan = {
    iterations: parsedArgs.iterations ?? base.iterations,
    durationMin: parsedArgs.durationMin ?? base.durationMin,
  };
  if (!Number.isFinite(plan.iterations) && plan.durationMin <= 0) {
    throw new Error('unbounded benchmark requested: set --duration-min above 0 or --iterations');
  }
  return plan;
}

function shouldContinue(plan, iteration) {
  if (iteration >= plan.iterations) return false;
  if (plan.durationMin > 0) {
    const elapsedMin = (Date.now() - startedAt) / 60000;
    return elapsedMin < plan.durationMin;
  }
  return true;
}

function runSuite(iteration) {
  runRegistryIntegrity(iteration);
  runPredicateMatrix(iteration);
  runPredicateFailureInjection(iteration);
  runEdgeGuardSuite(iteration);
  runPlanSchemaSuite(iteration);
  runProviderContractSuite(iteration);
}

function runRegistryIntegrity(iteration) {
  withCase('registry', 'gates.yaml exists', iteration, { failureInjection: false }, () => {
    assert(existsSync(GATES_YAML), `missing ${GATES_YAML}`);
    return `found ${relative(GATES_YAML)}`;
  });

  resetCache();
  const registry = loadGates(GATES_YAML);
  const names = new Set();
  const allowedModes = new Set(['hard-halt', 'soft-warn', 'amortized', 'disabled']);

  withCase('registry', 'gate names are unique', iteration, {}, () => {
    for (const gate of registry.all) {
      assert(!names.has(gate.name), `duplicate gate name: ${gate.name}`);
      names.add(gate.name);
    }
    return `${names.size} unique gates`;
  });

  for (const gate of registry.all) {
    withCase('registry', `gate row is well formed: ${gate.name}`, iteration, {}, () => {
      assert(gate.name, 'missing name');
      assert(gate.category, `${gate.name} missing category`);
      assert(gate.state, `${gate.name} missing state`);
      assert(gate.version !== undefined, `${gate.name} missing version`);
      assert(allowedModes.has(gate.enforcement_mode), `${gate.name} invalid enforcement_mode`);
      assert(Array.isArray(gate.evidence_emitted), `${gate.name} evidence_emitted must be an array`);
      if (gate.script) {
        const scriptPath = resolve(PROJECT_ROOT, gate.script);
        assert(existsSync(scriptPath), `${gate.name} script path missing: ${gate.script}`);
      }
      return `${gate.enforcement_mode}/${gate.state}`;
    });
  }
}

function runPredicateMatrix(iteration) {
  resetCache();
  const cases = [
    {
      gate: 'per-dispatch-ATC',
      name: 'fires for full ATC code change',
      ctx: patchCtx({ classifier: { atc_tier: 'full' }, code_files_changed_count: 1 }),
      expected: true,
    },
    {
      gate: 'per-dispatch-ATC',
      name: 'does not fire when no code changed',
      ctx: patchCtx({ classifier: { atc_tier: 'full' }, code_files_changed_count: 0 }),
      expected: false,
    },
    {
      gate: 'sgsd-recall-queries',
      name: 'fires for non-trivial complexity',
      ctx: patchCtx({ classifier: { complexity: 'standard' } }),
      expected: true,
    },
    {
      gate: 'sgsd-recall-queries',
      name: 'does not fire for trivial complexity',
      ctx: patchCtx({ classifier: { complexity: 'trivial' } }),
      expected: false,
    },
    {
      gate: 'MUDA-waste-audit',
      name: 'fires on broad feature diff',
      ctx: patchCtx({ files_changed_count: 4, diff_lines: 90, phase_type: 'feature' }),
      expected: true,
    },
    {
      gate: 'MUDA-waste-audit',
      name: 'does not fire for docs phase',
      ctx: patchCtx({ files_changed_count: 8, diff_lines: 300, phase_type: 'docs' }),
      expected: false,
    },
    {
      gate: 'qualitative-waste-audit',
      name: 'fires after mechanical MUDA pass on large feature diff',
      ctx: patchCtx({ diff_lines: 220, phase_type: 'feature', mechanical_muda_verdict: 'PASS' }),
      expected: true,
    },
    {
      gate: 'qualitative-waste-audit',
      name: 'does not fire when mechanical MUDA failed',
      ctx: patchCtx({ diff_lines: 220, phase_type: 'feature', mechanical_muda_verdict: 'FAIL' }),
      expected: false,
    },
    {
      gate: 'sgsd-curate-learnings',
      name: 'fires when new script was created',
      ctx: patchCtx({ script_created: true }),
      expected: true,
    },
    {
      gate: 'sgsd-curate-learnings',
      name: 'does not fire without learning signal',
      ctx: patchCtx({ script_created: false, new_pattern_detected: false, error_discovered: false }),
      expected: false,
    },
    {
      gate: 'vtp-enrichment',
      name: 'fires at research boundary when VTP enabled',
      ctx: patchCtx({ research_phase_complete: true, vtp_enrichment_enabled: true }),
      expected: true,
    },
    {
      gate: 'vtp-enrichment',
      name: 'does not fire when VTP disabled',
      ctx: patchCtx({ research_phase_complete: true, vtp_enrichment_enabled: false }),
      expected: false,
    },
    {
      gate: 'verifier-row-arithmetic',
      name: 'fires when phase has verify.mjs',
      ctx: patchCtx({ phase_has_verify_mjs: true }),
      expected: true,
    },
    {
      gate: 'verifier-row-arithmetic',
      name: 'does not fire without verify.mjs',
      ctx: patchCtx({ phase_has_verify_mjs: false }),
      expected: false,
    },
    {
      gate: 'verifier-detail-vs-summary',
      name: 'fires when phase has verify.mjs',
      ctx: patchCtx({ phase_has_verify_mjs: true }),
      expected: true,
    },
    {
      gate: 'verifier-detail-vs-summary',
      name: 'does not fire without verify.mjs',
      ctx: patchCtx({ phase_has_verify_mjs: false }),
      expected: false,
    },
  ];

  const registry = loadGates(GATES_YAML);
  for (const gate of registry.all.filter(g => Array.isArray(g.trigger) && g.trigger.length === 0)) {
    cases.push({
      gate: gate.name,
      name: 'empty-trigger gate fires by default',
      ctx: baseCtx(),
      expected: gate.enforcement_mode !== 'disabled',
    });
  }

  for (const item of cases) {
    withCase('gate-predicate', `${item.gate}: ${item.name}`, iteration, { gate: item.gate }, () => {
      const actual = shouldFire(item.gate, item.ctx, GATES_YAML);
      recordGateCoverage(item.gate, item.expected, actual);
      assert(actual === item.expected, `expected ${item.expected}, got ${actual}`);
      return `expected=${item.expected} actual=${actual}`;
    });
  }
}

function runPredicateFailureInjection(iteration) {
  withCase('failure-injection', 'predicate rejects unknown context field', iteration, { failureInjection: true }, () => {
    assertThrows(
      () => evalPredicate([{ field: 'classifier.nonexistent', op: 'eq', value: true }], baseCtx()),
      /missing field/
    );
    return 'unknown field rejected';
  });

  withCase('failure-injection', 'predicate rejects unknown operator', iteration, { failureInjection: true }, () => {
    assertThrows(
      () => evalPredicate([{ field: 'diff_lines', op: 'near', value: 10 }], baseCtx()),
      /unknown operator/
    );
    return 'unknown operator rejected';
  });

  withCase('failure-injection', 'predicate rejects malformed any clause', iteration, { failureInjection: true }, () => {
    assertThrows(
      () => evalPredicate([{ any: { field: 'diff_lines', op: 'gte', value: 1 } }], baseCtx()),
      /must be an array/
    );
    return 'malformed any rejected';
  });
}

function runEdgeGuardSuite(iteration) {
  const tmp = mkTempProject('edge');
  const gatesPath = join(tmp, 'fixture-gates.yaml');
  writeFileSync(gatesPath, [
    'gates:',
    '  - name: soft-evidence',
    '    enforcement_mode: soft-warn',
    '    escalation: log-only',
    '    evidence_emitted: []',
    '  - name: hard-evidence',
    '    enforcement_mode: hard-halt',
    '    escalation: halt',
    '    evidence_emitted: []',
    '',
  ].join('\n'));

  try {
    resetCache();

    withCase('edge-guard', 'records pass row when evidence exists', iteration, {}, () => {
      const result = recordTransition({
        fromStep: 6,
        toStep: 7,
        phase: 99,
        plan: 'bench-pass',
        gateName: 'soft-evidence',
        expectedEmits: ['evidence.txt'],
        actualEmits: ['evidence.txt'],
        ctx: { bench: true },
        gatesYamlPath: gatesPath,
        projectDir: tmp,
      });
      assert(result.status === 'ok', `expected ok, got ${result.status}`);
      return 'status=ok';
    });

    withCase('edge-guard', 'logs soft missing evidence', iteration, { failureInjection: true }, () => {
      const result = recordTransition({
        fromStep: 6,
        toStep: 7,
        phase: 99,
        plan: 'bench-soft-missing',
        gateName: 'soft-evidence',
        expectedEmits: ['missing.md'],
        actualEmits: [],
        ctx: { bench: true },
        gatesYamlPath: gatesPath,
        projectDir: tmp,
      });
      assert(result.status === 'logged', `expected logged, got ${result.status}`);
      assert(result.missing_emits.includes('missing.md'), 'missing emit not reported');
      return 'status=logged';
    });

    withCase('edge-guard', 'halts hard missing evidence', iteration, { failureInjection: true }, () => {
      const result = recordTransition({
        fromStep: 9.5,
        toStep: 10,
        phase: 99,
        plan: 'bench-hard-missing',
        gateName: 'hard-evidence',
        expectedEmits: ['review.md'],
        actualEmits: [],
        ctx: { bench: true },
        gatesYamlPath: gatesPath,
        projectDir: tmp,
      });
      assert(result.status === 'halt', `expected halt, got ${result.status}`);
      assert(result.missing_emits.includes('review.md'), 'missing emit not reported');
      return 'status=halt';
    });

    withCase('edge-guard', 'token-log step remains exempt', iteration, {}, () => {
      const result = recordTransition({
        fromStep: 11,
        toStep: 12,
        phase: 99,
        plan: 'bench-token-exempt',
        gateName: 'hard-evidence',
        expectedEmits: ['token-log.jsonl'],
        actualEmits: [],
        ctx: { bench: true },
        gatesYamlPath: gatesPath,
        projectDir: tmp,
      });
      assert(result.status === 'ok', `expected ok, got ${result.status}`);
      return 'status=ok';
    });

    withCase('edge-guard', 'JSONL rows include required keys', iteration, {}, () => {
      const logPath = join(tmp, '.planning', 'metrics', 'edge-guard-log.jsonl');
      const rows = readJsonl(logPath);
      assert(rows.length === 3, `expected 3 rows, got ${rows.length}`);
      const required = [
        'ts', 'phase', 'plan', 'from_step', 'to_step', 'gate',
        'expected_emits', 'actual_emits', 'missing_emits', 'context', 'resolution',
      ];
      for (const row of rows) {
        for (const key of required) assert(key in row, `row missing ${key}`);
      }
      return `${rows.length} rows checked`;
    });
  } finally {
    resetCache();
    rmSync(tmp, { recursive: true, force: true });
  }
}

function runPlanSchemaSuite(iteration) {
  const tmp = mkTempProject('plan');
  const validPlan = join(tmp, '26-01-valid-plan.md');
  const invalidPlan = join(tmp, '26-02-invalid-plan.md');

  writeFileSync(validPlan, [
    '---',
    'schema_version: 2',
    'expected_ATC_tier: FULL',
    'tasks:',
    '  - id: bench-build-widget',
    '    agent: sgsd-exec-test',
    '    model: sonnet',
    '    files_touched:',
    '      - src/widget.js',
    '    input_contract: Benchmark input fixture exists.',
    '    output_contract: src/widget.js exports a deterministic widget builder.',
    '    hypothesis: A small implementation can be verified with a local command.',
    '    falsifier: The verification command exits non-zero.',
    '    stop_rule: Verification exits 0 and output file exists.',
    '    verification_cmd: node --check src/widget.js',
    '---',
    '# Valid benchmark plan',
    '',
  ].join('\n'));

  writeFileSync(invalidPlan, [
    '---',
    'schema_version: 2',
    'tasks:',
    '  - id: broken-task',
    '    agent: sgsd-exec-test',
    '    model: sonnet',
    '    files_touched:',
    '      - src/broken.js',
    '---',
    '# Invalid benchmark plan',
    '',
  ].join('\n'));

  try {
    withCase('plan-schema', 'accepts valid v2 frontmatter', iteration, {}, () => {
      const r = runNode([VALIDATOR, '--plan-file', validPlan, '--project-dir', tmp, '--mode', 'load']);
      assert(r.status === 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
      return 'exit=0';
    });

    withCase('plan-schema', 'rejects missing required task fields', iteration, { failureInjection: true }, () => {
      const r = runNode([VALIDATOR, '--plan-file', invalidPlan, '--project-dir', tmp, '--mode', 'load']);
      assert(r.status === 1, `expected exit 1, got ${r.status}: ${r.stderr}`);
      assert(r.stderr.includes('task must declare'), 'expected SCHEMA-02 error text');
      return 'exit=1';
    });

    withCase('plan-schema', 'writes validation telemetry for pass and fail', iteration, {}, () => {
      const rows = readJsonl(join(tmp, '.planning', 'metrics', 'plan-errors.jsonl'));
      assert(rows.length === 2, `expected 2 telemetry rows, got ${rows.length}`);
      assert(rows.some(r => r.valid === true), 'missing valid telemetry row');
      assert(rows.some(r => r.valid === false), 'missing invalid telemetry row');
      return `${rows.length} rows checked`;
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function runProviderContractSuite(iteration) {
  withCase('provider-contract', 'accepts checked-in reviewer fixtures', iteration, {}, () => {
    const r = runNode([CONTRACT_CHECK]);
    assert(r.status === 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert(parsed.divergence && parsed.divergence.both_parsed, 'expected both reports parsed');
    return 'exit=0 both_parsed=true';
  });

  const tmp = mkTempProject('contract');
  const good = join(tmp, 'good-report.txt');
  const bad = join(tmp, 'bad-report.txt');
  writeFileSync(good, [
    'FINDINGS: 0',
    'CRITICAL: 0',
    'WARNINGS: 0',
    'PASS_RATE: 100%',
    'ONE_LINER: benchmark fixture passes',
    '',
  ].join('\n'));
  writeFileSync(bad, [
    'FINDINGS: 1',
    'CRITICAL: one',
    'WARNINGS: 0',
    'PASS_RATE: yes',
    '',
  ].join('\n'));

  try {
    withCase('provider-contract', 'rejects malformed reviewer report', iteration, { failureInjection: true }, () => {
      const r = runNode([CONTRACT_CHECK, '--claude-report', good, '--codex-report', bad]);
      assert(r.status === 1, `expected exit 1, got ${r.status}: ${r.stderr}`);
      const parsed = JSON.parse(r.stdout);
      assert(parsed.codex && parsed.codex.parsed === false, 'expected malformed report to fail parse');
      return `exit=1 missing=${parsed.codex.missing}`;
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function withCase(suite, name, iteration, meta, fn) {
  const start = Date.now();
  try {
    const detail = fn();
    results.push({
      suite,
      name,
      iteration,
      status: 'pass',
      elapsed_ms: Date.now() - start,
      failure_injection: Boolean(meta.failureInjection),
      gate: meta.gate || null,
      detail,
    });
  } catch (error) {
    results.push({
      suite,
      name,
      iteration,
      status: meta.blocked ? 'blocked' : 'fail',
      elapsed_ms: Date.now() - start,
      failure_injection: Boolean(meta.failureInjection),
      gate: meta.gate || null,
      detail: error.message,
    });
  }
}

function summarize() {
  const total = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const blocked = results.filter(r => r.status === 'blocked').length;
  const injected = results.filter(r => r.failure_injection);
  const injectedPassed = injected.filter(r => r.status === 'pass').length;
  return {
    total,
    passed,
    failed,
    blocked,
    failure_injection_cases: injected.length,
    failure_injection_passed: injectedPassed,
    hardness_score: total === 0 ? '0.0%' : `${((passed / total) * 100).toFixed(1)}%`,
    failure_detection_score: injected.length === 0
      ? 'n/a'
      : `${((injectedPassed / injected.length) * 100).toFixed(1)}%`,
  };
}

function computePruneSignals() {
  resetCache();
  const registry = loadGates(GATES_YAML);
  const signals = [];
  for (const gate of registry.all) {
    const coverage = gateCoverage.get(gate.name);
    if (!coverage) {
      signals.push({
        gate: gate.name,
        signal: 'untested-by-benchmark',
        action: 'add a benchmark scenario before changing enforcement',
      });
      continue;
    }
    if (coverage.positive === 0) {
      signals.push({
        gate: gate.name,
        signal: 'no-positive-hit',
        action: 'prove this gate catches a real defect or make it conditional',
      });
    }
    if (gate.enforcement_mode === 'soft-warn' && Array.isArray(gate.trigger) && gate.trigger.length === 0) {
      signals.push({
        gate: gate.name,
        signal: 'always-on-soft-warn',
        action: 'measure runtime/catches across live runs; candidate for sampling if catch rate stays zero',
      });
    }
  }
  return signals;
}

function renderMarkdown(report) {
  const failures = report.cases.filter(c => c.status !== 'pass');
  const prune = report.prune_signals;
  return [
    `# SGSD Harness Benchmark ${report.run_id}`,
    '',
    `Profile: ${report.profile}`,
    `Iterations: ${report.iterations}`,
    `Duration: ${report.duration_ms}ms`,
    '',
    '## Score',
    '',
    `- Cases: ${report.summary.passed}/${report.summary.total} passed`,
    `- Hardness score: ${report.summary.hardness_score}`,
    `- Failure detection score: ${report.summary.failure_detection_score}`,
    `- Failed: ${report.summary.failed}`,
    `- Blocked: ${report.summary.blocked}`,
    '',
    '## Failures',
    '',
    failures.length === 0
      ? 'None.'
      : failures.map(f => `- ${f.suite} / ${f.name}: ${f.detail}`).join('\n'),
    '',
    '## Gate Coverage',
    '',
    report.gate_coverage.length === 0
      ? 'No gate coverage recorded.'
      : report.gate_coverage
          .map(g => `- ${g.gate}: positive=${g.positive}, negative=${g.negative}, mismatches=${g.mismatches}`)
          .join('\n'),
    '',
    '## Prune Signals',
    '',
    prune.length === 0
      ? 'No prune signals from this run.'
      : prune.map(p => `- ${p.gate}: ${p.signal}. ${p.action}.`).join('\n'),
    '',
    '## Notes',
    '',
    'This benchmark is deterministic. It proves gate contracts, failure detection, and telemetry shape. It does not yet run a live LLM build task.',
    '',
    'For live build benchmarks, keep scenario decks, expected failures, and scoring oracles outside the model-visible workspace.',
    '',
  ].join('\n');
}

function patchCtx(patch) {
  const ctx = baseCtx();
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && ctx[key] && typeof ctx[key] === 'object') {
      ctx[key] = { ...ctx[key], ...value };
    } else {
      ctx[key] = value;
    }
  }
  return ctx;
}

function baseCtx() {
  return {
    classifier: {
      complexity: 'standard',
      atc_tier: 'lite',
      type: 'feature',
    },
    files_changed_count: 0,
    code_files_changed_count: 0,
    diff_lines: 0,
    phase_type: 'feature',
    new_pattern_detected: false,
    script_created: false,
    error_discovered: false,
    phase_has_verify_mjs: false,
    mechanical_muda_verdict: 'PASS',
    research_phase_complete: false,
    vtp_enrichment_enabled: true,
  };
}

function recordGateCoverage(gate, expected, actual) {
  if (!gateCoverage.has(gate)) {
    gateCoverage.set(gate, { gate, positive: 0, negative: 0, mismatches: 0 });
  }
  const row = gateCoverage.get(gate);
  if (expected === true) row.positive += 1;
  else row.negative += 1;
  if (expected !== actual) row.mismatches += 1;
}

function runNode(nodeArgs) {
  return spawnSync(process.execPath, nodeArgs, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  });
}

function mkTempProject(label) {
  const dir = mkdtempSync(join(tmpdir(), `sgsd-bench-${label}-`));
  mkdirSync(join(dir, '.planning', 'metrics'), { recursive: true });
  return dir;
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn, pattern) {
  try {
    fn();
  } catch (error) {
    if (pattern.test(error.message)) return;
    throw new Error(`wrong error: ${error.message}`);
  }
  throw new Error('expected function to throw');
}

function makeRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function relative(path) {
  const rel = path.startsWith(PROJECT_ROOT)
    ? path.slice(PROJECT_ROOT.length + 1)
    : path;
  return rel.replace(/\\/g, '/');
}
