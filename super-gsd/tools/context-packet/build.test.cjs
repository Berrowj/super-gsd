// ============================================================================
// SGSD - CONTEXT-PACKET test scaffold (Phase 45 Wave 3)
// ============================================================================
// External 8-assertion harness. The deeper 14-assertion suite lives in
// build.cjs::_runSelfTest (F2 + F3 + F5 + F6 + F8 + F9 + F10 + F11 + 6
// secondary, sandboxed to tmpdir).
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const builder = require(path.join(__dirname, 'build.cjs'));

let pass = 0, fail = 0;
const fails = [];
function assert(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }

// Secondary 7: ROLE_MODES PACKET-02.
assert('ROLE_MODES_frozen_6_entry',
  Object.isFrozen(builder.ROLE_MODES) && builder.ROLE_MODES.length === 6 &&
  JSON.stringify(builder.ROLE_MODES) === JSON.stringify(['researcher','planner','executor','verifier','reviewer','cockpit']));

// Secondary 8 mirror: REASON_VOCAB no semantic_similarity_only.
assert('REASON_VOCAB_no_semantic_only',
  builder.REASON_VOCAB.indexOf('semantic_similarity_only') === -1 &&
  Object.isFrozen(builder.REASON_VOCAB) && builder.REASON_VOCAB.length === 13);

// Secondary 9: TIER_WEIGHT 1:1.
let tw1to1 = (Object.keys(builder.TIER_WEIGHT).length === builder.REASON_VOCAB.length);
for (let i = 0; tw1to1 && i < builder.REASON_VOCAB.length; i++) {
  if (!(builder.REASON_VOCAB[i] in builder.TIER_WEIGHT)) tw1to1 = false;
}
assert('TIER_WEIGHT_keys_eq_REASON_VOCAB', tw1to1);

// Secondary 14: empty intent_id graceful never throws.
let emptyOk = true;
try {
  const r = builder.buildPacket('researcher', '', { planningDir: os.tmpdir() });
  if (r === undefined) emptyOk = false;
} catch (_e) { emptyOk = false; }
assert('empty_intent_id_graceful', emptyOk);

// F8 stub: validated_thought provenance gate.
const bad = { id: 't1', source_refs: [], root_source_hashes: ['h'] };
const good = { id: 't2', source_refs: ['ref'], root_source_hashes: ['h'] };
const rBad = builder._assertValidatedThoughtProvenance(bad);
const rGood = builder._assertValidatedThoughtProvenance(good);
assert('F8_stub_provenance_gate',
  rBad && rBad.ok === false &&
  typeof rBad.reason === 'string' &&
  rBad.reason.indexOf('validated_thought_missing_provenance') === 0 &&
  rGood && rGood.ok === true);

// F9 stub: context_source_mix has 7 keys.
const mix = builder._buildContextSourceMix({ capsule_refs: [], validated_thoughts: [], source_mix: {} });
assert('F9_stub_context_source_mix_7_keys',
  mix && Object.keys(mix).length === 7 &&
  'raw_evidence' in mix && 'phase_capsule' in mix && 'validated_thought' in mix &&
  'reusable_rule' in mix && 'guardrail' in mix && 'index_snippet' in mix && 'vtp_packet' in mix);

// COMPRESSION_LEVELS frozen 5.
assert('COMPRESSION_LEVELS_frozen_5',
  Object.isFrozen(builder.COMPRESSION_LEVELS) && builder.COMPRESSION_LEVELS.length === 5);

// ASCII-only on source files.
function isAscii(p) {
  try {
    const buf = fs.readFileSync(p);
    for (let i = 0; i < buf.length; i++) if (buf[i] > 127) return false;
    return true;
  } catch (_e) { return false; }
}
assert('ascii_only_files',
  isAscii(path.join(__dirname, 'build.cjs')) &&
  isAscii(path.join(__dirname, 'PACKET.schema.json')) &&
  isAscii(__filename));

console.log('context-packet test scaffold: ' + pass + ' pass, ' + fail + ' fail');
if (fails.length) console.error('FAILED: ' + fails.join(', '));
process.exit(fail === 0 ? 0 : 1);
