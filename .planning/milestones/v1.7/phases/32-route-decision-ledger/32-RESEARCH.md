# Phase 32: Route Decision Ledger - Research

**Researched:** 2026-04-27
**Domain:** orchestrator route-logging, JSONL append libs, codex-route wiring
**Confidence:** HIGH (locked decision 32=A; all primary sources verified in repo)
**Controlling principle:** Autonomy continues; evidence tells the truth.

---

## User Constraints (from ROADMAP-AGENT.md + DISCUSS 2026-04-26)

### Locked Decisions
- **32=A** boundary-only logging (6 named boundary types). NOT "log everything".
- **ROUTE-01:** `.planning/metrics/route-decisions.jsonl` writer module with `--self-test`.
- **ROUTE-02:** 6 boundary types: `milestone_promotion`, `phase_dispatch_first`,
  `executor_choice`, `gate_skip`, `codex_route`, `handoff_decision`.
- **ROUTE-03:** Orchestrator (`super-gsd/skills/sgsd-orchestrate/SKILL.md`) invokes
  `logRouteDecision()` at >=1 boundary in production. Schema-without-consumer rule:
  this phase MUST land a production caller, not just the lib.
- **ROUTE-04:** Rows include phase + milestone + reason_codes + outcome + linked artifacts.
- **Phase 31 (envelope-v1) just shipped.** Reuse the reason_codes vocabulary at
  `command-envelope-v1.yaml:100-226`.
- **Live-or-Local Acceptance Rule (Patch 4 of mass-discuss):** every "Live: ..." line either
  performs the live action OR runs a deterministic local fallback that exercises the
  PRODUCTION CALLER PATH. Mock predicates are forbidden.
- **Hard stop only on the 5 conditions** (creds, destructive ops, privacy, runtime cannot
  continue, explicit operator gate). Provider-unavailable triggers fallback + status
  downgrade + continue, never a halt.

### Claude's Discretion
- Row schema shape (envelope-v1 wrapper vs independent — recommendation: envelope).
- Self-test assertion count (target 12).
- Exact SKILL.md insertion line (recommendation: 1236, after `appendPerDispatchReviewEvidence`).
- Local fallback test path (recommendation: `super-gsd/scripts/lib/__tests__/`).

### Deferred Ideas (OUT OF SCOPE)
- Wiring all 6 boundaries (requirement is >=1; we ship 1).
- A renderer for `route-decisions.jsonl` (no `.md` view in v1.7).
- Aggregator across phases (review-ledger is Phase 34; no Phase for route-ledger).
- Auto-kill of low-signal boundaries (REQUIREMENTS.md ROUTE lane "kill if first 10 rows show
  no signal value" — that's a v1.8 review concern).
- Mission Strip consumption (post-v1.7 per `command-envelope-v1.yaml:232-253`).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-01 | writer module + `--self-test` | Section 4 + Section 6 (`crit-backlog.cjs:107-113` pattern) |
| ROUTE-02 | 6 boundary types defined | Section 1 (all 6 mapped to orchestrator locations) |
| ROUTE-03 | Orchestrator invokes logRouteDecision >=1 boundary | Section 7 (`codex_route` at SKILL.md:1236) |
| ROUTE-04 | Rows include phase + milestone + reason_codes + outcome + artifacts | Section 2 (row schema) |

---

## Summary

Phase 32 lands a tiny append-only writer (`super-gsd/scripts/lib/route-ledger.cjs`)
patterned 1:1 after `crit-backlog.cjs` (verified 264 lines: `appendRow / readRows /
selfTest` shape). It declares 6 boundary types as a closed enum and wires `codex_route`
into Step 9.5 per-dispatch-ATC (SKILL.md:1163-1215), where the orchestrator's existing
`shellDispatch` already makes a route decision (codex vs claude-via-fallback) and has
all the context needed (provider name, phase, plan, fallback_triggered, _fallback_reason).

Adding `logRouteDecision()` after `appendPerDispatchReviewEvidence(report, ...)` is a
non-load-bearing wrapped call. No new branches, no new providers, no new dispatch logic.
Cheapest possible wire-in cost.

The lib uses **envelope-v1 wrapping**: every route-decision row IS a valid envelope-v1
row plus `boundary` and `decision` extension fields. Cockpit reads it for free via
`mission_strip_read_contract`. No second contract; no collision
(`command-envelope-v1.yaml:260: collides_with: []`).

Live-or-local: the wire-in fires per per-dispatch-ATC commit. The deterministic local
fallback exercises `route-ledger.cjs` via the same lib code path the orchestrator hits,
faking only the `dispatchResult` payload (the I/O boundary).

**Primary recommendation:** envelope-shaped writer + codex_route wire-in at Step 9.5
(SKILL.md:1236) + 12-assertion self-test + Node fallback test. Single plan file
(32-01-PLAN.md). Diff: ~280 lib + ~16 SKILL.md + ~80 fallback test = ~376 additive lines.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|------------|-------------|-----------|
| Route-decision writer | Node lib (`super-gsd/scripts/lib/route-ledger.cjs`) | Sibling to crit-backlog/edge-guard/gates-registry — same tier, same import pattern |
| Append-only persistence | Filesystem JSONL (`.planning/metrics/route-decisions.jsonl`) | Same contract as crit-backlog.jsonl, edge-guard-log.jsonl, codex-log.jsonl |
| Production caller (ROUTE-03) | Orchestrator Step 9.5 (SKILL.md:1163-1215) | Codex routing already decided here; logging is a 4-line addition |
| Local fallback test | Node fixture (`super-gsd/scripts/lib/__tests__/route-ledger-codex-route-fallback.cjs`) | Deterministic; same code path as orchestrator |
| Cockpit consumption | DEFERRED post-v1.7 | Mission strip reads via Phase 34+ |
| Aggregation across milestones | DEFERRED | No Phase scheduled |
| Reason-codes vocabulary | CONSUME `command-envelope-v1.yaml:100-226` | Single source of truth; no extension this phase |

---

## 1. Boundary Inventory (ROUTE-02)

The orchestrator skill is **1742 lines**. Below: each boundary mapped to the exact code
path. **Recommended ROUTE-03 wire-point: `codex_route` at Step 9.5.**

### 1.1 `milestone_promotion`
- **Where:** Step 6.7 MILESTONE COMPLETE AUTO-TRIGGER (SKILL.md:964-987); promotion verdict
  inside `sgsd-complete-milestone` skill (status taxonomy at mass-discuss.md:81-91).
- **Decided:** Auto-trigger predicate (all phases [x]); `SHIPPED | SHIPPED-WITH-DEBT-N | CANDIDATE` outcome.
- **Likely reason_codes:** `gate_skip_with_reason`, `atc_warn_only`, `inventory_waste`, `runtime_unreachable`.
- **Outcome enum:** `ok | warn | fail | skipped`.
- **Wire-in cost:** Medium (two edit sites). **Defer.**

### 1.2 `phase_dispatch_first`
- **Where:** Step 6.d.5 phase-readiness re-probe (SKILL.md:420-437) returning GO/DRIFT/MANIFEST_MISSING.
- **Decided:** Live-prerequisite probe; DRIFT branch local-degraded-path vs checkpoint.
- **Likely reason_codes:** `provider_unavailable`, `runtime_unreachable`, `frontmatter_missing`,
  `gate_skip_with_reason`.
- **Outcome enum:** `ok | warn | blocked`.
- **Wire-in cost:** Low-medium. Volume too low to test live-or-local well. **Defer.**

### 1.3 `executor_choice`
- **Where:** Step 6.e wave dispatch (SKILL.md:439-478); `dispatchPlanner.buildDispatchPlan(plan)`.
- **Decided:** Sonnet vs Haiku (always Sonnet today); serial vs parallel wave (PARALLEL_CONFIRMED at SKILL.md:474).
- **Likely reason_codes:** `gate_skip_with_reason`, `max_chain_depth` (future).
- **Outcome enum:** `ok | warn`.
- **Wire-in cost:** Medium. Monomorphic today (no specialists). **Defer.**

### 1.4 `gate_skip`
- **Where:** Every `gates.shouldFire(...)` returning `false`. Sites at SKILL.md:264, 329, 347,
  355, 591, 798, 871, 1126, 1394, 1402. Closed predicate at `gates-registry.cjs:83-87`.
- **Decided:** Gate disabled (enforcement_mode) vs predicate-false.
- **Likely reason_codes:** `gate_skip_with_reason` (canonical at `command-envelope-v1.yaml:145-147`).
- **Outcome enum:** `skipped` (always).
- **Wire-in cost:** High (~9 sites). Redundant with edge-guard log. **Defer.**

### 1.5 `codex_route` -- RECOMMENDED ROUTE-03 WIRE POINT
- **Where:** Step 9.5 PER-DISPATCH ATC (SKILL.md:1117-1247), specifically the dispatch +
  fallback at SKILL.md:1163-1215. Same shape lives in Step 6.5 phase-level-ATC
  (SKILL.md:684-757) and Step 9.6 adversarial challenger (SKILL.md:1285-1351).
- **Decided:** Codex shell-dispatch vs Claude-agent-dispatch (`effective.invocation === 'shell'`);
  fallback to Claude on non-zero exit OR contract-validation failure (sets
  `report._provider='claude-via-fallback'`, `report._fallback_reason='parse_failure'`); skip vs
  single-retry-on-timeout (codex-exec.sh:626-654).
- **Likely reason_codes (DIRECT envelope-v1 matches):** `codex_timeout` (exit 5), `codex_auth_missing`
  (exit 4), `codex_fallback_triggered` (the canonical Step 9.5 fallback at SKILL.md:1177),
  `provider_unavailable` (codex_enabled=false at SKILL.md:1148), `parse_failure`
  (validateContract invalid at SKILL.md:1196), `review_unanimous_pass`, `review_split_decision`,
  `gate_force_with_reason`.
- **Outcome enum:** `ok | warn | fail | timeout | blocked`.
- **Why this wire-in:** Cleanest decision boundary in the entire skill; all inputs already in
  scope; fires every per-dispatch-ATC FULL/GATE commit (highest-volume route signal); we
  demonstrated the codex review pipeline 4 times in v1.6 (Phases 28-31 each ran
  phase-level-ATC with both reviewers); test invocation is deterministic via
  `config.review_providers.codex_enabled = false`; zero new dispatch surface (4-line wrap
  around an existing decision); operator priority — Codex availability is the most
  operationally important route signal in mid-2026 SGSD reality.

### 1.6 `handoff_decision`
- **Where:** Step 6.d.5 DRIFT branch (SKILL.md:432-437); implicit Codex->Claude handoff
  already covered by `codex_route` (don't double-count); specialist agents (sgsd-exec-fix
  vs sgsd-exec-feature) are FUTURE.
- **Likely reason_codes:** `session_handoff_refused`, `max_chain_depth`, `codex_auth_missing`.
- **Outcome enum:** `ok | fail | blocked`.
- **Wire-in cost:** Low signal today. **Defer to v1.8.**

### Boundary Summary

| Boundary | Volume | Signal/Noise | Cost | ROUTE-03 target? |
|----------|--------|--------------|------|------------------|
| `milestone_promotion` | 1/milestone | High | Medium | No |
| `phase_dispatch_first` | 1/phase | Medium | Low-medium | No |
| `executor_choice` | N/wave | Low (monomorphic) | Medium | No |
| `gate_skip` | ~9/iteration | Very low | High | No |
| **`codex_route`** | **N/full-tier-commit** | **High** | **Lowest** | **YES** |
| `handoff_decision` | rare | Low | Low | No |

---

## 2. Row Schema Decision

### Locked: ENVELOPE-V1 WRAPPED.

Every row is a valid envelope-v1 row PLUS `boundary` + `decision` extension fields.

**Why envelope-shaped:**
1. Phase 31 is the fifth contract level (`command-envelope-v1.yaml:1-13`). Independent
   shape would force operator to defend a sixth contract level six weeks after locking
   the fifth.
2. `reason_codes` vocabulary lives in envelope-v1 (`command-envelope-v1.yaml:100-226`).
   Independent schema would either redeclare (collision) or reference (then we ARE
   envelope-shaped).
3. Cockpit free via `mission_strip_read_contract` (`command-envelope-v1.yaml:232-253`):
   tail-read + filter envelope_version==1 + surface status + reason_codes.
4. Phase 34 review-ledger reads envelope rows; route-decisions feed it with no adapter.
5. No collision — `command-envelope-v1.yaml:260: collides_with: []`. Adding a 7th
   emitter is exactly the migration shape envelope-v1 was designed for.
6. Lower lib cost — `appendRow` with envelope-required fields; no new validation logic.

**Why NOT independent:** an `{ts, boundary, decision, reason_codes, phase, milestone,
evidence_paths[], outcome}` shape is conceptually simpler but immediately diverges from
cockpit + Phase 34. Operator's locked 31=A bet was "fifth contract is real" — Phase 32
either validates that (envelope) or violates it (independent). Validate.

### The schema

```json
{
  "envelope_version": 1,
  "ts": "2026-04-27T11:32:01.123Z",
  "command": "logRouteDecision",
  "status": "ok",
  "phase": 32,
  "milestone": "v1.7",
  "run_id": "rd-2026-04-27T11-32-01-123Z-a1b2",
  "duration_ms": 12,
  "reason_codes": ["codex_fallback_triggered", "parse_failure"],
  "artifacts": [".planning/milestones/v1.7/phases/32-route-decision-ledger/commit-reviews.jsonl"],
  "evidence": [{"kind": "review_report", "path": ".planning/.../32-ATC-REVIEW.md"}],
  "next_action": null,
  "risk": null,
  "boundary": "codex_route",
  "decision": {
    "from": "codex-cli-reviewer",
    "to": "claude-sonnet-reviewer",
    "fallback_triggered": true,
    "provider_used": "claude-via-fallback",
    "fallback_reason": "parse_failure"
  }
}
```

| Field | Source | Required by | Notes |
|-------|--------|-------------|-------|
| `envelope_version` | constant `1` | envelope-v1 | hardcoded |
| `ts` | `new Date().toISOString()` | envelope-v1 + ROUTE-04 | UTC ISO 8601 |
| `command` | constant `"logRouteDecision"` | envelope-v1 | hardcoded |
| `status` | argument | envelope-v1 | Closed enum: `ok|warn|fail|skipped|timeout|blocked` per `mission_strip_read_contract.status_to_pane_state` |
| `phase` | argument | ROUTE-04 | number |
| `milestone` | argument | ROUTE-04 | string |
| `run_id` | auto | envelope-v1 | `rd-{ts-with-dashes}-{4hex}` mirroring `crit-backlog.cjs:34-38` |
| `duration_ms` | optional | envelope-v1 | null when not measurable |
| `reason_codes` | argument | ROUTE-04 | array; each MUST be in envelope-v1 vocab |
| `artifacts` | argument | ROUTE-04 | repo-relative paths |
| `evidence` | optional | envelope-v1 | array of `{kind, path}` |
| `next_action` | optional | envelope-v1 | usually null for route-decisions |
| `risk` | optional | envelope-v1 | usually null |
| **`boundary`** | argument | **ROUTE-02** | one of the 6 (closed enum) |
| **`decision`** | argument | **ROUTE-04** | free-form; lib does not enforce sub-keys |

**Strict validation:** `envelope_version`, `command`, `boundary`, `status`, `reason_codes[]`.
**Loose:** `decision`, `evidence[].kind`, `next_action`, `risk`.

---

## 3. Reason-Codes Mapping (boundary -> likely reason_codes)

All codes already exist in `command-envelope-v1.yaml:100-226`. **Phase 32 does NOT extend
the vocabulary** — it consumes it.

| Boundary | Most-likely reason_codes (priority order) |
|----------|-------------------------------------------|
| `milestone_promotion` | `gate_skip_with_reason`, `atc_warn_only`, `inventory_waste`, `runtime_unreachable` |
| `phase_dispatch_first` | `provider_unavailable`, `runtime_unreachable`, `frontmatter_missing`, `gate_skip_with_reason` |
| `executor_choice` | `gate_skip_with_reason`, `max_chain_depth` (future) |
| `gate_skip` | `gate_skip_with_reason` (single canonical) |
| **`codex_route`** | **`codex_fallback_triggered`, `provider_unavailable`, `parse_failure`, `codex_timeout`, `codex_auth_missing`, `review_unanimous_pass`, `review_split_decision`, `gate_force_with_reason`** |
| `handoff_decision` | `session_handoff_refused`, `max_chain_depth`, `codex_auth_missing` |

**Multi-code rows allowed.** A `codex_route` row when Codex unreachable AND fallback Claude
succeeds emits `[provider_unavailable, codex_fallback_triggered]` — both apply, both written.
Matches envelope-v1's `reason_codes: array` (no ordering, just a set).

---

## 4. `--self-test` Design

Pattern matches `provider-health/check.cjs:189-256` and `crit-backlog.cjs:197-238`.
**Lightweight, in-memory, no external deps, exits 0 PASS / 1 FAIL.**

Scaffold:
```javascript
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) =>
    cond ? pass++ : (fail++, failures.push({ name, detail }));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-'));
  try { /* assertions */ } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`route-ledger self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) { for (const f of failures) console.error(`  FAIL: ${f.name}`); return 1; }
  return 0;
}
```

### The 12 assertions (LOCKED LIST)

1. **Empty read returns []**: `readRows(tmp)` -> `[]` on a fresh tmpdir.
2. **Single append produces one row**: `appendRow(tmp, validRow)` then `readRows(tmp).length === 1`.
3. **Envelope-v1 fields present**: row has `envelope_version === 1`, `command === 'logRouteDecision'`,
   ISO-shaped `ts`, non-empty `run_id`.
4. **Phase-32 fields present**: row has `boundary`, `decision`, `phase`, `milestone`,
   `reason_codes` (array), `status`, `artifacts` (array).
5. **Invalid boundary throws**: `appendRow(tmp, {boundary: 'banana', ...})` throws with
   "boundary must be one of".
6. **Invalid status throws**: `appendRow(tmp, {status: 'maybe', ...})` throws with
   "status must be one of".
7. **Unknown reason_code throws**: `appendRow(tmp, {reason_codes: ['banana_code'], ...})`
   throws with "reason_code 'banana_code' not in envelope-v1 registry". Lib accepts an
   optional `_envelopeVocabPath` for test injection.
8. **Append-only**: two appends produce two rows; file never truncated.
9. **Atomic append survives malformed line**: pre-write malformed line, then append; `readRows`
   skips malformed and returns valid (mirrors `crit-backlog.cjs:120-122`).
10. **All 6 boundaries accepted**: loop appends one row per boundary; 6 rows returned.
11. **Run_id uniqueness on rapid succession**: 100 appends -> 100 distinct `run_id`s.
12. **--self-test does NOT touch real ledger**: assert
    `fs.existsSync('.planning/metrics/route-decisions.jsonl')` unchanged at end (capture
    mtime at start, assert unchanged).

**Time budget:** All 12 assertions <100ms. Pattern matches provider-health (<50ms).

---

## 5. Live-or-Local Fallback Design

ROADMAP-AGENT.md:308-313 acceptance: "dispatching one Codex review (or running the
local-fallback test that calls `logRouteDecision()` via the same orchestrator path)
produces a row in `route-decisions.jsonl` with `boundary=codex_route` and non-empty
`reason_codes`. Provider-unavailable triggers fallback, status degrades, run continues."

Patch 4 (ROADMAP-AGENT.md:111-127): "deterministic local-fallback that exercises the
PRODUCTION CALLER PATH... Mock predicates that bypass the production caller are forbidden."

### File: `super-gsd/scripts/lib/__tests__/route-ledger-codex-route-fallback.cjs`

**Invocation:** `node super-gsd/scripts/lib/__tests__/route-ledger-codex-route-fallback.cjs`

**What it does (no predicate mocks; only I/O-boundary fakes):**

1. Creates a tmpdir for `.planning/metrics/`.
2. Imports the **actual code path**: the wire-in (Section 7) factors `codex_route` logging
   into a pure helper inside `route-ledger.cjs` — `logCodexRoute(args)`. The fallback test
   imports THAT helper directly (the same code SKILL.md's Step 9.5 imports).
3. Builds 4 fake `dispatchResult` payloads representing canonical outcomes:
   - **Codex success:** `{exit: 0, report: 'FINDINGS: 0\nCRITICAL: 0\n...', _provider: 'openai-codex'}`
     -> `status: 'ok'`, `reason_codes: ['review_unanimous_pass']`.
   - **Codex timeout:** `{exit: 5, timeout_hit: true}` -> `status: 'timeout'`,
     `reason_codes: ['codex_timeout']`.
   - **Codex auth fail:** `{exit: 4}` -> `status: 'fail'`, `reason_codes: ['codex_auth_missing']`.
   - **Parse failure -> fallback:** `{exit: 0, report: 'INVALID'}` (validateContract fails)
     -> `status: 'warn'`, `reason_codes: ['codex_fallback_triggered', 'parse_failure']`,
     `decision.fallback_triggered: true`.
4. For each, calls `logCodexRoute(tmpLedgerPath, ctx, dispatchResult)` and asserts:
   row appended; `boundary === 'codex_route'`; `reason_codes` non-empty; `status` matches
   expected envelope enum; `decision.from/to/provider_used` populated.
5. 4/4 -> exit 0; any fail -> exit 1.

### What this proves vs does NOT prove

**Proves:** writer accepts orchestrator's exact decision payload; reason_codes lookup
rejects unknown codes; schema producible from data already at Step 9.5; provider-unavailable
fallback path produces documented row.

**Does NOT prove:** that the orchestrator actually calls `logCodexRoute()` on a real Codex
dispatch — that's the live arm of live-or-local. When Codex IS reachable, real dispatch
produces the row; when unreachable, the fallback test IS the proof.

### Why this satisfies Patch 4

The fallback **calls the same lib function the orchestrator calls.** No predicate bypass.
Fakes ONLY the `dispatchResult` (the I/O boundary — output of shelling to `codex-exec.sh`).
Every line of lib append + validation + envelope-shaping logic runs under the test.

---

## 6. JSONL Append Safety Patterns (from crit-backlog.cjs)

Verified by reading `super-gsd/scripts/lib/crit-backlog.cjs:1-264`. Replicate:

**6.1 Append-only, never mutate.** `fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8')`
(`crit-backlog.cjs:111`). Route-decisions has no `kind: cleared` equivalent — simpler than
crit-backlog, no clearance model.

**6.2 Atomic write via single appendFileSync.** OS-atomic on POSIX; on Windows uses CreateFile
`FILE_APPEND_DATA` which is atomic for sub-block writes. Each row is well under 4KB.
Concurrency: orchestrator is single-threaded; per-dispatch-ATC fires sequentially after
parallel waves settle (SKILL.md:467-471). **No locking required.**

**6.3 Schema versioning.** Use `envelope_version: 1` field. Future bumps follow
`command-envelope-v1.yaml:96-99` extension protocol.

**6.4 Self-test fidelity.** `os.mkdtempSync(path.join(os.tmpdir(), 'rl-'))` (per
`provider-health/check.cjs:207`) — strictly isolated from project tree.

**6.5 Defensive parse on read.** `crit-backlog.cjs:120-122`:
```javascript
return text.split(/\r?\n/).filter(Boolean).map((l) => {
  try { return JSON.parse(l); } catch { return null; }
}).filter(Boolean);
```
Replicate verbatim.

**6.6 Generated id (`run_id`).** `crit-backlog.cjs:34-38`:
```javascript
function generateId() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(2).toString('hex');
  return `${ts}-${rand}`;
}
```
Replicate as `generateRunId()` returning `rd-{ts}-{4hex}`.

---

## 7. Exact Wire-in Plan

### 7.1 Where exactly

**Target:** `super-gsd/skills/sgsd-orchestrate/SKILL.md`, **Step 9.5 PER-DISPATCH ATC**.

**Edit range:** SKILL.md:1163-1215 (the codex shell-dispatch block).

**Insertion point:** **SKILL.md:1236**, immediately after `appendPerDispatchReviewEvidence(report, ...)`,
before the `}` that closes the `if (effective.invocation === 'shell')` branch.

### 7.2 The minimal call

```javascript
// ROUTE-03 wire-in: log the codex routing decision
try {
  require('super-gsd/scripts/lib/route-ledger.cjs').logCodexRoute({
    projectDir,
    phase: currentPhase,
    milestone: currentMilestone,
    plan: currentPlan,
    dispatchResult,                          // exit, timeout_hit, _provider, _fallback_reason
    effectiveProviderName: effective.name,   // 'codex-cli-reviewer' or fallback
    fallbackProviderName: report?._provider, // 'openai-codex' | 'claude-via-fallback'
    fallbackTriggered: report?._provider === 'claude-via-fallback',
    fallbackReason: report?._fallback_reason || null,
    reportPath: report ? perDispatchReportPath() : null,
  });
} catch (e) {
  console.warn('[SGSD] route-ledger logCodexRoute failed:', e.message);
  // Non-fatal: orchestrator MUST NOT crash if the ledger throws.
}
```

**SKILL.md cost:** ~16 lines markdown / ~70 tokens. **Runtime cost:** ~5 tokens (one require,
one fn call). Negligible.

### 7.3 Helper inside `route-ledger.cjs`

The helper lives in the lib (not SKILL.md) so the fallback test can import it:

```javascript
function logCodexRoute(args) {
  const { dispatchResult, effectiveProviderName, fallbackProviderName,
          fallbackTriggered, fallbackReason, reportPath, projectDir,
          phase, milestone, plan } = args;

  let status = 'ok';
  const reasonCodes = [];
  if (dispatchResult.exit === 0 && fallbackTriggered) {
    status = 'warn';
    reasonCodes.push('codex_fallback_triggered');
    if (fallbackReason === 'parse_failure') reasonCodes.push('parse_failure');
  } else if (dispatchResult.exit === 0) {
    status = 'ok';
    reasonCodes.push('review_unanimous_pass');
  } else if (dispatchResult.exit === 5) {
    status = 'timeout';
    reasonCodes.push('codex_timeout');
    if (fallbackTriggered) reasonCodes.push('codex_fallback_triggered');
  } else if (dispatchResult.exit === 4) {
    status = 'fail';
    reasonCodes.push('codex_auth_missing');
    if (fallbackTriggered) reasonCodes.push('codex_fallback_triggered');
  } else {
    status = 'fail';
    reasonCodes.push('provider_unavailable');
    if (fallbackTriggered) reasonCodes.push('codex_fallback_triggered');
  }

  return appendRow(projectDir, {
    boundary: 'codex_route', status, phase, milestone, plan,
    reason_codes: reasonCodes,
    artifacts: reportPath ? [reportPath] : [],
    decision: {
      from: effectiveProviderName,
      to: fallbackProviderName,
      fallback_triggered: !!fallbackTriggered,
      fallback_reason: fallbackReason || null,
      exit: dispatchResult.exit,
      timeout_hit: !!dispatchResult.timeout_hit,
    },
  });
}
```

### 7.4 What the wire-in does NOT change

- No new gate in `gates.yaml`. Route-logging is always-on.
- No edits to `gates-registry.cjs`, `predicate-eval.cjs`, any other lib.
- No edits to `codex-exec.sh` (its `codex-log.jsonl` is orthogonal — different abstraction).
- No edits to `sgsd-complete-milestone` skill (1.1, 1.2, 1.3, 1.6 deferred).
- No edits to mission-strip lib (cockpit consumption post-v1.7).

---

## 8. Failure-Mode Handling (orchestrator MUST NOT crash)

### 8.1 Contract

The writer can throw for: closed-enum violation, file system error, invalid JSON in payload.
**None may crash the orchestrator.** Section 7.2's wrapper (`try/catch`) enforces this.

### 8.2 Error envelope

On writer throw: stderr warn (`[SGSD] route-ledger logCodexRoute failed: {message}`); no
row written. Acceptable — route-decisions is observability, not consensus. A missed log is
a soft fault.

**Should we ALSO write to CRIT-BACKLOG?** No. Crit-backlog is for retry-budget-exhausted
CRITs that bear on phase status. A route-ledger failure is operational debt, not a
phase-evaluation event. Stderr warn; next loop iteration runs.

### 8.3 Writer guarantees

1. Closed-enum throws synchronously, before file I/O. Bad payload caught at test time, not
   runtime.
2. `appendFileSync` is atomic at row boundary. No partial-row writes architecturally.
3. Reader is defensive (Section 6.5). Malformed row never breaks consumers.

### 8.4 Contract with orchestrator

The wire-in is **non-load-bearing.** Removing it must not affect correctness — only
observability. By design: "Autonomy continues; evidence tells the truth." Evidence may
falter; autonomy must not.

---

## 9. Open Derivation Calls + Locked Recommendations

| # | Question | Locked Call | Rationale |
|---|----------|-------------|-----------|
| 9.1 | Envelope-shaped or independent? | **Envelope-shaped** | Phase 31's locked 31=A makes envelope the fifth contract; either validate or violate it |
| 9.2 | Which boundary for ROUTE-03? | **`codex_route` at Step 9.5** | Highest volume + lowest cost + highest signal |
| 9.3 | Wire phase-level-ATC (Step 6.5) too? | **Defer** | Same shape; one caller satisfies ROUTE-03; doubling is gilding |
| 9.4 | Wire all 6 boundaries this phase? | **No** | 32=A says "boundary-only logging (6 named decisions)" — define 6, wire >=1 |
| 9.5 | Renderer (`route-decisions.md`)? | **No** | Feeds cockpit + Phase 34, not operator directly |
| 9.6 | CLI flags beyond --self-test? | **--self-test only** | Match minimal contract; tight surface |
| 9.7 | provider-health integration? | **No** | Separate concern; provider-health says "available?", route-ledger says "what was decided?" |
| 9.8 | Reason-codes vocab extension? | **No** | All needed codes already in envelope-v1; future codes are registry-version bumps in separate phases |
| 9.9 | Schema version field on rows? | **`envelope_version: 1`** | Reuses envelope-v1's versioning |
| 9.10 | Atomic write via tmp+rename vs appendFileSync? | **appendFileSync** | crit-backlog uses it; same atomicity guarantees on Windows + POSIX for sub-block writes |
| 9.11 | Lib location? | **`super-gsd/scripts/lib/route-ledger.cjs`** | Sibling to crit-backlog, edge-guard, gates-registry |
| 9.12 | JSONL location? | **`.planning/metrics/route-decisions.jsonl`** | Per ROUTE-01 verbatim |
| 9.13 | SKILL.md insertion point? | **Line 1236** (after `appendPerDispatchReviewEvidence`) | Single insertion; existing context already in scope |
| 9.14 | Block if envelope vocab YAML missing? | **No, fall back to frozen built-in vocab** | Loose dependency; lib console.warns + uses hardcoded copy of Phase 31 codes |
| 9.15 | Fallback test: shell or node? | **Node (.cjs)** | Matches lib runtime; cross-platform |
| 9.16 | Lib API exports? | **`{appendRow, readRows, generateRunId, logCodexRoute, BOUNDARIES, STATUSES, selfTest, jsonlPath}`** | Mirrors crit-backlog's exports + the wire-in helper |

### Intentionally deferred

| # | Question | Defer to | Rationale |
|---|----------|----------|-----------|
| 9.17 | Wire Step 6.5 phase-level-ATC? | Phase 34 / v1.8 | Same shape; not needed for ROUTE-03 |
| 9.18 | Feed kill-condition ("kill if first 10 rows show no signal value")? | v1.8 review | Operator decision at first review |
| 9.19 | gate_skip volume concern? | First-10-rows review | Don't pre-optimize for unwired boundary |
| 9.20 | Renderer when row count > 100? | Never (per 9.5) | Wrong abstraction for this stream |

---

## Standard Stack

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| Node `fs` | Node 20+ | appendFileSync, readFileSync, mkdtempSync | [VERIFIED: crit-backlog.cjs:25] |
| Node `path` | Node 20+ | path.join | [VERIFIED: crit-backlog.cjs:26] |
| Node `crypto` | Node 20+ | randomBytes for run_id | [VERIFIED: crit-backlog.cjs:27] |
| Node `os` | Node 20+ | mkdtempSync prefix | [VERIFIED: provider-health/check.cjs:40] |
| `js-yaml` (vendored) | as pinned | Parse envelope vocab YAML | [VERIFIED: gates-registry.cjs:42-44] |

**No new package installs.** js-yaml at `super-gsd/tools/plan-schema/node_modules/js-yaml`
per `gates-registry.cjs:42-44`. Phase 32 reuses the same vendored path.

---

## Architecture Patterns

**Pattern 1: JSONL append + render** (`crit-backlog.cjs:107-113`) — append-only structured streams.

**Pattern 2: Closed-enum validation throw early** (`crit-backlog.cjs:62-69`):
```javascript
const VALID_BOUNDARIES = ['milestone_promotion','phase_dispatch_first','executor_choice',
                         'gate_skip','codex_route','handoff_decision'];
if (!row.boundary || !VALID_BOUNDARIES.includes(row.boundary)) {
  throw new Error(`route-ledger: boundary must be one of ${VALID_BOUNDARIES.join(', ')}`);
}
```

**Pattern 3: Self-test as first-class CLI** (`provider-health/check.cjs:189-256`,
`crit-backlog.cjs:197-238`): `if (cmd === '--self-test') process.exit(selfTest());`

**Pattern 4: Try/catch wrap at orchestrator-call boundary** (implicit across SKILL.md;
boot-time schema-drift check at SKILL.md:60-101 swallows errors). Telemetry must never
crash autonomy.

**Anti-patterns to avoid:**
- Independent JSON-Schema reinvention — envelope-v1 is the contract.
- Synchronous file locking — single-threaded loop is sufficient.
- Auto-render on append — render only on demand (and v1.7 has no renderer at all).
- Logging gates inside `gates.yaml` — route-ledger is intrinsic, not gated.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---------|-------------|-------------|
| JSONL writer | Custom `fs.write` + offsets | `fs.appendFileSync` (atomic at row boundary) |
| Run ID | UUID v4 dep | `crypto.randomBytes(2).toString('hex')` + ISO ts (`crit-backlog.cjs:34-38`) |
| Vocab validation | Hardcoded array | Read `command-envelope-v1.yaml` (frozen built-in fallback per 9.14) |
| Concurrency control | Mutex / lock file | None — single-threaded loop; sequential per-dispatch-ATC at SKILL.md:467-471 |
| Schema versioning | Custom v1/v2 markers | `envelope_version: 1` (reuses Phase 31 contract) |
| Renderer | Markdown table generator | None in v1.7 |

---

## Common Pitfalls

**Pitfall 1: Logging codex_route TWICE per dispatch.** Step 6.5 (phase-level-ATC) and
Step 9.5 (per-dispatch-ATC) have identical shape. Phase 32 ships ONE wire-in (Step 9.5).
Step 6.5 wires later if needed. Warning sign: ratio >1 row per phase per provider event.

**Pitfall 2: route-ledger throwing crashes orchestrator.** Closed-enum validation throws
inside the wire-in, propagates to loop. Fix: Section 7.2's `try/catch` wrapper. Wire-in is
non-load-bearing.

**Pitfall 3: Vocab divergence between writer and registry.** Writer hardcodes codes that
drift from `command-envelope-v1.yaml` over time. Fix: lib reads YAML on require; restart
reloads. Warning sign: phase's first run after registry bump throws on previously-good code.

**Pitfall 4: Rows lack phase or milestone (ROUTE-04 violation).** Orchestrator calls helper
without populating state. Fix: writer rejects null phase/milestone with clear message; the
wrapper swallows and warns. Warning sign: rows with `phase=null AND milestone=null`.

**Pitfall 5: Misclassifying status.** Codex returned exit=0 with fallback flag set
(parse_failure); writer maps to `ok` instead of `warn`. Fix: Section 7.3's mapping checks
`fallbackTriggered` BEFORE `dispatchResult.exit === 0`. Warning sign: cockpit shows green
when reviewer was claude-via-fallback.

---

## Code Examples

### Minimal envelope-shaped row
```javascript
const ledger = require('super-gsd/scripts/lib/route-ledger.cjs');
ledger.appendRow(projectDir, {
  boundary: 'codex_route', status: 'ok', phase: 32, milestone: 'v1.7', plan: '32-01',
  reason_codes: ['review_unanimous_pass'],
  artifacts: ['.planning/milestones/v1.7/phases/32-route-decision-ledger/commit-reviews.jsonl'],
  decision: { from: 'codex-cli-reviewer', to: null, fallback_triggered: false },
});
```

### Fallback-fired row
```javascript
ledger.appendRow(projectDir, {
  boundary: 'codex_route', status: 'warn', phase: 32, milestone: 'v1.7', plan: '32-01',
  reason_codes: ['codex_fallback_triggered', 'parse_failure'],
  artifacts: ['.planning/milestones/v1.7/phases/32-route-decision-ledger/commit-reviews.jsonl'],
  decision: { from: 'codex-cli-reviewer', to: 'claude-sonnet-reviewer',
              fallback_triggered: true, fallback_reason: 'parse_failure', exit: 0 },
});
```

### Wired call from orchestrator
See Section 7.2.

---

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | Node built-in `assert` (no test runner — same pattern as crit-backlog/provider-health) |
| Config file | None — self-tests live in the lib |
| Quick run | `node super-gsd/scripts/lib/route-ledger.cjs --self-test` |
| Full suite | quick run + `node super-gsd/scripts/lib/__tests__/route-ledger-codex-route-fallback.cjs` |

### Phase Requirements -> Test Map

| Req | Behavior | Test Type | Command | File Exists? |
|-----|----------|-----------|---------|-------------|
| ROUTE-01 | writer + --self-test | unit | `node super-gsd/scripts/lib/route-ledger.cjs --self-test` | No (Wave 0) |
| ROUTE-02 | 6 boundaries enforceable | unit | included in --self-test (#10) | No (Wave 0) |
| ROUTE-03 | orchestrator invokes logRouteDecision | integration | `node super-gsd/scripts/lib/__tests__/route-ledger-codex-route-fallback.cjs` | No (Wave 0) |
| ROUTE-04 | rows have phase + milestone + reason_codes + outcome + artifacts | unit | included in --self-test (#4) | No (Wave 0) |
| Live-or-local | provider-unavailable triggers fallback row | integration | fallback test simulates exit=0+invalid-contract | No (Wave 0) |

### Sampling Rate
- Per task commit: `--self-test`
- Per wave merge: --self-test + fallback test
- Phase gate: both green + a real per-dispatch-ATC fired with codex producing a row

### Wave 0 Gaps
- [ ] `super-gsd/scripts/lib/route-ledger.cjs` — covers ROUTE-01, ROUTE-02, ROUTE-04
- [ ] `super-gsd/scripts/lib/__tests__/route-ledger-codex-route-fallback.cjs` — covers ROUTE-03 (live-or-local)
- [ ] SKILL.md edit at line 1236 — covers ROUTE-03 (production caller)

---

## Security Domain

### Applicable ASVS

| ASVS | Applies | Standard Control |
|------|---------|------------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | closed-enum on `boundary`, `status`, `reason_codes` |
| V6 Cryptography | yes (minor) | `crypto.randomBytes(2)` for run_id; no key material |

### Threat patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| JSONL row injection (newline in payload) | Tampering | `JSON.stringify` escapes newlines; `appendFileSync` adds exactly one `\n` |
| Path traversal in artifacts/evidence | Tampering | Writer does NOT open paths — recorded for downstream; read-side defense in mission-strip / Phase 34 |
| Closed-enum bypass via case mutation | Tampering | strict `includes`; case-sensitive |
| ENOSPC / disk-full | DoS | try/catch wrapper at orchestrator boundary; loop continues; no row written |

**Secrets / credentials.** route-ledger NEVER touches credentials. Codex auth status is
signaled via `reason_codes: ['codex_auth_missing']` — a literal string, never a token value.
No secret material is ever serialized.

---

## State of the Art

| Old approach | Current approach | When | Impact |
|--------------|------------------|------|--------|
| crit-backlog as the only structured stream | envelope-v1 wraps multiple streams | Phase 31 | route-decisions inherits the contract |
| route-decisions filename only in DISCUSS Phase 38 (`gate_override`) | route-decisions defined in Phase 32 | THIS phase | First time the file is canonical |
| `codex-log.jsonl` as only routing-decision evidence | `route-decisions.jsonl` is canonical route-decision stream; `codex-log.jsonl` keeps recording shell-wrapper telemetry | THIS phase | Cockpit reads route-decisions for routing signal; codex-log for shell-runtime signal |

---

## Environment Availability

| Dependency | Required by | Available | Fallback |
|------------|------------|-----------|----------|
| Node 20+ | Lib runtime | Yes [VERIFIED via codex-exec.sh runtime] | none — hard requirement |
| `super-gsd/tools/plan-schema/node_modules/js-yaml` | YAML parsing | Yes [VERIFIED: gates-registry.cjs:42-44] | hardcoded vocab list per 9.14 |
| `super-gsd/registry/command-envelope-v1.yaml` | Reason-codes vocabulary | Yes [VERIFIED: shipped Phase 31] | hardcoded vocab list per 9.14 |
| `.planning/metrics/` | JSONL output target | Yes | mkdir -p in writer |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none in critical path.

---

## Project Constraints (from CLAUDE.md)

- **Atomic commits per unit.** Phase 32 plan splits: lib commit, SKILL.md wire-in commit,
  fallback test commit.
- **NEVER ask user for confirmation in autonomous mode.** No prompts in Phase 32 dispatch.
- **Stage specific files by name.** Lib commit: `super-gsd/scripts/lib/route-ledger.cjs`.
  Wire-in commit: `super-gsd/skills/sgsd-orchestrate/SKILL.md`. Test commit:
  `super-gsd/scripts/lib/__tests__/route-ledger-codex-route-fallback.cjs`.
- **NEVER expose secrets.** route-ledger is text-only; `reason_codes: ['codex_auth_missing']`
  is a literal, not a token.
- **Token efficiency.** Lib pays ~5 runtime tokens per call. Self-test <100ms.
- **Auto mode no halt on writer error.** Section 8's wrapper enforces this.

---

## Assumptions Log

| # | Claim | Section | Risk |
|---|-------|---------|------|
| A1 | js-yaml available via vendored path | Standard Stack | LOW — gates-registry uses same path; both libs break together if it moves |
| A2 | `appendFileSync` atomic at row boundaries on Windows for sub-block writes | 6.2 | LOW — same assumption crit-backlog/edge-guard rely on |
| A3 | Single-threaded orchestrator means no concurrent appends | 6.2 | LOW — parallel waves serialize per-dispatch-ATC at SKILL.md:467-471 |
| A4 | Codex unreachable always sets `report._provider = 'claude-via-fallback'` | 7.3 | LOW — verified at SKILL.md:1185-1186, 1204 |
| A5 | All 8 reason_codes in 7.3 are declared in envelope-v1 vocab | 3 | VERIFIED at command-envelope-v1.yaml:100-226 |
| A6 | First-10-rows kill condition is v1.8 review concern | Deferred Ideas | LOW — explicit in REQUIREMENTS.md ROUTE lane |
| A7 | Wire-in at SKILL.md:1236 will not regress per-dispatch-ATC behavior | 7.2 | LOW — non-load-bearing wrapper |

---

## Sources

### Primary (HIGH confidence)
- `super-gsd/scripts/lib/crit-backlog.cjs` — JSONL writer pattern (264 lines, fully read)
- `super-gsd/registry/command-envelope-v1.yaml` — envelope-v1 schema, reason_codes vocab,
  mission_strip read contract (273 lines, fully read)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — orchestrator skill (1742 lines; key sections
  read: 1-1000 cold-start through Step 6.6, 1000-1500 Step 9 through Step 13, 1500-1742
  edge-guard + checkpoint + golden rules)
- `super-gsd/scripts/codex-exec.sh` — codex shell wrapper (725 lines, fully read; relevant:
  exit codes 1-6, JSONL append, narrative event)
- `super-gsd/tools/provider-health/check.cjs` — self-test scaffold (291 lines, fully read)
- `super-gsd/scripts/lib/gates-registry.cjs` — gate registry singleton + js-yaml import path
  (97 lines, fully read)
- `.planning/discussions/2026-04-26-mass-discuss.md` — locked decisions, controlling
  principle, status taxonomy (248 lines, fully read)
- `.planning/ROADMAP-AGENT.md` — Phase 32 block, acceptance criteria, live-or-local rule
  (727 lines, v1.7 milestone block fully read)
- `.planning/milestones/v1.7/REQUIREMENTS.md` — ROUTE lane (79 lines, fully read)
- `.planning/milestones/v1.7/phases/31-canonical-envelope/31-RESEARCH.md` — envelope-v1
  emitter analysis (cross-emitter table referenced)

### Secondary / Tertiary
- (none — primary sources cover all needed claims)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every lib already in repo, paths verified
- Architecture: HIGH — direct reuse of crit-backlog.cjs pattern
- Pitfalls: HIGH — all 5 grounded in real SKILL.md code paths
- Wire-in plan: HIGH — exact line cited (SKILL.md:1236), context already in scope
- Schema decision: HIGH — envelope-v1 reconciliation explicit at command-envelope-v1.yaml:260
- Self-test design: HIGH — pattern matches 2 existing self-tests verified line-by-line
- Live-or-local: HIGH — production caller path identified; exercise method documented
- Failure modes: HIGH — 4 modes, all with concrete mitigations

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; Phase 31 just shipped, envelope-v1 vocab fresh;
Phase 33+ will add codes per registry extension protocol but won't invalidate route-ledger)

**Recommended single plan:** `32-01-route-ledger-PLAN.md` with three commits:
1. `feat(32-01): route-ledger.cjs lib + 12-assertion self-test`
2. `feat(32-01): wire codex_route into Step 9.5 per-dispatch-ATC`
3. `test(32-01): deterministic local fallback for codex_route boundary`

Total estimated diff: ~280 lines new lib + ~16 lines SKILL.md edit + ~80 lines fallback test
= ~376 lines additive code, zero deletions.
