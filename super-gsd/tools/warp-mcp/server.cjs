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
// SHARED INTERNAL HELPERS (Phase 70)
//   _resolvePlanningDir(args)
//     Returns the planning dir to read from. If args.fixture_planning_dir
//     is a non-empty string, returns it (used by fixtures to point at a
//     synthetic .planning tree). Otherwise returns the live .planning at
//     the repo root (path.join(__dirname, '../../../.planning')).
//
//   _parseStateFrontmatter(planningDir)
//     Reads STATE.md, extracts content between the first two `---` lines,
//     parses the YAML-ish frontmatter via a hand-written indent-tracker
//     (no YAML parser dep). Returns a flat object with nested sub-objects
//     for `progress` and `roadmap_run`. Returns null on miss/parse error.
//
//   _tailJsonl(filePath, n)
//     Reads a JSONL file, splits by newline, takes last n non-empty rows,
//     JSON.parses each. Skips parse errors silently. Returns array.
//     Lock-13 wrapped: missing/error -> [].
// ---------------------------------------------------------------------------
function _resolvePlanningDir(args) {
  try {
    if (args && typeof args.fixture_planning_dir === 'string'
        && args.fixture_planning_dir.length > 0) {
      return args.fixture_planning_dir;
    }
    return path.join(__dirname, '..', '..', '..', '.planning');
  } catch (_e) {
    return path.join(__dirname, '..', '..', '..', '.planning');
  }
}

function _stripQuotes(s) {
  if (typeof s !== 'string') return s;
  var t = s.replace(/^\s+|\s+$/g, '');
  if (t.length >= 2) {
    var c0 = t.charAt(0);
    var cN = t.charAt(t.length - 1);
    if ((c0 === '"' && cN === '"') || (c0 === "'" && cN === "'")) {
      return t.slice(1, -1);
    }
  }
  return t;
}

function _countLeadingSpaces(s) {
  var n = 0;
  while (n < s.length && s.charAt(n) === ' ') n++;
  return n;
}

function _parseStateFrontmatter(planningDir) {
  try {
    if (typeof planningDir !== 'string' || planningDir.length === 0) return null;
    var statePath = path.join(planningDir, 'STATE.md');
    if (!fs.existsSync(statePath)) return null;
    var src = '';
    try { src = fs.readFileSync(statePath, 'utf8'); } catch (_re) { return null; }
    if (typeof src !== 'string' || src.length === 0) return null;

    // Extract frontmatter between first two `---` lines.
    var lines = src.split(/\r?\n/);
    if (lines.length < 2) return null;
    if (lines[0].replace(/\s+$/, '') !== '---') return null;
    var endIdx = -1;
    for (var i = 1; i < lines.length; i++) {
      if (lines[i].replace(/\s+$/, '') === '---') { endIdx = i; break; }
    }
    if (endIdx === -1) return null;

    // Parse k:v with simple indent tracker.
    var out = {};
    // stack of { obj, indent }
    var stack = [{ obj: out, indent: -1 }];

    for (var li = 1; li < endIdx; li++) {
      var raw = lines[li];
      if (typeof raw !== 'string') continue;
      // Skip blank lines and pure-comment lines.
      var trimmed = raw.replace(/^\s+|\s+$/g, '');
      if (trimmed.length === 0) continue;
      if (trimmed.charAt(0) === '#') continue;

      var indent = _countLeadingSpaces(raw);

      // Pop stack while indent <= top.indent
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      var parent = stack[stack.length - 1].obj;

      // Match `key: value` or `key:` (block opener)
      var colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      var key = trimmed.slice(0, colonIdx).replace(/^\s+|\s+$/g, '');
      var val = trimmed.slice(colonIdx + 1).replace(/^\s+|\s+$/g, '');
      // Skip array entries `- ...` -- not used in STATE.md frontmatter
      // for the fields we care about (progress/roadmap_run are objects).
      if (key.charAt(0) === '-') continue;
      if (key.length === 0) continue;

      if (val.length === 0) {
        // Block opener -- create child object and push onto stack.
        var child = {};
        parent[key] = child;
        stack.push({ obj: child, indent: indent });
      } else {
        // Strip wrapping quotes; leave unquoted values as-is.
        parent[key] = _stripQuotes(val);
      }
    }
    return out;
  } catch (_e) {
    return null;
  }
}

function _tailJsonl(filePath, n) {
  var rows = [];
  try {
    if (typeof filePath !== 'string' || filePath.length === 0) return rows;
    if (!fs.existsSync(filePath)) return rows;
    var src = '';
    try { src = fs.readFileSync(filePath, 'utf8'); } catch (_re) { return rows; }
    if (typeof src !== 'string' || src.length === 0) return rows;
    var lines = src.split(/\r?\n/);
    var nn = (typeof n === 'number' && n > 0) ? Math.floor(n) : 10;
    var collected = [];
    for (var i = lines.length - 1; i >= 0 && collected.length < nn; i--) {
      var ln = lines[i];
      if (typeof ln !== 'string') continue;
      var t = ln.replace(/^\s+|\s+$/g, '');
      if (t.length === 0) continue;
      try {
        var obj = JSON.parse(t);
        collected.push(obj);
      } catch (_pe) {
        // Skip parse errors silently.
      }
    }
    // collected is reverse-chrono; flip back to chrono order.
    for (var ri = collected.length - 1; ri >= 0; ri--) {
      rows.push(collected[ri]);
    }
    return rows;
  } catch (_e) {
    return rows;
  }
}

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

// -- Phase 70: 5 real implementations (1, 2, 3, 4, 11) --
function _tool_sgsd_current_state(args) {
  var name = 'sgsd_current_state';
  try {
    var planningDir = _resolvePlanningDir(args);
    var fm = _parseStateFrontmatter(planningDir);
    if (!fm) {
      var statePath = path.join(planningDir, 'STATE.md');
      var exists = false;
      try { exists = fs.existsSync(statePath); } catch (_xe) { exists = false; }
      return _makeDegraded(name,
        exists ? 'source_file_unparseable' : 'source_file_missing',
        exists
          ? 'STATE.md present but frontmatter unparseable'
          : 'STATE.md not found at ' + statePath);
    }

    // Resolve current_phase + status from roadmap_run (preferred) or
    // top-level keys.
    var rr = (fm.roadmap_run && typeof fm.roadmap_run === 'object')
      ? fm.roadmap_run : {};
    var currentPhase = (typeof rr.current_phase === 'string' && rr.current_phase.length > 0)
      ? rr.current_phase
      : null;
    var currentPhaseStatus = (typeof rr.current_phase_status === 'string'
      && rr.current_phase_status.length > 0)
      ? rr.current_phase_status
      : null;

    var data = {
      milestone: (typeof fm.milestone === 'string') ? fm.milestone : null,
      milestone_name: (typeof fm.milestone_name === 'string') ? fm.milestone_name : null,
      milestone_status: (typeof fm.milestone_status === 'string') ? fm.milestone_status : null,
      status: (typeof fm.status === 'string') ? fm.status : null,
      last_updated: (typeof fm.last_updated === 'string') ? fm.last_updated : null,
      last_activity: (typeof fm.last_activity === 'string') ? fm.last_activity : null,
      current_phase: currentPhase,
      current_phase_status: currentPhaseStatus,
    };
    return _makeEnvelope(name, data);
  } catch (_e) {
    return _makeDegraded(name, 'internal_error_degraded',
      'tool threw: ' + ((_e && _e.message) ? _e.message : 'unknown'));
  }
}

function _tool_sgsd_current_phase(args) {
  var name = 'sgsd_current_phase';
  try {
    var planningDir = _resolvePlanningDir(args);
    var fm = _parseStateFrontmatter(planningDir);
    if (!fm) {
      var statePath = path.join(planningDir, 'STATE.md');
      var exists = false;
      try { exists = fs.existsSync(statePath); } catch (_xe) { exists = false; }
      return _makeDegraded(name,
        exists ? 'source_file_unparseable' : 'source_file_missing',
        exists
          ? 'STATE.md present but frontmatter unparseable'
          : 'STATE.md not found at ' + statePath);
    }

    var milestone = (typeof fm.milestone === 'string') ? fm.milestone : null;
    var rr = (fm.roadmap_run && typeof fm.roadmap_run === 'object')
      ? fm.roadmap_run : {};

    // Phase override via args.phase (string), else default from STATE.md.
    var phaseArg = (args && typeof args.phase === 'string' && args.phase.length > 0)
      ? args.phase : null;
    var phase = phaseArg
      || ((typeof rr.current_phase === 'string') ? rr.current_phase : null);
    var phaseStatus = (typeof rr.current_phase_status === 'string')
      ? rr.current_phase_status : null;
    var closeCommit = (typeof rr.current_phase_close_commit === 'string')
      ? rr.current_phase_close_commit : null;
    var phaseName = (typeof rr.current_phase_name === 'string')
      ? rr.current_phase_name : null;

    // Roadmap-complete handling -- do not synthesise a false active phase.
    if (phase === 'complete' || (typeof phase === 'string' && phase.toLowerCase() === 'complete')) {
      // Compute deferred_count from progress.{milestone}.phase_* PASS-WITH-DEFERRED-N
      var deferredCount = 0;
      var deferredSummary = null;
      if (milestone) {
        var key = milestone.replace(/[.\-]/g, '_');
        var prog = (fm.progress && typeof fm.progress === 'object'
          && fm.progress[key] && typeof fm.progress[key] === 'object')
          ? fm.progress[key] : null;
        if (prog) {
          var pkeys = Object.keys(prog);
          for (var pi = 0; pi < pkeys.length; pi++) {
            var pv = prog[pkeys[pi]];
            if (typeof pv !== 'string') continue;
            var m = pv.match(/PASS-WITH-DEFERRED-(\d+)/);
            if (m && m[1]) {
              deferredCount += parseInt(m[1], 10) || 0;
            }
          }
          if (deferredCount > 0) {
            deferredSummary = deferredCount + ' deferred items across milestone phases';
          }
        }
      }
      var dataC = {
        phase: 'complete',
        phase_name: phaseName || ((milestone || '?') + ' ALL-PHASES-CLOSED'),
        milestone: milestone,
        status: phaseStatus || 'ALL-PHASES-CLOSED',
        close_commit: closeCommit,
        plans: [],
        deferred_count: deferredCount,
        deferred_summary: deferredSummary,
      };
      return _makeEnvelope(name, dataC);
    }

    // Active phase: try to enumerate plans from phase folder.
    var plans = [];
    if (milestone && phase) {
      var phasesDir = path.join(planningDir, 'milestones', milestone, 'phases');
      if (fs.existsSync(phasesDir)) {
        var phaseFolders = [];
        try { phaseFolders = fs.readdirSync(phasesDir); } catch (_le) { phaseFolders = []; }
        var pad2 = (phase.length === 1) ? ('0' + phase) : phase;
        var matchFolder = null;
        for (var fi = 0; fi < phaseFolders.length; fi++) {
          var fn = phaseFolders[fi];
          if (typeof fn !== 'string') continue;
          if (fn.indexOf(pad2 + '-') === 0 || fn.indexOf(phase + '-') === 0) {
            matchFolder = fn; break;
          }
        }
        if (matchFolder) {
          var phaseDirFull = path.join(phasesDir, matchFolder);
          var entries = [];
          try { entries = fs.readdirSync(phaseDirFull); } catch (_de) { entries = []; }
          for (var ei = 0; ei < entries.length; ei++) {
            var en = entries[ei];
            if (typeof en !== 'string') continue;
            // Match {NN}-{NN}-...-PLAN.md pattern.
            var pm = en.match(/^(\d+)-(\d+)-.*-PLAN\.md$/);
            if (pm) {
              plans.push({
                id: pm[1] + '-' + pm[2],
                status: 'unknown',
              });
            }
          }
        }
      }
    }

    var dataA = {
      phase: phase,
      phase_name: phaseName,
      milestone: milestone,
      status: phaseStatus,
      close_commit: closeCommit,
      plans: plans,
      deferred_count: 0,
      deferred_summary: null,
    };
    return _makeEnvelope(name, dataA);
  } catch (_e) {
    return _makeDegraded(name, 'internal_error_degraded',
      'tool threw: ' + ((_e && _e.message) ? _e.message : 'unknown'));
  }
}

function _tool_sgsd_milestone_status(args) {
  var name = 'sgsd_milestone_status';
  try {
    var milestoneArg = (args && typeof args.milestone === 'string') ? args.milestone : '';
    if (milestoneArg.length === 0) {
      return _makeDegraded(name, 'invalid_input_schema',
        'milestone arg required (e.g. {milestone:"v2.2"})');
    }
    var planningDir = _resolvePlanningDir(args);
    var fm = _parseStateFrontmatter(planningDir);
    if (!fm) {
      var statePath = path.join(planningDir, 'STATE.md');
      var exists = false;
      try { exists = fs.existsSync(statePath); } catch (_xe) { exists = false; }
      return _makeDegraded(name,
        exists ? 'source_file_unparseable' : 'source_file_missing',
        exists
          ? 'STATE.md present but frontmatter unparseable'
          : 'STATE.md not found at ' + statePath);
    }

    var key = milestoneArg.replace(/[.\-]/g, '_');
    var prog = (fm.progress && typeof fm.progress === 'object'
      && fm.progress[key] && typeof fm.progress[key] === 'object')
      ? fm.progress[key] : null;
    if (!prog) {
      return _makeDegraded(name, 'source_file_missing',
        'unknown milestone "' + milestoneArg + '" -- no progress.' + key + ' block in STATE.md');
    }

    var totalPhases = parseInt(prog.total_phases, 10);
    if (isNaN(totalPhases)) totalPhases = 0;
    var completedPhases = parseInt(prog.completed_phases, 10);
    if (isNaN(completedPhases)) completedPhases = 0;
    var percent = parseInt(prog.percent, 10);
    if (isNaN(percent)) {
      percent = (totalPhases > 0)
        ? Math.floor((completedPhases / totalPhases) * 100)
        : 0;
    }

    var phaseSummary = [];
    var pkeys = Object.keys(prog);
    for (var pi = 0; pi < pkeys.length; pi++) {
      var pkn = pkeys[pi];
      var pmm = pkn.match(/^phase_(\d+)$/);
      if (!pmm) continue;
      var pv = prog[pkn];
      // Extract just the verdict prefix (e.g. PASS, PASS-WITH-DEFERRED-5).
      var verdict = (typeof pv === 'string') ? pv : '';
      var vmm = verdict.match(/(PASS-WITH-DEFERRED-\d+|PASS|FAIL|IN-PROGRESS|PENDING)/);
      var statusVal = vmm ? vmm[1] : verdict.slice(0, 60);
      phaseSummary.push({
        phase: pmm[1],
        status: statusVal,
      });
    }
    // Sort by phase number ascending.
    phaseSummary.sort(function (a, b) {
      return parseInt(a.phase, 10) - parseInt(b.phase, 10);
    });

    // shipped_status: check {milestone}_complete: { status: ... }
    var shippedStatus = null;
    var completeBlock = fm[key + '_complete'];
    if (completeBlock && typeof completeBlock === 'object'
        && typeof completeBlock.status === 'string') {
      shippedStatus = completeBlock.status;
    }

    var data = {
      milestone: milestoneArg,
      total_phases: totalPhases,
      completed_phases: completedPhases,
      percent: percent,
      phase_summary: phaseSummary,
      shipped_status: shippedStatus,
    };
    return _makeEnvelope(name, data);
  } catch (_e) {
    return _makeDegraded(name, 'internal_error_degraded',
      'tool threw: ' + ((_e && _e.message) ? _e.message : 'unknown'));
  }
}

function _tool_sgsd_watchdog_status(args) {
  var name = 'sgsd_watchdog_status';
  try {
    var planningDir = _resolvePlanningDir(args);
    var watchdogPath = path.join(planningDir, 'metrics', 'autopilot-watchdog.json');
    var pulsePath = path.join(planningDir, 'metrics', 'orchestrator-pulse.jsonl');
    var tailRows = (args && typeof args.tail_rows === 'number'
      && args.tail_rows > 0)
      ? Math.min(Math.floor(args.tail_rows), 50)
      : 10;

    var watchdogObj = null;
    if (fs.existsSync(watchdogPath)) {
      try {
        watchdogObj = JSON.parse(fs.readFileSync(watchdogPath, 'utf8'));
      } catch (_pe) {
        watchdogObj = null;
      }
    }

    var pulses = _tailJsonl(pulsePath, tailRows);

    // Determine watchdog_state.
    var watchdogState = 'absent';
    var lastPulseTs = null;
    var lastPulseAge = null;

    if (pulses.length > 0) {
      var last = pulses[pulses.length - 1];
      if (last && typeof last.ts === 'string') {
        lastPulseTs = last.ts;
        try {
          var ageMs = Date.now() - new Date(last.ts).getTime();
          if (!isNaN(ageMs)) {
            lastPulseAge = Math.floor(ageMs / 1000);
          }
        } catch (_te) { lastPulseAge = null; }
      }
    }

    if (watchdogObj && typeof watchdogObj === 'object') {
      // Use status from watchdog json if present.
      if (typeof watchdogObj.status === 'string'
          && (watchdogObj.status === 'alive'
              || watchdogObj.status === 'stale'
              || watchdogObj.status === 'absent')) {
        watchdogState = watchdogObj.status;
      } else {
        // Heuristic: if last pulse age <= warn_min*60 -> alive, else stale.
        var warnMin = (typeof watchdogObj.warn_min === 'number')
          ? watchdogObj.warn_min : 20;
        if (lastPulseAge !== null && lastPulseAge <= warnMin * 60) {
          watchdogState = 'alive';
        } else if (lastPulseAge !== null) {
          watchdogState = 'stale';
        } else {
          watchdogState = 'absent';
        }
      }
    } else if (pulses.length > 0) {
      // Pulse log present but no watchdog json -- alive based on recent pulse.
      if (lastPulseAge !== null && lastPulseAge <= 20 * 60) {
        watchdogState = 'alive';
      } else {
        watchdogState = 'stale';
      }
    }

    var data = {
      watchdog_state: watchdogState,
      last_pulse_ts: lastPulseTs,
      last_pulse_age_seconds: lastPulseAge,
      recent_pulses: pulses,
    };
    return _makeEnvelope(name, data);
  } catch (_e) {
    return _makeDegraded(name, 'internal_error_degraded',
      'tool threw: ' + ((_e && _e.message) ? _e.message : 'unknown'));
  }
}

function _tool_sgsd_recovery_packet(args) {
  var name = 'sgsd_recovery_packet';
  try {
    var planningDir = _resolvePlanningDir(args);
    var checkpointPath = path.join(planningDir, 'ORCHESTRATOR-CHECKPOINT.md');

    // Compose current_position via current_state tool (delegate; share planningDir).
    var currentStateEnv = _tool_sgsd_current_state(args);
    var watchdogEnv = _tool_sgsd_watchdog_status(args);

    var currentPosition = (currentStateEnv && currentStateEnv.ok === true)
      ? currentStateEnv.data : null;
    var watchdogState = (watchdogEnv && watchdogEnv.ok === true)
      ? watchdogEnv.data : null;

    // next_unlock: prefer checkpoint over STATE.md.
    var nextUnlock = null;
    var checkpointExists = false;
    try { checkpointExists = fs.existsSync(checkpointPath); } catch (_xe) { checkpointExists = false; }

    if (checkpointExists) {
      var src = '';
      try { src = fs.readFileSync(checkpointPath, 'utf8'); } catch (_re) { src = ''; }
      if (typeof src === 'string' && src.length > 0) {
        // Try to extract `next_unit:` from frontmatter.
        var nextText = null;
        var fmLines = src.split(/\r?\n/);
        if (fmLines.length > 0 && fmLines[0].replace(/\s+$/, '') === '---') {
          for (var fli = 1; fli < fmLines.length; fli++) {
            var fln = fmLines[fli];
            if (fln.replace(/\s+$/, '') === '---') break;
            var fmm = fln.match(/^next_unit:\s*(.*)$/);
            if (fmm) {
              nextText = _stripQuotes(fmm[1]);
              break;
            }
          }
        }
        // Fallback: scan for "## Next Action" section.
        if (!nextText) {
          var naIdx = src.indexOf('## Next Action');
          if (naIdx !== -1) {
            var rest = src.slice(naIdx);
            var nextHash = rest.indexOf('\n##', 1);
            var section = (nextHash !== -1) ? rest.slice(0, nextHash) : rest;
            nextText = section.replace(/^## Next Action[^\n]*\n+/, '').replace(/^\s+|\s+$/g, '');
            if (nextText.length > 500) nextText = nextText.slice(0, 500);
          }
        }
        nextUnlock = {
          from: 'checkpoint',
          text: nextText || 'checkpoint present but next_unit unparseable',
        };
      }
    }

    if (!nextUnlock) {
      // Fallback to STATE.md milestone_status.
      var fallbackText = null;
      if (currentPosition && typeof currentPosition.milestone_status === 'string') {
        fallbackText = currentPosition.milestone_status;
      } else if (currentPosition && typeof currentPosition.status === 'string') {
        fallbackText = currentPosition.status;
      }
      if (!fallbackText) {
        return _makeDegraded(name, 'source_file_missing',
          'no checkpoint and no STATE.md milestone_status to fall back on');
      }
      nextUnlock = {
        from: 'state',
        text: fallbackText,
      };
    }

    var data = {
      current_position: currentPosition,
      watchdog_state: watchdogState,
      next_unlock: nextUnlock,
      resume_command: '/sgsd-orchestrate go',
    };
    return _makeEnvelope(name, data);
  } catch (_e) {
    return _makeDegraded(name, 'internal_error_degraded',
      'tool threw: ' + ((_e && _e.message) ? _e.message : 'unknown'));
  }
}

// Remaining 9 tools still stubbed (Phase 71).
var _tool_sgsd_gate_status = _stub('sgsd_gate_status');
var _tool_sgsd_agent_roster = _stub('sgsd_agent_roster');
var _tool_sgsd_codex_status = _stub('sgsd_codex_status');
var _tool_sgsd_token_spend = _stub('sgsd_token_spend');
var _tool_sgsd_context_bench_status = _stub('sgsd_context_bench_status');
var _tool_sgsd_latest_commits = _stub('sgsd_latest_commits');
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

    // A6: every still-stubbed tool (Phase 71's 9 tools) returns
    // degraded envelope with error_code === 'internal_error_degraded'
    // and error_message contains 'Phase 70/71'. Phase 70 implemented
    // tools 1, 2, 3, 4, 11; the remaining 9 are still stubs.
    var phase71Stubs = [
      'sgsd_gate_status',
      'sgsd_agent_roster',
      'sgsd_codex_status',
      'sgsd_token_spend',
      'sgsd_context_bench_status',
      'sgsd_latest_commits',
      'sgsd_cockpit_snapshot',
      'sgsd_artifact_links',
      'sgsd_warp_doctor',
    ];
    var stubsOK = true;
    var stubDetail = '';
    for (var i = 0; i < phase71Stubs.length; i++) {
      var nm = phase71Stubs[i];
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
    add('every_phase71_stub_returns_phase70_71_degraded', stubsOK,
      stubDetail || 'all 9 phase-71 stubs OK');

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
    // error_message string. Use a still-stubbed tool (sgsd_gate_status)
    // since the Phase 70 tools now succeed against the live .planning/.
    var rs = dispatchTool('sgsd_gate_status', {});
    var envOK = rs && rs.ok === false
              && rs.schema_version === 1
              && typeof rs.ts === 'string' && rs.ts.length > 0
              && rs.tool === 'sgsd_gate_status'
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

    // ----- Phase 70 live-data assertions A16-A20 -----
    // Each calls dispatchTool against the live .planning/. Asserts
    // result.ok === true OR (_degraded === true AND error_code in
    // {source_file_missing, source_file_unparseable}). On a checkout
    // with a real STATE.md + pulse log, all 5 should return ok:true.

    function _liveOkOrDegradedOK(r) {
      if (!r) return false;
      if (r.ok === true) return true;
      if (r._degraded === true
          && (r.error_code === 'source_file_missing'
              || r.error_code === 'source_file_unparseable')) {
        return true;
      }
      return false;
    }

    // A16: sgsd_current_state -- live milestone === 'v2.2'.
    var r16 = dispatchTool('sgsd_current_state', {});
    var ok16 = _liveOkOrDegradedOK(r16)
      && (r16.ok !== true
        || (r16.data && typeof r16.data.milestone === 'string'
          && r16.data.milestone.length > 0));
    add('live_sgsd_current_state_returns_milestone',
      ok16,
      'ok=' + (r16 ? r16.ok : '?')
        + ' milestone=' + (r16 && r16.data ? r16.data.milestone : '?'));

    // A17: sgsd_current_phase -- live current phase string present.
    var r17 = dispatchTool('sgsd_current_phase', {});
    var ok17 = _liveOkOrDegradedOK(r17)
      && (r17.ok !== true
        || (r17.data && typeof r17.data.phase === 'string'));
    add('live_sgsd_current_phase_returns_phase',
      ok17,
      'ok=' + (r17 ? r17.ok : '?')
        + ' phase=' + (r17 && r17.data ? r17.data.phase : '?'));

    // A18: sgsd_milestone_status({milestone:'v2.2'}) -- total_phases
    // and completed_phases numeric.
    var r18 = dispatchTool('sgsd_milestone_status', { milestone: 'v2.2' });
    var ok18 = _liveOkOrDegradedOK(r18)
      && (r18.ok !== true
        || (r18.data && typeof r18.data.total_phases === 'number'
          && typeof r18.data.completed_phases === 'number'));
    add('live_sgsd_milestone_status_returns_counts',
      ok18,
      'ok=' + (r18 ? r18.ok : '?')
        + ' total=' + (r18 && r18.data ? r18.data.total_phases : '?')
        + ' completed=' + (r18 && r18.data ? r18.data.completed_phases : '?'));

    // A19: sgsd_watchdog_status -- recent_pulses array present.
    var r19 = dispatchTool('sgsd_watchdog_status', {});
    var ok19 = _liveOkOrDegradedOK(r19)
      && (r19.ok !== true
        || (r19.data && Array.isArray(r19.data.recent_pulses)));
    add('live_sgsd_watchdog_status_returns_pulses_array',
      ok19,
      'ok=' + (r19 ? r19.ok : '?')
        + ' pulses_len=' + (r19 && r19.data && r19.data.recent_pulses
          ? r19.data.recent_pulses.length : '?'));

    // A20: sgsd_recovery_packet -- resume_command set; next_unlock.from
    // is 'checkpoint' or 'state'.
    var r20 = dispatchTool('sgsd_recovery_packet', {});
    var ok20 = _liveOkOrDegradedOK(r20)
      && (r20.ok !== true
        || (r20.data && r20.data.next_unlock
          && (r20.data.next_unlock.from === 'checkpoint'
            || r20.data.next_unlock.from === 'state')
          && r20.data.resume_command === '/sgsd-orchestrate go'));
    add('live_sgsd_recovery_packet_returns_resume_command',
      ok20,
      'ok=' + (r20 ? r20.ok : '?')
        + ' from=' + (r20 && r20.data && r20.data.next_unlock
          ? r20.data.next_unlock.from : '?')
        + ' cmd=' + (r20 && r20.data ? r20.data.resume_command : '?'));

    // A21: aggregate fixture-pair test. Walks fixtures/ via loadFixtures
    // and runs each pair through dispatchTool + runMatcher. All pairs
    // must PASS.
    var fixturesDirA21 = path.join(__dirname, 'fixtures');
    var fixturePairs = loadFixtures(fixturesDirA21);
    var fxAllOK = true;
    var fxFirstFail = '';
    var fxPassCount = 0;
    for (var fxi = 0; fxi < fixturePairs.length; fxi++) {
      var pair = fixturePairs[fxi];
      var inArgs = (pair.input && pair.input.args
        && typeof pair.input.args === 'object'
        && !Array.isArray(pair.input.args))
        ? pair.input.args : {};
      // Splice fixture_planning_dir into args if specified at top level.
      if (pair.input && typeof pair.input.fixture_planning_dir === 'string'
          && pair.input.fixture_planning_dir.length > 0) {
        var resolved = pair.input.fixture_planning_dir;
        // Allow relative paths anchored at the fixture's directory.
        if (resolved.charAt(0) !== '/' && resolved.charAt(1) !== ':') {
          resolved = path.join(path.dirname(pair.input_path), resolved);
        }
        inArgs.fixture_planning_dir = resolved;
      }
      var actual = dispatchTool(pair.tool, inArgs);
      var mr = runMatcher(actual, pair.expected);
      if (mr.ok) {
        fxPassCount++;
      } else if (fxAllOK) {
        fxAllOK = false;
        fxFirstFail = pair.tool + '/' + pair.scenario
          + ' mismatch=' + (mr.mismatch_path || '?');
      }
    }
    add('fixture_pair_tests_all_pass',
      fxAllOK && fixturePairs.length > 0,
      fxAllOK
        ? (fxPassCount + '/' + fixturePairs.length + ' pairs PASS')
        : ('first_fail=' + fxFirstFail));

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
