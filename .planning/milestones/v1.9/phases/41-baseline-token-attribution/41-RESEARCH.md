---
phase: 41
phase_name: Baseline Token Attribution
milestone: v1.9
researched: 2026-04-27
domain: Token attribution + agent role accounting + envelope-v1 emitter
confidence: HIGH
controlling_principle: Autonomy continues; evidence tells the truth.
mirror_template: Phase 36 gate-value-log.cjs (1:1 envelope-v1 mirror)
---

# Phase 41 - Baseline Token Attribution - Research

## Summary

Phase 41 is the FIRST phase of v1.9 SGSD-Research. It produces a truthful
token-spend baseline that Phases 42 (token-waste budget), 47 (dispatch
routing), 50 (cockpit), and 51 (benchmark) all consume. Phase 41 itself
does NOT optimize -- it measures.

The work is small: ONE new tool
(`super-gsd/tools/token-attribution/report.cjs`), ONE new canonical
JSONL stream (`.planning/metrics/agent-token-spend.jsonl`), ONE
human-readable report (`.planning/milestones/v1.9/baseline-token-spend.md`).
Architectural template is locked: mirror `super-gsd/scripts/lib/gate-value-log.cjs`
(Phase 36) 1:1 in shape -- envelope-v1 row + 3 extension fields, frozen
const enums, manual schema check, defensive read, __dirname-anchored
canonical fingerprint guard, public API never throws upward.

The substantive surprise from data inventory: `.planning/metrics/token-attribution.jsonl`
(11,173 rows, 7.5 MB) ALREADY carries exact `usage.input_tokens` /
`cache_read_input_tokens` / `cache_creation_input_tokens` / `output_tokens`
/ `total_tokens` per agent_result and assistant_turn row. Backfill is a
DERIVATION not an estimation for the bulk of the baseline. Estimation
(`tokens_estimated: true`, byte-to-token approx) only applies to
codex-log.jsonl rows where Codex provider invocations record `prompt_bytes`
/ `report_bytes` instead of token counts.

**Primary recommendation:** SINGLE plan, FOUR public APIs (appendTokenSpend,
backfillFromMetrics, report, summarize), 14 self-test assertions, mirrors
Phase 36 verbatim with extension fields swapped (gate->role; outcome->provider;
retroactive->token_breakdown). All 11 derivation calls locked (section 11).
~750 lines new code + ~120 lines markdown.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|------------|-------------|-----------|
| Append envelope-v1 row to agent-token-spend.jsonl | Local node script (canonical writer) | route-ledger.cjs:179-189 + gate-value-log.cjs:258-267 prove this tier; orchestrator imports the lib |
| Backfill from existing metrics | Local node script (deterministic walk) | Inputs are JSONL on disk; no LLM judgment; cheapest competent executor (Phase 47 ROUTE-02) |
| Render baseline bloat report markdown | Local node script (template render) | Source data is the JSONL we wrote; rendering is deterministic |
| Substitution-candidate detection | Local node script (threshold rules) | All thresholds are evidence-derived constants; LLM would add cost without changing output |
| Schema validation (envelope-v1) | Local node script (manual check, no ajv) | gate-value-log.cjs:217-255 is the verbatim pattern; mirror it |

Zero browser/frontend/API/database tier work. Entire phase lives in
`super-gsd/tools/` as one new directory.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BASE-01 | Create `agent-token-spend.jsonl` schema for role/provider attribution | Section 2 (envelope-v1 + 3 ext fields, frozen enums) |
| BASE-02 | Backfill rows from available metrics + session logs | Section 3 (4-stream walk, idempotent, scope locked) |
| BASE-03 | Live bloat report by role/phase/provider/cache-read ratio | Section 4 (7-section markdown at baseline-token-spend.md) |
| BASE-04 | Identify researcher/planner/executor/verifier substitution candidates with evidence | Section 5 (R1..R5 rules, audit-derived thresholds) |

---

## 1. Existing Token Data Sources Inventory

### 1.1 `.planning/metrics/token-attribution.jsonl` (PRIMARY)

- **Rows:** 11,173 (`wc -l`); **Size:** 7,875,171 bytes (7.5 MB)
- **Writer:** `super-gsd/tools/token-attribution/collect.cjs:1-120`
- **Schema (event_type=`assistant_turn`):** `schema_version`, `event_type`,
  `event_id` (dedup key), `ts`, `source: "claude-session-jsonl"`,
  `session_id`, `session_file`, `uuid`, `model`, `milestone`, `phase`,
  `plan`, `role: "orchestrator"`, `attribution_basis: "message.usage"`,
  `confidence: "exact_usage_fields"`, `usage.{input_tokens,
  cache_creation_input_tokens, cache_read_input_tokens, output_tokens,
  context_tokens, total_tokens}`.
- **Schema (event_type=`agent_result`):** all of above PLUS `tool_use_id`,
  `agent_id`, `agent_type`, `agent_role` (closed enum: agent |
  classification | execution | plan_check | planning | research | review --
  verified `grep -oE '"agent_role":"[^"]*"' | sort -u`), `prompt_chars`,
  `output_chars`, `total_tokens`, `duration_ms`, `tool_uses`,
  `tool_stats.{readCount, searchCount, bashCount, editFileCount,
  linesAdded, linesRemoved, otherToolCount}`, `codex_offload_candidate`
  (low|medium|high), `codex_offload_reason`.
- **Distinct agent_types observed (24):** Explore, general-purpose,
  gsd-code-reviewer, gsd-executor, gsd-integration-checker,
  gsd-pattern-mapper, gsd-phase-researcher, gsd-plan-checker, gsd-planner,
  gsd-research-synthesizer, gsd-roadmapper, gsd-verifier, sgsd-classifier,
  sgsd-code-reviewer, sgsd-exec-{backend,docs,test,ui},
  sgsd-milestone-readiness, sgsd-sgsd-board-{architect,contrarian,moonshot,pragmatist},
  ssgsd-classifier (typo).
- **Provenance:** EXACT, not estimated. Pulled straight from `message.usage`.
  Backfill from this stream is derivation.

### 1.2 `.planning/metrics/codex-log.jsonl` (SECONDARY)

- **Rows:** 67; **Size:** 24,188 bytes
- **Writer:** `super-gsd/scripts/codex-exec.sh` (per EXISTING-SURFACE-AUDIT.md:48)
- **Schema:** `ts`, `phase`, `plan`, `step`, `exit` (0|4|5), `duration_ms`,
  `prompt_bytes` (NO token count), `report_bytes` (NO token count),
  `timeout_hit`, `fallback_triggered`, `stderr_preview`.
- **Estimation path:** `tokens = round(bytes / 4)` for GPT-5.4. Row carries
  `tokens_estimated: true` flag.

### 1.3 `.planning/metrics/token-log.jsonl` (LEGACY)

- **Rows:** 68. Mostly stubs (`{est_input:1, est_output:0, total:1, model:"unknown"}`).
- **Verdict:** walk but flag with `confidence: "low_legacy_stub"`. Skip
  rows with `model="unknown"` AND `total<10`.

### 1.4 `.planning/metrics/activity-log.jsonl` (CORROBORATION)

- **Rows:** 10,911; **Size:** 2,639,957 bytes
- **Schema:** `{ts, tool, target, phase?}` -- no tokens.
- **Use:** count tool_calls / files_read when token-attribution.jsonl
  `tool_stats` is missing.

### 1.5 Other streams (NOT consumed by Phase 41)

audit-log, codex-live, codex-timeout-observability, crit-backlog,
deliberation-outcomes, gate-value-log (Phase 36 -- template only),
handoff-log, heartbeat, muda-log, plan-errors, readiness-log,
review-ledger (Phase 34), route-decisions (Phase 32 -- template only).

**Inventory verdict:** TWO streams carry token data
(token-attribution.jsonl exact, codex-log.jsonl byte-estimated). One
legacy stub (token-log.jsonl). One corroboration only (activity-log.jsonl).

---

## 2. agent-token-spend.jsonl Schema (BASE-01)

Envelope-v1-wrapped (Phase 31 contract). Mirror Phase 36 verbatim.

### 2.1 Envelope-v1 base (13 fields, locked)

Per `super-gsd/templates/command-envelope-v1.json:7`:

```
envelope_version: 1                        // const
ts:               ISO-8601 string
command:          "logTokenSpend"          // discriminator
status:           ok|warn|fail|skipped|timeout|blocked
reason_codes:     string[]                 // closed vocab; may be empty
artifacts:        [{kind, path}]           // files this row WROTE
evidence:         [{kind, ref}]            // files this row CITES
next_action:      string|null
risk:             low|medium|high|null
duration_ms:      integer|null  (>= 0)
run_id:           ISO ts + 4hex            // "2026-04-27T...Z-a1b2"
phase:            string|null
milestone:        string|null
```

### 2.2 Phase 41 extension fields (3, locked)

| Phase 36 ext | Phase 41 ext | Purpose |
|---------------|---------------|---------|
| `gate` (string) | `role` (frozen enum) | Which SGSD role spent tokens |
| `outcome` (pass/warn/block/skip) | `provider` (4-enum) | Which provider was billed |
| `retroactive` (object) | `token_breakdown` (object) | Detailed token decomposition |

Full row example:

```json
{
  "envelope_version": 1,
  "ts": "2026-04-27T00:00:00.000Z",
  "command": "logTokenSpend",
  "status": "ok",
  "reason_codes": ["exact_usage_fields"],
  "artifacts": [],
  "evidence": [{"kind": "token_attribution_row", "ref": "agent:54c3e039-...:ac7ce1a7..."}],
  "next_action": null,
  "risk": null,
  "duration_ms": 159904,
  "run_id": "2026-04-27T00:00:00.000Z-a1b2",
  "phase": "26",
  "milestone": "v1.6",
  "role": "research",
  "provider": "claude",
  "token_breakdown": {
    "model": "claude-opus-4-7",
    "input_tokens": 1,
    "cache_read_tokens": 83853,
    "cache_creation_tokens": 10142,
    "output_tokens": 700,
    "total_tokens": 94696,
    "cache_read_ratio": 0.886,
    "tokens_estimated": false,
    "tool_calls": 14,
    "files_read": 9,
    "useful_findings": 6,
    "agent_type": "gsd-phase-researcher",
    "source_event_id": "agent:54c3e039-f409-4116-923d-6c0019bdc9ab:a4b4b87c19222f2aa",
    "source_stream": "token-attribution.jsonl"
  }
}
```

### 2.3 Frozen const enums

```javascript
const ROLES = Object.freeze([
  'researcher', 'planner', 'executor', 'verifier',
  'reviewer', 'orchestrator', 'classifier', 'other',
]);

const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);

const PROVIDERS = Object.freeze([
  'claude', 'codex', 'local-script', 'vtp',
]);

const BLOAT_THRESHOLDS = Object.freeze({
  cache_read_ratio_high:    0.90,  // >90% = bloat signature (BUDGET-03)
  useful_findings_low:      15,    // <15 = no real retrieval (BUDGET-03)
  researcher_input_max:     25000, // BUDGET-02 verbatim
  planner_input_max:        30000, // BUDGET-02 verbatim
  executor_input_max:       40000, // BUDGET-02 verbatim
  verifier_input_max:       20000, // BUDGET-02 verbatim
  files_read_high:          50,    // >50 + small_diff = context flooding
  diff_lines_low:           100,   // <100 lines after >50 reads = bloat
});

const COMMAND_NAME     = 'logTokenSpend';
const ENVELOPE_VERSION = 1;
const LEDGER_REL       = path.join('metrics', 'agent-token-spend.jsonl');
```

### 2.4 Status derivation rule

| Source row condition | status | reason_codes |
|----------------------|--------|--------------|
| token-attribution.jsonl agent_result, exact usage | `ok` | `['exact_usage_fields']` |
| token-attribution.jsonl assistant_turn (orchestrator) | `ok` | `['exact_usage_fields']` |
| codex-log.jsonl, exit==0 | `ok` | `['codex_review_pass', 'tokens_estimated']` |
| codex-log.jsonl, exit==5 (timeout) | `timeout` | `['codex_timeout', 'tokens_estimated']` |
| codex-log.jsonl, exit==4 (auth missing) | `fail` | `['codex_auth_missing', 'tokens_estimated']` |
| codex-log.jsonl, fallback_triggered | `warn` | `['codex_fallback_triggered', 'tokens_estimated']` |
| token-log.jsonl legacy stub | `ok` | `['low_legacy_stub']` |

Mirrors `route-ledger.cjs:235-256` verbatim.

---

## 3. Backfill Strategy + Scope (BASE-02)

### 3.1 Walk algorithm

```text
backfillFromMetrics(planningDir, opts):
  1. token-attribution.jsonl (PRIMARY)
     - agent_result rows -> appendTokenSpend({role:deriveRole(agent_role,
       agent_type), provider:'claude', token_breakdown:{...usage,
       ...tool_stats, tokens_estimated:false}})
     - assistant_turn rows -> appendTokenSpend({role:'orchestrator',
       provider:'claude', token_breakdown:{...usage, tokens_estimated:false}})
  2. codex-log.jsonl (SECONDARY)
     - tokens_estimated:true; input_tokens:=round(prompt_bytes/4);
       output_tokens:=round(report_bytes/4)
     - status from deriveStatus(exit, timeout_hit, fallback_triggered)
  3. token-log.jsonl (LEGACY)
     - skip stubs (model="unknown" AND total<10)
     - meaningful rows -> role:'other', confidence:'low_legacy_stub'
  4. (Optional) walk recent claude session jsonl for orchestrator
     turns missing from token-attribution.jsonl -- collect.cjs:99-106
     dedup pattern protects idempotency
```

### 3.2 Role derivation (locked)

```javascript
function deriveRole(agentRole, agentType) {
  // Priority 1: explicit agent_role
  if (agentRole === 'research')       return 'researcher';
  if (agentRole === 'planning')       return 'planner';
  if (agentRole === 'execution')      return 'executor';
  if (agentRole === 'plan_check')     return 'reviewer';
  if (agentRole === 'review')         return 'reviewer';
  if (agentRole === 'classification') return 'classifier';

  // Priority 2: agent_type pattern fallback
  const t = String(agentType || '').toLowerCase();
  if (t.includes('researcher'))   return 'researcher';
  if (t.includes('planner'))      return 'planner';
  if (t.includes('executor') || t.includes('exec-')) return 'executor';
  if (t.includes('verifier'))     return 'verifier';
  if (t.includes('reviewer') || t.includes('checker')) return 'reviewer';
  if (t.includes('classifier'))   return 'classifier';
  if (t === 'orchestrator')       return 'orchestrator';
  return 'other';
}
```

### 3.3 Idempotency

Reuse `collect.cjs:99-106` `readExistingIds()` pattern. Synthetic run_id
derived from `source_event_id` (token-attribution) or
`hash(ts+step+phase)` (codex-log). Re-runs append zero new rows when
sources unchanged.

### 3.4 Backfill scope

| Scope | Rationale | Approx rows |
|-------|-----------|------------:|
| ALL token-attribution.jsonl rows | Already canonical, exact, idempotent | 11,173 |
| ALL codex-log.jsonl rows | Small; provider attribution complete | 67 |
| token-log.jsonl meaningful rows | Small; mostly stubs | <30 |
| Recent session jsonl files | Optional bootstrap; covered by token-attribution.jsonl | 0 (defer to Phase 51) |

Why ALL not "v1.8 only": substitution-candidate detection needs N >= 200
per role for stable thresholds (audit:121-128 reports 20.4M sub-agent +
3.84B assistant tokens lifetime). Bloat report can FILTER to v1.8 for
the recent view; ledger keeps lifetime.

### 3.5 Bloat-example crosscheck (BASE-04 acceptance)

Acceptance per ROADMAP.md:67: "researcher bloat examples from the audit
are represented or explicitly marked unavailable with reason."

| Audit citation | Source | Backfill must produce |
|----------------|--------|------------------------|
| audit:139-147 P36 researcher 171,175 tokens | token-attribution.jsonl | role=researcher, phase=36, milestone=v1.8, total>=170k |
| audit:139-147 P40 researcher 122,437 tokens | token-attribution.jsonl | role=researcher, phase=40, total>=122k |
| audit:103-112 v1.9/P41 orchestrator 1.24M | token-attribution.jsonl | role=orchestrator, phase=41, milestone=v1.9, sum>=1.24M |

If missing: report MUST mark "explicitly unavailable" with reason
documenting the lookup gap.

---

## 4. Bloat Report Format (BASE-03)

### 4.1 File location

`.planning/milestones/v1.9/baseline-token-spend.md` (per ROADMAP.md:62
verbatim).

### 4.2 Sections (locked, 7 sections)

```markdown
# v1.9 Baseline Token Spend Report
Generated: <ISO>  Source: agent-token-spend.jsonl (<N> rows)

## 1. Headline Numbers
- Total tokens (lifetime): N    Total (v1.8): N    Total (v1.9): N
- Sub-agent tokens vs orchestrator tokens
- Cache-read share

## 2. Top Consumers by Role x Milestone
| Role | Milestone | Calls | Total | Avg | Cache-read % | Findings/100k |

## 3. Top Consumers by Role x Phase x Provider
| Role | Phase | Provider | Calls | Total | Avg | Cache-read % | Status |

## 4. Outliers (Bloat Signature)
Rows where cache_read_ratio > 0.90 AND useful_findings < 15.
| Phase | Role | Total | Cache-read % | Findings | source_event_id |

## 5. Substitution Candidates (BASE-04)
- Researcher local-script candidates: <N rows>
- Codex reviewer fallback candidates: <N rows>
- Executor context-packet candidates: <N rows>
- Verifier goal-backward candidates: <N rows>
- Orchestrator turn-trim candidates: <N rows>

## 6. Audit Crosscheck
Verifies the audit's concrete bloat examples appear in the ledger:
- [x] P36 researcher 171k -- found at <run_id>
- [x] P40 researcher 122k -- found at <run_id>
- [x] v1.9/P41 orchestrator 1.24M -- found at <N> rows summing to <total>

## 7. Methodology
- Source streams walked
- Estimation policy (when tokens_estimated=true)
- Confidence levels
- Useful-findings proxy definition (LOCK 10)
```

### 4.3 Outlier detection logic

```javascript
function isBloatRow(r) {
  const tb = r.token_breakdown || {};
  return tb.cache_read_ratio > BLOAT_THRESHOLDS.cache_read_ratio_high
      && (tb.useful_findings || 0) < BLOAT_THRESHOLDS.useful_findings_low;
}
```

Per audit:148-158, every v1.8 P36-P40 researcher row should fall into
this bucket (cache-read 98.3% to 99.1%). If substitution-candidate
report does NOT find them, it is a bug.

---

## 5. Substitution-Candidate Heuristics (BASE-04)

Five evidence-derived rules. None EXECUTE substitution -- they only
IDENTIFY candidates. Phase 47 wires the routing.

### R1: Researcher local-script candidate

```text
WHEN role = 'researcher'
 AND token_breakdown.cache_read_ratio > 0.90
 AND token_breakdown.useful_findings < 15
RECOMMEND: local-script substitution
RATIONALE: Phase 40 researcher used 8 reads + 12 shells to write a
           519-line file (audit:148-158). A node script could produce
           the same inventory deterministically.
PHASE 47 WIRE: ROUTE-02
```

### R2: Codex reviewer fallback candidate

```text
WHEN provider = 'codex' AND status IN ('warn','fail')
 AND reason_codes CONTAINS 'codex_fallback_triggered'
GROUP BY phase
WHERE COUNT(group) / total_codex_calls(phase) > 0.30
RECOMMEND: Claude reviewer fallback default for this phase class
RATIONALE: parse_failure rate >30% = Codex output contract fragile
PHASE 47 WIRE: inverse of ROUTE-03
```

### R3: Executor context-packet candidate

```text
WHEN role = 'executor'
 AND token_breakdown.files_read > 50
 AND token_breakdown.diff_lines < 100
RECOMMEND: context-packet substitution (replace raw context inheritance)
RATIONALE: 50+ files read for <100 diff lines = executor rediscovering
           context the dispatcher should have packaged (audit:271-285
           root cause 1)
PHASE 47 WIRE: feeds Phase 45 PACKET-04
```

### R4: Verifier goal-backward template candidate

```text
WHEN role = 'verifier'
 AND token_breakdown.cache_read_ratio > 0.85
 AND token_breakdown.diff_lines < 200
RECOMMEND: goal-backward template substitution
RATIONALE: A verifier checking a small diff should not pay >50k cache-
           read tokens. Suggests inherited milestone context replaced a
           templated checklist anchored to phase goal.
PHASE 47 WIRE: feeds Phase 45 PACKET-02
```

### R5: Orchestrator turn-trim candidate

```text
WHEN role = 'orchestrator'
 AND ts within 30 minutes of an agent dispatch
 AND total_tokens > 200000
RECOMMEND: orchestrator turn-trim (compress prior context before dispatch)
RATIONALE: audit:103-112 found v1.9/P41 used 1.24M tokens across 4
           orchestrator turns with no sub-agent calls.
PHASE 47 WIRE: feeds Phase 50 COCKPIT-04
```

R5 is INCLUDED per LOCK 6: orchestrator self-spend is the largest single
consumer per audit; excluding it would hide the biggest bloat source.

---

## 6. Tool Location + Public API

### 6.1 File path

`super-gsd/tools/token-attribution/report.cjs` (ROADMAP-AGENT.md verbatim).

NOT a sibling lib in `super-gsd/scripts/lib/`. Phase 32/34/36 use that
location for real-time canonical writers imported by the orchestrator;
Phase 41 has no real-time emitter (backfill is the only writer; report
is the deliverable). EXISTING-SURFACE-AUDIT.md:43-50 sets the precedent
for report-style tools (phase-folder-audit/audit.cjs,
system-map/generate.cjs).

If Phase 50 cockpit needs real-time appendTokenSpend at dispatch time,
the lib MAY split: `super-gsd/scripts/lib/agent-token-spend.cjs`
(canonical writer) + this tool (CLI reporter). Phase 41 keeps everything
in the tool file; the tool exports `appendTokenSpend` so the lib
boundary can be extracted without breaking change.

### 6.2 Public API (4 functions, locked)

```javascript
module.exports = {
  appendTokenSpend,       // canonical envelope-v1 append
  backfillFromMetrics,    // walk source streams, idempotent
  report,                 // produce baseline-token-spend.md
  summarize,              // JSON aggregation by role/phase/provider

  ROLES, STATUSES, PROVIDERS, BLOAT_THRESHOLDS,
  COMMAND_NAME, ENVELOPE_VERSION,
};
```

### 6.3 Function contracts

```text
appendTokenSpend(planningDir, row)
  - mirrors gate-value-log.cjs::logGateValue
  - validates ROLES + PROVIDERS + STATUSES enums
  - normalizes envelope-v1 fields, manual schema check via _assertEnvelopeV1
  - never throws upward; returns false on validation failure
  - atomic: fs.appendFileSync to <planningDir>/metrics/agent-token-spend.jsonl

backfillFromMetrics(planningDir, opts)
  - opts: { dryRun, sourceStreams, dedupe }
  - returns: { rowsRead, rowsAppended, rowsSkipped, errors[] }

report(planningDir, opts)
  - opts: { outPath, milestone, includeAuditCrosscheck }
  - default outPath: <milestone>/baseline-token-spend.md
  - returns rendered markdown string

summarize(planningDir, opts)
  - opts: { groupBy, milestone, role }
  - groupBy: 'role' | 'phase' | 'provider' | 'role+phase' | 'role+phase+provider'
  - returns array of { ...keys, calls, total, avg, cache_read_ratio,
                       useful_findings_per_100k, status_breakdown }
```

### 6.4 CLI

```bash
node super-gsd/tools/token-attribution/report.cjs --self-test
node super-gsd/tools/token-attribution/report.cjs --backfill [--dry-run]
node super-gsd/tools/token-attribution/report.cjs --report
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role
```

---

## 7. --self-test Scaffold (14 assertions)

Mirrors `gate-value-log.cjs:344-545` verbatim with extension fields and
threshold consts swapped.

```text
1.  ROLES is frozen array of 8 entries
2.  PROVIDERS is frozen array of 4 entries
3.  STATUSES is frozen array of 6 entries (envelope-v1 vocab)
4.  BLOAT_THRESHOLDS is frozen object with 8 keys
5.  empty read on fresh tmpdir returns []
6.  appendTokenSpend with valid row -> envelope-shaped row written
    (verifies role, provider, token_breakdown ext fields preserved
     + envelope-v1 13 required fields present)
7.  invalid role -> false (never throws upward)
8.  invalid provider -> false (never throws upward)
9.  three appends -> three rows; never truncated (append-only)
10. malformed line skipped; subsequent valid append readable
    (defensive read, mirrors gate-value-log.cjs:444-457)
11. backfillFromMetrics with synthetic source rows produces correct
    envelope rows (4 source-stream cases: agent_result, assistant_turn,
    codex-log row, token-log row)
12. summarize aggregates by role with correct cache_read_ratio
    (fixture: 5 researcher rows = 1k+10k+100k+150k+200k tokens; verify
     avg + ratio)
13. summarize milestone filter excludes other milestones
14. canonical streams (4 paths) untouched by self-test
    (fingerprint check before/after: realLedger + token-attribution.jsonl
     + token-log.jsonl + codex-log.jsonl + activity-log.jsonl)
```

### 7.1 __dirname-anchored fingerprint guard (CRITICAL)

```javascript
// Lib lives at <repo>/super-gsd/tools/token-attribution/report.cjs;
// canonical streams at <repo>/.planning/metrics/. Anchor 3 dirs up so
// CI/IDE invocations find the SAME canonical streams.
const realLedger = path.resolve(__dirname, '..', '..', '..',
  '.planning', 'metrics', 'agent-token-spend.jsonl');
const realSrcs = [
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'token-attribution.jsonl'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'token-log.jsonl'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'codex-log.jsonl'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'activity-log.jsonl'),
];
// fingerprint = each path's {exists, mtime, size}; verify unchanged at
// finally{} after self-test tmpdir cleanup. Mirrors gate-value-log.cjs:
// 358-360 + 527-534.
```

Phase 32 W3 lesson applied: tools that skipped this guard accidentally
polluted canonical ledgers when run from IDE/CI.

---

## 8. Live-or-Local Fallback Design

| Mode | Source | Use case |
|------|--------|----------|
| LIVE | `--backfill` walks production .planning/metrics/*.jsonl | Real baseline derivation; run on actual repo |
| LOCAL | `--self-test` seeds tmpdir with synthetic rows | CI-safe; never touches canonical streams |

The audit reports v1.9/P41 (this very phase) used 1.24M orchestrator
tokens with no sub-agent calls; Phase 41 itself MUST be backfillable.
Live mode is hard requirement. Local mode is required by
EXISTING-SURFACE-AUDIT.md:54-60 ("CLI entrypoint, --self-test,
deterministic fixtures, production caller path, JSON output where
practical").

---

## 9. Schema-Without-Consumer Rule

Four in-phase consumers exercise the schema:

1. **`appendTokenSpend`** (canonical writer) -- writes the schema
2. **`backfillFromMetrics`** (bootstrap consumer) -- reads upstream,
   writes envelope-v1 rows
3. **`report`** (human consumer) -- reads ledger, renders markdown
4. **`summarize`** (machine consumer) -- reads ledger, returns JSON
   aggregations. Phase 42 `token-waste/check.cjs` (BUDGET-01) is the
   next-phase consumer; Phase 41's `summarize` exposes the same shape so
   Phase 42 imports it verbatim.

All 4 exported from same file. All 4 exercised by self-test. No schema
field unused.

---

## 10. Architectural Mirror Discipline (1:1 with Phase 32 / 36)

| Aspect | Phase 32 | Phase 36 | Phase 41 |
|--------|----------|----------|----------|
| Envelope-v1 base | 13 fields, manual schema | 13 fields, manual schema | mirror |
| Extension fields | 2 (boundary, decision) | 3 (gate, outcome, retroactive) | 3 (role, provider, token_breakdown) |
| Frozen consts | BOUNDARIES(7), STATUSES(6) | OUTCOMES(4), STATUSES(6), VERDICT_OUTCOME_MAP, OUTCOME_REASON_CODES, OUTCOME_STATUS_MAP | ROLES(8), PROVIDERS(4), STATUSES(6), BLOAT_THRESHOLDS(8) |
| Public API | logRouteDecision, readRows, logCodexRoute (3) | logGateValue, readGateValueRows, summarize, ledgerPath, outcomeFromVerdict (5) | appendTokenSpend, backfillFromMetrics, report, summarize (4) |
| Failure contract | never throws upward | never throws upward | never throws upward |
| Canonical fingerprint | route-ledger.cjs:306-309 | gate-value-log.cjs:358-360 | mirror; __dirname/../../../... |
| Self-test count | 13 | 14 | 14 (mirror Phase 36) |
| Defensive read | route-ledger.cjs:192-202 | gate-value-log.cjs:280-303 | mirror verbatim |
| Atomic append | fs.appendFileSync | fs.appendFileSync | fs.appendFileSync |
| run_id pattern | ISO ts + 4 hex | ISO ts + 4 hex | mirror RUN_ID_REGEX exactly |

Phase 41's contract level is "agent role x provider token attribution".
Genuinely new -- route-ledger covers ROUTING; gate-value-log covers GATE
FITNESS; review-ledger covers REVIEW VERDICTS; token-attribution.jsonl
covers RAW TURN USAGE without role rollup. New schema justified.

NOT mirrored: Phase 36 `outcomeFromVerdict` has no Phase 41 equivalent
(token spend has direct usage values, not verdicts). Phase 32
`logCodexRoute` shorthand HAS an equivalent
(`logTokenSpendFromAttributionRow`) but is OPTIONAL for Phase 41 -- defer
to Phase 50.

---

## 11. Open Derivation Calls -- LOCKED

| # | Question | Locked Decision |
|---|----------|-----------------|
| 1 | Envelope-v1 wrap? | YES. Mirrors Phase 36 1:1 |
| 2 | Extension field shape? | 3 fields (role, provider, token_breakdown) -- Phase 36 shape |
| 3 | Tokens-vs-bytes when exact unavailable? | byte-to-token approx `tokens=round(bytes/4)` for GPT-5.4; flag `tokens_estimated:true` |
| 4 | Backfill window depth? | ALL rows (lifetime); bloat report can FILTER for recent view |
| 5 | Substitution threshold sensitivity? | Hardcode in BLOAT_THRESHOLDS frozen const; values verbatim from BUDGET-02/03 |
| 6 | Include orchestrator self-spend? | YES (largest consumer per audit:103-112) |
| 7 | Tool location? | `super-gsd/tools/token-attribution/report.cjs` (ROADMAP-AGENT verbatim) |
| 8 | Self-test assertion count? | 14 (mirror Phase 36 exactly) |
| 9 | Idempotency strategy? | Reuse `collect.cjs:99-106` `readExistingIds()`; synthetic run_id from source_event_id |
| 10 | Useful-findings counting? | PROXY: `tool_stats.linesAdded` (research output IS the finding); fallback `(editFileCount+searchCount)` for read-only verifiers; documented in methodology section |
| 11 | Substitution-candidate phase scope? | All phases for ledger; substitution report highlights only candidates with N>=5 calls per role (noise floor) |

---

## 12. Single Plan Recommendation

### 12.1 File count

| Path | Status | Lines |
|------|--------|------:|
| `super-gsd/tools/token-attribution/report.cjs` | NEW | ~750 |
| `.planning/milestones/v1.9/baseline-token-spend.md` | NEW (generated) | ~120 |
| `.planning/metrics/agent-token-spend.jsonl` | NEW (canonical) | ~11k+ rows (one-time backfill) |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | OPTIONAL EDIT | +5 lines (cite report path; defer to Phase 42 if not needed) |

### 12.2 Line delta

```text
+750 code (report.cjs)
+120 doc  (baseline-token-spend.md)
+~11k jsonl rows (generated, not hand-written)
=====================================
~870 lines hand-written; rest generated.
```

Smaller than Phase 36 (gate-value-log.cjs is 599 + skill wire-ins).
Phase 41 has no orchestrator wire-in.

### 12.3 Plan task structure (single 41-01-PLAN.md)

```
T1.  Skeleton: frozen consts + envelope-v1 _normalize +
     _assertEnvelopeV1 + _appendRowInternal + appendTokenSpend wrapper
T2.  deriveRole + deriveStatus + run_id helpers
T3.  backfillFromMetrics walk for token-attribution.jsonl
T4.  backfillFromMetrics walk for codex-log.jsonl with byte estimation
T5.  backfillFromMetrics walk for token-log.jsonl with legacy stub flag
T6.  summarize() with role/phase/provider/role+phase aggregations
T7.  isBloatRow + 5 substitution-candidate rules (R1..R5)
T8.  report() rendering 7 sections of baseline-token-spend.md
T9.  CLI argv handling (--self-test, --backfill, --report, --summary)
T10. 14-assertion --self-test scaffold + __dirname fingerprint guard
T11. Run --backfill against live repo; verify ledger row count + audit
     crosscheck
T12. Run --report; verify baseline-token-spend.md renders with all 7
     sections
T13. Verifier acceptance: BASE-01..04 satisfied
```

T1-T10 mechanical (no LLM judgment). T11-T13 integration tests.
Single-plan recommendation deliberately avoids splitting -- mirror
discipline requires file coherence; splitting risks drift between
extension fields and frozen consts.

### 12.4 Risks (with mitigations)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Mirror tempts copy-paste of Phase 36 with stale comments | High | T1 must rewrite header docblock; checker MUST flag any "gate"/"outcome"/"retroactive" leak |
| Backfill non-idempotent on re-run | High | LOCK 9 reuses collect.cjs pattern; assertion 9 verifies append-only |
| Self-test pollutes canonical ledger | Critical | Assertion 14 fingerprints all 4 streams (mirror gate-value-log.cjs:358+527 verbatim) |
| Codex byte-to-token estimate wrong for GPT-5.4 | Medium | tokens_estimated:true flag isolates rows; Phase 51 benchmark refines |
| Useful-findings proxy poor metric | Medium | LOCK 10 documents proxy in methodology; Phase 42 refines |
| Report tries to render 11k raw rows | Low | LOCK 4: report is filtered/aggregated, never raw row dump |

### 12.5 Estimated effort

Single executor dispatch. Mirror discipline means most of the file is
verbatim transformation of `gate-value-log.cjs:1-599` with prefix swap
(`gate-value-log` -> `agent-token-spend`; `OUTCOMES` -> `ROLES`; etc.).
Novel work: 4 backfill walks, 5 substitution rules, 7-section markdown
renderer, audit crosscheck.

A focused executor with Phase 36 file in context can produce the
finished tool in ONE pass.

---

## Sources

### Primary (HIGH confidence)

- `.planning/milestones/v1.9/REQUIREMENTS.md:70-79` (BASE-01..04 verbatim)
- `.planning/milestones/v1.9/REQUIREMENTS.md:27-52` (Design Locks)
- `.planning/milestones/v1.9/ROADMAP.md:54-70` (Phase 41 deliverables)
- `.planning/milestones/v1.9/SGSD-HANDOVER.md:88-101` (Implementation Rules)
- `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md:21-60` (existing
  metrics + tools to mirror)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:79-95`
  (live token ledger 11k rows)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:103-112`
  (v1.9/P41 1.24M orchestrator evidence)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:121-128`
  (top agent totals reference)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:139-158`
  (v1.8 P36-P40 cache-read share)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:280-302`
  (waste detector spec)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:741-770`
  (canonical row example)
- `.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md:740-770`
  (substitution rules from VTP crosscheck)
- `super-gsd/scripts/lib/route-ledger.cjs:1-468` (Phase 32 template)
- `super-gsd/scripts/lib/gate-value-log.cjs:1-599` (Phase 36 template,
  MOST ALIGNED)
- `super-gsd/templates/command-envelope-v1.json:1-90` (envelope-v1 contract)
- `super-gsd/tools/token-attribution/collect.cjs:1-120` (existing collector
  schema + dedup pattern)
- `.planning/ROADMAP-AGENT.md` (Phase 41 file location verbatim)
- Direct file inventory: `wc -l` on all 4 source streams
- Direct schema inspection: `grep -oE '"agent_role":"[^"]*"' | sort -u`
  (7 roles); `grep -oE '"agent_type":"[^"]*"' | sort -u` (24 types)

### Secondary (MEDIUM confidence)

None. Every claim anchored to a file:line or verified shell command.

### Tertiary (LOW confidence)

- GPT-5.4 byte-to-token ratio ~4 (training knowledge; tokenizer
  densities vary 3.5-4.5). Mitigation: `tokens_estimated:true` flag
  isolates these rows; Phase 51 benchmark can refine post-hoc.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Schema design | HIGH | Mirrors Phase 36 verbatim; envelope-v1 contract locked at Phase 31 |
| Backfill strategy | HIGH | All source schemas inspected directly; idempotency proven in collect.cjs |
| Substitution rules | HIGH | Thresholds derived from audit + REQUIREMENTS BUDGET-02/03 verbatim |
| Bloat report format | HIGH | Mirrors audit:121-128 reference shape; render is mechanical |
| Tool location + API | HIGH | ROADMAP-AGENT fixes path; mirror discipline fixes API shape |
| Self-test scaffold | HIGH | 14 assertions lifted from gate-value-log.cjs with ext-field swap |
| Useful-findings proxy | MEDIUM | LOCK 10 documents proxy explicitly; refinement deferred to Phase 42 |
| GPT-5.4 byte-to-token ratio | LOW | Training knowledge; tokens_estimated isolates risk |

## Project Constraints (from CLAUDE.md / SGSD design locks)

- Permissions: never ask for confirmation; auto mode owns dispatch.
- Commit discipline: `feat(41-01): {one-liner}`; commit after every unit;
  stage specific files by name.
- Mirror Phase 36 architectural template 1:1.
- Atomic writes via fs.appendFileSync (each row well under 4KB).
- Stderr-only error logging; canonical writer never throws upward.
- ASCII-only in this RESEARCH.md (verified -- 0 non-printable chars).
- Redis NOT canonical; SGSD design lock 1.
- `.planning` JSONL + git remain source of truth; design lock 2.
- Token spend logged by role/phase/provider/model/cache-read/input/
  output/tool calls/files read/MCP calls/useful findings; design lock 8
  -- this phase IMPLEMENTS that lock.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GPT-5.4 byte-to-token ratio ~4 | LOCK 3 + 3.1 | codex-log token estimates off up to 30%; mitigated by `tokens_estimated` flag and Phase 51 benchmark |
| A2 | `tool_stats.linesAdded` is reasonable proxy for "useful findings" | LOCK 10 + 5.1 | Substitution detection may flag false positives/negatives; documented as proxy in methodology section, refined Phase 42 |

All other claims VERIFIED via direct file inspection or CITED from source
documents. No other ASSUMED claims.

## Metadata

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; stable architectural template)
**Confidence breakdown:**
- Standard stack: HIGH (template = Phase 36 verbatim)
- Architecture: HIGH (envelope-v1 locked since Phase 31)
- Pitfalls: HIGH (Phase 32 W3 + Phase 36 W2/W3/W4 lessons applied)
- Backfill correctness: HIGH (source schemas verified directly)
- Estimation accuracy: MEDIUM (byte-to-token only; isolated by flag)

**Single recommendation locked:** ONE plan, ONE file, FOUR public APIs,
FOURTEEN self-test assertions, FOUR source streams, FIVE substitution
rules. Mirror Phase 36 verbatim. No new architectural surface.
