// ============================================================================
// SGSD - INTENT-MAP test scaffold (Phase 45 Wave 2)
// ============================================================================
// External 8-assertion harness. The deeper 10-assertion suite lives in
// build.cjs::_runSelfTest (F1 + F4 + 4 secondary, sandboxed to tmpdir).
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const builder = require(path.join(__dirname, 'build.cjs'));

let pass = 0, fail = 0;
const fails = [];
function assert(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }

// Build a tmp planning dir so external compile calls below never touch
// canonical streams.
const tmpExt = fs.mkdtempSync(path.join(os.tmpdir(), 'imt-ext-'));
const extPlanning = path.join(tmpExt, '.planning');
fs.mkdirSync(path.join(extPlanning, 'metrics'), { recursive: true });

// F1 (real compile): valid intent map produced; raw verbatim; planner action.
const r1 = builder.compileIntentMap('Plan Phase 45 context packet builder', { planningDir: extPlanning });
assert('F1_compile_returns_valid_intent_map',
  r1 && r1.raw === 'Plan Phase 45 context packet builder' &&
  r1.action && r1.action.kind === 'dispatch_role' && r1.action.role === 'planner');

// F4 (prompt-injection defense placeholder, Lock 12): operator phrase is "Plan
// Phase 45". Confirm operator-intent fields contain operator bytes only.
const r4 = builder.compileIntentMap('Plan Phase 45', { planningDir: extPlanning });
assert('F4_intent_meaning_canonical_no_injection',
  r4 && r4.raw === 'Plan Phase 45' &&
  r4.intent.indexOf('.planning') === -1 && r4.intent.indexOf('ignore') === -1 &&
  r4.meaning.indexOf('.planning') === -1 && r4.meaning.indexOf('ignore') === -1 &&
  r4.canonical.indexOf('.planning') === -1 && r4.canonical.indexOf('ignore') === -1);

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
