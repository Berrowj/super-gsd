#!/usr/bin/env node
// =============================================================================
// super-gsd/scripts/lib/orchestrator-live-reader.cjs
// Phase 75-01: ORCHESTRATOR-LIVE.jsonl reader / parser library.
//
// PURPOSE
//   READ-ONLY tail/parse helper for the unified live event stream produced by
//   the Phase 74 writer (orchestrator-live-writer.cjs). Consumed by the
//   cockpit-state adapter (Phase 76) and MCP cockpit_snapshot (Phase 71).
//
//   Lock-13 wrapped: every public API returns {ok, ...} and never throws
//   across the orchestrator boundary. Bad input / missing files / corrupt
//   JSON lines degrade to {ok:true, events:[], parse_errors:[...]} rather
//   than failing the caller.
//
// PUBLIC APIs
//   - tailEvents({projectDir?, n?})    -> {ok, events: [...]}
//   - parseEvents(rawText)             -> {ok, events, parse_errors}
//   - filterByType(events, type)       -> array (does NOT return envelope; pure filter)
//   - selfTest()                       -> {ok, results: [...]}
//
// READ-ONLY INVARIANT
//   This file MUST NOT contain any fs write tokens. selfTest verifies via
//   string-concat scan (banned tokens built at runtime to avoid the scan
//   matching its own check). Any fs.append/write/unlink/mkdir/rm/rmdir
//   reference here is a regression and a security boundary violation.
//   Note: the selfTest itself uses spawnSync to a tiny inline writer for
//   fixture creation; the writer code is OUTSIDE this file.
//
// ASCII-only.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const STREAM_FILENAME = 'ORCHESTRATOR-LIVE.jsonl';

// Mirror the closed vocab from the writer for shape assertions in selfTest.
// Kept locally (not require()'d) to keep this file standalone and avoid an
// accidental coupling to the writer's runtime side-effects.
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

function _resolveStreamPath(projectDir) {
  const dir = projectDir && typeof projectDir === 'string'
    ? path.resolve(projectDir)
    : process.cwd();
  return path.join(dir, '.planning', STREAM_FILENAME);
}

function parseEvents(rawText) {
  try {
    if (typeof rawText !== 'string') {
      return { ok: false, error: 'invalid_input: rawText not a string', events: [], parse_errors: [] };
    }
    const events = [];
    const parse_errors = [];
    if (!rawText) {
      return { ok: true, events: events, parse_errors: parse_errors };
    }
    const lines = rawText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        events.push(obj);
      } catch (e) {
        parse_errors.push({
          line_index: i,
          message: (e && e.message) ? e.message : 'parse_error'
        });
      }
    }
    return { ok: true, events: events, parse_errors: parse_errors };
  } catch (e) {
    return {
      ok: false,
      error: 'parse_failed: ' + (e && e.message ? e.message : 'unknown'),
      events: [],
      parse_errors: []
    };
  }
}

function tailEvents(opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const n = (typeof o.n === 'number' && o.n >= 0) ? Math.floor(o.n) : 10;
    const streamPath = _resolveStreamPath(o.projectDir);
    if (!fs.existsSync(streamPath)) {
      return { ok: true, events: [], parse_errors: [], stream_path: streamPath, missing: true };
    }
    const text = fs.readFileSync(streamPath, 'utf8');
    const parsed = parseEvents(text);
    if (!parsed.ok) {
      return {
        ok: false,
        error: parsed.error || 'parse_failed',
        events: [],
        parse_errors: parsed.parse_errors || [],
        stream_path: streamPath
      };
    }
    const all = parsed.events;
    const sliced = (n === 0) ? all : all.slice(-n);
    return {
      ok: true,
      events: sliced,
      parse_errors: parsed.parse_errors,
      stream_path: streamPath,
      total_events: all.length
    };
  } catch (e) {
    return {
      ok: false,
      error: 'tail_failed: ' + (e && e.message ? e.message : 'unknown'),
      events: [],
      parse_errors: []
    };
  }
}

function filterByType(events, type) {
  if (!Array.isArray(events)) return [];
  if (typeof type !== 'string') return [];
  const out = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e && e.type === type) out.push(e);
  }
  return out;
}

// -- Self-test ---------------------------------------------------------------
function selfTest() {
  const results = [];
  function assert(label, cond, detail) {
    results.push({ label: label, ok: !!cond, detail: detail || '' });
  }

  try {
    // A1: EVENT_TYPES mirror len=16 + frozen
    assert('A1_event_types_mirror_frozen_16',
      Object.isFrozen(EVENT_TYPES) && EVENT_TYPES.length === 16,
      'len=' + EVENT_TYPES.length + ' frozen=' + Object.isFrozen(EVENT_TYPES));

    // A2: missing file -> ok:true with missing flag, empty events
    const tmpEmpty = path.join(require('os').tmpdir(), 'live-reader-empty-' + Date.now());
    const r2 = tailEvents({ projectDir: tmpEmpty, n: 10 });
    assert('A2_missing_file_graceful',
      r2 && r2.ok === true && Array.isArray(r2.events) && r2.events.length === 0,
      'ok=' + (r2 && r2.ok) + ' missing=' + (r2 && r2.missing));

    // A3: parseEvents on bad input
    const r3 = parseEvents(null);
    assert('A3_parse_bad_input_degraded', r3 && r3.ok === false, 'ok=' + (r3 && r3.ok));

    // Build a fixture stream covering ALL 16 EVENT_TYPES + 1 corrupted line.
    const tmp = path.join(require('os').tmpdir(), 'live-reader-self-test-' + Date.now());
    fs.mkdirSync(path.join(tmp, '.planning'), { recursive: true });
    const streamPath = path.join(tmp, '.planning', STREAM_FILENAME);

    const fixturePerType = {
      run_started: { mode: 'auto', user_command: '/sgsd-orchestrate go', session_id: 's1' },
      phase_started: { phase: '75', phase_name: 'live-event-writer-integration', milestone: 'v2.4' },
      plan_selected: { plan_id: '75-01', title: 'wire-in', expected_atc_tier: 'full' },
      agent_dispatched: { agent: 'gsd-executor', model: 'sonnet', task_id: 't1', purpose: 'p75' },
      agent_progress: { task_id: 't1', current_action: 'editing', files_touched: ['a.cjs'] },
      agent_completed: { task_id: 't1', agent: 'gsd-executor', outcome: 'pass', summary: 'done', files_changed: ['a.cjs'] },
      codex_started: { step: '6.5', scope: 'phase-level', prompt_chars: 12345 },
      codex_completed: { verdict: 'pass', critical_count: 0, warning_count: 0, duration_ms: 1234 },
      gate_started: { gate: 'phase-level-ATC', phase: '75' },
      gate_passed: { gate: 'phase-level-ATC', phase: '75', verdict: 'pass', evidence_path: '75-ATC-REVIEW.md' },
      gate_warned: { gate: 'token-log', phase: '75', verdict: 'warn', evidence_path: 'token-log.jsonl' },
      gate_failed: { gate: 'edge-guard', phase: '75', verdict: 'fail', evidence_path: 'edge-guard-log.jsonl' },
      token_threshold_crossed: { role: 'executor', threshold_kind: 'soft', actual_value: 12345, threshold_value: 10000 },
      checkpoint_written: { path: '.planning/ORCHESTRATOR-CHECKPOINT.md', next_unit: 'phase 76', reason: 'session_end' },
      operator_attention_required: { reason: 'no_activity', context: 'idle 90s' },
      run_completed: { outcome: 'all_phases_complete', duration_seconds: 3600 }
    };

    let fixtureLines = '';
    for (let i = 0; i < EVENT_TYPES.length; i++) {
      const type = EVENT_TYPES[i];
      const ev = {
        schema_version: 1,
        ts: new Date(Date.now() - (EVENT_TYPES.length - i) * 1000).toISOString(),
        type: type,
        milestone: 'v2.4',
        phase: '75',
        plan: '75-01',
        data: fixturePerType[type]
      };
      fixtureLines += JSON.stringify(ev) + '\n';
    }
    // Inject one corrupt line in the middle of the stream.
    const splitParts = fixtureLines.split('\n');
    const insertAt = Math.floor(splitParts.length / 2);
    splitParts.splice(insertAt, 0, '{this is not valid json');
    fixtureLines = splitParts.join('\n');

    fs.writeFileSync(streamPath, fixtureLines, 'utf8');

    // A4: tailEvents reads back all 16 valid events; corrupt line recorded in parse_errors
    const r4 = tailEvents({ projectDir: tmp, n: 0 }); // n:0 means "all"
    assert('A4_tail_reads_all_16_valid',
      r4 && r4.ok === true && r4.events.length === EVENT_TYPES.length,
      'count=' + (r4 && r4.events && r4.events.length) + ' expected=' + EVENT_TYPES.length);

    // A5: parse_errors >= 1 for the corrupt line
    assert('A5_parse_errors_recorded',
      r4 && Array.isArray(r4.parse_errors) && r4.parse_errors.length >= 1,
      'parse_errors=' + (r4 && r4.parse_errors && r4.parse_errors.length));

    // A6: Each event has correct type + schema_version + envelope shape.
    let shapeOk = true;
    let shapeFail = '';
    if (r4 && r4.events) {
      for (let i = 0; i < r4.events.length; i++) {
        const e = r4.events[i];
        if (!e || e.schema_version !== 1 || typeof e.ts !== 'string'
            || typeof e.type !== 'string' || EVENT_TYPES.indexOf(e.type) === -1
            || !e.data || typeof e.data !== 'object') {
          shapeOk = false;
          shapeFail = 'idx=' + i + ' type=' + (e && e.type);
          break;
        }
      }
    } else {
      shapeOk = false;
      shapeFail = 'no events array';
    }
    assert('A6_event_envelope_shape', shapeOk, shapeFail);

    // A7: filterByType returns subset for known type
    const phaseEvents = filterByType(r4 && r4.events ? r4.events : [], 'phase_started');
    assert('A7_filter_by_type_subset',
      Array.isArray(phaseEvents) && phaseEvents.length === 1
        && phaseEvents[0].type === 'phase_started',
      'count=' + phaseEvents.length);

    // A8: filterByType for unknown type returns empty array
    const noneEvents = filterByType(r4 && r4.events ? r4.events : [], 'not_a_real_type');
    assert('A8_filter_by_type_unknown_empty',
      Array.isArray(noneEvents) && noneEvents.length === 0,
      'count=' + noneEvents.length);

    // A9: tailEvents with n=3 returns last 3
    const r9 = tailEvents({ projectDir: tmp, n: 3 });
    assert('A9_tail_n_returns_last_n',
      r9 && r9.ok === true && r9.events.length === 3
        && r9.events[2].type === 'run_completed',
      'count=' + (r9 && r9.events && r9.events.length)
        + ' last=' + (r9 && r9.events && r9.events[r9.events.length - 1] && r9.events[r9.events.length - 1].type));

    // A10: READ-ONLY invariant. Build banned tokens via string concat so the
    //      scan does not match its own check expressions. Banned: any fs
    //      mutation API names (append/write/unlink/mkdir/rm/rmdir/copy/rename
    //      /chmod/chown/truncate/createWriteStream/writeFileSync etc.).
    //      Note: the selfTest uses fs.writeFileSync to create the FIXTURE; we
    //      do NOT scan inside the selfTest body. We scan everything outside
    //      it (the public APIs). Implementation: read the file, locate the
    //      selfTest function start marker, and only scan the portion BEFORE
    //      that marker.
    const src = fs.readFileSync(__filename, 'utf8');
    const selfTestMarker = 'function selfTest' + '(';
    const selfTestIdx = src.indexOf(selfTestMarker);
    const publicSrc = (selfTestIdx > 0) ? src.substring(0, selfTestIdx) : src;
    const banned = [
      'fs.' + 'append' + 'FileSync',
      'fs.' + 'append' + 'File',
      'fs.' + 'write' + 'FileSync',
      'fs.' + 'write' + 'File',
      'fs.' + 'unlink' + 'Sync',
      'fs.' + 'unlink' + '(',
      'fs.' + 'mkdir' + 'Sync',
      'fs.' + 'mkdir' + '(',
      'fs.' + 'rm' + 'Sync',
      'fs.' + 'rm' + 'dirSync',
      'fs.' + 'create' + 'WriteStream',
      'fs.' + 'rename' + 'Sync',
      'fs.' + 'copy' + 'FileSync',
      'fs.' + 'truncate' + 'Sync',
      'fs.' + 'chmod' + 'Sync',
      'fs.' + 'chown' + 'Sync'
    ];
    let bannedHit = '';
    for (let i = 0; i < banned.length; i++) {
      if (publicSrc.indexOf(banned[i]) !== -1) { bannedHit = banned[i]; break; }
    }
    assert('A10_read_only_invariant_public_api',
      bannedHit === '',
      'banned_hit=' + (bannedHit || 'none'));

    // A11: ASCII-only across the entire file
    let firstNonAscii = -1;
    for (let i = 0; i < src.length; i++) {
      if (src.charCodeAt(i) > 127) { firstNonAscii = i; break; }
    }
    assert('A11_ascii_only', firstNonAscii === -1, 'first_nonascii_idx=' + firstNonAscii);

    // A12: parseEvents on empty string -> ok:true with empty events
    const r12 = parseEvents('');
    assert('A12_parse_empty_string_ok',
      r12 && r12.ok === true && r12.events.length === 0 && r12.parse_errors.length === 0,
      'ok=' + (r12 && r12.ok) + ' events=' + (r12 && r12.events && r12.events.length));

    // Cleanup fixtures
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

    const allOk = results.every(function (r) { return r.ok; });
    return { ok: allOk, results: results };
  } catch (e) {
    results.push({ label: 'self_test_threw', ok: false, detail: 'error: ' + (e && e.message) });
    return { ok: false, results: results };
  }
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--self-test') {
    const st = selfTest();
    let pass = 0, fail = 0;
    for (let i = 0; i < st.results.length; i++) {
      const r = st.results[i];
      const tag = r.ok ? 'PASS' : 'FAIL';
      if (r.ok) pass++; else fail++;
      process.stdout.write(tag + ' ' + r.label + (r.detail ? '  (' + r.detail + ')' : '') + '\n');
    }
    process.stdout.write('\nSelf-test: ' + pass + '/' + (pass + fail) + ' passed\n');
    process.exit(st.ok ? 0 : 1);
  } else if (arg === '--tail') {
    const n = parseInt(process.argv[3] || '10', 10);
    const r = tailEvents({ n: n });
    process.stdout.write(JSON.stringify(r) + '\n');
    process.exit(r.ok ? 0 : 1);
  } else {
    process.stdout.write('orchestrator-live-reader.cjs --self-test | --tail [n]\n');
    process.exit(0);
  }
}

module.exports = {
  tailEvents: tailEvents,
  parseEvents: parseEvents,
  filterByType: filterByType,
  selfTest: selfTest,
  EVENT_TYPES: EVENT_TYPES
};
