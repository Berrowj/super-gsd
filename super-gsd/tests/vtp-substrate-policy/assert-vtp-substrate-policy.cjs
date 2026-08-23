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
const witnessStorePath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'substrate-invocation-witness-store.cjs');
const gatePath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'vtp-enrichment-gate.cjs');
const auditPath = path.join(repoRoot, 'super-gsd', 'tools', 'feature-propagation', 'audit.cjs');
const bridgePath = path.join(repoRoot, 'super-gsd', 'tools', 'vtp-bridge', 'classify.cjs');
const v2SchemaPath = path.join(repoRoot, 'super-gsd', 'schemas', 'vtp-mcp-input-schemas.v2.json');
const Ajv = require(path.join(repoRoot, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'ajv'));
const yaml = require(path.join(repoRoot, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'js-yaml'));

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
const PROMPT_SITES = Object.freeze([
  ['enrichment-agent', 'enrichment'],
  ['board-researcher', 'board_research'],
  ['installed-phase-researcher', 'phase_research'],
  ['installed-planner', 'planning'],
]);
const SCAN_ROOTS = Object.freeze([
  'super-gsd/agents',
  'super-gsd/skills',
  'super-gsd/scripts',
  'super-gsd/tools',
]);
const CALLER_OCCURRENCE_RULES = Object.freeze([
  {
    id: 'board-witness-tool',
    rel: 'super-gsd/agents/sgsd-board-researcher.md',
    text: '`mcp__vtp-kb__vtp_search_substrate`. If readiness is missing, stale,',
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
    id: 'enrichment-witness-tool',
    rel: 'super-gsd/agents/sgsd-vtp-enrichment.md',
    text: '`mcp__vtp-kb__vtp_search_substrate`. If readiness is missing, stale,',
    site: 'enrichment-agent',
  },
  {
    id: 'enrichment-policy',
    rel: 'super-gsd/agents/sgsd-vtp-enrichment.md',
    text: 'For tool 2/5, call vtp_search_substrate with substrate_call.payload verbatim. Do not construct or amend substrate arguments. Record the tool, exact payload, and matching substrate_call.gateway_evidence together. The production acceptance path validates that record against substrate_call and rejects missing evidence, digest drift, unfiltered payloads, and P166 policy drift. If the envelope is missing or preparation failed, do not issue a raw substrate call.',
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
    text: 'substrateTool: \'mcp__vtp-kb__vtp_search_substrate\',',
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
    text: 'substrateTool: \'mcp__vtp-kb__vtp_search_substrate\',',
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
    '  node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case megachunk-degraded-artifact',
    '  node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case cap-shapes',
    '  node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case repair-safe-t2',
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
    if (entry.isDirectory() && entry.name === 'node_modules') continue;
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
    const injected = path.join(tempRoot, 'super-gsd', 'scripts', 'p166-unclassified.cjs');
    fs.mkdirSync(path.dirname(injected), { recursive: true });
    const quote = String.fromCharCode(39);
    fs.writeFileSync(injected, 'const tool = ' + quote + 'vtp_search_substrate' + quote + ';\n', 'utf8');
    const knownFile = path.join(tempRoot, 'super-gsd', 'scripts', 'sgsd-triage-runtime.cjs');
    fs.writeFileSync(knownFile, 'const p166RogueKnownFileCall = \'vtp_search_substrate\';\n', 'utf8');
    const injectedReport = auditCallerCoverage(tempRoot);
    assert.strictEqual(injectedReport.ok, false, 'an injected unclassified emitter must fail closed');
    assert.strictEqual(
      injectedReport.unknown.some((row) => row.rel === 'super-gsd/scripts/p166-unclassified.cjs'),
      true,
      'a rogue occurrence in a new file must be reported as unknown'
    );
    assert.strictEqual(
      injectedReport.unknown.some((row) => row.rel === 'super-gsd/scripts/sgsd-triage-runtime.cjs'),
      true,
      'a rogue occurrence inside an already-known caller file must be reported as unknown'
    );
    fs.rmSync(injected, { force: true });
    fs.rmSync(knownFile, { force: true });

    const ignored = path.join(tempRoot, 'super-gsd', 'scripts', 'node_modules', 'p166-ignored.cjs');
    fs.mkdirSync(path.dirname(ignored), { recursive: true });
    fs.writeFileSync(ignored, 'const ignoredTool = \'vtp_search_substrate\';\n', 'utf8');
    const ignoredReport = auditCallerCoverage(tempRoot);
    assert.strictEqual(
      ignoredReport.unknown.some((row) => row.rel.includes('/node_modules/')),
      false,
      'node_modules must be excluded from caller coverage'
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

function createPromptWitnessFixture(projectRoot) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p167-prompt-witness-'));
  const project = projectRoot ? path.resolve(projectRoot) : path.join(root, 'project');
  const profile = path.join(root, 'profile');
  fs.mkdirSync(path.join(project, '.planning', 'metrics'), { recursive: true });
  fs.writeFileSync(
    path.join(project, '.planning', 'STATE.md'),
    '---\nmilestone: fixture\ncurrent_phase: 167\n---\n',
    'utf8'
  );
  fs.mkdirSync(profile, { recursive: true });
  const env = {
    ...process.env,
    HOME: profile,
    USERPROFILE: profile,
    APPDATA: path.join(profile, 'AppData', 'Roaming'),
    XDG_CONFIG_HOME: path.join(profile, '.config'),
  };
  const witnessStore = require(witnessStorePath);
  witnessStore.provisionWitnessKey(project, env);
  return {
    root,
    project,
    env,
    witnessStore,
    sessionId: 'p167-policy-direct-session',
    nextToolUse: 0,
  };
}

function withPromptWitnessFixture(fn, projectRoot) {
  const witnessFixture = createPromptWitnessFixture(projectRoot);
  try {
    return fn(witnessFixture);
  } finally {
    fs.rmSync(witnessFixture.root, { recursive: true, force: true });
  }
}

function seedPromptWitness(witnessFixture, composer, preparedCall) {
  witnessFixture.nextToolUse += 1;
  const payloadDigest = composer.substratePayloadDigest(preparedCall.payload);
  const toolUseId = 'p167-policy-tool-use-' + witnessFixture.nextToolUse;
  const sourceDigest = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(repoRoot, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs')))
    .digest('hex');
  witnessFixture.witnessStore.createPreWitness({
    projectRoot: witnessFixture.project,
    env: witnessFixture.env,
    sessionId: witnessFixture.sessionId,
    toolUseId,
    payloadDigest,
    sourceDigest,
  });
  witnessFixture.witnessStore.transitionWitnessToRewritten({
    projectRoot: witnessFixture.project,
    env: witnessFixture.env,
    sessionId: witnessFixture.sessionId,
    toolUseId,
    payloadDigest,
    responseDigest: sha256Json({ hits: [] }),
    degradationCount: 0,
    originalChars: 0,
    retainedChars: 0,
    topLevelHitCount: 0,
    evidenceHitCount: 0,
  });
}

function activatePromptWitnessRuntime(witnessFixture) {
  const previousCwd = process.cwd();
  const keys = ['HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME', 'CLAUDE_CODE_SESSION_ID'];
  const previous = new Map(keys.map((key) => [
    key,
    { present: Object.prototype.hasOwnProperty.call(process.env, key), value: process.env[key] },
  ]));
  process.chdir(witnessFixture.project);
  for (const key of keys.slice(0, 4)) process.env[key] = witnessFixture.env[key];
  process.env.CLAUDE_CODE_SESSION_ID = witnessFixture.sessionId;
  return () => {
    process.chdir(previousCwd);
    for (const [key, state] of previous) {
      if (state.present) process.env[key] = state.value;
      else delete process.env[key];
    }
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

async function assertMegachunkDegradedArtifact() {
  const retainedPrefix = 'R'.repeat(16000);
  const discardedMarker = 'P166_DISCARDED_SUFFIX';
  const oversizedText = retainedPrefix
    + 'X'.repeat(900001 - retainedPrefix.length - discardedMarker.length)
    + discardedMarker;
  const fixture = deepFreeze({
    hits: [
      {
        doc_id: 'doc:lint-report',
        chunk_id: 'chunk:lint-report',
        rel_path: 'wiki/LINT-REPORT.md',
        source: 'wiki',
        title: 'LINT report',
        section: 'full report',
        relevance: 'high',
        citation: 'doc:lint-report',
        text: oversizedText,
      },
      {
        doc_id: 'doc:small-control',
        chunk_id: 'chunk:small-control',
        rel_path: 'wiki/SMALL.md',
        source: 'wiki',
        title: 'Small control',
        section: 'summary',
        relevance: 'medium',
        citation: 'doc:small-control',
        text: 'small second hit stays intact',
      },
    ],
    total_hits: 2,
  });
  const fixtureHash = sha256Json(fixture);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-megachunk-'));
  try {
    writeFixtureFile(
      tempRoot,
      path.join('.planning', 'STATE.md'),
      '---\nmilestone: fixture\ncurrent_phase: 166\n---\n'
    );
    writeFixtureFile(
      tempRoot,
      path.join('.planning', 'config.json'),
      JSON.stringify({ vtp_enrichment: { enabled: true } }) + '\n'
    );
    const phaseDir = path.join(tempRoot, '.planning', 'milestones', 'fixture', 'phases', '166-megachunk');
    fs.mkdirSync(phaseDir, { recursive: true });

    delete require.cache[require.resolve(composerPath)];
    delete require.cache[require.resolve(gatePath)];
    const composer = require(composerPath);
    const gate = require(gatePath);
    const gateInput = {
      projectDir: tempRoot,
      phaseDir,
      phase: '166',
      phaseContext: 'P166 megachunk degraded artifact fixture',
    };
    const pending = gate.run(gateInput);
    const substrateCall = pending.sub_agent_spec.substrate_call;
    const callResult = await composer.callVtp(SEARCH_TOOL, {
      rawQuery: substrateCall.payload.query,
      substrateCall,
      projectDir: tempRoot,
      logRoot: tempRoot,
      skillOrAgent: 'p166-megachunk-fixture',
      tier: 'research',
      mcpInvoke: () => fixture,
    });
    assert.strictEqual(callResult.ok, true, 'oversized substrate retrieval must remain usable');
    assert.deepStrictEqual(
      callResult.gateway_evidence,
      substrateCall.gateway_evidence,
      'capped call must retain composer gateway evidence'
    );

    const written = withPromptWitnessFixture((witnessFixture) => {
      witnessFixture.sessionId = 'p167-megachunk-session';
      seedPromptWitness(witnessFixture, composer, substrateCall);
      const restoreRuntime = activatePromptWitnessRuntime(witnessFixture);
      try {
        return gate.run({
          ...gateInput,
          substrateCall,
          enrichmentResult: {
            ok: callResult.ok,
            status: 'success',
            query_count: 1,
            total_hits: callResult.response.total_hits,
            duration_ms: callResult.elapsed_ms,
            hits: callResult.response.hits,
            degradation_notes: callResult.degradation_notes || [],
            gaps: [],
            alt_framings: [],
            rationale: '',
            substrate_call_record: toSubstrateCallRecord(substrateCall),
          },
        });
      } finally {
        restoreRuntime();
      }
    }, tempRoot);
    assert.strictEqual(written.status, 'success');
    assert.strictEqual(sha256Json(fixture), fixtureHash, 'the deep-frozen transport fixture must not change');

    assert(
      Array.isArray(callResult.degradation_notes) && callResult.degradation_notes.length === 1,
      'oversized retrieval must produce one named degradation note'
    );
    assert.deepStrictEqual(callResult.degradation_notes[0], {
      reason_code: 'vtp_substrate_hit_truncated',
      hit_index: 0,
      identity: 'doc:lint-report',
      doc_id: 'doc:lint-report',
      rel_path: 'wiki/LINT-REPORT.md',
      chunk_id: 'chunk:lint-report',
      original_chars: 900001,
      retained_chars: 16000,
    });
    assert.strictEqual(callResult.response.hits[0].text, retainedPrefix);
    assert.strictEqual(callResult.response.hits[1], fixture.hits[1], 'normal second hit must be reference-preserved');

    const artifact = gate._internal.readEnrichmentArtifact({ phaseDir, phase: '166' });
    assert(artifact, 'successful enrichment artifact must remain readable');
    assert.strictEqual(artifact.empty_hit, false);
    assert.strictEqual(artifact.total_hits, 2);
    assert.match(artifact.raw, /vtp_status: success/);
    assert.match(artifact.raw, /## Degraded Retrieval/);
    assert.match(artifact.raw, /doc_id=doc:lint-report/);
    assert.match(artifact.raw, /rel_path=wiki\/LINT-REPORT\.md/);
    assert.match(artifact.raw, /900001 -> 16000/);
    assert.doesNotMatch(artifact.raw, /## API Error/);
    assert.doesNotMatch(artifact.raw, new RegExp(discardedMarker));
    assert(Buffer.byteLength(artifact.raw, 'utf8') < 32768, 'degraded artifact must remain bounded');
    const routingLog = fs.readFileSync(
      path.join(tempRoot, '.planning', 'metrics', 'vtp-routing-log.jsonl'),
      'utf8'
    );
    assert.doesNotMatch(routingLog, new RegExp(discardedMarker));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function assertCapShapes() {
  delete require.cache[require.resolve(composerPath)];
  delete require.cache[require.resolve(gatePath)];
  const composer = require(composerPath);
  const gate = require(gatePath);
  assert.strictEqual(composer.SUBSTRATE_HIT_MAX_CHARS, 16000);
  assert.strictEqual(typeof composer.capSubstrateResponse, 'function');

  const exactBoundary = deepFreeze({
    hits: [
      { doc_id: 'doc:boundary', text: '\u00e9'.repeat(16000), untouched: { stable: true } },
      { doc_id: 'doc:non-string', text: 16001 },
    ],
    metadata: { shape: 'top-level' },
  });
  const exactHash = sha256Json(exactBoundary);
  const exact = composer.capSubstrateResponse(exactBoundary);
  assert.strictEqual(exact.response, exactBoundary, 'exact boundary and non-string text must retain response identity');
  assert.deepStrictEqual(exact.degradation_notes, []);
  assert.strictEqual(sha256Json(exactBoundary), exactHash);

  const topLevel = deepFreeze({
    hits: [
      { doc_id: 'doc:first', rel_path: 'wiki/FIRST.md', chunk_id: 'chunk:first', text: 'a'.repeat(16001) },
      { doc_id: '', rel_path: 'wiki/SECOND.md', chunk_id: 'chunk:second', text: 'b'.repeat(16002) },
      { doc_id: '', rel_path: '', chunk_id: 'chunk:third', text: 'c'.repeat(16003) },
      { doc_id: '', rel_path: '', chunk_id: '', text: 'd'.repeat(16004) },
      { doc_id: 'doc:normal', text: 'normal', fields: { byte: 'preserved' } },
    ],
    metadata: { stable: true },
  });
  const topHash = sha256Json(topLevel);
  const cappedTop = composer.capSubstrateResponse(topLevel);
  assert.notStrictEqual(cappedTop.response, topLevel);
  assert.notStrictEqual(cappedTop.response.hits, topLevel.hits);
  assert.strictEqual(cappedTop.response.metadata, topLevel.metadata);
  assert.strictEqual(cappedTop.response.hits[4], topLevel.hits[4]);
  assert.deepStrictEqual(
    cappedTop.response.hits.slice(0, 4).map((hit) => hit.text.length),
    [16000, 16000, 16000, 16000]
  );
  assert.deepStrictEqual(
    cappedTop.degradation_notes.map((note) => [note.hit_index, note.identity]),
    [[0, 'doc:first'], [1, 'wiki/SECOND.md'], [2, 'chunk:third'], [3, 'hit-4']]
  );
  assert.deepStrictEqual(
    cappedTop.degradation_notes.map((note) => [note.original_chars, note.retained_chars]),
    [[16001, 16000], [16002, 16000], [16003, 16000], [16004, 16000]]
  );
  assert.strictEqual(sha256Json(topLevel), topHash);

  const nested = deepFreeze({
    evidence: {
      hits: [
        { doc_id: 'doc:nested', rel_path: 'wiki/NESTED.md', chunk_id: 'chunk:nested', text: 'n'.repeat(16001) },
        { doc_id: 'doc:nested-normal', text: 'nested normal' },
      ],
      documents: [{ doc_id: 'doc:nested' }],
    },
    retrieval_plan: { mode: 'fixture' },
  });
  const nestedHash = sha256Json(nested);
  const cappedNested = composer.capSubstrateResponse(nested);
  assert.notStrictEqual(cappedNested.response, nested);
  assert.notStrictEqual(cappedNested.response.evidence, nested.evidence);
  assert.notStrictEqual(cappedNested.response.evidence.hits, nested.evidence.hits);
  assert.strictEqual(cappedNested.response.evidence.hits[1], nested.evidence.hits[1]);
  assert.strictEqual(cappedNested.response.evidence.documents, nested.evidence.documents);
  assert.strictEqual(cappedNested.response.retrieval_plan, nested.retrieval_plan);
  assert.strictEqual(cappedNested.response.evidence.hits[0].text.length, 16000);
  assert.deepStrictEqual(cappedNested.degradation_notes.map((note) => note.identity), ['doc:nested']);
  assert.strictEqual(sha256Json(nested), nestedHash);

  const generatedNote = cappedNested.degradation_notes[0];
  const injected = deepFreeze({
    hits: nested.evidence.hits,
    degradation_notes: [{ ...generatedNote }],
  });
  const injectedHash = sha256Json(injected);
  const normalized = gate._internal.normalizeEnrichmentResult(injected);
  assert.strictEqual(normalized.hits[0].text.length, 16000);
  assert.strictEqual(normalized.degradation_notes.length, 1, 'defensive gate recap must collapse duplicate notes');
  assert.deepStrictEqual(normalized.degradation_notes[0], generatedNote);
  assert.strictEqual(sha256Json(injected), injectedHash);

  delete require.cache[require.resolve(bridgePath)];
  const bridge = require(bridgePath);
  const bridgeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-bridge-cap-'));
  try {
    const planningDir = path.join(bridgeRoot, '.planning');
    const exactCeilingInput = {
      uncertainty_type: 'architecture_challenge',
      query: 'P166 exact packet ceiling with degradation note',
      planningDir,
      routes_yaml: {
        vtp_bridge: {
          evidence_packet_max_tokens: 6,
          per_query_timeout_ms: 120000,
          retry_on_timeout: false,
        },
      },
      _force_vtp_health: true,
      _force_vtp_tool_response: {
        hits: [{
          doc_id: 'doc:ceiling',
          citation: 'gamma',
          title: 'alpha',
          excerpt: 'beta',
          text: 'x'.repeat(16001),
        }],
      },
    };
    const exactCeiling = bridge.selectiveVTPCall(exactCeilingInput);
    assert.strictEqual(exactCeiling.results.length, 1, 'result plus note must fit at the exact ceiling');
    assert.strictEqual(exactCeiling.results[0].degradation_notes.length, 1);
    assert.strictEqual(exactCeiling.body_token_estimate, 6, 'reported estimate must land on the configured cap');

    const belowCeiling = bridge.selectiveVTPCall({
      ...exactCeilingInput,
      routes_yaml: {
        vtp_bridge: {
          ...exactCeilingInput.routes_yaml.vtp_bridge,
          evidence_packet_max_tokens: 5,
        },
      },
    });
    assert.strictEqual(belowCeiling.results.length, 0, 'one token below the exact ceiling must elide the result');
    assert(belowCeiling.body_token_estimate <= 5, 'reported estimate must not exceed the configured cap');
    assert.strictEqual(belowCeiling.elided_count, 1);
    assert(belowCeiling.reason_codes.includes('evidence_packet_size_capped'));

    const bookPacket = bridge.selectiveVTPCall({
      uncertainty_type: 'book_lookup',
      query: 'P166 raw hit index through book filtering and elision',
      planningDir,
      routes_yaml: exactCeilingInput.routes_yaml,
      _force_vtp_health: true,
      _force_vtp_tool_response: {
        hits: [
          {
            doc_id: 'doc:shared',
            rel_path: 'wiki/meetings/not-a-book.md',
            citation: 'cite-nonbook',
            title: 'nonbook',
            excerpt: 'excerpt-nonbook',
            score: 0.95,
            text: 'n'.repeat(16001),
          },
          {
            doc_id: 'doc:shared',
            rel_path: 'wiki/books/low.md',
            citation: 'cite-low',
            title: 'low',
            excerpt: 'excerpt-low',
            score: 0.1,
            text: 'l'.repeat(16001),
          },
          {
            doc_id: 'doc:shared',
            rel_path: 'wiki/books/high.md',
            citation: 'cite-high',
            title: 'high',
            excerpt: 'excerpt-high',
            score: 0.9,
            text: 'h'.repeat(16001),
          },
        ],
      },
    });
    assert.strictEqual(bookPacket.results.length, 1, 'packet elision must keep only the highest-ranked book');
    assert.strictEqual(bookPacket.results[0].title, 'high');
    assert.deepStrictEqual(
      bookPacket.results[0].degradation_notes.map((note) => [note.hit_index, note.rel_path]),
      [[2, 'wiki/books/high.md']],
      'book filtering and packet elision must preserve the raw hit index without cross-attachment'
    );
  } finally {
    fs.rmSync(bridgeRoot, { recursive: true, force: true });
  }

  const gateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-cap-shapes-gate-'));
  try {
    writeFixtureFile(
      gateRoot,
      path.join('.planning', 'config.json'),
      JSON.stringify({ vtp_enrichment: { enabled: true } }) + '\n'
    );
    const phaseDir = path.join(gateRoot, '.planning', 'milestones', 'fixture', 'phases', '166-cap-shapes');
    fs.mkdirSync(phaseDir, { recursive: true });
    const gateInput = {
      projectDir: gateRoot,
      phaseDir,
      phase: '166',
      phaseContext: 'P166 defensive enrichment injection',
    };
    const pending = gate.run(gateInput);
    const discardedMarker = 'P166_GATE_DISCARDED_SUFFIX';
    const rawInjection = deepFreeze({
      ok: true,
      total_hits: 1,
      hits: [{
        doc_id: 'doc:gate-injected',
        rel_path: 'wiki/GATE-INJECTED.md',
        chunk_id: 'chunk:gate-injected',
        text: 'g'.repeat(16000) + discardedMarker,
      }],
      substrate_call_record: toSubstrateCallRecord(pending.sub_agent_spec.substrate_call),
    });
    const rawInjectionHash = sha256Json(rawInjection);
    const written = withPromptWitnessFixture((witnessFixture) => {
      witnessFixture.sessionId = 'p167-cap-shapes-session';
      seedPromptWitness(witnessFixture, composer, pending.sub_agent_spec.substrate_call);
      const restoreRuntime = activatePromptWitnessRuntime(witnessFixture);
      try {
        return gate.run({
          ...gateInput,
          substrateCall: pending.sub_agent_spec.substrate_call,
          enrichmentResult: rawInjection,
        });
      } finally {
        restoreRuntime();
      }
    }, gateRoot);
    assert.strictEqual(written.status, 'success');
    assert.strictEqual(sha256Json(rawInjection), rawInjectionHash);
    const artifact = gate._internal.readEnrichmentArtifact({ phaseDir, phase: '166' });
    assert.match(artifact.raw, /## Degraded Retrieval/);
    assert.match(artifact.raw, /doc_id=doc:gate-injected/);
    assert.doesNotMatch(artifact.raw, new RegExp(discardedMarker));
  } finally {
    fs.rmSync(gateRoot, { recursive: true, force: true });
  }
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
  const noPromptCapInstruction = 'Never cap or truncate raw response text in this prompt; T1 PostToolUse alone enforces the pre-model boundary.';
  function assertNoPromptOwnedCap(source, label) {
    const contractMatch = source.match(/<sgsd_vtp_substrate_witness_p167>([\s\S]*?)<\/sgsd_vtp_substrate_witness_p167>/);
    assert(contractMatch, label + ' P167 prompt contract missing');
    assert.equal(contractMatch[1].includes(noPromptCapInstruction), true, label + ' must explicitly delegate the pre-model cap');
    const withoutDelegation = contractMatch[1].replace(noPromptCapInstruction, '');
    assert.doesNotMatch(
      withoutDelegation,
      /\b(?:cap|truncate|limit|shorten)\s+(?:it|the|each|raw|response|result|text|content|hit(?:\.text)?)\b|\b(?:must|shall|should)\s+(?:cap|truncate|limit|shorten)\b|\b(?:keep|retain)\s+(?:only\s+)?(?:the\s+)?first\s+\d+\b/i,
      label + ' prompt must not instruct response capping',
    );
    assert.doesNotMatch(
      contractMatch[1],
      /\b16000\b|\boriginal_chars\b|\bretained_chars\b/,
      label + ' prompt must not own PostToolUse cap mechanics',
    );
  }
  assert.match(enrichment, /substrate_call\.payload/);
  assert.match(enrichment, /gateway_evidence/);
  assert.match(enrichment, /substrateCall: substrate_call/);
  assert.match(enrichment, /degradation_notes/);
  assertNoPromptOwnedCap(enrichment, 'enrichment');
  assert.match(enrichment, /Do not retry.*unfiltered/i);
  assert.match(enrichment, /truncation.*failure/i);
  assert.match(enrichment, /rationale: '',\s+\/\/ only populated if status='empty_hit'/);
  assert.match(board, /--prepare-substrate-call --intent board_research/);
  assert.match(board, /--accept-substrate-call-record --intent board_research/);
  assert.match(board, /gateway_evidence/);
  assert.match(board, /degradation_notes/);
  assertNoPromptOwnedCap(board, 'board');
  assert.match(board, /Do not retry.*unfiltered/i);
  assert.match(board, /truncation.*failure/i);
  assert.match(audit, /function buildP166LegacyPromptPatch/);
  assert.match(
    audit,
    /intent: 'phase_research',[\s\S]*?markerSuffix: 'phase_research',[\s\S]*?substrateTool: 'mcp__vtp-kb__vtp_search_substrate'/
  );
  assert.match(
    audit,
    /intent: 'planning',[\s\S]*?markerSuffix: 'planning',[\s\S]*?substrateTool: 'mcp__vtp-kb__vtp_search_substrate'/
  );
  assert.strictEqual((audit.match(/Carry degradation_notes into the normal output/g) || []).length, 1);
  assert.strictEqual((audit.match(/truncate it in memory to its first 16000 JavaScript characters/g) || []).length, 1);
  assert.strictEqual((audit.match(/original_chars/g) || []).length, 1);
  assert.strictEqual((audit.match(/Do not retry with unfiltered arguments/g) || []).length, 1);
  assert.strictEqual((audit.match(/do not convert truncation to failure/g) || []).length, 1);

  const enrichmentExample = enrichment.match(/```js\n([\s\S]*?)\n```/);
  assert(enrichmentExample, 'enrichment output JavaScript block missing');
  const evaluateEnrichmentExample = new Function(
    'substrate_call',
    enrichmentExample[1] + '\nreturn enrichmentResult;'
  );
  const parsedEnrichmentExample = evaluateEnrichmentExample({
    payload: { query: 'fixture' },
    gateway_evidence: { schema_version: 'fixture' },
  });
  assert(Array.isArray(parsedEnrichmentExample.degradation_notes));

  const boardOutput = board.match(/<output>\n[\s\S]*?\n\n([\s\S]*?)\n<\/output>/);
  assert(boardOutput, 'board YAML output block missing');
  const parsedBoardOutput = yaml.load(boardOutput[1]);
  assert(Array.isArray(parsedBoardOutput.degradation_notes));
  assert.strictEqual(parsedBoardOutput.degradation_notes.length, 0);
  assert.match(board, /reason_code vtp_substrate_hit_truncated/);
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

function preparePromptCallRecords(composer) {
  const records = new Map();
  for (const [site, intent] of PROMPT_SITES) {
    const query = 'P166 ' + site + ' prompt acceptance query';
    const preparedCall = composer.prepareSubstrateCall(intent, { query });
    records.set(site, {
      intent,
      preparedCall,
      record: toSubstrateCallRecord(preparedCall),
    });
  }
  return records;
}

function assertPromptRecordAcceptance(composer, expected) {
  return withPromptWitnessFixture((witnessFixture) => {
    const restoreRuntime = activatePromptWitnessRuntime(witnessFixture);
    try {
      return assertPromptRecordAcceptanceWithWitness(composer, expected, witnessFixture);
    } finally {
      restoreRuntime();
    }
  });
}

function assertPromptRecordAcceptanceWithWitness(composer, expected, witnessFixture) {
  assertPromptContracts();
  assert.strictEqual(
    typeof composer.acceptPromptSubstrateCallRecord,
    'function',
    'production prompt-record acceptance must be exported'
  );

  const acceptedRecords = new Map();

  for (const [site, promptCall] of preparePromptCallRecords(composer)) {
    const { intent, preparedCall, record } = promptCall;
    const query = preparedCall.payload.query;
    seedPromptWitness(witnessFixture, composer, preparedCall);
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
      () => composer.acceptPromptSubstrateCallRecord(
        intent,
        unfiltered,
        toSubstrateCallRecord(unfiltered),
      ),
      /prepared_call/,
      site + ' must reject an unfiltered call even when its digest matches'
    );

    const limitSix = forgedPreparedCall(intent, {
      query,
      source_types: expected[intent].source_types.slice(),
      limit: 6,
    });
    assert.throws(
      () => composer.acceptPromptSubstrateCallRecord(
        intent,
        limitSix,
        toSubstrateCallRecord(limitSix),
      ),
      /prepared_call/,
      site + ' must reject limit 6 even when its digest matches'
    );
  }

  const gate = require(gatePath);
  const tempRoot = witnessFixture.project;
  witnessFixture.sessionId = 'p167-policy-gate-session';
  const restoreRuntime = activatePromptWitnessRuntime(witnessFixture);
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
    const recordlessApiError = {
      ok: false,
      error: 'simulated transport failure before a call record was emitted',
    };
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(recordlessApiError, 'substrate_call_record'),
      false,
      'the api-error fixture must exercise a wholly absent record property'
    );
    assert.throws(
      () => gate.run({
        ...gateInput,
        substrateCall: preparedCall,
        enrichmentResult: recordlessApiError,
      }),
      /substrate_call_record_missing/,
      'the real enrichment acceptance path must fail closed on a recordless api error'
    );
    assert.throws(
      () => gate.run({
        ...gateInput,
        substrateCall: preparedCall,
        enrichmentResult: {
          ok: false,
          error: 'simulated transport failure with invalid evidence',
          substrate_call_record: {
            ...record,
            gateway_evidence: { ...record.gateway_evidence, payload_sha256: 'e'.repeat(64) },
          },
        },
      }),
      /digest/,
      'the real enrichment acceptance path must reject an invalid api-error record'
    );
    const apiErrorResult = {
      ok: false,
      error: 'simulated MCP transport failure',
      substrate_call_record: record,
    };
    assert.throws(
      () => gate.run({
        ...gateInput,
        substrateCall: preparedCall,
        enrichmentResult: apiErrorResult,
      }),
      /substrate_witness_missing/,
      'the real api-error path must reject a clean record without a witness'
    );
    seedPromptWitness(witnessFixture, composer, preparedCall);
    const acceptedApiError = gate.run({
      ...gateInput,
      substrateCall: preparedCall,
      enrichmentResult: apiErrorResult,
    });
    assert.strictEqual(acceptedApiError.status, 'api_error');
    assert.match(fs.readFileSync(acceptedApiError.artifact_path, 'utf8'), /## API Error/);
    seedPromptWitness(witnessFixture, composer, preparedCall);
    const acceptedEmptyHit = gate.run({
      ...gateInput,
      substrateCall: preparedCall,
      enrichmentResult: {
        ok: true,
        query_count: 2,
        total_hits: 0,
        duration_ms: 1,
        hits: [],
        substrate_call_record: record,
      },
    });
    assert.strictEqual(acceptedEmptyHit.status, 'empty_hit');
    const emptyHitArtifact = fs.readFileSync(acceptedEmptyHit.artifact_path, 'utf8');
    assert.match(emptyHitArtifact, /vtp_status: empty_hit/);
    assert.doesNotMatch(emptyHitArtifact, /## API Error/);
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

    seedPromptWitness(witnessFixture, composer, preparedCall);
    const accepted = gate.run({ ...gateInput, substrateCall: preparedCall, enrichmentResult: result });
    assert.strictEqual(accepted.status, 'success');
    assert(fs.existsSync(accepted.artifact_path));
    assert.doesNotMatch(fs.readFileSync(accepted.artifact_path, 'utf8'), /## API Error/);
  } finally {
    restoreRuntime();
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
      '---\ntools: Read\n---\n<sgsd_vtp_research_contract>\nlegacy P16 contract\n</sgsd_vtp_research_contract>\n'
        + '<sgsd_vtp_substrate_policy_p166_phase_research>\nT1 policy\n</sgsd_vtp_substrate_policy_p166_phase_research>\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(agentsDir, 'gsd-planner.md'),
      '---\ntools: Read\n---\n<sgsd_vtp_enrichment_contract>\nlegacy P16 contract\n</sgsd_vtp_enrichment_contract>\n'
        + '<sgsd_vtp_substrate_policy_p166_planning>\nT1 policy\n</sgsd_vtp_substrate_policy_p166_planning>\n',
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
    assert.match(researcher, /<sgsd_vtp_substrate_policy_p166_t2_phase_research>/);
    assert.match(planner, /<sgsd_vtp_substrate_policy_p166_t2_planning>/);
    const generatedPatches = [
      audit._internals.buildP166LegacyPromptPatch({
        intent: 'phase_research',
        markerSuffix: 'phase_research',
        substrateTool: SEARCH_TOOL,
      }),
      audit._internals.buildP166LegacyPromptPatch({
        intent: 'planning',
        markerSuffix: 'planning',
        substrateTool: SEARCH_TOOL,
      }),
    ];
    assert.match(generatedPatches[0].p166Append, /--prepare-substrate-call --intent phase_research/);
    assert.match(generatedPatches[0].p166Append, /--accept-substrate-call-record --intent phase_research/);
    assert.match(generatedPatches[1].p166Append, /--prepare-substrate-call --intent planning/);
    assert.match(generatedPatches[1].p166Append, /--accept-substrate-call-record --intent planning/);
    for (const generatedPatch of generatedPatches) {
      assert.match(generatedPatch.p166Append, /mcp__vtp-kb__vtp_search_substrate/);
      assert.match(generatedPatch.p166T2Append, /Carry degradation_notes into the normal output/);
      assert.match(generatedPatch.p166T2Append, /truncate it in memory to its first 16000 JavaScript characters/);
      assert.match(generatedPatch.p166T2Append, /original_chars/);
      assert.match(generatedPatch.p166T2Append, /Do not retry with unfiltered arguments/);
      assert.match(generatedPatch.p166T2Append, /do not convert truncation to failure/);
    }
    const rows = new Map(report.global_legacy_agents.map((row) => [row.name, row]));
    assert.strictEqual(rows.get('gsd-phase-researcher.md').p166_patched, true);
    assert.strictEqual(rows.get('gsd-planner.md').p166_patched, true);
    assert.strictEqual(rows.get('gsd-phase-researcher.md').p166_t2_patched, true);
    assert.strictEqual(rows.get('gsd-planner.md').p166_t2_patched, true);
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

  for (const [site, promptCall] of preparePromptCallRecords(composer)) {
    assertPreparedEnvelope(
      promptCall.preparedCall,
      promptCall.intent,
      expected[promptCall.intent],
      validate
    );
    captures.set(site, promptCall.record);
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
  assertComposerCli();

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
  else if (caseName === 'megachunk-degraded-artifact') await assertMegachunkDegradedArtifact();
  else if (caseName === 'cap-shapes') assertCapShapes();
  else if (caseName === 'repair-safe-t2') assertRepairSafePatches();
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
