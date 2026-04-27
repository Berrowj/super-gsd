// ============================================================================
// SGSD - GATE KEEP/KILL RUBRIC (Phase 39 -- RUBRIC-01..04)
// ============================================================================
// Source of truth: closed-enum mechanical recommendation over Phase 34
// review-ledger + Phase 36 gate-value-log + edge-guard-log + gates.yaml.
//
// Source: 39-RESEARCH.md sec 10 (LOCKED Q1-Q11) + 39-01-PLAN.md sec
// rubric_rule_locked.
//
// Failure contract (mirrored from gate-value-log.cjs:51-55 verbatim):
//   "this script NEVER throws upward at the orchestrator boundary"
// All public APIs (runRubric, renderTable, classifyGate) wrap internals in
// try/catch; on error stderr-warn + return falsey ([] or '(rubric render error)').
//
// Controlling correctness rule (RUBRIC-03):
//   "gates with 0 fires MUST classify as defer, NEVER kill"
//   This is the FIRST rule R1 in the closed-enum cascade. Self-test
//   assertion #4 + test fixture 1 are the binding tests.
//
// Lock 39=B (mass-discuss line 214 verbatim):
//   "Mechanical rubric + manual override at close" -- the rubric ONLY
//   recommends; the operator decides whether to act on `kill` rows. The
//   script NEVER mutates super-gsd/registry/gates.yaml or any registry file.
//
// Acceptance bindings:
//   RUBRIC-01: rubric reads 4 canonical sources (gate-value-log,
//              review-ledger, edge-guard-log, gates.yaml).
//   RUBRIC-02: every gate in gates.yaml gets a verdict in {keep, kill, defer}.
//   RUBRIC-03: defer-on-empty is the FIRST rule R1; null summary -> defer.
//   RUBRIC-04: SKILL.md Step 4.5 grep for `runRubric` returns >= 1.
//
// Canonical fingerprint guard (4 files, untouched by --self-test per Phase
// 32 W3 + Phase 36 W2 lessons):
//   .planning/metrics/gate-value-log.jsonl
//   .planning/metrics/review-ledger.jsonl
//   .planning/metrics/edge-guard-log.jsonl
//   super-gsd/registry/gates.yaml
//
// No external dependencies. Node built-ins only (fs/path/os). Manual minimal
// YAML parse for gates.yaml (regex on `- name:` rows). Mirrors Phase 36 +
// Phase 38 architecturally 1:1 per RESEARCH sec 9.
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// ----------------------------------------------------------------------------
// FROZEN CONSTANTS (RESEARCH sec 1.2 + sec 3.2 verbatim)
// ----------------------------------------------------------------------------

// VERDICTS: closed enum of 3 outcomes. Frozen.
const VERDICTS = Object.freeze(['keep', 'kill', 'defer']);

// KEEP_THRESHOLDS: rubric tuning constants. Frozen at RESEARCH sec 1.2 values.
// Asymmetry: kill bar (10 fires) > keep bar (5 fires) because killing is
// destructive; insufficient evidence defaults to defer, never default-kill.
const KEEP_THRESHOLDS = Object.freeze({
  keep_value_score:   0.5,
  kill_value_score:   0.2,
  min_fires_for_keep: 5,
  min_fires_for_kill: 10,
});

// REASONS: closed enum of 7 string keys (RESEARCH sec 3.2). Frozen.
// Each value is a literal string -- operator-readable, no prose translation
// at render time per RESEARCH sec 3.3.
const REASONS = Object.freeze({
  no_fires_yet:                              'no_fires_yet',
  value_score_indeterminate:                 'value_score_indeterminate',
  insufficient_evidence_for_kill:            'insufficient_evidence_for_kill',
  value_score_above_threshold:               'value_score_above_threshold',
  value_score_below_threshold_with_evidence: 'value_score_below_threshold_with_evidence',
  mid_value_score_or_low_fires:              'mid_value_score_or_low_fires',
  structural_emit_required:                  'structural_emit_required',
});

// ----------------------------------------------------------------------------
// PRIVATE HELPERS
// ----------------------------------------------------------------------------

// Read .planning/metrics/edge-guard-log.jsonl line-by-line; defensively skip
// malformed lines. Returns []  when file absent (RESEARCH sec 11.1: "may not
// exist"). Filters to rows where row.gate === gateName (and optionally to rows
// where row.ts >= milestoneStartIso when provided; null = no time filter).
function _readEdgeGuardRows(planningDir, gateName, milestoneStartIso) {
  try {
    if (!planningDir) return [];
    const p = path.join(planningDir, 'metrics', 'edge-guard-log.jsonl');
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) return [];
    const rows = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .filter((r) => r && r.gate === gateName);
    if (milestoneStartIso) {
      return rows.filter((r) => typeof r.ts === 'string' && r.ts >= milestoneStartIso);
    }
    return rows;
  } catch (e) {
    console.warn('[SGSD] rubric _readEdgeGuardRows failed:', e.message);
    return [];
  }
}

// Manual minimal YAML parse for gates.yaml. Walks lines, regex-matches
// `^\s*-\s+name:\s*(\S+)`. Returns array of { name } in document order.
// DO NOT add js-yaml dep (RESEARCH sec 11 zero-deps lock).
function _parseGatesYaml(yamlText) {
  if (typeof yamlText !== 'string' || !yamlText) return [];
  const out = [];
  const lines = yamlText.split(/\r?\n/);
  const re = /^\s*-\s+name:\s*([^\s#]+)/;
  for (const line of lines) {
    const m = line.match(re);
    if (m && m[1]) out.push({ name: m[1] });
  }
  return out;
}

// Read gates.yaml and parse to array of names. Defensive: returns [] on read
// or parse failure. Default path resolution: __dirname-anchored
// (lib at <repo>/super-gsd/tools/gate-keep-kill/rubric.cjs;
//  registry at <repo>/super-gsd/registry/gates.yaml -- 2 dirs up + registry).
function _readGatesYaml(gatesYamlPath) {
  try {
    const p = gatesYamlPath
      || path.resolve(__dirname, '..', '..', 'registry', 'gates.yaml');
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    return _parseGatesYaml(text).map((g) => g.name);
  } catch (e) {
    console.warn('[SGSD] rubric _readGatesYaml failed:', e.message);
    return [];
  }
}

// Best-effort gate-name match for review-ledger rows. RESEARCH sec 1.4 says
// this is informational only (notes), so an imperfect match is acceptable.
// First-delivery: match on row._legacy.gate when present, else empty array.
function _filterReviewRowsForGate(rows, gateName) {
  if (!Array.isArray(rows) || !gateName) return [];
  return rows.filter((r) => r && r._legacy && r._legacy.gate === gateName);
}

// Compute review-ledger pass_rate for cross-check (RESEARCH sec 1.4).
// Returns null when 0 rows. Notes-only -- verdict NEVER changes from this.
function _computePassRate(reviewRows) {
  if (!Array.isArray(reviewRows) || reviewRows.length === 0) return null;
  let ok = 0, total = 0;
  for (const r of reviewRows) {
    if (!r || typeof r.status !== 'string') continue;
    if (r.status === 'ok' || r.status === 'warn'
        || r.status === 'fail' || r.status === 'blocked') {
      total++;
      if (r.status === 'ok') ok++;
    }
  }
  if (total === 0) return null;
  return ok / total;
}

// Compute soft-warning notes per RESEARCH sec 1.4 cross-check (notes-only).
function _computeNotes(summary, reviewRows, passRate) {
  const notes = [];
  const fires = (summary && typeof summary.fires === 'number') ? summary.fires : 0;
  const valueScore = (summary && summary.value_score !== undefined)
    ? summary.value_score : null;
  const reviewCount = Array.isArray(reviewRows) ? reviewRows.length : 0;
  // review_ledger_divergence: |pass_rate - value_score| >= 0.3 AND >= 5 rows in BOTH.
  if (passRate !== null && valueScore !== null
      && fires >= 5 && reviewCount >= 5
      && Math.abs(passRate - valueScore) >= 0.3) {
    notes.push('review_ledger_divergence');
  }
  // review_ledger_uncovered: 0 review-ledger rows AND >= 5 gate-value-log fires.
  if (reviewCount === 0 && fires >= 5) {
    notes.push('review_ledger_uncovered');
  }
  return notes;
}

// ----------------------------------------------------------------------------
// PUBLIC FUNCTION: classifyGate
// ----------------------------------------------------------------------------
// PURE function (RESEARCH sec 5.1 Q10 lock); no I/O; no console; deterministic.
//
// Signature: classifyGate(gateName, summary, reviewRows, edgeRows) -> RubricRow
//
// summary:    null OR { fires: int>=0, value_score: number|null, pass?, warn?, block?, skip? }
// reviewRows: array of review-ledger envelope rows (may be empty)
// edgeRows:   array of edge-guard-log rows for THIS gate (may be empty)
//
// Returns RubricRow per RESEARCH sec 3.1:
//   { gate, verdict, fires, value_score, pass_rate, reason, notes }
//
// PRE-RULE (RESEARCH sec 1.3): edge-guard halt override forces verdict=keep
// regardless of value_score. Runs BEFORE R1.
//
// First-match-wins cascade (R1-R6, RESEARCH sec 1.2 verbatim -- DO NOT REORDER).
function classifyGate(gateName, summary, reviewRows, edgeRows) {
  const passRate = _computePassRate(reviewRows);
  const notes    = _computeNotes(summary, reviewRows, passRate);
  const fires    = (summary && typeof summary.fires === 'number') ? summary.fires : 0;
  const valueScore = (summary && summary.value_score !== undefined)
    ? summary.value_score : null;

  // PRE-RULE: edge-guard halt override (RESEARCH sec 1.3 lock).
  // Any halt row in window forces keep. Beats R5 kill, beats every other rule.
  if (Array.isArray(edgeRows)) {
    for (const er of edgeRows) {
      if (er && er.resolution === 'halt') {
        return {
          gate:        gateName,
          verdict:     'keep',
          fires,
          value_score: valueScore,
          pass_rate:   passRate,
          reason:      REASONS.structural_emit_required,
          notes,
        };
      }
    }
  }

  // R1: fires === 0 (RUBRIC-03 primary; defer-on-empty).
  if (!summary || fires === 0) {
    return {
      gate:        gateName,
      verdict:     'defer',
      fires:       0,
      value_score: null,
      pass_rate:   passRate,
      reason:      REASONS.no_fires_yet,
      notes,
    };
  }

  // R2: value_score === null (after R1 -- fires > 0 but score indeterminate).
  if (valueScore === null) {
    return {
      gate:        gateName,
      verdict:     'defer',
      fires,
      value_score: null,
      pass_rate:   passRate,
      reason:      REASONS.value_score_indeterminate,
      notes,
    };
  }

  // R3: insufficient evidence for kill (RUBRIC-03 secondary).
  // fires < min_fires_for_kill AND value_score < kill_value_score
  if (fires < KEEP_THRESHOLDS.min_fires_for_kill
      && valueScore < KEEP_THRESHOLDS.kill_value_score) {
    return {
      gate:        gateName,
      verdict:     'defer',
      fires,
      value_score: valueScore,
      pass_rate:   passRate,
      reason:      REASONS.insufficient_evidence_for_kill,
      notes,
    };
  }

  // R4: keep -- value_score >= keep_value_score AND fires >= min_fires_for_keep.
  if (valueScore >= KEEP_THRESHOLDS.keep_value_score
      && fires >= KEEP_THRESHOLDS.min_fires_for_keep) {
    return {
      gate:        gateName,
      verdict:     'keep',
      fires,
      value_score: valueScore,
      pass_rate:   passRate,
      reason:      REASONS.value_score_above_threshold,
      notes,
    };
  }

  // R5: kill -- value_score < kill_value_score AND fires >= min_fires_for_kill.
  if (valueScore < KEEP_THRESHOLDS.kill_value_score
      && fires >= KEEP_THRESHOLDS.min_fires_for_kill) {
    return {
      gate:        gateName,
      verdict:     'kill',
      fires,
      value_score: valueScore,
      pass_rate:   passRate,
      reason:      REASONS.value_score_below_threshold_with_evidence,
      notes,
    };
  }

  // R6: fallthrough -- mid value_score or low fires.
  return {
    gate:        gateName,
    verdict:     'defer',
    fires,
    value_score: valueScore,
    pass_rate:   passRate,
    reason:      REASONS.mid_value_score_or_low_fires,
    notes,
  };
}

// ----------------------------------------------------------------------------
// PUBLIC FUNCTION: runRubric
// ----------------------------------------------------------------------------
// runRubric(planningDir, opts) -> RubricRow[] (one per gate in gates.yaml).
//
// opts: { milestone?, gatesYamlPath? }
//   milestone:     pass through to summarize()/readReviewRows() filters
//   gatesYamlPath: override default __dirname-anchored gates.yaml location
//
// Wraps body in try/catch returning [] on error (never throws upward).
function runRubric(planningDir, opts) {
  try {
    const o = opts || {};
    const gateNames = _readGatesYaml(o.gatesYamlPath);
    if (gateNames.length === 0) return [];

    // Require Phase 36 + Phase 34 libs (anchored to __dirname for safety;
    // lib lives at <repo>/super-gsd/tools/gate-keep-kill/rubric.cjs).
    const gateValueLogPath = path.resolve(
      __dirname, '..', '..', 'scripts', 'lib', 'gate-value-log.cjs');
    const reviewLedgerPath = path.resolve(
      __dirname, '..', '..', 'scripts', 'lib', 'review-ledger.cjs');
    const { summarize }       = require(gateValueLogPath);
    const { readReviewRows }  = require(reviewLedgerPath);

    // Pull all summaries once (Phase 36 lib). Filter by milestone if provided.
    const allSummaries = summarize(
      planningDir, o.milestone ? { milestone: o.milestone } : {});
    const summaryByGate = new Map(
      Array.isArray(allSummaries) ? allSummaries.map((s) => [s.gate, s]) : []);

    // Pull all review rows once (Phase 34 lib). Filter per gate locally.
    const allReviewRows = readReviewRows(
      planningDir, o.milestone ? { milestone: o.milestone } : {});

    // Phase 39 ATC W1 fix: derive milestoneStart from earliest review row ts
    // (or milestone-readiness file when available). Pre-fix hardcoded to null
    // meant edge-guard rows were never time-filtered even when --milestone was
    // passed; the milestoneStartIso parameter of _readEdgeGuardRows was
    // permanently unreachable in production.
    let milestoneStart = null;
    if (o.milestone && allReviewRows.length > 0) {
      // Earliest review timestamp for this milestone is a defensible
      // approximation: review-ledger rows for milestone X bracket the
      // milestone's active window. If readiness file exists, prefer its
      // `created:` field for tighter bound.
      const readinessPath = path.join(
        planningDir, 'milestones', o.milestone, 'MILESTONE-READINESS.md'
      );
      if (fs.existsSync(readinessPath)) {
        try {
          const m = fs.readFileSync(readinessPath, 'utf8').match(/^created:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}(?:T[^\s]*)?)/m);
          if (m) milestoneStart = m[1];
        } catch (_e) { /* fall through to review-row fallback */ }
      }
      if (!milestoneStart) {
        const tsList = allReviewRows.map((r) => r.ts).filter((t) => typeof t === 'string').sort();
        if (tsList.length > 0) milestoneStart = tsList[0];
      }
    }

    // Build one RubricRow per gateName (gates.yaml document order).
    const rows = [];
    for (const gateName of gateNames) {
      const summary    = summaryByGate.get(gateName) || null;
      const reviewRows = _filterReviewRowsForGate(allReviewRows, gateName);
      const edgeRows   = _readEdgeGuardRows(planningDir, gateName, milestoneStart);
      rows.push(classifyGate(gateName, summary, reviewRows, edgeRows));
    }
    return rows;
  } catch (e) {
    console.warn('[SGSD] rubric runRubric failed:', e.message);
    return [];
  }
}

// ----------------------------------------------------------------------------
// PUBLIC FUNCTION: renderTable
// ----------------------------------------------------------------------------
// renderTable(rows) -> markdown table string.
//
// Column order locked at RESEARCH sec 3.3:
//   | gate | verdict | fires | value_score | pass_rate | reason | notes |
//
// Render rules:
//   verdict:     **bold** for kill, plain for keep, *italic* for defer
//   value_score: 2-decimal-place when non-null, literal "--" when null
//   pass_rate:   same rule
//   reason:      literal REASONS value (no prose translation)
//   notes:       joined with "; " separator, or "--" when empty
//
// Wraps body in try/catch returning '(rubric render error)' on failure.
function renderTable(rows) {
  try {
    if (!Array.isArray(rows)) return '(rubric render error)';
    const header    = '| gate | verdict | fires | value_score | pass_rate | reason | notes |';
    const separator = '|------|---------|-------|-------------|-----------|--------|-------|';
    const lines = [header, separator];
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const verdictCell =
          r.verdict === 'kill'  ? `**${r.verdict}**`
        : r.verdict === 'defer' ? `*${r.verdict}*`
        : String(r.verdict);
      const firesCell = String(r.fires);
      const valueCell = (r.value_score === null || r.value_score === undefined)
        ? '--' : Number(r.value_score).toFixed(2);
      const passCell  = (r.pass_rate === null || r.pass_rate === undefined)
        ? '--' : Number(r.pass_rate).toFixed(2);
      const notesCell = (Array.isArray(r.notes) && r.notes.length)
        ? r.notes.join('; ') : '--';
      lines.push(`| ${r.gate} | ${verdictCell} | ${firesCell} | ${valueCell} | ${passCell} | ${r.reason} | ${notesCell} |`);
    }
    return lines.join('\n') + '\n';
  } catch (e) {
    console.warn('[SGSD] rubric renderTable failed:', e.message);
    return '(rubric render error)';
  }
}

// ----------------------------------------------------------------------------
// SELF-TEST (RESEARCH sec 7) -- 14 assertions
// ----------------------------------------------------------------------------
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Capture canonical fingerprint BEFORE any work, anchored to __dirname.
  // Lib at <repo>/super-gsd/tools/gate-keep-kill/rubric.cjs;
  // canonicals at <repo>/.planning/metrics/* + <repo>/super-gsd/registry/gates.yaml.
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const canonicals = [
    path.join(repoRoot, '.planning', 'metrics', 'gate-value-log.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'review-ledger.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'edge-guard-log.jsonl'),
    path.join(repoRoot, 'super-gsd', 'registry', 'gates.yaml'),
  ];
  const before = canonicals.map((p) => fs.existsSync(p)
    ? { exists: true, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size }
    : { exists: false, mtime: 0, size: 0 });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rubric-'));
  try {
    // 1. VERDICTS frozen, length 3, equals ['keep','kill','defer'].
    let verdictsFrozen = false;
    try { VERDICTS.push('banana'); } catch (e) { verdictsFrozen = true; }
    assert('1. VERDICTS frozen + length 3 + [keep,kill,defer]',
      Array.isArray(VERDICTS) && VERDICTS.length === 3 &&
      VERDICTS[0] === 'keep' && VERDICTS[1] === 'kill' && VERDICTS[2] === 'defer' &&
      verdictsFrozen);

    // 2. KEEP_THRESHOLDS frozen, exactly 4 keys, values match RESEARCH sec 1.2.
    const ktKeys = Object.keys(KEEP_THRESHOLDS);
    assert('2. KEEP_THRESHOLDS frozen + 4 keys + RESEARCH 1.2 values',
      Object.isFrozen(KEEP_THRESHOLDS) && ktKeys.length === 4 &&
      KEEP_THRESHOLDS.keep_value_score === 0.5 &&
      KEEP_THRESHOLDS.kill_value_score === 0.2 &&
      KEEP_THRESHOLDS.min_fires_for_keep === 5 &&
      KEEP_THRESHOLDS.min_fires_for_kill === 10);

    // 3. REASONS frozen, exactly 7 keys, values match RESEARCH sec 3.2.
    const rKeys = Object.keys(REASONS);
    assert('3. REASONS frozen + 7 keys + RESEARCH 3.2 values',
      Object.isFrozen(REASONS) && rKeys.length === 7 &&
      REASONS.no_fires_yet === 'no_fires_yet' &&
      REASONS.value_score_indeterminate === 'value_score_indeterminate' &&
      REASONS.insufficient_evidence_for_kill === 'insufficient_evidence_for_kill' &&
      REASONS.value_score_above_threshold === 'value_score_above_threshold' &&
      REASONS.value_score_below_threshold_with_evidence === 'value_score_below_threshold_with_evidence' &&
      REASONS.mid_value_score_or_low_fires === 'mid_value_score_or_low_fires' &&
      REASONS.structural_emit_required === 'structural_emit_required');

    // 4. RUBRIC-03 primary: classifyGate('g1', null, [], []) -> defer + no_fires_yet.
    const r4 = classifyGate('g1', null, [], []);
    assert('4. RUBRIC-03 primary: null summary -> defer + no_fires_yet',
      r4 && r4.gate === 'g1' && r4.verdict === 'defer' &&
      r4.reason === REASONS.no_fires_yet && r4.fires === 0 && r4.value_score === null);

    // 5. R4: classifyGate('g2', {fires:5, value_score:0.8}, [], []) -> keep + value_score_above_threshold.
    const r5 = classifyGate('g2', { fires: 5, value_score: 0.8 }, [], []);
    assert('5. R4: high-fires high-value -> keep + value_score_above_threshold',
      r5 && r5.verdict === 'keep' &&
      r5.reason === REASONS.value_score_above_threshold &&
      r5.fires === 5 && r5.value_score === 0.8);

    // 6. R5: classifyGate('g3', {fires:10, value_score:0.1}, [], []) -> kill.
    const r6 = classifyGate('g3', { fires: 10, value_score: 0.1 }, [], []);
    assert('6. R5: high-fires low-value -> kill + value_score_below_threshold_with_evidence',
      r6 && r6.verdict === 'kill' &&
      r6.reason === REASONS.value_score_below_threshold_with_evidence &&
      r6.fires === 10 && r6.value_score === 0.1);

    // 7. RUBRIC-03 secondary: fires < kill_bar AND value_score < kill_value -> defer.
    const r7 = classifyGate('g4', { fires: 7, value_score: 0.1 }, [], []);
    assert('7. RUBRIC-03 secondary: mid-fires low-value -> defer + insufficient_evidence_for_kill',
      r7 && r7.verdict === 'defer' &&
      r7.reason === REASONS.insufficient_evidence_for_kill);

    // 8. R6 fallthrough: low-fires mid-value -> defer + mid_value_score_or_low_fires.
    const r8 = classifyGate('g5', { fires: 4, value_score: 0.7 }, [], []);
    assert('8. R6: low-fires mid-value -> defer + mid_value_score_or_low_fires',
      r8 && r8.verdict === 'defer' &&
      r8.reason === REASONS.mid_value_score_or_low_fires);

    // 9. R2: value_score === null -> defer + value_score_indeterminate.
    const r9 = classifyGate('g6', { fires: 5, value_score: null }, [], []);
    assert('9. R2: fires>0 + value_score=null -> defer + value_score_indeterminate',
      r9 && r9.verdict === 'defer' &&
      r9.reason === REASONS.value_score_indeterminate);

    // 10. PRE-RULE: edge-guard halt override on low-value gate -> keep.
    // Even at kill thresholds (fires=12, value_score=0.05), halt forces keep.
    const r10 = classifyGate('g7',
      { fires: 12, value_score: 0.05 },
      [],
      [{ ts: '2026-04-27T00:00:00.000Z', gate: 'g7', resolution: 'halt' }]);
    assert('10. PRE-RULE: halt override beats R5 kill -> keep + structural_emit_required',
      r10 && r10.verdict === 'keep' &&
      r10.reason === REASONS.structural_emit_required);

    // 11. runRubric integration: 3-gate fixture -> 3 rows valid shape.
    const tmp11Yaml = path.join(tmp, 'gates-3.yaml');
    fs.writeFileSync(tmp11Yaml,
      'gates:\n' +
      '  - name: alpha\n' +
      '  - name: beta\n' +
      '  - name: gamma\n', 'utf8');
    const tmp11Plan = path.join(tmp, 'planning-11');
    fs.mkdirSync(path.join(tmp11Plan, 'metrics'), { recursive: true });
    const rows11 = runRubric(tmp11Plan, { gatesYamlPath: tmp11Yaml });
    assert('11. runRubric over 3-gate fixture -> 3 rows with valid verdict + reason',
      Array.isArray(rows11) && rows11.length === 3 &&
      rows11.every((r) => VERDICTS.includes(r.verdict) &&
        typeof r.reason === 'string' && r.reason.length > 0 &&
        typeof r.gate === 'string'));

    // 12. renderTable on 13-gate fixture -> 13 rows + header per RESEARCH sec 3.3.
    const fixtureRows = [];
    for (let i = 0; i < 13; i++) {
      fixtureRows.push({
        gate: `gate_${i}`,
        verdict: VERDICTS[i % 3],
        fires: i,
        value_score: i === 0 ? null : Math.min(1, 0.1 * i),
        pass_rate: i % 2 === 0 ? null : 0.5,
        reason: REASONS.no_fires_yet,
        notes: i === 5 ? ['review_ledger_uncovered'] : [],
      });
    }
    const md12 = renderTable(fixtureRows);
    const md12Lines = md12.split('\n').filter(Boolean);
    // Expected: header + separator + 13 rows = 15 non-empty lines
    assert('12. renderTable 13-row fixture -> header + 13 rows in RESEARCH 3.3 column order',
      typeof md12 === 'string' &&
      md12.indexOf('| gate | verdict | fires | value_score | pass_rate | reason | notes |') === 0 &&
      md12Lines.length === 15);

    // 13. Defensive read: malformed line in tmp gate-value-log skipped.
    const tmp13Plan = path.join(tmp, 'planning-13');
    fs.mkdirSync(path.join(tmp13Plan, 'metrics'), { recursive: true });
    // Write malformed + valid edge-guard rows for a gate
    const edgeLogPath = path.join(tmp13Plan, 'metrics', 'edge-guard-log.jsonl');
    fs.writeFileSync(edgeLogPath,
      JSON.stringify({ ts: '2026-04-27T00:00:00.000Z', gate: 'eg1', resolution: 'log-only' }) + '\n' +
      '{not-json\n' +
      JSON.stringify({ ts: '2026-04-27T00:00:01.000Z', gate: 'eg1', resolution: 'halt' }) + '\n',
      'utf8');
    const eg13 = _readEdgeGuardRows(tmp13Plan, 'eg1', null);
    assert('13. defensive read: malformed line skipped; surrounding rows used',
      Array.isArray(eg13) && eg13.length === 2 &&
      eg13[0].resolution === 'log-only' && eg13[1].resolution === 'halt');

    // 14. Fingerprint guard: mtime+size of 4 canonical files unchanged.
    const after = canonicals.map((p) => fs.existsSync(p)
      ? { exists: true, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size }
      : { exists: false, mtime: 0, size: 0 });
    let fingerprintOk = true;
    let fingerprintDetail = '';
    for (let i = 0; i < canonicals.length; i++) {
      if (before[i].exists !== after[i].exists ||
          before[i].mtime !== after[i].mtime ||
          before[i].size !== after[i].size) {
        fingerprintOk = false;
        fingerprintDetail = `canonical[${i}]=${canonicals[i]} changed`;
        break;
      }
    }
    assert('14. canonical 4-file fingerprint untouched by self-test',
      fingerprintOk, fingerprintDetail);

  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`gate-keep-kill rubric self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
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
    // Phase 36 W2 lesson: NEVER process.cwd() default -- silent wrong-ledger trap.
    // Lib at <repo>/super-gsd/tools/gate-keep-kill/rubric.cjs;
    // canonical .planning at <repo>/.planning (3 dirs up).
    const idx = process.argv.indexOf('--planning-dir');
    const planningDir = (idx > 0 && process.argv[idx + 1])
      ? path.resolve(process.argv[idx + 1])
      : path.resolve(__dirname, '..', '..', '..', '.planning');
    const mIdx = process.argv.indexOf('--milestone');
    const opts = {};
    if (mIdx > 0 && process.argv[mIdx + 1]) opts.milestone = process.argv[mIdx + 1];
    const rows = runRubric(planningDir, opts);
    if (cmd === '--render') {
      console.log(renderTable(rows));
    } else {
      console.log(JSON.stringify(rows, null, 2));
    }
    process.exit(0);
  }

  console.log('Usage:');
  console.log('  node rubric.cjs --self-test');
  console.log('  node rubric.cjs --render [--milestone <id>] [--planning-dir <path>]');
  console.log('  node rubric.cjs --json   [--milestone <id>] [--planning-dir <path>]');
  console.log('  Or require() and call runRubric / renderTable / classifyGate');
  console.log('  VERDICTS =', JSON.stringify(VERDICTS));
  console.log('  KEEP_THRESHOLDS =', JSON.stringify(KEEP_THRESHOLDS));
  process.exit(0);
}

module.exports = {
  // 3 public functions:
  runRubric,
  renderTable,
  classifyGate,
  // 3 frozen constants:
  KEEP_THRESHOLDS,
  VERDICTS,
  REASONS,
};
