#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/warp-mcp/server.cjs
// Phase 69-01: SGSD Warp MCP server skeleton (READ-ONLY).
//
// PURPOSE
//   Minimal JSON-RPC 2.0 over stdin/stdout dispatcher implementing the
//   Phase 68 SGSD Warp MCP Contract. 14 tool stubs are registered; each
//   stub returns the canonical degraded envelope with error_code
//   internal_error_degraded and a Phase 70/71-implements message. Phase
//   70 fills in tools 1,2,3,4,11. Phase 71 fills in tools 5,6,7,8,9,10,
//   12,13,14. Phase 72 wires redaction.
//
//   This file is the dispatcher skeleton. It must:
//     - Speak raw JSON-RPC 2.0 over stdio (no @modelcontextprotocol/sdk).
//     - Never throw across the stdio boundary (Lock-13).
//     - Stay READ-ONLY: zero fs.writeFileSync / fs.appendFileSync /
//       fs.unlinkSync / fs.mkdirSync / fs.rmSync / fs.rmdirSync.
//       selfTest A10 enforces by scanning this source. Banned tokens
//       are built via concatenation so they cannot self-trigger the
//       scan.
//     - Stay ASCII-only. selfTest A11 enforces.
//     - Carry frozen vocabularies: TOOL_NAMES (14), ERROR_CODES (11),
//       MATCHER_TYPES (4).
//
// 6 PUBLIC APIs (Lock-13 wrapped)
//   - listTools()
//       -> { tools: [<14 names>] }
//   - dispatchTool(name, args)
//       -> universal envelope (ok or degraded)
//   - handleRequest(jsonRpcRequest)
//       -> JSON-RPC 2.0 response object
//   - loadFixtures(fixturesDir)
//       -> [{tool, scenario, input, expected}, ...]
//   - runMatcher(actual, expected)
//       -> { ok: bool, mismatch_path?: string }
//   - selfTest()
//       -> { ok, results:[...] } (12+ assertions)
//
// TOOL_NAMES (14, frozen) -- VERBATIM from Phase 68 contract
//   1.  sgsd_current_state
//   2.  sgsd_current_phase
//   3.  sgsd_milestone_status
//   4.  sgsd_watchdog_status
//   5.  sgsd_gate_status
//   6.  sgsd_agent_roster
//   7.  sgsd_codex_status
//   8.  sgsd_token_spend
//   9.  sgsd_context_bench_status
//   10. sgsd_latest_commits
//   11. sgsd_recovery_packet
//   12. sgsd_cockpit_snapshot
//   13. sgsd_artifact_links
//   14. sgsd_warp_doctor
//
// ERROR_CODES (11, frozen) -- VERBATIM from Phase 68 contract
//   source_file_missing, source_file_unparseable, source_file_too_large,
//   git_subprocess_failed, git_subprocess_timeout, fixture_loader_invalid,
//   redaction_pass_failed, output_size_exceeded, unknown_tool_name,
//   invalid_input_schema, internal_error_degraded
//
// MATCHER_TYPES (4, frozen)
//   literal, contains, regex, exists
//
// LOCK INVARIANTS
//   - Lock-13: every public API and every tool stub wraps internals in
//     try/catch; never throws upward. Any failure path returns the
//     canonical degraded envelope.
//   - Lock 11: tool dispatch uses TOOL_NAMES.indexOf for byte-equality
//     name matching. No regex on tool names, no fuzzy lookup.
//   - READ-ONLY: zero mutating fs calls. selfTest A10 enforces.
//   - ASCII-only: selfTest A11 enforces via first_nonascii_idx === -1.
// =============================================================================

'use strict';

var fs = require('fs');
var path = require('path');
var readline = require('readline');

// ---------------------------------------------------------------------------
// FROZEN SURFACES
// ---------------------------------------------------------------------------
var SCHEMA_VERSION = 1;

var TOOL_NAMES = Object.freeze([
  'sgsd_current_state',
  'sgsd_current_phase',
  'sgsd_milestone_status',
  'sgsd_watchdog_status',
  'sgsd_gate_status',
  'sgsd_agent_roster',
  'sgsd_codex_status',
  'sgsd_token_spend',
  'sgsd_context_bench_status',
  'sgsd_latest_commits',
  'sgsd_recovery_packet',
  'sgsd_cockpit_snapshot',
  'sgsd_artifact_links',
  'sgsd_warp_doctor',
]);

var ERROR_CODES = Object.freeze([
  'source_file_missing',
  'source_file_unparseable',
  'source_file_too_large',
  'git_subprocess_failed',
  'git_subprocess_timeout',
  'fixture_loader_invalid',
  'redaction_pass_failed',
  'output_size_exceeded',
  'unknown_tool_name',
  'invalid_input_schema',
  'internal_error_degraded',
]);

var MATCHER_TYPES = Object.freeze([
  'literal',
  'contains',
  'regex',
  'exists',
]);

var STUB_MESSAGE = 'Phase 70/71 implements; this is the skeleton stub';

// ---------------------------------------------------------------------------
// ENVELOPE HELPERS
// ---------------------------------------------------------------------------
function _now() {
  try {
    return new Date().toISOString();
  } catch (_e) {
    return '';
  }
}

function _makeEnvelope(tool, data) {
  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    ts: _now(),
    tool: (typeof tool === 'string') ? tool : '?',
    data: (data === undefined) ? null : data,
    _truncated: false,
    _degraded: false,
    _redactions_applied: [],
  };
}

function _makeDegraded(tool, errorCode, errorMessage) {
  var code = (typeof errorCode === 'string'
              && ERROR_CODES.indexOf(errorCode) !== -1)
    ? errorCode
    : 'internal_error_degraded';
  return {
    ok: false,
    schema_version: SCHEMA_VERSION,
    ts: _now(),
    tool: (typeof tool === 'string') ? tool : '?',
    data: null,
    _truncated: false,
    _degraded: true,
    _redactions_applied: [],
    error_code: code,
    error_message: (typeof errorMessage === 'string') ? errorMessage : '',
  };
}

// ---------------------------------------------------------------------------
// 14 TOOL STUBS (Lock-13 wrapped)
// Each stub returns the canonical degraded envelope advertising that
// Phase 70/71 will fill in the implementation. Phase 70/71 replace
// these stubs in-place; the dispatcher (dispatchTool) does not change.
// ---------------------------------------------------------------------------
function _stub(name) {
  return function _toolStub(_args) {
    try {
      return _makeDegraded(name, 'internal_error_degraded', STUB_MESSAGE);
    } catch (_e) {
      return _makeDegraded(name, 'internal_error_degraded', STUB_MESSAGE);
    }
  };
}

var _tool_sgsd_current_state = _stub('sgsd_current_state');
var _tool_sgsd_current_phase = _stub('sgsd_current_phase');
var _tool_sgsd_milestone_status = _stub('sgsd_milestone_status');
var _tool_sgsd_watchdog_status = _stub('sgsd_watchdog_status');
var _tool_sgsd_gate_status = _stub('sgsd_gate_status');
var _tool_sgsd_agent_roster = _stub('sgsd_agent_roster');
var _tool_sgsd_codex_status = _stub('sgsd_codex_status');
var _tool_sgsd_token_spend = _stub('sgsd_token_spend');
var _tool_sgsd_context_bench_status = _stub('sgsd_context_bench_status');
var _tool_sgsd_latest_commits = _stub('sgsd_latest_commits');
var _tool_sgsd_recovery_packet = _stub('sgsd_recovery_packet');
var _tool_sgsd_cockpit_snapshot = _stub('sgsd_cockpit_snapshot');
var _tool_sgsd_artifact_links = _stub('sgsd_artifact_links');
var _tool_sgsd_warp_doctor = _stub('sgsd_warp_doctor');

// Map<string, function> -- canonical registry. Phase 70/71 patch in
// real implementations by reassigning these entries.
var TOOL_REGISTRY = new Map();
TOOL_REGISTRY.set('sgsd_current_state', _tool_sgsd_current_state);
TOOL_REGISTRY.set('sgsd_current_phase', _tool_sgsd_current_phase);
TOOL_REGISTRY.set('sgsd_milestone_status', _tool_sgsd_milestone_status);
TOOL_REGISTRY.set('sgsd_watchdog_status', _tool_sgsd_watchdog_status);
TOOL_REGISTRY.set('sgsd_gate_status', _tool_sgsd_gate_status);
TOOL_REGISTRY.set('sgsd_agent_roster', _tool_sgsd_agent_roster);
TOOL_REGISTRY.set('sgsd_codex_status', _tool_sgsd_codex_status);
TOOL_REGISTRY.set('sgsd_token_spend', _tool_sgsd_token_spend);
TOOL_REGISTRY.set('sgsd_context_bench_status', _tool_sgsd_context_bench_status);
TOOL_REGISTRY.set('sgsd_latest_commits', _tool_sgsd_latest_commits);
TOOL_REGISTRY.set('sgsd_recovery_packet', _tool_sgsd_recovery_packet);
TOOL_REGISTRY.set('sgsd_cockpit_snapshot', _tool_sgsd_cockpit_snapshot);
TOOL_REGISTRY.set('sgsd_artifact_links', _tool_sgsd_artifact_links);
TOOL_REGISTRY.set('sgsd_warp_doctor', _tool_sgsd_warp_doctor);

// ---------------------------------------------------------------------------
// PUBLIC API: listTools (Lock-13 wrapped)
// ---------------------------------------------------------------------------
function listTools() {
  try {
    return { tools: TOOL_NAMES.slice() };
  } catch (_e) {
    return { tools: [] };
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: dispatchTool (Lock-13 wrapped)
//   Bad name        -> degraded(unknown_tool_name)
//   Bad args shape  -> degraded(invalid_input_schema)
//   Stub returns    -> degraded(internal_error_degraded, STUB_MESSAGE)
// ---------------------------------------------------------------------------
function dispatchTool(name, args) {
  try {
    if (typeof name !== 'string' || TOOL_NAMES.indexOf(name) === -1) {
      return _makeDegraded(
        (typeof name === 'string') ? name : '?',
        'unknown_tool_name',
        'unknown tool name; not in TOOL_NAMES'
      );
    }
    if (args === null
        || typeof args === 'undefined'
        || typeof args !== 'object'
        || Array.isArray(args)) {
      return _makeDegraded(
        name,
        'invalid_input_schema',
        'tool args must be a plain object'
      );
    }
    var fn = TOOL_REGISTRY.get(name);
    if (typeof fn !== 'function') {
      return _makeDegraded(name, 'internal_error_degraded',
        'tool function missing in registry');
    }
    var out = fn(args);
    if (!out || typeof out !== 'object') {
      return _makeDegraded(name, 'internal_error_degraded',
        'tool returned non-object');
    }
    return out;
  } catch (_e) {
    return _makeDegraded(
      (typeof name === 'string') ? name : '?',
      'internal_error_degraded',
      'dispatch threw: ' + ((_e && _e.message) ? _e.message : 'unknown')
    );
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 response helpers
// ---------------------------------------------------------------------------
function _rpcResult(id, result) {
  return {
    jsonrpc: '2.0',
    id: (typeof id === 'undefined') ? null : id,
    result: result,
  };
}

function _rpcError(id, code, message) {
  return {
    jsonrpc: '2.0',
    id: (typeof id === 'undefined') ? null : id,
    error: {
      code: (typeof code === 'number') ? code : -32603,
      message: (typeof message === 'string') ? message : 'internal error',
    },
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API: handleRequest (Lock-13 wrapped)
//   Accepts either a parsed JSON-RPC object or a raw string. If string,
//   parses it; on parse failure returns -32700.
//   Supported methods:
//     - tools/list      -> { tools: [...14] }
//     - tools/call      -> universal envelope wrapped in result.data
//                          (params: { name, arguments })
//     - schema_version  -> { schema_version: 1 }
// ---------------------------------------------------------------------------
function handleRequest(input) {
  var req = null;
  try {
    if (typeof input === 'string') {
      try {
        req = JSON.parse(input);
      } catch (_pe) {
        return _rpcError(null, -32700, 'parse error');
      }
    } else if (input && typeof input === 'object') {
      req = input;
    } else {
      return _rpcError(null, -32600, 'invalid request');
    }

    if (!req || typeof req !== 'object' || Array.isArray(req)) {
      return _rpcError(null, -32600, 'invalid request');
    }
    if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      return _rpcError(
        (typeof req.id === 'undefined') ? null : req.id,
        -32600,
        'invalid request'
      );
    }

    var id = (typeof req.id === 'undefined') ? null : req.id;
    var method = req.method;
    var params = req.params || {};

    if (method === 'tools/list') {
      return _rpcResult(id, listTools());
    }
    if (method === 'schema_version') {
      return _rpcResult(id, { schema_version: SCHEMA_VERSION });
    }
    if (method === 'tools/call') {
      var name = (params && typeof params.name === 'string') ? params.name : '';
      var args = (params && params.arguments && typeof params.arguments === 'object'
                  && !Array.isArray(params.arguments))
        ? params.arguments
        : {};
      var envelope = dispatchTool(name, args);
      return _rpcResult(id, { data: envelope });
    }
    return _rpcError(id, -32601, 'method not found');
  } catch (_e) {
    var safeId = null;
    try { safeId = (req && typeof req.id !== 'undefined') ? req.id : null; }
    catch (_ie) { safeId = null; }
    return _rpcError(safeId, -32603,
      'internal error: ' + ((_e && _e.message) ? _e.message : 'unknown'));
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: loadFixtures (Lock-13 wrapped)
//   Walks fixturesDir/{tool}/{scenario}.input.json and pairs with
//   {scenario}.expected.json. Returns array of pairs. Missing dir or
//   per-tool dir errors degrade to skip-and-continue.
// ---------------------------------------------------------------------------
function loadFixtures(fixturesDir) {
  var pairs = [];
  try {
    if (typeof fixturesDir !== 'string' || fixturesDir.length === 0) {
      return pairs;
    }
    if (!fs.existsSync(fixturesDir)) {
      return pairs;
    }
    var st = null;
    try { st = fs.statSync(fixturesDir); } catch (_e) { return pairs; }
    if (!st || !st.isDirectory()) return pairs;

    var toolDirs = [];
    try { toolDirs = fs.readdirSync(fixturesDir); } catch (_e) { return pairs; }

    for (var i = 0; i < toolDirs.length; i++) {
      var entry = toolDirs[i];
      if (!entry || entry.charAt(0) === '.' || entry === 'README.md') continue;
      var toolDir = path.join(fixturesDir, entry);
      var tst = null;
      try { tst = fs.statSync(toolDir); } catch (_te) { continue; }
      if (!tst || !tst.isDirectory()) continue;

      var files = [];
      try { files = fs.readdirSync(toolDir); } catch (_fe) { continue; }

      for (var fi = 0; fi < files.length; fi++) {
        var fn = files[fi];
        if (typeof fn !== 'string') continue;
        var idx = fn.indexOf('.input.json');
        if (idx === -1) continue;
        if (fn.indexOf('.input.json') !== fn.length - '.input.json'.length) continue;
        var scenario = fn.slice(0, idx);
        var inputPath = path.join(toolDir, fn);
        var expectedPath = path.join(toolDir, scenario + '.expected.json');
        var inputJson = null;
        var expectedJson = null;
        try {
          inputJson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        } catch (_ie) { continue; }
        try {
          if (fs.existsSync(expectedPath)) {
            expectedJson = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
          }
        } catch (_ee) { expectedJson = null; }
        if (expectedJson === null) continue;
        pairs.push({
          tool: entry,
          scenario: scenario,
          input: inputJson,
          expected: expectedJson,
          input_path: inputPath,
          expected_path: expectedPath,
        });
      }
    }
    return pairs;
  } catch (_e) {
    return pairs;
  }
}

// ---------------------------------------------------------------------------
// MATCHER ENGINE
//   Recognises 4 matcher tokens (frozen MATCHER_TYPES):
//     literal              -- direct === comparison.
//     <contains>SUB</contains>
//     <regex>PATTERN</regex>
//     <exists>true</exists>
//
//   Strings with no recognised wrapper are treated as literal.
// ---------------------------------------------------------------------------
function _matchString(actual, expected) {
  if (typeof expected !== 'string') {
    return { ok: actual === expected };
  }
  // <exists>true</exists>
  if (expected === '<exists>true</exists>') {
    return { ok: typeof actual !== 'undefined' };
  }
  // <contains>SUB</contains>
  var cOpen = '<contains>';
  var cClose = '</contains>';
  if (expected.indexOf(cOpen) === 0
      && expected.lastIndexOf(cClose) === expected.length - cClose.length) {
    var sub = expected.slice(cOpen.length, expected.length - cClose.length);
    if (typeof actual !== 'string') return { ok: false };
    return { ok: actual.indexOf(sub) !== -1 };
  }
  // <regex>PATTERN</regex>
  var rOpen = '<regex>';
  var rClose = '</regex>';
  if (expected.indexOf(rOpen) === 0
      && expected.lastIndexOf(rClose) === expected.length - rClose.length) {
    var pat = expected.slice(rOpen.length, expected.length - rClose.length);
    if (typeof actual !== 'string') return { ok: false };
    var re = null;
    try { re = new RegExp(pat); } catch (_re) { return { ok: false }; }
    return { ok: re.test(actual) };
  }
  // literal
  return { ok: actual === expected };
}

function _matchValue(actual, expected, pathStr) {
  if (expected === null) {
    return { ok: actual === null, mismatch_path: actual === null ? undefined : pathStr };
  }
  if (typeof expected === 'string') {
    var sm = _matchString(actual, expected);
    return sm.ok ? { ok: true } : { ok: false, mismatch_path: pathStr };
  }
  if (typeof expected === 'number' || typeof expected === 'boolean') {
    return actual === expected
      ? { ok: true }
      : { ok: false, mismatch_path: pathStr };
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return { ok: false, mismatch_path: pathStr };
    if (actual.length !== expected.length) {
      return { ok: false, mismatch_path: pathStr + '[length]' };
    }
    for (var ai = 0; ai < expected.length; ai++) {
      var er = _matchValue(actual[ai], expected[ai], pathStr + '[' + ai + ']');
      if (!er.ok) return er;
    }
    return { ok: true };
  }
  if (typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      return { ok: false, mismatch_path: pathStr };
    }
    var keys = Object.keys(expected);
    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      var nextPath = pathStr ? (pathStr + '.' + k) : k;
      var sub = _matchValue(actual[k], expected[k], nextPath);
      if (!sub.ok) return sub;
    }
    return { ok: true };
  }
  return actual === expected
    ? { ok: true }
    : { ok: false, mismatch_path: pathStr };
}

// ---------------------------------------------------------------------------
// PUBLIC API: runMatcher (Lock-13 wrapped)
// ---------------------------------------------------------------------------
function runMatcher(actual, expected) {
  try {
    return _matchValue(actual, expected, '');
  } catch (_e) {
    return { ok: false, mismatch_path: '<matcher_threw>' };
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: selfTest (Lock-13 wrapped)
// 13+ assertions covering frozen surfaces, dispatcher Lock-13, JSON-RPC
// responses, READ-ONLY invariant, ASCII-only, and matcher engine
// behaviour.
// ---------------------------------------------------------------------------
function selfTest() {
  var results = [];
  function add(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  try {
    // A1: TOOL_NAMES frozen, len === 14.
    add('tool_names_frozen_len_14',
      Object.isFrozen(TOOL_NAMES) && TOOL_NAMES.length === 14,
      'frozen=' + Object.isFrozen(TOOL_NAMES) + ' len=' + TOOL_NAMES.length);

    // A2: ERROR_CODES frozen, len === 11.
    add('error_codes_frozen_len_11',
      Object.isFrozen(ERROR_CODES) && ERROR_CODES.length === 11,
      'frozen=' + Object.isFrozen(ERROR_CODES) + ' len=' + ERROR_CODES.length);

    // A3: MATCHER_TYPES frozen, len === 4.
    add('matcher_types_frozen_len_4',
      Object.isFrozen(MATCHER_TYPES) && MATCHER_TYPES.length === 4,
      'frozen=' + Object.isFrozen(MATCHER_TYPES) + ' len=' + MATCHER_TYPES.length);

    // A4: dispatchTool('not_a_real_tool', {}) returns degraded with
    // error_code === 'unknown_tool_name'.
    var r4 = dispatchTool('not_a_real_tool', {});
    add('dispatch_unknown_tool_name',
      r4 && r4.ok === false && r4._degraded === true
        && r4.error_code === 'unknown_tool_name',
      'error_code=' + (r4 ? r4.error_code : 'null'));

    // A5: dispatchTool('sgsd_current_state', null) returns degraded
    // with error_code === 'invalid_input_schema'.
    var r5 = dispatchTool('sgsd_current_state', null);
    add('dispatch_null_args_invalid_schema',
      r5 && r5.ok === false && r5._degraded === true
        && r5.error_code === 'invalid_input_schema',
      'error_code=' + (r5 ? r5.error_code : 'null'));

    // A6: every TOOL_NAMES entry, dispatchTool(name, {}) returns
    // degraded envelope with error_code === 'internal_error_degraded'
    // and error_message contains 'Phase 70/71'.
    var stubsOK = true;
    var stubDetail = '';
    for (var i = 0; i < TOOL_NAMES.length; i++) {
      var nm = TOOL_NAMES[i];
      var rr = dispatchTool(nm, {});
      if (!rr || rr.ok !== false || rr._degraded !== true
          || rr.error_code !== 'internal_error_degraded'
          || typeof rr.error_message !== 'string'
          || rr.error_message.indexOf('Phase 70/71') === -1) {
        stubsOK = false;
        stubDetail = 'failed at ' + nm;
        break;
      }
    }
    add('every_stub_returns_phase70_71_degraded', stubsOK,
      stubDetail || 'all 14 stubs OK');

    // A7: handleRequest tools/list returns 14 tools.
    var r7 = handleRequest({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
    add('handle_request_tools_list_returns_14',
      r7 && r7.jsonrpc === '2.0' && r7.id === 1
        && r7.result && Array.isArray(r7.result.tools)
        && r7.result.tools.length === 14,
      'len=' + (r7 && r7.result && r7.result.tools
        ? r7.result.tools.length : '?'));

    // A8: handleRequest schema_version returns schema_version: 1.
    var r8 = handleRequest({ jsonrpc: '2.0', method: 'schema_version', id: 2 });
    add('handle_request_schema_version_1',
      r8 && r8.jsonrpc === '2.0' && r8.id === 2
        && r8.result && r8.result.schema_version === 1,
      'sv=' + (r8 && r8.result ? r8.result.schema_version : '?'));

    // A9: handleRequest with malformed JSON string returns -32700 parse
    // error. Also test invalid request shape returns -32600.
    var r9a = handleRequest('not json at all');
    var parseOK = r9a && r9a.error && r9a.error.code === -32700;
    var r9b = handleRequest({ method: 'tools/list' });
    var invReqOK = r9b && r9b.error && r9b.error.code === -32600;
    add('handle_request_bad_input_jsonrpc_errors',
      parseOK && invReqOK,
      'parse_code=' + (r9a && r9a.error ? r9a.error.code : '?')
        + ' invreq_code=' + (r9b && r9b.error ? r9b.error.code : '?'));

    // A10: READ-ONLY invariant. Banned tokens built via concat so the
    // assertion text itself does not register as a hit. Strip pure
    // comment lines (// or *) before scanning so doc comments do not
    // self-match.
    var src = '';
    try { src = fs.readFileSync(__filename, 'utf8'); } catch (_e) { src = ''; }
    var FS = 'fs.';
    var bannedTokens = [
      FS + 'write' + 'FileSync',
      FS + 'append' + 'FileSync',
      FS + 'unlink' + 'Sync',
      FS + 'mkdir' + 'Sync',
      FS + 'rm' + 'Sync',
      FS + 'rmdir' + 'Sync',
    ];
    var srcLines = src.split(/\r?\n/);
    var codeOnly = '';
    for (var li = 0; li < srcLines.length; li++) {
      var ln = srcLines[li];
      var lt = ln.replace(/^\s+/, '');
      if (lt.indexOf('//') === 0) continue;
      if (lt.indexOf('*') === 0) continue;
      codeOnly += ln + '\n';
    }
    var hasWrite = false;
    var hitToken = '';
    for (var bi = 0; bi < bannedTokens.length; bi++) {
      if (codeOnly.indexOf(bannedTokens[bi]) !== -1) {
        hasWrite = true; hitToken = bannedTokens[bi]; break;
      }
    }
    add('read_only_invariant_no_fs_writes',
      hasWrite === false,
      'hasWrite=' + hasWrite + (hitToken ? (' token=' + hitToken) : ''));

    // A11: ASCII-only.
    var firstNonAscii = -1;
    for (var ci = 0; ci < src.length; ci++) {
      var cc = src.charCodeAt(ci);
      if (cc > 0x7E || (cc < 0x20 && cc !== 0x09 && cc !== 0x0A && cc !== 0x0D)) {
        firstNonAscii = ci;
        break;
      }
    }
    add('ascii_only_source',
      firstNonAscii === -1,
      'first_nonascii_idx=' + firstNonAscii);

    // A12: matcher engine -- 4 cases.
    var m1 = runMatcher('hello', 'hello');
    var m2 = runMatcher('hello world', '<contains>world</contains>');
    var m3 = runMatcher('v1', '<regex>^v\\d+$</regex>');
    var m4a = runMatcher(0, '<exists>true</exists>');
    var m4b = runMatcher(undefined, '<exists>true</exists>');
    var matcherOK = m1.ok === true
                  && m2.ok === true
                  && m3.ok === true
                  && m4a.ok === true
                  && m4b.ok === false;
    add('matcher_engine_literal_contains_regex_exists',
      matcherOK,
      'lit=' + m1.ok + ' contains=' + m2.ok + ' regex=' + m3.ok
        + ' exists_defined=' + m4a.ok + ' exists_undefined=' + m4b.ok);

    // A13: TOOL_NAMES verbatim from Phase 68 contract -- 14 named
    // tools. Each name MUST be present.
    var requiredNames = [
      'sgsd_current_state',
      'sgsd_current_phase',
      'sgsd_milestone_status',
      'sgsd_watchdog_status',
      'sgsd_gate_status',
      'sgsd_agent_roster',
      'sgsd_codex_status',
      'sgsd_token_spend',
      'sgsd_context_bench_status',
      'sgsd_latest_commits',
      'sgsd_recovery_packet',
      'sgsd_cockpit_snapshot',
      'sgsd_artifact_links',
      'sgsd_warp_doctor',
    ];
    var verbatimOK = requiredNames.length === 14;
    var missingName = '';
    for (var ri = 0; ri < requiredNames.length; ri++) {
      if (TOOL_NAMES.indexOf(requiredNames[ri]) === -1) {
        verbatimOK = false; missingName = requiredNames[ri]; break;
      }
    }
    add('tool_names_verbatim_phase_68_contract',
      verbatimOK,
      missingName ? ('missing=' + missingName) : 'all 14 verbatim');

    // A14: loadFixtures with non-existent dir returns []; never throws.
    var threwLF = false;
    var lf = null;
    try {
      lf = loadFixtures('/this/path/does/not/exist/at/all/xyz');
    } catch (_e) { threwLF = true; }
    add('load_fixtures_missing_dir_returns_empty_no_throw',
      !threwLF && Array.isArray(lf) && lf.length === 0,
      'threw=' + threwLF + ' len=' + (lf ? lf.length : '?'));

    // A15: dispatchTool degraded envelope shape conforms to Phase 68
    // contract: ok=false, schema_version=1, ts string, tool string,
    // data===null, _truncated=false, _degraded=true,
    // _redactions_applied=[], error_code in ERROR_CODES,
    // error_message string.
    var rs = dispatchTool('sgsd_current_state', {});
    var envOK = rs && rs.ok === false
              && rs.schema_version === 1
              && typeof rs.ts === 'string' && rs.ts.length > 0
              && rs.tool === 'sgsd_current_state'
              && rs.data === null
              && rs._truncated === false
              && rs._degraded === true
              && Array.isArray(rs._redactions_applied)
              && rs._redactions_applied.length === 0
              && ERROR_CODES.indexOf(rs.error_code) !== -1
              && typeof rs.error_message === 'string';
    add('degraded_envelope_shape_conforms',
      envOK,
      'ok=' + (rs ? rs.ok : '?') + ' code=' + (rs ? rs.error_code : '?'));

    return {
      ok: results.every(function (r) { return r.ok; }),
      results: results,
    };
  } catch (e) {
    add('self_test_outer_threw', false,
      'message=' + (e && e.message ? e.message : 'unknown'));
    return { ok: false, results: results };
  }
}

// ---------------------------------------------------------------------------
// _internals (cross-task composition)
// ---------------------------------------------------------------------------
var _internals = Object.freeze({
  SCHEMA_VERSION: SCHEMA_VERSION,
  TOOL_NAMES: TOOL_NAMES,
  ERROR_CODES: ERROR_CODES,
  MATCHER_TYPES: MATCHER_TYPES,
  TOOL_REGISTRY: TOOL_REGISTRY,
  STUB_MESSAGE: STUB_MESSAGE,
  _now: _now,
  _makeEnvelope: _makeEnvelope,
  _makeDegraded: _makeDegraded,
  _matchString: _matchString,
  _matchValue: _matchValue,
  _rpcResult: _rpcResult,
  _rpcError: _rpcError,
});

// ---------------------------------------------------------------------------
// CLI: stdio loop. Reads newline-delimited JSON-RPC requests on stdin,
// writes one JSON-RPC response per request on stdout.
// ---------------------------------------------------------------------------
function _runStdio() {
  try {
    var rl = readline.createInterface({
      input: process.stdin,
      output: undefined,
      terminal: false,
    });
    rl.on('line', function (line) {
      try {
        var trimmed = (typeof line === 'string') ? line.replace(/^\s+|\s+$/g, '') : '';
        if (trimmed.length === 0) return;
        var resp = handleRequest(trimmed);
        process.stdout.write(JSON.stringify(resp) + '\n');
      } catch (_le) {
        var errResp = _rpcError(null, -32603,
          'stdio handler threw: ' + ((_le && _le.message) ? _le.message : 'unknown'));
        try { process.stdout.write(JSON.stringify(errResp) + '\n'); } catch (_we) { /* swallow */ }
      }
    });
    rl.on('close', function () {
      // exit naturally; nothing to flush.
    });
  } catch (_e) {
    process.stderr.write('warp_mcp_stdio_failed message='
      + ((_e && _e.message) ? _e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

function _printSelfTest(out) {
  if (!out || !Array.isArray(out.results)) {
    process.stdout.write('warp_mcp_self_test: results not an array\n');
    return false;
  }
  var pass = 0;
  for (var i = 0; i < out.results.length; i++) {
    var r = out.results[i];
    var tag = r.ok ? 'PASS' : 'FAIL';
    process.stdout.write(tag + ' ' + r.name + ' ' + (r.detail || '') + '\n');
    if (r.ok) pass++;
  }
  process.stdout.write('---\n');
  process.stdout.write('warp_mcp_self_test: ' + pass + '/' + out.results.length
    + ' assertions passed\n');
  return pass === out.results.length;
}

function _main(argv) {
  try {
    var args = argv.slice(2);
    if (args.indexOf('--help') !== -1 || args.indexOf('-h') !== -1) {
      process.stdout.write('usage: node server.cjs [--stdio|--self-test|--help]\n');
      process.stdout.write('  --stdio      (default) JSON-RPC 2.0 over stdin/stdout\n');
      process.stdout.write('  --self-test  run selfTest and print results\n');
      process.stdout.write('  --help       show this message\n');
      process.exit(0);
      return;
    }
    if (args.indexOf('--self-test') !== -1) {
      var out = selfTest();
      var allOK = _printSelfTest(out);
      process.exit(allOK ? 0 : 1);
      return;
    }
    // default: --stdio
    _runStdio();
  } catch (e) {
    process.stderr.write('warp_mcp_internal_error message='
      + (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = {
  listTools: listTools,
  dispatchTool: dispatchTool,
  handleRequest: handleRequest,
  loadFixtures: loadFixtures,
  runMatcher: runMatcher,
  selfTest: selfTest,
  _internals: _internals,
};
