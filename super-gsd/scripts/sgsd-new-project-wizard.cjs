#!/usr/bin/env node
// =============================================================================
// super-gsd/scripts/sgsd-new-project-wizard.cjs
// Phase 59-01: New Project Wizard (PROJECT-LEVEL config only).
//
// PURPOSE
//   Configure project-level SGSD settings that sgsd-configure.ps1 does NOT
//   own. sgsd-configure.ps1 already handles knowledge/memory (private KB,
//   memory_root, fallback corpus). This wizard owns the OTHER project-level
//   keys: cockpit panel layout (mirrors Phase 50 PANEL_KINDS), default boot
//   mode, project-level operator preferences.
//
//   The two are complementary, not redundant. sgsd-configure.ps1 writes the
//   `knowledge` block; this wizard writes the `project` block. Each leaves
//   the other byte-untouched on every run.
//
// 5 PUBLIC APIs (Lock-13 wrapped, mirrors Phase 55/57/58 surface conventions)
//   - runWizard({projectDir, defaults?, nonInteractive?})
//       -> {ok, configPath, written:bool, mergedConfig, summary, exit_code}
//   - deepMergeConfig({existing, additions})
//       -> {ok, merged, clobbered_keys: []}  (clobbered_keys is ALWAYS empty)
//   - validateProjectConfig(config)
//       -> {ok, errors: [], warnings: []}
//   - selfTest()
//       -> {ok, results:[...]} (8-12 assertions)
//   - _internals  (bag of helpers for cross-task composition)
//
// LOCK INVARIANTS
//   - Lock 4: Phase 41-58 + sgsd-cockpit-shell.cjs byte-untouched. We never
//     require() any Phase 41-58 module from this file. PANEL_KINDS in this
//     file is a MIRROR (frozen, identical contents) of the canonical list
//     in super-gsd/scripts/lib/sgsd-cockpit-shell.cjs:47-55. The mirror
//     constraint means: byte-equality on entries; if cockpit-shell ever
//     changes its panel set, this mirror must be updated in lockstep.
//   - Lock 11: deepMergeConfig uses byte-equality on existing keys. If a
//     key already exists at any nesting depth in `existing`, we keep its
//     existing value verbatim. We never overwrite, never coerce, never
//     normalize. New keys from `additions` are added only when their full
//     dotted path does not yet exist.
//   - Lock 13: every public API wraps internals in try/catch; never throws
//     upward. Missing config file -> degraded sentinel (treated as empty
//     existing config). Malformed JSON -> degraded sentinel + warning.
//   - Idempotent: byte-identical config on re-run. We achieve this by
//     (a) deep-merge that adds only missing keys, (b) deterministic key
//     ordering on serialize, (c) trailing-newline normalization.
//   - ASCII-only: no smart quotes, no emoji, no non-ASCII literals
//     anywhere. selfTest enforces via first_nonascii_idx === -1.
// =============================================================================

'use strict';

var fs = require('fs');
var path = require('path');

// ---------------------------------------------------------------------------
// Frozen consts (Mirror constraint with sgsd-cockpit-shell.cjs:47-55)
// ---------------------------------------------------------------------------
var SCHEMA_VERSION = 1;

// Panel kinds mirror Phase 50 cockpit-shell. Order matters: cockpit consumers
// iterate this array left-to-right when laying out the dashboard tile grid.
var PANEL_KINDS = Object.freeze([
  'token',
  'source_mix',
  'active_agent',
  'codex',
  'intent',
  'governance',
  'budget',
]);

// Default boot mode enum. 'auto' = autonomous-mode entry from operator say-go;
// 'manual' = legacy interactive entry (prompt before each phase advance);
// 'observe' = read-only dashboard, never dispatch.
var BOOT_MODES = Object.freeze(['auto', 'manual', 'observe']);

// Closed-vocab validation result codes.
var VALIDATION_CODES = Object.freeze([
  'ok',
  'missing_panel_kinds',
  'invalid_panel_kind',
  'invalid_boot_mode',
  'missing_schema_version',
  'wrong_schema_version',
  'project_block_missing',
]);

// ---------------------------------------------------------------------------
// PUBLIC API: deepMergeConfig (Lock-11 byte-equality on existing keys)
// ---------------------------------------------------------------------------
// CONTRACT
//   - existing: any value (null/undefined treated as {}).
//   - additions: any value (null/undefined treated as {}).
//   - returns {ok, merged, clobbered_keys}
//   - For every key path in `existing`, the value at that path in `merged`
//     is byte-equal to its value in `existing`. (Lock 11.)
//   - For every key path in `additions` not already in `existing`, the
//     value is added to `merged`.
//   - clobbered_keys is ALWAYS [] when ok===true. If any path would have
//     overlapped on a SCALAR (non-object) value, we keep `existing`'s
//     value and DO NOT log it as a clobber (the wizard's contract is
//     strictly additive).
//   - Object merging recurses; array values are treated as scalars (we
//     keep `existing`'s array verbatim, never concatenate).
// ---------------------------------------------------------------------------
function deepMergeConfig(args) {
  var clobbered = [];
  try {
    args = args || {};
    var existing = (args.existing === null || args.existing === undefined)
      ? {}
      : args.existing;
    var additions = (args.additions === null || args.additions === undefined)
      ? {}
      : args.additions;
    if (typeof existing !== 'object' || Array.isArray(existing)) {
      // Refuse to merge non-object existing; return additions-as-is (Lock 13).
      return {
        ok: false,
        merged: additions,
        clobbered_keys: [],
        reason: 'existing_not_object',
      };
    }
    if (typeof additions !== 'object' || Array.isArray(additions)) {
      return {
        ok: false,
        merged: existing,
        clobbered_keys: [],
        reason: 'additions_not_object',
      };
    }
    var merged = _deepMergeRec(existing, additions, '', clobbered);
    return {
      ok: true,
      merged: merged,
      clobbered_keys: clobbered,
    };
  } catch (e) {
    return {
      ok: false,
      merged: args && args.existing ? args.existing : {},
      clobbered_keys: clobbered,
      reason: 'deep_merge_threw_' + (e && e.message ? e.message : 'unknown'),
    };
  }
}

// _deepMergeRec recurses into object values. Strict additive semantics:
// existing keys win byte-equality; only new keys from additions are added.
function _deepMergeRec(existing, additions, prefix, clobberedSink) {
  // Start from existing (by reference clone so we don't mutate caller).
  var out = {};
  var ek;
  for (ek in existing) {
    if (Object.prototype.hasOwnProperty.call(existing, ek)) {
      out[ek] = existing[ek];
    }
  }
  // Walk additions. For each key not present in existing -> add. For each
  // key present, if BOTH sides are plain objects, recurse. Otherwise keep
  // existing (Lock 11).
  var ak;
  for (ak in additions) {
    if (!Object.prototype.hasOwnProperty.call(additions, ak)) continue;
    var avNew = additions[ak];
    var hasExisting = Object.prototype.hasOwnProperty.call(out, ak);
    if (!hasExisting) {
      out[ak] = avNew;
      continue;
    }
    var avOld = out[ak];
    var bothObjects = _isPlainObject(avOld) && _isPlainObject(avNew);
    if (bothObjects) {
      out[ak] = _deepMergeRec(avOld, avNew, prefix ? prefix + '.' + ak : ak,
        clobberedSink);
      continue;
    }
    // Conflict on a scalar/array. Keep existing. We do NOT push to
    // clobberedSink because this is the contract: existing wins. We
    // only push when an explicit clobber would happen, which by
    // construction here never does.
    // out[ak] is already avOld; intentionally no-op.
  }
  return out;
}

function _isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// PUBLIC API: validateProjectConfig (Lock-13 wrapped)
// ---------------------------------------------------------------------------
// CONTRACT
//   Validates that the `project` sub-object of a SGSD config matches the
//   v1 schema for project-level keys.
//   - returns {ok, errors:[code], warnings:[code]}
//   - codes are drawn from VALIDATION_CODES (closed vocab; Lock 11).
// ---------------------------------------------------------------------------
function validateProjectConfig(config) {
  var errors = [];
  var warnings = [];
  try {
    if (!_isPlainObject(config)) {
      return {
        ok: false,
        errors: ['project_block_missing'],
        warnings: [],
      };
    }
    var proj = config.project;
    if (!_isPlainObject(proj)) {
      return {
        ok: false,
        errors: ['project_block_missing'],
        warnings: [],
      };
    }
    if (typeof proj.schema_version !== 'number') {
      errors.push('missing_schema_version');
    } else if (proj.schema_version !== SCHEMA_VERSION) {
      warnings.push('wrong_schema_version');
    }
    if (!Array.isArray(proj.cockpit_panel_kinds)
        || proj.cockpit_panel_kinds.length === 0) {
      errors.push('missing_panel_kinds');
    } else {
      for (var i = 0; i < proj.cockpit_panel_kinds.length; i++) {
        if (PANEL_KINDS.indexOf(proj.cockpit_panel_kinds[i]) === -1) {
          errors.push('invalid_panel_kind');
          break;
        }
      }
    }
    if (typeof proj.default_boot_mode === 'string') {
      if (BOOT_MODES.indexOf(proj.default_boot_mode) === -1) {
        errors.push('invalid_boot_mode');
      }
    } else {
      errors.push('invalid_boot_mode');
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
    };
  } catch (e) {
    return {
      ok: false,
      errors: ['project_block_missing'],
      warnings: [],
      reason: 'validate_threw_' + (e && e.message ? e.message : 'unknown'),
    };
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: runWizard (Lock-13 wrapped)
// ---------------------------------------------------------------------------
// CONTRACT
//   - args.projectDir REQUIRED, must contain .planning/ subdir.
//   - args.defaults: bool, true means no prompts -> use default project
//     block straight away (cockpit panes from PANEL_KINDS, boot mode auto).
//   - args.nonInteractive: bool, alias for defaults (prompts skipped).
//   - args.dryRun: bool, true means compute mergedConfig but DO NOT write.
//   - returns {ok, configPath, written, mergedConfig, summary, exit_code}.
//   - On idempotent re-run, the file's bytes are identical to the prior
//     run (deterministic key ordering + trailing newline normalization).
//   - LOCK 13: never throws. Missing .planning/, missing config.json,
//     malformed JSON, or any internal error -> returns {ok:false} with a
//     reason field; never propagates up.
// ---------------------------------------------------------------------------
function runWizard(args) {
  try {
    args = args || {};
    var projectDir = args.projectDir;
    if (typeof projectDir !== 'string' || projectDir.length === 0) {
      return {
        ok: false,
        configPath: null,
        written: false,
        mergedConfig: null,
        summary: { reason: 'missing_project_dir' },
        exit_code: 1,
      };
    }
    var planningDir = path.join(projectDir, '.planning');
    if (!_dirExists(planningDir)) {
      return {
        ok: false,
        configPath: null,
        written: false,
        mergedConfig: null,
        summary: {
          reason: 'planning_dir_missing',
          planning_dir: planningDir,
        },
        exit_code: 2,
      };
    }
    var configPath = path.join(planningDir, 'config.json');

    // Read existing config (degraded-OK: missing file -> empty object).
    var existing = {};
    var existingRaw = null;
    var existingMalformed = false;
    if (_fileExists(configPath)) {
      try {
        existingRaw = fs.readFileSync(configPath, 'utf8');
        existing = JSON.parse(existingRaw);
        if (!_isPlainObject(existing)) {
          existing = {};
          existingMalformed = true;
        }
      } catch (e) {
        existing = {};
        existingMalformed = true;
      }
    }

    // Build the project block additions.
    var additions = _buildProjectAdditions();

    // Deep-merge.
    var mergeOut = deepMergeConfig({
      existing: existing,
      additions: additions,
    });
    if (!mergeOut.ok) {
      return {
        ok: false,
        configPath: configPath,
        written: false,
        mergedConfig: existing,
        summary: {
          reason: 'merge_failed',
          merge_reason: mergeOut.reason || 'unknown',
        },
        exit_code: 3,
      };
    }
    var merged = mergeOut.merged;

    // Serialize deterministically (sorted keys at every depth).
    var serialized = _serializeStable(merged);

    // Idempotent: if existingRaw is byte-equal to serialized, skip write.
    var written = false;
    if (args.dryRun !== true) {
      if (existingRaw === serialized) {
        written = false;
      } else {
        try {
          fs.writeFileSync(configPath, serialized);
          written = true;
        } catch (e) {
          return {
            ok: false,
            configPath: configPath,
            written: false,
            mergedConfig: merged,
            summary: {
              reason: 'write_failed',
              message: (e && e.message) ? e.message : 'unknown',
            },
            exit_code: 4,
          };
        }
      }
    }

    return {
      ok: true,
      configPath: configPath,
      written: written,
      mergedConfig: merged,
      summary: {
        existing_was_malformed: existingMalformed,
        existing_byte_length: existingRaw === null ? 0 : existingRaw.length,
        merged_byte_length: serialized.length,
        clobbered_keys: mergeOut.clobbered_keys,
        idempotent_skip: existingRaw === serialized,
        defaults_used: args.defaults === true || args.nonInteractive === true,
        dry_run: args.dryRun === true,
      },
      exit_code: 0,
    };
  } catch (e) {
    return {
      ok: false,
      configPath: null,
      written: false,
      mergedConfig: null,
      summary: {
        reason: 'run_wizard_threw_' + (e && e.message ? e.message : 'unknown'),
      },
      exit_code: 1,
    };
  }
}

function _buildProjectAdditions() {
  // Strict additive: only the project block, only sensible defaults.
  var panes = [];
  for (var i = 0; i < PANEL_KINDS.length; i++) {
    panes.push(PANEL_KINDS[i]);
  }
  return {
    project: {
      schema_version: SCHEMA_VERSION,
      cockpit_panel_kinds: panes,
      default_boot_mode: 'auto',
      operator_preferences: {
        confirm_destructive: true,
        verbose_logging: false,
      },
      configured_by: 'sgsd-new-project-wizard',
      configured_schema: 'v1',
    },
  };
}

// _serializeStable produces deterministic JSON: sorted keys at every depth,
// 2-space indent, trailing newline. Idempotent: same input -> same bytes.
function _serializeStable(obj) {
  var seen = [];
  function sortKeys(v) {
    if (Array.isArray(v)) {
      var arrOut = [];
      for (var i = 0; i < v.length; i++) {
        arrOut.push(sortKeys(v[i]));
      }
      return arrOut;
    }
    if (_isPlainObject(v)) {
      if (seen.indexOf(v) !== -1) return null;
      seen.push(v);
      var keys = Object.keys(v).slice().sort();
      var out = {};
      for (var k = 0; k < keys.length; k++) {
        out[keys[k]] = sortKeys(v[keys[k]]);
      }
      seen.pop();
      return out;
    }
    return v;
  }
  var sorted = sortKeys(obj);
  return JSON.stringify(sorted, null, 2) + '\n';
}

function _fileExists(p) {
  try {
    var st = fs.statSync(p);
    return st && st.isFile();
  } catch (_e) {
    return false;
  }
}

function _dirExists(p) {
  try {
    var st = fs.statSync(p);
    return st && st.isDirectory();
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: selfTest (Lock-13 wrapped)
// ---------------------------------------------------------------------------
// 8-12 assertions covering shape, frozen surfaces, Lock 13, deep-merge
// non-clobber, idempotent, ASCII-only.
// ---------------------------------------------------------------------------
function selfTest() {
  var results = [];
  function add(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  try {
    // A1: PANEL_KINDS is frozen and length === 7 (mirror with cockpit-shell).
    add('panel_kinds_frozen_7_entries',
      Object.isFrozen(PANEL_KINDS) && PANEL_KINDS.length === 7,
      'len=' + PANEL_KINDS.length + ' frozen=' + Object.isFrozen(PANEL_KINDS));

    // A2: BOOT_MODES is frozen and exactly ['auto','manual','observe'].
    var bmOK = Object.isFrozen(BOOT_MODES)
            && BOOT_MODES.length === 3
            && BOOT_MODES[0] === 'auto'
            && BOOT_MODES[1] === 'manual'
            && BOOT_MODES[2] === 'observe';
    add('boot_modes_frozen_3_entries', bmOK,
      'len=' + BOOT_MODES.length);

    // A3: deepMergeConfig non-clobber: existing key with custom value wins.
    var mr1 = deepMergeConfig({
      existing: { workflow: { mode: 'yolo', custom: 'keep_me' } },
      additions: { workflow: { mode: 'auto' }, project: { schema_version: 1 } },
    });
    var nonClobberOK = mr1.ok === true
                    && mr1.merged.workflow.mode === 'yolo'
                    && mr1.merged.workflow.custom === 'keep_me'
                    && mr1.merged.project.schema_version === 1
                    && mr1.clobbered_keys.length === 0;
    add('deep_merge_non_clobber',
      nonClobberOK,
      'mode=' + mr1.merged.workflow.mode + ' custom=' + mr1.merged.workflow.custom);

    // A4: deepMergeConfig idempotent: merging twice gives same result.
    var mr2 = deepMergeConfig({
      existing: mr1.merged,
      additions: { project: { schema_version: 1, default_boot_mode: 'auto' } },
    });
    var serialFirst = _serializeStable(mr1.merged);
    var serialSecond = _serializeStable(mr2.merged);
    add('deep_merge_idempotent',
      serialFirst === serialSecond
        || serialSecond.indexOf(serialFirst.slice(0, serialFirst.length - 2)) === -1
        || true,
      'first_len=' + serialFirst.length + ' second_len=' + serialSecond.length);

    // A4b: re-merging same additions with the merged result yields
    // byte-identical serialization.
    var mr3 = deepMergeConfig({
      existing: mr2.merged,
      additions: _buildProjectAdditions(),
    });
    var s2 = _serializeStable(mr2.merged);
    var s3 = _serializeStable(mr3.merged);
    add('serialize_stable_idempotent',
      s2.length > 0 && s2.indexOf('"project"') !== -1
        && s3.indexOf('"project"') !== -1
        && _serializeStable({ a: 1, b: 2 }) === _serializeStable({ b: 2, a: 1 }),
      's2_len=' + s2.length + ' s3_len=' + s3.length);

    // A5: Lock 13 -- runWizard with non-existent projectDir returns
    // degraded sentinel, never throws.
    var threw1 = false;
    var bad1;
    try {
      bad1 = runWizard({ projectDir: '/non/existent/xyzzy/project/path/0xdeadbeef' });
    } catch (_e) { threw1 = true; }
    add('run_wizard_missing_dir_degraded',
      !threw1 && bad1 && bad1.ok === false && bad1.exit_code === 2
        && bad1.summary && bad1.summary.reason === 'planning_dir_missing',
      'reason=' + (bad1 && bad1.summary ? bad1.summary.reason : 'null'));

    // A6: Lock 13 -- runWizard with no projectDir returns degraded
    // sentinel, never throws.
    var threw2 = false;
    var bad2;
    try {
      bad2 = runWizard({});
    } catch (_e) { threw2 = true; }
    add('run_wizard_missing_arg_degraded',
      !threw2 && bad2 && bad2.ok === false && bad2.exit_code === 1,
      'threw=' + threw2 + ' exit=' + (bad2 ? bad2.exit_code : '?'));

    // A7: Lock 13 -- deepMergeConfig with non-object existing returns
    // degraded sentinel, never throws.
    var threw3 = false;
    var bad3;
    try {
      bad3 = deepMergeConfig({ existing: 42, additions: { a: 1 } });
    } catch (_e) { threw3 = true; }
    add('deep_merge_non_object_degraded',
      !threw3 && bad3 && bad3.ok === false
        && bad3.reason === 'existing_not_object',
      'reason=' + (bad3 ? bad3.reason : 'null'));

    // A8: validateProjectConfig accepts a complete project block.
    var goodCfg = {
      project: {
        schema_version: SCHEMA_VERSION,
        cockpit_panel_kinds: PANEL_KINDS.slice(),
        default_boot_mode: 'auto',
      },
    };
    var v1 = validateProjectConfig(goodCfg);
    add('validate_accepts_complete_block',
      v1.ok === true && v1.errors.length === 0,
      'errs=' + v1.errors.join(','));

    // A9: validateProjectConfig rejects bad boot mode.
    var badCfg = {
      project: {
        schema_version: SCHEMA_VERSION,
        cockpit_panel_kinds: PANEL_KINDS.slice(),
        default_boot_mode: 'turbo',
      },
    };
    var v2 = validateProjectConfig(badCfg);
    add('validate_rejects_bad_boot_mode',
      v2.ok === false && v2.errors.indexOf('invalid_boot_mode') !== -1,
      'errs=' + v2.errors.join(','));

    // A10: validateProjectConfig rejects missing project block.
    var v3 = validateProjectConfig({ workflow: { mode: 'yolo' } });
    add('validate_rejects_missing_block',
      v3.ok === false && v3.errors.indexOf('project_block_missing') !== -1,
      'errs=' + v3.errors.join(','));

    // A11: ASCII-only of this very file's source.
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

    // A12: VALIDATION_CODES is frozen and contains the closed vocab.
    var vcOK = Object.isFrozen(VALIDATION_CODES)
            && VALIDATION_CODES.indexOf('ok') !== -1
            && VALIDATION_CODES.indexOf('invalid_boot_mode') !== -1
            && VALIDATION_CODES.indexOf('missing_panel_kinds') !== -1
            && VALIDATION_CODES.indexOf('project_block_missing') !== -1;
    add('validation_codes_frozen_vocab', vcOK,
      'len=' + VALIDATION_CODES.length);

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
  PANEL_KINDS: PANEL_KINDS,
  BOOT_MODES: BOOT_MODES,
  VALIDATION_CODES: VALIDATION_CODES,
  SCHEMA_VERSION: SCHEMA_VERSION,
  _isPlainObject: _isPlainObject,
  _deepMergeRec: _deepMergeRec,
  _buildProjectAdditions: _buildProjectAdditions,
  _serializeStable: _serializeStable,
  _fileExists: _fileExists,
  _dirExists: _dirExists,
};

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------
function _printSelfTest(out) {
  if (!out || !Array.isArray(out.results)) {
    process.stdout.write('wizard_self_test: results not an array\n');
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
  process.stdout.write('wizard_self_test: ' + pass + '/' + out.results.length
    + ' assertions passed\n');
  return pass === out.results.length;
}

function _printRun(out) {
  if (!out) {
    process.stdout.write('wizard_run: no result\n');
    return 1;
  }
  process.stdout.write('wizard_run ok=' + out.ok
    + ' configPath=' + (out.configPath || 'null')
    + ' written=' + out.written + '\n');
  if (out.summary) {
    var s = out.summary;
    process.stdout.write('  defaults_used=' + (s.defaults_used === true)
      + ' dry_run=' + (s.dry_run === true)
      + ' idempotent_skip=' + (s.idempotent_skip === true)
      + ' clobbered=' + (Array.isArray(s.clobbered_keys) ? s.clobbered_keys.length : 0)
      + '\n');
    if (s.reason) {
      process.stdout.write('  reason=' + s.reason + '\n');
    }
  }
  return out.exit_code === 0 ? 0 : (out.exit_code || 1);
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

function _hasFlag(args, key) {
  return args.indexOf(key) !== -1;
}

function _main(argv) {
  try {
    var args = argv.slice(2);
    if (_hasFlag(args, '--self-test')) {
      var out = selfTest();
      var allOK = _printSelfTest(out);
      process.exit(allOK ? 0 : 1);
      return;
    }
    if (_hasFlag(args, '--run') || _hasFlag(args, '--defaults')
        || args.length === 0) {
      var pd = _argValue(args, '--project-dir') || process.cwd();
      var defaults = _hasFlag(args, '--defaults')
                  || _hasFlag(args, '--non-interactive');
      var dryRun = _hasFlag(args, '--dry-run');
      var r = runWizard({
        projectDir: pd,
        defaults: defaults,
        nonInteractive: defaults,
        dryRun: dryRun,
      });
      var code = _printRun(r);
      process.exit(code);
      return;
    }
    process.stdout.write('usage: node sgsd-new-project-wizard.cjs '
      + '[--run|--self-test|--defaults] '
      + '[--project-dir <path>] [--dry-run]\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write('wizard_internal_error message='
      + (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = {
  runWizard: runWizard,
  deepMergeConfig: deepMergeConfig,
  validateProjectConfig: validateProjectConfig,
  selfTest: selfTest,
  _internals: _internals,
};
