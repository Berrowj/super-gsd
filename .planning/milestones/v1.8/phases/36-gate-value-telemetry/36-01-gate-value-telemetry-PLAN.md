---
plan_id: 36-01
phase: 36
title: Gate Value Telemetry
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [GVAL-01, GVAL-02, GVAL-03, GVAL-04]
locked_decisions: [36=B]
depends_on: [31, 32, 33, 34]
created: 2026-04-27
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/scripts/lib/gate-value-log.cjs
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - super-gsd/scripts/lib/gate-value-log.test.cjs
    hypothesis: "Logging gate-fire outcomes (pass/warn/block/skip) as envelope-v1-wrapped JSONL rows produces evidence Phase 39 rubric can use to keep/kill gates and Phase 38 sampling-decider can use for risk-tier intersection."
    falsifier: "First 10 rows show no outcome variance (all pass) -- telemetry has no signal value; revisit gate-fire decision points."
    stop_rule: "self-test 12+ assertions PASS; SKILL.md grep for logGateValue\\( returns >=3; --summary groups by gate; local fallback test produces 4 canonical envelope rows (pass/warn/block/skip)."
    minimal_test: "node super-gsd/scripts/lib/gate-value-log.cjs --self-test -> exit 0; node super-gsd/scripts/lib/gate-value-log.test.cjs -> all 4 fixtures PASS."

must_haves:
  truths:
    - "Each row is valid envelope-v1 wrapper + extension fields gate / outcome / retroactive (Phase 31 contract preserved; collides_with: [] still holds)"
    - "logGateValue never throws upward (mirrors route-ledger.cjs / review-ledger.cjs locked design)"
    - "OUTCOMES is Object.freeze(['pass','warn','block','skip'])"
    - "value_score = max(0, (pass + 0.5*warn - block) / fires) when fires > 0, else null (defer-on-empty for Phase 39)"
    - "3 SKILL.md wire-in sites cover phase-level-ATC + per-dispatch-ATC + MUDA-waste-audit; both SKIP + FIRE arms; try/catch wrapped"
    - "Self-test isolated to os.tmpdir(); __dirname-anchored fingerprint guard"
  artifacts:
    - super-gsd/scripts/lib/gate-value-log.cjs (NEW ~350 LOC)
    - super-gsd/skills/sgsd-orchestrate/SKILL.md (~30 LOC; 3 wire-in sites)
    - super-gsd/scripts/lib/gate-value-log.test.cjs (NEW ~80 LOC; 4 fixtures)
  key_links:
    - 36-CONTEXT.md
    - 36-RESEARCH.md (sec 3, 4, 6, 7, 9, 10 for outcome enum, summary, public API, fallback, locks)
    - command-envelope-v1.yaml (Phase 31 5th contract)
    - route-ledger.cjs (Phase 32 architectural template)
---

<objective>
Phase 36 lands the 8th envelope-v1 emitter: an append-only writer +
summarizer for `.planning/metrics/gate-value-log.jsonl`, plus three
SKILL.md wire-ins capturing gate-FITNESS data (skip-vs-fire +
outcome-when-fired) at every gate-fire decision point that emits review
evidence.

Architecture is a 1:1 mirror of `super-gsd/scripts/lib/route-ledger.cjs`
(Phase 32) and `super-gsd/scripts/lib/review-ledger.cjs` (Phase 34):
__dirname-anchored fingerprint guard, public API never throws upward,
frozen const enums, manual envelope-v1 schema check, defensive read.

Locked design (mass-discuss line 211, decision 36=B): outcome +
retroactive metadata snapshot AS-OF fire time, **no cost telemetry**.
Phase 38 sampling-decider reads `gate_fitness_history` from this log;
Phase 39 keep/kill rubric reads fire/pass/block counts and applies
defer-on-empty when `fires=0`. Cost is a v2.0+ ops concern, not a v1.8
fitness concern.

Purpose:
- GVAL-01: shippable writer module with --self-test scaffold
- GVAL-02: at least 1 production caller (we ship 3 wire-ins for full coverage)
- GVAL-03: every emitted row carries `gate, outcome, phase, milestone, ts, run_id, retroactive`
- GVAL-04: --summary CLI groups by gate and emits per-gate {fires, pass, warn, block, skip, fire_rate, value_score}

Output:
- 1 new lib at `super-gsd/scripts/lib/gate-value-log.cjs` (~350 LOC)
- 3 inline wire-ins inside `super-gsd/skills/sgsd-orchestrate/SKILL.md`
- 1 new local-fallback test at `super-gsd/scripts/lib/gate-value-log.test.cjs` (~80 LOC)
- Net diff approximately +580 / -3 across 2 created + 1 edited file
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP-AGENT.md
@.planning/milestones/v1.8/REQUIREMENTS.md
@.planning/milestones/v1.8/phases/36-gate-value-telemetry/36-CONTEXT.md
@.planning/milestones/v1.8/phases/36-gate-value-telemetry/36-RESEARCH.md
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/scripts/lib/review-ledger.cjs
@super-gsd/scripts/lib/repair-command-checker.cjs
@super-gsd/registry/command-envelope-v1.yaml
@super-gsd/templates/command-envelope-v1.json
@super-gsd/registry/gates.yaml
@super-gsd/scripts/lib/gates-registry.cjs
@super-gsd/skills/sgsd-orchestrate/SKILL.md

<interfaces>
<!-- Architectural template: route-ledger.cjs (Phase 32) public API -->
<!-- Mirror this 1:1 in gate-value-log.cjs. Do NOT invent new patterns. -->

From super-gsd/scripts/lib/route-ledger.cjs:
```javascript
// Frozen enum
const BOUNDARIES = Object.freeze([...]);
const STATUSES   = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);

// run_id pattern -- envelope-v1 contract (cf. command-envelope-v1.json:78)
const RUN_ID_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;
function generateRunId(): string;

// Internal -- throws on validation; caller catches
function _normalize(row): NormalizedRow;
function _assertEnvelopeV1(row): void;
function appendRow(planningDir, row): NormalizedRow;
function readRows(planningDir): NormalizedRow[];

// Public -- never throws upward
function logRouteDecision(planningDir, args): boolean;
function logCodexRoute(planningDir, ctx): NormalizedRow | false;

// Self-test: 12 assertions in tmpdir, __dirname-anchored fingerprint guard
function selfTest(): number;  // 0 = all pass, 1 = at least one failure
```

From super-gsd/scripts/lib/review-ledger.cjs:
```javascript
const LEGACY_VERDICT_MAP = Object.freeze({
  'pass':          { status: 'ok',      reason_codes: ['review_unanimous_pass'] },
  'warn':          { status: 'warn',    reason_codes: ['atc_warn_only'] },
  'critical':      { status: 'fail',    reason_codes: ['atc_critical'] },
  'critical-halt': { status: 'blocked', reason_codes: ['atc_critical'] },
  'block':         { status: 'blocked', reason_codes: ['atc_critical'] },
  'skipped':       { status: 'skipped', reason_codes: ['gate_skip_with_reason'] },
});
function appendReviewRow(planningDir, row): NormalizedRow | false;
function readReviewRows(planningDir, opts?): NormalizedRow[];
function ledgerPath(planningDir): string;
```

From super-gsd/scripts/lib/gates-registry.cjs:
```javascript
// Reads gates.yaml entry for snapshot at fire time
function getGate(name, gatesYamlPath?): {
  name: string,
  step: string,           // '6.5' | '9.5' | '6.55' | etc.
  category: string,       // 'code-quality' | 'process-hygiene' | 'verify-completeness'
  enforcement_mode: string, // 'hard-halt' | 'amortized' | 'soft-warn' | 'disabled'
  version: string,        // '2.0' | '2.1'
  // ... other fields
};
function shouldFire(name, ctx, gatesYamlPath?): boolean;
function resolveReviewerProvider(...): {...};
function getProvider(name): {...};
```

From super-gsd/registry/command-envelope-v1.yaml (the contract):
```yaml
# 13 required envelope-v1 fields (additionalProperties: true)
- envelope_version: 1
- ts: ISO-8601
- command: string
- status: enum [ok, warn, fail, skipped, timeout, blocked]
- reason_codes: string[]
- artifacts: {kind, path}[]
- evidence: {kind, ref}[]
- next_action: string|null
- risk: low|medium|high|null
- duration_ms: integer>=0|null
- run_id: matches RUN_ID_REGEX
- phase: string|null
- milestone: string|null
# Phase 36 extension fields (additionalProperties: true allows these):
- gate: string             # NEW
- outcome: pass|warn|block|skip   # NEW
- retroactive: object      # NEW
```

From super-gsd/skills/sgsd-orchestrate/SKILL.md (3 wire-in sites):
```text
Site 1 (phase-level-ATC):
  Line 591: if (config.atc.enabled && gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH) && verification.status == "passed")
  Line 760-768: post-dispatch verdict known via report.verdict / critical_count

Site 2 (per-dispatch-ATC):
  Line 1126: if (config.atc.enabled && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH))
  Line 1276-1279: extractedVerdict / extractedCritical (post-convergence; covers Codex + Claude paths)

Site 3 (MUDA-waste-audit):
  Line 799: if (gates.shouldFire('MUDA-waste-audit', ctx, GATES_YAML_PATH))
  Line 818-823: shell exit code (0 -> pass, 1 -> warn, 2 -> block)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task T1.A1: Create gate-value-log.cjs lib + 12-assertion self-test</name>
  <files>super-gsd/scripts/lib/gate-value-log.cjs</files>
  <behavior>
    - OUTCOMES is `Object.freeze(['pass','warn','block','skip'])`; mutation attempts throw in strict mode
    - STATUSES re-exports envelope-v1 6-state enum
    - VERDICT_OUTCOME_MAP is frozen with 6 keys (pass/warn/critical/critical-halt/block/skipped)
    - Empty read on a fresh tmpdir returns `[]`
    - Single `logGateValue(tmp, {gate:'phase-level-ATC', outcome:'pass', phase:'36', milestone:'v1.8', retroactive:{step:'6.5',category:'code-quality',enforcement_mode:'hard-halt',version:'2.1'}})` produces one envelope-shaped row with `command='logGateValue'`, `gate`, `outcome`, `retroactive` populated, RUN_ID_REGEX-compliant `run_id`, and `envelope_version: 1`
    - Invalid `outcome` (e.g. 'banana') -> `false` + stderr; never throws upward
    - Invalid `gate` (empty string / non-string / undefined) -> `false` + stderr; never throws upward
    - Missing `gate` field -> `false` + stderr
    - Three sequential `logGateValue` calls -> three rows (append-only; never truncated)
    - Defensive parse: `'{not-json\n'` injected mid-file; subsequent valid append + `readGateValueRows` returns 4 valid rows (malformed line skipped)
    - `outcomeFromVerdict('pass')==='pass'`, `('warn')==='warn'`, `('critical')==='block'`, `('critical-halt')==='block'`, `('block')==='block'`, `('skipped')==='skip'`; numeric fallback: `(undefined, 0)==='pass'`, `(undefined, 5)==='block'`; unknown verdict -> `'warn'`
    - `summarize(tmp)` over a fixture of {3 pass + 1 warn + 1 block + 2 skip} for gate `g1` returns `{gate:'g1', fires:5, pass:3, warn:1, block:2, skip:2, total_observations:7, fire_rate: 5/7, value_score: max(0,(3+0.5-2)/5)=0.3}`
    - `summarize(tmp, {milestone:'v1.7'})` filter excludes v1.8 rows
    - 100 rapid `generateRunId()` calls produce 100 unique values
    - Bonus: canonical `.planning/metrics/gate-value-log.jsonl` is unchanged (existed-before == existed-after, mtime, size) -- proves __dirname-anchored fingerprint guard works regardless of cwd
  </behavior>
  <action>
**Create `super-gsd/scripts/lib/gate-value-log.cjs` (~350 LOC).**

Mirror `super-gsd/scripts/lib/route-ledger.cjs` and
`super-gsd/scripts/lib/review-ledger.cjs` 1:1. The new file is the 8th
envelope-v1 emitter (after the 7 in command-envelope-v1.yaml:22-78 +
Phase 32 codex_route + Phase 34 atc-review).

**Header (lines 1-50)** -- top-of-file block comment citing:
- 36-RESEARCH.md sec 10 (15 LOCKED derivation calls)
- 36-RESEARCH.md sec 11 (single-plan recommendation)
- Phase 31 envelope-v1 contract preservation
- Phase 32 route-ledger architectural template
- Phase 34 review-ledger LEGACY_VERDICT_MAP precedent
- Failure contract: NEVER throws upward
- Schema per row: envelope-v1 wrapper + 3 extension fields (`gate`, `outcome`, `retroactive`)

**Imports (lines 51-55)**:
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
```

**Frozen constants (lines 56-90)** -- 36-RESEARCH.md sec 7:
```javascript
// GVAL-03: closed enum of 4 outcomes. Frozen.
const OUTCOMES = Object.freeze(['pass','warn','block','skip']);

// envelope-v1 status enum. Frozen. Mirrors route-ledger.cjs:67-69.
const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);

// Outcome -> envelope status derivation (locked Q5 -- outcome wins).
const OUTCOME_STATUS_MAP = Object.freeze({
  'pass':  'ok',
  'warn':  'warn',
  'block': 'fail',
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

// Verdict -> outcome derivation. Mirrors review-ledger.cjs:65-72 LEGACY_VERDICT_MAP.
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
```

**Path resolver (lines 91-95)**:
```javascript
function ledgerPath(planningDir) {
  return path.join(planningDir, LEDGER_REL);
}
```

**run_id generator (lines 96-105)** -- mirror route-ledger.cjs:80-84:
```javascript
function generateRunId() {
  const ts = new Date().toISOString();
  const rand = crypto.randomBytes(2).toString('hex');
  return `${ts}-${rand}`;
}
```

**outcomeFromVerdict helper (lines 106-130)** -- 36-RESEARCH.md sec 3:
```javascript
// Pure helper exported for SKILL.md wire-ins. Maps a review verdict
// (or numeric criticalCount fallback) to an OUTCOMES enum value.
// Unknown verdict -> 'warn' (mirrors review-ledger Q9 lock).
function outcomeFromVerdict(verdict, criticalCount) {
  if (typeof verdict === 'string'
      && Object.prototype.hasOwnProperty.call(VERDICT_OUTCOME_MAP, verdict)) {
    return VERDICT_OUTCOME_MAP[verdict];
  }
  if (typeof criticalCount === 'number' && criticalCount > 0) return 'block';
  if (typeof criticalCount === 'number' && criticalCount === 0) return 'pass';
  return 'warn'; // unknown -> warn
}
```

**_normalize (lines 131-180)** -- envelope-v1 wrapper + extension fields.
Throws on closed-enum violation (caller catches). Per Q5 lock,
caller-provided `status` is ignored; `status` is always derived from
`outcome`:
```javascript
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
```

**_assertEnvelopeV1 (lines 181-215)** -- mirror route-ledger.cjs:141-171
verbatim, swap "route-ledger" prefix for "gate-value-log".

**_appendRowInternal (lines 216-225)**:
```javascript
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
```

**Public API (lines 226-275)** -- 36-RESEARCH.md sec 7. All 4 wrap in
try/catch; never throws upward; on error stderr-warns and returns
falsey:
```javascript
function logGateValue(planningDir, args) {
  try {
    return _appendRowInternal(planningDir, args || {});
  } catch (e) {
    console.warn('[SGSD] gate-value-log logGateValue failed:', e.message);
    return false;
  }
}

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
```

**summarize (lines 276-325)** -- 36-RESEARCH.md sec 4 verbatim:
```javascript
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
      if (!byGate.has(g)) byGate.set(g, { gate: g, fires:0, pass:0, warn:0, block:0, skip:0 });
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
```

**selfTest (lines 326-470)** -- 12+ assertions in tmpdir,
__dirname-anchored fingerprint guard (Phase 32 W3 lesson). Setup mirrors
route-ledger.cjs:296-305. Lib lives at
`<repo>/super-gsd/scripts/lib/gate-value-log.cjs`; canonical at
`<repo>/.planning/metrics/gate-value-log.jsonl` -- 3 dirs up plus
`.planning`:
```javascript
const realLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'gate-value-log.jsonl');
const realExistedBefore = fs.existsSync(realLedger);
const realMtimeBefore   = realExistedBefore ? fs.statSync(realLedger).mtimeMs : 0;
const realSizeBefore    = realExistedBefore ? fs.statSync(realLedger).size : 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-'));
```

12 assertions per `<behavior>` block above. Use the same
`assert(name, cond, detail)` helper pattern as route-ledger.cjs:289-292.
At end: `console.log('gate-value-log self-test: ' + pass + ' pass, ' +
fail + ' fail');` and return 0 on all-pass, 1 on any failure.

**Main (lines 471-490)** -- mirror route-ledger.cjs:423-430 + add --summary:
```javascript
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === '--self-test') process.exit(selfTest());

  if (cmd === '--summary') {
    const idx = process.argv.indexOf('--planning-dir');
    const planningDir = (idx > 0 && process.argv[idx + 1])
      ? path.resolve(process.argv[idx + 1])
      : path.resolve(process.cwd(), '.planning');
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
```

**Module exports (lines 491-510)** -- 36-RESEARCH.md sec 7:
```javascript
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
```

**Constraints**:
- ASCII-only; LF line endings (no CRLF)
- No new dependencies (Node built-ins + already-vendored modules only)
- No `require('js-yaml')` -- gate-value-log doesn't read gates.yaml; the
  caller passes `gates.getGate(name)` result through the `retroactive`
  arg (Q6 lock: gate name validation = "non-empty string" only)
- Header MUST cite 36-RESEARCH.md sec 10 + sec 11
- Failure contract MUST mirror route-ledger.cjs:42-51 / review-ledger.cjs:50-51 verbatim wording
- All public helpers in try/catch with `console.warn('[SGSD] gate-value-log <fn> failed:', e.message)` + return falsey
- Self-test MUST anchor to `__dirname` not `process.cwd()` (Phase 32 W3 lesson, locked)
- Self-test MUST clean up tmpdir in `finally` block
- 100-call uniqueness assertion REQUIRED (Q11 lock parity with review-ledger)
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/gate-value-log.cjs --self-test</automated>
  </verify>
  <done>
    - File exists at `super-gsd/scripts/lib/gate-value-log.cjs`
    - `node super-gsd/scripts/lib/gate-value-log.cjs --self-test` exits 0
    - 12+ assertions reported PASS, 0 FAIL
    - Canonical `.planning/metrics/gate-value-log.jsonl` (if pre-existing) byte-identical (mtime + size unchanged) after self-test
    - `node super-gsd/scripts/lib/gate-value-log.cjs --summary` runs without error (may emit `[]` on cold start; exit 0)
    - `module.exports` lists exactly: logGateValue, readGateValueRows, summarize, ledgerPath, outcomeFromVerdict, OUTCOMES, STATUSES, VERDICT_OUTCOME_MAP, COMMAND_NAME, ENVELOPE_VERSION
    - File is ~350 LOC; no new deps in package.json (the lib is dep-free)
  </done>
</task>

<task type="auto">
  <name>Task T1.A2: Wire logGateValue into 3 SKILL.md gate-fire decision points</name>
  <files>super-gsd/skills/sgsd-orchestrate/SKILL.md</files>
  <action>
**Wire `logGateValue` into 3 sites in `super-gsd/skills/sgsd-orchestrate/SKILL.md`.**

Each site applies the same 3-step refactor:

1. **Single-call hoist** (Q11 lock): replace the existing
   `if (gates.shouldFire(...))` with
   `const fired = gates.shouldFire(...);` then `if (!fired) {...}` and
   `if (fired) {...}`. Saves a duplicate evaluation and gives both arms
   a stable `fired` reference. Other code paths that already use
   `if (gates.shouldFire(...))` further down the same block remain
   untouched -- only the top-level guard at each of the 3 sites changes.

2. **SKIP arm wire-in**: when `!fired`, append a row with
   `outcome:'skip'` and `evidence:[]` (no review report exists). Wrap
   in try/catch -- orchestrator continues regardless.

3. **FIRE arm wire-in**: at the post-verdict point inside the existing
   gate body, append a row with the outcome derived from the verdict
   (or shell exit code for MUDA). Wrap in try/catch.

**Pattern (template)**:

```javascript
const fired = gates.shouldFire('<gate>', ctx, GATES_YAML_PATH);
if (!fired) {
  try {
    require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
      .logGateValue(path.join(process.cwd(), '.planning'), {
        gate:        '<gate>',
        outcome:     'skip',
        phase:       currentPhase,
        milestone:   currentMilestone,
        retroactive: gates.getGate('<gate>', GATES_YAML_PATH),
      });
  } catch (e) {
    console.warn('[SGSD] gate-value-log skip-arm wire-in failed (continuing):', e && e.message);
  }
}

if (fired) {
  // ... existing gate body unchanged ...

  try {
    const gateValueLog = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'));
    gateValueLog.logGateValue(path.join(process.cwd(), '.planning'), {
      gate:        '<gate>',
      outcome:     <outcome-derived>,
      phase:       currentPhase,
      milestone:   currentMilestone,
      evidence:    <evidence-when-applicable>,
      retroactive: gates.getGate('<gate>', GATES_YAML_PATH),
    });
  } catch (e) {
    console.warn('[SGSD] gate-value-log fire-arm wire-in failed (continuing):', e && e.message);
  }
}
```

---

**Site 1: phase-level-ATC (around SKILL.md:591 + post-verdict ~768)**

Locate the existing line:
```
IF config.atc.enabled AND gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH) AND verification.status == "passed":
```

Refactor to:
```javascript
const phaseAtcFired = config.atc.enabled
  && gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH)
  && verification.status == "passed";

if (!phaseAtcFired) {
  try {
    require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
      .logGateValue(path.join(process.cwd(), '.planning'), {
        gate:        'phase-level-ATC',
        outcome:     'skip',
        phase:       currentPhase,
        milestone:   currentMilestone,
        retroactive: gates.getGate('phase-level-ATC', GATES_YAML_PATH),
      });
  } catch (e) {
    console.warn('[SGSD] gate-value-log phase-level-ATC skip-arm failed (continuing):', e && e.message);
  }
}

if (phaseAtcFired) {
  // ... lines 593-768 unchanged: classify tier, dispatch reviewer,
  //     write ATC-REVIEW.md, extract verdict + critical_count ...
```

Then immediately AFTER the existing line where the verdict is known
(currently line 768 area: `→ Returns: { findings, critical_count,
warning_count, verdict }`) and BEFORE Step 6.5(d) processes the result,
append the FIRE-arm wire-in:

```javascript
  try {
    const gateValueLog = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'));
    const reportPath = (typeof phaseAtcReportPath === 'function') ? phaseAtcReportPath() : null;
    gateValueLog.logGateValue(path.join(process.cwd(), '.planning'), {
      gate:        'phase-level-ATC',
      outcome:     gateValueLog.outcomeFromVerdict(report && report.verdict, report && report.critical_count),
      phase:       currentPhase,
      milestone:   currentMilestone,
      evidence:    reportPath ? [{ kind: 'review_report', ref: reportPath }] : [],
      retroactive: gates.getGate('phase-level-ATC', GATES_YAML_PATH),
    });
  } catch (e) {
    console.warn('[SGSD] gate-value-log phase-level-ATC fire-arm failed (continuing):', e && e.message);
  }
} // end if (phaseAtcFired)
```

---

**Site 2: per-dispatch-ATC (around SKILL.md:1126 + post-convergence ~1276)**

Locate the existing line:
```javascript
if (config.atc.enabled && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH)) {
```

Refactor to:
```javascript
const perDispatchAtcFired = config.atc.enabled
  && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH);

if (!perDispatchAtcFired) {
  try {
    require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
      .logGateValue(path.join(process.cwd(), '.planning'), {
        gate:        'per-dispatch-ATC',
        outcome:     'skip',
        phase:       currentPhase,
        milestone:   currentMilestone,
        retroactive: gates.getGate('per-dispatch-ATC', GATES_YAML_PATH),
      });
  } catch (e) {
    console.warn('[SGSD] gate-value-log per-dispatch-ATC skip-arm failed (continuing):', e && e.message);
  }
}

if (perDispatchAtcFired) {
  // ... lines 1128-1305 unchanged: dispatch Codex/Claude, run
  //     validateContract, single-retry fallback, ROUTE-03 wire (line
  //     1216-1233), appendPerDispatchReviewEvidence, LEDGER-02 wire
  //     (line 1257-1305) ...
```

Place the FIRE-arm wire-in AFTER the existing LEDGER-02 try/catch block
(current line ~1305), at the convergence point where both Codex and
Claude paths have produced extracted contract fields. Reuse those
extracted fields:
```javascript
  try {
    const gateValueLog = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'));
    const reportPath = (typeof perDispatchReportPath === 'function') ? perDispatchReportPath() : null;
    // Reuse the same extracted contract fields as the LEDGER-02 wire above.
    const extractedVerdict  = (typeof verdict !== 'undefined')        ? verdict        : (report && report.verdict);
    const extractedCritical = (typeof critical_count !== 'undefined') ? critical_count : (report && report.critical_count);
    gateValueLog.logGateValue(path.join(process.cwd(), '.planning'), {
      gate:        'per-dispatch-ATC',
      outcome:     gateValueLog.outcomeFromVerdict(extractedVerdict, extractedCritical),
      phase:       currentPhase,
      milestone:   currentMilestone,
      evidence:    reportPath ? [{ kind: 'review_report', ref: reportPath }] : [],
      retroactive: gates.getGate('per-dispatch-ATC', GATES_YAML_PATH),
    });
  } catch (e) {
    console.warn('[SGSD] gate-value-log per-dispatch-ATC fire-arm failed (continuing):', e && e.message);
  }
} // end if (perDispatchAtcFired)
```

ONE wire covers both Claude and Codex paths because both converge here
(per 34-RESEARCH.md sec 3.3 + sec 11.2; same logic that justified the
single LEDGER-02 wire).

---

**Site 3: MUDA-waste-audit (around SKILL.md:799 + post-shell-exit ~818-823)**

Locate the existing line:
```javascript
if (gates.shouldFire('MUDA-waste-audit', ctx, GATES_YAML_PATH)) {
```

Refactor to:
```javascript
const mudaFired = gates.shouldFire('MUDA-waste-audit', ctx, GATES_YAML_PATH);

if (!mudaFired) {
  try {
    require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
      .logGateValue(path.join(process.cwd(), '.planning'), {
        gate:        'MUDA-waste-audit',
        outcome:     'skip',
        phase:       currentPhase,
        milestone:   currentMilestone,
        retroactive: gates.getGate('MUDA-waste-audit', GATES_YAML_PATH),
      });
  } catch (e) {
    console.warn('[SGSD] gate-value-log MUDA-waste-audit skip-arm failed (continuing):', e && e.message);
  }
}

if (mudaFired) {
  // ... lines 805-836 unchanged: shell out to sgsd-muda-audit.sh,
  //     parse exit code, write WASTE.md, curate findings ...
```

Place the FIRE-arm wire-in AFTER Step 6.55(b) parses the exit code and
BEFORE Step 6.55(c)/(d) (around line 824-830 area), so the shell exit
code is already known. Map exit -> outcome:
```javascript
  // After the script's exit code has been parsed (Step 6.55.b above):
  //   exit 0 -> all probes PASS  -> outcome 'pass'
  //   exit 1 -> WARN findings    -> outcome 'warn'
  //   exit 2 -> FAIL findings    -> outcome 'block'
  //   other  -> outcome 'block' (script crash is value-negative)
  try {
    const gateValueLog = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'));
    let mudaOutcome;
    if      (mudaExitCode === 0) mudaOutcome = 'pass';
    else if (mudaExitCode === 1) mudaOutcome = 'warn';
    else                          mudaOutcome = 'block';
    const wastePath = path.join(currentPhaseDir || '', 'WASTE.md');
    const evidence = (currentPhaseDir && fs.existsSync(wastePath))
      ? [{ kind: 'review_report', ref: wastePath }]
      : [];
    gateValueLog.logGateValue(path.join(process.cwd(), '.planning'), {
      gate:        'MUDA-waste-audit',
      outcome:     mudaOutcome,
      phase:       currentPhase,
      milestone:   currentMilestone,
      evidence,
      retroactive: gates.getGate('MUDA-waste-audit', GATES_YAML_PATH),
    });
  } catch (e) {
    console.warn('[SGSD] gate-value-log MUDA-waste-audit fire-arm failed (continuing):', e && e.message);
  }
} // end if (mudaFired)
```

If the existing SKILL.md does not already capture the shell exit code
in a named variable (currently it appears as inline parsing language),
introduce `const mudaExitCode = <result>.exit;` as part of step (b)
prior to the wire-in, in the same minimal style as the ROUTE-03 wire-in
introduced `dispatchResult` references at line 1227.

---

**Verification command after edit**:

```bash
grep -c 'logGateValue\s*(' super-gsd/skills/sgsd-orchestrate/SKILL.md
```

Must return >= 6 (3 SKIP arms + 3 FIRE arms; each call counted; the
template-only `<gate>` placeholders inside any commentary do NOT count
toward this number, so any prose comments must use `logGateValue(...)`
without parentheses or use the spelled-out form `log gate value` to
avoid false positives).

For GVAL-02 the contract requires only >= 3, but ours is 6 -- well
above the bar.

**Constraints**:
- ASCII-only; LF line endings throughout the modified region
- Do NOT remove or modify any existing logic inside the gate bodies
  (the existing `appendReviewEvidence`, `appendPerDispatchReviewEvidence`,
  `logCodexRoute`, `appendReviewRow` calls all stay verbatim)
- Do NOT introduce new module-level imports; use the same inline
  `require(path.join(process.cwd(), ...))` pattern as the existing
  ROUTE-03 (line 1222) and LEDGER-02 (line 1270) wire-ins
- Every wire-in MUST be wrapped in try/catch with `console.warn` on
  failure -- never throw upward
- Comments above each wire-in MUST cite `36=B` and `36-RESEARCH.md sec 2`
  (wire-in inventory) to mirror the citation style of ROUTE-03 / LEDGER-02
  </action>
  <verify>
    <automated>c=$(grep -c 'logGateValue\s*(' super-gsd/skills/sgsd-orchestrate/SKILL.md) && [ "$c" -ge 3 ] && echo "PASS GVAL-02 ($c sites)" || (echo "FAIL GVAL-02 (got $c, need >=3)" && exit 1)</automated>
  </verify>
  <done>
    - SKILL.md contains exactly 3 sites (phase-level-ATC, per-dispatch-ATC, MUDA-waste-audit)
    - Each site has BOTH a SKIP arm and a FIRE arm wired, total 6 calls
    - Every call wrapped in try/catch with `console.warn` on failure
    - Existing gate-body logic (appendReviewEvidence, ROUTE-03 logCodexRoute, LEDGER-02 appendReviewRow) unchanged
    - `gates.shouldFire(...)` evaluated ONCE per site (single-call refactor per Q2/Q11 lock); both arms reference the hoisted `*Fired` constant
    - No new module-level imports; uses same inline `require(path.join(...))` pattern as ROUTE-03/LEDGER-02
    - Each wire-in cites `36=B` + `36-RESEARCH.md sec 2` in a leading comment
    - `grep -c 'logGateValue\s*(' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns >= 6 (we ship more than the GVAL-02 minimum of 3)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task T1.A3: Local fallback test exercising 4 outcome fixtures</name>
  <files>super-gsd/scripts/lib/gate-value-log.test.cjs</files>
  <behavior>
    - Test imports `logGateValue` and `outcomeFromVerdict` from production
      lib at `super-gsd/scripts/lib/gate-value-log.cjs` (NOT a mock)
    - Test fixture 1 (phase-level-ATC SKIP): `logGateValue({gate:'phase-level-ATC', outcome:'skip', phase:'36', milestone:'v1.8'})` produces row with `outcome:'skip'`, `status:'skipped'`, `reason_codes` includes `'gate_skip_with_reason'`, `evidence:[]`
    - Test fixture 2 (phase-level-ATC FIRE pass): `outcomeFromVerdict('pass') === 'pass'` -> row with `outcome:'pass'`, `status:'ok'`, `reason_codes` includes `'review_unanimous_pass'`
    - Test fixture 3 (per-dispatch-ATC FIRE block): `outcomeFromVerdict('critical', 3) === 'block'` -> row with `outcome:'block'`, `status:'fail'`, `reason_codes` includes `'atc_critical'`, `evidence:[{kind:'review_report', ref:<path>}]`
    - Test fixture 4 (MUDA-waste-audit FIRE warn from exit 1): outcome='warn' -> row with `outcome:'warn'`, `status:'warn'`, `reason_codes` includes `'atc_warn_only'`
    - All 4 fixtures share a single tmpdir; final `readGateValueRows(tmpdir)` returns exactly 4 rows in append order
    - Each row passes the same envelope-v1 13-field presence check as the production self-test
    - tmpdir cleanup in `finally`; canonical `.planning/metrics/gate-value-log.jsonl` untouched (fingerprint guard parity with self-test)
    - Exit 0 on all-pass, exit 1 on any failure
  </behavior>
  <action>
**Create `super-gsd/scripts/lib/gate-value-log.test.cjs` (~80 LOC).**

This is the LOCAL FALLBACK (Patch 4) referenced in 36-RESEARCH.md sec 8.
LIVE = the next gate-fire in any subsequent phase writes a row through
the wire-ins added in T1.A2. LOCAL = this test exercises the SAME
exported helper `logGateValue` against 4 fixtures, in a tmpdir, with
provider responses faked at the I/O boundary only (no mock predicates).

**Header (lines 1-25)**:
```javascript
// ============================================================================
// SGSD - gate-value-log local fallback test (Phase 36 Patch 4)
// ============================================================================
// LIVE proof: subsequent phase-level-ATC / per-dispatch-ATC / MUDA-waste-audit
//   gate fires append rows via the SKILL.md wire-ins (T1.A2).
// LOCAL proof (this file): 4 outcome fixtures (pass/warn/block/skip) calling
//   the SAME exported logGateValue helper that SKILL.md calls.
//
// No mocks: imports from production lib at gate-value-log.cjs.
// tmpdir-isolated; canonical .planning/metrics/gate-value-log.jsonl untouched.
//
// Mirrors the local-fallback pattern of any prior Phase 32+34 verifier
// (no separate mocha/jest dep -- plain assert + run-as-script).
// ============================================================================

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const {
  logGateValue,
  readGateValueRows,
  outcomeFromVerdict,
  ledgerPath,
} = require('./gate-value-log.cjs');
```

**Test runner (lines 26-30)** -- minimal assert helper:
```javascript
let pass = 0, fail = 0;
const failures = [];
function assert(name, cond, detail) {
  if (cond) { pass++; }
  else      { fail++; failures.push({ name, detail: detail || '' }); }
}
```

**Fingerprint guard setup (lines 31-40)**:
```javascript
const realLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'gate-value-log.jsonl');
const realExistedBefore = fs.existsSync(realLedger);
const realMtimeBefore   = realExistedBefore ? fs.statSync(realLedger).mtimeMs : 0;
const realSizeBefore    = realExistedBefore ? fs.statSync(realLedger).size : 0;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-test-'));
```

**Fixture block (lines 41-110)**:
```javascript
try {
  // Fixture 1: phase-level-ATC SKIP arm.
  const f1 = logGateValue(tmp, {
    gate:        'phase-level-ATC',
    outcome:     'skip',
    phase:       '36',
    milestone:   'v1.8',
    retroactive: { step: '6.5', category: 'code-quality', enforcement_mode: 'hard-halt', version: '2.1' },
  });
  assert('F1 phase-level-ATC skip',
    f1 && f1.outcome === 'skip' && f1.status === 'skipped' &&
    f1.gate === 'phase-level-ATC' &&
    Array.isArray(f1.reason_codes) && f1.reason_codes.includes('gate_skip_with_reason') &&
    Array.isArray(f1.evidence) && f1.evidence.length === 0 &&
    f1.envelope_version === 1 && f1.command === 'logGateValue');

  // Fixture 2: phase-level-ATC FIRE arm with verdict=pass.
  const v2 = outcomeFromVerdict('pass');
  const f2 = logGateValue(tmp, {
    gate:        'phase-level-ATC',
    outcome:     v2,
    phase:       '36',
    milestone:   'v1.8',
    retroactive: { step: '6.5', category: 'code-quality', enforcement_mode: 'hard-halt', version: '2.1' },
  });
  assert('F2 phase-level-ATC pass',
    v2 === 'pass' && f2 && f2.outcome === 'pass' && f2.status === 'ok' &&
    f2.reason_codes.includes('review_unanimous_pass'));

  // Fixture 3: per-dispatch-ATC FIRE arm with verdict=critical, criticalCount=3.
  const v3 = outcomeFromVerdict('critical', 3);
  const f3 = logGateValue(tmp, {
    gate:        'per-dispatch-ATC',
    outcome:     v3,
    phase:       '36',
    milestone:   'v1.8',
    evidence:    [{ kind: 'review_report', ref: '/tmp/per-dispatch-atc-fixture.md' }],
    retroactive: { step: '9.5', category: 'code-quality', enforcement_mode: 'hard-halt', version: '2.0' },
  });
  assert('F3 per-dispatch-ATC block',
    v3 === 'block' && f3 && f3.outcome === 'block' && f3.status === 'fail' &&
    f3.reason_codes.includes('atc_critical') &&
    f3.evidence.length === 1 && f3.evidence[0].kind === 'review_report');

  // Fixture 4: MUDA-waste-audit FIRE arm with shell exit 1 -> warn.
  const f4 = logGateValue(tmp, {
    gate:        'MUDA-waste-audit',
    outcome:     'warn',
    phase:       '36',
    milestone:   'v1.8',
    retroactive: { step: '6.55', category: 'process-hygiene', enforcement_mode: 'soft-warn', version: '2.0' },
  });
  assert('F4 MUDA-waste-audit warn',
    f4 && f4.outcome === 'warn' && f4.status === 'warn' &&
    f4.gate === 'MUDA-waste-audit' &&
    f4.reason_codes.includes('atc_warn_only'));

  // Read-back: 4 rows, append order, all envelope-shaped.
  const rows = readGateValueRows(tmp);
  assert('R rows length 4', rows.length === 4);
  assert('R row 0 = F1', rows[0].gate === 'phase-level-ATC' && rows[0].outcome === 'skip');
  assert('R row 1 = F2', rows[1].gate === 'phase-level-ATC' && rows[1].outcome === 'pass');
  assert('R row 2 = F3', rows[2].gate === 'per-dispatch-ATC' && rows[2].outcome === 'block');
  assert('R row 3 = F4', rows[3].gate === 'MUDA-waste-audit' && rows[3].outcome === 'warn');

  // Envelope-v1 13-field presence on each row.
  const required = ['envelope_version','ts','command','status','reason_codes',
    'artifacts','evidence','next_action','risk','duration_ms','run_id','phase','milestone'];
  let envelopeOk = true;
  for (const r of rows) {
    for (const k of required) {
      if (!(k in r)) { envelopeOk = false; break; }
    }
    if (!envelopeOk) break;
  }
  assert('E envelope-v1 13 required fields present on every row', envelopeOk);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
```

**Fingerprint guard verification (lines 111-120)**:
```javascript
const realExistedAfter = fs.existsSync(realLedger);
const realMtimeAfter   = realExistedAfter ? fs.statSync(realLedger).mtimeMs : 0;
const realSizeAfter    = realExistedAfter ? fs.statSync(realLedger).size : 0;
assert('G canonical ledger untouched by local-fallback test',
  realExistedBefore === realExistedAfter &&
  realMtimeBefore === realMtimeAfter &&
  realSizeBefore === realSizeAfter);
```

**Reporter + exit (lines 121-130)**:
```javascript
console.log('gate-value-log local-fallback: ' + pass + ' pass, ' + fail + ' fail');
if (fail > 0) {
  for (const f of failures) console.error('  FAIL: ' + f.name + (f.detail ? ' -- ' + f.detail : ''));
  process.exit(1);
}
process.exit(0);
```

**Constraints**:
- ASCII-only; LF line endings
- No new dependencies (no mocha/jest/chai/etc.)
- Imports `./gate-value-log.cjs` directly -- ANY drift in the production
  lib's exports breaks this test, which is the point
- tmpdir cleanup in `finally` block
- Fingerprint guard MUST anchor to `__dirname` (parity with self-test)
- File ~80 LOC (4 fixtures + read-back + envelope check + fingerprint = compact)
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/gate-value-log.test.cjs</automated>
  </verify>
  <done>
    - File exists at `super-gsd/scripts/lib/gate-value-log.test.cjs`
    - `node super-gsd/scripts/lib/gate-value-log.test.cjs` exits 0
    - Reports `4 pass, 0 fail` on the F1-F4 fixtures plus the R/E/G assertions (>= 8 assertions total)
    - Imports from production lib via `require('./gate-value-log.cjs')` (NOT mocked)
    - Canonical `.planning/metrics/gate-value-log.jsonl` byte-identical (existed-before == existed-after, mtime, size) after test
    - File is ~80 LOC; no new deps in package.json
  </done>
</task>

</tasks>

<known_dead_ends>

The following are explicitly OUT OF SCOPE for Phase 36. Do NOT touch
them; if a sub-task pulls toward them, stop and surface.

1. **Do NOT modify `super-gsd/registry/command-envelope-v1.yaml` or
   `super-gsd/templates/command-envelope-v1.json`.** Phase 31 contract
   is locked. envelope-v1 is `additionalProperties: true` -- the new
   `gate`, `outcome`, `retroactive` extension fields ride along without
   any schema bump. Adding them to the registry's first-wave emitter
   list is a future-phase concern (cosmetic; no functional change).

2. **Do NOT modify the 4 existing envelope-v1 emitter contracts**:
   route-ledger.cjs (Phase 32), review-ledger.cjs (Phase 34),
   repair-command-checker.cjs (Phase 33), and any others. They are
   architectural templates; mirror them, don't refactor them.

3. **Do NOT introduce new dependencies.** Node built-ins only (`fs`,
   `path`, `os`, `crypto`). No `js-yaml` for gate-value-log.cjs because
   the lib never reads `gates.yaml` directly -- the caller passes
   `gates.getGate(name)` result through the `retroactive` arg (Q6 lock).

4. **Do NOT add cost / time / $$$ fields to row.** Locked 36=B "no cost"
   (mass-discuss line 211; CONTEXT.md). `duration_ms` is a standard
   envelope-v1 field carried verbatim from the wrapper -- this is NOT
   the same as cost telemetry. Cost is v2.0+ ops, not v1.8 fitness.

5. **Do NOT change the LEDGER-02 dedup tuple in review-ledger.cjs.**
   Phase 34 ATC W3 lesson: tier was REMOVED from dedup so the same
   review event captured at tier='per-dispatch' (real-time) and
   tier='full' (per-phase) deduplicates to one row. gate-value-log has
   no such constraint (it logs every gate-fire decision, never
   deduplicates), so DO NOT introduce dedup here.

6. **Do NOT auto-disable any gate based on `value_score`.** Phase 39
   rubric owns the kill recommendation. Phase 36 only emits the score.

7. **Do NOT add cross-milestone aggregation to `--summary`.** Phase 39
   rubric folds across milestones; Phase 36 `--summary` aggregates rows
   per the milestone filter passed in (or all rows when no filter).

8. **Do NOT wire into the 10 process-hygiene + verify-completeness
   gates that don't emit review evidence.** They have no
   `{pass, warn, block}` verdict mappable to outcome (REQUIREMENTS.md
   note + RESEARCH sec deferred). Wire only the 3 verdict-bearing
   gates: phase-level-ATC, per-dispatch-ATC, MUDA-waste-audit.

9. **Do NOT add a rendered .md view.** Mirror Phase 32 + Phase 34
   deferral (Q13 lock). The .jsonl is the source of truth; cockpit
   surfacing is Phase 38+ scope.

10. **Do NOT close the gate enum.** Q6 lock: gate-name validation =
    "non-empty string" only. Reading gates.yaml at `_normalize` time
    would invert the load order (gates-registry calls
    repair-command-checker; adding a writer dep would create a cycle).

</known_dead_ends>

<verification>

**Phase 36 acceptance gate (per ROADMAP-AGENT.md:380-394 + 36-CONTEXT.md
Acceptance section). All four GVAL-* requirements must pass with the
exact runnable commands below.**

```bash
# GVAL-01: writer module with --self-test
node super-gsd/scripts/lib/gate-value-log.cjs --self-test
# Expect: exit 0; "gate-value-log self-test: N pass, 0 fail" with N >= 12

# GVAL-02: wired into orchestrator (>= 1 production caller; we ship 6)
c=$(grep -c 'logGateValue\s*(' super-gsd/skills/sgsd-orchestrate/SKILL.md)
[ "$c" -ge 3 ] && echo "PASS GVAL-02 ($c sites)" || (echo "FAIL GVAL-02 (got $c, need >=3)" && exit 1)

# GVAL-03: each row carries gate, outcome, phase, milestone, ts, run_id, retroactive
# (covered by self-test assertion #5 + local fallback test envelope check)
node super-gsd/scripts/lib/gate-value-log.test.cjs
# Expect: exit 0; "gate-value-log local-fallback: N pass, 0 fail" with N >= 8

# GVAL-04: --summary aggregates by gate
node super-gsd/scripts/lib/gate-value-log.cjs --summary
# Expect: exit 0; valid JSON array on stdout (may be [] on cold start)

# GVAL-04 with seeded data: --summary --milestone v1.8 returns the same shape
# documented in 36-RESEARCH.md sec 4 -- one row per gate with
# {gate, fires, pass, warn, block, skip, total_observations, fire_rate, value_score}
```

**Manual sanity checks** (Step 6.5 phase-level-ATC reviewers should run
these, not just trust the automated commands):

1. Inspect `super-gsd/scripts/lib/gate-value-log.cjs` -- confirm:
   - Header cites 36-RESEARCH.md sec 10 + sec 11
   - `OUTCOMES` is `Object.freeze(['pass','warn','block','skip'])`
   - `RUN_ID_REGEX` matches route-ledger.cjs:88-89 verbatim
   - All 5 public APIs exported (logGateValue, readGateValueRows,
     summarize, ledgerPath, outcomeFromVerdict)
   - All 5 frozen constants exported (OUTCOMES, STATUSES,
     VERDICT_OUTCOME_MAP, COMMAND_NAME, ENVELOPE_VERSION)
   - `_normalize` ignores caller-provided `status` (Q5 lock)
   - Self-test fingerprint guard anchored to `__dirname`
   - Every public helper wraps in try/catch and returns falsey on error

2. Inspect `super-gsd/skills/sgsd-orchestrate/SKILL.md` -- confirm:
   - 3 sites refactored to single-call `gates.shouldFire(...)` (hoisted
     to `*Fired` const) -- not 6 evaluations
   - 6 total `logGateValue(...)` calls (3 SKIP + 3 FIRE)
   - Every call wrapped in try/catch with `console.warn` on failure
   - Existing `appendReviewEvidence`, `logCodexRoute`, `appendReviewRow`
     calls UNCHANGED
   - Each wire-in cites `36=B` and `36-RESEARCH.md sec 2`

3. Inspect `super-gsd/scripts/lib/gate-value-log.test.cjs` -- confirm:
   - Imports from `./gate-value-log.cjs` (NOT mocked)
   - 4 fixtures cover all 4 OUTCOMES (pass/warn/block/skip)
   - tmpdir cleanup in `finally`
   - Fingerprint guard parity with self-test

4. Run dry-run of `--summary` after seeding the canonical ledger via
   manual `logGateValue` calls; verify the output JSON matches the
   schema in 36-RESEARCH.md sec 4 (one row per gate, sorted by `fires` DESC,
   `value_score` formula `max(0, (pass + 0.5*warn - block) / fires)`).

</verification>

<live_or_local_fallback>

**Patch 4 contract (36-RESEARCH.md sec 8): live-or-local fallback.**

- **LIVE**: the next phase that hits Step 6.5 / 9.5 / 6.55 with
  `gates.shouldFire(...)` true will append a row to
  `.planning/metrics/gate-value-log.jsonl` via the wire-ins added in
  T1.A2. This is the production proof. It cannot be guaranteed at the
  moment Phase 36 ships (the very first phase-fire of v1.8 might not
  have happened yet), so the fallback covers GVAL-02 unconditionally.

- **LOCAL**: `super-gsd/scripts/lib/gate-value-log.test.cjs` (T1.A3)
  exercises the SAME exported `logGateValue` helper that SKILL.md calls,
  through the same code path, against 4 fixtures. No mock predicates;
  the test must call `logGateValue(planningDir, ...)` exactly the way
  the orchestrator does. If the LIVE row appears before milestone close,
  the LOCAL test stays in place as ongoing regression coverage.

- **provider-unavailable handling**: if a downstream live wire-in fails
  (orchestrator path partially broken, network down, etc.), the
  try/catch wrappers swallow the error, `console.warn` to stderr, and
  the orchestrator continues. The local fallback test is the only proof
  Phase 36 needs at ship time.

</live_or_local_fallback>

<schema_without_consumer_rule>

**Rule (per ROADMAP-AGENT.md): no schema is shipped without consumers.**

Phase 36 satisfies the rule with 4 in-phase consumers:

1. **3 SKILL.md wire-ins** (T1.A2): each gate-fire decision invokes
   `logGateValue` and is the writer's first consumer (writer is its own
   first consumer; the live-or-local fallback ensures at least one
   read-back path exists at ship time).

2. **`--summary` CLI** (T1.A1): operator-facing read consumer. Runs on
   demand; emits per-gate aggregation.

3. **Phase 38 sampling-decider** (future, NOT in this PLAN): will read
   `gate_fitness_history` via `summarize()` for risk-tier intersection.
   Documented in 36-RESEARCH.md sec 9.

4. **Phase 39 rubric** (future, NOT in this PLAN): will read
   `summarize()` per-gate `value_score` to classify keep/kill/defer
   with defer-on-empty for cold start.

Phases 38 + 39 consumers are documented but not shipped here -- the
rule requires that they be planned, not that they be live in the same
phase. The LIVE wire-ins + LOCAL test give us 4 explicit consumers in
this phase alone. Comparable to Phase 32 (1 wire) and Phase 34 (1 wire);
Phase 36 ships 3 wires + 1 test for redundancy.

</schema_without_consumer_rule>

<constraints>

**Hard constraints, all locked in 36-RESEARCH.md sec 10 (Q1-Q15)**:

- ASCII-only output and source. No smart quotes (curly apostrophes,
  curly double-quotes), no em dashes (`---`); use `--` (two ASCII
  hyphens) when a dash is required inside prose.
- LF line endings. No CRLF. New files MUST be utf-8 + LF.
- No new dependencies. Node built-ins (`fs`, `path`, `os`, `crypto`)
  + already-vendored modules only.
- Mirror `route-ledger.cjs` and `review-ledger.cjs` 1:1: vendored
  `js-yaml` is NOT needed because gate-value-log doesn't read yaml;
  `__dirname` anchor for fingerprint guard; never-throws-upward public
  API; tmpdir-isolated self-test.
- `RUN_ID_REGEX` literal MUST match route-ledger.cjs:88-89 +
  review-ledger.cjs:84-85 verbatim (Q10 lock).
- Frozen consts: `OUTCOMES`, `STATUSES`, `VERDICT_OUTCOME_MAP`,
  `OUTCOME_STATUS_MAP`, `OUTCOME_REASON_CODES`. Use `Object.freeze`.
- `OUTCOMES` enum is closed at `['pass','warn','block','skip']`. No new
  outcomes without updating the rubric in Phase 39.
- `value_score = max(0, (pass + 0.5*warn - block) / fires)` when
  `fires > 0`, else `null`. Defer-on-empty floor at 0 is mandatory.
- Public API never throws upward. Every `logGateValue`,
  `readGateValueRows`, `summarize`, `ledgerPath`, `outcomeFromVerdict`
  wraps in try/catch and returns falsey on error.
- Self-test 12+ assertions; tmpdir cleanup in `finally`; fingerprint
  guard for canonical ledger (existed-before/after, mtime, size).
- 100-call uniqueness assertion REQUIRED (Q11 lock).
- 3 SKILL.md wire-in sites; both SKIP + FIRE arms; try/catch wrapped;
  `gates.shouldFire(...)` hoisted to a single call per site (Q11 lock).
- No modifications to existing envelope-v1 emitters or to
  command-envelope-v1.yaml/json.

</constraints>

<commit_plan>

**3 atomic commits, in order. NEVER batch. NEVER amend. NEVER skip
hooks.**

```bash
# Commit 1: Lib + self-test (T1.A1)
git add super-gsd/scripts/lib/gate-value-log.cjs
git commit -m "feat(36-01): gate-value-log.cjs lib + 12-assertion self-test"

# Commit 2: SKILL.md wire-ins (T1.A2)
git add super-gsd/skills/sgsd-orchestrate/SKILL.md
git commit -m "feat(36-01): wire logGateValue into 3 SKILL.md gate-fire decision points"

# Commit 3: Local fallback test (T1.A3)
git add super-gsd/scripts/lib/gate-value-log.test.cjs
git commit -m "test(36-01): deterministic local fallback for gate-value-log (4 fixtures)"
```

Stage by file name, not `git add -A` or `git add .`. Three commits in
strict order: C1 (lib) BEFORE C2 (wires that require C1) BEFORE C3
(test that exercises C1 + C2's exported API). Splitting C3 from C1
would defer GVAL-02's local-fallback evidence; keeping all 3 in one
plan is the precedent set by Phase 32 + Phase 34 (sec 11).

</commit_plan>

<success_criteria>

Phase 36 ships when ALL of the following are true:

- [ ] `super-gsd/scripts/lib/gate-value-log.cjs` exists, ~350 LOC,
      header cites 36-RESEARCH.md sec 10 + sec 11
- [ ] `node super-gsd/scripts/lib/gate-value-log.cjs --self-test`
      exits 0 with 12+ pass / 0 fail
- [ ] `super-gsd/skills/sgsd-orchestrate/SKILL.md` has 6 occurrences of
      `logGateValue(...)` (3 SKIP + 3 FIRE) -- well above the GVAL-02
      `>=3` requirement
- [ ] `super-gsd/scripts/lib/gate-value-log.test.cjs` exists, ~80 LOC,
      `node super-gsd/scripts/lib/gate-value-log.test.cjs` exits 0
- [ ] `node super-gsd/scripts/lib/gate-value-log.cjs --summary` exits 0
      and emits valid JSON (`[]` on cold start is valid)
- [ ] Canonical `.planning/metrics/gate-value-log.jsonl` (if it exists
      pre-self-test) byte-identical (mtime + size) after running both
      self-test and local-fallback test -- proves __dirname-anchored
      fingerprint guard
- [ ] `module.exports` of gate-value-log.cjs lists exactly: 5 public
      APIs (logGateValue, readGateValueRows, summarize, ledgerPath,
      outcomeFromVerdict) and 5 frozen consts (OUTCOMES, STATUSES,
      VERDICT_OUTCOME_MAP, COMMAND_NAME, ENVELOPE_VERSION)
- [ ] All public helpers in gate-value-log.cjs are wrapped in try/catch
      and return falsey on error (mirrors route-ledger.cjs:42-51 +
      review-ledger.cjs:50-51)
- [ ] All 6 SKILL.md wire-in calls wrapped in try/catch with
      `console.warn` on failure
- [ ] No new entries in `package.json` dependencies / devDependencies
- [ ] 3 commits land in order with the exact messages specified in
      `<commit_plan>`
- [ ] Phase-level-ATC at close passes (dual-provider review surfaces
      0-7 distinct findings per v1.7 precedent; all in-loop fixable in
      a single attempt)

If any item above is FALSE, the phase has NOT shipped -- continue
in-loop fixes until every box is checked.

</success_criteria>

<output>
After completion, create
`.planning/milestones/v1.8/phases/36-gate-value-telemetry/36-01-SUMMARY.md`
covering:
- 3 commits + their SHAs
- Files touched (created vs modified)
- Self-test pass/fail count
- `grep -c 'logGateValue\s*('` count
- Local fallback pass/fail count
- `--summary` JSON sample (post-seed)
- Any deviations from this PLAN
- One-liner: "Phase 36 ships gate-value-log.cjs + 3 SKILL.md wire-ins +
  4-fixture local fallback. Telemetry primitive online; defers value
  judgment to Phase 39 rubric."
</output>
