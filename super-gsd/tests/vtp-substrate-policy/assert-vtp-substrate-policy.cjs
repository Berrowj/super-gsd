#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const composerPath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'vtp-context-composer.cjs');
const gatePath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'vtp-enrichment-gate.cjs');
const auditPath = path.join(repoRoot, 'super-gsd', 'tools', 'feature-propagation', 'audit.cjs');
const bridgePath = path.join(repoRoot, 'super-gsd', 'tools', 'vtp-bridge', 'classify.cjs');
const v2SchemaPath = path.join(repoRoot, 'super-gsd', 'schemas', 'vtp-mcp-input-schemas.v2.json');
const Ajv = require(path.join(repoRoot, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'ajv'));

const SEARCH_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const SHORT_SEARCH_TOOL = 'vtp_search_substrate';
const EXPECTED_SITES = Object.freeze([
  'enrichment-agent',
  'board-researcher',
  'installed-phase-researcher',
  'installed-planner',
  'triage-fallback',
  'architecture-challenge',
  'book-lookup',
  'composer-callVtp-seam',
]);
const SCAN_ROOTS = Object.freeze([
  'super-gsd/agents',
  'super-gsd/skills',
  'super-gsd/scripts',
  'super-gsd/tools',
]);
const DECLARATION_ALLOWLIST = Object.freeze({
  'super-gsd/scripts/lib/vtp-enrichment-gate.cjs': [/VTP_TOOLS/, /mcp__vtp-kb__vtp_search_substrate/],
  'super-gsd/scripts/lib/demand-baseline-ledger.cjs': [/.*/],
  'super-gsd/scripts/lib/route-ledger.cjs': [/.*/],
  'super-gsd/tools/vtp-bridge/classify.cjs': [
    /^    \/\/ Assertion 1 \(F1\): architecture_challenge -> vtp_search_substrate, 3 results\.$/,
    /^      ok\('1\. F1 architecture_challenge -> vtp_search_substrate \(3 results\)'\);$/,
  ],
  'super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json': [/.*/],
});

function usage() {
  return [
    'Usage:',
    '  node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage',
    '  node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 2 && argv[0] === '--case' && argv[1]) return argv[1];
  throw new Error('expected exactly --case <name>');
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function walkFiles(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(target));
    else if (entry.isFile()) out.push(target);
  }
  return out;
}

function nearestBranch(lines, lineIndex, branches) {
  for (let index = lineIndex; index >= 0; index -= 1) {
    for (const branch of branches) {
      if (lines[index].includes(branch[0])) return branch[1];
    }
  }
  return null;
}

function classifyOccurrence(rel, lineIndex, lines) {
  if (rel === 'super-gsd/agents/sgsd-vtp-enrichment.md') return 'enrichment-agent';
  if (rel === 'super-gsd/agents/sgsd-board-researcher.md') return 'board-researcher';
  if (rel === 'super-gsd/scripts/sgsd-triage-runtime.cjs') return 'triage-fallback';
  if (rel === 'super-gsd/scripts/lib/vtp-context-composer.cjs') return 'composer-callVtp-seam';
  if (rel === 'super-gsd/tools/feature-propagation/audit.cjs') {
    return nearestBranch(lines, lineIndex, [
      [/name: 'gsd-planner.md'/.source, 'installed-planner'],
      [/name: 'gsd-phase-researcher.md'/.source, 'installed-phase-researcher'],
    ]);
  }
  if (rel === 'super-gsd/tools/vtp-bridge/classify.cjs') {
    const line = lines[lineIndex];
    if (/Assertion 1|F1 architecture_challenge|Assertion 4|F4 book_lookup/.test(line)) return null;
    return nearestBranch(lines, lineIndex, [
      ['architecture_challenge:', 'architecture-challenge'],
      ['book_lookup:', 'book-lookup'],
    ]);
  }
  return null;
}

function isAllowedDeclaration(rel, line) {
  const rules = DECLARATION_ALLOWLIST[rel];
  return Boolean(rules && rules.some((rule) => rule.test(line)));
}

function auditCallerCoverage(root) {
  const sites = new Set();
  const unknown = [];
  const occurrences = [];
  for (const scanRoot of SCAN_ROOTS) {
    for (const file of walkFiles(path.join(root, scanRoot))) {
      const rel = toPosix(path.relative(root, file));
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, lineIndex) => {
        if (!line.includes('vtp_search_substrate')) return;
        const site = classifyOccurrence(rel, lineIndex, lines);
        const occurrence = { rel, line: lineIndex + 1, text: line.trim(), site };
        occurrences.push(occurrence);
        if (site) sites.add(site);
        else if (!isAllowedDeclaration(rel, line)) unknown.push(occurrence);
      });
    }
  }
  const missing = EXPECTED_SITES.filter((site) => !sites.has(site));
  return { ok: unknown.length === 0 && missing.length === 0, sites, unknown, missing, occurrences };
}

function copyScanSurface(targetRoot) {
  for (const rel of SCAN_ROOTS) {
    const source = path.join(repoRoot, rel);
    const target = path.join(targetRoot, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
  }
}

function assertCallerCoverage() {
  const report = auditCallerCoverage(repoRoot);
  assert.deepStrictEqual(report.missing, [], 'missing caller classifications: ' + report.missing.join(', '));
  assert.deepStrictEqual(
    report.unknown,
    [],
    'unclassified substrate occurrences: ' + report.unknown.map((row) => row.rel + ':' + row.line).join(', ')
  );
  assert.deepStrictEqual([...report.sites].sort(), [...EXPECTED_SITES].sort());

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-caller-coverage-'));
  try {
    copyScanSurface(tempRoot);
    const injected = path.join(tempRoot, 'super-gsd', 'scripts', 'p166-unclassified.cjs');
    const quote = String.fromCharCode(39);
    fs.writeFileSync(injected, 'const tool = ' + quote + 'vtp_search_substrate' + quote + ';\n', 'utf8');
    const injectedReport = auditCallerCoverage(tempRoot);
    assert.strictEqual(injectedReport.ok, false, 'an injected unclassified emitter must fail closed');
    assert.strictEqual(injectedReport.unknown.length, 1);
    assert.strictEqual(injectedReport.unknown[0].rel, 'super-gsd/scripts/p166-unclassified.cjs');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function loadV2Validator() {
  const authority = JSON.parse(fs.readFileSync(v2SchemaPath, 'utf8'));
  assert.strictEqual(authority.version_id, 'vtp-mcp-input-schemas.v2');
  const declaration = authority.tools && authority.tools[SEARCH_TOOL];
  assert(declaration && declaration.inputSchema, 'v2 substrate schema declaration missing');
  return new Ajv({ allErrors: true, strict: true }).compile(declaration.inputSchema);
}

function sha256Json(payload) {
  return crypto.createHash('sha256').update(Buffer.from(JSON.stringify(payload), 'utf8')).digest('hex');
}

function assertPreparedEnvelope(envelope, intent, expectedPolicy, validate) {
  assert.deepStrictEqual(Object.keys(envelope), ['tool', 'payload', 'gateway_evidence']);
  assert.strictEqual(envelope.tool, SEARCH_TOOL);
  assert.strictEqual(envelope.gateway_evidence.schema_version, 'vtp-mcp-input-schemas.v2');
  assert.strictEqual(envelope.gateway_evidence.intent_family, intent);
  assert.strictEqual(envelope.gateway_evidence.payload_sha256, sha256Json(envelope.payload));
  assert.deepStrictEqual(envelope.payload.source_types, expectedPolicy.source_types);
  assert.strictEqual(envelope.payload.limit, expectedPolicy.limit);
  assert.strictEqual(validate(envelope.payload), true, JSON.stringify(validate.errors || []));
}

async function capturePreparedCall(label, intent, expectedPolicy, composer, validate, tool = SEARCH_TOOL) {
  const query = 'P166 ' + label + ' validated substrate query';
  const envelope = composer.prepareSubstrateCall(intent, { query });
  assertPreparedEnvelope(envelope, intent, expectedPolicy, validate);
  const calls = [];
  const result = await composer.callVtp(tool, {
    rawQuery: query,
    substrateCall: envelope,
    projectDir: repoRoot,
    logRoot: path.join(os.tmpdir(), 'p166-' + label + '-missing-root'),
    skillOrAgent: 'p166-' + label,
    tier: 'research',
    mcpInvoke: (calledTool, payload) => {
      calls.push({ tool: calledTool, payload });
      return { hits: [] };
    },
  });
  assert.strictEqual(result.ok, true, label + ' call should pass through the gateway');
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].tool, tool);
  assert.deepStrictEqual(calls[0].payload, envelope.payload);
  assert.deepStrictEqual(result.gateway_evidence, envelope.gateway_evidence);
  return envelope;
}

function assertPromptContracts() {
  const enrichment = fs.readFileSync(path.join(repoRoot, 'super-gsd', 'agents', 'sgsd-vtp-enrichment.md'), 'utf8');
  const board = fs.readFileSync(path.join(repoRoot, 'super-gsd', 'agents', 'sgsd-board-researcher.md'), 'utf8');
  const audit = fs.readFileSync(auditPath, 'utf8');
  assert.match(enrichment, /substrate_call\.payload/);
  assert.match(enrichment, /gateway_evidence/);
  assert.match(board, /--prepare-substrate-call --intent board_research/);
  assert.match(board, /gateway_evidence/);
  assert.match(audit, /<sgsd_vtp_substrate_policy_p166_phase_research>/);
  assert.match(audit, /--prepare-substrate-call --intent phase_research/);
  assert.match(audit, /<sgsd_vtp_substrate_policy_p166_planning>/);
  assert.match(audit, /--prepare-substrate-call --intent planning/);
  for (const source of [enrichment, board, audit]) {
    assert.doesNotMatch(source, /source_types\s*:\s*\[/, 'prompt callers must not own source_types arrays');
    assert.doesNotMatch(source, /\blimit\s*:\s*[1-9]/, 'prompt callers must not own limit literals');
  }
}

function writeFixtureFile(root, rel, content) {
  const target = path.resolve(root, rel);
  const relative = path.relative(root, target);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

function assertComposerCli() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-composer-cli-'));
  try {
    writeFixtureFile(tempRoot, path.join('.planning', 'STATE.md'), '---\nmilestone: fixture\ncurrent_phase: 166\n---\n');
    const inputRel = path.join('.planning', 'tmp', 'board-input.json');
    writeFixtureFile(
      tempRoot,
      inputRel,
      JSON.stringify({ query: 'board CLI prepared query', topics: ['policy'] }) + '\n'
    );
    const ok = childProcess.spawnSync(process.execPath, [
      composerPath,
      '--prepare-substrate-call',
      '--intent', 'board_research',
      '--input-file', inputRel,
    ], { cwd: tempRoot, encoding: 'utf8', windowsHide: true });
    assert.strictEqual(ok.status, 0, ok.stderr);
    const envelope = JSON.parse(ok.stdout);
    assert.strictEqual(envelope.gateway_evidence.intent_family, 'board_research');
    assert.strictEqual(envelope.payload.payload_sha256, undefined);

    const outside = path.join(os.tmpdir(), 'p166-outside-' + process.pid + '.json');
    fs.writeFileSync(outside, JSON.stringify({ query: 'outside query' }), 'utf8');
    try {
      const refused = childProcess.spawnSync(process.execPath, [
        composerPath,
        '--prepare-substrate-call',
        '--intent', 'board_research',
        '--input-file', outside,
      ], { cwd: tempRoot, encoding: 'utf8', windowsHide: true });
      assert.notStrictEqual(refused.status, 0);
      assert.strictEqual(refused.stdout.trim(), '', 'refused CLI input must not emit an envelope');
    } finally {
      fs.rmSync(outside, { force: true });
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function assertRepairSafePatches() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-p166-profile-'));
  const oldUserProfile = process.env.USERPROFILE;
  const oldHome = process.env.HOME;
  try {
    process.env.USERPROFILE = tempRoot;
    process.env.HOME = tempRoot;
    const agentsDir = path.join(tempRoot, '.claude', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'gsd-phase-researcher.md'),
      '---\ntools: Read\n---\n<sgsd_vtp_research_contract>\nlegacy P16 contract\n</sgsd_vtp_research_contract>\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(agentsDir, 'gsd-planner.md'),
      '---\ntools: Read\n---\n<sgsd_vtp_enrichment_contract>\nlegacy P16 contract\n</sgsd_vtp_enrichment_contract>\n',
      'utf8'
    );
    const projectDir = path.join(tempRoot, 'fixture-project');
    writeFixtureFile(
      projectDir,
      path.join('.planning', 'config.json'),
      JSON.stringify({ workflow: {}, review_providers: {} }) + '\n'
    );
    delete require.cache[require.resolve(auditPath)];
    const audit = require(auditPath);
    const report = audit.runAudit({ projectDir, repairSafe: true });
    const researcher = fs.readFileSync(path.join(agentsDir, 'gsd-phase-researcher.md'), 'utf8');
    const planner = fs.readFileSync(path.join(agentsDir, 'gsd-planner.md'), 'utf8');
    assert.match(researcher, /<sgsd_vtp_substrate_policy_p166_phase_research>/);
    assert.match(planner, /<sgsd_vtp_substrate_policy_p166_planning>/);
    const rows = new Map(report.global_legacy_agents.map((row) => [row.name, row]));
    assert.strictEqual(rows.get('gsd-phase-researcher.md').p166_patched, true);
    assert.strictEqual(rows.get('gsd-planner.md').p166_patched, true);
  } finally {
    if (oldUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = oldUserProfile;
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function assertExecutableEmitters() {
  delete require.cache[require.resolve(composerPath)];
  const composer = require(composerPath);
  assert.strictEqual(typeof composer.buildSubstrateArgs, 'function');
  assert.strictEqual(typeof composer.prepareSubstrateCall, 'function');
  assert(Object.isFrozen(composer.SUBSTRATE_CALL_POLICY));
  for (const entry of Object.values(composer.SUBSTRATE_CALL_POLICY)) {
    assert(Object.isFrozen(entry));
    assert(Object.isFrozen(entry.source_types));
  }

  const expected = Object.freeze({
    triage: { source_types: ['research_paper', 'wiki_page'], limit: 3 },
    phase_research: { source_types: ['research_paper', 'wiki_page'], limit: 5 },
    planning: { source_types: ['research_paper', 'wiki_page'], limit: 5 },
    enrichment: { source_types: ['research_paper', 'wiki_page'], limit: 5 },
    board_research: { source_types: ['research_paper', 'wiki_page'], limit: 5 },
    architecture_challenge: { source_types: ['research_paper', 'wiki_page'], limit: 3 },
    book_lookup: { source_types: ['wiki_page'], limit: 5 },
  });
  assert.deepStrictEqual(Object.keys(composer.SUBSTRATE_CALL_POLICY).sort(), Object.keys(expected).sort());
  const validate = loadV2Validator();
  const captures = new Map();

  const first = composer.buildSubstrateArgs('triage', { query: 'fresh array proof' });
  const second = composer.buildSubstrateArgs('triage', { query: 'fresh array proof' });
  assert.notStrictEqual(first.source_types, second.source_types);
  assert.throws(() => composer.buildSubstrateArgs('unknown', { query: 'valid query' }), /intent/);
  assert.throws(() => composer.buildSubstrateArgs('triage', { query: 'ab' }), /query/);
  assert.throws(() => composer.buildSubstrateArgs('triage', { query: 'valid query', limit: 2 }), /limit/);
  assert.throws(
    () => composer.buildSubstrateArgs('triage', { query: 'valid query', source_types: ['wiki_page'] }),
    /source_types/
  );
  assert.throws(() => composer.buildSubstrateArgs('triage', { query: 'valid query', unsupported: [] }), /unsupported/);
  const secondary = composer.buildSubstrateArgs('triage', {
    query: 'secondary filters proof',
    entity_types: ['principle'],
    project_ids: ['p166'],
    speaker_ids: ['speaker'],
    topics: ['substrate'],
    meeting_ids: ['meeting'],
  });
  assert.deepStrictEqual(secondary.entity_types, ['principle']);

  captures.set(
    'enrichment-agent',
    await capturePreparedCall('enrichment', 'enrichment', expected.enrichment, composer, validate)
  );
  captures.set(
    'board-researcher',
    await capturePreparedCall('board', 'board_research', expected.board_research, composer, validate)
  );
  captures.set(
    'installed-phase-researcher',
    await capturePreparedCall('phase', 'phase_research', expected.phase_research, composer, validate)
  );
  captures.set(
    'installed-planner',
    await capturePreparedCall('planning', 'planning', expected.planning, composer, validate)
  );
  captures.set(
    'triage-fallback',
    await capturePreparedCall('triage', 'triage', expected.triage, composer, validate)
  );
  captures.set(
    'composer-callVtp-seam',
    await capturePreparedCall('composer', 'triage', expected.triage, composer, validate, SHORT_SEARCH_TOOL)
  );

  const gate = require(gatePath);
  const gateSpec = gate._internal.composeSubAgentSpec({
    phase: '166',
    phaseContext: 'P166 enrichment phase context',
  });
  assertPreparedEnvelope(gateSpec.substrate_call, 'enrichment', expected.enrichment, validate);
  assertPromptContracts();
  assertComposerCli();
  assertRepairSafePatches();

  delete require.cache[require.resolve(bridgePath)];
  const bridge = require(bridgePath);
  let architectureCapture = null;
  const architecture = await bridge.selectiveVTPCall({
    uncertainty_type: 'architecture_challenge',
    query: 'P166 architecture challenge query',
    planningDir: path.join(os.tmpdir(), 'p166-bridge-arch-' + process.pid, '.planning'),
    _force_vtp_health: true,
    _force_vtp_tool_response(tool, payload) {
      architectureCapture = { tool, payload };
      return {
        results: [
          { doc_id: 'paper-1', rel_path: 'wiki/research/paper.md', citation: 'paper citation' },
        ],
      };
    },
  });
  assert.strictEqual(architecture.ok, true);
  assert.strictEqual(architectureCapture.tool, SHORT_SEARCH_TOOL);
  assert.deepStrictEqual(
    architectureCapture.payload.source_types,
    expected.architecture_challenge.source_types
  );
  assert.strictEqual(architectureCapture.payload.limit, expected.architecture_challenge.limit);
  assert.strictEqual(validate(architectureCapture.payload), true);
  captures.set('architecture-challenge', architectureCapture);

  let bookCapture = null;
  const book = await bridge.selectiveVTPCall({
    uncertainty_type: 'book_lookup',
    query: 'P166 book lookup query',
    planningDir: path.join(os.tmpdir(), 'p166-bridge-book-' + process.pid, '.planning'),
    _force_vtp_health: true,
    _force_vtp_tool_response(tool, payload) {
      bookCapture = { tool, payload };
      return {
        results: [
          { doc_id: 'book-1', rel_path: 'wiki/books/book-one.md', citation: 'book citation' },
          { doc_id: 'meeting-1', rel_path: 'wiki/meetings/not-a-book.md', citation: 'meeting citation' },
        ],
      };
    },
  });
  assert.strictEqual(book.ok, true);
  assert.strictEqual(book.results.length, 1);
  assert.strictEqual(book.results[0].doc_id, 'book-1');
  assert.deepStrictEqual(bookCapture.payload.source_types, expected.book_lookup.source_types);
  assert.strictEqual(bookCapture.payload.limit, expected.book_lookup.limit);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(bookCapture.payload, 'resource_subtype_filter'), false);
  assert.strictEqual(validate(bookCapture.payload), true);
  captures.set('book-lookup', bookCapture);

  let invalidShimCalls = 0;
  const validBook = composer.prepareSubstrateCall('book_lookup', { query: 'invalid bridge payload proof' });
  const forgedPayload = { ...validBook.payload, limit: 6 };
  const forgedBook = {
    ...validBook,
    payload: forgedPayload,
    gateway_evidence: { ...validBook.gateway_evidence, payload_sha256: sha256Json(forgedPayload) },
  };
  const invalidBook = await bridge.selectiveVTPCall({
    uncertainty_type: 'book_lookup',
    query: 'invalid bridge payload proof',
    planningDir: path.join(os.tmpdir(), 'p166-bridge-invalid-' + process.pid, '.planning'),
    _force_vtp_health: true,
    _force_substrate_call: forgedBook,
    _force_vtp_tool_response() {
      invalidShimCalls += 1;
      return { results: [] };
    },
  });
  assert.strictEqual(invalidBook.ok, false);
  assert.strictEqual(invalidShimCalls, 0, 'invalid prepared bridge payload must not enter the dispatch shim');
  assert(invalidBook.reason_codes.includes('vtp_call_validation_failed'));
  assert.deepStrictEqual([...captures.keys()].sort(), [...EXPECTED_SITES].sort());
}

async function main(argv = process.argv.slice(2)) {
  const caseName = parseArgs(argv);
  if (caseName === 'caller-coverage') assertCallerCoverage();
  else if (caseName === 'executable-emitters') await assertExecutableEmitters();
  else {
    process.stderr.write(usage() + '\n');
    return 2;
  }
  process.stdout.write('[PASS] ' + caseName + '\n');
  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  process.stderr.write('[FAIL] ' + (error.stack || error.message) + '\n');
  process.exitCode = 1;
});

module.exports = { auditCallerCoverage };
