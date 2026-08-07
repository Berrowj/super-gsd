#!/usr/bin/env node
'use strict';

// ============================================================================
// SGSD triage-runtime fixture runner
// ============================================================================
// T148-01 owns the VTP fallback/runtime scaffold. These scenarios run the real
// module API with canned VTP transports and assert contained writes in a temp
// SGSD repo, mirroring the commit-gate fixture style.
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const runtimePath = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-triage-runtime.cjs');
const stateLibPath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'sgsd-state.cjs');
const { resolveContainedPath } = require(stateLibPath);

const ROUTE_TOOL = 'mcp__vtp-kb__vtp_route_and_retrieve';
const SEARCH_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const ROUTING_LOG_REL = path.join('.planning', 'metrics', 'vtp-routing-log.jsonl');
const GATE_LOG_REL = path.join('.planning', 'metrics', 'gate-evidence.jsonl');
const VTP_EVIDENCE_REL = path.join(
  '.planning',
  'milestones',
  'v3.5',
  'phases',
  '148-cross-model-triage',
  'VTP-EVIDENCE.md'
);

const createdFixtureRoots = new Set();

function usage() {
  return [
    'Usage:',
    '  node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario <name>',
    '',
    'Scenarios:',
    '  healthy-route-no-fallback',
    '  null-reflection-fallback',
    '  low-hit-fallback',
    '  route-error-fallback',
    '  fallback-also-fails',
    '  non-sgsd-no-write',
    '  vtp-fallback-contained-degradation',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { help: false, scenario: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg === '--scenario') {
      out.scenario = argv[index + 1] || null;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

function realpathOrNull(target) {
  try {
    return fs.realpathSync.native(path.resolve(String(target)));
  } catch {
    try {
      return fs.realpathSync(path.resolve(String(target)));
    } catch {
      return null;
    }
  }
}

function pathKey(target) {
  const value = path.resolve(String(target || ''));
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isInsideOrEqual(root, target) {
  const rootKey = pathKey(root);
  const targetKey = pathKey(target);
  const rel = path.relative(rootKey, targetKey);
  return rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function tempFixtureRoot() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-triage-runtime-'));
  const real = realpathOrNull(target);
  if (!real) {
    fs.rmSync(target, { recursive: true, force: true });
    throw new Error('could not resolve OS-temp fixture root');
  }
  createdFixtureRoots.add(pathKey(real));
  return real;
}

function cleanupFixture(tempRoot) {
  if (!tempRoot) return;
  const targetReal = realpathOrNull(tempRoot);
  if (!targetReal) return;
  const targetKey = pathKey(targetReal);
  if (!createdFixtureRoots.has(targetKey)) {
    throw new Error(`refusing to clean unregistered fixture root: ${targetReal}`);
  }
  const tmpReal = realpathOrNull(os.tmpdir());
  if (!tmpReal || !isInsideOrEqual(tmpReal, targetReal)) {
    throw new Error(`refusing to clean outside OS temp: ${targetReal}`);
  }
  fs.rmSync(targetReal, { recursive: true, force: true });
  createdFixtureRoots.delete(targetKey);
}

function contained(root, subpath) {
  const resolved = resolveContainedPath(root, subpath);
  if (!resolved) throw new Error(`resolveContainedPath refused ${subpath}`);
  return resolved;
}

function writeContainedFile(root, subpath, content) {
  const target = contained(root, subpath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, String(content), 'utf8');
  return target;
}

function readContainedFile(root, subpath) {
  return fs.readFileSync(contained(root, subpath), 'utf8');
}

function createSgsdFixture(options = {}) {
  const tempRoot = tempFixtureRoot();
  try {
    const repoDir = contained(tempRoot, options.repoId || 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
    const milestone = options.milestone || 'v3.5';
    const phase = String(options.phase || '148');
    if (options.withState !== false) {
      writeContainedFile(
        repoDir,
        path.join('.planning', 'STATE.md'),
        [
          '---',
          `milestone: ${JSON.stringify(milestone)}`,
          `current_phase: ${JSON.stringify(phase)}`,
          '---',
          '',
          '# Fixture State',
          '',
        ].join('\n')
      );
      writeContainedFile(
        repoDir,
        path.join(
          '.planning',
          'milestones',
          milestone,
          'phases',
          `${phase}-cross-model-triage`,
          `${phase}-01-PLAN-LOCKED.md`
        ),
        '# Fixture PLAN-LOCKED\n'
      );
    }
    return {
      tempRoot,
      repoDir,
      milestone,
      phase,
      cleanup() {
        cleanupFixture(tempRoot);
      },
    };
  } catch (error) {
    cleanupFixture(tempRoot);
    throw error;
  }
}

function createPlainFixture() {
  const tempRoot = tempFixtureRoot();
  try {
    const repoDir = contained(tempRoot, 'plain');
    fs.mkdirSync(repoDir, { recursive: true });
    return {
      tempRoot,
      repoDir,
      cleanup() {
        cleanupFixture(tempRoot);
      },
    };
  } catch (error) {
    cleanupFixture(tempRoot);
    throw error;
  }
}

function readJsonl(root, subpath) {
  const target = contained(root, subpath);
  if (!fs.existsSync(target)) return [];
  return fs.readFileSync(target, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function assertContainedExistingFile(root, subpath) {
  const target = contained(root, subpath);
  assert.strictEqual(fs.existsSync(target), true, `${subpath} should exist`);
  const rootReal = realpathOrNull(root);
  const targetReal = realpathOrNull(target);
  assert(rootReal, 'fixture root must resolve');
  assert(targetReal, `${subpath} must resolve`);
  assert(isInsideOrEqual(rootReal, targetReal), `${subpath} must stay inside fixture root`);
  return target;
}

function routeResponse({ reflection = { verdict: 'sufficient' }, hits = 2, docPrefix = 'fixture-route-doc' } = {}) {
  const documents = Array.from({ length: hits }, (_, index) => ({
    doc_id: `${docPrefix}-${index + 1}`,
    title: `Fixture ${docPrefix} ${index + 1}`,
  }));
  return {
    retrieval_plan: {
      selected_query: `${docPrefix} selected query`,
      retrieval_mode: 'architecture_hybrid',
    },
    reflection,
    evidence: {
      hits: documents.map((doc) => ({ doc_id: doc.doc_id })),
      documents,
    },
  };
}

function searchResponse({ hits = 2, docPrefix = 'fixture-fallback-doc' } = {}) {
  const documents = Array.from({ length: hits }, (_, index) => ({
    doc_id: `${docPrefix}-${index + 1}`,
    title: `Fixture ${docPrefix} ${index + 1}`,
  }));
  return {
    retrieval_plan: {
      selected_query: `${docPrefix} direct search`,
      retrieval_mode: 'direct_search',
    },
    reflection: { verdict: 'direct_search' },
    evidence: {
      hits: documents.map((doc) => ({ doc_id: doc.doc_id })),
      documents,
    },
  };
}

function makeTransport(entries) {
  const queue = entries.slice();
  const calls = [];
  return {
    calls,
    async invoke(tool, payload) {
      calls.push({ tool, payload });
      const entry = queue.shift();
      if (!entry) throw new Error(`mcp_unexpected_call:${tool}`);
      if (entry.tool) assert.strictEqual(tool, entry.tool, `unexpected VTP tool for call ${calls.length}`);
      JSON.stringify(payload);
      if (entry.throw) throw new Error(entry.throw);
      return JSON.parse(JSON.stringify(entry.response));
    },
  };
}

async function captureStderrAsync(fn) {
  const originalWrite = process.stderr.write;
  let stderr = '';
  process.stderr.write = function patchedWrite(chunk, encoding, callback) {
    stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (typeof callback === 'function') callback();
    return true;
  };
  try {
    const value = await fn();
    return { value, stderr };
  } finally {
    process.stderr.write = originalWrite;
  }
}

async function runRuntimeInProcess(fixture, transport, options = {}) {
  delete require.cache[require.resolve(runtimePath)];
  const runtime = require(runtimePath);
  assert.strictEqual(typeof runtime.runTriageRuntime, 'function', 'runtime must export runTriageRuntime');
  return captureStderrAsync(() => runtime.runTriageRuntime({
    cwd: fixture.repoDir,
    rawQuery: options.rawQuery || `fixture query ${options.scenario || 'triage'}`,
    mcpInvoke: transport.invoke,
    skillOrAgent: 'sgsd-triage-runtime-fixture',
    explicitConstraints: ['T148-01 fixture'],
  }));
}

function gateRowsWithReason(fixture, reasonCode) {
  return readJsonl(fixture.repoDir, GATE_LOG_REL)
    .filter((row) => row.signal === 'triage_vtp_degraded')
    .filter((row) => Array.isArray(row.reason_codes) && row.reason_codes.includes(reasonCode));
}

function assertContainedVtpWrites(fixture) {
  assertContainedExistingFile(fixture.repoDir, ROUTING_LOG_REL);
  assertContainedExistingFile(fixture.repoDir, VTP_EVIDENCE_REL);
}

function assertContainedDegradationWrites(fixture) {
  assertContainedVtpWrites(fixture);
  assertContainedExistingFile(fixture.repoDir, GATE_LOG_REL);
}

async function assertHealthyRouteNoFallback() {
  const fixture = createSgsdFixture({ repoId: 'healthy-route' });
  try {
    const transport = makeTransport([
      { tool: ROUTE_TOOL, response: routeResponse({ reflection: { verdict: 'sufficient' }, hits: 2, docPrefix: 'fixture-route-doc-healthy' }) },
    ]);
    const { value: result } = await runRuntimeInProcess(fixture, transport, { scenario: 'healthy-route-no-fallback' });
    assert.strictEqual(result.exitCode, 0, 'healthy route should exit 0');
    assert.strictEqual(transport.calls.length, 1, 'healthy two-hit route must not trigger fallback');
    assert.strictEqual(transport.calls[0].tool, ROUTE_TOOL);

    const routingRows = readJsonl(fixture.repoDir, ROUTING_LOG_REL);
    assert.strictEqual(routingRows.length, 1, 'healthy route should write one routing-log row');
    assert.strictEqual(routingRows[0].top_doc_id, 'fixture-route-doc-healthy-1');
    assert.strictEqual(routingRows[0].evidence_hit_count, 2);
    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_fallback_reflection_null').length, 0);
    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_fallback_low_hits').length, 0);

    assertContainedVtpWrites(fixture);
    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
    assert.match(evidence, /fixture-route-doc-healthy-1/);
    assert.doesNotMatch(evidence, /fixture-fallback-doc/);
  } finally {
    fixture.cleanup();
  }
}

async function assertNullReflectionFallback() {
  const fixture = createSgsdFixture({ repoId: 'null-reflection' });
  try {
    const transport = makeTransport([
      { tool: ROUTE_TOOL, response: routeResponse({ reflection: null, hits: 2, docPrefix: 'fixture-route-doc-null' }) },
      { tool: SEARCH_TOOL, response: searchResponse({ hits: 2, docPrefix: 'fixture-fallback-doc-null' }) },
    ]);
    const { value: result } = await runRuntimeInProcess(fixture, transport, { scenario: 'null-reflection-fallback' });
    assert.strictEqual(result.exitCode, 0, 'null-reflection fallback should exit 0');
    assert.deepStrictEqual(transport.calls.map((call) => call.tool), [ROUTE_TOOL, SEARCH_TOOL]);

    const rows = gateRowsWithReason(fixture, 'vtp_fallback_reflection_null');
    assert.strictEqual(rows.length, 1, 'null reflection must append one predicate degradation row');
    assert.strictEqual(rows[0].fallback_predicate, 'reflection_null');
    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_fallback_low_hits').length, 0);

    const routingRows = readJsonl(fixture.repoDir, ROUTING_LOG_REL);
    assert.strictEqual(routingRows.length, 2, 'fallback should write route and direct-search routing rows');
    assert.strictEqual(routingRows[1].top_doc_id, 'fixture-fallback-doc-null-1');

    assertContainedDegradationWrites(fixture);
    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
    assert.match(evidence, /fixture-fallback-doc-null-1/);
    assert.match(evidence, /Mode: fallback/);
  } finally {
    fixture.cleanup();
  }
}

async function assertLowHitFallback() {
  const fixture = createSgsdFixture({ repoId: 'low-hit' });
  try {
    const transport = makeTransport([
      { tool: ROUTE_TOOL, response: routeResponse({ reflection: { verdict: 'thin' }, hits: 1, docPrefix: 'fixture-route-doc-low' }) },
      { tool: SEARCH_TOOL, response: searchResponse({ hits: 2, docPrefix: 'fixture-fallback-doc-low' }) },
    ]);
    const { value: result } = await runRuntimeInProcess(fixture, transport, { scenario: 'low-hit-fallback' });
    assert.strictEqual(result.exitCode, 0, 'low-hit fallback should exit 0');
    assert.deepStrictEqual(transport.calls.map((call) => call.tool), [ROUTE_TOOL, SEARCH_TOOL]);

    const rows = gateRowsWithReason(fixture, 'vtp_fallback_low_hits');
    assert.strictEqual(rows.length, 1, 'low hits must append one predicate degradation row');
    assert.strictEqual(rows[0].fallback_predicate, 'low_hits');
    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_fallback_reflection_null').length, 0);

    assertContainedDegradationWrites(fixture);
    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
    assert.match(evidence, /fixture-fallback-doc-low-1/);
    assert.match(evidence, /Mode: fallback/);
  } finally {
    fixture.cleanup();
  }
}

async function assertRouteErrorFallback() {
  const fixture = createSgsdFixture({ repoId: 'route-error' });
  try {
    const transport = makeTransport([
      { tool: ROUTE_TOOL, throw: 'mcp_route_failed: fixture route unavailable' },
      { tool: SEARCH_TOOL, response: searchResponse({ hits: 2, docPrefix: 'fixture-fallback-doc-route-error' }) },
    ]);
    const { value: result, stderr } = await runRuntimeInProcess(fixture, transport, { scenario: 'route-error-fallback' });
    assert.strictEqual(result.exitCode, 0, 'route error fallback should exit 0');
    assert.deepStrictEqual(transport.calls.map((call) => call.tool), [ROUTE_TOOL, SEARCH_TOOL]);
    assert.doesNotMatch(stderr, /\n\s+at\s+/, 'route error breadcrumb must not include a stack');

    const routeRows = gateRowsWithReason(fixture, 'vtp_route_failed');
    assert.strictEqual(routeRows.length, 1, 'route failure must append a distinct degradation row');
    assert.strictEqual(routeRows[0].fallback_predicate, null);
    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_fallback_reflection_null').length, 0);
    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_fallback_low_hits').length, 0);

    assertContainedDegradationWrites(fixture);
    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
    assert.match(evidence, /fixture-fallback-doc-route-error-1/);
    assert.match(evidence, /Mode: fallback/);
  } finally {
    fixture.cleanup();
  }
}

async function assertFallbackAlsoFails() {
  const fixture = createSgsdFixture({ repoId: 'fallback-fails' });
  try {
    const transport = makeTransport([
      { tool: ROUTE_TOOL, throw: 'mcp_route_failed: fixture route unavailable' },
      { tool: SEARCH_TOOL, throw: 'mcp_fallback_failed: fixture fallback unavailable' },
    ]);
    const { value: result, stderr } = await runRuntimeInProcess(fixture, transport, { scenario: 'fallback-also-fails' });
    assert.strictEqual(result.exitCode, 0, 'fallback failure should continue evidence-less with exit 0');
    assert.deepStrictEqual(transport.calls.map((call) => call.tool), [ROUTE_TOOL, SEARCH_TOOL]);
    assert.doesNotMatch(stderr, /\n\s+at\s+/, 'fallback failure breadcrumb must not include a stack');

    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_route_failed').length, 1);
    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_fallback_failed').length, 1);
    const routingRows = readJsonl(fixture.repoDir, ROUTING_LOG_REL);
    assert.strictEqual(routingRows.length, 2, 'failed route and failed fallback should both write routing-log rows');

    assertContainedDegradationWrites(fixture);
    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
    assert.match(evidence, /Mode: evidence_less/);
    assert.match(evidence, /No VTP documents available/);
  } finally {
    fixture.cleanup();
  }
}

async function assertNonSgsdNoWrite() {
  const fixture = createPlainFixture();
  try {
    const transport = makeTransport([
      { tool: ROUTE_TOOL, throw: 'mcp_should_not_call' },
    ]);
    const { value: result, stderr } = await runRuntimeInProcess(fixture, transport, { scenario: 'non-sgsd-no-write' });
    assert.strictEqual(result.exitCode, 0, 'non-SGSD cwd should silently exit 0');
    assert.strictEqual(result.skipped, true, 'non-SGSD cwd should report skipped to module caller');
    assert.strictEqual(transport.calls.length, 0, 'non-SGSD cwd must not call VTP');
    assert.strictEqual(stderr, '', 'non-SGSD cwd must be silent');
    assert.strictEqual(fs.existsSync(path.join(fixture.repoDir, '.planning')), false, 'non-SGSD cwd must write nothing');
  } finally {
    fixture.cleanup();
  }
}

async function assertAllFallbackContainedDegradation() {
  await assertHealthyRouteNoFallback();
  await assertNullReflectionFallback();
  await assertLowHitFallback();
  await assertRouteErrorFallback();
  await assertFallbackAlsoFails();
  await assertNonSgsdNoWrite();
}

const scenarios = Object.freeze({
  'healthy-route-no-fallback': assertHealthyRouteNoFallback,
  'null-reflection-fallback': assertNullReflectionFallback,
  'low-hit-fallback': assertLowHitFallback,
  'route-error-fallback': assertRouteErrorFallback,
  'fallback-also-fails': assertFallbackAlsoFails,
  'non-sgsd-no-write': assertNonSgsdNoWrite,
  'vtp-fallback-contained-degradation': assertAllFallbackContainedDegradation,
});

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const scenario = scenarios[args.scenario];
  if (!scenario) {
    console.error(usage());
    return 2;
  }
  await scenario();
  console.log(`[PASS] ${args.scenario}`);
  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  assertAllFallbackContainedDegradation,
  assertFallbackAlsoFails,
  assertHealthyRouteNoFallback,
  assertLowHitFallback,
  assertNonSgsdNoWrite,
  assertNullReflectionFallback,
  assertRouteErrorFallback,
};
