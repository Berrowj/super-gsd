#!/usr/bin/env node
// =============================================================================
// super-gsd/scripts/lib/orchestrator-live-writer.cjs
// Phase 74-01: ORCHESTRATOR-LIVE.jsonl writer helper.
//
// PURPOSE
//   Append-only writer for the unified live event stream consumed by
//   cockpit-state adapter (Phase 76) and MCP cockpit_snapshot (Phase 71).
//   Lock-13 wrapped: write failure returns {ok:false} rather than throwing.
//   Per Phase 75 acceptance: event writing failure does not crash SGSD.
//
// 3 PUBLIC APIs
//   - appendEvent({type, data, milestone?, phase?, plan?, projectDir?})
//       -> {ok: bool, error?: string}
//   - getEventTypes()
//       -> EVENT_TYPES (frozen len=16)
//   - selfTest()
//       -> {ok, results: [...]}
//
// EVENT_TYPES (closed vocab, frozen, len=16)
//   run_started / phase_started / plan_selected /
//   agent_dispatched / agent_progress / agent_completed /
//   codex_started / codex_completed /
//   gate_started / gate_passed / gate_warned / gate_failed /
//   token_threshold_crossed / checkpoint_written /
//   operator_attention_required / run_completed
//
// LOCK INVARIANTS
//   - Lock 13: appendEvent never throws; bad input returns {ok:false}.
//   - Lock 11: type membership via indexOf on frozen EVENT_TYPES.
//   - ASCII-only enforced by selfTest.
//
// ASCII-only.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

const EVENT_TYPES = Object.freeze([
  'run_started',
  'phase_started',
  'plan_selected',
  'agent_dispatched',
  'agent_progress',
  'agent_completed',
  'codex_started',
  'codex_completed',
  'gate_started',
  'gate_passed',
  'gate_warned',
  'gate_failed',
  'token_threshold_crossed',
  'checkpoint_written',
  'operator_attention_required',
  'run_completed'
]);

const STREAM_FILENAME = 'ORCHESTRATOR-LIVE.jsonl';

function _resolveStreamPath(projectDir) {
  const dir = projectDir && typeof projectDir === 'string'
    ? path.resolve(projectDir)
    : process.cwd();
  return path.join(dir, '.planning', STREAM_FILENAME);
}

function appendEvent(opts) {
  try {
    if (!opts || typeof opts !== 'object') {
      return { ok: false, error: 'invalid_input_schema: opts not an object' };
    }
    if (typeof opts.type !== 'string') {
      return { ok: false, error: 'invalid_input_schema: type missing or not a string' };
    }
    if (EVENT_TYPES.indexOf(opts.type) === -1) {
      return { ok: false, error: 'unknown_event_type: ' + opts.type };
    }
    if (!opts.data || typeof opts.data !== 'object') {
      return { ok: false, error: 'invalid_input_schema: data missing or not an object' };
    }

    const event = {
      schema_version: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      type: opts.type,
      milestone: opts.milestone || null,
      phase: opts.phase || null,
      plan: opts.plan || null,
      data: opts.data
    };

    const streamPath = _resolveStreamPath(opts.projectDir);
    const line = JSON.stringify(event) + '\n';

    fs.appendFileSync(streamPath, line, { encoding: 'utf8' });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'write_failed: ' + (e && e.message ? e.message : 'unknown') };
  }
}

function getEventTypes() {
  return EVENT_TYPES;
}

function selfTest() {
  const results = [];
  function assert(label, cond, detail) {
    results.push({ label, ok: !!cond, detail: detail || '' });
  }

  try {
    assert('A1_event_types_frozen_16', Object.isFrozen(EVENT_TYPES) && EVENT_TYPES.length === 16,
      'len=' + EVENT_TYPES.length + ' frozen=' + Object.isFrozen(EVENT_TYPES));

    const setSize = (new Set(EVENT_TYPES)).size;
    assert('A2_event_types_unique', setSize === EVENT_TYPES.length, 'set=' + setSize);

    const r3 = appendEvent(null);
    assert('A3_null_opts_degraded', r3 && r3.ok === false, 'ok=' + (r3 && r3.ok));

    const r4 = appendEvent({ type: 'not_a_real_event', data: {} });
    assert('A4_unknown_type_degraded', r4 && r4.ok === false && r4.error.indexOf('unknown_event_type') !== -1,
      'error=' + (r4 && r4.error));

    const r5 = appendEvent({ type: 'run_started' });
    assert('A5_missing_data_degraded', r5 && r5.ok === false, 'ok=' + (r5 && r5.ok));

    const tmp = path.join(require('os').tmpdir(), 'live-writer-self-test-' + Date.now());
    fs.mkdirSync(path.join(tmp, '.planning'), { recursive: true });
    const r6 = appendEvent({
      type: 'run_started',
      data: { mode: 'auto', user_command: 'test', session_id: 'test-1' },
      projectDir: tmp
    });
    assert('A6_temp_write_succeeds', r6 && r6.ok === true, 'ok=' + (r6 && r6.ok));
    if (r6 && r6.ok) {
      const written = fs.readFileSync(path.join(tmp, '.planning', 'ORCHESTRATOR-LIVE.jsonl'), 'utf8');
      const parsed = JSON.parse(written.trim());
      assert('A7_written_event_shape',
        parsed.schema_version === 1 &&
        parsed.type === 'run_started' &&
        typeof parsed.ts === 'string' &&
        parsed.data.mode === 'auto',
        'schema=' + parsed.schema_version + ' type=' + parsed.type);
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    } else {
      assert('A7_written_event_shape', false, 'A6 failed; cannot verify');
    }

    const src = fs.readFileSync(__filename, 'utf8');
    let firstNonAscii = -1;
    for (let i = 0; i < src.length; i++) {
      if (src.charCodeAt(i) > 127) { firstNonAscii = i; break; }
    }
    assert('A8_ascii_only', firstNonAscii === -1, 'first_nonascii_idx=' + firstNonAscii);

    const types = getEventTypes();
    assert('A9_get_event_types_same', types === EVENT_TYPES, 'identity=' + (types === EVENT_TYPES));

    const allOk = results.every(r => r.ok);
    return { ok: allOk, results };
  } catch (e) {
    results.push({ label: 'self_test_threw', ok: false, detail: 'error: ' + (e && e.message) });
    return { ok: false, results };
  }
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--self-test') {
    const st = selfTest();
    let pass = 0, fail = 0;
    for (const r of st.results) {
      const tag = r.ok ? 'PASS' : 'FAIL';
      if (r.ok) pass++; else fail++;
      process.stdout.write(tag + ' ' + r.label + (r.detail ? '  (' + r.detail + ')' : '') + '\n');
    }
    process.stdout.write('\nSelf-test: ' + pass + '/' + (pass + fail) + ' passed\n');
    process.exit(st.ok ? 0 : 1);
  } else {
    process.stdout.write('orchestrator-live-writer.cjs --self-test  (no other CLI flags; this is a library)\n');
    process.exit(0);
  }
}

module.exports = { appendEvent, getEventTypes, selfTest, EVENT_TYPES, SCHEMA_VERSION };
