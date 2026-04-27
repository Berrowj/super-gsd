// ============================================================================
// SGSD - INTENT-MAP test scaffold (Phase 45 Wave 1)
// ============================================================================
// 8-assertion Wave-1 scaffold. Wave 2 expands to 10 (F1 + F4 + 4 secondary).
// All assertions invoke the stub build.cjs returning sentinels until Wave 2.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const builder = require(path.join(__dirname, 'build.cjs'));

let pass = 0, fail = 0;
const fails = [];
function assert(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }

// F1 stub: compileIntentMap returns sentinel in Wave 1 (Wave 2 replaces with real compile).
const r1 = builder.compileIntentMap('Plan Phase 45 context packet builder', {});
assert('F1_stub_returns_sentinel', r1 && r1.ok === false);

// F4 stub: prompt-injection defense placeholder.
const r4 = builder.compileIntentMap('Plan Phase 45', {});
assert('F4_stub_no_throw', r4 !== undefined);

// Secondary 8: REASON_VOCAB closed-frozen no semantic_similarity_only.
assert('REASON_VOCAB_closed_frozen',
  Object.isFrozen(builder.REASON_VOCAB) &&
  builder.REASON_VOCAB.length === 13 &&
  builder.REASON_VOCAB.indexOf('semantic_similarity_only') === -1);

// Secondary 10: empty phrase no throw.
let emptyOk = true;
try { const r = builder.compileIntentMap('', {}); if (r === undefined) emptyOk = false; }
catch (_e) { emptyOk = false; }
assert('empty_phrase_no_throw', emptyOk);

// Secondary 11: malformed-row defensive read.
const tmpDir = require('os').tmpdir();
const tmpLedger = path.join(tmpDir, 'im-test-' + Date.now() + '.jsonl');
fs.writeFileSync(tmpLedger, '{"ok":true}\n{not json\n{"ok":2}\n', 'utf8');
const rows = builder._readRows(tmpLedger);
assert('malformed_row_defensive', rows.length === 2);
try { fs.unlinkSync(tmpLedger); } catch (_e) {}

// Secondary 13: canonical-stream fingerprint no-write.
const planningRoot = path.resolve(__dirname, '..', '..', '..', '.planning');
const streams = [
  'metrics/agent-token-spend.jsonl',
  'metrics/token-attribution.jsonl',
  'metrics/codex-log.jsonl',
];
function fp(p) {
  try { const s = fs.statSync(p); return s.size + ':' + s.mtimeMs; }
  catch (_e) { return 'absent'; }
}
const before = streams.map(s => fp(path.join(planningRoot, s)));
// Run a stub compile that should NOT touch canonical streams.
builder.compileIntentMap('test', { planningDir: tmpDir });
const after = streams.map(s => fp(path.join(planningRoot, s)));
assert('canonical_stream_unchanged', JSON.stringify(before) === JSON.stringify(after));

// Phase 41-44 import round-trip.
let importsOk = true;
try {
  const p41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
  const p42 = require(path.join(__dirname, '..', 'token-waste', 'check.cjs'));
  const p43 = require(path.join(__dirname, '..', 'phase-capsule', 'write.cjs'));
  const p44 = require(path.join(__dirname, '..', 'context-registry', 'check.cjs'));
  if (typeof p41.summarize !== 'function') importsOk = false;
  if (!p42.BUDGETS) importsOk = false;
  if (typeof p43.readCapsule !== 'function') importsOk = false;
  if (typeof p44.validateReferences !== 'function') importsOk = false;
} catch (_e) { importsOk = false; }
assert('phase_41_42_43_44_round_trip', importsOk);

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
  isAscii(path.join(__dirname, 'check.cjs')) &&
  isAscii(path.join(__dirname, 'intent-map.schema.json')) &&
  isAscii(__filename));

console.log('intent-map test scaffold: ' + pass + ' pass, ' + fail + ' fail');
if (fails.length) console.error('FAILED: ' + fails.join(', '));
process.exit(fail === 0 ? 0 : 1);
