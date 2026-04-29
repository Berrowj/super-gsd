#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/chaos-restart/manifest-validator.cjs
// Phase 54-01-T1: ORCHESTRATOR-CHECKPOINT.md manifest-shape validator.
//
// PURPOSE
//   Validates that an ORCHESTRATOR-CHECKPOINT.md frontmatter has the closed-vocab
//   set of REQUIRED_FIELDS populated. A checkpoint missing any of these fields
//   is a structural failure: a downstream resume would either silent-skip the
//   missing context (bad) or throw at `next_unit`/`controlling_principle`
//   destructure (worse). This validator fail-closes the gap.
//
// CONTRACT
//   validateManifest(checkpointPath) returns:
//     {
//       ok: boolean,
//       missing_fields: string[],
//       reason: 'manifest_valid' | 'manifest_missing_field' |
//               'manifest_unparseable' | 'manifest_not_found',
//       fields_seen: string[]                  // for audit
//     }
//
// REQUIRED_FIELDS (closed-vocab, frozen, 6 entries):
//   - next_unit            (the next dispatch unit description)
//   - controlling_principle (anti-stop autonomy assertion)
//   - mode                  (autonomous | interactive | etc.)
//   - emergency_halt        (boolean halt flag)
//   - session               (model+context-window identifier)
//   - created               (ISO date or YYYY-MM-DD)
//
// LOCK 13 (NEVER throws upward)
//   - File-not-found returns { ok: false, reason: 'manifest_not_found' }
//   - YAML/frontmatter parse failure returns
//     { ok: false, reason: 'manifest_unparseable', missing_fields: [] }
//   - Any other unexpected error returns
//     { ok: false, reason: 'manifest_unparseable', missing_fields: [] }
//   - The outer try/catch ensures this module NEVER throws to the caller.
//
// LOCK 11 (byte-equality on field names)
//   - Field names are matched literally (no fuzzy/normalized comparison).
//   - 'next_unit' is NOT equivalent to 'nextUnit' or 'next-unit' or 'NEXT_UNIT'.
//
// ASCII-ONLY: no smart quotes, no emoji, no non-ASCII literals anywhere.
// =============================================================================

'use strict';

const fs = require('fs');

// ---------------------------------------------------------------------------
// REQUIRED_FIELDS - the 6-entry closed-vocab set that EVERY valid checkpoint
// MUST carry. Phase 54 acceptance: validator rejects checkpoint with missing
// required field. Frozen array prevents drift; downstream callers MUST NOT
// extend this list without a new phase artifact.
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS = Object.freeze([
  'next_unit',
  'controlling_principle',
  'mode',
  'emergency_halt',
  'session',
  'created',
]);

// ---------------------------------------------------------------------------
// REASON_CODES - closed-vocab outcomes. Mirrors the chaos-restart harness
// FAIL_INJ_REASON_CODES vocabulary so the harness self-test can match these
// by byte-equality (Lock 11).
// ---------------------------------------------------------------------------
const REASON_CODES = Object.freeze([
  'manifest_valid',
  'manifest_missing_field',
  'manifest_unparseable',
  'manifest_not_found',
]);

// ---------------------------------------------------------------------------
// _parseFrontmatter - hand-rolled YAML-subset parser scoped to ORCHESTRATOR-
// CHECKPOINT.md frontmatter shape. The frontmatter is delimited by `---`
// fences; each line is `key: value` or `key: |` followed by indented block
// content. We parse:
//   - top-level keys (no nested objects beyond block scalars)
//   - bare values (string/number/boolean)
//   - block scalars (`key: |` with indented continuation)
//   - quoted strings (single or double)
//
// Lock 4 / Lock 13: zero runtime deps; never throws upward (catches via
// the outer wrapper).
// ---------------------------------------------------------------------------
function _parseFrontmatter(text) {
  if (typeof text !== 'string') {
    return { ok: false, fields: {}, reason: 'not_a_string' };
  }
  // Locate the leading `---` fence (must be on line 1 OR after a BOM).
  // Strip a possible UTF-8 BOM if present (some editors inject 0xEF 0xBB 0xBF).
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  // The fence MUST appear at column 0 of the very first line, otherwise the
  // file has no frontmatter at all -> fail-closed.
  if (text.indexOf('---') !== 0) {
    return { ok: false, fields: {}, reason: 'no_leading_fence' };
  }
  // Find the closing fence. A line beginning with `---` after at least one
  // newline counts. Use the earliest match after the opening line.
  var rest = text.slice(3);
  // skip the first newline character after the opening fence.
  if (rest.charCodeAt(0) === 0x0A) {
    rest = rest.slice(1);
  } else if (rest.charCodeAt(0) === 0x0D && rest.charCodeAt(1) === 0x0A) {
    rest = rest.slice(2);
  } else {
    // Not a well-formed fence (must end with newline) -> fail-closed.
    return { ok: false, fields: {}, reason: 'fence_not_terminated' };
  }
  // Search for `\n---` (closing fence) - LF or CRLF.
  var closeIdxLf = rest.indexOf('\n---');
  if (closeIdxLf === -1) {
    return { ok: false, fields: {}, reason: 'no_closing_fence' };
  }
  var fmText = rest.slice(0, closeIdxLf);

  // Tokenize line-by-line. Track block-scalar continuation state so a
  // `key: |` carries forward into indented lines.
  var lines = fmText.split(/\r?\n/);
  var fields = {};
  var i = 0;
  while (i < lines.length) {
    var line = lines[i];
    // Skip blank lines.
    if (line.length === 0 || /^\s*$/.test(line)) {
      i++;
      continue;
    }
    // Top-level key MUST start at column 0 (no leading space). Anything else
    // at this level is either a block-scalar continuation (handled below) or
    // a malformed line. We are strict: only column-0 lines start fields.
    if (/^\s/.test(line)) {
      // Indented line outside of block-scalar context -> ignore (some
      // checkpoints carry nested maps that we don't validate at top-level).
      i++;
      continue;
    }
    // Match `key: value` or `key:` (block-scalar opener).
    var colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }
    var key = line.slice(0, colonIdx).trim();
    var value = line.slice(colonIdx + 1).trim();
    // Validate the key looks like a YAML key (ASCII identifier with -/_).
    if (!/^[A-Za-z_][A-Za-z0-9_\-]*$/.test(key)) {
      i++;
      continue;
    }
    // Block-scalar opener: `key: |` or `key: >` followed by indented body.
    if (value === '|' || value === '>' || value === '|-' || value === '>-') {
      var bodyLines = [];
      i++;
      while (i < lines.length && (/^\s/.test(lines[i]) || lines[i].length === 0)) {
        if (lines[i].length === 0) {
          bodyLines.push('');
        } else {
          // Strip leading 2-space (or any leading) indent. We don't dedent
          // exactly per spec; the existence of body content is what matters.
          bodyLines.push(lines[i].replace(/^\s+/, ''));
        }
        i++;
      }
      fields[key] = bodyLines.join('\n').replace(/\n+$/, '');
      continue;
    }
    // Quoted string (single or double).
    if ((value.charAt(0) === '"' && value.charAt(value.length - 1) === '"' && value.length >= 2) ||
        (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'" && value.length >= 2)) {
      fields[key] = value.slice(1, value.length - 1);
      i++;
      continue;
    }
    // Bare value. Coerce common literals.
    if (value === 'true') {
      fields[key] = true;
    } else if (value === 'false') {
      fields[key] = false;
    } else if (value === 'null' || value === '~' || value === '') {
      fields[key] = null;
    } else if (/^-?[0-9]+$/.test(value)) {
      fields[key] = parseInt(value, 10);
    } else {
      fields[key] = value;
    }
    i++;
  }
  return { ok: true, fields: fields, reason: 'parsed' };
}

// ---------------------------------------------------------------------------
// validateManifest(checkpointPath)
//   Reads the file at checkpointPath, parses its frontmatter, and checks
//   that every entry in REQUIRED_FIELDS is present AND non-null. A field
//   counted as "missing" if it is absent OR explicitly null OR an empty
//   string.
//
// Returns the contract-shape object documented at module top.
// ---------------------------------------------------------------------------
function validateManifest(checkpointPath) {
  try {
    if (typeof checkpointPath !== 'string' || checkpointPath.length === 0) {
      return {
        ok: false,
        missing_fields: REQUIRED_FIELDS.slice(),
        reason: 'manifest_unparseable',
        fields_seen: [],
      };
    }
    var stat = null;
    try {
      stat = fs.statSync(checkpointPath);
    } catch (_eStat) {
      return {
        ok: false,
        missing_fields: REQUIRED_FIELDS.slice(),
        reason: 'manifest_not_found',
        fields_seen: [],
      };
    }
    if (!stat || !stat.isFile()) {
      return {
        ok: false,
        missing_fields: REQUIRED_FIELDS.slice(),
        reason: 'manifest_not_found',
        fields_seen: [],
      };
    }
    var text = '';
    try {
      text = fs.readFileSync(checkpointPath, 'utf8');
    } catch (_eRead) {
      return {
        ok: false,
        missing_fields: REQUIRED_FIELDS.slice(),
        reason: 'manifest_unparseable',
        fields_seen: [],
      };
    }
    var parsed = _parseFrontmatter(text);
    if (!parsed.ok) {
      return {
        ok: false,
        missing_fields: REQUIRED_FIELDS.slice(),
        reason: 'manifest_unparseable',
        fields_seen: [],
      };
    }
    var fields = parsed.fields || {};
    var seen = Object.keys(fields).slice().sort();
    var missing = [];
    for (var i = 0; i < REQUIRED_FIELDS.length; i++) {
      var k = REQUIRED_FIELDS[i];
      var has = Object.prototype.hasOwnProperty.call(fields, k);
      var v = fields[k];
      // Treat absent OR null OR empty-string as missing. Booleans (incl.
      // false) and numeric 0 ARE valid presences (e.g. emergency_halt:false).
      var isEmpty = !has || v === null || v === undefined ||
        (typeof v === 'string' && v.length === 0);
      if (isEmpty) {
        missing.push(k);
      }
    }
    if (missing.length === 0) {
      return {
        ok: true,
        missing_fields: [],
        reason: 'manifest_valid',
        fields_seen: seen,
      };
    }
    return {
      ok: false,
      missing_fields: missing,
      reason: 'manifest_missing_field',
      fields_seen: seen,
    };
  } catch (_e) {
    return {
      ok: false,
      missing_fields: REQUIRED_FIELDS.slice(),
      reason: 'manifest_unparseable',
      fields_seen: [],
    };
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch. Operator-runnable for narrow verification:
//   node manifest-validator.cjs <path-to-checkpoint.md>
//   node manifest-validator.cjs --self-test
// Exit 0 on valid, 1 on invalid/missing/unparseable.
// ---------------------------------------------------------------------------
function _main(argv) {
  try {
    var args = (argv || []).slice(2);
    if (args.length === 0 || args.indexOf('--help') !== -1) {
      process.stdout.write(
        'manifest-validator.cjs - ORCHESTRATOR-CHECKPOINT.md shape validator\n' +
        'Usage:\n' +
        '  node manifest-validator.cjs <path>\n' +
        '  node manifest-validator.cjs --self-test\n');
      process.exit(args.length === 0 ? 1 : 0);
      return;
    }
    if (args[0] === '--self-test') {
      // Tiny in-proc smoke test: validate the project's actual checkpoint
      // if present; otherwise emit a synthetic green sentinel.
      var path = require('path');
      var probe = path.join(__dirname, '..', '..', '..', '.planning',
                             'ORCHESTRATOR-CHECKPOINT.md');
      var r = validateManifest(probe);
      process.stdout.write('manifest-validator: probe=' + probe +
        ' ok=' + r.ok + ' reason=' + r.reason +
        ' missing=' + JSON.stringify(r.missing_fields) + '\n');
      // Self-test exits 0 even if the probe is missing - the goal is to
      // confirm the validator function is callable, not the project state.
      process.exit(0);
      return;
    }
    var result = validateManifest(args[0]);
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(result.ok ? 0 : 1);
  } catch (e) {
    process.stderr.write('manifest-validator CLI internal error: ' +
      (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = {
  REQUIRED_FIELDS: REQUIRED_FIELDS,
  REASON_CODES: REASON_CODES,
  validateManifest: validateManifest,
  _internals: {
    _parseFrontmatter: _parseFrontmatter,
  },
};
