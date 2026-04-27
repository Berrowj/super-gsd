---
phase: 36
name: Gate Value Telemetry
milestone: v1.8
status: research_complete
researched: 2026-04-27
confidence: HIGH
controlling_principle: "Autonomy continues; evidence tells the truth."
locked_decisions: [36=B]
---

# Phase 36: Gate Value Telemetry - Research

## Summary

Phase 36 lands `super-gsd/scripts/lib/gate-value-log.cjs` -- envelope-v1
shaped append-only writer + summarizer for `.planning/metrics/gate-value-log.jsonl`
-- and wires it into 3 orchestrator gate-fire decision points. Architecture
mirrors `super-gsd/scripts/lib/route-ledger.cjs` (Phase 32) and
`super-gsd/scripts/lib/review-ledger.cjs` (Phase 34) 1:1: `__dirname`-anchored
fingerprint guard, public API never throws upward, frozen STATUSES + new
frozen OUTCOMES enum.

Locked design (mass-discuss line 211, `36=B`): outcome + retroactive fields,
**no cost telemetry** -- Phase 38 sampling-decider reads
`gate_fitness_history` from this log; Phase 39 keep/kill rubric reads
fire/pass/block counts; cost is v2.0+ ops, not v1.8 fitness.

Key insight: gate-value rows are gate-FITNESS data
(`{gate, fired_or_skipped, outcome_when_fired}`); review-ledger rows are
gate-OUTPUT data. Orthogonal ledgers (REQUIREMENTS.md:94 explicit). The
wire-in is therefore structurally distinct from Phase 34: Phase 34 fires on
the convergence point AFTER both reviewer paths finish; Phase 36 fires at the
GATE-FIRE DECISION (`gates.shouldFire(...)` branch entry) capturing skip vs
fire BEFORE any reviewer runs, and again capturing outcome AFTER fire completes.

**Primary recommendation:** Single plan, ~440-line lib + 3 SKILL.md
wire-ins (one per gate that emits review evidence: phase-level-ATC at 6.5,
per-dispatch-ATC at 9.5, MUDA-waste-audit at 6.55) + 14-assertion self-test
+ local-fallback test. Schema-without-consumer rule satisfied by 4 explicit
consumers (Section 5). 2 created, 1 edited. Net ~+580 / -3.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|-----------|--------------|-----------|
| Append envelope-v1 row (gate fire/skip + outcome) | scripts/lib (cjs) | Atomic writer mirroring route/review ledger |
| Defensive read with optional filters | scripts/lib (cjs) | `readGateValueRows({gate?, milestone?})` |
| `--summary` aggregator | scripts/lib (cjs) | Phase 38/39 require() one entry point |
| Wire phase-level-ATC | SKILL.md:591 + 760 | shouldFire branch + post-verdict |
| Wire per-dispatch-ATC | SKILL.md:1126 + 1284 | shouldFire branch + post-verdict |
| Wire MUDA-waste-audit | SKILL.md:799 + 818-823 | shouldFire branch + post-exit |
| Phase 38 read (`gate_fitness_history`) | sampling-decider.cjs | Consumer; 36 ships read API only |
| Phase 39 read (mechanical rubric) | rubric.cjs | Consumer; defer-on-empty owned by 39 |

## User Constraints (from ROADMAP-AGENT.md + mass-discuss)

### Locked Decisions

- **36=B**: outcome + retroactive fields, no cost telemetry (mass-discuss line 211).
- Wire into orchestrator phase-level-ATC + per-dispatch-ATC fires (>=1
  production caller; this plan ships 3 wire-ins to satisfy schema-without-consumer).
- Outcome enum closed at `{pass, warn, block, skip}` (REQUIREMENTS.md:23 GVAL-03).
- Retroactive fields = gates.yaml row metadata at fire time
  (`enforcement_mode`, `category`, `step`, `version`).
- `--summary` aggregates by gate (REQUIREMENTS.md:24 GVAL-04).
- Public API never throws upward (route-ledger.cjs:42-51; review-ledger.cjs:50-51).
- Live-or-local fallback (Patch 4).
- ASCII-only outputs (PS 5.1 mojibake guard).

### Claude's Discretion

- `value_score` formula (locked Section 4 to
  `max(0, (pass + 0.5*warn - block) / fires)`).
- Wire-in count within "phase-level-ATC + per-dispatch-ATC fires"
  (locked to 3 sites; adds MUDA-waste-audit because Phase 39 rubric judges it).
- Append strategy: same `appendFileSync` pattern as route/review ledger.

### Deferred Ideas (OUT OF SCOPE)

- Cost telemetry (v2.0+ per 36=B).
- Rendered .md view (mirrors Phase 32+34 deferrals).
- Auto-disable on low value_score (Phase 39 owns kill recommendation).
- Cross-milestone aggregation in `--summary` (Phase 39 rubric folds).
- Wiring the 10 process-hygiene + verify-completeness gates that DO NOT
  emit review evidence (no verdict mappable to `{pass, warn, block}`).

## Phase Requirements

| ID | Description | Section |
|----|-------------|---------|
| GVAL-01 | Writer module with `--self-test` | 6, 7 |
| GVAL-02 | Wired into phase-level-ATC + per-dispatch-ATC fires (>=1 caller) | 2 |
| GVAL-03 | Each row: gate, outcome, phase, milestone, ts, run_id, retroactive | 1, 7 |
| GVAL-04 | `--summary` aggregates by gate | 4 |

---

## 1. Row Shape Decision

**Decision: envelope-v1 wrapped, mirroring route-ledger and review-ledger.**

Why envelope:

1. Phase 31 envelope-v1 lists 7 first-wave emitters
   (`super-gsd/registry/command-envelope-v1.yaml:22-78`). gate-value-log is
   candidate emitter #8 -- no schema bump because envelope-v1 is
   `additionalProperties: true` (`super-gsd/templates/command-envelope-v1.json:8`).
2. Phase 32 added 6th boundary (`codex_route`); Phase 34 added 7th wrapped
   emitter (`atc-review` -> `appendReviewRow`). Phase 36 adds the 8th
   (`logGateValue`). Consistent precedent.
3. Phase 38 sampling-decider reads `gate_fitness_history`. Envelope shape
   means it consumes the SAME shape as review-ledger; cross-stream parser
   is one helper.
4. Phase 39 rubric (RUBRIC-01) reads review-ledger + gate-value-log +
   edge-guard-log. All three envelope-shaped means one
   `_groupByCommand({gate, milestone})` works across them.
5. Mission Strip read contract (`command-envelope-v1.yaml:229-253`)
   already maps envelope status -> pane_state. Surfacing gate-value rows
   in the cockpit (Phase 38+) costs zero new read code.

Schema per row (envelope-v1 + 3 extension fields `gate`, `outcome`, `retroactive`):

```json
{
  "envelope_version": 1,
  "ts":               "2026-04-27T11:32:01.123Z",
  "command":          "logGateValue",
  "status":           "ok | warn | fail | skipped | timeout | blocked",
  "reason_codes":     ["..."],
  "artifacts":        [],
  "evidence":         [{"kind":"review_report","ref":"<path>"}],
  "next_action":      null,
  "risk":             null,
  "duration_ms":      null,
  "run_id":           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX",
  "phase":            "36",
  "milestone":        "v1.8",
  "gate":             "phase-level-ATC | per-dispatch-ATC | MUDA-waste-audit",
  "outcome":          "pass | warn | block | skip",
  "retroactive": {
    "enforcement_mode": "hard-halt | amortized | soft-warn | disabled",
    "category":         "code-quality | process-hygiene | verify-completeness",
    "step":             "9.5 | 6.5 | 6.55",
    "gate_version":     "2.0 | 2.1"
  }
}
```

`gate` and `outcome` at top level (not nested under `decision` like Phase 32):
Phase 39 does `groupBy(row.gate)` and Phase 38 does
`filter(r => r.gate===g && r.outcome==='pass')`. Top-level keys keep
consumer code one-liner.

## 2. Wire-In Inventory

3 production caller sites; the 3 gates that emit review evidence (and thus
have a `{pass, warn, block}` verdict mappable to outcome):

| # | Gate | Fire-decision line | Outcome-known line | Outcome source |
|---|------|--------------------|--------------------|----------------|
| 1 | `per-dispatch-ATC` | `SKILL.md:1126` | `SKILL.md:1276-1279` (`extractedVerdict`) | review verdict |
| 2 | `phase-level-ATC` | `SKILL.md:591` | `SKILL.md:768` (`{verdict}`) + `:779` (`critical_count`) | review verdict |
| 3 | `MUDA-waste-audit` | `SKILL.md:799` | `SKILL.md:818-823` (shell exit code) | exit 0/1/2 -> pass/warn/block |

**Wire pattern at each site** (mirrors review-ledger LEDGER-02 wire at SKILL.md:1269-1305):

```js
const fired = gates.shouldFire('<gate>', ctx, GATES_YAML_PATH);  // ONCE
if (!fired) {
  try {
    require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
      .logGateValue(path.join(process.cwd(), '.planning'), {
        gate: '<gate>',
        outcome: 'skip',
        phase: currentPhase,
        milestone: currentMilestone,
        retroactive: gates.getGate('<gate>', GATES_YAML_PATH),
      });
  } catch (e) { /* never throws upward */ }
}

if (fired) {
  // ... existing gate body unchanged ...

  try {
    require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
      .logGateValue(path.join(process.cwd(), '.planning'), {
        gate: '<gate>',
        outcome: outcomeFromVerdict(extractedVerdict, extractedCritical),
        phase: currentPhase,
        milestone: currentMilestone,
        evidence: reportPath ? [{ kind: 'review_report', ref: reportPath }] : [],
        retroactive: gates.getGate('<gate>', GATES_YAML_PATH),
      });
  } catch (e) { /* never throws upward */ }
}
```

`outcomeFromVerdict` is a pure helper exported from gate-value-log.cjs (Section 7).

**Why both arms:** SKIP rows are the data Phase 38 needs to compute sampling
decisions (a gate that skips 99% of phases via `low-risk-skip` tier isn't
earning fires). Phase 39 rubric needs both fire-rate (skip ratio) and
pass-rate (outcome ratio). Logging only fires loses the denominator.

**Single-call refactor** (LOCKED Section 10 Q11): hoist
`gates.shouldFire(...)` to a `const fired = ...` ONCE at each site, then
SKIP/FIRE arms both reference `fired`. Existing code re-evaluates
shouldFire inside the `if`; refactor saves a call and avoids double-evaluation.

## 3. Outcome Enum Mapping

Locked mapping (mirrors review-ledger LEGACY_VERDICT_MAP at `review-ledger.cjs:65-72`):

| Source signal | Outcome | Rationale |
|---------------|---------|-----------|
| `gates.shouldFire(...) === false` | `skip` | Gate intentionally not run; Phase 38 sampling needs |
| Review verdict `pass` | `pass` | review_unanimous_pass |
| Review verdict `warn` | `warn` | atc_warn_only |
| Review verdict `critical` | `block` | atc_critical (auto-degrade or halt; Phase 39 judges underlying gate) |
| Review verdict `critical-halt` | `block` | atc_critical |
| Review verdict `block` | `block` | atc_critical |
| Review verdict `skipped` | `skip` | gate_skip_with_reason -- different from shouldFire=false |
| Codex shell timeout | `block` | timeout that blocked loop is value-negative for the gate |
| MUDA shell exit 0 | `pass` | all probes passed |
| MUDA shell exit 1 | `warn` | WARN findings curated, continue |
| MUDA shell exit 2 | `block` | FAIL findings; phase not blocked but the fire is value-negative |

Helper:

```js
const VERDICT_OUTCOME_MAP = Object.freeze({
  'pass':'pass', 'warn':'warn', 'critical':'block',
  'critical-halt':'block', 'block':'block', 'skipped':'skip',
});

function outcomeFromVerdict(verdict, criticalCount) {
  if (typeof verdict === 'string'
      && Object.prototype.hasOwnProperty.call(VERDICT_OUTCOME_MAP, verdict)) {
    return VERDICT_OUTCOME_MAP[verdict];
  }
  if (typeof criticalCount === 'number' && criticalCount > 0) return 'block';
  if (typeof criticalCount === 'number' && criticalCount === 0) return 'pass';
  return 'warn'; // unknown -> warn (mirrors review-ledger Q9 lock)
}
```

`OUTCOMES = Object.freeze(['pass','warn','block','skip'])` -- closed enum;
`_normalize` throws on violation; public API wraps + returns false.

## 4. --summary Aggregator Design

Output shape (one row per gate, sorted by `fires` DESC):

```json
{
  "gate":               "phase-level-ATC",
  "fires":              23,
  "pass":               18,
  "warn":               3,
  "block":              2,
  "skip":               7,
  "total_observations": 30,
  "fire_rate":          0.7667,
  "value_score":        0.6957
}
```

Formulas:

- `fires = pass + warn + block` (skip is not a fire)
- `total_observations = fires + skip`
- `fire_rate = fires / total_observations` -- Phase 38 input
- `value_score = max(0, (pass + 0.5*warn - block) / fires)` when `fires > 0`,
  else `null`

Why this `value_score`: a gate that fires 100 times producing 1/50/49
pass/warn/block is value-negative; a gate that fires 100 times producing
99/1/0 is high-fitness. The `block / fires` subtraction penalizes
chronic-block gates. Floor at 0 prevents misleading negative scores.

Defer-on-empty: when `fires === 0` (only skip rows), emit `value_score: null`.
Phase 39 rubric (RUBRIC-03) pattern-matches `null` -> defer.

CLI:

```
node super-gsd/scripts/lib/gate-value-log.cjs --summary
node super-gsd/scripts/lib/gate-value-log.cjs --summary --milestone v1.8
node super-gsd/scripts/lib/gate-value-log.cjs --summary --gate phase-level-ATC
```

JSON array on stdout, exit 0 on success / 1 on read-error. Mirrors
`review-ledger.cjs --aggregate` CLI shape.

```js
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
      if (out === 'pass')  { acc.fires++; acc.pass++; }
      else if (out === 'warn')  { acc.fires++; acc.warn++; }
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

## 5. Schema-Without-Consumer Rule Satisfaction

4 production consumers documented:

| # | Consumer | When | What it reads |
|---|----------|------|---------------|
| 1 | Wire-in itself (3 sites in SKILL.md) | Every gate-fire decision (live) | Writes (own first consumer; live-or-local) |
| 2 | `--summary` CLI | Operator + dashboards | All rows; groupBy gate |
| 3 | Phase 39 rubric (`tools/gate-keep-kill/rubric.cjs`, RUBRIC-01) | Milestone close | All rows; defer-on-empty when `fires=0` |
| 4 | Phase 38 sampling-decider (`scripts/lib/sampling-decider.cjs`, SAMPLE-02) | Every gate-fire next milestone | Read-only; bias <=50% per primary signal |

Phase 32 satisfied the rule with 1 wire (codex_route at Step 9.5). Phase 36
satisfies it with 3 wires + 3 documented downstream consumers.

Cold-start handling: all consumers must be defer-on-empty (Phase 39's
RUBRIC-03 makes this explicit). Lib returns `[]` from `readGateValueRows`
on missing file (mirrors `route-ledger.cjs:188-189`). Phase 38 sampling
with empty history weights primary signals at 100% (secondary is bounded
to <=50% per locked 38.2; empty-history degrades gracefully).

## 6. --self-test Scaffold (14 assertions + fingerprint guard)

Mirrors `route-ledger.cjs selfTest()` (12 assertions) + `review-ledger.cjs
selfTest()` (15 assertions). Phase 36 lands 14 assertions + fingerprint
guard (the 2 extras cover OUTCOMES enum + value_score formula).

Setup (mirrors `route-ledger.cjs:296-305`):

```js
const realLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'gate-value-log.jsonl');
const realExistedBefore = fs.existsSync(realLedger);
const realMtimeBefore = realExistedBefore ? fs.statSync(realLedger).mtimeMs : 0;
const realSizeBefore  = realExistedBefore ? fs.statSync(realLedger).size : 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-'));
```

Anchor to `__dirname` not `process.cwd()` -- Phase 32 W3 lesson, locked.

Assertions:

1. `OUTCOMES` is frozen `['pass','warn','block','skip']`.
2. `STATUSES` re-exports envelope-v1 6-state.
3. `VERDICT_OUTCOME_MAP` frozen with 6 keys.
4. Empty read on fresh tmpdir returns `[]`.
5. Single `logGateValue(tmp, {...})` produces one envelope-shaped row with
   `command='logGateValue'`, `gate`, `outcome`, `retroactive` populated,
   `RUN_ID_REGEX`-compliant `run_id`, `envelope_version: 1`.
6. Invalid `outcome` (e.g. `'banana'`) -> `false` + stderr; never throws.
7. Invalid `gate` (empty/non-string) -> `false` + stderr; never throws.
8. Missing `gate` field -> `false` + stderr.
9. Append-only: 3 sequential `logGateValue` calls -> 3 rows.
10. Defensive parse: `'{not-json\n'` mid-file; subsequent valid append +
    `readGateValueRows` returns 4 valid rows (malformed line skipped).
11. `outcomeFromVerdict` mapping covers all 6 verdicts + numeric fallback
    (criticalCount > 0 -> block; ===0 -> pass; unknown -> warn).
12. `summarize(tmp)` over `{3 pass + 1 warn + 1 block + 2 skip}` for `g1`
    returns `{fires:5, pass:3, warn:1, block:2, skip:2,
    total_observations:7, fire_rate: 5/7, value_score: max(0,(3+0.5-2)/5)=0.3}`.
13. `summarize(tmp, {milestone:'v1.7'})` filter excludes v1.8 rows.
14. 100 rapid `generateRunId()` -> 100 unique values.

Bonus: canonical `.planning/metrics/gate-value-log.jsonl` unchanged
(existed-before/after, mtime, size).

## 7. Public API Design

Exported from `super-gsd/scripts/lib/gate-value-log.cjs`:

```js
module.exports = {
  // Public APIs (4):
  logGateValue,         // (planningDir, args) -> envelope row | false
  readGateValueRows,    // (planningDir, opts?) -> envelope row[]
  summarize,            // (planningDir, opts?) -> {gate, fires, ...}[]
  ledgerPath,           // (planningDir) -> string

  // Helper (1):
  outcomeFromVerdict,   // (verdict, criticalCount) -> 'pass'|'warn'|'block'|'skip'

  // Frozen constants (5):
  OUTCOMES,             // ['pass','warn','block','skip']
  STATUSES,             // envelope-v1 6-state
  VERDICT_OUTCOME_MAP,  // verdict-string -> outcome
  COMMAND_NAME,         // 'logGateValue'
  ENVELOPE_VERSION,     // 1
};
```

Constants:

```js
const OUTCOMES            = Object.freeze(['pass','warn','block','skip']);
const STATUSES            = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
const VERDICT_OUTCOME_MAP = Object.freeze({
  'pass':'pass','warn':'warn','critical':'block',
  'critical-halt':'block','block':'block','skipped':'skip',
});
const COMMAND_NAME        = 'logGateValue';
const ENVELOPE_VERSION    = 1;
const LEDGER_REL          = path.join('metrics', 'gate-value-log.jsonl');
```

`logGateValue(planningDir, args)` -- atomic append, never throws upward;
returns enriched envelope row on success, `false` on validation/IO error.

```js
function logGateValue(planningDir, args) {
  try {
    return _appendRowInternal(planningDir, args || {});
  } catch (e) {
    console.warn('[SGSD] gate-value-log logGateValue failed:', e.message);
    return false;
  }
}
```

`_normalize(row)` derives:
- `status` from `outcome`: `pass->ok`, `warn->warn`, `block->fail`, `skip->skipped`.
- `reason_codes` from outcome:
  `pass->['review_unanimous_pass']`, `warn->['atc_warn_only']`,
  `block->['atc_critical']`, `skip->['gate_skip_with_reason']`.
  Reuses Phase 31 reason_codes vocabulary at `command-envelope-v1.yaml:133-150`.

`readGateValueRows(planningDir, opts?)` -- defensive read; supported
filters: `{gate?, milestone?, outcome?}`. Returns `[]` on missing file or
parse error. Mirrors `review-ledger.cjs:208-232`.

`summarize(planningDir, opts?)` -- see Section 4.

`ledgerPath(planningDir)` -- one-line helper; CLI + tests share path resolver.

`outcomeFromVerdict(verdict, criticalCount)` -- exported pure helper.

Failure contract (mirrors `route-ledger.cjs:42-51`): every public helper
wraps in try/catch; on error stderr-warns and returns falsey
(`false` for write paths, `[]` for read paths, `null` for non-existent
summary). Orchestrator continues regardless.

## 8. Live-or-Local Fallback Design (Patch 4)

**Live:** the next phase-level-ATC fire (or per-dispatch-ATC, or
MUDA-waste-audit) writes a row via the wire-in. This row is the production
proof.

**Local:** `super-gsd/scripts/lib/gate-value-log.test.cjs` (~80 lines)
exercises the SAME `logGateValue` exported helper that SKILL.md calls,
against fixtures, with provider responses faked at the I/O boundary only.
No mock predicates -- the test must call `logGateValue(planningDir, ...)`
exactly the way the orchestrator does.

Test fixture coverage (4 cases):

1. `phase-level-ATC` skip arm: synthetic shouldFire=false ->
   `logGateValue({gate:'phase-level-ATC', outcome:'skip', ...})` -> 1 row
   with `outcome:'skip'`, `status:'skipped'`,
   `reason_codes:['gate_skip_with_reason']`.
2. `phase-level-ATC` fire arm with verdict=pass:
   `outcomeFromVerdict('pass') -> 'pass'` -> row with `outcome:'pass'`,
   `status:'ok'`.
3. `per-dispatch-ATC` fire arm with verdict=critical and reportPath set:
   row has `outcome:'block'`, `status:'fail'`,
   `evidence:[{kind:'review_report',ref:<path>}]`.
4. `MUDA-waste-audit` fire arm with shell exit 1: row has `outcome:'warn'`.

Provider-unavailable handling: if live is unreachable, local fallback
covers GVAL-02. Per ROADMAP-AGENT.md:111-128 phase records
`provider_unavailable` on a route-decision row and continues; status
downgrades. Phase 36 lands lib + self-test + local fallback unconditionally;
the live wire-in fires the moment any subsequent phase reaches Step 6.5 / 9.5 / 6.55.

## 9. Cross-Milestone Integration

Phase 38 sampling-decider (SAMPLE-02 secondary input `gate_fitness_history`):

```js
// sampling-decider.cjs (Phase 38; sketch, NOT shipped in 36)
const { readGateValueRows, summarize } = require('./gate-value-log.cjs');
function gateFitnessHistory(planningDir, gate) {
  const summary = summarize(planningDir, { gate });
  return summary.length > 0 ? summary[0] : null;
}
// Bias weight <=50% per primary signal (mass-discuss 38.2).
// On null/empty: primaries weight at 100%.
```

Phase 36 ships nothing for Phase 38 beyond the read API. Phase 38's
intersection matrix (gate x work_risk) is the consumer's logic.

Phase 39 rubric (RUBRIC-01):

```js
// rubric.cjs (Phase 39; sketch, NOT shipped in 36)
const gateValueLog = require('../../scripts/lib/gate-value-log.cjs');
const reviewLedger = require('../../scripts/lib/review-ledger.cjs');

for (const gate of REGISTERED_GATES) {
  const gv = gateValueLog.summarize(planningDir, { gate });
  if (gv.length === 0 || gv[0].fires === 0) {
    classify[gate] = 'defer';  // RUBRIC-03 defer-on-empty
    continue;
  }
  const score = gv[0].value_score;
  if (score >= 0.7)      classify[gate] = 'keep';
  else if (score >= 0.3) classify[gate] = 'defer';
  else                   classify[gate] = 'kill';
}
```

Thresholds are Phase 39's choice. Phase 36 only ships the `value_score`
formula and the `defer`-friendly `null`-on-empty contract.

v1.7 review-ledger orthogonality (REQUIREMENTS.md:94 explicit):

- review-ledger.jsonl: gate-OUTPUT data (verdict CONTENT)
- gate-value-log.jsonl: gate-FITNESS data (was-it-worth-running)

The two ledgers reference each other via
`evidence:[{kind:'review_report',ref:<path>}]` in the gate-value row.
Phase 39 rubric reads BOTH and joins on `(milestone, phase, gate)`.

## 10. Open Derivation Calls + Locked Recommendations

All 15 calls below are LOCKED in this RESEARCH (target: zero open into PLAN).

**Q1. Wire-in count: 1 site or 3 sites?**
LOCKED: 3 sites. Phase 39 rubric needs all 3 verdict-bearing gates observable.

**Q2. SKIP arm placement: before or inside `if(shouldFire)`?**
LOCKED: refactor to single-call. `const fired = gates.shouldFire(...);`
ONCE; SKIP arm when `!fired`; FIRE arm after existing block when `fired`.

**Q3. `retroactive` source: snapshot at fire time or static reference?**
LOCKED: snapshot via `gates.getGate(name, GATES_YAML_PATH)`. Captures
`enforcement_mode`, `category`, `step`, `version` AS-OF the fire. Past rows
preserve original metadata if gates.yaml mutates next milestone.

**Q4. `value_score` formula?**
LOCKED: `max(0, (pass + 0.5*warn - block) / fires)` when `fires > 0`,
else `null`.

**Q5. `outcome -> status` derivation: pass-through or always derive?**
LOCKED: outcome wins; caller-provided `status` ignored on conflict.
Outcome is the v1.8 closed enum; allowing override creates inconsistency.

**Q6. Gate name validation: closed enum from gates.yaml or open string?**
LOCKED: open string. Reading gates.yaml at `_normalize` time would invert
the load order (gates-registry.cjs:53 already calls repair-command-checker;
adding a writer dep would cycle). Validation = "non-empty string".

**Q7. `--summary` JSON shape?**
LOCKED: array, sorted by `fires` DESC. Mirrors `aggregateFromPhases`.

**Q8. Empty `evidence: []` permitted?**
LOCKED: yes, default `[]`. SKIP arms have no evidence; FIRE arms include
`[{kind:'review_report', ref:<path>}]` when reportPath in scope.

**Q9. Lib location?**
LOCKED: single file at `super-gsd/scripts/lib/gate-value-log.cjs`. Mirrors
route-ledger and review-ledger.

**Q10. Test file location?**
LOCKED: `super-gsd/scripts/lib/gate-value-log.test.cjs`. Same dir as lib.

**Q11. Single-call `gates.shouldFire` refactor: in-scope?**
LOCKED: in-scope. ~3 lines per site. Keeps wire-in pattern consistent.

**Q12. Real-time write atomicity on Windows?**
LOCKED: yes. Per `route-ledger.cjs:42-43`, fs.appendFileSync atomic at row
boundary on POSIX and on Windows for sub-block writes (rows < 4KB).

**Q13. Cockpit / Mission Strip read in this PLAN?**
LOCKED: no. Phase 38+ concern. Phase 39 surfaces gate fitness in
milestone-close summary, not live strip.

**Q14. `reason_codes` per outcome: locked or extensible?**
LOCKED: extensible array; one default code per outcome (Section 7).
Wire-in callers can append (e.g. `codex_fallback_triggered`); merge =
caller codes appended after defaults.

**Q15. `--summary` exit code on empty data?**
LOCKED: exit 0 with `[]` output. Empty data is not an error; Phase 39
defer-on-empty handles cold-start. CLI exits 1 only on read/parse exceptions.

## 11. Single Plan Recommendation

**One plan: `36-01-gate-value-telemetry-PLAN.md`**

| Atomic commit | Files | Approx +/- |
|---------------|-------|------------|
| C1: lib + self-test (T1) | `super-gsd/scripts/lib/gate-value-log.cjs` | +440 / -0 |
| C2: SKILL.md 3-site wire-in (T2) | `super-gsd/skills/sgsd-orchestrate/SKILL.md` | +60 / -3 |
| C3: local-fallback test (T3) | `super-gsd/scripts/lib/gate-value-log.test.cjs` | +80 / -0 |

Total: 2 created, 1 edited. Net ~+580 / -3.

Why one plan:

1. C1 self-test must pass before C2 wire-in (C2 imports C1).
2. C3 local-fallback exercises C1 + C2 in the same code path the
   orchestrator uses. Splitting C3 delays GVAL-02 evidence.
3. Phase 32 + Phase 34 both shipped lib + wire + test in a single plan.

Acceptance gate (per ROADMAP-AGENT.md:389-394):

- `node super-gsd/scripts/lib/gate-value-log.cjs --self-test` exits 0
- Live-or-local: phase-level-ATC fire (or local-fallback invoking
  `logGateValue` via the same code path the gate-fire decision uses)
  appends row with `outcome` in `{pass, warn, block, skip}`.
  Provider-unavailable -> fallback -> continue.
- `node super-gsd/scripts/lib/gate-value-log.cjs --summary` aggregates by gate.
- 14 self-test assertions PASS.
- Fingerprint guard: canonical `.planning/metrics/gate-value-log.jsonl`
  untouched by self-test.

Risk: LITE tier (no new abstractions; mirrors existing libraries 1:1).
Per-dispatch ATC will fire; Codex review must pass. Phase-level ATC at
close must pass. Edge-guard structural check on the new JSONL emit is the
main novelty -- write path must produce a row that parses cleanly through
`readGateValueRows` (self-test asserts this in #5 + #9).

---

## Sources

### Primary (HIGH confidence)
- `super-gsd/scripts/lib/route-ledger.cjs:42-444` -- 1:1 architectural template
- `super-gsd/scripts/lib/review-ledger.cjs:50-703` -- secondary template (LEGACY_VERDICT_MAP, --aggregate, --kill-check, dedup)
- `super-gsd/scripts/lib/repair-command-checker.cjs:296-432` -- third precedent (14-assertion self-test, fingerprint guard)
- `super-gsd/registry/gates.yaml:33-269` -- 13 gates with retroactive metadata fields
- `super-gsd/registry/command-envelope-v1.yaml:22-78, 133-150, 229-253` -- emitter registry, reason_codes, Mission Strip read contract
- `super-gsd/templates/command-envelope-v1.json:7-89` -- 13 required fields + RUN_ID_REGEX
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:591, 760, 768, 779, 799, 818-823, 1126, 1276-1305` -- 3 wire-in sites
- `super-gsd/scripts/lib/gates-registry.cjs:38-117` -- `getGate(name, path)` API for retroactive snapshot
- `.planning/milestones/v1.8/REQUIREMENTS.md:19-24, 70-72, 94-97` -- TELEMETRY lane + Phase Map + cross-milestone integration

### Secondary (HIGH confidence)
- `.planning/discussions/2026-04-26-mass-discuss.md:209-211` -- locked decision 36=B
- `.planning/ROADMAP-AGENT.md:380-394` -- Phase 36 acceptance contract
- `.planning/milestones/v1.7/phases/34-canonical-review-ledger/34-RESEARCH.md` -- envelope-wrap-with-extension-fields precedent
- `.planning/milestones/v1.7/phases/32-route-decision-ledger/32-01-route-ledger-PLAN.md` -- single-plan + single-wire shape

### Tertiary
- No LOW-confidence claims. All findings cross-verified against >=2 source-tier files.

## Metadata

Confidence breakdown:
- Row shape decision: HIGH -- 3 precedents
- Wire-in inventory: HIGH -- file:line cited; gates.shouldFire grep'd verbatim
- Outcome enum mapping: HIGH -- mirrors `review-ledger.cjs:65-72`
- --summary aggregator: MEDIUM -- formula choice is judgment; locked Q4 with rationale
- Public API: HIGH -- mirrors route-ledger + review-ledger module.exports
- Self-test scaffold: HIGH -- 12 from `route-ledger.cjs:286-420` + 2 new
- Live-or-local fallback: HIGH -- Patch 4 verbatim; mirrors Phase 32 + 34
- Cross-milestone integration: MEDIUM -- consumer logic sketches non-binding

Research date: 2026-04-27
Valid until: 2026-05-27 (30 days; v1.8 has no fast-moving deps)

Open questions: zero. All 15 derivation calls in Section 10 are LOCKED.

Plan-checker contract: planner MUST honor 3-site wire-in (Section 2),
value_score formula (Section 4), OUTCOMES + STATUSES + VERDICT_OUTCOME_MAP
frozen constants (Section 7), and Section 10 LOCKED Q1-Q15 derivation
calls. Any deviation requires CONTEXT.md override with explicit rationale.
