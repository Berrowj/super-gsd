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
const CALLER_OCCURRENCE_RULES = Object.freeze([
  {
    id: 'board-tools',
    rel: 'super-gsd/agents/sgsd-board-researcher.md',
    text: 'tools: Read, Grep, Glob, Bash, mcp__vtp-kb__vtp_search, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_get_document, mcp__vtp-kb__vtp_route_and_retrieve',
    site: 'board-researcher',
  },
  {
    id: 'board-transport',
    rel: 'super-gsd/agents/sgsd-board-researcher.md',
    text: '- Call vtp_search_substrate only with the returned payload verbatim. Record that payload with the returned gateway_evidence. If preparation fails, do not issue a raw substrate call.',
    site: 'board-researcher',
  },
  {
    id: 'board-record',
    rel: 'super-gsd/agents/sgsd-board-researcher.md',
    text: 'tool: ' + String.fromCharCode(34) + 'mcp__vtp-kb__vtp_search_substrate' + String.fromCharCode(34),
    site: 'board-researcher',
  },
  {
    id: 'enrichment-record',
    rel: 'super-gsd/agents/sgsd-vtp-enrichment.md',
    text: 'tool: \'mcp__vtp-kb__vtp_search_substrate\',',
    site: 'enrichment-agent',
  },
  {
    id: 'enrichment-tools',
    rel: 'super-gsd/agents/sgsd-vtp-enrichment.md',
    text: 'tools: Read, Grep, Glob, Bash, Write, mcp__vtp-kb__vtp_search, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_route_and_retrieve, mcp__vtp-kb__vtp_advise_service_enrichment, mcp__vtp-kb__vtp_health_structured, mcp__vtp-kb__vtp_get_document',
    site: 'enrichment-agent',
  },
  {
    id: 'enrichment-policy',
    rel: 'super-gsd/agents/sgsd-vtp-enrichment.md',
    text: 'For tool 2/5, call vtp_search_substrate with substrate_call.payload verbatim. Do not construct or amend substrate arguments. Record the tool, exact payload, and matching substrate_call.gateway_evidence together. The production run() acceptance path validates that record against substrate_call and rejects missing evidence, digest drift, unfiltered payloads, and limit 6. If the envelope is missing or preparation failed, do not issue a raw substrate call.',
    site: 'enrichment-agent',
  },
  {
    id: 'enrichment-cascade',
    rel: 'super-gsd/agents/sgsd-vtp-enrichment.md',
    text: '3. Call `vtp_search_substrate` with the same seed (D-01 tool 2/5). Capture hits. Substrate is book/paper content \u2014 the operator\'s investment.',
    site: 'enrichment-agent',
  },
  {
    id: 'composer-canonical-tool',
    rel: 'super-gsd/scripts/lib/vtp-context-composer.cjs',
    text: 'const SUBSTRATE_TOOL = \'mcp__vtp-kb__vtp_search_substrate\';',
    site: 'composer-callVtp-seam',
  },
  {
    id: 'composer-short-tool',
    rel: 'super-gsd/scripts/lib/vtp-context-composer.cjs',
    text: 'const SUBSTRATE_TOOL_SHORT = \'vtp_search_substrate\';',
    site: 'composer-callVtp-seam',
  },
  {
    id: 'triage-canonical-tool',
    rel: 'super-gsd/scripts/sgsd-triage-runtime.cjs',
    text: 'const SEARCH_TOOL = \'mcp__vtp-kb__vtp_search_substrate\';',
    site: 'triage-fallback',
  },
  {
    id: 'triage-stage-tool',
    rel: 'super-gsd/scripts/sgsd-triage-runtime.cjs',
    text: 'const SEARCH_STAGE_TOOL = \'vtp_search_substrate\';',
    site: 'triage-fallback',
  },
  {
    id: 'installed-planner-transport',
    rel: 'super-gsd/tools/feature-propagation/audit.cjs',
    text: '\'Pass the returned payload verbatim to mcp__vtp-kb__vtp_search_substrate.\',',
    branch: 'installed-planner',
    site: 'installed-planner',
  },
  {
    id: 'installed-planner-tool',
    rel: 'super-gsd/tools/feature-propagation/audit.cjs',
    text: '\'mcp__vtp-kb__vtp_search_substrate\',',
    branch: 'installed-planner',
    site: 'installed-planner',
  },
  {
    id: 'installed-researcher-transport',
    rel: 'super-gsd/tools/feature-propagation/audit.cjs',
    text: '\'Pass the returned payload verbatim to mcp__vtp-kb__vtp_search_substrate.\',',
    branch: 'installed-phase-researcher',
    site: 'installed-phase-researcher',
  },
  {
    id: 'installed-researcher-tool',
    rel: 'super-gsd/tools/feature-propagation/audit.cjs',
    text: '\'mcp__vtp-kb__vtp_search_substrate\',',
    branch: 'installed-phase-researcher',
    site: 'installed-phase-researcher',
  },
  {
    id: 'installed-researcher-legacy-observation',
    rel: 'super-gsd/tools/feature-propagation/audit.cjs',
    text: '- mcp__vtp-kb__vtp_search_substrate',
    branch: 'installed-phase-researcher',
    site: 'installed-phase-researcher',
  },
  {
    id: 'architecture-map-branch',
    rel: 'super-gsd/tools/vtp-bridge/classify.cjs',
    text: 'tool: \'vtp_search_substrate\',',
    branch: 'architecture-challenge',
    site: 'architecture-challenge',
  },
  {
    id: 'book-map-branch',
    rel: 'super-gsd/tools/vtp-bridge/classify.cjs',
    text: 'tool: \'vtp_search_substrate\',',
    branch: 'book-lookup',
    site: 'book-lookup',
  },
]);
const JSON_QUOTE = String.fromCharCode(34);
const EVIDENCE_TOOL_ENUM_LINE = '        { '
  + JSON_QUOTE + 'type' + JSON_QUOTE + ': ' + JSON_QUOTE + 'string' + JSON_QUOTE
  + ', ' + JSON_QUOTE + 'enum' + JSON_QUOTE + ': ['
  + JSON_QUOTE + 'vtp_search_substrate' + JSON_QUOTE + ', '
  + JSON_QUOTE + 'wiki_search' + JSON_QUOTE + ', '
  + JSON_QUOTE + 'vtp_route_and_retrieve' + JSON_QUOTE + ', '
  + JSON_QUOTE + 'vtp_get_research' + JSON_QUOTE + '] },';
const DECLARATION_ALLOWLIST = Object.freeze({
  'super-gsd/scripts/lib/vtp-enrichment-gate.cjs': [
    /^  'mcp__vtp-kb__vtp_search_substrate',$/,
  ],
  'super-gsd/scripts/lib/demand-baseline-ledger.cjs': [
    /^  'vtp_search_substrate',$/,
    /^    surface: 'vtp_search_substrate',$/,
    /^      assert\.strictEqual\(row\.artefact_kind, 'vtp_search_substrate'\);$/,
  ],
  'super-gsd/scripts/lib/route-ledger.cjs': [
    /^        tool: 'vtp_search_substrate',$/,
    /^      lastRow15\.decision\.tool === 'vtp_search_substrate' &&$/,
  ],
  'super-gsd/tools/vtp-bridge/classify.cjs': [
    /^    \/\/ Assertion 1 \(F1\): architecture_challenge -> vtp_search_substrate, 3 results\.$/,
    /^      ok\('1\. F1 architecture_challenge -> vtp_search_substrate \(3 results\)'\);$/,
    /^    if \(toolName === 'vtp_search_substrate'\) \{$/,
    /^      if \(packet\.vtp_tool !== 'vtp_search_substrate'\) throw new Error\('vtp_tool=' \+ packet\.vtp_tool\);$/,
    /^      if \(packet\.vtp_tool !== 'vtp_search_substrate'\) throw new Error\('vtp_tool=' \+ packet\.vtp_tool\);$/,
    /^      if \(capturedArgs\.toolName !== 'vtp_search_substrate'\) throw new Error\('toolName=' \+ capturedArgs\.toolName\);$/,
  ],
  'super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json': [
    EVIDENCE_TOOL_ENUM_LINE,
  ],
});

function usage() {
  return [
    'Usage:',
    '  node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage',
    '  node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance',
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

function occurrenceBranch(rel, lineIndex, lines) {
  if (rel === 'super-gsd/tools/feature-propagation/audit.cjs') {
    const starts = new Map([
      ['    name: \'gsd-planner.md\',', 'installed-planner'],
      ['    name: \'gsd-phase-researcher.md\',', 'installed-phase-researcher'],
    ]);
    for (let index = lineIndex; index >= 0; index -= 1) {
      if (index < lineIndex && lines[index] === '  },') return null;
      if (starts.has(lines[index])) return starts.get(lines[index]);
    }
  }
  if (rel === 'super-gsd/tools/vtp-bridge/classify.cjs') {
    const starts = new Map([
      ['  architecture_challenge: Object.freeze({', 'architecture-challenge'],
      ['  book_lookup: Object.freeze({', 'book-lookup'],
    ]);
    for (let index = lineIndex; index >= 0; index -= 1) {
      if (index < lineIndex && lines[index] === '});') return null;
      if (starts.has(lines[index])) return starts.get(lines[index]);
    }
  }
  return null;
}

function classifyOccurrence(rel, lineIndex, lines, matchedCallerRules) {
  const text = lines[lineIndex].trim();
  for (const rule of CALLER_OCCURRENCE_RULES) {
    if (rule.rel !== rel || rule.text !== text) continue;
    if (rule.branch && occurrenceBranch(rel, lineIndex, lines) !== rule.branch) continue;
    if (matchedCallerRules.has(rule.id)) continue;
    matchedCallerRules.add(rule.id);
    return rule.site;
  }
  return null;
}

function isAllowedDeclaration(rel, line, matchedDeclarations) {
  const rules = DECLARATION_ALLOWLIST[rel] || [];
  for (let index = 0; index < rules.length; index += 1) {
    const key = rel + ':' + index;
    const matches = typeof rules[index] === 'string'
      ? rules[index] === line
      : rules[index].test(line);
    if (matchedDeclarations.has(key) || !matches) continue;
    matchedDeclarations.add(key);
    return true;
  }
  return false;
}

function auditCallerCoverage(root) {
  const sites = new Set();
  const unknown = [];
  const occurrences = [];
  const matchedCallerRules = new Set();
  const matchedDeclarations = new Set();
  for (const scanRoot of SCAN_ROOTS) {
    for (const file of walkFiles(path.join(root, scanRoot))) {
      const rel = toPosix(path.relative(root, file));
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, lineIndex) => {
        if (!line.includes('vtp_search_substrate')) return;
        const site = classifyOccurrence(rel, lineIndex, lines, matchedCallerRules);
        const occurrence = { rel, line: lineIndex + 1, text: line.trim(), site };
        occurrences.push(occurrence);
        if (site) sites.add(site);
        else if (!isAllowedDeclaration(rel, line, matchedDeclarations)) unknown.push(occurrence);
      });
    }
  }
  const missing = EXPECTED_SITES.filter((site) => !sites.has(site));
  const missingOccurrences = CALLER_OCCURRENCE_RULES
    .filter((rule) => !matchedCallerRules.has(rule.id))
    .map((rule) => rule.id);
  return {
    ok: unknown.length === 0 && missing.length === 0 && missingOccurrences.length === 0,
    sites,
    unknown,
    missing,
    missingOccurrences,
    occurrences,
  };
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
    report.missingOccurrences,
    [],
    'missing exact caller occurrences: ' + report.missingOccurrences.join(', ')
  );
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
    fs.rmSync(injected, { force: true });

    const knownFile = path.join(tempRoot, 'super-gsd', 'scripts', 'sgsd-triage-runtime.cjs');
    fs.appendFileSync(knownFile, '\nconst p166RogueKnownFileCall = \'vtp_search_substrate\';\n', 'utf8');
    const knownFileReport = auditCallerCoverage(tempRoot);
    assert.strictEqual(
      knownFileReport.ok,
      false,
      'a rogue occurrence inside an already-known caller file must fail closed'
    );
    assert.strictEqual(
      knownFileReport.unknown.some((row) => row.rel === 'super-gsd/scripts/sgsd-triage-runtime.cjs'),
      true,
      'the rogue known-file occurrence must be reported as unknown'
    );
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
  assert.match(enrichment, /substrateCall: substrate_call/);
  assert.match(board, /--prepare-substrate-call --intent board_research/);
  assert.match(board, /--accept-substrate-call-record --intent board_research/);
  assert.match(board, /gateway_evidence/);
  assert.match(audit, /<sgsd_vtp_substrate_policy_p166_phase_research>/);
  assert.match(audit, /--prepare-substrate-call --intent phase_research/);
  assert.match(audit, /--accept-substrate-call-record --intent phase_research/);
  assert.match(audit, /<sgsd_vtp_substrate_policy_p166_planning>/);
  assert.match(audit, /--prepare-substrate-call --intent planning/);
  assert.match(audit, /--accept-substrate-call-record --intent planning/);
  for (const source of [enrichment, board, audit]) {
    assert.doesNotMatch(source, /source_types\s*:\s*\[/, 'prompt callers must not own source_types arrays');
    assert.doesNotMatch(source, /\blimit\s*:\s*[1-9]/, 'prompt callers must not own limit literals');
  }
}

function toSubstrateCallRecord(preparedCall) {
  return JSON.parse(JSON.stringify(preparedCall));
}

function forgedPreparedCall(intent, payload) {
  return {
    tool: SEARCH_TOOL,
    payload,
    gateway_evidence: {
      schema_version: 'vtp-mcp-input-schemas.v2',
      intent_family: intent,
      payload_sha256: sha256Json(payload),
    },
  };
}

function assertPromptRecordAcceptance(composer, expected) {
  assertPromptContracts();
  assert.strictEqual(
    typeof composer.acceptPromptSubstrateCallRecord,
    'function',
    'production prompt-record acceptance must be exported'
  );

  const promptIntents = Object.freeze([
    ['enrichment-agent', 'enrichment'],
    ['board-researcher', 'board_research'],
    ['installed-phase-researcher', 'phase_research'],
    ['installed-planner', 'planning'],
  ]);
  const acceptedRecords = new Map();

  for (const [site, intent] of promptIntents) {
    const query = 'P166 ' + site + ' prompt acceptance query';
    const preparedCall = composer.prepareSubstrateCall(intent, { query });
    const record = toSubstrateCallRecord(preparedCall);
    const accepted = composer.acceptPromptSubstrateCallRecord(intent, preparedCall, record);
    assert.strictEqual(accepted.ok, true);
    assert.strictEqual(accepted.intent_family, intent);
    assert.strictEqual(accepted.payload_sha256, preparedCall.gateway_evidence.payload_sha256);
    acceptedRecords.set(site, record);

    assert.throws(
      () => composer.acceptPromptSubstrateCallRecord(intent, null, record),
      /prepared_call/,
      site + ' must reject a direct record without its prepared envelope'
    );
    assert.throws(
      () => composer.acceptPromptSubstrateCallRecord(intent, preparedCall, {
        tool: record.tool,
        payload: record.payload,
      }),
      /gateway_evidence/,
      site + ' must reject missing gateway evidence'
    );
    assert.throws(
      () => composer.acceptPromptSubstrateCallRecord(intent, preparedCall, {
        ...record,
        gateway_evidence: { ...record.gateway_evidence, payload_sha256: '0'.repeat(64) },
      }),
      /digest/,
      site + ' must reject a mismatched digest'
    );

    const unfiltered = forgedPreparedCall(intent, { query });
    assert.throws(
      () => composer.acceptPromptSubstrateCallRecord(intent, unfiltered, toSubstrateCallRecord(unfiltered)),
      /prepared_call/,
      site + ' must reject an unfiltered call even when its digest matches'
    );

    const limitSix = forgedPreparedCall(intent, {
      query,
      source_types: expected[intent].source_types.slice(),
      limit: 6,
    });
    assert.throws(
      () => composer.acceptPromptSubstrateCallRecord(intent, limitSix, toSubstrateCallRecord(limitSix)),
      /prepared_call/,
      site + ' must reject limit 6 even when its digest matches'
    );
  }

  const gate = require(gatePath);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-prompt-acceptance-'));
  try {
    const phaseDir = path.join(tempRoot, '.planning', 'milestones', 'fixture', 'phases', '166-fixture');
    writeFixtureFile(
      tempRoot,
      path.join('.planning', 'config.json'),
      JSON.stringify({ vtp_enrichment: { enabled: true } }) + '\n'
    );
    fs.mkdirSync(phaseDir, { recursive: true });
    const gateInput = {
      projectDir: tempRoot,
      phaseDir,
      phase: '166',
      phaseContext: 'P166 real prompt acceptance path',
    };
    const pending = gate.run(gateInput);
    const preparedCall = pending.sub_agent_spec.substrate_call;
    const record = toSubstrateCallRecord(preparedCall);
    const result = {
      ok: true,
      status: 'success',
      query_count: 2,
      total_hits: 1,
      duration_ms: 1,
      hits: [{ source: 'book', title: 'Fixture', section: '1', relevance: 'high', citation: 'fixture:1' }],
      gaps: [],
      alt_framings: [],
      rationale: '',
      substrate_call_record: record,
    };

    assert.throws(
      () => gate.run({ ...gateInput, enrichmentResult: { ...result, substrate_call_record: undefined } }),
      /substrate_call_record/,
      'the real enrichment acceptance path must reject a missing record'
    );
    assert.throws(
      () => gate.run({ ...gateInput, enrichmentResult: result }),
      /prepared_call/,
      'the real enrichment acceptance path must reject a direct record without the dispatch envelope'
    );
    assert.throws(
      () => gate.run({
        ...gateInput,
        substrateCall: preparedCall,
        enrichmentResult: {
          ...result,
          substrate_call_record: {
            ...record,
            gateway_evidence: { ...record.gateway_evidence, payload_sha256: 'f'.repeat(64) },
          },
        },
      }),
      /digest/,
      'the real enrichment acceptance path must reject mismatched evidence'
    );
    assert.throws(
      () => gate.run({
        ...gateInput,
        substrateCall: preparedCall,
        enrichmentResult: {
          ...result,
          substrate_call_record: { tool: record.tool, payload: record.payload },
        },
      }),
      /gateway_evidence/,
      'the real enrichment acceptance path must reject missing gateway evidence'
    );

    const unfiltered = forgedPreparedCall('enrichment', { query: preparedCall.payload.query });
    assert.throws(
      () => gate.run({
        ...gateInput,
        substrateCall: unfiltered,
        enrichmentResult: { ...result, substrate_call_record: toSubstrateCallRecord(unfiltered) },
      }),
      /prepared_call/,
      'the real enrichment acceptance path must reject an unfiltered record'
    );

    const limitSix = forgedPreparedCall('enrichment', {
      query: preparedCall.payload.query,
      source_types: expected.enrichment.source_types.slice(),
      limit: 6,
    });
    assert.throws(
      () => gate.run({
        ...gateInput,
        substrateCall: limitSix,
        enrichmentResult: { ...result, substrate_call_record: toSubstrateCallRecord(limitSix) },
      }),
      /prepared_call/,
      'the real enrichment acceptance path must reject limit 6'
    );

    const accepted = gate.run({ ...gateInput, substrateCall: preparedCall, enrichmentResult: result });
    assert.strictEqual(accepted.status, 'success');
    assert(fs.existsSync(accepted.artifact_path));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  return acceptedRecords;
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

  for (const [site, record] of assertPromptRecordAcceptance(composer, expected)) {
    captures.set(site, record);
  }
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
  else if (caseName === 'prompt-record-acceptance') {
    const composer = require(composerPath);
    const expected = Object.fromEntries(Object.entries(composer.SUBSTRATE_CALL_POLICY).map(([intent, policy]) => [
      intent,
      { source_types: policy.source_types.slice(), limit: policy.limit },
    ]));
    assertPromptRecordAcceptance(composer, expected);
  }
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
