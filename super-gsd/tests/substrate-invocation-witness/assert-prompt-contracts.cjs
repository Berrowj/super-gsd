#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RAW_SUBSTRATE_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const READINESS_COMMAND = 'node super-gsd/scripts/lib/substrate-invocation-witness-store.cjs --readiness --project-dir .';
const ACCEPT_COMMAND = '--accept-substrate-call-record';
const STATUS = 'VTP_STATUS: unavailable_or_bypassed';
const REASON = 'substrate_witness_unavailable';
const P167_MARKER = '<sgsd_vtp_substrate_witness_p167>';

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert(match, 'agent source must carry YAML frontmatter');
  return match[1];
}

function frontmatterTools(source) {
  const match = frontmatter(source).match(/^tools:\s*(.+)$/m);
  assert(match, 'agent frontmatter must carry a tools list');
  return match[1].split(',').map((value) => value.trim()).filter(Boolean);
}

function installedMarkerModel() {
  return [
    P167_MARKER,
    READINESS_COMMAND,
    'Run readiness from the current project in the current Claude Code session before raw substrate transport.',
    'Only readiness exit zero with ready true permits a call to ' + RAW_SUBSTRATE_TOOL + '.',
    'If readiness is missing, stale, duplicated, keyless, or cannot prove both project hook registrations, do not call the raw substrate tool.',
    STATUS,
    'reason: ' + REASON,
    'Continue only through the existing graceful-degradation path.',
    'After raw substrate transport, write the exact P166 substrate_call_record and run the existing ' + ACCEPT_COMMAND + ' command before inspecting or using the response.',
    'If acceptance exits nonzero, discard all substrate-derived content. Do not summarise it, quote it, persist it, or retry it.',
    'Use substrate-derived content only after readiness and post-call acceptance both succeed.',
    'Emit the same VTP_STATUS and reason, then continue only through the existing graceful-degradation path.',
    'When acceptance succeeds, carry hook-authored degradation_notes through the existing normal output path.',
    'Never cap or truncate raw response text in this prompt; T1 PostToolUse alone enforces the pre-model boundary.',
    'This supported-path prompt contract does not prevent a same-user actor from writing a different prompt, registration, or direct upstream call.',
    '</sgsd_vtp_substrate_witness_p167>',
  ].join('\n');
}

const canonicalSurfaces = [
  {
    name: 'enrichment',
    intent: 'enrichment',
    relativePath: 'super-gsd/agents/sgsd-vtp-enrichment.md',
    composerPrepared: /composer-prepared enrichment envelope with payload and gateway_evidence/,
  },
  {
    name: 'board-researcher',
    intent: 'board_research',
    relativePath: 'super-gsd/agents/sgsd-board-researcher.md',
    composerPrepared: /--prepare-substrate-call --intent board_research/,
  },
];

const installedSurfaces = [
  { name: 'installed-gsd-phase-researcher', intent: 'phase_research', markerSuffix: 'phase_research' },
  { name: 'installed-gsd-planner', intent: 'planning', markerSuffix: 'planning' },
];

function assertFailClosedContract(surface) {
  const body = surface.body;
  const readinessIndex = body.indexOf(READINESS_COMMAND);
  const ownedText = surface.source || body;
  const rawCallIndex = body.indexOf(RAW_SUBSTRATE_TOOL);
  const acceptanceIndex = body.indexOf(ACCEPT_COMMAND);
  const useIndex = body.indexOf('Use substrate-derived content only after readiness');

  assert.notStrictEqual(readinessIndex, -1, surface.name + ': production readiness command missing');
  assert.notStrictEqual(rawCallIndex, -1, surface.name + ': conditional raw call contract missing');
  assert.notStrictEqual(acceptanceIndex, -1, surface.name + ': post-call acceptance command missing');
  assert.notStrictEqual(useIndex, -1, surface.name + ': success-gated response use missing');
  assert(readinessIndex < rawCallIndex, surface.name + ': raw transport can precede readiness');
  assert(rawCallIndex < acceptanceIndex, surface.name + ': acceptance can precede raw transport');
  assert(acceptanceIndex < useIndex, surface.name + ': response use can precede acceptance');
  assert.match(body, /(?:substrate_call\.payload|returned payload) verbatim/);

  assert.match(body, /current project in the current Claude Code session/);
  assert.match(body, /missing, stale,\s+duplicated, keyless, or cannot prove both project hook registrations/);
  assert.match(body, /do not\s+call the raw substrate tool/);
  assert.match(body, new RegExp(STATUS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(body, new RegExp(REASON));
  assert.match(body, /existing graceful-degradation path/);
  assert.match(body, /Emit the same VTP_STATUS and reason/);
  assert.match(body, /write\s+the exact P166 substrate_call_record/);
  assert.match(body, /discard\s+all substrate-derived content/);
  assert.match(body, /Do not summarise it, quote it, persist it, or\s+retry it/);
  assert.match(body, /post-call acceptance\s+both succeed/);
  assert.match(body, /hook-authored degradation_notes/);
  assert.match(body, /Never cap or truncate raw response text in this prompt; T1 PostToolUse alone enforces the pre-model boundary/);
  assert.match(body, /does not prevent a same-user\s+actor from writing a different prompt, registration, or direct upstream call/);
  assert.doesNotMatch(ownedText, /\bsource_types\b/);
  assert.doesNotMatch(ownedText, /\blimit\b/);
  assert.doesNotMatch(ownedText, /\btool_use_id\b/);
  assert.doesNotMatch(body, /truncate it in memory|first 16000 JavaScript characters|capSubstrateResponse/);
}

function loadCanonicalSurface(spec) {
  const source = read(spec.relativePath);
  return { ...spec, source, body: source.slice(source.indexOf('\n---', 4) + 4) };
}

function p167MarkerBlock(body) {
  const match = body.match(/<sgsd_vtp_substrate_witness_p167>[\s\S]*?<\/sgsd_vtp_substrate_witness_p167>/);
  assert(match, 'canonical P167 marker block missing');
  return match[0].replace(/\r\n/g, '\n');
}

function modelInstalledSurface(spec) {
  const audit = require(path.join(REPO_ROOT, 'super-gsd', 'tools', 'feature-propagation', 'audit.cjs'));
  const p166 = audit._internals.buildP166LegacyPromptPatch({
    intent: spec.intent,
    markerSuffix: spec.markerSuffix,
    substrateTool: RAW_SUBSTRATE_TOOL,
  });
  return {
    ...spec,
    body: installedMarkerModel() + '\n' + p166.p166Append,
    composerPrepared: new RegExp('--prepare-substrate-call --intent ' + spec.intent),
  };
}

function main() {
  const seen = new Set();
  let passed = 0;
  let sharedCanonicalContract = null;

  for (const spec of canonicalSurfaces) {
    const surface = loadCanonicalSurface(spec);
    assert(!seen.has(surface.name), surface.name + ': duplicate surface classification');
    seen.add(surface.name);
    assert.match(surface.body, surface.composerPrepared, surface.name + ': P166 composer-prepared payload drifted');
    assert.match(surface.body, new RegExp('(?:--intent |intent_family: ["\'])' + surface.intent));
    assertFailClosedContract(surface);
    assert(!frontmatterTools(surface.source).includes(RAW_SUBSTRATE_TOOL), surface.name + ': canonical frontmatter grants raw substrate');
    const markerBlock = p167MarkerBlock(surface.body);
    if (sharedCanonicalContract === null) {
      sharedCanonicalContract = markerBlock;
    } else {
      assert.strictEqual(markerBlock, sharedCanonicalContract, 'canonical P167 wording drifted');
    }
    passed += 1;
    process.stdout.write('PASS prompt-contract ' + surface.name + '\n');
  }

  for (const spec of installedSurfaces) {
    const surface = modelInstalledSurface(spec);
    assert(!seen.has(surface.name), surface.name + ': duplicate surface classification');
    seen.add(surface.name);
    assert.match(surface.body, surface.composerPrepared, surface.name + ': P166 intent family drifted');
    assert.match(surface.body, /Pass the returned payload verbatim/);
    assert.match(surface.body, new RegExp(P167_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assertFailClosedContract(surface);
    passed += 1;
    process.stdout.write('PASS prompt-contract ' + surface.name + '\n');
  }

  assert.deepStrictEqual([...seen], [
    'enrichment',
    'board-researcher',
    'installed-gsd-phase-researcher',
    'installed-gsd-planner',
  ]);
  process.stdout.write('PASS assert-prompt-contracts ' + passed + '/4\n');
}

main();
