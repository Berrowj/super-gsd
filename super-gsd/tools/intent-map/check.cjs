// ============================================================================
// SGSD - INTENT-MAP read-side validator (Phase 45 -- PACKET-00)
// ============================================================================
// Pure read-side validator. Wraps build.cjs::validate + listIntentMaps.
// Lock 13: never throws; returns {valid:bool, errors:[]} on any input.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const builder = require(path.join(__dirname, 'build.cjs'));

function validate(intent_map) {
  try { return builder.validate(intent_map); }
  catch (e) { return { valid: false, errors: [String(e && e.message || e)] }; }
}

function validateAll(opts) {
  try {
    const rows = builder.listIntentMaps(opts || {});
    let valid = 0, invalid = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const r = validate(rows[i]);
      if (r.valid) valid++;
      else { invalid++; errors.push({ index: i, errors: r.errors }); }
    }
    return { valid_count: valid, invalid_count: invalid, errors: errors };
  } catch (e) {
    return { valid_count: 0, invalid_count: 0, errors: [String(e && e.message || e)] };
  }
}

function _runSelfTest() {
  let pass = 0, fail = 0;
  const fails = [];
  function assert(name, cond) {
    if (cond) pass++;
    else { fail++; fails.push(name); }
  }

  // 1. validate(null) returns invalid, not throw.
  let r1Ok = true;
  try { const r = validate(null); if (!r || r.valid !== false) r1Ok = false; }
  catch (_e) { r1Ok = false; }
  assert('validate_null_no_throw', r1Ok);

  // 2. validate({}) returns invalid.
  let r2Ok = true;
  try { const r = validate({}); if (!r || r.valid !== false) r2Ok = false; }
  catch (_e) { r2Ok = false; }
  assert('validate_empty_invalid', r2Ok);

  // 3. validate(valid_minimal) returns valid.
  const minimal = {
    envelope_version: 1, ts: '2026-04-27T00:00:00Z',
    command: 'compileIntentMap', status: 'ok', reason_codes: [],
    intent_id: '0123456789abcdef',
    raw: 'x', intent: 'x', meaning: 'x', canonical: 'x',
    assumptions: [], ambiguities: [], clarify: null, relationships: [],
    context_policy: { include: [], exclude: [], compress: [], preserve_raw: [] },
    action: { kind: 'no_op', reason: 'no_change_needed' },
  };
  let r3Ok = true;
  try { const r = validate(minimal); if (!r || r.valid !== true) r3Ok = false; }
  catch (_e) { r3Ok = false; }
  assert('validate_minimal_valid', r3Ok);

  // 4. validateAll on empty path returns 0 counts no throw.
  let r4Ok = true;
  try {
    const r = validateAll({ planningDir: require('os').tmpdir() + '/nope-' + Date.now() });
    if (!r || typeof r.valid_count !== 'number') r4Ok = false;
  } catch (_e) { r4Ok = false; }
  assert('validate_all_no_throw', r4Ok);

  // 5. ASCII-only.
  let asciiOk = true;
  try {
    const buf = fs.readFileSync(__filename);
    for (let i = 0; i < buf.length; i++) { if (buf[i] > 127) { asciiOk = false; break; } }
  } catch (_e) { asciiOk = false; }
  assert('ascii_only_source', asciiOk);

  console.log('intent-map check self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fails.length) console.error('FAILED: ' + fails.join(', '));
  return fail === 0 ? 0 : 1;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.indexOf('--self-test') !== -1) {
    process.exit(_runSelfTest());
  } else if (args.indexOf('--help') !== -1 || args.length === 0) {
    console.log('Usage: node check.cjs --self-test');
    process.exit(0);
  } else {
    console.error('Unknown invocation.');
    process.exit(2);
  }
}

module.exports = { validate, validateAll, _runSelfTest };
