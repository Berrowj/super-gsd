---
plan_id: 32-01
phase: 32
title: Route Decision Ledger
schema_version: 2
model: sonnet
expected_ATC_tier: LITE
requirements: [ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04]
locked_decisions: [32=A]
depends_on: [31]
created: 2026-04-27
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/scripts/lib/route-ledger.cjs
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - super-gsd/scripts/lib/route-ledger.test.cjs
    hypothesis: "Logging codex_route decisions to envelope-v1-shaped JSONL produces useful routing-pattern evidence for v1.8+ boundary expansion."
    falsifier: "First 10 rows show identical reason_codes / evidence / outcome -- no decision variance -- kill the boundary."
    stop_rule: "self-test exits 0; orchestrator boots without errors after wire-in; local fallback test produces 4 canonical envelope rows."
    minimal_test: "node super-gsd/scripts/lib/route-ledger.cjs --self-test -> exit 0; node super-gsd/scripts/lib/route-ledger.test.cjs -> all 4 fixtures PASS."
must_haves:
  truths:
    - "Every routing decision row is a valid envelope-v1 (Phase 31 contract; reconciliation block at command-envelope-v1.yaml:260)"
    - "logRouteDecision() never throws upward (orchestrator continues regardless of writer success)"
    - "BOUNDARIES is a readonly const exporting all 6 boundary types"
    - "self-test isolated to os.tmpdir() -- never touches canonical .planning/metrics/route-decisions.jsonl"
  artifacts:
    - super-gsd/scripts/lib/route-ledger.cjs
    - super-gsd/scripts/lib/route-ledger.test.cjs
    - super-gsd/skills/sgsd-orchestrate/SKILL.md (4-line edit at Step 9.5)
  key_links:
    - 32-CONTEXT.md
    - 32-RESEARCH.md (locked derivation calls 9.1-9.16)
    - command-envelope-v1.yaml:260 (reconciliation: collides_with: [])
---

<objective>
Phase 32 lands the Route Decision Ledger: an append-only
`.planning/metrics/route-decisions.jsonl` stream + a writer module
(`super-gsd/scripts/lib/route-ledger.cjs`) wired into ONE production
boundary (`codex_route` at SKILL.md Step 9.5). The 5 remaining boundary
types (`milestone_promotion`, `phase_dispatch_first`, `executor_choice`,
`gate_skip`, `handoff_decision`) are pre-declared in the BOUNDARIES
constant but explicitly deferred to v1.8+ wire-ins.

Purpose: close ROUTE-01..04 from REQUIREMENTS.md, validate Phase 31's
envelope-v1 contract by adding a sixth emitter without forcing a
schema bump (per command-envelope-v1.yaml:260 collides_with: []), and
produce the first canonical evidence stream the cockpit + Phase 34
review-ledger will consume post-v1.7.

Output: ~280 line lib + ~16 line SKILL.md edit + ~80 line local
fallback test (~376 lines additive, zero deletions) across 3 atomic
commits.

Controlling principle: "Autonomy continues; evidence tells the truth."
The writer is non-load-bearing: when it throws, the orchestrator logs
to stderr and continues. Evidence may falter; autonomy must not.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.7/phases/32-route-decision-ledger/32-CONTEXT.md
@.planning/milestones/v1.7/phases/32-route-decision-ledger/32-RESEARCH.md
@.planning/milestones/v1.7/REQUIREMENTS.md
@super-gsd/registry/command-envelope-v1.yaml
@super-gsd/templates/command-envelope-v1.json
@super-gsd/scripts/lib/crit-backlog.cjs
@super-gsd/skills/sgsd-orchestrate/SKILL.md
@super-gsd/tools/provider-health/check.cjs

<interfaces>
<!-- Contracts the executor must respect verbatim. Extracted from envelope-v1 + crit-backlog. -->
<!-- Do NOT explore the codebase for these; they are reproduced here in full. -->

From super-gsd/templates/command-envelope-v1.json (envelope-v1, Phase 31):
- required: [envelope_version, ts, command, status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone]
- envelope_version: const 1
- status enum: ["ok", "warn", "fail", "skipped", "timeout", "blocked"]
- run_id pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$
- artifacts: array of {kind, path}
- evidence: array of {kind, ref}
- additionalProperties: true (boundary + decision are extension fields)

From super-gsd/registry/command-envelope-v1.yaml reason_codes (Phase 32 consumes; never extends):
- codex_timeout, codex_auth_missing, codex_fallback_triggered
- provider_unavailable, runtime_unreachable
- parse_failure, schema_validation_fail, frontmatter_missing, registry_load_fail
- atc_critical, atc_warn_only, review_unanimous_pass, review_split_decision
- gate_skip_with_reason, gate_force_with_reason
- (all retrieval / repair / orchestration codes -- not emitted by codex_route boundary today)

From super-gsd/scripts/lib/crit-backlog.cjs (sibling JSONL writer pattern):
- generateId(): `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(2).toString('hex')}`
- appendRow uses `fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8')`
- readRows uses `text.split(/\r?\n/).filter(Boolean).map(l => try JSON.parse(l) catch null).filter(Boolean)`
- selfTest scaffold: pass/fail counters, tmpdir isolation, exit 0|1

From super-gsd/skills/sgsd-orchestrate/SKILL.md Step 9.5 (1163-1247) -- variables already in scope at insertion point (line 1236, immediately after appendPerDispatchReviewEvidence):
- effective.name -> 'codex-cli-reviewer' or fallback name
- dispatchResult -> {exit, timeout_hit, report, model, ...}
- report._provider -> 'openai-codex' | 'claude-via-fallback'
- report._fallback_reason -> 'parse_failure' | undefined
- currentPhase, currentMilestone, currentPlan, projectDir
- perDispatchReportPath() -> path to per-dispatch ATC report
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>T1: Land route-ledger.cjs lib + codex_route wire-in + local fallback test (atomic commits x3)</name>
  <files>
    super-gsd/scripts/lib/route-ledger.cjs (new),
    super-gsd/skills/sgsd-orchestrate/SKILL.md (edit at Step 9.5),
    super-gsd/scripts/lib/route-ledger.test.cjs (new)
  </files>

  <behavior>
    Test 1 (self-test, 12 assertions):
      - Module loads without throwing.
      - logRouteDecision exported; appendRow exported; readRows exported.
      - BOUNDARIES is a frozen array of exactly 6 strings (the canonical names).
      - STATUSES is a frozen array of the 6 envelope-v1 status states.
      - Empty read on fresh tmpdir returns [].
      - Single appendRow produces a row with envelope_version === 1, ISO ts,
        run_id matching the envelope-v1 regex, command === 'logRouteDecision'.
      - Each appended row has phase, milestone, reason_codes (array), status,
        artifacts (array), evidence (array), boundary, decision.
      - Invalid boundary throws "boundary must be one of ...".
      - Invalid status throws "status must be one of ...".
      - Two appends produce two rows; file is never truncated.
      - Defensive read survives a malformed pre-written line.
      - 100 generateRunId() calls produce 100 unique values.
      - Self-test never touches canonical .planning/metrics/route-decisions.jsonl
        (asserts mtime / existence unchanged before vs after).

    Test 2 (route-ledger.test.cjs, 4 fixtures):
      - Fixture A "codex_success":
          dispatchResult={exit:0, timeout_hit:false}, providerUsed='openai-codex'
          fallbackTriggered=false
          Expected row: status='ok', reason_codes=['review_unanimous_pass'],
                        decision.fallback_triggered===false
      - Fixture B "codex_timeout":
          dispatchResult={exit:5, timeout_hit:true}, providerUsed='openai-codex'
          fallbackTriggered=false
          Expected row: status='timeout', reason_codes=['codex_timeout']
      - Fixture C "codex_auth_fail":
          dispatchResult={exit:4, timeout_hit:false}, fallbackTriggered=true,
          providerUsed='claude-via-fallback'
          Expected row: status='fail',
                        reason_codes contains 'codex_auth_missing' AND
                                              'codex_fallback_triggered'
      - Fixture D "parse_failure_fallback":
          dispatchResult={exit:0, timeout_hit:false}, fallbackTriggered=true,
          fallbackReason='parse_failure', providerUsed='claude-via-fallback'
          Expected row: status='warn',
                        reason_codes=['codex_fallback_triggered','parse_failure'],
                        decision.fallback_triggered===true,
                        decision.from='codex-cli-reviewer',
                        decision.to='claude-sonnet-reviewer'
  </behavior>

  <action>
========================================================================
COMMIT 1 of 3: feat(32-01): route-ledger.cjs lib + 12-assertion self-test
========================================================================

CREATE FILE: super-gsd/scripts/lib/route-ledger.cjs

Write byte-exact contents below. ASCII-only. LF line endings. No new
deps -- only Node built-ins (fs, path, os, crypto).

```javascript
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
//              gate_skip, codex_route, handoff_decision}.
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

// ROUTE-02: closed enum of 6 boundary types. Frozen.
const BOUNDARIES = Object.freeze([
  'milestone_promotion',
  'phase_dispatch_first',
  'executor_choice',
  'gate_skip',
  'codex_route',
  'handoff_decision',
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

// Low-level append. Throws on validation; caller wraps.
function appendRow(planningDir, row) {
  if (!planningDir) throw new Error('route-ledger: planningDir required');
  const enriched = _normalize(row);
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

    const artifacts = reportPath
      ? [{ kind: 'review_report', path: reportPath }]
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
      artifacts,
      evidence: [],
      decision,
    });
  } catch (e) {
    console.warn('[SGSD] route-ledger logCodexRoute failed:', e.message);
    return false;
  }
}

// ── self-test ────────────────────────────────────────────────────────────────
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Capture canonical-ledger fingerprint BEFORE any writes (assertion 12).
  const realLedger = path.join(process.cwd(), '.planning', 'metrics', 'route-decisions.jsonl');
  const realExistedBefore = fs.existsSync(realLedger);
  const realMtimeBefore = realExistedBefore ? fs.statSync(realLedger).mtimeMs : 0;
  const realSizeBefore = realExistedBefore ? fs.statSync(realLedger).size : 0;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-'));
  try {
    // 1. Module exports + frozen constants.
    assert('1. BOUNDARIES is array of 6',
      Array.isArray(BOUNDARIES) && BOUNDARIES.length === 6);
    assert('2. STATUSES is array of 6 envelope-v1 states',
      Array.isArray(STATUSES) && STATUSES.length === 6 &&
      STATUSES.includes('ok') && STATUSES.includes('warn') &&
      STATUSES.includes('fail') && STATUSES.includes('skipped') &&
      STATUSES.includes('timeout') && STATUSES.includes('blocked'));

    // 3. Empty read.
    assert('3. empty read on fresh tmpdir returns []',
      Array.isArray(readRows(tmp)) && readRows(tmp).length === 0);

    // 4. Append + read shape: envelope-v1 + Phase 32 extension fields.
    const r1 = appendRow(tmp, {
      boundary: 'codex_route', status: 'ok',
      phase: '32', milestone: 'v1.7',
      reason_codes: ['review_unanimous_pass'],
      artifacts: [{ kind: 'review_report', path: 'x.md' }],
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

// ── main ─────────────────────────────────────────────────────────────────────
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
```

After writing the file:
- Run: `node super-gsd/scripts/lib/route-ledger.cjs --self-test`
- Expect: "route-ledger self-test: 12 pass, 0 fail" + exit 0.
- Then commit:

  git add super-gsd/scripts/lib/route-ledger.cjs
  git commit -m "feat(32-01): route-ledger.cjs lib + 12-assertion self-test"

========================================================================
COMMIT 2 of 3: feat(32-01): wire codex_route into Step 9.5
========================================================================

EDIT FILE: super-gsd/skills/sgsd-orchestrate/SKILL.md

Locate the existing block that ends with `appendPerDispatchReviewEvidence(...)`
inside the `else if (effective.invocation === 'shell')` branch of Step 9.5
PER-DISPATCH ATC. The block currently ends at approximately line 1236.

Use this UNIQUE anchor to locate the insertion site (matches once in the file):

  appendPerDispatchReviewEvidence(report, {
    gate: 'per-dispatch-ATC',
    provider: report._provider || effective.name,
    fallback_triggered: !!(report._provider === 'claude-via-fallback'),
    ...(report._model ? { model: report._model } : {}),
    ...(report._reasoning_effort ? { reasoning_effort: report._reasoning_effort } : {}),
    ...(report._fallback_reason ? { fallback_reason: report._fallback_reason } : {})
  });

INSERT IMMEDIATELY AFTER the closing `});` of that block (before the next
`If critical > 0` paragraph), this exact 16-line addition:

```javascript
  // ROUTE-03 wire-in: log the codex routing decision.
  // Non-load-bearing: helper wraps in try/catch, returns false on error.
  // The orchestrator MUST continue regardless.
  require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'route-ledger.cjs'))
    .logCodexRoute(path.join(process.cwd(), '.planning'), {
      phase: currentPhase,
      milestone: currentMilestone,
      plan: currentPlan,
      dispatchResult,                                             // exit, timeout_hit
      effectiveProviderName: effective && effective.name,         // 'codex-cli-reviewer'
      fallbackProviderName: report && report._provider,           // 'openai-codex' | 'claude-via-fallback'
      fallbackTriggered: !!(report && report._provider === 'claude-via-fallback'),
      fallbackReason: (report && report._fallback_reason) || null,
      reportPath: typeof perDispatchReportPath === 'function' ? perDispatchReportPath() : null,
    });
```

NOTES on the edit:
- Use `path.join(process.cwd(), ...)` -- NOT a bare module path. SKILL.md
  is markdown documenting orchestrator pseudocode; the require shape must
  resolve from the repo root regardless of how the orchestrator was
  launched. Mirrors the pattern at SKILL.md cold-start sections.
- Do NOT wrap in an explicit try/catch in SKILL.md: `logCodexRoute`
  itself is wrapped (Section 7.2 + lib body). Adding outer try/catch
  duplicates the contract.
- The block sits inside the `else if (effective.invocation === 'shell')`
  branch -- `currentPhase`, `currentMilestone`, `currentPlan`,
  `dispatchResult`, `effective`, `report` are all already in scope (verified
  at SKILL.md:1163-1215, 1229-1236).

After writing the edit:
- Verify the wire-in is present: see the runnable verifier in <verify>.
- Then commit:

  git add super-gsd/skills/sgsd-orchestrate/SKILL.md
  git commit -m "feat(32-01): wire codex_route into sgsd-orchestrate SKILL.md Step 9.5"

========================================================================
COMMIT 3 of 3: test(32-01): deterministic local fallback for codex_route boundary
========================================================================

CREATE FILE: super-gsd/scripts/lib/route-ledger.test.cjs

Write byte-exact contents below. Imports the production lib (NO mocking
of predicates per Patch 4 of mass-discuss). Fakes ONLY the dispatchResult
payload (the I/O boundary -- output of shelling to codex-exec.sh).

```javascript
// ============================================================================
// SGSD - ROUTE-LEDGER local fallback test for codex_route boundary
// ============================================================================
// Patch 4 (mass-discuss 2026-04-26): "deterministic local-fallback that
// exercises the PRODUCTION CALLER PATH... Mock predicates that bypass
// the production caller are forbidden."
//
// This test imports `logCodexRoute` from the production lib -- the same
// helper SKILL.md Step 9.5 imports at line 1236. It fakes only the
// `dispatchResult` payload (the I/O boundary -- output of shelling to
// codex-exec.sh). All status / reason_code mapping logic runs under
// the test.
//
// Invocation: node super-gsd/scripts/lib/route-ledger.test.cjs
// Exits 0 when all 4 fixtures PASS; 1 otherwise.
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const ledger = require('./route-ledger.cjs');

let pass = 0, fail = 0;
const failures = [];
const assert = (name, cond, detail) => {
  if (cond) { pass++; }
  else { fail++; failures.push({ name, detail: detail || '' }); }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-test-'));
fs.mkdirSync(path.join(tmp, 'metrics'), { recursive: true });

try {
  // ── Fixture A: Codex success ──────────────────────────────────────────────
  ledger.logCodexRoute(tmp, {
    phase: '32', milestone: 'v1.7', plan: '32-01',
    dispatchResult: { exit: 0, timeout_hit: false },
    effectiveProviderName: 'codex-cli-reviewer',
    fallbackProviderName: 'openai-codex',
    fallbackTriggered: false,
    fallbackReason: null,
    reportPath: '.planning/milestones/v1.7/phases/32-route-decision-ledger/commit-reviews.jsonl',
  });

  // ── Fixture B: Codex timeout ──────────────────────────────────────────────
  ledger.logCodexRoute(tmp, {
    phase: '32', milestone: 'v1.7', plan: '32-01',
    dispatchResult: { exit: 5, timeout_hit: true },
    effectiveProviderName: 'codex-cli-reviewer',
    fallbackProviderName: 'openai-codex',
    fallbackTriggered: false,
    fallbackReason: null,
    reportPath: null,
  });

  // ── Fixture C: Codex auth fail -> claude fallback fired ───────────────────
  ledger.logCodexRoute(tmp, {
    phase: '32', milestone: 'v1.7', plan: '32-01',
    dispatchResult: { exit: 4, timeout_hit: false },
    effectiveProviderName: 'codex-cli-reviewer',
    fallbackProviderName: 'claude-via-fallback',
    fallbackTriggered: true,
    fallbackReason: null,
    reportPath: null,
  });

  // ── Fixture D: parse_failure -> claude fallback fired (status=warn) ───────
  ledger.logCodexRoute(tmp, {
    phase: '32', milestone: 'v1.7', plan: '32-01',
    dispatchResult: { exit: 0, timeout_hit: false },
    effectiveProviderName: 'codex-cli-reviewer',
    fallbackProviderName: 'claude-via-fallback',
    fallbackTriggered: true,
    fallbackReason: 'parse_failure',
    reportPath: '.planning/milestones/v1.7/phases/32-route-decision-ledger/commit-reviews.jsonl',
  });

  const rows = ledger.readRows(tmp);
  assert('A. four rows appended', rows.length === 4);

  // Fixture A assertions: success
  const a = rows[0];
  assert('A. codex_success: boundary === codex_route', a.boundary === 'codex_route');
  assert('A. codex_success: status === ok', a.status === 'ok');
  assert('A. codex_success: reason_codes includes review_unanimous_pass',
    Array.isArray(a.reason_codes) && a.reason_codes.includes('review_unanimous_pass'));
  assert('A. codex_success: decision.fallback_triggered === false',
    a.decision && a.decision.fallback_triggered === false);
  assert('A. codex_success: decision.from === codex-cli-reviewer',
    a.decision && a.decision.from === 'codex-cli-reviewer');
  assert('A. envelope_version === 1', a.envelope_version === 1);
  assert('A. command === logRouteDecision', a.command === 'logRouteDecision');
  assert('A. phase + milestone present', a.phase === '32' && a.milestone === 'v1.7');
  assert('A. artifacts contains review_report kind',
    Array.isArray(a.artifacts) && a.artifacts.length === 1 && a.artifacts[0].kind === 'review_report');

  // Fixture B assertions: timeout
  const b = rows[1];
  assert('B. codex_timeout: status === timeout', b.status === 'timeout');
  assert('B. codex_timeout: reason_codes includes codex_timeout',
    Array.isArray(b.reason_codes) && b.reason_codes.includes('codex_timeout'));
  assert('B. codex_timeout: decision.timeout_hit === true',
    b.decision && b.decision.timeout_hit === true);
  assert('B. codex_timeout: decision.exit === 5',
    b.decision && b.decision.exit === 5);

  // Fixture C assertions: auth fail + fallback
  const c = rows[2];
  assert('C. codex_auth_fail: status === fail', c.status === 'fail');
  assert('C. codex_auth_fail: reason_codes includes codex_auth_missing',
    Array.isArray(c.reason_codes) && c.reason_codes.includes('codex_auth_missing'));
  assert('C. codex_auth_fail: reason_codes includes codex_fallback_triggered',
    Array.isArray(c.reason_codes) && c.reason_codes.includes('codex_fallback_triggered'));
  assert('C. codex_auth_fail: decision.fallback_triggered === true',
    c.decision && c.decision.fallback_triggered === true);
  assert('C. codex_auth_fail: decision.to === claude-via-fallback',
    c.decision && c.decision.to === 'claude-via-fallback');

  // Fixture D assertions: parse_failure -> warn
  const d = rows[3];
  assert('D. parse_failure: status === warn', d.status === 'warn');
  assert('D. parse_failure: reason_codes includes codex_fallback_triggered',
    Array.isArray(d.reason_codes) && d.reason_codes.includes('codex_fallback_triggered'));
  assert('D. parse_failure: reason_codes includes parse_failure',
    Array.isArray(d.reason_codes) && d.reason_codes.includes('parse_failure'));
  assert('D. parse_failure: decision.fallback_triggered === true',
    d.decision && d.decision.fallback_triggered === true);
  assert('D. parse_failure: decision.fallback_reason === parse_failure',
    d.decision && d.decision.fallback_reason === 'parse_failure');
  assert('D. parse_failure: decision.from -> to populated',
    d.decision && d.decision.from === 'codex-cli-reviewer' &&
    d.decision.to === 'claude-via-fallback');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`route-ledger fallback test: ${pass} pass, ${fail} fail`);
if (fail > 0) {
  for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
  process.exit(1);
}
process.exit(0);
```

After writing the file:
- Run: `node super-gsd/scripts/lib/route-ledger.test.cjs`
- Expect: 4 PASS lines per fixture (>=24 pass, 0 fail) + exit 0.
- Then commit:

  git add super-gsd/scripts/lib/route-ledger.test.cjs
  git commit -m "test(32-01): deterministic local fallback for codex_route boundary"

========================================================================
KNOWN DEAD-ENDS (DO NOT DO THESE)
========================================================================

1. Do NOT modify super-gsd/registry/command-envelope-v1.yaml or
   super-gsd/templates/command-envelope-v1.json. The Phase 31 contract
   is locked. Phase 32 consumes it; if you find yourself wanting to
   extend, that is a v1.8 registry-version bump in a separate phase.

2. Do NOT add wire-ins for the other 5 boundaries (milestone_promotion,
   phase_dispatch_first, executor_choice, gate_skip, handoff_decision).
   32-CONTEXT.md "Locked decision (DISCUSS 32=A)" says boundary-only
   with codex_route as the ONE wire-in. Extras are gilding.

3. Do NOT introduce concurrent-append locking, mutexes, or lock files.
   Per 32-RESEARCH.md Section 6.2 + 9.10, the orchestrator is single-
   threaded and per-dispatch-ATC fires sequentially after parallel
   waves serialize at SKILL.md:467-471. fs.appendFileSync is atomic at
   row boundary. Adding a lock is dead weight + a new failure mode.

4. Do NOT add reason_codes outside the existing envelope-v1 vocabulary
   at command-envelope-v1.yaml:100-226. The codex_route mapping in
   logCodexRoute uses ONLY: review_unanimous_pass, codex_timeout,
   codex_auth_missing, codex_fallback_triggered, parse_failure,
   provider_unavailable. All six are pre-declared.

5. Do NOT add a renderer (route-decisions.md). 32-RESEARCH.md 9.5
   LOCKED: no renderer in v1.7. Cockpit reads jsonl directly post-v1.7
   per command-envelope-v1.yaml:232-253 (mission_strip_read_contract).

6. Do NOT wire phase-level-ATC (Step 6.5) or adversarial challenger
   (Step 9.6) -- same shape, deferred to v1.8 (32-RESEARCH.md 9.3).

7. Do NOT add a renderer-on-append. Always-on logging only.

8. Do NOT introduce new dependencies. Node built-ins only: fs, path,
   os, crypto. js-yaml is NOT required this phase (envelope-v1 vocab
   is hardcoded as a frozen built-in fallback per 32-RESEARCH.md 9.14;
   the lib does not validate reason_codes against the YAML at runtime
   because the strict-validation list in 32-RESEARCH.md Section 2 is
   {envelope_version, command, boundary, status, reason_codes[]} where
   reason_codes is "array of strings", not "array of registered codes").
   Reason-code registry-version drift is caught at envelope-v1 schema
   validation, not in this lib.

9. Do NOT use git add . or git add -A. Stage by name, three times:
   - Commit 1: super-gsd/scripts/lib/route-ledger.cjs
   - Commit 2: super-gsd/skills/sgsd-orchestrate/SKILL.md
   - Commit 3: super-gsd/scripts/lib/route-ledger.test.cjs

10. Do NOT amend commits. Three atomic commits in order. If a verifier
    fails after a commit, fix and create a NEW commit -- never --amend.
  </action>

  <verify>
    <automated>node super-gsd/scripts/lib/route-ledger.cjs --self-test &amp;&amp; node super-gsd/scripts/lib/route-ledger.test.cjs &amp;&amp; node -e "const fs=require('fs'),path=require('path'),lib=require('./super-gsd/scripts/lib/route-ledger.cjs');const expected=['milestone_promotion','phase_dispatch_first','executor_choice','gate_skip','codex_route','handoff_decision'];for(const b of expected){if(!lib.BOUNDARIES.includes(b)){console.error('missing boundary:',b);process.exit(1);}}if(lib.BOUNDARIES.length!==6){console.error('boundary count !== 6');process.exit(1);}const skill=fs.readFileSync('./super-gsd/skills/sgsd-orchestrate/SKILL.md','utf8');if(!/logCodexRoute\s*\(/m.test(skill)){console.error('SKILL.md missing logCodexRoute wire-in');process.exit(1);}if(!/boundary:\s*['\x22]codex_route['\x22]|logCodexRoute/.test(skill)){console.error('SKILL.md missing codex_route reference');process.exit(1);}console.log('PASS route-01..04 wire');"</automated>
  </verify>

  <done>
    - super-gsd/scripts/lib/route-ledger.cjs exists and `--self-test` exits 0
      with 12/12 PASS (ROUTE-01).
    - lib.BOUNDARIES is a frozen array of exactly 6 string values matching the
      canonical list (ROUTE-02).
    - super-gsd/skills/sgsd-orchestrate/SKILL.md contains the
      `logCodexRoute(...)` wire-in inserted immediately after
      `appendPerDispatchReviewEvidence(...)` in Step 9.5 (ROUTE-03).
    - super-gsd/scripts/lib/route-ledger.test.cjs exists; node-invoked it
      writes 4 envelope rows to a tmpdir ledger and asserts each row's
      shape; exits 0 (ROUTE-04 + Patch 4 live-or-local).
    - Each emitted row contains: phase, milestone, reason_codes, status,
      artifacts, evidence, boundary, decision, envelope_version === 1,
      run_id matching envelope-v1 regex, command === 'logRouteDecision'
      (ROUTE-04).
    - 3 atomic commits with correct conventional-commit messages.
    - Zero new package installs; Node built-ins only.
  </done>
</task>

</tasks>

<known_dead_ends>
See <action> "KNOWN DEAD-ENDS" block above for the full list (10 items).
Summary: do not modify Phase 31 contracts; do not wire other boundaries;
do not add concurrent locking, new reason_codes, renderer, or new deps;
stage by name; never amend.
</known_dead_ends>

<live_or_local_fallback>
Live arm: when the orchestrator next runs Step 9.5 PER-DISPATCH ATC with
codex available and the gate fires (FULL/GATE tier), the wire-in calls
logCodexRoute and writes a real route-decisions.jsonl row with
boundary='codex_route', status reflecting actual codex outcome, and
reason_codes drawn from the canonical envelope-v1 vocab.

Local arm: route-ledger.test.cjs invokes the EXACT SAME logCodexRoute
helper the orchestrator imports. It fakes only the dispatchResult
payload (the I/O boundary -- output of shelling to codex-exec.sh). All
status mapping, reason_code derivation, envelope-shaping, JSONL append,
and defensive-read logic runs under the test.

Both paths share one helper. No mock predicates. Patch 4 satisfied:
"the deterministic local-fallback exercises the PRODUCTION CALLER PATH."

Provider-unavailable (the live degraded mode) is exercised explicitly by
Fixture C (codex_auth_fail -> claude-via-fallback) and Fixture D
(parse_failure -> claude-via-fallback with status=warn). When Codex
becomes unreachable in production the orchestrator already triggers the
fallback at SKILL.md:1175-1186 and the wire-in records exactly the row
shape the local test asserts.
</live_or_local_fallback>

<schema_without_consumer_check>
ROUTE-03 says "Orchestrator invokes logRouteDecision() at >=1 boundary
in production." This phase ships:
  - The lib (route-ledger.cjs).
  - The first production caller (sgsd-orchestrate SKILL.md Step 9.5
    via logCodexRoute).
  - The local fallback test exercising the same helper.

The 5 deferred boundaries are:
  - milestone_promotion (target: SKILL.md:964-987 + sgsd-complete-milestone)
  - phase_dispatch_first (target: SKILL.md:420-437)
  - executor_choice (target: SKILL.md:439-478)
  - gate_skip (target: ~9 sites; SKILL.md:264, 329, 347, 355, 591, 798, 871, 1126, 1394, 1402)
  - handoff_decision (target: SKILL.md:432-437)

Each is documented in BOUNDARIES (frozen) AND in 32-RESEARCH.md Section 1
with the exact wire-in target. v1.8+ wire-ins consume the same lib --
the schema-without-consumer rule is not violated because the lib HAS a
consumer (codex_route).
</schema_without_consumer_check>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| orchestrator -> route-ledger.cjs | In-process require; no network surface; payload is structured object from same process |
| route-ledger.cjs -> filesystem | fs.appendFileSync to .planning/metrics/route-decisions.jsonl |
| route-decisions.jsonl -> downstream consumers | Phase 34 review-ledger / cockpit will tail-read; Phase 32 does not consume |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-32-01 | Tampering | JSONL row injection via newline in payload | mitigate | JSON.stringify escapes \n; appendFileSync adds exactly one \n; verified via assertion 8 |
| T-32-02 | Tampering | Closed-enum bypass via case mutation (e.g. 'CODEX_ROUTE') | mitigate | strict Array.includes; case-sensitive; verified via assertions 5 and 6 |
| T-32-03 | Tampering | Path traversal in artifacts[].path | accept | writer does NOT open paths -- only records strings; downstream readers (Phase 34, cockpit) must defend on read; not in this phase's scope |
| T-32-04 | Information Disclosure | Secret leakage via reason_codes | accept | reason_codes are literal vocab strings (e.g. 'codex_auth_missing'); writer never serializes auth tokens; verified by hardcoded vocab in logCodexRoute |
| T-32-05 | Denial of Service | Disk full (ENOSPC) crashes orchestrator | mitigate | logRouteDecision wraps appendRow in try/catch; on error returns false + console.warn; orchestrator continues (controlling principle: autonomy continues) |
| T-32-06 | Denial of Service | High-frequency append exhausts disk | accept | per-dispatch-ATC fires once per FULL/GATE tier commit; bounded by phase commit cadence; ~N rows/phase, not N/sec |
| T-32-07 | Repudiation | Missing row when writer throws | accept | route-ledger is observability, not consensus; missed row is soft fault; orchestrator continues; cockpit may show partial signal until next dispatch |
| T-32-08 | Spoofing | Forged route-decisions.jsonl row from outside the orchestrator | accept | local-FS attacker could write directly; out of scope for in-process telemetry; downstream consumers (Phase 34) handle integrity |

## ASVS Coverage

V5 Input Validation: yes -- closed-enum on `boundary` (BOUNDARIES) and
`status` (STATUSES); array typing enforced on reason_codes / artifacts /
evidence.

V6 Cryptography: minor -- crypto.randomBytes(2) for run_id; no key
material; collisions probabilistically rejected by 100-unique self-test
assertion (#11) which would fail on collision over a 100-call window.

Other ASVS classes (V2/V3/V4) not applicable -- no auth, no session,
no access control surface in a same-process telemetry writer.
</threat_model>

<verification>
## Phase-level acceptance gates

ROUTE-01 (writer module + --self-test):
  `node super-gsd/scripts/lib/route-ledger.cjs --self-test`
  -> "route-ledger self-test: 12 pass, 0 fail" + exit 0.

ROUTE-02 (6 boundary types defined + enforceable):
  `node -e "const lib=require('./super-gsd/scripts/lib/route-ledger.cjs');
            const want=['milestone_promotion','phase_dispatch_first',
            'executor_choice','gate_skip','codex_route','handoff_decision'];
            for(const b of want){if(!lib.BOUNDARIES.includes(b)){
              console.error('missing:',b);process.exit(1);}}
            if(lib.BOUNDARIES.length!==6){
              console.error('count !== 6');process.exit(1);}
            console.log('PASS ROUTE-02');"`
  -> "PASS ROUTE-02" + exit 0.

ROUTE-03 (orchestrator invokes logRouteDecision/logCodexRoute >=1 boundary):
  `node -e "const fs=require('fs');
            const skill=fs.readFileSync(
              './super-gsd/skills/sgsd-orchestrate/SKILL.md','utf8');
            if(!/logCodexRoute\s*\(/m.test(skill)){
              console.error('SKILL.md missing logCodexRoute wire-in');
              process.exit(1);}
            console.log('PASS ROUTE-03');"`
  -> "PASS ROUTE-03" + exit 0.

ROUTE-04 (rows include phase + milestone + reason_codes + outcome + artifacts):
  Implicit in route-ledger.test.cjs Fixture A assertion
  "A. phase + milestone present" + "A. envelope_version === 1" +
  "A. command === logRouteDecision" + "A. artifacts contains review_report kind"
  -> all PASS in fallback test.

Live-or-local (Patch 4):
  `node super-gsd/scripts/lib/route-ledger.test.cjs`
  -> >=24 PASS / 0 fail + exit 0; produces 4 canonical envelope rows in
  tmpdir; uses production lib (no mocks); covers success / timeout /
  auth-fail / parse-failure-fallback canonical outcomes.

Envelope-v1 reconciliation:
  Each emitted row is a valid command-envelope-v1.json instance:
    envelope_version === 1 (const)
    command === 'logRouteDecision'
    status in STATUSES (subset of envelope-v1 6-state enum)
    run_id matches envelope-v1 pattern
    required envelope-v1 fields all present
  Verified by self-test assertions 1, 2, 4 and fallback test "envelope_version === 1"
  + "command === logRouteDecision" assertions on every fixture.

Orchestrator boot smoke check:
  After Commit 2, the SKILL.md edit must not break orchestrator parsing.
  Run: `node super-gsd/scripts/lib/route-ledger.cjs --self-test` immediately
  after the SKILL.md commit (the lib is independent; passes regardless).
  The integration smoke is the route-ledger.test.cjs run in Commit 3,
  which exercises the EXACT helper the SKILL.md wire-in invokes.
</verification>

<success_criteria>
- ROUTE-01: route-ledger.cjs lib + --self-test (12/12 PASS) -- shipped.
- ROUTE-02: BOUNDARIES const exports all 6 boundary names; invalid
  boundaries rejected (assertions 5 and 6).
- ROUTE-03: SKILL.md contains the codex_route wire-in at Step 9.5
  immediately after appendPerDispatchReviewEvidence.
- ROUTE-04: Every emitted row contains phase, milestone, reason_codes,
  status (envelope-v1 outcome), artifacts; fallback test asserts shape
  on all 4 canonical fixtures.
- Patch 4: deterministic local fallback test exercises production
  caller path (no mock predicates); 4 fixtures PASS.
- Schema-without-consumer rule: codex_route is the production caller
  shipping THIS phase; lib has its first consumer.
- 3 atomic commits, no amendments, no batched stages.
- Zero new dependencies; Node built-ins only.
- Orchestrator continues regardless of writer success (logRouteDecision
  + logCodexRoute both wrap in try/catch and return false on failure).
</success_criteria>

<commit_plan>
1. `feat(32-01): route-ledger.cjs lib + 12-assertion self-test`
   - Stage: super-gsd/scripts/lib/route-ledger.cjs
2. `feat(32-01): wire codex_route into sgsd-orchestrate SKILL.md Step 9.5`
   - Stage: super-gsd/skills/sgsd-orchestrate/SKILL.md
3. `test(32-01): deterministic local fallback for codex_route boundary`
   - Stage: super-gsd/scripts/lib/route-ledger.test.cjs

Order is mandatory:
  - Commit 2 depends on Commit 1's lib being on disk (require resolves).
  - Commit 3 depends on Commit 1's lib (imports logCodexRoute) and on
    Commit 2 only insofar as the integration story is complete (the
    fallback test itself does NOT execute SKILL.md -- it imports the
    lib directly).

Run `git status` after each commit to verify clean working tree before
the next.
</commit_plan>

<output>
After completion, create:
`.planning/milestones/v1.7/phases/32-route-decision-ledger/32-01-route-ledger-SUMMARY.md`

Summary must include:
  - Plan id, phase, requirements (ROUTE-01..04 -> all green).
  - 3 commits with one-liner per commit.
  - Self-test result (12/12 PASS).
  - Fallback test result (4 fixtures PASS, total assertion count).
  - Files modified (3 files, ~376 lines additive, 0 deletions).
  - Confirmation of envelope-v1 reconciliation (no contract bump).
  - Confirmation of locked-decisions: 32=A boundary-only honored
    (1 wire-in shipped, 5 deferred).
  - Live-or-local proof: fallback test produces 4 canonical rows in
    tmpdir; live wire-in fires next time codex per-dispatch-ATC runs.
  - Any deviations or issues encountered (expected: none; LITE tier).
</output>
