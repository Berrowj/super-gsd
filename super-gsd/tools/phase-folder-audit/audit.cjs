// ============================================================================
// SGSD - PHASE-FOLDER AUDIT (Phase 40 -- AUDIT-01..05)
// ============================================================================
// Walks .planning/milestones/{*}/phases/{*}/ AND .planning/phases/{*}/.
// Verdict closed-enum: { compliant, partial, non-compliant }.
//
// Source: 40-RESEARCH.md sec 11 (LOCKED Q1-Q13) + 40-01-PLAN.md.
//
// Failure contract (mirrored from rubric.cjs:11-13 verbatim):
//   "this script NEVER throws upward at the orchestrator boundary"
// All public APIs (auditFolder, auditAllPhases, renderTable) wrap
// internals in try/catch; on error stderr-warn + return falsey
// (null, [], '(audit render error)').
//
// Locked decision 40=B (mass-discuss line 217 verbatim):
//   "required + recommended file checks; no content schema --
//    content validation is auditor-creep"
// Soft-warn ONLY. The auditor NEVER mutates any phase folder.
//
// Read-only invariant (AUDIT-04, load-bearing safety contract):
//   NEVER write/append/unlink/rename/rmdir/copyFile/mkdir against any
//   phase-folder path. ONLY writes permitted: tmpdir fixture writes during
//   --self-test (matching the os-tmpdir prefix output).
//   Self-test fingerprint guards 3 sample real phase folders before/after.
//
// Acceptance bindings:
//   AUDIT-01: auditAllPhases walks .planning/milestones/{*}/phases/{*}/
//             AND .planning/phases/{*}/ (un-archived working dir).
//   AUDIT-02: every folder gets verdict in
//             {compliant, partial, non-compliant}.
//   AUDIT-03: --render exits 0 even when partial/non-compliant rows
//             present; per-phase missing-file list rendered.
//   AUDIT-04: self-test fingerprint guard (assertion 13) binds runtime.
//   AUDIT-05: SKILL.md Step 4.6 grep for `auditAllPhases` returns >= 1.
//
// Mirror discipline (RESEARCH sec 10): 1:1 with Phase 35 system-map.cjs +
// Phase 39 rubric.cjs. Same path-resolution pattern (__dirname-anchored,
// NEVER cwd-defaulted; Phase 36 W2 lesson + Phase 39 W2 lesson).
//
// Zero external dependencies. Node built-ins only (fs / path / os).
// ASCII-only (Phase 39 W4 lesson: no em dashes, no smart quotes).
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// ----------------------------------------------------------------------------
// FROZEN CONSTANTS (RESEARCH sec 1.4 verbatim)
// ----------------------------------------------------------------------------

// VERDICTS: closed enum of 3 outcomes. Frozen.
const VERDICTS = Object.freeze(['compliant', 'partial', 'non-compliant']);

// REQUIRED_FILES: 4 canonical files every phase folder MUST have.
// `{NN}` is replaced with the 2-digit phase number derived from folder name.
const REQUIRED_FILES = Object.freeze([
  { kind: 'context',      matcher: { type: 'exact', name: '{NN}-CONTEXT.md' } },
  { kind: 'research',     matcher: { type: 'exact', name: '{NN}-RESEARCH.md' } },
  { kind: 'plan',         matcher: { type: 'glob',  pattern: '{NN}-*-PLAN.md', minCount: 1 } },
  { kind: 'verification', matcher: { type: 'exact', name: '{NN}-VERIFICATION.md' } },
]);

// RECOMMENDED_FILES: 4 canonical files SHOULD be present (soft-warn when missing).
const RECOMMENDED_FILES = Object.freeze([
  { kind: 'atc-review',     matcher: { type: 'exact', name: '{NN}-ATC-REVIEW.md' } },
  { kind: 'commit-reviews', matcher: { type: 'exact', name: 'commit-reviews.jsonl' } },
  { kind: 'codex-review',   matcher: { type: 'exact', name: '{NN}-codex-review.md' } },
  { kind: 'waste',          matcher: { type: 'exact', name: 'WASTE.md' } },
]);

// ----------------------------------------------------------------------------
// PRIVATE HELPERS
// ----------------------------------------------------------------------------

// Extract 2-digit phase number from leading `^(\d{2})-` regex; null on no match.
// Pure function; no I/O. RESEARCH Q1 lock.
function _phaseNumberFromFolderName(name) {
  if (typeof name !== 'string' || !name) return null;
  const m = name.match(/^(\d{2})-/);
  return m ? m[1] : null;
}

// Escape regex metacharacters in a literal string (used by glob expansion).
function _escapeRegex(s) {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

// Expand a frozen matcher with the phase number. Returns:
//   { kind: 'exact', basename: 'NN-CONTEXT.md' }
//   { kind: 'glob',  pattern: 'NN-*-PLAN.md', regex: /^NN-.*-PLAN\.md$/, minCount: 1, displayName: 'NN-*-PLAN.md' }
// Pure function; no I/O.
function _expandMatcher(matcher, phaseNum) {
  const nn = phaseNum || '{NN}';
  if (matcher.type === 'exact') {
    const basename = matcher.name.replace(/\{NN\}/g, nn);
    return { kind: 'exact', basename: basename };
  }
  if (matcher.type === 'glob') {
    const pattern = matcher.pattern.replace(/\{NN\}/g, nn);
    // Convert glob to regex: `*` -> `.*`, escape other metachars literal-wise.
    // We do this by splitting on `*`, escaping each segment, then joining with `.*`.
    const segments = pattern.split('*').map(_escapeRegex);
    const regex = new RegExp('^' + segments.join('.*') + '$');
    return {
      kind: 'glob',
      pattern: pattern,
      regex: regex,
      minCount: typeof matcher.minCount === 'number' ? matcher.minCount : 1,
      displayName: pattern,
    };
  }
  return { kind: 'unknown', basename: '(invalid matcher)' };
}

// Check whether a matcher is satisfied by the directory's basenames.
// Returns { present: bool, basenames: string[], displayName: string }.
// `displayName` is the operator-readable expanded pattern for missing-list
// rendering (e.g. '40-CONTEXT.md' or '40-*-PLAN.md').
function _checkFile(folderEntries, matcher, phaseNum) {
  const expanded = _expandMatcher(matcher, phaseNum);
  if (!Array.isArray(folderEntries)) {
    return {
      present: false,
      basenames: [],
      displayName: expanded.basename || expanded.displayName || '(invalid)',
    };
  }
  if (expanded.kind === 'exact') {
    const found = folderEntries.indexOf(expanded.basename) >= 0;
    return {
      present: found,
      basenames: found ? [expanded.basename] : [],
      displayName: expanded.basename,
    };
  }
  if (expanded.kind === 'glob') {
    const matches = folderEntries.filter((b) => expanded.regex.test(b));
    return {
      present: matches.length >= expanded.minCount,
      basenames: matches,
      displayName: expanded.displayName,
    };
  }
  return {
    present: false,
    basenames: [],
    displayName: expanded.basename || '(invalid)',
  };
}

// List all phase-folder absolute paths under planningDir.
// Discovery rule (RESEARCH sec 4.2):
//   - Walk <planningDir>/milestones/<v>/phases/<NN-name>/
//     (filtered to opts.milestone if set; else all milestones).
//   - ALSO walk <planningDir>/phases/<NN-name>/ if opts.includeUnarchived
//     (default true) and the dir exists (un-archived working dir).
//   - Filter to basenames matching `^\d{2}-`.
//   - Return sorted by full path codepoint order (deterministic).
//   - Try/catch on every fs call; on error return [] (never throws).
function _listPhaseFolders(planningDir, opts) {
  try {
    const o = opts || {};
    const includeUnarchived = o.includeUnarchived !== false;
    const milestoneFilter = o.milestone || null;
    const out = [];
    const phaseRe = /^\d{2}-/;

    // Helper: enumerate phase subdirs under a given parent dir.
    function _enumerate(parentDir) {
      try {
        if (!fs.existsSync(parentDir)) return;
        const entries = fs.readdirSync(parentDir);
        for (const name of entries) {
          if (!phaseRe.test(name)) continue;
          const full = path.join(parentDir, name);
          try {
            const st = fs.statSync(full);
            if (st.isDirectory()) out.push(full);
          } catch (_e) {
            // skip unstattable entries
          }
        }
      } catch (_e) {
        // skip unreadable parent
      }
    }

    // Walk milestones tree.
    const milestonesRoot = path.join(planningDir, 'milestones');
    if (fs.existsSync(milestonesRoot)) {
      try {
        const milestoneDirs = fs.readdirSync(milestonesRoot);
        for (const mname of milestoneDirs) {
          if (milestoneFilter && mname !== milestoneFilter) continue;
          const phasesParent = path.join(milestonesRoot, mname, 'phases');
          _enumerate(phasesParent);
        }
      } catch (_e) {
        // skip unreadable milestones root
      }
    }

    // Walk un-archived working dir if enabled.
    if (includeUnarchived) {
      const unarchivedParent = path.join(planningDir, 'phases');
      _enumerate(unarchivedParent);
    }

    // Sort by full path codepoint order (deterministic).
    out.sort();
    return out;
  } catch (e) {
    console.warn('[SGSD] audit _listPhaseFolders failed:', e.message);
    return [];
  }
}

// Fingerprint a directory: deterministic snapshot of children + mtime/size/isDir.
// Used by self-test assertion 13 to bind AUDIT-04 (read-only invariant).
function _fingerprintDir(dir) {
  if (!fs.existsSync(dir)) return { exists: false };
  return {
    exists: true,
    children: fs.readdirSync(dir).sort().map(function (name) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      return { name: name, mtime: st.mtimeMs, size: st.size, isDir: st.isDirectory() };
    }),
  };
}

// Deep-equal compare two fingerprint objects. Returns true if equal.
function _fingerprintEqual(a, b) {
  if (!a || !b) return a === b;
  if (a.exists !== b.exists) return false;
  if (!a.exists && !b.exists) return true;
  if (!Array.isArray(a.children) || !Array.isArray(b.children)) return false;
  if (a.children.length !== b.children.length) return false;
  for (let i = 0; i < a.children.length; i++) {
    const ca = a.children[i];
    const cb = b.children[i];
    if (!ca || !cb) return false;
    if (ca.name !== cb.name) return false;
    if (ca.mtime !== cb.mtime) return false;
    if (ca.size !== cb.size) return false;
    if (ca.isDir !== cb.isDir) return false;
  }
  return true;
}

// ----------------------------------------------------------------------------
// PUBLIC FUNCTION: auditFolder
// ----------------------------------------------------------------------------
// auditFolder(phaseDir) -> AuditRow OR null on internal error.
//
// AuditRow shape:
//   { phase_dir, phase_num, folder_name, verdict,
//     required_present, required_missing,
//     recommended_present, recommended_missing }
//
// Wraps body in try/catch; on error console.warn + returns null.
function auditFolder(phaseDir) {
  try {
    if (typeof phaseDir !== 'string' || !phaseDir) {
      return null;
    }
    const absDir = path.resolve(phaseDir);
    const folderName = path.basename(absDir);
    const phaseNum = _phaseNumberFromFolderName(folderName);

    // Build defaults for not-exist branch.
    let folderEntries = [];
    let folderExists = false;
    try {
      if (fs.existsSync(absDir)) {
        const st = fs.statSync(absDir);
        if (st.isDirectory()) {
          folderEntries = fs.readdirSync(absDir);
          folderExists = true;
        }
      }
    } catch (_e) {
      folderEntries = [];
      folderExists = false;
    }

    const required_present = [];
    const required_missing = [];
    for (const spec of REQUIRED_FILES) {
      const res = _checkFile(folderEntries, spec.matcher, phaseNum);
      if (res.present && folderExists) {
        // Push first basename for exact, all basenames for glob.
        for (const b of res.basenames) required_present.push(b);
      } else {
        required_missing.push(res.displayName);
      }
    }

    const recommended_present = [];
    const recommended_missing = [];
    for (const spec of RECOMMENDED_FILES) {
      const res = _checkFile(folderEntries, spec.matcher, phaseNum);
      if (res.present && folderExists) {
        for (const b of res.basenames) recommended_present.push(b);
      } else {
        recommended_missing.push(res.displayName);
      }
    }

    // Closed-enum bucket logic (RESEARCH sec 2.1).
    let verdict;
    if (phaseNum === null) {
      // Folder name does not start with `^\d{2}-`; force non-compliant
      // (RESEARCH Q1 lock). Missing arrays already use `{NN}-...` literal.
      verdict = 'non-compliant';
    } else if (required_missing.length > 0) {
      verdict = 'non-compliant';
    } else if (recommended_missing.length > 0) {
      verdict = 'partial';
    } else {
      verdict = 'compliant';
    }

    return {
      phase_dir: absDir,
      phase_num: phaseNum,
      folder_name: folderName,
      verdict: verdict,
      required_present: required_present,
      required_missing: required_missing,
      recommended_present: recommended_present,
      recommended_missing: recommended_missing,
    };
  } catch (e) {
    console.warn('[SGSD] audit auditFolder failed:', e.message);
    return null;
  }
}

// ----------------------------------------------------------------------------
// PUBLIC FUNCTION: auditAllPhases
// ----------------------------------------------------------------------------
// auditAllPhases(planningDir, opts) -> AuditRow[] (empty on error).
//
// opts: { milestone?, includeUnarchived? }
//   milestone:        when set, only walks that milestone's phases tree.
//   includeUnarchived: defaults true; also walks <planningDir>/phases/.
//
// Wraps body in try/catch returning [] on error.
function auditAllPhases(planningDir, opts) {
  try {
    if (typeof planningDir !== 'string' || !planningDir) return [];
    const o = opts || {};
    const includeUnarchived = o.includeUnarchived !== false;
    const absPlanning = path.resolve(planningDir);
    const folders = _listPhaseFolders(absPlanning, {
      milestone: o.milestone || null,
      includeUnarchived: includeUnarchived,
    });
    const rows = [];
    for (const f of folders) {
      const row = auditFolder(f);
      if (row) rows.push(row);
    }
    return rows;
  } catch (e) {
    console.warn('[SGSD] audit auditAllPhases failed:', e.message);
    return [];
  }
}

// ----------------------------------------------------------------------------
// PUBLIC FUNCTION: renderTable
// ----------------------------------------------------------------------------
// renderTable(audits) -> markdown string.
//
// Empty input -> literal '(no phase folders found for this milestone)\n'
// (RESEARCH Q12 lock; NOT a thrown exception).
//
// Output sections:
//   - Summary table (verdict counts)
//   - Per-phase verdict table:
//       | phase | folder | verdict | required missing | recommended missing |
//   - Soft-warn footer.
//
// Wraps body in try/catch returning '(audit render error)' on failure.
function renderTable(audits) {
  try {
    if (!Array.isArray(audits) || audits.length === 0) {
      return '(no phase folders found for this milestone)\n';
    }

    // Summary counts.
    let nCompliant = 0, nPartial = 0, nNonCompliant = 0;
    for (const r of audits) {
      if (!r || typeof r !== 'object') continue;
      if (r.verdict === 'compliant') nCompliant++;
      else if (r.verdict === 'partial') nPartial++;
      else if (r.verdict === 'non-compliant') nNonCompliant++;
    }

    const summaryHeader = '| verdict | count |';
    const summarySep    = '|---------|-------|';
    const summaryLines = [
      summaryHeader, summarySep,
      '| compliant | ' + nCompliant + ' |',
      '| partial | ' + nPartial + ' |',
      '| non-compliant | ' + nNonCompliant + ' |',
    ];

    // Per-phase verdict table (locked column order).
    const detailHeader = '| phase | folder | verdict | required missing | recommended missing |';
    const detailSep    = '|-------|--------|---------|------------------|---------------------|';
    const detailLines = [detailHeader, detailSep];
    for (const r of audits) {
      if (!r || typeof r !== 'object') continue;
      const phaseCell = (r.phase_num === null || r.phase_num === undefined) ? '--' : String(r.phase_num);
      const folderCell = String(r.folder_name || '(unknown)');
      const verdictCell =
          r.verdict === 'non-compliant' ? '**non-compliant**'
        : r.verdict === 'partial'       ? '*partial*'
        : String(r.verdict);
      const reqMissingCell =
        (Array.isArray(r.required_missing) && r.required_missing.length > 0)
          ? r.required_missing.join(', ')
          : '--';
      const recMissingCell =
        (Array.isArray(r.recommended_missing) && r.recommended_missing.length > 0)
          ? r.recommended_missing.join(', ')
          : '--';
      detailLines.push('| ' + phaseCell + ' | ' + folderCell + ' | ' + verdictCell + ' | ' + reqMissingCell + ' | ' + recMissingCell + ' |');
    }

    const footer = '> Soft-warn only. Locked: 40=B. Auditor never modifies phase folders.';

    return summaryLines.join('\n') + '\n\n' + detailLines.join('\n') + '\n\n' + footer + '\n';
  } catch (e) {
    console.warn('[SGSD] audit renderTable failed:', e.message);
    return '(audit render error)';
  }
}

// ----------------------------------------------------------------------------
// SELF-TEST (RESEARCH sec 7) -- 12 logical assertions + 1 fingerprint = 13
// ----------------------------------------------------------------------------
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = function (name, cond, detail) {
    if (cond) { pass++; }
    else { fail++; failures.push({ name: name, detail: detail || '' }); }
  };

  // Capture canonical fingerprint BEFORE any work, anchored to __dirname.
  // audit.cjs at <repo>/super-gsd/tools/phase-folder-audit/audit.cjs;
  // 3 dirs up = repo root.
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const samplePhaseFolders = [
    path.join(repoRoot, '.planning', 'milestones', 'v1.7', 'phases', '31-canonical-envelope'),
    path.join(repoRoot, '.planning', 'milestones', 'v1.7', 'phases', '35-generated-system-map'),
    path.join(repoRoot, '.planning', 'milestones', 'v1.6', 'phases', '26-cockpit-question-contract'),
  ];
  const before = samplePhaseFolders.map(_fingerprintDir);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
  try {
    // 1. VERDICTS frozen, length 3, equals ['compliant','partial','non-compliant'].
    let verdictsFrozen = false;
    try { VERDICTS.push('banana'); } catch (_e) { verdictsFrozen = true; }
    assert('1. VERDICTS frozen + length 3 + [compliant,partial,non-compliant]',
      Array.isArray(VERDICTS) && VERDICTS.length === 3 &&
      VERDICTS[0] === 'compliant' && VERDICTS[1] === 'partial' && VERDICTS[2] === 'non-compliant' &&
      verdictsFrozen);

    // 2. REQUIRED_FILES frozen, length 4, kinds match RESEARCH 1.4.
    const reqKinds = REQUIRED_FILES.map(function (s) { return s.kind; });
    assert('2. REQUIRED_FILES frozen + length 4 + kinds [context,research,plan,verification]',
      Object.isFrozen(REQUIRED_FILES) && REQUIRED_FILES.length === 4 &&
      reqKinds[0] === 'context' && reqKinds[1] === 'research' &&
      reqKinds[2] === 'plan' && reqKinds[3] === 'verification');

    // 3. RECOMMENDED_FILES frozen, length 4, kinds match RESEARCH 1.4.
    const recKinds = RECOMMENDED_FILES.map(function (s) { return s.kind; });
    assert('3. RECOMMENDED_FILES frozen + length 4 + kinds [atc-review,commit-reviews,codex-review,waste]',
      Object.isFrozen(RECOMMENDED_FILES) && RECOMMENDED_FILES.length === 4 &&
      recKinds[0] === 'atc-review' && recKinds[1] === 'commit-reviews' &&
      recKinds[2] === 'codex-review' && recKinds[3] === 'waste');

    // 4. auditFolder over fully-compliant fixture -> verdict=compliant, both missing arrays empty.
    const dir4 = path.join(tmp, 'fix4', '40-fixture-compliant');
    fs.mkdirSync(dir4, { recursive: true });
    const compliantFiles = [
      '40-CONTEXT.md', '40-RESEARCH.md', '40-01-foo-PLAN.md', '40-VERIFICATION.md',
      '40-ATC-REVIEW.md', 'commit-reviews.jsonl', '40-codex-review.md', 'WASTE.md',
    ];
    for (const f of compliantFiles) {
      fs.writeFileSync(path.join(dir4, f), '', 'utf8');
    }
    const r4 = auditFolder(dir4);
    assert('4. auditFolder fully-compliant fixture -> verdict=compliant, missing arrays empty, phase_num=40',
      r4 && r4.verdict === 'compliant' &&
      r4.required_missing.length === 0 &&
      r4.recommended_missing.length === 0 &&
      r4.phase_num === '40');

    // 5. auditFolder missing 40-CONTEXT.md -> verdict=non-compliant, missing has '40-CONTEXT.md'.
    const dir5 = path.join(tmp, 'fix5', '40-fixture-no-context');
    fs.mkdirSync(dir5, { recursive: true });
    const filesNoContext = [
      '40-RESEARCH.md', '40-01-foo-PLAN.md', '40-VERIFICATION.md',
      '40-ATC-REVIEW.md', 'commit-reviews.jsonl', '40-codex-review.md', 'WASTE.md',
    ];
    for (const f of filesNoContext) {
      fs.writeFileSync(path.join(dir5, f), '', 'utf8');
    }
    const r5 = auditFolder(dir5);
    assert('5. auditFolder missing 40-CONTEXT.md -> verdict=non-compliant; required_missing includes 40-CONTEXT.md',
      r5 && r5.verdict === 'non-compliant' &&
      r5.required_missing.indexOf('40-CONTEXT.md') >= 0);

    // 6. auditFolder all 4 required, 0 recommended -> verdict=partial, recommended_missing.length === 4.
    const dir6 = path.join(tmp, 'fix6', '40-fixture-no-rec');
    fs.mkdirSync(dir6, { recursive: true });
    const filesReqOnly = [
      '40-CONTEXT.md', '40-RESEARCH.md', '40-01-foo-PLAN.md', '40-VERIFICATION.md',
    ];
    for (const f of filesReqOnly) {
      fs.writeFileSync(path.join(dir6, f), '', 'utf8');
    }
    const r6 = auditFolder(dir6);
    assert('6. auditFolder required-only fixture -> verdict=partial; recommended_missing.length=4',
      r6 && r6.verdict === 'partial' &&
      r6.required_missing.length === 0 &&
      r6.recommended_missing.length === 4);

    // 7. auditFolder over a non-numeric-prefix folder name -> phase_num=null verdict=non-compliant.
    const dir7 = path.join(tmp, 'fix7', 'README');
    fs.mkdirSync(dir7, { recursive: true });
    const r7 = auditFolder(dir7);
    assert('7. auditFolder no-leading-digit folder -> phase_num=null verdict=non-compliant',
      r7 && r7.phase_num === null && r7.verdict === 'non-compliant');

    // 8. auditAllPhases over tmp planning dir with 3 synthetic phase folders -> 3 audits sorted.
    const tmp8Plan = path.join(tmp, 'plan8');
    const tmp8Phases = path.join(tmp8Plan, 'milestones', 'v9.0', 'phases');
    fs.mkdirSync(tmp8Phases, { recursive: true });
    fs.mkdirSync(path.join(tmp8Phases, '01-alpha'), { recursive: true });
    fs.mkdirSync(path.join(tmp8Phases, '02-beta'), { recursive: true });
    fs.mkdirSync(path.join(tmp8Phases, '03-gamma'), { recursive: true });
    const all8 = auditAllPhases(tmp8Plan, { milestone: 'v9.0', includeUnarchived: false });
    let sortedOk = true;
    for (let i = 1; i < all8.length; i++) {
      if (all8[i - 1].phase_dir > all8[i].phase_dir) { sortedOk = false; break; }
    }
    assert('8. auditAllPhases 3-phase fixture -> 3 audits in deterministic codepoint order',
      Array.isArray(all8) && all8.length === 3 && sortedOk);

    // 9. auditAllPhases over tmp with TWO milestones honors opts.milestone filter.
    const tmp9Plan = path.join(tmp, 'plan9');
    const tmp9PhasesA = path.join(tmp9Plan, 'milestones', 'v8.0', 'phases');
    const tmp9PhasesB = path.join(tmp9Plan, 'milestones', 'v8.1', 'phases');
    fs.mkdirSync(path.join(tmp9PhasesA, '10-alpha'), { recursive: true });
    fs.mkdirSync(path.join(tmp9PhasesA, '11-beta'), { recursive: true });
    fs.mkdirSync(path.join(tmp9PhasesB, '20-gamma'), { recursive: true });
    fs.mkdirSync(path.join(tmp9PhasesB, '21-delta'), { recursive: true });
    const all9 = auditAllPhases(tmp9Plan, { milestone: 'v8.1', includeUnarchived: false });
    const all9Names = all9.map(function (r) { return r.folder_name; }).sort();
    assert('9. auditAllPhases milestone filter -> only v8.1 phase folders returned',
      Array.isArray(all9) && all9.length === 2 &&
      all9Names[0] === '20-gamma' && all9Names[1] === '21-delta');

    // 10. renderTable on 3-row fixture -> contains locked column header, 3 phase rows, soft-warn footer.
    const fixtureRows = [
      { phase_dir: '/x/40-a', phase_num: '40', folder_name: '40-a', verdict: 'compliant',
        required_present: [], required_missing: [],
        recommended_present: [], recommended_missing: [] },
      { phase_dir: '/x/41-b', phase_num: '41', folder_name: '41-b', verdict: 'partial',
        required_present: [], required_missing: [],
        recommended_present: [], recommended_missing: ['41-ATC-REVIEW.md'] },
      { phase_dir: '/x/42-c', phase_num: '42', folder_name: '42-c', verdict: 'non-compliant',
        required_present: [], required_missing: ['42-CONTEXT.md'],
        recommended_present: [], recommended_missing: [] },
    ];
    const md10 = renderTable(fixtureRows);
    assert('10. renderTable 3-row fixture -> locked column header + 3 phase rows + soft-warn footer',
      typeof md10 === 'string' &&
      md10.indexOf('| phase | folder | verdict | required missing | recommended missing |') >= 0 &&
      md10.indexOf('| 40 | 40-a |') >= 0 &&
      md10.indexOf('| 41 | 41-b |') >= 0 &&
      md10.indexOf('| 42 | 42-c |') >= 0 &&
      md10.indexOf('> Soft-warn only.') >= 0);

    // 11. renderTable([]) -> exact literal '(no phase folders found for this milestone)'.
    const md11 = renderTable([]);
    assert('11. renderTable([]) returns no-folders-found literal (NOT a thrown exception)',
      typeof md11 === 'string' &&
      md11.indexOf('(no phase folders found for this milestone)') >= 0);

    // 12. auditFolder fixture with TWO matching {NN}-*-PLAN.md files -> verdict=compliant.
    const dir12 = path.join(tmp, 'fix12', '40-fixture-multi-plan');
    fs.mkdirSync(dir12, { recursive: true });
    const filesMultiPlan = [
      '40-CONTEXT.md', '40-RESEARCH.md',
      '40-01-foo-PLAN.md', '40-02-bar-PLAN.md',
      '40-VERIFICATION.md',
      '40-ATC-REVIEW.md', 'commit-reviews.jsonl', '40-codex-review.md', 'WASTE.md',
    ];
    for (const f of filesMultiPlan) {
      fs.writeFileSync(path.join(dir12, f), '', 'utf8');
    }
    const r12 = auditFolder(dir12);
    assert('12. auditFolder with 2 matching PLAN files -> verdict=compliant (minCount=1, NOT maxCount=1)',
      r12 && r12.verdict === 'compliant' &&
      r12.required_missing.length === 0);

    // 13. Fingerprint guard: capture AFTER all work and deep-equal-compare.
    // Skip-on-absent allowed (RESEARCH sec 7.3): when before[i].exists === false
    // && after[i].exists === false, treat as ok with stderr warn.
    const after = samplePhaseFolders.map(_fingerprintDir);
    let fingerprintOk = true;
    let fingerprintDetail = '';
    for (let i = 0; i < samplePhaseFolders.length; i++) {
      const b = before[i];
      const a = after[i];
      if (!b.exists && !a.exists) {
        console.warn('[SGSD] audit self-test: live fixture ' + samplePhaseFolders[i] + ' absent; skipping');
        continue;
      }
      if (!_fingerprintEqual(b, a)) {
        fingerprintOk = false;
        fingerprintDetail = 'phase folder ' + samplePhaseFolders[i] + ' mutated by audit run';
        break;
      }
    }
    assert('13. fingerprint guard: 3 sample real phase folders untouched by self-test (AUDIT-04 binding)',
      fingerprintOk, fingerprintDetail);

  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('phase-folder-audit self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fail > 0) {
    for (const f of failures) {
      console.error('  FAIL: ' + f.name + (f.detail ? ' -- ' + f.detail : ''));
    }
    return 1;
  }
  return 0;
}

// ----------------------------------------------------------------------------
// CLI MAIN
// ----------------------------------------------------------------------------
if (require.main === module) {
  const cmd = process.argv[2];

  if (cmd === '--self-test') process.exit(selfTest());

  if (cmd === '--render' || cmd === '--json') {
    // Phase 36 W2 + Phase 39 W2 lesson:
    // NEVER cwd-defaulted -- silent wrong-tree trap.
    // audit.cjs at <repo>/super-gsd/tools/phase-folder-audit/audit.cjs;
    // canonical .planning at <repo>/.planning (3 dirs up).
    const idx = process.argv.indexOf('--planning-dir');
    const planningDir = (idx > 0 && process.argv[idx + 1])
      ? path.resolve(process.argv[idx + 1])
      : path.resolve(__dirname, '..', '..', '..', '.planning');
    const mIdx = process.argv.indexOf('--milestone');
    const opts = {};
    if (mIdx > 0 && process.argv[mIdx + 1]) opts.milestone = process.argv[mIdx + 1];
    const audits = auditAllPhases(planningDir, opts);
    if (cmd === '--render') {
      console.log(renderTable(audits));
    } else {
      console.log(JSON.stringify(audits, null, 2));
    }
    process.exit(0);  // AUDIT-03: exit 0 ALWAYS on render, never block.
  }

  // --help fallthrough.
  console.log('Usage:');
  console.log('  node audit.cjs --self-test');
  console.log('  node audit.cjs --render [--milestone <v>] [--planning-dir <p>]');
  console.log('  node audit.cjs --json   [--milestone <v>] [--planning-dir <p>]');
  console.log('  Or require() and call auditFolder / auditAllPhases / renderTable');
  console.log('  VERDICTS =', JSON.stringify(VERDICTS));
  process.exit(0);
}

module.exports = {
  // 3 public functions:
  auditFolder,
  auditAllPhases,
  renderTable,
  // 3 frozen constants:
  VERDICTS,
  REQUIRED_FILES,
  RECOMMENDED_FILES,
};
