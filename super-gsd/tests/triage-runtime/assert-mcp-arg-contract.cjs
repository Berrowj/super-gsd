#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

const repoRoot = path.resolve(__dirname, '../../..');
const runtimePath = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-triage-runtime.cjs');
const schemaPath = path.join(repoRoot, 'super-gsd', 'schemas', 'vtp-mcp-input-schemas.v1.json');
const Ajv = require(path.join(repoRoot, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'ajv'));

const ROUTE_TOOL = 'mcp__vtp-kb__vtp_route_and_retrieve';
const SEARCH_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const RAW_QUERY = 'fixture MCP argument contract query';
const schemaAuthority = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: true });

function usage() {
  return [
    'Usage:',
    '  node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args',
    '  node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence --evidence-file <path>',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { caseName: null, evidenceFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--case') {
      out.caseName = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--evidence-file') {
      out.evidenceFile = argv[index + 1] || null;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return out;
}

function validatorFor(tool) {
  assert.strictEqual(schemaAuthority.version_id, 'vtp-mcp-input-schemas.v1');
  assert.strictEqual(
    schemaAuthority.provenance,
    'mirrors live vtp-kb descriptors reproduced 2026-08-18'
  );
  const declaration = schemaAuthority.tools && schemaAuthority.tools[tool];
  assert(declaration && declaration.inputSchema, `schema declaration missing for ${tool}`);
  return ajv.compile(declaration.inputSchema);
}

const validators = Object.freeze({
  [ROUTE_TOOL]: validatorFor(ROUTE_TOOL),
  [SEARCH_TOOL]: validatorFor(SEARCH_TOOL),
});

function writeFile(root, rel, content) {
  const target = path.resolve(root, rel);
  const relative = path.relative(root, target);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `uncontained fixture path: ${rel}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

function createFixture() {
  const tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-mcp-arg-contract-')));
  const repoDir = path.join(tempRoot, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });
  writeFile(repoDir, path.join('.planning', 'STATE.md'), [
    '---',
    'milestone: "v3.6-vtp-bridge"',
    'current_phase: "154"',
    '---',
    '',
    '# MCP argument contract fixture',
    '',
  ].join('\n'));
  writeFile(
    repoDir,
    path.join('.planning', 'milestones', 'v3.6-vtp-bridge', 'phases', '154-mcp-arg-contract', '154-01-PLAN-LOCKED.md'),
    '# Fixture PLAN-LOCKED\n'
  );
  return { tempRoot, repoDir };
}

function cleanupFixture(fixture) {
  const tempDir = fs.realpathSync(os.tmpdir());
  const target = fs.realpathSync(fixture.tempRoot);
  const relative = path.relative(tempDir, target);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `refusing cleanup outside temp: ${target}`);
  fs.rmSync(target, { recursive: true, force: true });
}

function runStage(fixture, args, label) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(runtimePath, {
      argv: [...args, '--cwd', fixture.repoDir],
      stdout: true,
      stderr: true,
    });
    let stdout = '';
    let stderr = '';
    worker.stdout.setEncoding('utf8');
    worker.stderr.setEncoding('utf8');
    worker.stdout.on('data', (chunk) => { stdout += chunk; });
    worker.stderr.on('data', (chunk) => { stderr += chunk; });
    worker.on('error', reject);
    worker.on('exit', (status) => {
      try {
        assert.strictEqual(status, 0, `${label} exited ${status}: ${stderr}`);
        const output = stdout.trim();
        assert(output, `${label} emitted no JSON`);
        resolve(JSON.parse(output));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function reflectionNullResponse(rawQuery) {
  return {
    retrieval_plan: {
      selected_query: rawQuery,
      retrieval_mode: 'architecture_hybrid',
    },
    reflection: null,
    evidence: {
      hits: [{}, {}],
      documents: [{ doc_id: 'mcp-contract-doc-1' }, { doc_id: 'mcp-contract-doc-2' }],
    },
  };
}

async function emitPackets(rawQuery = RAW_QUERY) {
  const fixture = createFixture();
  try {
    const queryRel = path.join('.planning', 'tmp', 'mcp-contract-query.txt');
    writeFile(fixture.repoDir, queryRel, rawQuery);
    const route = await runStage(fixture, [
      '--stage', 'vtp-plan',
      '--query-file', queryRel,
    ], 'vtp-plan');
    assert.strictEqual(route.action, 'invoke_mcp');
    assert.strictEqual(route.mcp_tool, ROUTE_TOOL);

    writeFile(fixture.repoDir, route.response_file, `${JSON.stringify(reflectionNullResponse(rawQuery))}\n`);
    const search = await runStage(fixture, [
      '--stage', 'vtp-consume',
      '--query-file', queryRel,
      '--response-file', route.response_file,
    ], 'vtp-consume reflection-null');
    assert.strictEqual(search.action, 'invoke_mcp');
    assert.strictEqual(search.mcp_tool, SEARCH_TOOL);
    return { route, search };
  } finally {
    cleanupFixture(fixture);
  }
}

function formatAjvError(error) {
  const location = error.instancePath || '/';
  if (error.keyword === 'additionalProperties') {
    return `${location} must NOT have additional property ${JSON.stringify(error.params.additionalProperty)}`;
  }
  return `${location} ${error.message || error.keyword}`;
}

function validatePacket(packet) {
  const validate = validators[packet.mcp_tool];
  assert(validate, `no validator for emitted tool ${packet.mcp_tool}`);
  if (validate(packet.args)) return [];
  return (validate.errors || []).map(formatAjvError);
}

async function assertEmittedArgs() {
  const packets = await emitPackets();
  const failures = [];
  for (const packet of [packets.route, packets.search]) {
    const errors = validatePacket(packet);
    if (errors.length > 0) failures.push({ tool: packet.mcp_tool, errors });
  }
  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(`[FAIL] ${failure.tool}\n`);
      for (const error of failure.errors) process.stderr.write(`  - ${error}\n`);
    }
    throw new Error(`emitted MCP args violate ${schemaAuthority.version_id}`);
  }

  for (const turn of packets.route.args.context.recent_turns) {
    assert(turn && typeof turn === 'object' && !Array.isArray(turn), 'recent turn must be an object');
    assert.strictEqual(typeof turn.text, 'string');
    assert(turn.text.length > 0, 'recent turn text must be non-empty');
    assert(Object.keys(turn).every((key) => key === 'text' || key === 'role'), 'recent turn exposed unsupported keys');
  }
  assert.deepStrictEqual(packets.search.args, { query: RAW_QUERY });
}

function readEvidence(evidenceFile) {
  assert(evidenceFile, '--evidence-file is required for real-evidence');
  const target = path.isAbsolute(evidenceFile) ? evidenceFile : path.resolve(repoRoot, evidenceFile);
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function assertSuccessfulRawResult(call) {
  assert(Object.prototype.hasOwnProperty.call(call, 'error'), `${call.stage} must record error explicitly`);
  assert.strictEqual(call.error, null, `${call.stage} recorded an MCP error`);
  assert(Object.prototype.hasOwnProperty.call(call, 'isError'), `${call.stage} must record isError explicitly`);
  assert.strictEqual(call.isError, false, `${call.stage} recorded isError=true`);
  assert(call.raw_result && typeof call.raw_result === 'object' && !Array.isArray(call.raw_result), `${call.stage} raw_result must be an object`);
  assert(Object.keys(call.raw_result).length > 0, `${call.stage} raw_result must be non-empty`);
  assert.doesNotMatch(JSON.stringify(call.raw_result), /-32602|invalid params|validation error/i);
}

async function assertRealEvidence(evidenceFile) {
  const evidence = readEvidence(evidenceFile);
  assert.strictEqual(evidence.schema_version, 1);
  assert.strictEqual(typeof evidence.runtime_commit, 'string');
  assert(evidence.runtime_commit.trim(), 'runtime_commit must be non-empty');
  assert(!Number.isNaN(Date.parse(evidence.captured_at)), 'captured_at must be an ISO timestamp');
  assert.strictEqual(typeof evidence.fixed_query, 'string');
  assert(evidence.fixed_query.length >= 3, 'fixed_query must be at least 3 characters');
  assert(Array.isArray(evidence.calls), 'calls must be an array');
  assert.strictEqual(evidence.calls.length, 2, 'evidence must contain exactly two calls');

  const packets = await emitPackets(evidence.fixed_query);
  const expected = [
    { stage: 'vtp-plan', fallbackPredicate: null, packet: packets.route },
    { stage: 'vtp-consume', fallbackPredicate: 'reflection_null', packet: packets.search },
  ];
  for (let index = 0; index < expected.length; index += 1) {
    const call = evidence.calls[index];
    const item = expected[index];
    assert.strictEqual(call.stage, item.stage);
    assert.strictEqual(call.fallback_predicate, item.fallbackPredicate);
    assert.strictEqual(call.tool, item.packet.tool);
    assert.strictEqual(call.mcp_tool, item.packet.mcp_tool);
    assert.deepStrictEqual(call.args, item.packet.args, `${call.stage} args differ from fresh production emission`);
    assert.deepStrictEqual(validatePacket(item.packet), []);
    assertSuccessfulRawResult(call);
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.caseName === 'emitted-args') {
    await assertEmittedArgs();
  } else if (args.caseName === 'real-evidence') {
    await assertRealEvidence(args.evidenceFile);
  } else {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }
  process.stdout.write(`[PASS] ${args.caseName}\n`);
  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  process.stderr.write(`[FAIL] ${error.message}\n`);
  process.exitCode = 1;
});
