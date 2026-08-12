// ============================================================================
// SGSD - ROUTE-LEDGER canonical writer for routing decisions
// ============================================================================
// Source of truth: .planning/metrics/route-decisions.jsonl (machine-readable)
// No rendered .md view in v1.7 (per 32-RESEARCH.md 9.5: deferred).
//
// Append-only. Every row is a valid command-envelope-v1 row PLUS
// `boundary` + `decision` extension fields. Reconciliation is explicit at
// super-gsd/registry/command-envelope-v1.yaml:260 (collides_with: []).
//
// Phase 32 (32=A) ships ONE wire-in: `codex_route` at sgsd-orchestrate
// SKILL.md Step 9.5 (line 1236). The other 5 boundaries are pre-declared
// in BOUNDARIES but DEFERRED to v1.8+ -- see Section 1 of
// .planning/milestones/v1.7/phases/32-route-decision-ledger/32-RESEARCH.md
// for exact wire-in targets.
//
// Schema per row (one JSON object per line):
//   {
//     envelope_version: 1,
//     ts:               ISO-8601,
//     command:          "logRouteDecision",
//     status:           ok|warn|fail|skipped|timeout|blocked,
//     reason_codes:     string[]   (envelope-v1 vocab; empty array allowed),
//     artifacts:        {kind,path}[],
//     evidence:         {kind,ref}[],
//     next_action:      string|null,
//     risk:             low|medium|high|null,
//     duration_ms:      number|null,
//     run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex),
//     phase:            string|null,
//     milestone:        string|null,
//     boundary:         one of BOUNDARIES,    (Phase 32 extension)
//     decision:         object                 (Phase 32 extension; free-form)
//   }
//
// boundary in {milestone_promotion, phase_dispatch_first, executor_choice,
//              gate_skip, codex_route, handoff_decision, gate_override,
//              dispatch_route, vtp_bridge, execution_route}.
//
// Concurrency: orchestrator is single-threaded; per-dispatch-ATC fires
// sequentially after parallel waves serialize at SKILL.md:467-471. No
// locking required. fs.appendFileSync is atomic at row boundary on POSIX
// and on Windows for sub-block writes (rows are well under 4KB).
//
// Failure contract: this writer NEVER throws upward at the orchestrator
// boundary. Closed-enum violations raise inside appendRow but the public
// helper logRouteDecision wraps every call in try/catch; on error it
// console.warns to stderr and returns false. Section 8 of 32-RESEARCH.md
// codifies this: "evidence may falter; autonomy must not."
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ROUTE-02: closed enum of route boundary types. Frozen.
// Phase 38 (SAMPLE-04): added 'gate_override' for --force-gates /
// --skip-gates with --override-reason. Mass-discuss line 187 names
// this boundary verbatim. Extension preserves the closed-enum
// contract (no schema field shape change; envelope-v1 still ships
// additionalProperties: true so envelope contract holds).
// Phase 47 (ROUTE-01..05): added 'dispatch_route' for general dispatch routing
// (research, planning, execution, verification, review). Uses the same closed-enum
// extension pattern as Phase 38 'gate_override'. envelope-v1 contract unchanged
// (additionalProperties:true at registry/command-envelope-v1.yaml:260).
// Phase 48 (VTPR-01..06): added 'vtp_bridge' for selective VTP MCP bridge calls
// (uncertainty_type -> MCP tool dispatch via super-gsd/tools/vtp-bridge/classify.cjs).
// Same closed-enum extension pattern as Phase 47 'dispatch_route'. envelope-v1
// contract unchanged (additionalProperties:true at registry/command-envelope-v1.yaml:260).
// Double-agent executor: added 'execution_route' for primary executor routing
// (local-script | codex | claude) with task-capsule, token, fallback, and
// acceptance-test evidence. This extends the existing ledger instead of
// creating a second routing stream.
const BOUNDARIES = Object.freeze([
  'milestone_promotion',
  'phase_dispatch_first',
  'executor_choice',
  'gate_skip',
  'codex_route',
  'handoff_decision',
  'gate_override',
  'dispatch_route',
  'vtp_bridge',
  'execution_route',
  // Cross-pollination Phase 0 (2026-08-12): advisory triage decisions recorded by
  // sgsd-triage-first — same extension pattern as Phase 38 'gate_override'.
  'vtp_triage_advisory',
]);

// envelope-v1 status enum (command-envelope-v1.json status.enum). Frozen.
const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);

const COMMAND_NAME = 'logRouteDecision';
const ENVELOPE_VERSION = 1;

function jsonlPath(planningDir) {
  return path.join(planningDir, 'metrics', 'route-decisions.jsonl');
}

// run_id pattern matches envelope-v1.json: ISO ts + 4 hex chars.
// Example: 2026-04-27T11:32:01.123Z-a1b2
function generateRunId() {
  const ts = new Date().toISOString();          // ISO-8601, includes ms.
  const rand = crypto.randomBytes(2).toString('hex'); // 4 hex chars.
  return `${ts}-${rand}`;
}

// Validate envelope-v1 run_id pattern. Used only by self-test; production
// path always passes a generated id.
const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

// Internal: validate + normalize a row. Throws on closed-enum violation.
// Caller responsible for catching (logRouteDecision wraps).
function _normalize(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('route-ledger: row must be an object');
  }
  if (!row.boundary || !BOUNDARIES.includes(row.boundary)) {
    throw new Error(
      `route-ledger: boundary must be one of ${BOUNDARIES.join(', ')}; got '${row.boundary}'`
    );
  }
  if (!row.status || !STATUSES.includes(row.status)) {
    throw new Error(
      `route-ledger: status must be one of ${STATUSES.join(', ')}; got '${row.status}'`
    );
  }
  if (row.reason_codes !== undefined && !Array.isArray(row.reason_codes)) {
    throw new Error('route-ledger: reason_codes must be an array (or omitted)');
  }
  if (row.artifacts !== undefined && !Array.isArray(row.artifacts)) {
    throw new Error('route-ledger: artifacts must be an array (or omitted)');
  }
  if (row.evidence !== undefined && !Array.isArray(row.evidence)) {
    throw new Error('route-ledger: evidence must be an array (or omitted)');
  }

  return {
    envelope_version: ENVELOPE_VERSION,
    ts: row.ts || new Date().toISOString(),
    command: COMMAND_NAME,
    status: row.status,
    reason_codes: Array.isArray(row.reason_codes) ? row.reason_codes.slice() : [],
    artifacts: Array.isArray(row.artifacts) ? row.artifacts.slice() : [],
    evidence: Array.isArray(row.evidence) ? row.evidence.slice() : [],
    next_action: row.next_action ?? null,
    risk: row.risk ?? null,
    duration_ms: typeof row.duration_ms === 'number' ? row.duration_ms : null,
    run_id: row.run_id || generateRunId(),
    phase: row.phase ?? null,
    milestone: row.milestone ?? null,
    // Phase 32 extension fields (additionalProperties: true in envelope-v1):
    boundary: row.boundary,
    decision: row.decision || {},
  };
}

// Manual envelope-v1 schema check (no ajv dep). Asserts every emitted row
// has the 13 required envelope-v1 fields with the correct types and that
// evidence/artifacts inner shapes match the envelope schema. Throws on
// violation -- the public-API try/catch wraps it (writer never throws upward).
function _assertEnvelopeV1(row) {
  // Required-field presence check (envelope-v1.json:7).
  const required = ['envelope_version','ts','command','status','reason_codes',
    'artifacts','evidence','next_action','risk','duration_ms','run_id','phase','milestone'];
  for (const k of required) {
    if (!(k in row)) throw new Error(`route-ledger: emitted row missing required envelope-v1 field '${k}'`);
  }
  // envelope_version is const 1.
  if (row.envelope_version !== 1) {
    throw new Error(`route-ledger: envelope_version must be 1 (got ${row.envelope_version})`);
  }
  // run_id pattern (envelope-v1.json:78).
  if (!RUN_ID_REGEX.test(row.run_id)) {
    throw new Error(`route-ledger: run_id violates envelope-v1 pattern (got '${row.run_id}')`);
  }
  // duration_ms is integer | null with min 0.
  if (row.duration_ms !== null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
    throw new Error(`route-ledger: duration_ms must be non-negative integer or null (got ${row.duration_ms})`);
  }
  // evidence items shape: {kind, ref}. artifacts items shape: {kind, path}.
  for (const e of row.evidence) {
    if (!e || typeof e.kind !== 'string' || !e.kind || typeof e.ref !== 'string' || !e.ref) {
      throw new Error(`route-ledger: evidence item must be {kind:string, ref:string} (got ${JSON.stringify(e)})`);
    }
  }
  for (const a of row.artifacts) {
    if (!a || typeof a.kind !== 'string' || !a.kind || typeof a.path !== 'string' || !a.path) {
      throw new Error(`route-ledger: artifacts item must be {kind:string, path:string} (got ${JSON.stringify(a)})`);
    }
  }
}

// Low-level append. Throws on validation; caller wraps.
function appendRow(planningDir, row) {
  if (!planningDir) throw new Error('route-ledger: planningDir required');
  const enriched = _normalize(row);
  _assertEnvelopeV1(enriched);
  const p = jsonlPath(planningDir);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}

// Defensive read: skip malformed lines (mirror crit-backlog.cjs:120-122).
function readRows(planningDir) {
  const p = jsonlPath(planningDir);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  if (!text.trim()) return [];
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// Public API. NEVER throws upward. Returns true on append, false on error.
// Stderr-only error logging (32-RESEARCH.md 9.4 LOCKED).
function logRouteDecision(planningDir, args) {
  try {
    appendRow(planningDir, args || {});
    return true;
  } catch (e) {
    console.warn('[SGSD] route-ledger logRouteDecision failed:', e.message);
    return false;
  }
}

// codex_route helper: maps Step 9.5 dispatch state -> envelope row.
// Imported by both the orchestrator (SKILL.md:1236) and the local fallback
// test (route-ledger.test.cjs). Single source of truth for status/code mapping.
function logCodexRoute(planningDir, ctx) {
  try {
    const {
      phase, milestone, plan,
      dispatchResult,
      effectiveProviderName,   // 'codex-cli-reviewer' (the gate-resolved name)
      fallbackProviderName,    // 'openai-codex' | 'claude-via-fallback'
      fallbackTriggered,
      fallbackReason,          // 'parse_failure' | null
      reportPath,              // perDispatchReportPath() | null
    } = ctx || {};

    const dr = dispatchResult || {};
    let status;
    const reasonCodes = [];

    if (dr.exit === 0 && fallbackTriggered) {
      // Codex exit-clean but contract invalid -> Claude fallback fired.
      status = 'warn';
      reasonCodes.push('codex_fallback_triggered');
      if (fallbackReason === 'parse_failure') reasonCodes.push('parse_failure');
    } else if (dr.exit === 0) {
      status = 'ok';
      reasonCodes.push('review_unanimous_pass');
    } else if (dr.exit === 5 || dr.timeout_hit === true) {
      status = 'timeout';
      reasonCodes.push('codex_timeout');
      if (fallbackTriggered) reasonCodes.push('codex_fallback_triggered');
    } else if (dr.exit === 4) {
      status = 'fail';
      reasonCodes.push('codex_auth_missing');
      if (fallbackTriggered) reasonCodes.push('codex_fallback_triggered');
    } else {
      status = 'fail';
      reasonCodes.push('provider_unavailable');
      if (fallbackTriggered) reasonCodes.push('codex_fallback_triggered');
    }

    // envelope-v1 contract (super-gsd/templates/command-envelope-v1.json:46-60):
    // 'review_report' is an EVIDENCE kind (cite), NOT an ARTIFACT kind (write).
    // logCodexRoute does not WRITE the per-dispatch report -- the orchestrator
    // wrote it earlier; this row only CITES it.
    const evidence = reportPath
      ? [{ kind: 'review_report', ref: reportPath }]
      : [];

    const decision = {
      from: effectiveProviderName || null,
      to: fallbackProviderName || null,
      fallback_triggered: !!fallbackTriggered,
      fallback_reason: fallbackReason || null,
      exit: typeof dr.exit === 'number' ? dr.exit : null,
      timeout_hit: !!dr.timeout_hit,
      plan: plan || null,
    };

    return appendRow(planningDir, {
      boundary: 'codex_route',
      status,
      phase: phase ?? null,
      milestone: milestone ?? null,
      reason_codes: reasonCodes,
      artifacts: [],
      evidence,
      decision,
    });
  } catch (e) {
    console.warn('[SGSD] route-ledger logCodexRoute failed:', e.message);
    return false;
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

  // Capture canonical-ledger fingerprint BEFORE any writes (assertion 12).
  // Anchor to __dirname (the lib's filesystem location) NOT process.cwd(): the
  // self-test is invokable from any directory (CI, IDE task runner, etc.) and
  // must always identify the SAME canonical ledger. Lib lives at
  // <repo>/super-gsd/scripts/lib/route-ledger.cjs; canonical at
  // <repo>/.planning/metrics/route-decisions.jsonl (3 dirs up + .planning).
  const realLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'route-decisions.jsonl');
  const realExistedBefore = fs.existsSync(realLedger);
  const realMtimeBefore = realExistedBefore ? fs.statSync(realLedger).mtimeMs : 0;
  const realSizeBefore = realExistedBefore ? fs.statSync(realLedger).size : 0;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-'));
  try {
    // 1. Module exports + frozen constants. Double-agent executor: 10 entries.
    assert('1. BOUNDARIES is array of 10',
      Array.isArray(BOUNDARIES) && BOUNDARIES.length === 10);
    assert('2. STATUSES is array of 6 envelope-v1 states',
      Array.isArray(STATUSES) && STATUSES.length === 6 &&
      STATUSES.includes('ok') && STATUSES.includes('warn') &&
      STATUSES.includes('fail') && STATUSES.includes('skipped') &&
      STATUSES.includes('timeout') && STATUSES.includes('blocked'));

    // 3. Empty read.
    assert('3. empty read on fresh tmpdir returns []',
      Array.isArray(readRows(tmp)) && readRows(tmp).length === 0);

    // 4. Append + read shape: envelope-v1 + Phase 32 extension fields.
    // 'review_report' is an EVIDENCE kind per envelope-v1.json:53 (cite, not write).
    const r1 = appendRow(tmp, {
      boundary: 'codex_route', status: 'ok',
      phase: '32', milestone: 'v1.7',
      reason_codes: ['review_unanimous_pass'],
      artifacts: [],
      evidence: [{ kind: 'review_report', ref: 'x.md' }],
      decision: { from: 'codex-cli-reviewer', to: null, fallback_triggered: false },
    });
    const rows = readRows(tmp);
    assert('4. single append produces one envelope-shaped row',
      rows.length === 1 &&
      rows[0].envelope_version === 1 &&
      rows[0].command === COMMAND_NAME &&
      typeof rows[0].ts === 'string' &&
      RUN_ID_REGEX.test(rows[0].run_id) &&
      rows[0].boundary === 'codex_route' &&
      rows[0].status === 'ok' &&
      Array.isArray(rows[0].reason_codes) &&
      Array.isArray(rows[0].artifacts) &&
      Array.isArray(rows[0].evidence) &&
      rows[0].phase === '32' &&
      rows[0].milestone === 'v1.7' &&
      typeof rows[0].decision === 'object');
    void r1;

    // 5. Invalid boundary throws.
    let threwBoundary = false;
    try { appendRow(tmp, { boundary: 'banana', status: 'ok' }); }
    catch (e) { threwBoundary = /boundary must be one of/.test(e.message); }
    assert('5. invalid boundary throws with helpful message', threwBoundary);

    // 6. Invalid status throws.
    let threwStatus = false;
    try { appendRow(tmp, { boundary: 'codex_route', status: 'maybe' }); }
    catch (e) { threwStatus = /status must be one of/.test(e.message); }
    assert('6. invalid status throws with helpful message', threwStatus);

    // 7. Empty reason_codes permitted (array, not null).
    appendRow(tmp, {
      boundary: 'codex_route', status: 'ok',
      phase: '32', milestone: 'v1.7',
    });
    const rows7 = readRows(tmp);
    assert('7. empty reason_codes permitted as []',
      rows7.length === 2 && Array.isArray(rows7[1].reason_codes) &&
      rows7[1].reason_codes.length === 0);

    // 8. Append-only (no truncation).
    appendRow(tmp, {
      boundary: 'codex_route', status: 'warn',
      phase: '32', milestone: 'v1.7',
      reason_codes: ['codex_fallback_triggered'],
    });
    assert('8. two further appends -> three rows; never truncated',
      readRows(tmp).length === 3);

    // 9. Defensive parse: malformed line skipped.
    fs.appendFileSync(jsonlPath(tmp), '{not-json\n', 'utf8');
    appendRow(tmp, {
      boundary: 'codex_route', status: 'ok',
      phase: '32', milestone: 'v1.7',
    });
    const rowsDef = readRows(tmp);
    assert('9. malformed line skipped; subsequent valid append readable',
      rowsDef.length === 4);

    // 10. logRouteDecision wraps + never throws upward.
    const wrappedFalse = logRouteDecision(tmp, { boundary: 'banana', status: 'ok' });
    const wrappedTrue = logRouteDecision(tmp, {
      boundary: 'codex_route', status: 'ok',
      phase: '32', milestone: 'v1.7',
    });
    assert('10. logRouteDecision returns false on validation failure (no throw upward)',
      wrappedFalse === false && wrappedTrue === true);

    // 11. 100 rapid generateRunId() calls produce 100 unique values.
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(generateRunId());
    assert('11. 100 generateRunId() calls -> 100 unique', ids.size === 100);

    // 12. Self-test never touches canonical .planning/metrics/route-decisions.jsonl.
    const realExistedAfter = fs.existsSync(realLedger);
    const realMtimeAfter = realExistedAfter ? fs.statSync(realLedger).mtimeMs : 0;
    const realSizeAfter = realExistedAfter ? fs.statSync(realLedger).size : 0;
    assert('12. canonical ledger untouched by self-test',
      realExistedBefore === realExistedAfter &&
      realMtimeBefore === realMtimeAfter &&
      realSizeBefore === realSizeAfter);

    // 13. Phase 38: gate_override boundary accepts envelope-shaped row.
    const r13 = appendRow(tmp, {
      boundary: 'gate_override', status: 'ok',
      phase: '38', milestone: 'v1.8',
      reason_codes: ['gate_force_override_with_reason'],
      decision: { gate: 'per-dispatch-ATC', action: 'force', reason: 'self-test' },
    });
    const rows13 = readRows(tmp);
    const lastRow = rows13[rows13.length - 1];
    assert('13. gate_override boundary accepted; decision payload preserved',
      lastRow.boundary === 'gate_override' &&
      lastRow.decision &&
      lastRow.decision.gate === 'per-dispatch-ATC' &&
      lastRow.decision.action === 'force' &&
      lastRow.decision.reason === 'self-test' &&
      Array.isArray(lastRow.reason_codes) &&
      lastRow.reason_codes.includes('gate_force_override_with_reason'));
    void r13;

    // 14. Phase 47: dispatch_route boundary accepts envelope-shaped Phase 47 decision.
    const r14 = appendRow(tmp, {
      boundary: 'dispatch_route', status: 'ok',
      phase: '47', milestone: 'v1.9',
      reason_codes: ['matched_uncertainty_type'],
      decision: {
        task_kind: 'review',
        uncertainty_type: 'bounded_code_review',
        primary_provider: 'codex',
        chosen_provider: 'codex',
        fallback_used: false,
      },
    });
    const rows14 = readRows(tmp);
    const lastRow14 = rows14[rows14.length - 1];
    assert('14. dispatch_route boundary accepted; Phase 47 decision payload preserved',
      lastRow14.boundary === 'dispatch_route' &&
      lastRow14.decision &&
      lastRow14.decision.task_kind === 'review' &&
      lastRow14.decision.uncertainty_type === 'bounded_code_review' &&
      lastRow14.decision.chosen_provider === 'codex' &&
      lastRow14.decision.fallback_used === false &&
      Array.isArray(lastRow14.reason_codes) &&
      lastRow14.reason_codes.includes('matched_uncertainty_type'));
    void r14;

    // 15. Phase 48: vtp_bridge boundary smoke (mirror assertion 14 for new VTP route).
    const r15 = appendRow(tmp, {
      boundary: 'vtp_bridge', status: 'ok',
      phase: '48', milestone: 'v1.9',
      reason_codes: ['vtp_call_succeeded'],
      decision: {
        tool: 'vtp_search_substrate',
        uncertainty_type: 'architecture_challenge',
        result_count: 3,
        body_token_estimate: 1234,
        elided_count: 0,
      },
    });
    const rows15 = readRows(tmp);
    const lastRow15 = rows15[rows15.length - 1];
    assert('15. vtp_bridge boundary accepted; Phase 48 decision payload preserved',
      lastRow15.boundary === 'vtp_bridge' &&
      lastRow15.decision &&
      lastRow15.decision.tool === 'vtp_search_substrate' &&
      lastRow15.decision.uncertainty_type === 'architecture_challenge' &&
      lastRow15.decision.result_count === 3 &&
      Array.isArray(lastRow15.reason_codes) &&
      lastRow15.reason_codes.includes('vtp_call_succeeded'));
    void r15;

    // 16. Double-agent executor: execution_route boundary smoke.
    const r16 = appendRow(tmp, {
      boundary: 'execution_route', status: 'ok',
      phase: '63', milestone: 'v2.2',
      reason_codes: ['codex_primary_bounded_task'],
      artifacts: [{ kind: 'execution_report', path: 'report.json' }],
      evidence: [{ kind: 'task_capsule', ref: 'capsule.json' }],
      decision: {
        task_id: 'self-test',
        primary_provider: 'codex',
        chosen_provider: 'codex',
        fallback_used: false,
        tests_passed: true,
      },
    });
    const rows16 = readRows(tmp);
    const lastRow16 = rows16[rows16.length - 1];
    assert('16. execution_route boundary accepted; executor decision payload preserved',
      lastRow16.boundary === 'execution_route' &&
      lastRow16.decision &&
      lastRow16.decision.primary_provider === 'codex' &&
      lastRow16.decision.tests_passed === true);
    void r16;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`route-ledger self-test: ${pass} pass, ${fail} fail`);
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
  console.log('Usage: node route-ledger.cjs --self-test');
  console.log('  Or require() and call logRouteDecision / logCodexRoute / appendRow / readRows');
  console.log('  BOUNDARIES =', JSON.stringify(BOUNDARIES));
  process.exit(0);
}

module.exports = {
  BOUNDARIES,
  STATUSES,
  COMMAND_NAME,
  ENVELOPE_VERSION,
  jsonlPath,
  generateRunId,
  appendRow,
  readRows,
  logRouteDecision,
  logCodexRoute,
};
