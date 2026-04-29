#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/cockpit-state/adapter.cjs
// Phase 76-01: Cockpit State Adapter (READ-ONLY snapshot composer).
//
// PURPOSE
//   Single normalized snapshot composer that BOTH cockpit panes AND the
//   MCP `sgsd_cockpit_snapshot` tool (warp-mcp Phase 71 tool 12) read
//   through. Consumes the unified live event stream from Phase 74/75
//   (.planning/ORCHESTRATOR-LIVE.jsonl) PLUS the legacy ledgers under
//   .planning/metrics/ + STATE.md frontmatter. Eliminates duplicate
//   composition logic between cockpit and MCP.
//
//   Live events take precedence over legacy ledgers when both are present
//   (recency wins per timestamp). Legacy ledgers fill gaps when the live
//   stream is missing or empty.
//
// 10-SECTION SNAPSHOT ENVELOPE (D76.1)
//   - now           Q1 -- what is the model doing right now
//   - objective     Q2 -- what are we trying to complete
//   - unlock        Q3 -- what does this unlock
//   - blockers      Q4 -- what is blocked
//   - agents        Q5+Q6 -- agents used, what each did
//   - codex         Q7 -- what is Codex doing
//   - gates         Q8+Q9 -- gates run / failed / warned
//   - tokens        Q10 -- where tokens are going
//   - artifacts     Q11 -- what to read
//   - resume_command Q12 -- what command resumes safely
//
// 3 PUBLIC APIs (Lock-13 wrapped, all return envelopes)
//   - buildSnapshot({projectDir?})
//       -> { ok, schema_version, ts, data:{<10 sections>},
//            _section_degraded:[...], _redactions_applied:[...] }
//   - selfTest()
//       -> { ok, results: [...] } (>=12 assertions, +4 fixture aggregates)
//   - _internals (helper bag for cross-task composition)
//
// CLI
//   --self-test            -- run selfTest, print PASS/FAIL, exit 0/1
//   --json [--project P]   -- run buildSnapshot live, print envelope
//   --help                 -- usage
//
// LOCK INVARIANTS
//   - Lock-13: every public API try/catch wrapped; bad input / missing
//     files / parse errors -> degraded envelope or degraded section
//     sentinel; never throws across the boundary.
//   - Lock 11: event type membership uses indexOf on the frozen
//     EVENT_TYPES list (mirrored from the writer/reader for stability).
//   - READ-ONLY: zero fs mutation calls (writeFileSync, appendFileSync,
//     unlinkSync, mkdirSync, rmSync, rmdirSync, etc.) in the public
//     API surface. selfTest A_READ_ONLY enforces by scanning
//     only the portion of source BEFORE the selfTest function (the
//     selfTest itself spawnSync's the Phase 74 writer to author
//     fixtures, but the writer code lives in another file). Banned
//     tokens are built via concatenation so the scan does not match
//     itself.
//   - ASCII-only: no smart quotes, no emoji, no non-ASCII literals.
//     selfTest A_ASCII enforces.
//
// DEPENDENCIES
//   - Pure Node built-ins (fs, path, child_process, os) only.
//   - super-gsd/scripts/lib/orchestrator-live-reader.cjs (Phase 75) --
//     used as the canonical event-stream reader so that adapter and
//     reader stay in lockstep.
//
// =============================================================================

'use strict';

var fs = require('fs');
var path = require('path');

// Phase 90-02: lazy-load the state-resolver. Loaded once at module
// resolution; if the require throws (deleted/broken), _resolveEffective
// returns null and _buildObjective falls back to the Phase 76 STATE.md +
// liveHint behaviour. Lock-13 contract preserved.
var _stateResolverMod = null;
try {
  _stateResolverMod = require(path.join(__dirname, '..', 'state-resolver', 'resolve.cjs'));
} catch (_e) { _stateResolverMod = null; }

function _resolveEffectiveForCockpit(planningDir) {
  try {
    if (!_stateResolverMod || typeof _stateResolverMod.resolveEffectiveState !== 'function') {
      return null;
    }
    var env = _stateResolverMod.resolveEffectiveState({ planningDir: planningDir });
    if (env && env.ok === true) return env;
    return null;
  } catch (_e) { return null; }
}

// Mirror the closed vocab from Phase 74/75. Local mirror keeps the adapter
// self-contained for ASCII / READ-ONLY scans (require()'d code is allowed
// to mutate the disk, but inside this file we declare what we expect).
var SCHEMA_VERSION = 1;

var EVENT_TYPES = Object.freeze([
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

var SECTION_KEYS = Object.freeze([
  'now',
  'objective',
  'unlock',
  'blockers',
  'agents',
  'codex',
  'gates',
  'tokens',
  'artifacts',
  // Phase 86: staleness section (operator-override re-scope). Inserted
  // between artifacts and resume_command so resume_command stays last.
  'staleness',
  'resume_command'
]);

var STREAM_FILENAME = 'ORCHESTRATOR-LIVE.jsonl';

var DEFAULT_RESUME_COMMAND = '/sgsd-orchestrate go';

// ---------------------------------------------------------------------------
// PROJECT / PLANNING DIR RESOLUTION
//   Two opts shapes are accepted:
//     - {projectDir: "..."} -- adapter computes planningDir = projectDir/.planning
//     - {planningDir: "..."} -- caller has already resolved the planning
//       directory (typical MCP fixture path pointing at a synthetic
//       _synthetic_planning_* tree). adapter then derives projectDir as the
//       parent so artifact-link relative paths still resolve.
// ---------------------------------------------------------------------------
function _resolveProjectDir(opts) {
  try {
    if (opts && typeof opts.planningDir === 'string'
        && opts.planningDir.length > 0) {
      return path.dirname(path.resolve(opts.planningDir));
    }
    if (opts && typeof opts.projectDir === 'string'
        && opts.projectDir.length > 0) {
      return path.resolve(opts.projectDir);
    }
    return process.cwd();
  } catch (_e) {
    return process.cwd();
  }
}

function _resolvePlanningDir(opts, projectDir) {
  try {
    if (opts && typeof opts.planningDir === 'string'
        && opts.planningDir.length > 0) {
      return path.resolve(opts.planningDir);
    }
    return path.join(projectDir, '.planning');
  } catch (_e) {
    return '.planning';
  }
}

// ---------------------------------------------------------------------------
// FRONTMATTER PARSER -- mirrors warp-mcp _parseStateFrontmatter behaviour.
// Returns null on any failure.
// ---------------------------------------------------------------------------
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

function _parseFrontmatterFile(filePath) {
  try {
    if (typeof filePath !== 'string' || filePath.length === 0) return null;
    if (!fs.existsSync(filePath)) return null;
    var src = '';
    try { src = fs.readFileSync(filePath, 'utf8'); } catch (_re) { return null; }
    if (typeof src !== 'string' || src.length === 0) return null;
    var lines = src.split(/\r?\n/);
    if (lines.length < 2) return null;
    if (lines[0].replace(/\s+$/, '') !== '---') return null;
    var endIdx = -1;
    for (var i = 1; i < lines.length; i++) {
      if (lines[i].replace(/\s+$/, '') === '---') { endIdx = i; break; }
    }
    if (endIdx === -1) return null;

    var out = {};
    var stack = [{ obj: out, indent: -1 }];

    for (var li = 1; li < endIdx; li++) {
      var raw = lines[li];
      if (typeof raw !== 'string') continue;
      var trimmed = raw.replace(/^\s+|\s+$/g, '');
      if (trimmed.length === 0) continue;
      if (trimmed.charAt(0) === '#') continue;

      var indent = _countLeadingSpaces(raw);

      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      var parent = stack[stack.length - 1].obj;

      var colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      var key = trimmed.slice(0, colonIdx).replace(/^\s+|\s+$/g, '');
      var val = trimmed.slice(colonIdx + 1).replace(/^\s+|\s+$/g, '');
      if (key.charAt(0) === '-') continue;
      if (key.length === 0) continue;

      if (val.length === 0) {
        var child = {};
        parent[key] = child;
        stack.push({ obj: child, indent: indent });
      } else {
        parent[key] = _stripQuotes(val);
      }
    }
    return out;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// JSONL TAILER -- read + parse a JSONL file. Returns rows in chronological
// order. Bad / missing -> []. Lock-13.
// ---------------------------------------------------------------------------
function _readJsonl(filePath) {
  var rows = [];
  try {
    if (typeof filePath !== 'string' || filePath.length === 0) return rows;
    if (!fs.existsSync(filePath)) return rows;
    var src = '';
    try { src = fs.readFileSync(filePath, 'utf8'); } catch (_re) { return rows; }
    if (typeof src !== 'string' || src.length === 0) return rows;
    var lines = src.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i];
      if (typeof t !== 'string') continue;
      if (t.length === 0) continue;
      try {
        rows.push(JSON.parse(t));
      } catch (_pe) {
        // Skip parse errors silently.
      }
    }
    return rows;
  } catch (_e) {
    return rows;
  }
}

// ---------------------------------------------------------------------------
// LIVE-EVENT READER -- thin wrapper. Tries to require the Phase 75 reader
// for stable shape; falls back to local _readJsonl if the require fails.
// ---------------------------------------------------------------------------
function _readLiveEvents(planningDir) {
  try {
    var streamPath = path.join(planningDir, STREAM_FILENAME);
    var rows = _readJsonl(streamPath);
    // Filter to known event types only -- quietly drop unknowns.
    var filtered = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || typeof r !== 'object') continue;
      if (typeof r.type !== 'string') continue;
      if (EVENT_TYPES.indexOf(r.type) === -1) continue;
      filtered.push(r);
    }
    return filtered;
  } catch (_e) {
    return [];
  }
}

function _filterByType(events, type) {
  if (!Array.isArray(events)) return [];
  if (typeof type !== 'string') return [];
  var out = [];
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    if (e && e.type === type) out.push(e);
  }
  return out;
}

function _lastByType(events, type) {
  var f = _filterByType(events, type);
  return f.length === 0 ? null : f[f.length - 1];
}

// ---------------------------------------------------------------------------
// SECTION BUILDERS -- one per snapshot key. Each returns either the section
// object or { _degraded: true, error_code, error }.
// ---------------------------------------------------------------------------

// Section: now (Q1)
function _buildNow(ctx) {
  try {
    var events = ctx.events || [];
    // Prefer the latest agent_progress event with a current_action string.
    var progressEvents = _filterByType(events, 'agent_progress');
    if (progressEvents.length > 0) {
      var latest = progressEvents[progressEvents.length - 1];
      var action = (latest.data && typeof latest.data.current_action === 'string')
        ? latest.data.current_action : null;
      var taskId = (latest.data && typeof latest.data.task_id === 'string')
        ? latest.data.task_id : null;
      var files = (latest.data && Array.isArray(latest.data.files_touched))
        ? latest.data.files_touched.slice(0, 8) : [];
      return {
        action: action || 'agent_progress (no current_action)',
        ts: (typeof latest.ts === 'string') ? latest.ts : null,
        task_id: taskId,
        files_touched: files,
        source: 'live_events.agent_progress'
      };
    }
    // Fallback: latest agent_dispatched.
    var dispatchEvents = _filterByType(events, 'agent_dispatched');
    if (dispatchEvents.length > 0) {
      var d = dispatchEvents[dispatchEvents.length - 1];
      var purpose = (d.data && typeof d.data.purpose === 'string')
        ? d.data.purpose : null;
      var agent = (d.data && typeof d.data.agent === 'string')
        ? d.data.agent : null;
      return {
        action: purpose || 'agent dispatched',
        ts: (typeof d.ts === 'string') ? d.ts : null,
        agent: agent,
        files_touched: [],
        source: 'live_events.agent_dispatched'
      };
    }
    // Fallback: latest run_completed -> "milestone-closed" if last.
    var runCompleted = _lastByType(events, 'run_completed');
    if (runCompleted) {
      var outcome = (runCompleted.data && typeof runCompleted.data.outcome === 'string')
        ? runCompleted.data.outcome : 'unknown';
      return {
        action: 'milestone-closed (' + outcome + ')',
        ts: (typeof runCompleted.ts === 'string') ? runCompleted.ts : null,
        files_touched: [],
        source: 'live_events.run_completed'
      };
    }
    // Fallback: legacy activity-log tail.
    var activity = ctx.activityRows || [];
    if (activity.length > 0) {
      var tail = activity[activity.length - 1];
      var tool = (tail && typeof tail.tool === 'string') ? tail.tool : null;
      var target = (tail && typeof tail.target === 'string') ? tail.target : null;
      return {
        action: tool ? (tool + (target ? ': ' + target : '')) : 'idle',
        ts: (tail && typeof tail.ts === 'string') ? tail.ts : null,
        files_touched: [],
        source: 'legacy_ledger.activity-log'
      };
    }
    // Fallback: STATE.md status.
    var fm = ctx.stateFm || {};
    var statusText = (typeof fm.status === 'string') ? fm.status : 'idle';
    return {
      action: statusText,
      ts: (typeof fm.last_activity === 'string') ? fm.last_activity : null,
      files_touched: [],
      source: 'STATE.md.status'
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'now: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

function _titleFromSlug(slug) {
  try {
    if (typeof slug !== 'string' || slug.length === 0) return null;
    return slug
      .replace(/-/g, ' ')
      .replace(/\b[a-z]/g, function (m) { return m.toUpperCase(); });
  } catch (_e) {
    return slug || null;
  }
}

function _resolvePhaseNumberFromDirs(ctx, phase) {
  try {
    if (!phase) return null;
    var root = path.join(ctx.planningDir, 'milestones');
    if (!fs.existsSync(root)) return null;
    var milestones = [];
    try { milestones = fs.readdirSync(root); } catch (_re) { milestones = []; }
    var best = null;
    for (var i = 0; i < milestones.length; i++) {
      var milestone = milestones[i];
      var phasesDir = path.join(root, milestone, 'phases');
      if (!fs.existsSync(phasesDir)) continue;
      var dirs = [];
      try { dirs = fs.readdirSync(phasesDir); } catch (_de) { dirs = []; }
      for (var j = 0; j < dirs.length; j++) {
        var dn = dirs[j];
        if (dn.indexOf(String(phase) + '-') !== 0 && dn !== String(phase)) continue;
        var full = path.join(phasesDir, dn);
        var st = null;
        try { st = fs.statSync(full); } catch (_se) { st = null; }
        var mtime = st ? st.mtimeMs : 0;
        if (!best || mtime > best.mtimeMs) {
          best = {
            milestone: milestone,
            phase: String(phase),
            phase_name: _titleFromSlug(dn.replace(/^[0-9]+-?/, '')) || ('Phase ' + phase),
            mtimeMs: mtime
          };
        }
      }
    }
    return best;
  } catch (_e) {
    return null;
  }
}

function _deriveLivePhaseHint(ctx) {
  try {
    var rows = Array.isArray(ctx.activityRows) ? ctx.activityRows : [];
    var nowMs = Date.now();
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i] || {};
      var tsMs = null;
      if (typeof r.ts === 'string') {
        var parsed = Date.parse(r.ts);
        if (!isNaN(parsed)) tsMs = parsed;
      }
      if (tsMs !== null && (nowMs - tsMs) > 3600 * 1000) continue;
      var texts = [];
      if (typeof r.target === 'string') texts.push(r.target);
      if (typeof r.command_preview === 'string') texts.push(r.command_preview);
      for (var t = 0; t < texts.length; t++) {
        var text = texts[t];
        var pathMatch = text.match(/(?:^|[\\/])\.planning[\\/]milestones[\\/](v[0-9]+(?:\.[0-9]+)?)[\\/]phases[\\/]([0-9]+)-([^\\/"\s]+)/i);
        if (pathMatch) {
          return {
            milestone: pathMatch[1],
            phase: pathMatch[2],
            phase_name: _titleFromSlug(pathMatch[3]),
            source: 'legacy_ledger.activity-log.path'
          };
        }
        var phaseMatch = text.match(/\b(?:Phase\s*|P)([0-9]{1,3})\b/i);
        if (phaseMatch) {
          var resolved = _resolvePhaseNumberFromDirs(ctx, phaseMatch[1]);
          if (resolved) {
            return {
              milestone: resolved.milestone,
              phase: resolved.phase,
              phase_name: resolved.phase_name,
              source: 'legacy_ledger.activity-log.phase_mention'
            };
          }
        }
      }
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// Section: objective (Q2)
//
// Phase 90-02: state-resolver wires the canonical effective state in.
// Resolver consults checkpoint > pulse > activity-log > phase folders >
// git > STATE.md (in that priority order) and returns the authoritative
// milestone/phase. STATE.md is treated as a legacy projection ONLY when
// nothing fresher exists. Falls back to Phase 76 behaviour (STATE.md +
// _deriveLivePhaseHint) if the resolver module is unavailable.
function _buildObjective(ctx) {
  try {
    var fm = ctx.stateFm || {};
    var rr = (fm.roadmap_run && typeof fm.roadmap_run === 'object')
      ? fm.roadmap_run : {};

    var legacyMilestone = (typeof rr.current_milestone === 'string')
      ? rr.current_milestone
      : ((typeof fm.milestone === 'string') ? fm.milestone : null);
    var legacyPhase = (typeof rr.current_phase === 'string')
      ? rr.current_phase : null;
    var legacyPhaseName = (typeof rr.current_phase_name === 'string')
      ? rr.current_phase_name : null;
    var legacyPhaseStatus = (typeof rr.current_phase_status === 'string')
      ? rr.current_phase_status : null;
    var milestoneName = (typeof fm.milestone_name === 'string')
      ? fm.milestone_name : null;
    var milestoneStatus = (typeof fm.milestone_status === 'string')
      ? fm.milestone_status : null;

    // -- Phase 90-02: resolver-first -----------------------------------
    var eff = _resolveEffectiveForCockpit(ctx.planningDir);
    var milestone = legacyMilestone;
    var phase = legacyPhase;
    var phaseName = legacyPhaseName;
    var phaseStatus = legacyPhaseStatus;
    var source = fm._missing ? 'absent' : 'STATE.md';
    var projectionStale = false;

    if (eff && eff.phase) {
      milestone = eff.milestone || legacyMilestone;
      phase = eff.phase;
      phaseStatus = eff.phase_status || legacyPhaseStatus;
      source = eff.source;
      projectionStale = (eff.projection_stale === true);
      // Phase 90-02: when STATE.md agrees with resolver on milestone+phase,
      // prefer STATE.md's curated phase_name (it's the operator-edited
      // name, often more readable than the title-cased folder slug). Only
      // adopt resolver's phase_name when STATE.md is stale or its name is
      // missing.
      if (!projectionStale
          && legacyPhase === eff.phase
          && legacyMilestone === eff.milestone
          && typeof legacyPhaseName === 'string'
          && legacyPhaseName.length > 0) {
        phaseName = legacyPhaseName;
      } else {
        phaseName = eff.phase_name || legacyPhaseName;
      }
    }

    // Derive status: "complete" when phase === complete, else
    // "in-progress" else "unknown".
    var status = 'unknown';
    if (typeof phase === 'string' && phase.toLowerCase() === 'complete') {
      status = 'complete';
    } else if (typeof phase === 'string' && phase.length > 0) {
      status = 'in-progress';
    }

    // Legacy fallback: if resolver did not run / returned no usable data
    // AND STATE.md still says "complete", apply Phase 76 _deriveLivePhaseHint
    // as a last-line guard against a stale roadmap_run.complete.
    if (!eff) {
      var liveHint = _deriveLivePhaseHint(ctx);
      if (liveHint && (!phase || phase.toLowerCase() === 'complete'
          || (milestone && liveHint.milestone !== milestone)
          || (milestoneStatus && /complete|closed|halted|awaiting operator/i.test(milestoneStatus)))) {
        milestone = liveHint.milestone;
        phase = liveHint.phase;
        phaseName = liveHint.phase_name || phaseName;
        phaseStatus = 'in-progress';
        status = 'in-progress';
        source = liveHint.source + ' overrides stale STATE.md';
      }
    }

    return {
      milestone: milestone,
      milestone_name: milestoneName,
      milestone_status: milestoneStatus,
      phase: phase,
      phase_name: phaseName,
      phase_status: phaseStatus,
      status: status,
      source: source,
      // Phase 90-02 -- expose the discrepancy so cockpit panes can render
      // a "drift" badge alongside the canonical pair.
      state_md_milestone: legacyMilestone,
      state_md_phase: legacyPhase,
      projection_stale: projectionStale,
      effective_confidence: (eff && typeof eff.confidence === 'number')
        ? eff.confidence : null
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'objective: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: unlock (Q3) -- read active phase folder's *-CONTEXT.md /
// *-VERIFICATION.md frontmatter and look for `unlocks:` field.
function _buildUnlock(ctx) {
  try {
    var fm = ctx.stateFm || {};
    var rr = (fm.roadmap_run && typeof fm.roadmap_run === 'object')
      ? fm.roadmap_run : {};
    var milestone = (typeof rr.current_milestone === 'string')
      ? rr.current_milestone
      : ((typeof fm.milestone === 'string') ? fm.milestone : null);
    var phase = (typeof rr.current_phase === 'string')
      ? rr.current_phase : null;

    if (!milestone || !phase || phase.toLowerCase() === 'complete') {
      return { unlocks: null, source: 'no_active_phase' };
    }

    var phasesDir = path.join(ctx.planningDir, 'milestones', milestone, 'phases');
    if (!fs.existsSync(phasesDir)) {
      return { unlocks: null, source: 'phases_dir_missing' };
    }
    var entries = [];
    try { entries = fs.readdirSync(phasesDir); } catch (_re) { entries = []; }
    var pad2 = (phase.length === 1) ? ('0' + phase) : phase;
    var matchFolder = null;
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i];
      if (typeof en !== 'string') continue;
      if (en.indexOf(pad2 + '-') === 0 || en.indexOf(phase + '-') === 0) {
        matchFolder = en; break;
      }
    }
    if (!matchFolder) {
      return { unlocks: null, source: 'phase_folder_not_found' };
    }
    var phaseDir = path.join(phasesDir, matchFolder);
    // Look for *-CONTEXT.md or *-VERIFICATION.md.
    var files = [];
    try { files = fs.readdirSync(phaseDir); } catch (_fe) { files = []; }
    var contextPath = null;
    var verifPath = null;
    for (var j = 0; j < files.length; j++) {
      var fn = files[j];
      if (typeof fn !== 'string') continue;
      if (/-CONTEXT\.md$/i.test(fn)) contextPath = path.join(phaseDir, fn);
      else if (/-VERIFICATION\.md$/i.test(fn)) verifPath = path.join(phaseDir, fn);
    }

    var unlocks = null;
    var sourceFile = null;
    var probe = [verifPath, contextPath];
    for (var k = 0; k < probe.length; k++) {
      if (!probe[k]) continue;
      var pf = _parseFrontmatterFile(probe[k]);
      if (pf && typeof pf.unlocks !== 'undefined') {
        unlocks = (typeof pf.unlocks === 'string') ? pf.unlocks : null;
        sourceFile = probe[k];
        break;
      }
      if (pf && typeof pf.phase_unlocks !== 'undefined') {
        unlocks = (typeof pf.phase_unlocks === 'string') ? pf.phase_unlocks : null;
        sourceFile = probe[k];
        break;
      }
    }

    return {
      unlocks: unlocks,
      milestone: milestone,
      phase: phase,
      source: sourceFile
        ? path.relative(ctx.projectDir, sourceFile).replace(/\\/g, '/')
        : 'no_unlocks_field'
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'unlock: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: blockers (Q4)
function _buildBlockers(ctx) {
  try {
    var events = ctx.events || [];
    var attentionEvents = _filterByType(events, 'operator_attention_required');
    var blockers = [];
    for (var i = 0; i < attentionEvents.length; i++) {
      var ev = attentionEvents[i];
      var d = (ev && ev.data) ? ev.data : {};
      blockers.push({
        reason: (typeof d.reason === 'string') ? d.reason : 'unknown',
        context: (typeof d.context === 'string') ? d.context : '',
        ts: (typeof ev.ts === 'string') ? ev.ts : null,
        phase: (typeof ev.phase === 'string') ? ev.phase : null,
        source: 'live_events.operator_attention_required'
      });
    }

    // Add STATE.md milestone_status if it sounds like a blocker (heuristic
    // safe: 'blocked', 'awaiting', 'paused', 'halt', 'stopped').
    var fm = ctx.stateFm || {};
    var msStatus = (typeof fm.milestone_status === 'string')
      ? fm.milestone_status : '';
    var lowered = msStatus.toLowerCase();
    var blockerKeywords = ['blocked', 'awaiting', 'paused', 'halt', 'stopped', 'awaiting operator'];
    var stateBlocker = false;
    for (var bk = 0; bk < blockerKeywords.length; bk++) {
      if (lowered.indexOf(blockerKeywords[bk]) !== -1) { stateBlocker = true; break; }
    }
    if (stateBlocker && msStatus.length > 0) {
      blockers.push({
        reason: 'state_md_status_indicates_blocked',
        context: msStatus.slice(0, 500),
        ts: (typeof fm.last_updated === 'string') ? fm.last_updated : null,
        source: 'STATE.md.milestone_status'
      });
    }

    return {
      blockers: blockers,
      count: blockers.length
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'blockers: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: agents (Q5+Q6)
function _buildAgents(ctx) {
  try {
    var events = ctx.events || [];
    var dispatched = _filterByType(events, 'agent_dispatched');
    var completed = _filterByType(events, 'agent_completed');

    // Group by phase. Each entry: {phase, agent, model, purpose, outcome, summary, ts}.
    var byPhase = {};
    var roster = [];

    function addRow(phase, row) {
      if (!byPhase[phase]) byPhase[phase] = [];
      byPhase[phase].push(row);
    }

    // Index completed by task_id for join.
    var completedByTask = {};
    for (var ci = 0; ci < completed.length; ci++) {
      var c = completed[ci];
      var tid = (c && c.data && typeof c.data.task_id === 'string')
        ? c.data.task_id : null;
      if (tid) completedByTask[tid] = c;
    }

    for (var i = 0; i < dispatched.length; i++) {
      var d = dispatched[i];
      var dd = (d.data && typeof d.data === 'object') ? d.data : {};
      var phase = (typeof d.phase === 'string') ? d.phase : 'unknown';
      var taskId = (typeof dd.task_id === 'string') ? dd.task_id : null;
      var matched = (taskId && completedByTask[taskId]) ? completedByTask[taskId] : null;
      var md = (matched && matched.data && typeof matched.data === 'object')
        ? matched.data : null;
      var row = {
        phase: phase,
        agent: (typeof dd.agent === 'string') ? dd.agent : null,
        model: (typeof dd.model === 'string') ? dd.model : null,
        task_id: taskId,
        purpose: (typeof dd.purpose === 'string') ? dd.purpose : null,
        outcome: (md && typeof md.outcome === 'string') ? md.outcome : null,
        summary: (md && typeof md.summary === 'string') ? md.summary : null,
        dispatched_ts: (typeof d.ts === 'string') ? d.ts : null,
        completed_ts: (matched && typeof matched.ts === 'string') ? matched.ts : null,
        source: 'live_events'
      };
      addRow(phase, row);
      roster.push(row);
    }

    // If live event dispatched stream is empty, fall back to legacy
    // activity-log roster for the current phase.
    if (roster.length === 0 && Array.isArray(ctx.activityRows)
        && ctx.activityRows.length > 0) {
      var fm = ctx.stateFm || {};
      var rr = (fm.roadmap_run && typeof fm.roadmap_run === 'object')
        ? fm.roadmap_run : {};
      var fp = (typeof rr.current_phase === 'string') ? rr.current_phase : null;
      // Tail last 25 activity rows (tolerant).
      var legacyTail = ctx.activityRows.slice(-25);
      for (var li = 0; li < legacyTail.length; li++) {
        var lr = legacyTail[li];
        if (!lr || typeof lr !== 'object') continue;
        var lphase = (lr.phase === null || typeof lr.phase === 'undefined')
          ? 'unknown' : String(lr.phase);
        if (fp && lphase !== fp) continue;
        var lrow = {
          phase: lphase,
          agent: (typeof lr.agent === 'string') ? lr.agent
            : ((typeof lr.tool === 'string') ? lr.tool : null),
          model: (typeof lr.model === 'string') ? lr.model : null,
          task_id: (typeof lr.task_id === 'string') ? lr.task_id : null,
          purpose: null,
          outcome: (typeof lr.outcome === 'string') ? lr.outcome
            : ((typeof lr.status === 'string') ? lr.status : null),
          summary: null,
          dispatched_ts: (typeof lr.ts === 'string') ? lr.ts : null,
          completed_ts: null,
          source: 'legacy_ledger.activity-log'
        };
        addRow(lphase, lrow);
        roster.push(lrow);
      }
    }

    return {
      by_phase: byPhase,
      roster: roster,
      count: roster.length
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'agents: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: codex (Q7)
function _buildCodex(ctx) {
  try {
    var planningDir = ctx.planningDir;
    var livePath = path.join(planningDir, 'metrics', 'codex-live.json');
    var logPath = path.join(planningDir, 'metrics', 'codex-log.jsonl');
    var STALE_THRESHOLD_SEC = 3600;

    var liveExists = false;
    try { liveExists = fs.existsSync(livePath); } catch (_xe) { liveExists = false; }
    var logExists = false;
    try { logExists = fs.existsSync(logPath); } catch (_xe2) { logExists = false; }

    var liveJsonAge = null;
    var liveJsonObj = null;
    if (liveExists) {
      try {
        var st = fs.statSync(livePath);
        if (st && st.mtime) {
          liveJsonAge = Math.floor((Date.now() - st.mtime.getTime()) / 1000);
        }
      } catch (_se) { liveJsonAge = null; }
      try {
        var src = fs.readFileSync(livePath, 'utf8');
        liveJsonObj = JSON.parse(src);
      } catch (_pe) { liveJsonObj = null; }
    }

    var liveState;
    if (!liveExists && !logExists) {
      liveState = 'absent';
    } else if (!liveExists) {
      liveState = 'absent';
    } else if (liveJsonAge !== null && liveJsonAge > STALE_THRESHOLD_SEC) {
      liveState = 'stale';
    } else if (liveJsonObj && typeof liveJsonObj === 'object'
        && typeof liveJsonObj.state === 'string') {
      var s = liveJsonObj.state;
      if (s === 'running' || s === 'idle' || s === 'complete' || s === 'stale') {
        liveState = s;
      } else {
        liveState = 'idle';
      }
    } else {
      liveState = 'idle';
    }

    // Codex events from live stream (codex_started / codex_completed).
    var events = ctx.events || [];
    var codexStarted = _filterByType(events, 'codex_started');
    var codexCompleted = _filterByType(events, 'codex_completed');

    var recentRuns = [];
    if (logExists) {
      var logRows = _readJsonl(logPath);
      recentRuns = logRows.slice(-5);
    }

    return {
      live_state: liveState,
      live_json: liveJsonObj,
      live_json_age_seconds: liveJsonAge,
      stale_threshold_seconds: STALE_THRESHOLD_SEC,
      events_started: codexStarted.length,
      events_completed: codexCompleted.length,
      recent_runs: recentRuns,
      source: liveExists ? 'codex-live.json' : (logExists ? 'codex-log.jsonl' : 'absent')
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'codex: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: gates (Q8+Q9)
function _buildGates(ctx) {
  try {
    var planningDir = ctx.planningDir;
    var events = ctx.events || [];

    // Live event gates -- gate_started / gate_passed / gate_warned / gate_failed.
    var gateEvents = [];
    var gateTypes = ['gate_started', 'gate_passed', 'gate_warned', 'gate_failed'];
    for (var gi = 0; gi < gateTypes.length; gi++) {
      var sub = _filterByType(events, gateTypes[gi]);
      for (var si = 0; si < sub.length; si++) {
        var ev = sub[si];
        var d = (ev.data && typeof ev.data === 'object') ? ev.data : {};
        gateEvents.push({
          gate: (typeof d.gate === 'string') ? d.gate : 'unknown',
          phase: (typeof d.phase === 'string') ? d.phase
            : ((typeof ev.phase === 'string') ? ev.phase : null),
          verdict: (typeof d.verdict === 'string') ? d.verdict
            : (gateTypes[gi] === 'gate_passed' ? 'pass'
                : gateTypes[gi] === 'gate_warned' ? 'warn'
                : gateTypes[gi] === 'gate_failed' ? 'fail' : 'started'),
          ts: (typeof ev.ts === 'string') ? ev.ts : null,
          evidence_path: (typeof d.evidence_path === 'string') ? d.evidence_path : null,
          source: 'live_events.' + gateTypes[gi]
        });
      }
    }

    // Legacy gate-value-log tail (recency wins is satisfied by sort-by-ts
    // below, so legacy rows are merged in and sorted overall).
    var gateLogPath = path.join(planningDir, 'metrics', 'gate-value-log.jsonl');
    var legacyRows = _readJsonl(gateLogPath);
    var legacy = [];
    for (var li = 0; li < legacyRows.length; li++) {
      var r = legacyRows[li];
      if (!r || typeof r !== 'object') continue;
      legacy.push({
        gate: (typeof r.gate === 'string') ? r.gate
          : (r._legacy && typeof r._legacy.tier === 'string') ? r._legacy.tier
          : 'unknown',
        phase: (r.phase !== undefined) ? r.phase : null,
        verdict: (typeof r.verdict === 'string') ? r.verdict
          : (r._legacy && typeof r._legacy.verdict === 'string') ? r._legacy.verdict
          : ((typeof r.outcome === 'string') ? r.outcome : 'unknown'),
        ts: (typeof r.ts === 'string') ? r.ts : null,
        evidence_path: null,
        source: 'gate-value-log.jsonl'
      });
    }

    // Merge: live events take precedence on (gate, phase) when both exist
    // by simply keeping all and letting latest_per_gate compute per gate
    // by max ts.
    var combined = gateEvents.concat(legacy);
    combined.sort(function (a, b) {
      var at = (typeof a.ts === 'string') ? a.ts : '';
      var bt = (typeof b.ts === 'string') ? b.ts : '';
      if (at < bt) return -1;
      if (at > bt) return 1;
      return 0;
    });

    var latestPerGate = {};
    for (var ki = 0; ki < combined.length; ki++) {
      var row = combined[ki];
      var gn = row.gate || 'unknown';
      var prev = latestPerGate[gn];
      if (!prev) { latestPerGate[gn] = row; continue; }
      var pt = (typeof prev.ts === 'string') ? prev.ts : '';
      var ct = (typeof row.ts === 'string') ? row.ts : '';
      if (ct >= pt) latestPerGate[gn] = row;
    }

    // Tail to last 10 to keep envelope under size budget.
    var tail = combined.slice(Math.max(0, combined.length - 10));

    return {
      gates: tail,
      latest_per_gate: latestPerGate,
      live_event_count: gateEvents.length,
      legacy_row_count: legacy.length
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'gates: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: tokens (Q10)
function _buildTokens(ctx) {
  try {
    var planningDir = ctx.planningDir;
    var attrPath = path.join(planningDir, 'metrics', 'token-attribution.jsonl');
    var spendPath = path.join(planningDir, 'metrics', 'agent-token-spend.jsonl');
    var attrExists = false;
    try { attrExists = fs.existsSync(attrPath); } catch (_xe) { attrExists = false; }
    var spendExists = false;
    try { spendExists = fs.existsSync(spendPath); } catch (_xe2) { spendExists = false; }

    var rows = [];
    if (attrExists) rows = _readJsonl(attrPath);
    else if (spendExists) rows = _readJsonl(spendPath);

    var tailSlice = rows.slice(-200);
    var byRole = {};
    var totalInput = 0, totalOutput = 0, totalTotal = 0;
    for (var i = 0; i < tailSlice.length; i++) {
      var r = tailSlice[i];
      if (!r || typeof r !== 'object') continue;
      var usage = (r.usage && typeof r.usage === 'object') ? r.usage
        : ((r.token_breakdown && typeof r.token_breakdown === 'object')
          ? r.token_breakdown : null);
      if (!usage) continue;
      var inp = (typeof usage.input_tokens === 'number') ? usage.input_tokens : 0;
      var out = (typeof usage.output_tokens === 'number') ? usage.output_tokens : 0;
      var tot = (typeof usage.total_tokens === 'number') ? usage.total_tokens
        : (inp + out);
      var role = (typeof r.role === 'string' && r.role.length > 0) ? r.role : 'unknown';
      if (!byRole[role]) byRole[role] = { input: 0, output: 0, total: 0, count: 0 };
      byRole[role].input += inp;
      byRole[role].output += out;
      byRole[role].total += tot;
      byRole[role].count += 1;
      totalInput += inp;
      totalOutput += out;
      totalTotal += tot;
    }

    // Live event threshold crossings.
    var events = ctx.events || [];
    var thresholds = _filterByType(events, 'token_threshold_crossed');
    var thresholdRows = [];
    for (var ti = 0; ti < thresholds.length; ti++) {
      var ev = thresholds[ti];
      var d = (ev.data && typeof ev.data === 'object') ? ev.data : {};
      thresholdRows.push({
        role: (typeof d.role === 'string') ? d.role : 'unknown',
        threshold_kind: (typeof d.threshold_kind === 'string') ? d.threshold_kind : 'unknown',
        actual_value: (typeof d.actual_value === 'number') ? d.actual_value : null,
        threshold_value: (typeof d.threshold_value === 'number') ? d.threshold_value : null,
        ts: (typeof ev.ts === 'string') ? ev.ts : null
      });
    }

    return {
      tail_count: tailSlice.length,
      by_role: byRole,
      total_input_tokens: totalInput,
      total_output_tokens: totalOutput,
      total_tokens: totalTotal,
      threshold_crossings: thresholdRows,
      source: attrExists ? 'token-attribution.jsonl'
        : (spendExists ? 'agent-token-spend.jsonl' : 'absent')
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'tokens: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: artifacts (Q11)
function _buildArtifacts(ctx) {
  try {
    var fm = ctx.stateFm || {};
    var rr = (fm.roadmap_run && typeof fm.roadmap_run === 'object')
      ? fm.roadmap_run : {};
    var milestone = (typeof rr.current_milestone === 'string')
      ? rr.current_milestone
      : ((typeof fm.milestone === 'string') ? fm.milestone : null);

    if (!milestone) {
      return { milestone: null, phases: [], source: 'no_milestone' };
    }

    var phasesDir = path.join(ctx.planningDir, 'milestones', milestone, 'phases');
    if (!fs.existsSync(phasesDir)) {
      return { milestone: milestone, phases: [], source: 'phases_dir_missing' };
    }

    var entries = [];
    try { entries = fs.readdirSync(phasesDir); } catch (_re) { entries = []; }
    entries.sort();

    var phases = [];
    for (var i = 0; i < entries.length; i++) {
      var folderName = entries[i];
      if (typeof folderName !== 'string') continue;
      if (folderName.charAt(0) === '.') continue;
      var phaseMatch = folderName.match(/^(\d+)-/);
      if (!phaseMatch) continue;
      var canonicalPhase = String(parseInt(phaseMatch[1], 10));

      var folderFull = path.join(phasesDir, folderName);
      var folderRel = path.join('.planning', 'milestones', milestone,
        'phases', folderName);
      var entry = {
        phase: canonicalPhase,
        atc_review: null,
        verification: null,
        waste: null,
        context: null
      };
      var files = [];
      try { files = fs.readdirSync(folderFull); } catch (_fe) { files = []; }
      for (var fi = 0; fi < files.length; fi++) {
        var fn = files[fi];
        if (typeof fn !== 'string') continue;
        var rel = path.join(folderRel, fn).replace(/\\/g, '/');
        if (/-ATC-REVIEW\.md$/i.test(fn)) entry.atc_review = rel;
        else if (/-VERIFICATION\.md$/i.test(fn)) entry.verification = rel;
        else if (/-WASTE\.md$/i.test(fn)) entry.waste = rel;
        else if (/-CONTEXT\.md$/i.test(fn)) entry.context = rel;
      }
      phases.push(entry);
    }

    return { milestone: milestone, phases: phases, source: 'phases_dir_walk' };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'artifacts: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: staleness (Phase 86 operator-override re-scope).
// Reports STATE.md drift vs latest orchestrator-pulse mtime AND the
// liveness of the Phase 45 context-packet builder. Lock-13 wrapped:
// any read failure returns a degraded section sentinel rather than
// throwing across the buildSnapshot boundary.
function _buildStaleness(ctx) {
  try {
    var planningDir = ctx.planningDir;
    if (typeof planningDir !== 'string' || planningDir.length === 0) {
      return { _degraded: true, error_code: 'internal_error_degraded',
        error: 'staleness: planning dir missing' };
    }
    // -- state_md drift ------------------------------------------------
    var stateMdPath = path.join(planningDir, 'STATE.md');
    var pulsePath = path.join(planningDir, 'metrics', 'orchestrator-pulse.jsonl');
    var stateMtime = null;
    var pulseMtime = null;
    try {
      if (fs.existsSync(stateMdPath)) {
        var sStat = fs.statSync(stateMdPath);
        if (sStat && sStat.mtime) stateMtime = sStat.mtime.getTime();
      }
    } catch (_se) { stateMtime = null; }
    try {
      if (fs.existsSync(pulsePath)) {
        var pStat = fs.statSync(pulsePath);
        if (pStat && pStat.mtime) pulseMtime = pStat.mtime.getTime();
      }
    } catch (_pe) { pulseMtime = null; }
    var now = Date.now();
    var stateMd = null;
    if (stateMtime === null) {
      stateMd = { stale: null, drift_minutes: null,
        state_md_age_minutes: null, reason: 'state_md_missing' };
    } else if (pulseMtime === null) {
      stateMd = {
        stale: false,
        drift_minutes: null,
        state_md_age_minutes: Math.round((now - stateMtime) / 60000),
        reason: 'pulse_log_absent'
      };
    } else {
      var driftMin = Math.round((pulseMtime - stateMtime) / 60000);
      stateMd = {
        stale: driftMin > 30,
        drift_minutes: driftMin,
        state_md_age_minutes: Math.round((now - stateMtime) / 60000)
      };
    }
    // -- context_packet_builder freshness ------------------------------
    var cpbPath = path.join(planningDir, 'metrics', 'context-packet-log.jsonl');
    var cpb = null;
    try {
      if (fs.existsSync(cpbPath)) {
        var cStat = fs.statSync(cpbPath);
        if (cStat && cStat.mtime) {
          var ageHours = Math.round((now - cStat.mtime.getTime()) / 3600000);
          cpb = {
            live: ageHours <= 24,
            last_emit_age_hours: ageHours
          };
        }
      }
    } catch (_ce) { cpb = null; }
    if (!cpb) {
      cpb = { live: false, last_emit_age_hours: null,
        reason: 'context_packet_log_absent' };
    }
    // Phase 90-02: enrich state_md staleness with resolver's view. The
    // resolver compares ALL evidence streams (not just mtime drift); when
    // it flags STATE.md as stale, surface that here so cockpit panes get
    // a single boolean to render. Lock-13 wrapped: resolver failure
    // leaves the Phase 86 mtime-only result intact.
    try {
      var effForStaleness = _resolveEffectiveForCockpit(planningDir);
      if (effForStaleness && stateMd && typeof stateMd === 'object') {
        stateMd.projection_stale = (effForStaleness.projection_stale === true);
        if (Array.isArray(effForStaleness.stale_sources)
            && effForStaleness.stale_sources.indexOf('state_md') !== -1) {
          stateMd.projection_stale = true;
        }
        if (typeof effForStaleness.recommended_repair === 'string'
            && effForStaleness.recommended_repair.length > 0) {
          stateMd.recommended_repair = effForStaleness.recommended_repair;
        }
        stateMd.effective_source = effForStaleness.source;
      }
    } catch (_re) { /* keep mtime-only result */ }

    return {
      state_md: stateMd,
      context_packet_builder: cpb,
      source: 'phase_86_staleness_probe'
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'staleness: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// Section: resume_command (Q12)
function _buildResumeCommand(ctx) {
  try {
    // Default canonical resume command. Live event checkpoint_written
    // could override; we expose latest checkpoint reason if present.
    var events = ctx.events || [];
    var checkpoints = _filterByType(events, 'checkpoint_written');
    var latest = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;

    var nextUnit = null;
    var reason = null;
    if (latest && latest.data && typeof latest.data === 'object') {
      nextUnit = (typeof latest.data.next_unit === 'string') ? latest.data.next_unit : null;
      reason = (typeof latest.data.reason === 'string') ? latest.data.reason : null;
    }

    return {
      command: DEFAULT_RESUME_COMMAND,
      next_unit: nextUnit,
      reason: reason,
      source: latest ? 'live_events.checkpoint_written' : 'default'
    };
  } catch (e) {
    return { _degraded: true, error_code: 'internal_error_degraded',
      error: 'resume_command: ' + ((e && e.message) ? e.message : 'unknown') };
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: buildSnapshot (Lock-13 wrapped)
// ---------------------------------------------------------------------------
function buildSnapshot(opts) {
  try {
    var projectDir = _resolveProjectDir(opts);
    var planningDir = _resolvePlanningDir(opts, projectDir);
    var stateFmPath = path.join(planningDir, 'STATE.md');
    var stateFm = _parseFrontmatterFile(stateFmPath);
    var stateFmObj = stateFm || { _missing: true };

    var events = _readLiveEvents(planningDir);

    var activityPath = path.join(planningDir, 'metrics', 'activity-log.jsonl');
    var activityRows = _readJsonl(activityPath);

    var ctx = {
      projectDir: projectDir,
      planningDir: planningDir,
      stateFm: stateFmObj,
      events: events,
      activityRows: activityRows
    };

    // Build all 11 sections defensively (Phase 86: staleness inserted
    // between artifacts and resume_command; resume_command stays last).
    var sectionFns = {
      now: _buildNow,
      objective: _buildObjective,
      unlock: _buildUnlock,
      blockers: _buildBlockers,
      agents: _buildAgents,
      codex: _buildCodex,
      gates: _buildGates,
      tokens: _buildTokens,
      artifacts: _buildArtifacts,
      staleness: _buildStaleness,
      resume_command: _buildResumeCommand
    };

    var data = {};
    var sectionDegraded = [];
    for (var i = 0; i < SECTION_KEYS.length; i++) {
      var key = SECTION_KEYS[i];
      var fn = sectionFns[key];
      var result = null;
      try {
        result = fn(ctx);
      } catch (_se) {
        result = {
          _degraded: true,
          error_code: 'internal_error_degraded',
          error: 'section threw: ' + ((_se && _se.message) ? _se.message : 'unknown')
        };
      }
      if (result && result._degraded === true) {
        sectionDegraded.push(key);
      }
      data[key] = result;
    }

    return {
      ok: true,
      schema_version: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      data: data,
      _section_degraded: sectionDegraded,
      _redactions_applied: []
    };
  } catch (e) {
    return {
      ok: false,
      schema_version: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      error_code: 'internal_error_degraded',
      error: 'buildSnapshot threw: ' + ((e && e.message) ? e.message : 'unknown'),
      data: null,
      _section_degraded: SECTION_KEYS.slice(),
      _redactions_applied: []
    };
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: _internals (helper bag)
// ---------------------------------------------------------------------------
var _internals = {
  EVENT_TYPES: EVENT_TYPES,
  SECTION_KEYS: SECTION_KEYS,
  STREAM_FILENAME: STREAM_FILENAME,
  DEFAULT_RESUME_COMMAND: DEFAULT_RESUME_COMMAND,
  _parseFrontmatterFile: _parseFrontmatterFile,
  _readJsonl: _readJsonl,
  _readLiveEvents: _readLiveEvents,
  _filterByType: _filterByType,
  _buildNow: _buildNow,
  _buildObjective: _buildObjective,
  _buildUnlock: _buildUnlock,
  _buildBlockers: _buildBlockers,
  _buildAgents: _buildAgents,
  _buildCodex: _buildCodex,
  _buildGates: _buildGates,
  _buildTokens: _buildTokens,
  _buildArtifacts: _buildArtifacts,
  _buildStaleness: _buildStaleness,
  _buildResumeCommand: _buildResumeCommand
};

// ---------------------------------------------------------------------------
// PUBLIC API: selfTest
// >=12 assertions covering frozen surfaces, Lock-13, READ-ONLY, ASCII-only,
// and 4 fixture aggregates.
// ---------------------------------------------------------------------------
function selfTest() {
  var results = [];
  function assert(label, cond, detail) {
    results.push({ label: label, ok: !!cond, detail: detail || '' });
  }

  try {
    // A1: SECTION_KEYS frozen + len 11 (Phase 86: staleness inserted
    // between artifacts and resume_command).
    assert('A1_section_keys_frozen_11',
      Object.isFrozen(SECTION_KEYS) && SECTION_KEYS.length === 11,
      'len=' + SECTION_KEYS.length + ' frozen=' + Object.isFrozen(SECTION_KEYS));

    // A2: EVENT_TYPES mirror len=16 + frozen
    assert('A2_event_types_mirror_frozen_16',
      Object.isFrozen(EVENT_TYPES) && EVENT_TYPES.length === 16,
      'len=' + EVENT_TYPES.length);

    // A3: buildSnapshot on missing project (random tmp dir) -> ok:true
    // (defensive: must NOT throw on missing planning dir)
    var os = require('os');
    var tmpEmpty = path.join(os.tmpdir(), 'cockpit-state-self-test-empty-' + Date.now());
    var r3 = buildSnapshot({ projectDir: tmpEmpty });
    assert('A3_missing_project_dir_ok',
      r3 && r3.ok === true && r3.data && typeof r3.data === 'object',
      'ok=' + (r3 && r3.ok));

    // A4: All 11 sections present in r3.data (Phase 86: staleness added).
    var hasAll = true;
    var missingSec = '';
    for (var i = 0; i < SECTION_KEYS.length; i++) {
      var k = SECTION_KEYS[i];
      if (!r3.data || !(k in r3.data)) { hasAll = false; missingSec = k; break; }
    }
    assert('A4_all_11_sections_present', hasAll,
      missingSec ? ('missing=' + missingSec) : 'all-present');

    // A5: buildSnapshot with bad input -> still ok envelope shape
    var r5 = buildSnapshot(null);
    assert('A5_null_opts_ok_shape',
      r5 && (r5.ok === true || r5.ok === false)
        && typeof r5.schema_version === 'number',
      'ok=' + (r5 && r5.ok));

    // A6: Build a synthetic .planning/ tree with a STATE.md and a live
    // events stream. Use the Phase 74 writer via spawnSync to author
    // events (writer is OUTSIDE this file; we never call fs writer APIs
    // from this file's public surface).
    var cp = require('child_process');
    var tmp = path.join(os.tmpdir(), 'cockpit-state-self-test-fx-' + Date.now());
    var planningTmp = path.join(tmp, '.planning');
    var metricsTmp = path.join(planningTmp, 'metrics');
    var milestonesTmp = path.join(planningTmp, 'milestones', 'v2.4', 'phases', '76-cockpit-state-adapter');
    fs.mkdirSync(metricsTmp, { recursive: true });
    fs.mkdirSync(milestonesTmp, { recursive: true });

    var stateMd = '---\n'
      + 'milestone: v2.4\n'
      + 'milestone_name: Test Milestone v2.4\n'
      + 'milestone_status: in-progress\n'
      + 'status: in-progress\n'
      + 'last_updated: 2026-04-29T20:00:00Z\n'
      + 'last_activity: 2026-04-29T20:00:00Z\n'
      + 'roadmap_run:\n'
      + '  current_milestone: v2.4\n'
      + '  current_phase: "76"\n'
      + '  current_phase_name: cockpit-state-adapter\n'
      + '  current_phase_status: in-progress\n'
      + '---\n# Test STATE\n';
    fs.writeFileSync(path.join(planningTmp, 'STATE.md'), stateMd, 'utf8');

    var contextMd = '---\n'
      + 'phase: 76\n'
      + 'phase_name: Cockpit State Adapter\n'
      + 'milestone: v2.4\n'
      + 'unlocks: "phase 77 cockpit panes"\n'
      + '---\n# Test CONTEXT\n';
    fs.writeFileSync(path.join(milestonesTmp, '76-CONTEXT.md'), contextMd, 'utf8');

    // Use Phase 74 writer to author events (the writer file does mutate
    // disk, but it's not THIS file -- it's required at child runtime).
    var writerPath = path.resolve(__dirname, '..', '..', 'scripts', 'lib',
      'orchestrator-live-writer.cjs');
    function emitEvent(type, data, phase) {
      var arg = JSON.stringify({
        type: type, data: data,
        milestone: 'v2.4', phase: phase || '76', plan: '76-01'
      });
      var rr = cp.spawnSync(process.execPath, [writerPath, '--emit', arg], {
        cwd: tmp, encoding: 'utf8'
      });
      return rr;
    }
    emitEvent('phase_started', { phase: '76', phase_name: 'cockpit-state-adapter', milestone: 'v2.4' });
    emitEvent('agent_dispatched', { agent: 'gsd-executor', model: 'sonnet',
      task_id: 'task-A6-1', purpose: 'building adapter' });
    emitEvent('agent_progress', { task_id: 'task-A6-1',
      current_action: 'writing adapter.cjs', files_touched: ['adapter.cjs'] });

    var r6 = buildSnapshot({ projectDir: tmp });
    assert('A6_synthetic_tree_ok', r6 && r6.ok === true,
      'ok=' + (r6 && r6.ok) + ' degraded=' + (r6 && r6.data ? '' : 'no-data'));

    // A7: now.action contains the agent_progress current_action
    var nowOk = false;
    if (r6 && r6.data && r6.data.now) {
      nowOk = (typeof r6.data.now.action === 'string')
        && r6.data.now.action.indexOf('writing adapter') !== -1;
    }
    assert('A7_now_uses_live_progress', nowOk,
      'action=' + (r6 && r6.data && r6.data.now ? r6.data.now.action : 'null'));

    // A8: objective.phase_name === cockpit-state-adapter (from STATE.md)
    var objOk = false;
    if (r6 && r6.data && r6.data.objective) {
      objOk = (r6.data.objective.phase === '76')
        && (typeof r6.data.objective.phase_name === 'string')
        && r6.data.objective.phase_name.indexOf('cockpit-state-adapter') !== -1;
    }
    assert('A8_objective_from_state_md', objOk,
      'phase=' + (r6 && r6.data && r6.data.objective ? r6.data.objective.phase : 'null'));

    // A9: unlock.unlocks read from CONTEXT.md frontmatter
    var unlockOk = false;
    if (r6 && r6.data && r6.data.unlock) {
      unlockOk = (typeof r6.data.unlock.unlocks === 'string')
        && r6.data.unlock.unlocks.indexOf('phase 77') !== -1;
    }
    assert('A9_unlock_from_phase_frontmatter', unlockOk,
      'unlocks=' + (r6 && r6.data && r6.data.unlock ? r6.data.unlock.unlocks : 'null'));

    // A10: agents.roster non-empty after agent_dispatched + agent_progress
    var agentsOk = false;
    if (r6 && r6.data && r6.data.agents) {
      agentsOk = Array.isArray(r6.data.agents.roster)
        && r6.data.agents.roster.length >= 1
        && r6.data.agents.roster[0].agent === 'gsd-executor';
    }
    assert('A10_agents_roster_populated', agentsOk,
      'roster=' + (r6 && r6.data && r6.data.agents ? r6.data.agents.roster.length : 'null'));

    // A11: resume_command default
    var rcOk = false;
    if (r6 && r6.data && r6.data.resume_command) {
      rcOk = r6.data.resume_command.command === DEFAULT_RESUME_COMMAND;
    }
    assert('A11_resume_command_default', rcOk,
      'cmd=' + (r6 && r6.data && r6.data.resume_command ? r6.data.resume_command.command : 'null'));

    // A_STALENESS (Phase 86): staleness section present in synthetic snapshot
    // with state_md + context_packet_builder sub-objects. The synthetic tree
    // wrote STATE.md but no orchestrator-pulse.jsonl, so state_md.reason
    // should be 'pulse_log_absent' (drift undeterminable, stale=false).
    // context_packet_log.jsonl is also absent so context_packet_builder.live
    // must be false with reason 'context_packet_log_absent'.
    var stOk = false;
    if (r6 && r6.data && r6.data.staleness
        && typeof r6.data.staleness === 'object') {
      var smd = r6.data.staleness.state_md;
      var cpb = r6.data.staleness.context_packet_builder;
      stOk = smd && typeof smd === 'object'
        && cpb && typeof cpb === 'object'
        && cpb.live === false;
    }
    assert('A_STALENESS_section_present', stOk,
      'has_section=' + !!(r6 && r6.data && r6.data.staleness)
        + ' state_md=' + JSON.stringify(r6 && r6.data && r6.data.staleness
            ? r6.data.staleness.state_md : null)
        + ' cpb=' + JSON.stringify(r6 && r6.data && r6.data.staleness
            ? r6.data.staleness.context_packet_builder : null));

    // ------------------------------------------------------------------
    // A12-A15: 4 FIXTURE AGGREGATES
    // For each fixture under fixtures/{name}/, we read STATE.md +
    // ORCHESTRATOR-LIVE.jsonl + expected.json and verify the adapter
    // output matches expected.json via runMatcher (loaded from warp-mcp
    // server.cjs since it's already battle-tested).
    // ------------------------------------------------------------------
    var fixturesRoot = path.join(__dirname, 'fixtures');
    var fixtureNames = ['active', 'blocked', 'warning', 'complete'];

    // Lazy-load runMatcher from warp-mcp.
    var mcpServerPath = path.resolve(__dirname, '..', 'warp-mcp', 'server.cjs');
    var matcher = null;
    try { matcher = require(mcpServerPath); } catch (_me) { matcher = null; }
    var runMatcher = (matcher && typeof matcher.runMatcher === 'function')
      ? matcher.runMatcher : null;

    if (!runMatcher) {
      // Defensive fallback: if matcher require fails, treat fixture aggregates
      // as a single skip; we still pass core assertions but not aggregates.
      assert('A12_matcher_loadable', false, 'runMatcher require failed');
    } else {
      assert('A12_matcher_loadable', true, 'runMatcher loaded');

      for (var fxi = 0; fxi < fixtureNames.length; fxi++) {
        var fxn = fixtureNames[fxi];
        var fxDir = path.join(fixturesRoot, fxn);
        var expectedPath = path.join(fxDir, 'expected.json');
        // Each fixture lays its synthetic .planning tree under
        // _pseudo_root/.planning. The adapter resolves planningDir =
        // projectDir/.planning, so passing projectDir = _pseudo_root
        // directs the read at the fixture data.
        var pseudoRoot = path.join(fxDir, '_pseudo_root');
        var fxPlanningDir = path.join(pseudoRoot, '.planning');
        if (!fs.existsSync(fxDir) || !fs.existsSync(expectedPath)
            || !fs.existsSync(fxPlanningDir)) {
          assert('A_fixture_' + fxn, false,
            'missing fixture dir or expected.json or _pseudo_root/.planning');
          continue;
        }
        var expected = null;
        try {
          expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
        } catch (_pe) {
          assert('A_fixture_' + fxn, false, 'expected.json unparseable');
          continue;
        }
        var snap = buildSnapshot({ projectDir: pseudoRoot });
        if (!snap || snap.ok !== true) {
          assert('A_fixture_' + fxn, false,
            'snapshot ok=false for ' + fxn);
          continue;
        }
        // Match expected.data against snap.data via the warp-mcp matcher.
        var expectData = (expected && expected.data) ? expected.data : expected;
        var mr = runMatcher(snap.data, expectData);
        if (mr && mr.ok) {
          assert('A_fixture_' + fxn, true, 'matched');
        } else {
          assert('A_fixture_' + fxn, false,
            'mismatch_path=' + (mr ? mr.mismatch_path : '?'));
        }
      }
    }

    // A_READ_ONLY: scan public surface (everything before selfTest function
    // body) for banned mutating fs tokens. Build banned tokens via concat
    // so the scan does not match itself.
    var src = fs.readFileSync(__filename, 'utf8');
    var selfTestMarker = 'function selfTest' + '(';
    var selfTestIdx = src.indexOf(selfTestMarker);
    var publicSrc = (selfTestIdx > 0) ? src.substring(0, selfTestIdx) : src;
    var banned = [
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
    var bannedHit = '';
    for (var bi = 0; bi < banned.length; bi++) {
      if (publicSrc.indexOf(banned[bi]) !== -1) { bannedHit = banned[bi]; break; }
    }
    assert('A_READ_ONLY_invariant_public_api', bannedHit === '',
      'banned_hit=' + (bannedHit || 'none'));

    // A_ASCII: ascii-only across the entire file.
    var firstNonAscii = -1;
    for (var ai = 0; ai < src.length; ai++) {
      if (src.charCodeAt(ai) > 127) { firstNonAscii = ai; break; }
    }
    assert('A_ASCII_only', firstNonAscii === -1, 'idx=' + firstNonAscii);

    // Cleanup
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

    var allOk = results.every(function (r) { return r.ok; });
    return { ok: allOk, results: results };
  } catch (e) {
    results.push({ label: 'self_test_threw', ok: false,
      detail: 'error: ' + (e && e.message ? e.message : 'unknown') });
    return { ok: false, results: results };
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function _printHelp() {
  process.stdout.write('cockpit-state/adapter.cjs\n');
  process.stdout.write('  --self-test                 run selfTest\n');
  process.stdout.write('  --json [--project DIR]      emit live snapshot envelope\n');
  process.stdout.write('  --help                      print this help\n');
}

if (require.main === module) {
  var args = process.argv.slice(2);
  if (args.length === 0 || args.indexOf('--help') !== -1) {
    _printHelp();
    process.exit(0);
  }
  if (args.indexOf('--self-test') !== -1) {
    var st = selfTest();
    var pass = 0, fail = 0;
    for (var i = 0; i < st.results.length; i++) {
      var r = st.results[i];
      var tag = r.ok ? 'PASS' : 'FAIL';
      if (r.ok) pass++; else fail++;
      process.stdout.write(tag + ' ' + r.label
        + (r.detail ? '  (' + r.detail + ')' : '') + '\n');
    }
    process.stdout.write('\nSelf-test: ' + pass + '/' + (pass + fail) + ' passed\n');
    process.exit(st.ok ? 0 : 1);
  }
  if (args.indexOf('--json') !== -1) {
    var pIdx = args.indexOf('--project');
    var projectDir = (pIdx !== -1 && args[pIdx + 1]) ? args[pIdx + 1] : process.cwd();
    var snap = buildSnapshot({ projectDir: projectDir });
    process.stdout.write(JSON.stringify(snap, null, 2) + '\n');
    process.exit(snap.ok ? 0 : 1);
  }
  _printHelp();
  process.exit(0);
}

module.exports = {
  buildSnapshot: buildSnapshot,
  selfTest: selfTest,
  _internals: _internals,
  EVENT_TYPES: EVENT_TYPES,
  SECTION_KEYS: SECTION_KEYS,
  SCHEMA_VERSION: SCHEMA_VERSION
};
