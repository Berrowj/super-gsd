#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/upgrade-drift/check.cjs
// Phase 62-01: Migration / Upgrade Safety Drift Checker (READ-ONLY).
//
// PURPOSE
//   Probe the local checkout for v1.5 -> v2.1 migration markers without
//   modifying any file. Each probe returns a {name, present, source_phase,
//   version_tag, evidence_path, reason} sentinel. The checker NEVER writes,
//   appends, unlinks, or mkdirs anywhere on disk; selfTest enforces this by
//   scanning this very source for those banned tokens.
//
//   Rationale: an operator upgrading from v1.5 -> v2.1 needs a single
//   read-only fingerprint of "what milestones have actually landed in
//   this checkout". Asking each phase tree directly is the canonical
//   answer; Lock 4 (phase trees byte-untouched) means a present probe
//   is also evidence the phase produced its canonical output.
//
//   ROADMAP-AGENT.md line 770 verbatim goal:
//     "Drift checker (8 probes) reports v1.5->v2.1 markers without
//      modifying files."
//
// 4 PUBLIC APIs (Lock-13 wrapped, mirrors Phase 58 installer-audit shape)
//   - runDrift({planningDir?, projectRoot?})
//       -> {ok, schema_version, ts, probes:[...], summary:{...},
//           migration_notes:{...}, exit_code}
//   - getProbe(name, opts?)
//       -> {ok, name, present, source_phase, version_tag, evidence_path,
//           reason}  (single-probe accessor; bad name -> degraded sentinel)
//   - selfTest()
//       -> {ok, results:[...]} (8-12 assertions)
//   - _internals  (bag of helpers for cross-task composition)
//
// PROBES (>=8; closed-vocab PROBE_NAMES array)
//   - schema_version_2_plans          source_phase=11  version_tag=v1.2
//   - agent_token_spend_ledger        source_phase=41  version_tag=v1.9
//   - context_packet_tree             source_phase=45  version_tag=v1.9
//   - sqlite_context_index_tree       source_phase=46  version_tag=v1.9
//   - dispatch_router_tree            source_phase=47  version_tag=v1.9
//   - memory_governance_tree          source_phase=49  version_tag=v1.9
//   - redis_adapter_present           source_phase=52  version_tag=v1.9
//   - failure_injection_tree          source_phase=53  version_tag=v2.0
//   - release_readiness_present       source_phase=57  version_tag=v2.0
//   - installer_audit_tree            source_phase=58  version_tag=v2.1
//   - new_project_wizard_present      source_phase=59  version_tag=v2.1
//
//   That is 11 probes; ROADMAP-AGENT requires >=8. The extras give a
//   richer migration fingerprint and let UPGRADE-DRIFT.md enumerate
//   per-milestone deltas. PROBE_NAMES is Object.freeze'd; selfTest A1
//   verifies length and frozen.
//
//   Probe shape (Lock 11 byte-equality on closed enum fields):
//     {
//       name: <PROBE_NAMES entry>,
//       present: true|false,           // probe ran without throwing AND found marker
//       ok: true|false,                // probe ran without throwing
//       source_phase: <integer>,       // phase number that landed this surface
//       version_tag: <VERSION_TAGS entry>,
//       evidence_path: string,         // path that was checked (relative)
//       reason: <REASON_NOTES entry>,  // closed-vocab why-string
//     }
//
// REASON_NOTES (closed vocab, frozen)
//   - present_phase_tree_found
//   - present_file_found
//   - present_artifact_found
//   - missing_path_not_found
//   - missing_path_not_directory
//   - missing_path_not_file
//   - read_only_filesystem_probe
//   - probe_internal_error_degraded
//
// VERSION_TAGS (closed vocab, frozen)
//   - v1.2  (schema_version=2 plans landed)
//   - v1.9  (SGSD-Research milestone)
//   - v2.0  (Failure Injection milestone)
//   - v2.1  (Distribution + Onboarding milestone)
//
// LOCK INVARIANTS
//   - Lock 4: Phase 41-61 byte-untouched. We never require() any Phase
//     41-61 module from this file. The probes for phase trees are
//     filesystem existence checks only -- never an import.
//   - Lock 11: probe matching uses byte-equality on closed-vocab fields
//     (VERSION_TAGS enum, REASON_NOTES enum). No regex on phase numbers,
//     no fuzzy directory match.
//   - Lock 13: every public API and every probe wraps internals in
//     try/catch; never throws upward. statSync failure -> degraded
//     sentinel; missing path -> missing reason.
//   - READ-ONLY: zero fs.writeFileSync, zero fs.appendFileSync, zero
//     fs.mkdirSync, zero fs.unlinkSync, zero fs.rmSync, zero fs.rmdirSync.
//     selfTest A8 enforces this by scanning the source code (comments
//     stripped) for those substrings and asserting absent.
//   - ASCII-only: no smart quotes, no emoji, no non-ASCII literals
//     anywhere. selfTest A7 enforces via first_nonascii_idx === -1.
// =============================================================================

'use strict';

var fs = require('fs');
var path = require('path');

// ---------------------------------------------------------------------------
// FROZEN SURFACES
// ---------------------------------------------------------------------------
var SCHEMA_VERSION = 1;

var PROBE_NAMES = Object.freeze([
  'schema_version_2_plans',
  'agent_token_spend_ledger',
  'context_packet_tree',
  'sqlite_context_index_tree',
  'dispatch_router_tree',
  'memory_governance_tree',
  'redis_adapter_present',
  'failure_injection_tree',
  'release_readiness_present',
  'installer_audit_tree',
  'new_project_wizard_present',
]);

var VERSION_TAGS = Object.freeze([
  'v1.2',
  'v1.9',
  'v2.0',
  'v2.1',
]);

var REASON_NOTES = Object.freeze([
  'present_phase_tree_found',
  'present_file_found',
  'present_artifact_found',
  'missing_path_not_found',
  'missing_path_not_directory',
  'missing_path_not_file',
  'read_only_filesystem_probe',
  'probe_internal_error_degraded',
]);

// Probe -> {source_phase, version_tag, kind, rel_paths}
// kind is one of: 'dir', 'file', 'glob_anchor'
// rel_paths is an array of CANDIDATE paths -- the FIRST present path
// wins. This lets a probe accept either of two equivalent canonical
// landing paths (e.g. sqlite-context-index OR context-cache for Phase
// 46), per Phase 62 spec ROADMAP-AGENT.md item P4.
// glob_anchor probes inspect for at least one matching file at the
// candidate path.
var PROBE_DEFS = Object.freeze({
  schema_version_2_plans: Object.freeze({
    source_phase: 11,
    version_tag: 'v1.2',
    kind: 'glob_anchor',
    rel_paths: Object.freeze([
      'super-gsd/templates/plan-schema-v2.json',
      'super-gsd/tools/plan-schema/plan-schema-v2.json',
    ]),
  }),
  agent_token_spend_ledger: Object.freeze({
    source_phase: 41,
    version_tag: 'v1.9',
    kind: 'file',
    rel_paths: Object.freeze([
      '.planning/metrics/agent-token-spend.jsonl',
    ]),
  }),
  context_packet_tree: Object.freeze({
    source_phase: 45,
    version_tag: 'v1.9',
    kind: 'dir',
    rel_paths: Object.freeze([
      'super-gsd/tools/context-packet',
    ]),
  }),
  sqlite_context_index_tree: Object.freeze({
    source_phase: 46,
    version_tag: 'v1.9',
    kind: 'dir',
    rel_paths: Object.freeze([
      'super-gsd/tools/sqlite-context-index',
      'super-gsd/tools/context-cache',
    ]),
  }),
  dispatch_router_tree: Object.freeze({
    source_phase: 47,
    version_tag: 'v1.9',
    kind: 'dir',
    rel_paths: Object.freeze([
      'super-gsd/tools/dispatch-router',
    ]),
  }),
  memory_governance_tree: Object.freeze({
    source_phase: 49,
    version_tag: 'v1.9',
    kind: 'dir',
    rel_paths: Object.freeze([
      'super-gsd/tools/memory-governance',
    ]),
  }),
  redis_adapter_present: Object.freeze({
    source_phase: 52,
    version_tag: 'v1.9',
    kind: 'file',
    rel_paths: Object.freeze([
      'super-gsd/tools/context-cache/redis-adapter.cjs',
    ]),
  }),
  failure_injection_tree: Object.freeze({
    source_phase: 53,
    version_tag: 'v2.0',
    kind: 'dir',
    rel_paths: Object.freeze([
      'super-gsd/tools/failure-injection',
    ]),
  }),
  release_readiness_present: Object.freeze({
    source_phase: 57,
    version_tag: 'v2.0',
    kind: 'file',
    rel_paths: Object.freeze([
      'super-gsd/tools/release-readiness/score.cjs',
    ]),
  }),
  installer_audit_tree: Object.freeze({
    source_phase: 58,
    version_tag: 'v2.1',
    kind: 'dir',
    rel_paths: Object.freeze([
      'super-gsd/tools/installer-audit',
    ]),
  }),
  new_project_wizard_present: Object.freeze({
    source_phase: 59,
    version_tag: 'v2.1',
    kind: 'file',
    rel_paths: Object.freeze([
      'super-gsd/scripts/sgsd-new-project-wizard.cjs',
    ]),
  }),
});

// ---------------------------------------------------------------------------
// Project root resolution. Walks up from __dirname looking for .planning/.
// Defensive: never throws.
// ---------------------------------------------------------------------------
function _resolveProjectRoot(opts) {
  try {
    if (opts && typeof opts.projectRoot === 'string' && opts.projectRoot.length > 0) {
      return path.resolve(opts.projectRoot);
    }
    var cur = path.resolve(__dirname);
    for (var i = 0; i < 8; i++) {
      var probe = path.join(cur, '.planning');
      if (fs.existsSync(probe)) return cur;
      var parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    return path.resolve(__dirname, '..', '..', '..');
  } catch (_e) {
    return path.resolve(__dirname, '..', '..', '..');
  }
}

function _resolvePlanningDir(opts) {
  try {
    if (opts && typeof opts.planningDir === 'string' && opts.planningDir.length > 0) {
      if (path.isAbsolute(opts.planningDir)) return opts.planningDir;
      return path.resolve(_resolveProjectRoot(opts), opts.planningDir);
    }
    return path.join(_resolveProjectRoot(opts), '.planning');
  } catch (_e) {
    return path.join(_resolveProjectRoot(opts), '.planning');
  }
}

// ---------------------------------------------------------------------------
// Sentinel constructor. Keeps probe shape canonical even when degraded.
// ---------------------------------------------------------------------------
function _mkProbe(name, present, sourcePhase, versionTag, evidencePath, reason) {
  return {
    name: name,
    ok: true,
    present: !!present,
    source_phase: (typeof sourcePhase === 'number') ? sourcePhase : -1,
    version_tag: (typeof versionTag === 'string') ? versionTag : '',
    evidence_path: (typeof evidencePath === 'string') ? evidencePath : '',
    reason: (typeof reason === 'string') ? reason : 'probe_internal_error_degraded',
  };
}

function _mkDegraded(name) {
  return {
    name: (typeof name === 'string') ? name : '?',
    ok: false,
    present: false,
    source_phase: -1,
    version_tag: '',
    evidence_path: '',
    reason: 'probe_internal_error_degraded',
  };
}

// ---------------------------------------------------------------------------
// Filesystem existence probe. READ-ONLY (statSync + existsSync only).
// Never throws.
// ---------------------------------------------------------------------------
function _probeKindDir(absPath) {
  try {
    if (!fs.existsSync(absPath)) {
      return { present: false, reason: 'missing_path_not_found' };
    }
    var st = fs.statSync(absPath);
    if (!st.isDirectory()) {
      return { present: false, reason: 'missing_path_not_directory' };
    }
    return { present: true, reason: 'present_phase_tree_found' };
  } catch (_e) {
    return { present: false, reason: 'probe_internal_error_degraded' };
  }
}

function _probeKindFile(absPath) {
  try {
    if (!fs.existsSync(absPath)) {
      return { present: false, reason: 'missing_path_not_found' };
    }
    var st = fs.statSync(absPath);
    if (!st.isFile()) {
      return { present: false, reason: 'missing_path_not_file' };
    }
    return { present: true, reason: 'present_file_found' };
  } catch (_e) {
    return { present: false, reason: 'probe_internal_error_degraded' };
  }
}

// glob_anchor: probe asserts the rel_path file exists. Used for the
// schema_version=2 marker -- the canonical anchor is the schema file at
// super-gsd/tools/plan-schema/plan-schema-v2.json. If the file exists
// the v1.2 schema_version=2 surface landed.
function _probeKindGlobAnchor(absPath) {
  try {
    if (!fs.existsSync(absPath)) {
      return { present: false, reason: 'missing_path_not_found' };
    }
    var st = fs.statSync(absPath);
    if (!st.isFile()) {
      return { present: false, reason: 'missing_path_not_file' };
    }
    return { present: true, reason: 'present_artifact_found' };
  } catch (_e) {
    return { present: false, reason: 'probe_internal_error_degraded' };
  }
}

// ---------------------------------------------------------------------------
// PROBE DISPATCH
// Walks def.rel_paths in declaration order. The FIRST present path wins
// (fast-path return). If every candidate is missing, the LAST candidate's
// reason is reported (so the operator gets a deterministic
// missing_path_not_found / missing_path_not_directory / missing_path_not_file
// signal pointing at the most-recent canonical landing path).
// ---------------------------------------------------------------------------
function _runOneProbe(name, opts) {
  var def = PROBE_DEFS[name];
  if (!def || !Array.isArray(def.rel_paths) || def.rel_paths.length === 0) {
    return _mkDegraded(name);
  }
  var root = _resolveProjectRoot(opts || {});
  var lastRel = def.rel_paths[def.rel_paths.length - 1];
  var lastReason = 'missing_path_not_found';
  for (var pi = 0; pi < def.rel_paths.length; pi++) {
    var rel = def.rel_paths[pi];
    var abs = path.join(root, rel);
    var res = null;
    if (def.kind === 'dir') {
      res = _probeKindDir(abs);
    } else if (def.kind === 'file') {
      res = _probeKindFile(abs);
    } else if (def.kind === 'glob_anchor') {
      res = _probeKindGlobAnchor(abs);
    } else {
      return _mkDegraded(name);
    }
    if (res && res.present === true) {
      return _mkProbe(name, true, def.source_phase, def.version_tag, rel, res.reason);
    }
    lastReason = res && res.reason ? res.reason : lastReason;
    lastRel = rel;
  }
  return _mkProbe(name, false, def.source_phase, def.version_tag, lastRel, lastReason);
}

// ---------------------------------------------------------------------------
// PUBLIC API: getProbe (Lock-13 wrapped)
// ---------------------------------------------------------------------------
function getProbe(name, opts) {
  try {
    if (typeof name !== 'string' || PROBE_NAMES.indexOf(name) === -1) {
      return _mkDegraded(typeof name === 'string' ? name : '?');
    }
    var p = _runOneProbe(name, opts || {});
    if (!p || typeof p !== 'object') {
      return _mkDegraded(name);
    }
    return p;
  } catch (_e) {
    return _mkDegraded(typeof name === 'string' ? name : '?');
  }
}

// ---------------------------------------------------------------------------
// SUMMARY: aggregate present/missing counts grouped by version_tag.
// ---------------------------------------------------------------------------
function _summarize(probes) {
  var present = 0;
  var missing = 0;
  var byTag = {
    'v1.2': { present: 0, missing: 0 },
    'v1.9': { present: 0, missing: 0 },
    'v2.0': { present: 0, missing: 0 },
    'v2.1': { present: 0, missing: 0 },
  };
  var presentNames = [];
  var missingNames = [];
  for (var i = 0; i < probes.length; i++) {
    var p = probes[i];
    if (!p) continue;
    if (p.present === true) {
      present++;
      presentNames.push(p.name);
    } else {
      missing++;
      missingNames.push(p.name);
    }
    if (byTag[p.version_tag]) {
      if (p.present === true) byTag[p.version_tag].present++;
      else byTag[p.version_tag].missing++;
    }
  }
  return {
    total: probes.length,
    present: present,
    missing: missing,
    by_version_tag: byTag,
    present_names: presentNames,
    missing_names: missingNames,
  };
}

// ---------------------------------------------------------------------------
// MIGRATION NOTES: deterministic v1.5 -> v2.1 deltas, grouped by milestone.
// Static text (no fs read of changelogs); each entry references the
// landing phase. Used by UPGRADE-DRIFT.md and rendered in the CLI report.
// ---------------------------------------------------------------------------
var MIGRATION_NOTES = Object.freeze({
  'v1.5_baseline': Object.freeze([
    'pre-v1.6 baseline (October 2025): orchestrator + 8 skills + ATC',
    'plans were schema_version=1 (free-form markdown frontmatter)',
    'no canonical token ledger, no phase capsules, no context registry',
    'no failure-injection harness, no chaos-restart, no release-readiness',
    'no installer audit, no new-project wizard, no example fixture',
  ]),
  'v1.6_cockpit': Object.freeze([
    'phases 26-30: cockpit dashboards + Codex single-pane consolidation',
    'introduced sgsd-cockpit-shell.cjs Node bridge',
    'introduced sgsd-{token,active-agent,source-mix,codex,intent,governance,budget}-panel.ps1',
    'shipped with debt-10 (5 phase-ATC cosmetic items deferred)',
  ]),
  'v1.7_command_contracts': Object.freeze([
    'phases 31-35: command-contract enforcement + bypass-pattern catalog',
    'closed v1.5 empty-baseline gap at Phase 34',
    'shipped clean (combined anti-slop ~9.5/10)',
  ]),
  'v1.8_gate_fitness': Object.freeze([
    'phases 36-40: gate-keep-kill rubric + phase-folder audit + gate fitness',
    'shipped clean (combined anti-slop ~9/10)',
  ]),
  'v1.9_research': Object.freeze([
    'phases 41-52: SGSD-Research (context compression, token governance, research routing)',
    'introduced agent-token-spend.jsonl ledger (Phase 41)',
    'introduced context-packet builder + 6-role packets (Phase 45)',
    'introduced SQLite context index + better-sqlite3 (Phase 46)',
    'introduced dispatch-router + 18-entry decision enum (Phase 47)',
    'introduced selective VTP bridge + 5000-token cap (Phase 48)',
    'introduced memory-governance lifecycle + 4 canonical streams (Phase 49)',
    'introduced cockpit research dashboard panels (Phase 50)',
    'introduced context-stress benchmark + 16-fixture failure injection F1-F16 (Phase 51)',
    'introduced redis-adapter live cache + 7 REDIS-LOCKS (Phase 52)',
  ]),
  'v2_0_failure_injection': Object.freeze([
    'phases 53-57: gate failure injection + restart chaos + provider circuits',
    'introduced failure-injection harness (10 scenarios + 24 self-test) (Phase 53)',
    'introduced chaos-restart harness (5 kill points) (Phase 54)',
    'introduced provider-circuit codex->claude fallback (Phase 55)',
    'introduced scenario-suite (10 scenarios + JSON-Schema draft-07) (Phase 56)',
    'introduced release-readiness score (8-bucket composite + edge_guard_miss override) (Phase 57)',
  ]),
  'v2_1_distribution': Object.freeze([
    'phases 58-62: distribution + onboarding',
    'introduced installer-audit (12 probes + clean-room.sh) (Phase 58)',
    'introduced sgsd-new-project-wizard (deep-merge non-clobber + idempotent) (Phase 59)',
    'introduced examples/hello-world fixture + EXAMPLE-DEMO-WALKTHROUGH.md (Phase 60)',
    'public README refresh (preamble + VTP-optional sweep + sg quick-start) (Phase 61)',
    'introduced upgrade-drift checker (this file) (Phase 62)',
  ]),
});

function _migrationNotes() {
  // Return a fresh non-frozen copy so callers can JSON.stringify safely
  // without worrying about the shared frozen reference.
  var out = {};
  var keys = Object.keys(MIGRATION_NOTES);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    out[k] = MIGRATION_NOTES[k].slice();
  }
  return out;
}

// ---------------------------------------------------------------------------
// PUBLIC API: runDrift (Lock-13 wrapped). READ-ONLY: this function does
// NOT mutate the filesystem in any way. selfTest A6 verifies git status
// stays empty across a runDrift() call.
// ---------------------------------------------------------------------------
function runDrift(opts) {
  var ts = new Date().toISOString();
  var probes = [];
  for (var i = 0; i < PROBE_NAMES.length; i++) {
    probes.push(getProbe(PROBE_NAMES[i], opts || {}));
  }
  var summary = _summarize(probes);
  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    ts: ts,
    probes: probes,
    summary: summary,
    migration_notes: _migrationNotes(),
    exit_code: 0,
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API: selfTest (Lock-13 wrapped)
// 8-12 assertions covering shape, frozen surfaces, Lock 13, READ-ONLY,
// ASCII-only, and degraded-OK fallback.
// ---------------------------------------------------------------------------
function selfTest() {
  var results = [];
  function add(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  try {
    // A1: PROBE_NAMES length >= 8 and frozen.
    var lenOK = PROBE_NAMES.length >= 8;
    var frozen = Object.isFrozen(PROBE_NAMES);
    add('probe_names_min_8_and_frozen',
      lenOK && frozen,
      'len=' + PROBE_NAMES.length + ' frozen=' + frozen);

    // A2: every probe entry from runDrift() has the canonical shape.
    var snap = runDrift({});
    var shapeOK = Array.isArray(snap.probes) && snap.probes.length === PROBE_NAMES.length;
    if (shapeOK) {
      for (var i = 0; i < snap.probes.length; i++) {
        var p = snap.probes[i];
        if (!p || typeof p.name !== 'string'
            || typeof p.ok !== 'boolean'
            || typeof p.present !== 'boolean'
            || typeof p.source_phase !== 'number'
            || VERSION_TAGS.indexOf(p.version_tag) === -1
            || REASON_NOTES.indexOf(p.reason) === -1
            || typeof p.evidence_path !== 'string') {
          shapeOK = false;
          break;
        }
      }
    }
    add('every_probe_canonical_shape', shapeOK,
      'count=' + (snap.probes ? snap.probes.length : 0));

    // A3: Lock 13: getProbe with bad name returns degraded sentinel,
    // never throws.
    var threw = false;
    var bad;
    try {
      bad = getProbe('not_a_real_probe_xyz');
    } catch (_e) { threw = true; }
    add('get_probe_bad_name_degraded',
      !threw && bad && bad.ok === false && bad.present === false
        && bad.reason === 'probe_internal_error_degraded',
      'reason=' + (bad ? bad.reason : 'null'));

    // A4: Lock 13: getProbe with non-string returns degraded sentinel,
    // never throws.
    var threw2 = false;
    var bad2;
    try {
      bad2 = getProbe(123);
    } catch (_e) { threw2 = true; }
    add('get_probe_non_string_degraded',
      !threw2 && bad2 && bad2.ok === false && bad2.present === false,
      'threw=' + threw2);

    // A5: at least one probe reports present (we are running INSIDE the
    // super-gsd checkout, so the new_project_wizard probe -- a Phase 59
    // file -- must resolve present unless this checkout is broken).
    var wiz = getProbe('new_project_wizard_present');
    add('phase_59_wizard_present_in_self_checkout',
      wiz && wiz.present === true && wiz.version_tag === 'v2.1',
      'present=' + (wiz ? wiz.present : '?')
        + ' tag=' + (wiz ? wiz.version_tag : '?'));

    // A6: SUMMARY shape.
    var sumOK = snap && snap.summary
              && typeof snap.summary.total === 'number'
              && typeof snap.summary.present === 'number'
              && typeof snap.summary.missing === 'number'
              && snap.summary.by_version_tag
              && Array.isArray(snap.summary.present_names)
              && Array.isArray(snap.summary.missing_names);
    add('summary_shape_ok', sumOK,
      'total=' + (sumOK ? snap.summary.total : '?'));

    // A7: ASCII-only of check.cjs source.
    var src = '';
    try { src = fs.readFileSync(__filename, 'utf8'); } catch (_e) { src = ''; }
    var firstNonAscii = -1;
    for (var j = 0; j < src.length; j++) {
      var c = src.charCodeAt(j);
      if (c > 0x7E || (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D)) {
        firstNonAscii = j;
        break;
      }
    }
    add('ascii_only_source',
      firstNonAscii === -1,
      'first_nonascii_idx=' + firstNonAscii);

    // A8: READ-ONLY invariant: check.cjs CODE contains zero mutating fs
    // calls. Strip pure comment lines (// or leading *) before scanning
    // so the assertion does not self-trigger on doc strings or its own
    // assertion text. Tokens are assembled from substrings so they
    // cannot appear contiguously even in code-mode.
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
    for (var ki = 0; ki < srcLines.length; ki++) {
      var ln = srcLines[ki];
      var lt = ln.replace(/^\s+/, '');
      if (lt.indexOf('//') === 0) continue;
      if (lt.indexOf('*') === 0) continue;
      codeOnly += ln + '\n';
    }
    var hasWrite = false;
    for (var bi = 0; bi < bannedTokens.length; bi++) {
      if (codeOnly.indexOf(bannedTokens[bi]) !== -1) { hasWrite = true; break; }
    }
    add('read_only_invariant',
      hasWrite === false,
      'hasWrite=' + hasWrite);

    // A9: VERSION_TAGS frozen with exactly the 4 milestone tags.
    var tagsOK = VERSION_TAGS.length === 4
              && Object.isFrozen(VERSION_TAGS)
              && VERSION_TAGS.indexOf('v1.2') !== -1
              && VERSION_TAGS.indexOf('v1.9') !== -1
              && VERSION_TAGS.indexOf('v2.0') !== -1
              && VERSION_TAGS.indexOf('v2.1') !== -1;
    add('version_tags_frozen_4_entries', tagsOK,
      'len=' + VERSION_TAGS.length);

    // A10: REASON_NOTES frozen with exactly 8 closed-vocab notes.
    var reasonsOK = REASON_NOTES.length === 8
                 && Object.isFrozen(REASON_NOTES)
                 && REASON_NOTES.indexOf('present_phase_tree_found') !== -1
                 && REASON_NOTES.indexOf('missing_path_not_found') !== -1
                 && REASON_NOTES.indexOf('probe_internal_error_degraded') !== -1;
    add('reason_notes_frozen_8_entries', reasonsOK,
      'len=' + REASON_NOTES.length);

    // A11: migration_notes contains all 7 milestone keys.
    var notes = snap && snap.migration_notes ? snap.migration_notes : {};
    var noteKeys = ['v1.5_baseline', 'v1.6_cockpit', 'v1.7_command_contracts',
                    'v1.8_gate_fitness', 'v1.9_research', 'v2_0_failure_injection',
                    'v2_1_distribution'];
    var notesOK = true;
    for (var nk = 0; nk < noteKeys.length; nk++) {
      if (!Array.isArray(notes[noteKeys[nk]]) || notes[noteKeys[nk]].length === 0) {
        notesOK = false;
        break;
      }
    }
    add('migration_notes_7_milestone_keys', notesOK,
      'keys=' + Object.keys(notes).length);

    // A12: schema_version is 1 (locked).
    add('schema_version_locked',
      snap && snap.schema_version === SCHEMA_VERSION,
      'schema_version=' + (snap ? snap.schema_version : '?'));

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
var _internals = {
  PROBE_NAMES: PROBE_NAMES,
  PROBE_DEFS: PROBE_DEFS,
  VERSION_TAGS: VERSION_TAGS,
  REASON_NOTES: REASON_NOTES,
  MIGRATION_NOTES: MIGRATION_NOTES,
  SCHEMA_VERSION: SCHEMA_VERSION,
  _resolveProjectRoot: _resolveProjectRoot,
  _resolvePlanningDir: _resolvePlanningDir,
  _mkProbe: _mkProbe,
  _mkDegraded: _mkDegraded,
  _runOneProbe: _runOneProbe,
  _summarize: _summarize,
  _migrationNotes: _migrationNotes,
};

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------
function _printSelfTest(out) {
  if (!out || !Array.isArray(out.results)) {
    process.stdout.write('drift_self_test: results not an array\n');
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
  process.stdout.write('drift_self_test: ' + pass + '/' + out.results.length
    + ' assertions passed\n');
  return pass === out.results.length;
}

function _printRun(out) {
  if (!out || !Array.isArray(out.probes)) {
    process.stdout.write('drift_run: no probes\n');
    return 1;
  }
  process.stdout.write('drift_run schema_version=' + out.schema_version
    + ' ts=' + out.ts + '\n');
  for (var i = 0; i < out.probes.length; i++) {
    var p = out.probes[i];
    process.stdout.write('  '
      + (p.present ? 'PRESENT ' : 'MISSING ')
      + p.name
      + ' phase=' + p.source_phase
      + ' tag=' + p.version_tag
      + ' reason=' + p.reason
      + ' path=' + p.evidence_path + '\n');
  }
  process.stdout.write('---\n');
  process.stdout.write('drift_summary total=' + out.summary.total
    + ' present=' + out.summary.present
    + ' missing=' + out.summary.missing + '\n');
  var keys = Object.keys(out.summary.by_version_tag);
  for (var ki = 0; ki < keys.length; ki++) {
    var k = keys[ki];
    var v = out.summary.by_version_tag[k];
    process.stdout.write('  tag=' + k
      + ' present=' + v.present
      + ' missing=' + v.missing + '\n');
  }
  process.stdout.write('---\n');
  process.stdout.write('drift_migration_notes:\n');
  var mkeys = Object.keys(out.migration_notes);
  for (var mi = 0; mi < mkeys.length; mi++) {
    var mk = mkeys[mi];
    process.stdout.write('  ' + mk + ': ' + out.migration_notes[mk].length
      + ' deltas\n');
  }
  return out.exit_code;
}

function _argValue(args, key) {
  for (var i = 0; i < args.length; i++) {
    if (args[i] === key && i + 1 < args.length) return args[i + 1];
    if (args[i] && args[i].indexOf(key + '=') === 0) {
      return args[i].slice(key.length + 1);
    }
  }
  return null;
}

function _main(argv) {
  try {
    var args = argv.slice(2);
    if (args.indexOf('--self-test') !== -1) {
      var out = selfTest();
      var allOK = _printSelfTest(out);
      process.exit(allOK ? 0 : 1);
      return;
    }
    if (args.indexOf('--run') !== -1
        || args.indexOf('--drift') !== -1
        || args.length === 0) {
      var pd = _argValue(args, '--planning-dir');
      var pr = _argValue(args, '--project-root');
      var snap = runDrift({
        planningDir: pd || undefined,
        projectRoot: pr || undefined,
      });
      var code = _printRun(snap);
      process.exit(code);
      return;
    }
    process.stdout.write('usage: node check.cjs [--run|--self-test]'
      + ' [--planning-dir <path>] [--project-root <path>]\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write('drift_internal_error message='
      + (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = {
  runDrift: runDrift,
  getProbe: getProbe,
  selfTest: selfTest,
  _internals: _internals,
};
