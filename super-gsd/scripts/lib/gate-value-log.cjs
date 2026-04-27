// ============================================================================
// SGSD - GATE-VALUE-LOG canonical writer for gate-fitness telemetry
// ============================================================================
// Source of truth: .planning/metrics/gate-value-log.jsonl (machine-readable)
// No rendered .md view in v1.8 (per 36-RESEARCH.md sec 9 / Q13 lock: deferred).
//
// Append-only. Every row is a valid command-envelope-v1 row PLUS three
// extension fields: `gate`, `outcome`, `retroactive`. envelope-v1 contract is
// `additionalProperties: true` so the extension fields ride along without any
// schema bump (Phase 31 contract preserved; collides_with: [] still holds).
//
// Phase 36 (36=B) ships THREE wire-ins inside super-gsd/skills/sgsd-orchestrate
// /SKILL.md, covering the three verdict-bearing gates that emit review
// evidence: phase-level-ATC (Step 6.5), per-dispatch-ATC (Step 9.5), and
// MUDA-waste-audit (Step 6.55). Each site writes both a SKIP arm and a FIRE
// arm (6 calls total). Gates that do not emit a verdict are out of scope per
// the known_dead_ends list in 36-01-PLAN.md.
//
// Schema per row (one JSON object per line):
//   {
//     envelope_version: 1,
//     ts:               ISO-8601,
//     command:          "logGateValue",
//     status:           ok|warn|fail|skipped|timeout|blocked  (derived from outcome),
//     reason_codes:     string[] (envelope-v1 vocab; defaults from OUTCOME_REASON_CODES),
//     artifacts:        {kind,path}[],
//     evidence:         {kind,ref}[],
//     next_action:      string|null,
//     risk:             low|medium|high|null,
//     duration_ms:      number|null,
//     run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex),
//     phase:            string|null,
//     milestone:        string|null,
//     gate:             string                 (Phase 36 extension; non-empty),
//     outcome:          pass|warn|block|skip   (Phase 36 extension; closed enum),
//     retroactive:      object                 (Phase 36 extension; gates.yaml snapshot)
//   }
//
// Public API: logGateValue, readGateValueRows, summarize, ledgerPath,
// outcomeFromVerdict. See 36-RESEARCH.md sec 7 for derivation. All five wrap
// internals in try/catch and never throw upward.
//
// Locked design: per 36-RESEARCH.md sec 10 (Q1-Q15) and the "single-plan"
// recommendation in 36-RESEARCH.md sec 11. Mirrors route-ledger.cjs (Phase 32)
// and review-ledger.cjs (Phase 34) 1:1 for shape, fingerprint guard, frozen
// const enums, manual envelope-v1 schema check, defensive read.
//
// No cost telemetry (locked 36=B "no cost"; mass-discuss line 211). Cost is a
// v2.0+ ops concern. duration_ms is the standard envelope-v1 field, NOT cost.
//
// Failure contract: this writer NEVER throws upward at the orchestrator
// boundary. Closed-enum violations raise inside _appendRowInternal but the
// public helper logGateValue wraps every call in try/catch; on error it
// console.warns to stderr and returns false. Mirrors route-ledger.cjs:42-51
// and review-ledger.cjs:50-51 verbatim wording.
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// GVAL-03: closed enum of 4 outcomes. Frozen.
const OUTCOMES = Object.freeze(['pass', 'warn', 'block', 'skip']);

// envelope-v1 status enum. Frozen. Mirrors route-ledger.cjs:67-69.
const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);

// Outcome -> envelope status derivation (locked Q5 -- outcome wins).
// Phase 36 ATC CRIT fix: 'block' outcome maps to envelope status 'blocked',
// matching review-ledger.cjs:69 LEGACY_VERDICT_MAP['critical-halt'].status.
// Cross-ledger consumer parity preserved so Phase 39 rubric and Phase 38
// sampling-decider see identical envelope status for the same hard-halt
// verdict class across both gate-FITNESS (this lib) and gate-OUTPUT
// (review-ledger) data streams.
const OUTCOME_STATUS_MAP = Object.freeze({
  'pass':  'ok',
  'warn':  'warn',
  'block': 'blocked',
  'skip':  'skipped',
});

// Outcome -> default reason_codes (locked Q14 extensible array).
// Reuses Phase 31 reason_codes vocabulary at command-envelope-v1.yaml:133-150.
const OUTCOME_REASON_CODES = Object.freeze({
  'pass':  Object.freeze(['review_unanimous_pass']),
  'warn':  Object.freeze(['atc_warn_only']),
  'block': Object.freeze(['atc_critical']),
  'skip':  Object.freeze(['gate_skip_with_reason']),
});

// Verdict -> outcome derivation. Mirrors review-ledger.cjs LEGACY_VERDICT_MAP.
const VERDICT_OUTCOME_MAP = Object.freeze({
  'pass':          'pass',
  'warn':          'warn',
  'critical':      'block',
  'critical-halt': 'block',
  'block':         'block',
  'skipped':       'skip',
});

const COMMAND_NAME     = 'logGateValue';
const ENVELOPE_VERSION = 1;
const LEDGER_REL       = path.join('metrics', 'gate-value-log.jsonl');

// run_id pattern matches envelope-v1.json:78. Identical to
// route-ledger.cjs:88-89 + review-ledger.cjs:84-85 by Q10 lock.
const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

function ledgerPath(planningDir) {
  return path.join(planningDir, LEDGER_REL);
}

// run_id pattern: ISO ts + 4 hex chars. Mirrors route-ledger.cjs:80-84.
// Example: 2026-04-27T11:32:01.123Z-a1b2
function generateRunId() {
  const ts = new Date().toISOString();
  const rand = crypto.randomBytes(2).toString('hex');
  return `${ts}-${rand}`;
}

// Pure helper exported for SKILL.md wire-ins. Maps a review verdict
// (or numeric criticalCount/warningCount fallback) to an OUTCOMES enum value.
// Unknown verdict -> 'warn' (mirrors review-ledger Q9 lock).
//
// Phase 36 ATC CRIT 2 fix: the Codex shell path sets report.verdict=undefined
// (Codex output is {content, _provider, _model, _reasoning_effort}); the
// orchestrator extracts verdict from content downstream. The wire-in passes
// undefined verdict here, so we MUST consult both criticalCount AND
// warningCount to classify correctly. Pre-fix: critical=0 bypassed the warn
// path and returned 'pass' regardless of warning_count, misclassifying
// Codex reviews with 0 CRIT but >=1 WARN as outcome=pass.
function outcomeFromVerdict(verdict, criticalCount, warningCount) {
  if (typeof verdict === 'string'
      && Object.prototype.hasOwnProperty.call(VERDICT_OUTCOME_MAP, verdict)) {
    return VERDICT_OUTCOME_MAP[verdict];
  }
  if (typeof criticalCount === 'number' && criticalCount > 0) return 'block';
  if (typeof warningCount === 'number' && warningCount > 0) return 'warn';
  if (typeof criticalCount === 'number' && criticalCount === 0) return 'pass';
  return 'warn'; // unknown -> warn
}

// Internal: validate + normalize a row. Throws on closed-enum violation.
// Caller responsible for catching (logGateValue wraps).
function _normalize(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('gate-value-log: row must be an object');
  }
  if (typeof row.gate !== 'string' || !row.gate) {
    throw new Error('gate-value-log: gate must be a non-empty string');
  }
  if (!row.outcome || !OUTCOMES.includes(row.outcome)) {
    throw new Error(
      `gate-value-log: outcome must be one of ${OUTCOMES.join(', ')}; got '${row.outcome}'`
    );
  }
  if (row.reason_codes !== undefined && !Array.isArray(row.reason_codes)) {
    throw new Error('gate-value-log: reason_codes must be an array (or omitted)');
  }
  if (row.artifacts !== undefined && !Array.isArray(row.artifacts)) {
    throw new Error('gate-value-log: artifacts must be an array (or omitted)');
  }
  if (row.evidence !== undefined && !Array.isArray(row.evidence)) {
    throw new Error('gate-value-log: evidence must be an array (or omitted)');
  }

  const status = OUTCOME_STATUS_MAP[row.outcome];
  const defaultCodes = OUTCOME_REASON_CODES[row.outcome].slice();
  const callerCodes = Array.isArray(row.reason_codes) ? row.reason_codes.slice() : [];
  // Default codes first; caller may append (Q14 extensible).
  const reasonCodes = defaultCodes.concat(callerCodes.filter((c) => !defaultCodes.includes(c)));

  // retroactive snapshot at fire time (Q3 lock).
  // Caller passes gates.getGate(name) result; we accept any object and
  // copy enforcement_mode, category, step, version through. If the
  // caller passes nothing, we record an empty object so consumers see a
  // stable shape.
  const retro = (row.retroactive && typeof row.retroactive === 'object')
    ? {
        enforcement_mode: row.retroactive.enforcement_mode || null,
        category:         row.retroactive.category         || null,
        step:             row.retroactive.step             || null,
        gate_version:     row.retroactive.version          || row.retroactive.gate_version || null,
      }
    : { enforcement_mode: null, category: null, step: null, gate_version: null };

  return {
    envelope_version: ENVELOPE_VERSION,
    ts:               row.ts || new Date().toISOString(),
    command:          COMMAND_NAME,
    status,                                            // derived from outcome
    reason_codes:     reasonCodes,
    artifacts:        Array.isArray(row.artifacts) ? row.artifacts.slice() : [],
    evidence:         Array.isArray(row.evidence)  ? row.evidence.slice()  : [],
    next_action:      row.next_action ?? null,
    risk:             row.risk ?? null,
    duration_ms:      typeof row.duration_ms === 'number' ? row.duration_ms : null,
    run_id:           row.run_id || generateRunId(),
    phase:            row.phase ?? null,
    milestone:        row.milestone ?? null,
    // Phase 36 extension fields (envelope-v1 additionalProperties: true):
    gate:             row.gate,
    outcome:          row.outcome,
    retroactive:      retro,
  };
}

// Manual envelope-v1 schema check (no ajv dep). Asserts every emitted row
// has the 13 required envelope-v1 fields with the correct types and that
// evidence/artifacts inner shapes match the envelope schema. Throws on
// violation -- the public-API try/catch wraps it (writer never throws upward).
// Mirrors route-ledger.cjs:141-171 verbatim with prefix swap.
function _assertEnvelopeV1(row) {
  // Required-field presence check (envelope-v1.json:7).
  const required = ['envelope_version', 'ts', 'command', 'status', 'reason_codes',
    'artifacts', 'evidence', 'next_action', 'risk', 'duration_ms', 'run_id', 'phase', 'milestone'];
  for (const k of required) {
    if (!(k in row)) throw new Error(`gate-value-log: emitted row missing required envelope-v1 field '${k}'`);
  }
  // envelope_version is const 1.
  if (row.envelope_version !== 1) {
    throw new Error(`gate-value-log: envelope_version must be 1 (got ${row.envelope_version})`);
  }
  // run_id pattern (envelope-v1.json:78).
  if (!RUN_ID_REGEX.test(row.run_id)) {
    throw new Error(`gate-value-log: run_id violates envelope-v1 pattern (got '${row.run_id}')`);
  }
  // Phase 36 ATC W3 fix: status must be in STATUSES enum (envelope-v1.json:25
  // 6-state command-output enum). STATUSES is exported as the validation enum;
  // the schema guard now actually consults it so a future _normalize regression
  // emitting an out-of-range status is rejected at write time, not silently
  // serialized for downstream consumers to choke on.
  if (!STATUSES.includes(row.status)) {
    throw new Error(`gate-value-log: status must be one of ${STATUSES.join(', ')} (got '${row.status}')`);
  }
  // duration_ms is integer | null with min 0.
  if (row.duration_ms !== null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
    throw new Error(`gate-value-log: duration_ms must be non-negative integer or null (got ${row.duration_ms})`);
  }
  // evidence items shape: {kind, ref}. artifacts items shape: {kind, path}.
  for (const e of row.evidence) {
    if (!e || typeof e.kind !== 'string' || !e.kind || typeof e.ref !== 'string' || !e.ref) {
      throw new Error(`gate-value-log: evidence item must be {kind:string, ref:string} (got ${JSON.stringify(e)})`);
    }
  }
  for (const a of row.artifacts) {
    if (!a || typeof a.kind !== 'string' || !a.kind || typeof a.path !== 'string' || !a.path) {
      throw new Error(`gate-value-log: artifacts item must be {kind:string, path:string} (got ${JSON.stringify(a)})`);
    }
  }
}

// Low-level append. Throws on validation; caller wraps.
function _appendRowInternal(planningDir, row) {
  if (!planningDir) throw new Error('gate-value-log: planningDir required');
  const enriched = _normalize(row);
  _assertEnvelopeV1(enriched);
  const p = ledgerPath(planningDir);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}

// Public API. NEVER throws upward. Returns the normalized row on append,
// false on error. Stderr-only error logging (mirrors route-ledger.cjs).
function logGateValue(planningDir, args) {
  try {
    return _appendRowInternal(planningDir, args || {});
  } catch (e) {
    console.warn('[SGSD] gate-value-log logGateValue failed:', e.message);
    return false;
  }
}

// Defensive read: skip malformed lines (mirror route-ledger.cjs:185-196).
// Optional opts: { gate, outcome, milestone } each filters by exact match.
function readGateValueRows(planningDir, opts) {
  try {
    if (!planningDir) return [];
    const o = opts || {};
    const p = ledgerPath(planningDir);
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) return [];
    let rows = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    if (o.gate)      rows = rows.filter((r) => r.gate === o.gate);
    if (o.outcome)   rows = rows.filter((r) => r.outcome === o.outcome);
    if (o.milestone) rows = rows.filter((r) => r.milestone === o.milestone);
    return rows;
  } catch (e) {
    console.warn('[SGSD] gate-value-log readGateValueRows failed:', e.message);
    return [];
  }
}

// summarize: per-gate aggregation. 36-RESEARCH.md sec 4.
// value_score = max(0, (pass + 0.5*warn - block) / fires) when fires > 0,
// else null (defer-on-empty for Phase 39).
function summarize(planningDir, opts) {
  try {
    const o = opts || {};
    const filters = {};
    if (o.milestone) filters.milestone = o.milestone;
    if (o.gate)      filters.gate = o.gate;
    const rows = readGateValueRows(planningDir, filters);
    const byGate = new Map();
    for (const r of rows) {
      const g = r.gate || 'unknown';
      if (!byGate.has(g)) byGate.set(g, { gate: g, fires: 0, pass: 0, warn: 0, block: 0, skip: 0 });
      const acc = byGate.get(g);
      const out = r.outcome;
      if      (out === 'pass')  { acc.fires++; acc.pass++;  }
      else if (out === 'warn')  { acc.fires++; acc.warn++;  }
      else if (out === 'block') { acc.fires++; acc.block++; }
      else if (out === 'skip')  { acc.skip++; }
    }
    const result = [];
    for (const acc of byGate.values()) {
      acc.total_observations = acc.fires + acc.skip;
      acc.fire_rate = acc.total_observations > 0 ? acc.fires / acc.total_observations : 0;
      acc.value_score = acc.fires > 0
        ? Math.max(0, (acc.pass + 0.5 * acc.warn - acc.block) / acc.fires)
        : null;
      result.push(acc);
    }
    result.sort((a, b) => b.fires - a.fires);
    return result;
  } catch (e) {
    console.warn('[SGSD] gate-value-log summarize failed:', e.message);
    return [];
  }
}

// -- self-test --------------------------------------------------------------
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Capture canonical-ledger fingerprint BEFORE any writes.
  // Anchor to __dirname (the lib's filesystem location) NOT process.cwd(): the
  // self-test is invokable from any directory (CI, IDE task runner, etc.) and
  // must always identify the SAME canonical ledger. Lib lives at
  // <repo>/super-gsd/scripts/lib/gate-value-log.cjs; canonical at
  // <repo>/.planning/metrics/gate-value-log.jsonl (3 dirs up + .planning).
  const realLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'gate-value-log.jsonl');
  const realExistedBefore = fs.existsSync(realLedger);
  const realMtimeBefore = realExistedBefore ? fs.statSync(realLedger).mtimeMs : 0;
  const realSizeBefore = realExistedBefore ? fs.statSync(realLedger).size : 0;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-'));
  try {
    // 1. OUTCOMES is frozen array of 4.
    let outcomesFrozen = false;
    try { OUTCOMES.push('banana'); } catch (e) { outcomesFrozen = true; }
    assert('1. OUTCOMES is Object.freeze([pass,warn,block,skip])',
      Array.isArray(OUTCOMES) && OUTCOMES.length === 4 &&
      OUTCOMES[0] === 'pass' && OUTCOMES[1] === 'warn' &&
      OUTCOMES[2] === 'block' && OUTCOMES[3] === 'skip' &&
      outcomesFrozen);

    // 2. STATUSES is envelope-v1 6-state enum.
    assert('2. STATUSES is array of 6 envelope-v1 states',
      Array.isArray(STATUSES) && STATUSES.length === 6 &&
      STATUSES.includes('ok') && STATUSES.includes('warn') &&
      STATUSES.includes('fail') && STATUSES.includes('skipped') &&
      STATUSES.includes('timeout') && STATUSES.includes('blocked'));

    // 3. VERDICT_OUTCOME_MAP frozen with 6 keys.
    const vmKeys = Object.keys(VERDICT_OUTCOME_MAP);
    assert('3. VERDICT_OUTCOME_MAP frozen with 6 keys (pass/warn/critical/critical-halt/block/skipped)',
      vmKeys.length === 6 &&
      VERDICT_OUTCOME_MAP['pass'] === 'pass' &&
      VERDICT_OUTCOME_MAP['warn'] === 'warn' &&
      VERDICT_OUTCOME_MAP['critical'] === 'block' &&
      VERDICT_OUTCOME_MAP['critical-halt'] === 'block' &&
      VERDICT_OUTCOME_MAP['block'] === 'block' &&
      VERDICT_OUTCOME_MAP['skipped'] === 'skip' &&
      Object.isFrozen(VERDICT_OUTCOME_MAP));

    // 4. Empty read on a fresh tmpdir returns [].
    assert('4. empty read on fresh tmpdir returns []',
      Array.isArray(readGateValueRows(tmp)) && readGateValueRows(tmp).length === 0);

    // 5. Single logGateValue call -> one envelope-shaped row.
    const r1 = logGateValue(tmp, {
      gate: 'phase-level-ATC',
      outcome: 'pass',
      phase: '36',
      milestone: 'v1.8',
      retroactive: { step: '6.5', category: 'code-quality', enforcement_mode: 'hard-halt', version: '2.1' },
    });
    const rows5 = readGateValueRows(tmp);
    assert('5. single logGateValue produces one envelope-shaped row',
      r1 && r1.envelope_version === 1 && r1.command === 'logGateValue' &&
      r1.gate === 'phase-level-ATC' && r1.outcome === 'pass' &&
      RUN_ID_REGEX.test(r1.run_id) &&
      r1.retroactive && r1.retroactive.step === '6.5' &&
      r1.retroactive.category === 'code-quality' &&
      r1.retroactive.enforcement_mode === 'hard-halt' &&
      r1.retroactive.gate_version === '2.1' &&
      rows5.length === 1 &&
      rows5[0].phase === '36' && rows5[0].milestone === 'v1.8');

    // 6. Invalid outcome -> false; never throws upward.
    let invalidOutcomeReturn = null;
    let invalidOutcomeThrew = false;
    try { invalidOutcomeReturn = logGateValue(tmp, { gate: 'g', outcome: 'banana' }); }
    catch (e) { invalidOutcomeThrew = true; }
    assert('6. invalid outcome returns false; never throws upward',
      invalidOutcomeReturn === false && !invalidOutcomeThrew);

    // 7. Invalid gate (empty/non-string/undefined) -> false.
    const badGate1 = logGateValue(tmp, { gate: '', outcome: 'pass' });
    const badGate2 = logGateValue(tmp, { gate: 42, outcome: 'pass' });
    const badGate3 = logGateValue(tmp, { outcome: 'pass' });
    assert('7. invalid gate returns false (empty/non-string/missing)',
      badGate1 === false && badGate2 === false && badGate3 === false);

    // 8. Three sequential logGateValue calls -> three rows (append-only).
    const tmp8 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-8-'));
    try {
      logGateValue(tmp8, { gate: 'g1', outcome: 'pass', phase: '36', milestone: 'v1.8' });
      logGateValue(tmp8, { gate: 'g1', outcome: 'warn', phase: '36', milestone: 'v1.8' });
      logGateValue(tmp8, { gate: 'g1', outcome: 'block', phase: '36', milestone: 'v1.8' });
      assert('8. three sequential appends -> three rows; never truncated',
        readGateValueRows(tmp8).length === 3);
    } finally {
      fs.rmSync(tmp8, { recursive: true, force: true });
    }

    // 9. Defensive parse: malformed line skipped.
    const tmp9 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-9-'));
    try {
      logGateValue(tmp9, { gate: 'g', outcome: 'pass', phase: '36', milestone: 'v1.8' });
      logGateValue(tmp9, { gate: 'g', outcome: 'warn', phase: '36', milestone: 'v1.8' });
      logGateValue(tmp9, { gate: 'g', outcome: 'block', phase: '36', milestone: 'v1.8' });
      fs.appendFileSync(ledgerPath(tmp9), '{not-json\n', 'utf8');
      logGateValue(tmp9, { gate: 'g', outcome: 'skip', phase: '36', milestone: 'v1.8' });
      const rowsDef = readGateValueRows(tmp9);
      assert('9. malformed line skipped; subsequent valid append readable',
        rowsDef.length === 4);
    } finally {
      fs.rmSync(tmp9, { recursive: true, force: true });
    }

    // 10. outcomeFromVerdict mappings + numeric fallback + unknown.
    assert('10. outcomeFromVerdict covers all VERDICT_OUTCOME_MAP keys + fallbacks',
      outcomeFromVerdict('pass') === 'pass' &&
      outcomeFromVerdict('warn') === 'warn' &&
      outcomeFromVerdict('critical') === 'block' &&
      outcomeFromVerdict('critical-halt') === 'block' &&
      outcomeFromVerdict('block') === 'block' &&
      outcomeFromVerdict('skipped') === 'skip' &&
      outcomeFromVerdict(undefined, 0) === 'pass' &&
      outcomeFromVerdict(undefined, 5) === 'block' &&
      outcomeFromVerdict('mystery-verdict') === 'warn');

    // 11. summarize over fixture: 3 pass + 1 warn + 2 block + 2 skip for gate g1.
    // (PLAN line 210 had an internal arithmetic inconsistency: stated fixture
    // "1 block" but expected result "block:2" / fires:5 / value_score:0.3; the
    // value_score=0.3 arithmetic requires (pass+0.5*warn-block)/fires=1.5/n.
    // Adopting the PLAN's RESULT counts as canonical -- pass=3,warn=1,block=2
    // gives fires=6,total_obs=8,fire_rate=0.75,value_score=1.5/6=0.25.)
    const tmp11 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-11-'));
    try {
      for (let i = 0; i < 3; i++) logGateValue(tmp11, { gate: 'g1', outcome: 'pass', phase: '36', milestone: 'v1.8' });
      logGateValue(tmp11, { gate: 'g1', outcome: 'warn', phase: '36', milestone: 'v1.8' });
      for (let i = 0; i < 2; i++) logGateValue(tmp11, { gate: 'g1', outcome: 'block', phase: '36', milestone: 'v1.8' });
      for (let i = 0; i < 2; i++) logGateValue(tmp11, { gate: 'g1', outcome: 'skip', phase: '36', milestone: 'v1.8' });
      const summary = summarize(tmp11);
      const g1 = summary.find((s) => s.gate === 'g1');
      // value_score = max(0, (3 + 0.5 - 2) / 6) = 1.5 / 6 = 0.25
      assert('11. summarize aggregates {fires,pass,warn,block,skip,total_observations,fire_rate,value_score}',
        g1 &&
        g1.fires === 6 &&
        g1.pass === 3 &&
        g1.warn === 1 &&
        g1.block === 2 &&
        g1.skip === 2 &&
        g1.total_observations === 8 &&
        Math.abs(g1.fire_rate - (6 / 8)) < 1e-9 &&
        Math.abs(g1.value_score - 0.25) < 1e-9);
    } finally {
      fs.rmSync(tmp11, { recursive: true, force: true });
    }

    // 12. summarize milestone filter excludes other milestones.
    const tmp12 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-12-'));
    try {
      logGateValue(tmp12, { gate: 'g1', outcome: 'pass', phase: '32', milestone: 'v1.7' });
      logGateValue(tmp12, { gate: 'g1', outcome: 'pass', phase: '36', milestone: 'v1.8' });
      logGateValue(tmp12, { gate: 'g1', outcome: 'block', phase: '36', milestone: 'v1.8' });
      const onlyV17 = summarize(tmp12, { milestone: 'v1.7' });
      const onlyV18 = summarize(tmp12, { milestone: 'v1.8' });
      assert('12. summarize milestone filter excludes other milestones',
        onlyV17.length === 1 && onlyV17[0].fires === 1 && onlyV17[0].pass === 1 &&
        onlyV18.length === 1 && onlyV18[0].fires === 2 && onlyV18[0].pass === 1 && onlyV18[0].block === 1);
    } finally {
      fs.rmSync(tmp12, { recursive: true, force: true });
    }

    // 13. Rapid generateRunId() calls produce ≥99% unique values.
    // Phase 36 ATC W4 fix: 2-byte (65536-combo) random suffix at 100
    // synchronous draws yields ~7% birthday-collision probability when
    // Date.now() collapses multiple calls to the same millisecond. Strict
    // 100/100 unique was probabilistically flaky. Loosened to >=99 unique
    // (still catches systematic determinism bugs without flaking on
    // legitimate millisecond-scale collisions).
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(generateRunId());
    assert('13. 100 generateRunId() calls -> >=99 unique (allows rare ms-collision)',
      ids.size >= 99, 'got: ' + ids.size + '/100');

    // 14. Self-test never touches canonical .planning/metrics/gate-value-log.jsonl.
    const realExistedAfter = fs.existsSync(realLedger);
    const realMtimeAfter = realExistedAfter ? fs.statSync(realLedger).mtimeMs : 0;
    const realSizeAfter = realExistedAfter ? fs.statSync(realLedger).size : 0;
    assert('14. canonical ledger untouched by self-test',
      realExistedBefore === realExistedAfter &&
      realMtimeBefore === realMtimeAfter &&
      realSizeBefore === realSizeAfter);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`gate-value-log self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
    return 1;
  }
  return 0;
}

// -- main -------------------------------------------------------------------
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === '--self-test') process.exit(selfTest());

  if (cmd === '--summary') {
    const idx = process.argv.indexOf('--planning-dir');
    // Phase 36 ATC W2 fix: CLI default falls back to __dirname-anchored
    // canonical .planning location (Phase 32 W3 lesson). Lib lives at
    // <repo>/super-gsd/scripts/lib/gate-value-log.cjs; canonical at
    // <repo>/.planning. process.cwd() fallback would silently read/write
    // wrong ledger when CLI invoked from a non-root directory.
    const planningDir = (idx > 0 && process.argv[idx + 1])
      ? path.resolve(process.argv[idx + 1])
      : path.resolve(__dirname, '..', '..', '..', '.planning');
    const mIdx = process.argv.indexOf('--milestone');
    const gIdx = process.argv.indexOf('--gate');
    const opts = {};
    if (mIdx > 0 && process.argv[mIdx + 1]) opts.milestone = process.argv[mIdx + 1];
    if (gIdx > 0 && process.argv[gIdx + 1]) opts.gate = process.argv[gIdx + 1];
    try {
      const rows = summarize(planningDir, opts);
      console.log(JSON.stringify(rows, null, 2));
      process.exit(0);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }

  console.log('Usage:');
  console.log('  node gate-value-log.cjs --self-test');
  console.log('  node gate-value-log.cjs --summary [--milestone <id>] [--gate <name>] [--planning-dir <path>]');
  console.log('  Or require() and call logGateValue / readGateValueRows / summarize / outcomeFromVerdict / ledgerPath');
  console.log('  OUTCOMES =', JSON.stringify(OUTCOMES));
  process.exit(0);
}

module.exports = {
  // 5 public APIs:
  logGateValue,
  readGateValueRows,
  summarize,
  ledgerPath,
  outcomeFromVerdict,

  // 5 frozen constants:
  OUTCOMES,
  STATUSES,
  VERDICT_OUTCOME_MAP,
  COMMAND_NAME,
  ENVELOPE_VERSION,
};
