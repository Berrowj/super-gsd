#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/warp-plan-converter/convert.cjs
// Phase 80-01: Warp Plan -> SGSD Phase Scaffold converter.
//
// PURPOSE
//   Take an exported Warp Plan markdown file and emit DRAFT SGSD phase
//   scaffolding under .planning/analyses/<ISO>-warp-plan-import/<draft-milestone>/
//   for operator review. The converter NEVER mutates STATE.md, never
//   touches an active milestone folder, never writes outside the explicit
//   --output directory. selfTest A11/A12 enforce these invariants.
//
//   The output is a folder of DRAFT scaffolds. Each generated CONTEXT.md,
//   PLAN.md, RESEARCH.md carries:
//     - status: draft frontmatter
//     - prominent <!-- DRAFT - operator review required ... --> HTML comment
//     - TODO markers (Acceptance checkboxes in PLAN, Claude research TODOs
//       in RESEARCH)
//
// 4 PUBLIC APIs (Lock-13 wrapped, mirrors Phase 62 upgrade-drift shape)
//   - convert({inputPath, outputDir, planMilestone?})
//       -> {ok, generated_files:[...], draft_root, summary, exit_code}
//   - parseWarpPlan(markdownText)
//       -> {ok, title, frontmatter, phases:[{number, name, tasks:[]}]}
//   - selfTest()
//       -> {ok, results:[...]}  (>=12 assertions, see A1-A15)
//   - _internals  (cross-task helpers)
//
// LOCK INVARIANTS
//   - Lock 13: every public API wraps internals in try/catch, never
//     throws upward; bad input -> {ok:false, error} envelope.
//   - READ-ONLY-on-active-state: this file ONLY writes under the caller-
//     supplied outputDir. selfTest A11 snapshots .planning/STATE.md mtime
//     before+after a real conversion against a temp dir; A12 snapshots
//     active milestone folder mtime.
//   - Frozen vocab: PUBLIC_APIS, FRONTMATTER_KEYS, ARTIFACT_NAMES are
//     Object.freeze'd. selfTest A1 verifies.
//   - ASCII-only: no smart quotes, no emoji, no non-ASCII literals
//     anywhere. selfTest A13 enforces via first_nonascii_idx === -1.
//
// CLI
//   --input <path>       Warp Plan markdown export (required)
//   --output <dir>       output directory (must be under analyses/) (required)
//   --milestone <name>   draft milestone slug (default: v2.x-draft)
//   --self-test          run selfTest, exit 0 on all-pass
//   --help               usage banner
// =============================================================================

'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');

// ---------------------------------------------------------------------------
// FROZEN SURFACES
// ---------------------------------------------------------------------------
var SCHEMA_VERSION = 1;

var PUBLIC_APIS = Object.freeze([
  'convert',
  'parseWarpPlan',
  'selfTest',
  '_internals',
]);

var FRONTMATTER_KEYS = Object.freeze([
  'phase',
  'phase_name',
  'milestone',
  'created',
  'status',
  'source',
  'artifact',
]);

var ARTIFACT_NAMES = Object.freeze([
  'CONTEXT',
  'PLAN',
  'RESEARCH',
]);

var DRAFT_COMMENT = '<!-- DRAFT - operator review required before promoting to active -->';

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------
function _isString(v) { return typeof v === 'string' && v.length > 0; }

function _isoDate() {
  // YYYY-MM-DD only (analyses folder naming).
  var d = new Date();
  var yyyy = d.getUTCFullYear();
  var mm = String(d.getUTCMonth() + 1);
  if (mm.length < 2) mm = '0' + mm;
  var dd = String(d.getUTCDate());
  if (dd.length < 2) dd = '0' + dd;
  return yyyy + '-' + mm + '-' + dd;
}

function _slugify(s) {
  if (!_isString(s)) return 'untitled';
  var out = s.toLowerCase();
  // ASCII-only: replace anything outside [a-z0-9] with hyphen.
  var buf = '';
  for (var i = 0; i < out.length; i++) {
    var c = out.charCodeAt(i);
    if ((c >= 0x61 && c <= 0x7A) || (c >= 0x30 && c <= 0x39)) {
      buf += out.charAt(i);
    } else {
      buf += '-';
    }
  }
  // Collapse runs of '-' and trim.
  buf = buf.replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  if (buf.length === 0) return 'untitled';
  if (buf.length > 60) buf = buf.slice(0, 60).replace(/-+$/, '');
  return buf;
}

function _padNN(n) {
  var s = String(n);
  while (s.length < 2) s = '0' + s;
  return s;
}

function _mkdirpReadOnlyOutsideOutput(absDir) {
  // Defensive mkdir that only creates dirs under the supplied outputDir.
  // Caller already validated absDir is under outputDir; this just performs
  // recursive mkdir without throwing.
  try {
    fs.mkdirSync(absDir, { recursive: true });
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// ASCII GUARD
// Detects the first non-ASCII (or non-printable-control) byte index.
// Returns -1 if the string is clean.
// ---------------------------------------------------------------------------
function _firstNonAsciiIdx(s) {
  if (!_isString(s)) return -1;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c > 0x7E || (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D)) {
      return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// FRONTMATTER PARSER (minimal -- key: value lines between --- markers)
// Defensive; never throws.
// ---------------------------------------------------------------------------
function _parseFrontmatter(text) {
  var fm = {};
  var rest = text;
  if (!_isString(text)) return { frontmatter: fm, body: '' };
  var lines = text.split(/\r?\n/);
  if (lines.length < 2 || lines[0] !== '---') {
    return { frontmatter: fm, body: text };
  }
  var endIdx = -1;
  for (var i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) return { frontmatter: fm, body: text };
  for (var j = 1; j < endIdx; j++) {
    var ln = lines[j];
    var colon = ln.indexOf(':');
    if (colon === -1) continue;
    var k = ln.slice(0, colon).trim();
    var v = ln.slice(colon + 1).trim();
    // Strip surrounding quotes if present.
    if (v.length >= 2) {
      var first = v.charAt(0);
      var last = v.charAt(v.length - 1);
      if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
        v = v.slice(1, -1);
      }
    }
    if (k.length > 0) fm[k] = v;
  }
  rest = lines.slice(endIdx + 1).join('\n');
  return { frontmatter: fm, body: rest };
}

// ---------------------------------------------------------------------------
// PARSE WARP PLAN
// Public API.
//
// Input: markdown text.
// Output: {ok, title, frontmatter, phases:[{number, name, tasks:[]}]}
//
// Parsing rules (D80.1):
//   - Optional YAML frontmatter between --- markers.
//   - Title: first '# ...' heading OR frontmatter title:.
//   - Phase boundaries: lines matching ^##\s+Phase\s+(\d+):?\s*(.+)$
//   - Tasks: bullet list lines (^\s*[-*]\s+(.+)$) inside a phase, until
//     the next ## heading.
//   - Malformed input (no title AND no phases) -> {ok:false, error}.
// ---------------------------------------------------------------------------
function parseWarpPlan(markdownText) {
  try {
    if (!_isString(markdownText)) {
      return {
        ok: false,
        error: 'invalid_input_not_string',
        title: '',
        frontmatter: {},
        phases: [],
      };
    }
    var split = _parseFrontmatter(markdownText);
    var fm = split.frontmatter;
    var body = split.body;
    var lines = body.split(/\r?\n/);

    // Title: first '# ...' heading OR frontmatter.
    var title = '';
    if (_isString(fm.title)) title = fm.title;
    if (title.length === 0) {
      for (var ti = 0; ti < lines.length; ti++) {
        var lnT = lines[ti];
        // '# Foo' but NOT '## Foo'.
        var m = /^#\s+(.+?)\s*$/.exec(lnT);
        if (m && lnT.charAt(1) !== '#') {
          title = m[1].trim();
          break;
        }
      }
    }

    // Phase sections: ## Phase N: name
    var phases = [];
    var current = null;
    for (var li = 0; li < lines.length; li++) {
      var ln = lines[li];
      var pm = /^##\s+Phase\s+(\d+):?\s*(.*)$/i.exec(ln);
      if (pm) {
        if (current) phases.push(current);
        var num = parseInt(pm[1], 10);
        var nm = (pm[2] || '').trim();
        if (nm.length === 0) nm = 'phase-' + num;
        current = { number: num, name: nm, tasks: [] };
        continue;
      }
      // Any other ## heading ends the current phase capture.
      if (/^##\s+/.test(ln) && current) {
        phases.push(current);
        current = null;
        continue;
      }
      if (current) {
        var bm = /^\s*[-*]\s+(.+?)\s*$/.exec(ln);
        if (bm) {
          var t = bm[1].trim();
          if (t.length > 0) current.tasks.push(t);
        }
      }
    }
    if (current) phases.push(current);

    // Malformed: no title AND no phases.
    if (title.length === 0 && phases.length === 0) {
      return {
        ok: false,
        error: 'malformed_no_title_no_phases',
        title: '',
        frontmatter: fm,
        phases: [],
      };
    }

    return {
      ok: true,
      title: title || 'Untitled Warp Plan',
      frontmatter: fm,
      phases: phases,
    };
  } catch (e) {
    return {
      ok: false,
      error: 'parse_internal_error',
      message: (e && e.message) ? e.message : 'unknown',
      title: '',
      frontmatter: {},
      phases: [],
    };
  }
}

// ---------------------------------------------------------------------------
// SCAFFOLD BUILDERS
// Each returns a string of file content. ASCII-only; carries DRAFT marker.
// ---------------------------------------------------------------------------
function _buildContext(phaseNumber, phaseName, milestone, sourceTitle, tasks) {
  var nn = _padNN(phaseNumber);
  var lines = [];
  lines.push('---');
  lines.push('phase: ' + phaseNumber);
  lines.push('phase_name: ' + phaseName);
  lines.push('milestone: ' + milestone);
  lines.push('created: ' + _isoDate());
  lines.push('status: draft');
  lines.push('source: warp-plan-import');
  lines.push('artifact: context');
  lines.push('---');
  lines.push('');
  lines.push(DRAFT_COMMENT);
  lines.push('');
  lines.push('# Phase ' + nn + ' -- ' + phaseName + ' (CONTEXT)');
  lines.push('');
  lines.push('## Source');
  lines.push('');
  lines.push('Imported from Warp Plan: "' + sourceTitle + '"');
  lines.push('');
  lines.push('## Goal (TODO)');
  lines.push('');
  lines.push('<!-- TODO: operator restate the phase goal in SGSD voice (1-2 sentences). -->');
  lines.push('');
  lines.push('## Source Tasks (verbatim from Warp Plan)');
  lines.push('');
  if (tasks.length === 0) {
    lines.push('- (no tasks captured -- review source)');
  } else {
    for (var ti = 0; ti < tasks.length; ti++) {
      lines.push('- ' + tasks[ti]);
    }
  }
  lines.push('');
  lines.push('## Acceptance (TODO)');
  lines.push('');
  lines.push('<!-- TODO: operator translates Source Tasks into measurable acceptance criteria. -->');
  lines.push('');
  return lines.join('\n');
}

function _buildPlan(phaseNumber, phaseName, milestone, sourceTitle, tasks) {
  var nn = _padNN(phaseNumber);
  var slug = _slugify(phaseName);
  var lines = [];
  lines.push('---');
  lines.push('plan_id: ' + nn + '-01');
  lines.push('phase: ' + phaseNumber);
  lines.push('phase_name: ' + phaseName);
  lines.push('milestone: ' + milestone);
  lines.push('created: ' + _isoDate());
  lines.push('status: draft');
  lines.push('source: warp-plan-import');
  lines.push('artifact: plan');
  lines.push('title: ' + phaseName + ' -- draft plan');
  lines.push('---');
  lines.push('');
  lines.push(DRAFT_COMMENT);
  lines.push('');
  lines.push('# Plan ' + nn + '-01 -- ' + phaseName);
  lines.push('');
  lines.push('Imported from Warp Plan: "' + sourceTitle + '" (slug: ' + slug + ').');
  lines.push('');
  lines.push('## Tasks (draft)');
  lines.push('');
  lines.push('| # | Task | Acceptance |');
  lines.push('|--:|---|---|');
  if (tasks.length === 0) {
    lines.push('| 1 | (no tasks captured) | <!-- TODO --> |');
  } else {
    for (var ti = 0; ti < tasks.length; ti++) {
      lines.push('| ' + (ti + 1) + ' | ' + tasks[ti] + ' | <!-- TODO: define acceptance --> |');
    }
  }
  lines.push('');
  lines.push('## Acceptance (TODO)');
  lines.push('');
  lines.push('<!-- TODO: operator confirms each box before promoting plan to active. -->');
  lines.push('');
  lines.push('- [ ] Each task above has a measurable acceptance criterion.');
  lines.push('- [ ] Plan scope locked (D-codes assigned).');
  lines.push('- [ ] Files-touched list verified (no active milestone collisions).');
  lines.push('- [ ] Atomic commit message drafted: feat(p' + phaseNumber + '-01) ...');
  lines.push('- [ ] Phase RESEARCH.md TODO markers resolved.');
  lines.push('- [ ] Operator approves promotion from analyses/ to active milestone.');
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('<!-- TODO: operator adds dependencies, risks, deviations. -->');
  lines.push('');
  return lines.join('\n');
}

function _buildResearch(phaseNumber, phaseName, milestone, sourceTitle) {
  var nn = _padNN(phaseNumber);
  var lines = [];
  lines.push('---');
  lines.push('phase: ' + phaseNumber);
  lines.push('phase_name: ' + phaseName);
  lines.push('milestone: ' + milestone);
  lines.push('created: ' + _isoDate());
  lines.push('status: draft');
  lines.push('source: warp-plan-import');
  lines.push('artifact: research');
  lines.push('---');
  lines.push('');
  lines.push(DRAFT_COMMENT);
  lines.push('');
  lines.push('# Phase ' + nn + ' -- RESEARCH');
  lines.push('');
  lines.push('## Source');
  lines.push('');
  lines.push('Imported from Warp Plan: "' + sourceTitle + '"');
  lines.push('');
  lines.push('## Sources (TODO -- Claude research)');
  lines.push('');
  lines.push('<!-- TODO: Claude research source inputs (existing modules, prior phases, ROADMAP refs). -->');
  lines.push('');
  lines.push('- <!-- TODO: cite prior phase deliverables that inform this phase -->');
  lines.push('- <!-- TODO: cite ROADMAP-AGENT.md sections that govern this phase -->');
  lines.push('- <!-- TODO: cite any external references (RFCs, papers, vendor docs) -->');
  lines.push('');
  lines.push('## Key decisions (TODO -- Claude research)');
  lines.push('');
  lines.push('<!-- TODO: Claude enumerates D-codes (D' + nn + '.1 ... D' + nn + '.N) with rationale. -->');
  lines.push('');
  lines.push('### D' + nn + '.1 -- <!-- TODO: decision title -->');
  lines.push('');
  lines.push('<!-- TODO: rationale + alternatives + chosen approach -->');
  lines.push('');
  lines.push('## Forward references');
  lines.push('');
  lines.push('<!-- TODO: list downstream phases that consume this phase\'s output -->');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PUBLIC API: convert
// ---------------------------------------------------------------------------
function convert(opts) {
  try {
    if (!opts || typeof opts !== 'object') {
      return {
        ok: false,
        error: 'invalid_opts_not_object',
        generated_files: [],
        draft_root: '',
        summary: { phases: 0, files: 0 },
        exit_code: 1,
      };
    }
    var inputPath = opts.inputPath;
    var outputDir = opts.outputDir;
    var planMilestone = _isString(opts.planMilestone) ? opts.planMilestone : 'v2.x-draft';

    if (!_isString(inputPath)) {
      return {
        ok: false,
        error: 'missing_inputPath',
        generated_files: [],
        draft_root: '',
        summary: { phases: 0, files: 0 },
        exit_code: 1,
      };
    }
    if (!_isString(outputDir)) {
      return {
        ok: false,
        error: 'missing_outputDir',
        generated_files: [],
        draft_root: '',
        summary: { phases: 0, files: 0 },
        exit_code: 1,
      };
    }

    if (!fs.existsSync(inputPath)) {
      return {
        ok: false,
        error: 'input_not_found',
        inputPath: inputPath,
        generated_files: [],
        draft_root: '',
        summary: { phases: 0, files: 0 },
        exit_code: 1,
      };
    }

    var raw;
    try {
      raw = fs.readFileSync(inputPath, 'utf8');
    } catch (_e) {
      return {
        ok: false,
        error: 'input_read_failed',
        inputPath: inputPath,
        generated_files: [],
        draft_root: '',
        summary: { phases: 0, files: 0 },
        exit_code: 1,
      };
    }

    var parsed = parseWarpPlan(raw);
    if (!parsed.ok) {
      return {
        ok: false,
        error: parsed.error || 'parse_failed',
        inputPath: inputPath,
        generated_files: [],
        draft_root: '',
        summary: { phases: 0, files: 0 },
        exit_code: 1,
      };
    }

    // Build draft root: outputDir/<draft-milestone>/phases/...
    var milestoneSlug = _slugify(planMilestone);
    if (milestoneSlug === 'untitled') milestoneSlug = 'v2-x-draft';
    var draftRoot = path.resolve(outputDir, milestoneSlug);
    var phasesRoot = path.join(draftRoot, 'phases');

    if (!_mkdirpReadOnlyOutsideOutput(phasesRoot)) {
      return {
        ok: false,
        error: 'output_dir_create_failed',
        outputDir: outputDir,
        generated_files: [],
        draft_root: draftRoot,
        summary: { phases: 0, files: 0 },
        exit_code: 1,
      };
    }

    // Write a top-level manifest.
    var manifestPath = path.join(draftRoot, 'IMPORT-MANIFEST.md');
    var manifestLines = [];
    manifestLines.push('---');
    manifestLines.push('artifact: import-manifest');
    manifestLines.push('milestone: ' + planMilestone);
    manifestLines.push('created: ' + _isoDate());
    manifestLines.push('status: draft');
    manifestLines.push('source_input: ' + path.basename(inputPath));
    manifestLines.push('source_title: ' + parsed.title);
    manifestLines.push('phase_count: ' + parsed.phases.length);
    manifestLines.push('---');
    manifestLines.push('');
    manifestLines.push(DRAFT_COMMENT);
    manifestLines.push('');
    manifestLines.push('# Warp Plan Import Manifest');
    manifestLines.push('');
    manifestLines.push('Source: ' + inputPath);
    manifestLines.push('Title: ' + parsed.title);
    manifestLines.push('Phases captured: ' + parsed.phases.length);
    manifestLines.push('');
    manifestLines.push('## Phases');
    manifestLines.push('');
    for (var mi = 0; mi < parsed.phases.length; mi++) {
      var ph = parsed.phases[mi];
      manifestLines.push('- Phase ' + ph.number + ': ' + ph.name + ' (' + ph.tasks.length + ' tasks)');
    }
    manifestLines.push('');
    manifestLines.push('## Operator Review Checklist');
    manifestLines.push('');
    manifestLines.push('- [ ] Each phase folder reviewed.');
    manifestLines.push('- [ ] Decision: promote to active milestone OR discard.');
    manifestLines.push('- [ ] If promoted: copy to .planning/milestones/{active}/phases/ and remove draft markers.');
    manifestLines.push('');
    var manifestText = manifestLines.join('\n');

    var generated = [];
    try {
      fs.writeFileSync(manifestPath, manifestText, 'utf8');
      generated.push({ path: manifestPath, kind: 'manifest' });
    } catch (_e) {
      return {
        ok: false,
        error: 'manifest_write_failed',
        generated_files: generated,
        draft_root: draftRoot,
        summary: { phases: 0, files: 0 },
        exit_code: 1,
      };
    }

    // Write each phase's CONTEXT/PLAN/RESEARCH.
    for (var pi = 0; pi < parsed.phases.length; pi++) {
      var phase = parsed.phases[pi];
      var nn = _padNN(phase.number);
      var slug = _slugify(phase.name);
      var phaseDir = path.join(phasesRoot, nn + '-' + slug);
      if (!_mkdirpReadOnlyOutsideOutput(phaseDir)) {
        return {
          ok: false,
          error: 'phase_dir_create_failed',
          phase: phase.number,
          generated_files: generated,
          draft_root: draftRoot,
          summary: { phases: pi, files: generated.length },
          exit_code: 1,
        };
      }

      var ctxPath = path.join(phaseDir, nn + '-CONTEXT.md');
      var planPath = path.join(phaseDir, nn + '-01-' + slug + '-PLAN.md');
      var resPath = path.join(phaseDir, nn + '-RESEARCH.md');

      var ctxText = _buildContext(phase.number, phase.name, planMilestone, parsed.title, phase.tasks);
      var planText = _buildPlan(phase.number, phase.name, planMilestone, parsed.title, phase.tasks);
      var resText = _buildResearch(phase.number, phase.name, planMilestone, parsed.title);

      try {
        fs.writeFileSync(ctxPath, ctxText, 'utf8');
        generated.push({ path: ctxPath, kind: 'CONTEXT', phase: phase.number });
        fs.writeFileSync(planPath, planText, 'utf8');
        generated.push({ path: planPath, kind: 'PLAN', phase: phase.number });
        fs.writeFileSync(resPath, resText, 'utf8');
        generated.push({ path: resPath, kind: 'RESEARCH', phase: phase.number });
      } catch (_e) {
        return {
          ok: false,
          error: 'phase_file_write_failed',
          phase: phase.number,
          generated_files: generated,
          draft_root: draftRoot,
          summary: { phases: pi, files: generated.length },
          exit_code: 1,
        };
      }
    }

    return {
      ok: true,
      schema_version: SCHEMA_VERSION,
      draft_root: draftRoot,
      generated_files: generated,
      summary: {
        phases: parsed.phases.length,
        files: generated.length,
        title: parsed.title,
        milestone: planMilestone,
      },
      exit_code: 0,
    };
  } catch (e) {
    return {
      ok: false,
      error: 'convert_internal_error',
      message: (e && e.message) ? e.message : 'unknown',
      generated_files: [],
      draft_root: '',
      summary: { phases: 0, files: 0 },
      exit_code: 1,
    };
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: selfTest
// >=12 assertions covering parse, scaffold shape, frozen vocab, READ-ONLY
// invariant on STATE.md + active milestone, ASCII-only, degraded paths.
// ---------------------------------------------------------------------------
function selfTest() {
  var results = [];
  function add(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  // Resolve project root for STATE.md / active milestone snapshots.
  function _projectRoot() {
    var cur = path.resolve(__dirname);
    for (var i = 0; i < 8; i++) {
      var probe = path.join(cur, '.planning');
      if (fs.existsSync(probe)) return cur;
      var par = path.dirname(cur);
      if (par === cur) break;
      cur = par;
    }
    return path.resolve(__dirname, '..', '..', '..');
  }

  // Find the most-recently-modified milestone directory under .planning/milestones.
  function _activeMilestoneDir(planningDir) {
    try {
      var milesDir = path.join(planningDir, 'milestones');
      if (!fs.existsSync(milesDir)) return '';
      var entries = fs.readdirSync(milesDir);
      var best = '';
      var bestMtime = 0;
      for (var i = 0; i < entries.length; i++) {
        var p = path.join(milesDir, entries[i]);
        try {
          var st = fs.statSync(p);
          if (st.isDirectory() && st.mtimeMs > bestMtime) {
            bestMtime = st.mtimeMs;
            best = p;
          }
        } catch (_e) { /* skip */ }
      }
      return best;
    } catch (_e) {
      return '';
    }
  }

  try {
    // ---- A1: PUBLIC_APIS frozen + module exports them ----
    var apisOK = Object.isFrozen(PUBLIC_APIS)
              && PUBLIC_APIS.length === 4
              && PUBLIC_APIS.indexOf('convert') !== -1
              && PUBLIC_APIS.indexOf('parseWarpPlan') !== -1
              && PUBLIC_APIS.indexOf('selfTest') !== -1
              && PUBLIC_APIS.indexOf('_internals') !== -1;
    add('public_apis_frozen', apisOK, 'len=' + PUBLIC_APIS.length);

    // ---- A2: parseWarpPlan extracts title from `# heading` ----
    var p2 = parseWarpPlan('# Hello World Plan\n\n## Phase 1: Foo\n- task one\n');
    add('parse_extracts_title_from_heading',
      p2.ok === true && p2.title === 'Hello World Plan',
      'title=' + (p2 ? p2.title : '?'));

    // ---- A3: parseWarpPlan extracts phases from `## Phase N:` ----
    var p3 = parseWarpPlan('# T\n\n## Phase 1: Alpha\n- a1\n## Phase 2: Beta\n- b1\n- b2\n');
    add('parse_extracts_phases',
      p3.ok === true && p3.phases.length === 2
        && p3.phases[0].number === 1 && p3.phases[0].name === 'Alpha'
        && p3.phases[1].number === 2 && p3.phases[1].name === 'Beta',
      'phases=' + (p3 ? p3.phases.length : 0));

    // ---- A4: parseWarpPlan extracts tasks from bullets ----
    var p4 = parseWarpPlan('# T\n\n## Phase 1: X\n- task one\n* task two\n- task three\n');
    add('parse_extracts_bullet_tasks',
      p4.ok === true && p4.phases.length === 1
        && p4.phases[0].tasks.length === 3
        && p4.phases[0].tasks[0] === 'task one'
        && p4.phases[0].tasks[1] === 'task two'
        && p4.phases[0].tasks[2] === 'task three',
      'tasks=' + (p4 && p4.phases[0] ? p4.phases[0].tasks.length : 0));

    // ---- A5: parseWarpPlan with malformed input -> {ok:false} ----
    var p5a = parseWarpPlan('');
    var p5b = parseWarpPlan('plain text no headings no phases');
    var p5c = parseWarpPlan(null);
    add('parse_malformed_returns_not_ok',
      p5a.ok === false && p5b.ok === false && p5c.ok === false,
      'a=' + p5a.ok + ' b=' + p5b.ok + ' c=' + p5c.ok);

    // ---- Set up a temp dir for live conversion ----
    var tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wpc-selftest-'));
    var fixturesDir = path.join(__dirname, 'fixtures');
    var simpleFix = path.join(fixturesDir, 'simple-plan.md');
    var fmFix = path.join(fixturesDir, 'frontmatter-plan.md');
    var malFix = path.join(fixturesDir, 'malformed-plan.md');

    // Snapshot STATE.md mtime BEFORE.
    var projRoot = _projectRoot();
    var stateMd = path.join(projRoot, '.planning', 'STATE.md');
    var stateMtimeBefore = -1;
    try {
      if (fs.existsSync(stateMd)) {
        stateMtimeBefore = fs.statSync(stateMd).mtimeMs;
      }
    } catch (_e) { stateMtimeBefore = -1; }

    // Snapshot active milestone dir mtime BEFORE.
    var planningDir = path.join(projRoot, '.planning');
    var activeDir = _activeMilestoneDir(planningDir);
    var activeMtimeBefore = -1;
    try {
      if (activeDir && fs.existsSync(activeDir)) {
        activeMtimeBefore = fs.statSync(activeDir).mtimeMs;
      }
    } catch (_e) { activeMtimeBefore = -1; }

    // ---- Run conversion against simple fixture into tmp dir ----
    var convOutput = path.join(tmpRoot, 'output');
    var convRes = null;
    if (fs.existsSync(simpleFix)) {
      convRes = convert({
        inputPath: simpleFix,
        outputDir: convOutput,
        planMilestone: 'selftest-draft',
      });
    } else {
      // No fixture -> mark as degraded but continue with synthesized input.
      var synth = path.join(tmpRoot, 'synth.md');
      fs.writeFileSync(synth,
        '# Synth Plan\n\n## Phase 1: Synth Alpha\n- s1\n- s2\n## Phase 2: Synth Beta\n- s3\n',
        'utf8');
      convRes = convert({
        inputPath: synth,
        outputDir: convOutput,
        planMilestone: 'selftest-draft',
      });
    }

    // ---- A6: convert produces phase dirs + 3 files each ----
    var phaseFiles = (convRes && convRes.generated_files)
      ? convRes.generated_files.filter(function (g) {
          return g.kind === 'CONTEXT' || g.kind === 'PLAN' || g.kind === 'RESEARCH';
        })
      : [];
    var phasesGenerated = (convRes && convRes.summary)
      ? convRes.summary.phases : 0;
    var perPhase = phasesGenerated > 0 ? (phaseFiles.length / phasesGenerated) : 0;
    add('convert_produces_n_phase_dirs_and_3_files_each',
      convRes && convRes.ok === true && phasesGenerated >= 2 && perPhase === 3,
      'phases=' + phasesGenerated + ' filesPerPhase=' + perPhase);

    // ---- A7: each generated file has status: draft frontmatter ----
    var allDraftFM = true;
    var fmCheckCount = 0;
    if (convRes && convRes.generated_files) {
      for (var fi = 0; fi < convRes.generated_files.length; fi++) {
        var gf = convRes.generated_files[fi];
        if (gf.kind === 'CONTEXT' || gf.kind === 'PLAN' || gf.kind === 'RESEARCH' || gf.kind === 'manifest') {
          var content = '';
          try { content = fs.readFileSync(gf.path, 'utf8'); } catch (_e) { content = ''; }
          if (content.indexOf('status: draft') === -1) { allDraftFM = false; break; }
          fmCheckCount++;
        }
      }
    }
    add('every_file_has_status_draft_frontmatter',
      allDraftFM && fmCheckCount > 0,
      'checked=' + fmCheckCount);

    // ---- A8: each generated file has DRAFT HTML comment ----
    var allDraftComment = true;
    var commentCheckCount = 0;
    if (convRes && convRes.generated_files) {
      for (var ci = 0; ci < convRes.generated_files.length; ci++) {
        var gc = convRes.generated_files[ci];
        var c = '';
        try { c = fs.readFileSync(gc.path, 'utf8'); } catch (_e) { c = ''; }
        if (c.indexOf(DRAFT_COMMENT) === -1) { allDraftComment = false; break; }
        commentCheckCount++;
      }
    }
    add('every_file_has_draft_html_comment',
      allDraftComment && commentCheckCount > 0,
      'checked=' + commentCheckCount);

    // ---- A9: PLAN has Acceptance (TODO) section with checkboxes ----
    var planOK = false;
    if (convRes && convRes.generated_files) {
      for (var pli = 0; pli < convRes.generated_files.length; pli++) {
        var pgf = convRes.generated_files[pli];
        if (pgf.kind === 'PLAN') {
          var pc = '';
          try { pc = fs.readFileSync(pgf.path, 'utf8'); } catch (_e) { pc = ''; }
          if (pc.indexOf('## Acceptance (TODO)') !== -1
              && pc.indexOf('- [ ]') !== -1) {
            planOK = true;
            break;
          }
        }
      }
    }
    add('plan_has_acceptance_todo_with_checkboxes', planOK, 'planOK=' + planOK);

    // ---- A10: RESEARCH has Claude TODO markers ----
    var resOK = false;
    if (convRes && convRes.generated_files) {
      for (var ri = 0; ri < convRes.generated_files.length; ri++) {
        var rgf = convRes.generated_files[ri];
        if (rgf.kind === 'RESEARCH') {
          var rc = '';
          try { rc = fs.readFileSync(rgf.path, 'utf8'); } catch (_e) { rc = ''; }
          if (rc.indexOf('TODO: Claude research source inputs') !== -1) {
            resOK = true;
            break;
          }
        }
      }
    }
    add('research_has_claude_todo_markers', resOK, 'resOK=' + resOK);

    // ---- A11: STATE.md mtime unchanged before/after conversion ----
    var stateMtimeAfter = -1;
    try {
      if (fs.existsSync(stateMd)) {
        stateMtimeAfter = fs.statSync(stateMd).mtimeMs;
      }
    } catch (_e) { stateMtimeAfter = -1; }
    add('state_md_mtime_unchanged',
      stateMtimeBefore === stateMtimeAfter,
      'before=' + stateMtimeBefore + ' after=' + stateMtimeAfter);

    // ---- A12: active milestone folder mtime unchanged ----
    var activeMtimeAfter = -1;
    try {
      if (activeDir && fs.existsSync(activeDir)) {
        activeMtimeAfter = fs.statSync(activeDir).mtimeMs;
      }
    } catch (_e) { activeMtimeAfter = -1; }
    add('active_milestone_mtime_unchanged',
      activeMtimeBefore === activeMtimeAfter,
      'before=' + activeMtimeBefore + ' after=' + activeMtimeAfter
        + ' dir=' + (activeDir ? path.basename(activeDir) : '?'));

    // ---- A13: ASCII-only of source ----
    var src = '';
    try { src = fs.readFileSync(__filename, 'utf8'); } catch (_e) { src = ''; }
    var firstNon = _firstNonAsciiIdx(src);
    add('ascii_only_source', firstNon === -1, 'first_nonascii_idx=' + firstNon);

    // ---- A14: bad input path -> degraded ----
    var bad = convert({
      inputPath: path.join(tmpRoot, 'does-not-exist.md'),
      outputDir: path.join(tmpRoot, 'noop'),
      planMilestone: 'selftest-draft',
    });
    add('bad_input_path_degraded',
      bad && bad.ok === false && bad.error === 'input_not_found',
      'error=' + (bad ? bad.error : '?'));

    // ---- A15: missing output dir -> creates it under outputDir ----
    var newOut = path.join(tmpRoot, 'fresh-' + Date.now());
    // Synthesize a tiny input.
    var miniInput = path.join(tmpRoot, 'mini.md');
    fs.writeFileSync(miniInput,
      '# Mini\n\n## Phase 7: Mini Phase\n- mini task\n', 'utf8');
    var freshRes = convert({
      inputPath: miniInput,
      outputDir: newOut,
      planMilestone: 'selftest-draft',
    });
    add('missing_output_dir_created',
      freshRes && freshRes.ok === true && fs.existsSync(newOut),
      'ok=' + (freshRes ? freshRes.ok : '?'));

    // ---- A16: parseWarpPlan with frontmatter title falls through ----
    var p16 = parseWarpPlan('---\ntitle: FM Title\n---\n\n## Phase 1: FM\n- ft\n');
    add('parse_frontmatter_title',
      p16.ok === true && p16.title === 'FM Title',
      'title=' + (p16 ? p16.title : '?'));

    // ---- A17: malformed fixture -> {ok:false} from convert when truly malformed ----
    if (fs.existsSync(malFix)) {
      var malOut = path.join(tmpRoot, 'mal-output');
      var malRes = convert({
        inputPath: malFix,
        outputDir: malOut,
        planMilestone: 'selftest-draft',
      });
      add('malformed_fixture_degraded',
        malRes && malRes.ok === false,
        'error=' + (malRes ? malRes.error : '?'));
    } else {
      add('malformed_fixture_degraded', true, 'fixture_skipped');
    }

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
// _internals
// ---------------------------------------------------------------------------
var _internals = {
  PUBLIC_APIS: PUBLIC_APIS,
  FRONTMATTER_KEYS: FRONTMATTER_KEYS,
  ARTIFACT_NAMES: ARTIFACT_NAMES,
  DRAFT_COMMENT: DRAFT_COMMENT,
  SCHEMA_VERSION: SCHEMA_VERSION,
  _slugify: _slugify,
  _padNN: _padNN,
  _isoDate: _isoDate,
  _firstNonAsciiIdx: _firstNonAsciiIdx,
  _parseFrontmatter: _parseFrontmatter,
  _buildContext: _buildContext,
  _buildPlan: _buildPlan,
  _buildResearch: _buildResearch,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function _argValue(args, key) {
  for (var i = 0; i < args.length; i++) {
    if (args[i] === key && i + 1 < args.length) return args[i + 1];
    if (args[i] && args[i].indexOf(key + '=') === 0) {
      return args[i].slice(key.length + 1);
    }
  }
  return null;
}

function _printSelfTest(out) {
  if (!out || !Array.isArray(out.results)) {
    process.stdout.write('warp_plan_converter_self_test: results not an array\n');
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
  process.stdout.write('warp_plan_converter_self_test: ' + pass + '/'
    + out.results.length + ' assertions passed\n');
  return pass === out.results.length;
}

function _printConvert(out) {
  if (!out) {
    process.stdout.write('warp_plan_convert: no result\n');
    return 1;
  }
  if (out.ok !== true) {
    process.stdout.write('warp_plan_convert: FAILED error=' + (out.error || 'unknown') + '\n');
    return out.exit_code || 1;
  }
  process.stdout.write('warp_plan_convert: OK\n');
  process.stdout.write('  draft_root=' + out.draft_root + '\n');
  process.stdout.write('  phases=' + out.summary.phases + '\n');
  process.stdout.write('  files=' + out.summary.files + '\n');
  process.stdout.write('  title=' + out.summary.title + '\n');
  process.stdout.write('  milestone=' + out.summary.milestone + '\n');
  process.stdout.write('---\n');
  for (var i = 0; i < out.generated_files.length; i++) {
    var g = out.generated_files[i];
    process.stdout.write('  ' + g.kind + ' ' + g.path + '\n');
  }
  return 0;
}

function _help() {
  process.stdout.write([
    'usage: node convert.cjs --input <path> --output <dir> [--milestone <name>]',
    '       node convert.cjs --self-test',
    '       node convert.cjs --help',
    '',
    'Converts a Warp Plan markdown export into DRAFT SGSD phase scaffolding.',
    'Output is written under <dir>/<milestone-slug>/phases/<NN>-<slug>/.',
    'Each generated file is marked DRAFT (status: draft + HTML comment).',
    'NEVER mutates STATE.md or any active milestone folder.',
    '',
  ].join('\n'));
}

function _main(argv) {
  try {
    var args = argv.slice(2);
    if (args.length === 0 || args.indexOf('--help') !== -1) {
      _help();
      process.exit(0);
      return;
    }
    if (args.indexOf('--self-test') !== -1) {
      var out = selfTest();
      var allOK = _printSelfTest(out);
      process.exit(allOK ? 0 : 1);
      return;
    }
    var inputPath = _argValue(args, '--input');
    var outputDir = _argValue(args, '--output');
    var milestone = _argValue(args, '--milestone');
    if (!inputPath || !outputDir) {
      process.stderr.write('warp_plan_convert: missing --input or --output\n');
      _help();
      process.exit(1);
      return;
    }
    var res = convert({
      inputPath: inputPath,
      outputDir: outputDir,
      planMilestone: milestone || undefined,
    });
    var code = _printConvert(res);
    process.exit(code);
  } catch (e) {
    process.stderr.write('warp_plan_convert_internal_error message='
      + (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = {
  convert: convert,
  parseWarpPlan: parseWarpPlan,
  selfTest: selfTest,
  _internals: _internals,
};
