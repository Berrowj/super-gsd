---
plan_id: 42-01
phase: 42
title: Token Budget Admission
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [BUDGET-01, BUDGET-02, BUDGET-03, BUDGET-04, BUDGET-05]
locked_decisions: [13]
depends_on: [31, 36, 39, 40, 41]
created: 2026-04-27
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/tools/token-waste/check.cjs
      - super-gsd/tools/token-waste/budgets.yaml
      - super-gsd/skills/sgsd-complete-milestone/SKILL.md
      - .planning/metrics/token-waste-status.jsonl
      - .planning/milestones/v1.9/token-waste.md
    hypothesis: "A read-only check.cjs that imports Phase 41 summarize/BLOAT_THRESHOLDS/ROLES/STATUSES/PROVIDERS and applies the sec 4.4 verdict matrix produces the {ok,warn,degraded,false_positive,error} ladder that BUDGET-04 needs. The ladder makes bloat visible (BUDGET-05) without halting autonomy (design lock 13)."
    falsifier: "Self-test F3 (degraded fixture) emits envelope.status='blocked' OR exits non-zero on degraded verdict. Either outcome violates lock 13 and disqualifies the tool."
    stop_rule: "self-test 15/15 PASS (4 fixtures + 11 secondary); --check --milestone v1.9 against the live 11,295-row ledger emits one envelope-v1 row to token-waste-status.jsonl with verdict in {ok,warn,degraded}; CLI exits 0 even when verdict='degraded'; SKILL.md Step 4.7 grep for runCheck returns >=1; F3 envelope.status==='warn' (NOT 'blocked'); read-only invariant green (5 canonical streams + budgets.yaml byte-identical pre/post)."
    minimal_test: "node super-gsd/tools/token-waste/check.cjs --self-test -> exit 0 with 15 pass / 0 fail; node super-gsd/tools/token-waste/check.cjs --check --milestone v1.9 -> exit 0 + token-waste-status.jsonl gains one row + .planning/milestones/v1.9/token-waste.md exists."
must_haves:
  truths:
    - "VERDICTS = Object.freeze 4-entry: ok, warn, degraded, false_positive (NO 'blocked'; 'error' is CLI-internal, not a verdict)"
    - "ROUTE_REASONS = Object.freeze 5-entry: R1..R5 names verbatim from Phase 41 (researcher_local_script_candidate, codex_reviewer_fallback_candidate, executor_context_packet_candidate, verifier_goal_backward_candidate, orchestrator_turn_trim_candidate)"
    - "BUDGETS = Object.freeze 8-role-keys with {warn_input, degrade_input}; bloat_signature inherited from Phase 41 BLOAT_THRESHOLDS by reference (NOT copied)"
    - "Public APIs (runCheck, renderTable, appendCheckRun) wrap internals in try/catch and NEVER throw upward (mirrors gate-keep-kill/rubric.cjs and Phase 36 gate-value-log.cjs)"
    - "_normalize + _assertEnvelopeV1 trio enforces envelope-v1 schema on every appended row; closed-enum violations raise inside _appendRowInternal but public API catches and returns false"
    - "Read-only against ALL 5 canonical streams (agent-token-spend.jsonl, token-attribution.jsonl, codex-log.jsonl, token-log.jsonl, activity-log.jsonl) AND read-only against budgets.yaml; only owned writes are token-waste-status.jsonl (append-only) and milestones/{id}/token-waste.md (overwrite-per-run)"
    - "__dirname-anchored 3-up walk to .planning for canonical-path defaults (Phase 32 W3 + Phase 36 W2 + Phase 39 W3 lessons)"
    - "Verdict matrix from RESEARCH sec 4.4 implemented exactly: 'degraded' requires (input over warn_input AND cache_read>0.90 AND useful_findings<15) OR (input over degrade_input)"
    - "BUDGET-04 lock-13 binding: every 'degraded' verdict emits envelope.status='warn' (NEVER 'blocked'); CLI exits 0 even when verdict='degraded'; only bad invocation exits 2"
    - "false_positive verdict ONLY when budgets.yaml override matches OR row.reason_codes includes one of {vtp_research_route, high_risk_code_phase, full_review_tier}; envelope row writes status='skipped' + reason_codes contains 'budget_check_false_positive'"
    - "route_hint emitted only when verdict in {warn, degraded} AND row matches one of Phase 41 R1..R5 rules; reason vocab frozen verbatim from Phase 41"
    - "Self-test 15 assertions: 4 named fixtures (F1 normal, F2 warning, F3 degraded BINDING, F4 false_positive) + 11 secondary"
    - "Malformed budgets.yaml falls back to compiled-in BUDGETS; reason_code 'budgets_yaml_fallback' added; runCheck NEVER throws upward on bad config"
  artifacts:
    - super-gsd/tools/token-waste/check.cjs (NEW; ~600 LOC; mirrors gate-keep-kill/rubric.cjs + Phase 41 report.cjs imports)
    - super-gsd/tools/token-waste/budgets.yaml (NEW; ~50 LOC; 8 roles x 2 thresholds + bloat_signature reference + overrides)
    - super-gsd/skills/sgsd-complete-milestone/SKILL.md (EDIT; +Step 4.7 + Step 6 SUMMARY.md subsection; mirrors Step 4.5/4.6)
    - .planning/metrics/token-waste-status.jsonl (NEW canonical; runtime grows; envelope-v1 rows)
    - .planning/milestones/v1.9/token-waste.md (NEW Step-4.7-generated; ~80 LOC; verdict + rules + hints + offenders)
  key_links:
    - 42-CONTEXT.md (sparse stub goal)
    - 42-RESEARCH.md (820 lines; 10 LOCKED derivations; sec 4.4 verdict matrix; sec 6.3 budget table; sec 7 self-test design; sec 11.2 12-task structure)
    - .planning/milestones/v1.9/REQUIREMENTS.md (BUDGET-01..05 + design lock 13)
    - .planning/milestones/v1.9/ROADMAP.md (Phase 42 acceptance A1..A4)
    - super-gsd/tools/token-attribution/report.cjs (Phase 41; UPSTREAM IMPORT: summarize, BLOAT_THRESHOLDS, ROLES, STATUSES, PROVIDERS, ledgerPath)
    - super-gsd/tools/gate-keep-kill/rubric.cjs (Phase 39; ARCHITECTURAL MIRROR for read-only check + closed-enum verdict + renderTable)
    - super-gsd/scripts/lib/gate-value-log.cjs (Phase 36; envelope-v1 writer mirror; _normalize + _assertEnvelopeV1 + never-throws-upward + RUN_ID_REGEX)
    - super-gsd/scripts/lib/gates-registry.cjs (js-yaml load pattern; pinned at super-gsd/tools/plan-schema/node_modules/js-yaml)
    - super-gsd/skills/sgsd-complete-milestone/SKILL.md:96-258 (Step 4.5/4.6/Step 6 wire-in templates)
    - .planning/milestones/v1.9/phases/41-baseline-token-attribution/41-REVIEW.md (BLOAT_THRESHOLDS 4-key trim lesson; do NOT re-introduce dead keys)
    - super-gsd/templates/command-envelope-v1.json (envelope-v1 contract; 13 required + additionalProperties:true)
---

<objective>
Phase 42 turns the Phase 41 truthful baseline into a governed admission gate.
Runs that trip a per-role budget either DEGRADE (continue with a flagged
status row) or REROUTE (emit a Phase 47 route_hint), but NEVER silently burn
tokens AND NEVER halt autonomy. Halt remains reserved for the four hard-stop
conditions in `SGSD-HANDOVER.md:79-86`.

Controlling principle (REQUIREMENTS.md:67-68 design lock 13):

> "Autonomy continues; evidence tells the truth. Budget breaches degrade or
> reroute by policy. They do not become silent overrun."

This is parallel to Phase 39 RUBRIC-03's "0 fires -> defer, never kill". The
mechanical embodiment of design lock 13 is self-test fixture F3: a row that
trips the BUDGET-03 cache+findings signature MUST emit envelope.status='warn'
(NOT 'blocked'), populate route_hint with `researcher_local_script_candidate`,
and the CLI MUST exit 0.

Purpose:
  - Land the canonical Phase 42 admission tool `super-gsd/tools/token-waste/check.cjs`
    that mirrors `gate-keep-kill/rubric.cjs` (Phase 39) architecturally and
    imports Phase 41 `summarize`, `BLOAT_THRESHOLDS`, `ROLES`, `STATUSES`,
    `PROVIDERS`, `ledgerPath` verbatim. NO new threshold values introduced
    for the bloat signature -- BUDGET-03 inherits Phase 41
    `BLOAT_THRESHOLDS.cache_read_ratio_high=0.90` and `useful_findings_low=15`.
  - Emit the 5-state verdict ladder {ok, warn, degraded, false_positive, error}.
    Lock 13 ban: NEVER emit envelope.status='blocked'; that status is reserved
    for downstream consumers with their own hard-stop semantics.
  - Land `budgets.yaml` with the sec 6.3 LOCKED per-role table (5/8 verbatim
    from BUDGET-02, 3/8 derived from live ledger P75/P90/P95). Malformed
    yaml -> graceful fallback to compiled-in BUDGETS const + reason_code
    `budgets_yaml_fallback`.
  - Wire into `sgsd-complete-milestone` Step 4.7 (mirror Step 4.5/4.6 verbatim
    shape) so milestone-close emits one envelope-v1 row to
    `.planning/metrics/token-waste-status.jsonl` and one rendered table to
    `.planning/milestones/{id}/token-waste.md`. Per-phase wire deferred to
    Phase 50 cockpit per RESEARCH sec 5 Q5 lock.
  - Emit Phase 47 forward contract: `route_hint` with `from_role`,
    `from_provider`, `to_provider_candidates`, `reason` (R1..R5 verbatim
    enum), `evidence_event_id`. Frozen so adding values requires explicit
    upstream extension.
  - Self-test 15/15: F1 ok, F2 warn, F3 degraded BINDING (lock 13
    regression), F4 false_positive + 11 secondary (frozen consts, override
    priority, malformed yaml, fingerprint, envelope-v1 schema, CLI exit
    codes, never-throws-upward).

Output:
  - `super-gsd/tools/token-waste/check.cjs` (NEW; ~600 LOC).
  - `super-gsd/tools/token-waste/budgets.yaml` (NEW; ~50 LOC).
  - `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (EDIT; +Step 4.7 +
    Step 6 sub).
  - `.planning/metrics/token-waste-status.jsonl` (NEW canonical; first row
    from live ledger).
  - `.planning/milestones/v1.9/token-waste.md` (NEW Step-4.7-generated).

This phase does NOT route. It governs the budget; the route_hint is a
forward contract for Phase 47 to consume. The CLI is informational ONLY --
it tells the truth about overrun without deciding what to do about it.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/ROADMAP.md
@.planning/milestones/v1.9/phases/42-token-budget-admission/42-CONTEXT.md
@.planning/milestones/v1.9/phases/42-token-budget-admission/42-RESEARCH.md
@super-gsd/tools/token-attribution/report.cjs
@super-gsd/tools/gate-keep-kill/rubric.cjs
@super-gsd/scripts/lib/gate-value-log.cjs
@super-gsd/scripts/lib/gates-registry.cjs
@super-gsd/skills/sgsd-complete-milestone/SKILL.md
@super-gsd/templates/command-envelope-v1.json
@.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-01-baseline-token-attribution-PLAN.md
@.planning/milestones/v1.9/phases/41-baseline-token-attribution/reviews/41-REVIEW.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from canonical files. -->
<!-- Use these directly. NO codebase exploration required. -->

From super-gsd/tools/token-attribution/report.cjs (Phase 41; UPSTREAM IMPORT):
```javascript
// Phase 42 imports these verbatim. Do NOT redefine.
const {
  summarize,         // (planningDir, opts) -> aggregations array
  BLOAT_THRESHOLDS,  // Object.freeze({ cache_read_ratio_high:0.90, useful_findings_low:15, files_read_high:50, diff_lines_low:100 })
  ROLES,             // Object.freeze(['researcher','planner','executor','verifier','reviewer','orchestrator','classifier','other'])
  STATUSES,          // Object.freeze(['ok','warn','fail','skipped','timeout','blocked'])
  PROVIDERS,         // Object.freeze(['claude','codex','local-script','vtp'])
  ledgerPath,        // (planningDir) -> path/to/agent-token-spend.jsonl
} = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));

// Phase 41 BLOAT_THRESHOLDS is the 4-key shape AFTER 41-REVIEW trim.
// Do NOT re-introduce researcher_input_max / planner_input_max /
// executor_input_max / verifier_input_max as bloat-signature keys --
// those are Phase 42 per-role budgets, not Phase 41 bloat keys.
```

From super-gsd/tools/gate-keep-kill/rubric.cjs (Phase 39; ARCHITECTURAL MIRROR):
```javascript
// Phase 42 mirrors this 1:1 for read-only check + closed-enum + renderTable.
const VERDICTS = Object.freeze(['keep', 'kill', 'defer']);  // Phase 42: 4-state {ok,warn,degraded,false_positive}
const REASONS = Object.freeze({ ... });                       // Phase 42: ROUTE_REASONS (5-state R1..R5)

// Public API shape Phase 42 mirrors:
//   runRubric(planningDir, opts) -> rows  ===> runCheck(planningDir, opts) -> result
//   renderTable(rows) -> markdown          ===> renderTable(result) -> markdown
//   classifyGate(...) -> verdict           ===> _classifyRow(row, budgets) -> { verdict, rules_tripped, route_hint? }
//                                          ADDED: appendCheckRun(planningDir, result) -> envelope-v1 row | false

// Failure contract (verbatim from rubric.cjs:1-15):
//   "this script NEVER throws upward at the orchestrator boundary"
// All public APIs wrap internals in try/catch; on error stderr-warn + return falsey.

// __dirname-anchored canonical guard pattern (rubric.cjs:128-134):
const realPath = path.resolve(__dirname, '..', '..', '..',
  '.planning', 'metrics', '<canonical-stream>.jsonl');
```

From super-gsd/scripts/lib/gate-value-log.cjs (Phase 36; envelope-v1 WRITER MIRROR):
```javascript
// Frozen const pattern Phase 42 mirrors (lines 64-111):
const STATUSES = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
const COMMAND_NAME     = 'logGateValue';     // -> 'checkTokenWaste' for Phase 42
const ENVELOPE_VERSION = 1;
const LEDGER_REL       = path.join('metrics', 'gate-value-log.jsonl');  // -> 'token-waste-status.jsonl'
const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

// __dirname-anchored canonical guard:
const realLedger = path.resolve(__dirname, '..', '..', '..',
  '.planning', 'metrics', 'token-waste-status.jsonl');

// _normalize + _assertEnvelopeV1 trio (gate-value-log.cjs:200-280):
function _normalize(row) { /* fill defaults; return enriched envelope-v1 row */ }
function _assertEnvelopeV1(row) {
  // 13 required fields + run_id pattern + status enum + duration_ms type
  // throws Error on violation (caught by public API try/catch)
}
function _appendRowInternal(planningDir, row) {
  if (!planningDir) throw new Error('token-waste: planningDir required');
  const enriched = _normalize(row);
  _assertEnvelopeV1(enriched);
  const p = path.join(planningDir, 'metrics', 'token-waste-status.jsonl');
  if (!fs.existsSync(path.dirname(p))) fs.mkdirSync(path.dirname(p), {recursive:true});
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}
```

From super-gsd/scripts/lib/gates-registry.cjs:38-44 (js-yaml load PATTERN):
```javascript
// Phase 42 budgets.yaml uses THIS load pattern verbatim. Do NOT add a
// new dep; reuse the pinned js-yaml at plan-schema/node_modules.
const yamlLibPath = path.resolve(
  __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
);
const yaml = require(yamlLibPath);
const raw    = fs.readFileSync(yamlPath, 'utf8');
const parsed = yaml.load(raw);

// Phase 42 wraps the entire load in try/catch (NOT like gates-registry which
// throws upward on poisoned config). Phase 42 NEVER throws upward; falls
// back to compiled BUDGETS + reason_code 'budgets_yaml_fallback' on any
// load/parse failure. Lock 13 binds.
```

From super-gsd/skills/sgsd-complete-milestone/SKILL.md:96-172 (Step 4.5+4.6 wire-in TEMPLATE):
```javascript
// Phase 42 Step 4.7 mirrors this verbatim. Anchor planningDir to
// process.cwd() at the orchestrator-skill boundary explicitly (Phase 32 W3 +
// Phase 36 W2 + Phase 39 W3 lessons: NEVER bare relative '.planning').
const path = require('path');
const fs   = require('fs');
const { runCheck, renderTable } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'token-waste', 'check.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const result = runCheck(planningDir, { milestone: '{{version}}' });
fs.writeFileSync(
  path.join(planningDir, 'milestones', '{{version}}', 'token-waste.md'),
  '# Token Waste (milestone {{version}})\n\n' +
  '> Soft-warn / degraded only. Per design lock 13.\n' +
  '> Autonomy continues; evidence tells the truth.\n\n' +
  renderTable(result) + '\n', 'utf8');
```

From super-gsd/templates/command-envelope-v1.json (CONTRACT; 13 REQUIRED FIELDS):
```
envelope_version: 1                       # const
ts:               ISO-8601 string
command:          "checkTokenWaste"       # discriminator (NEW for Phase 42)
status:           ok|warn|fail|skipped|timeout|blocked  (Phase 42 NEVER emits 'blocked')
reason_codes:     string[]                # closed vocab; see Reason Codes table below
artifacts:        [{kind, path}]          # writes target token-waste.md when applicable
evidence:         [{kind, ref}]           # rows cited (kind='agent_token_spend_row', ref='attribution:agent:...')
next_action:      string|null             # populated when verdict='degraded'
risk:             low|medium|high|null    # medium for warn, high for degraded, null for ok
duration_ms:      integer|null  (>= 0)
run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex)
phase:            string|null
milestone:        string|null
# Phase 42 extension fields (additionalProperties:true allows without schema bump):
scope:            { milestone, phase, role }
verdict:          ok|warn|degraded|false_positive
totals:           { rows_evaluated, ok, warn, degraded, false_positive }
rules_tripped:    { <rule_name>: <count> }
route_hints:      [{ from_role, reason, count }]
```

From RESEARCH sec 6.3 (LOCKED budget table):
```
| Role         | warn_input | degrade_input | source                 |
|--------------|-----------:|--------------:|------------------------|
| researcher   |     25,000 |        25,000 | BUDGET-02 verbatim     |
| planner      |     30,000 |        30,000 | BUDGET-02 verbatim     |
| executor     |     40,000 |        40,000 | BUDGET-02 verbatim     |
| verifier     |     20,000 |        20,000 | BUDGET-02 verbatim     |
| reviewer     |     20,000 |        20,000 | BUDGET-02 verbatim     |
| orchestrator |    200,000 |       750,000 | derived (P50/P75/P90)  |
| classifier   |     15,000 |        15,000 | derived (P95)          |
| other        |     25,000 |        50,000 | derived (P75/P90)      |
```
Input = `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.
Output is NOT budgeted.

From RESEARCH sec 4.4 (LOCKED verdict matrix):
```
| input over warn | cache_read>0.90 | useful_findings<15 | verdict   |
|:---------------:|:---------------:|:------------------:|-----------|
| no              | no              | no                 | ok        |
| no              | yes             | no                 | ok (productive) |
| no              | yes             | yes                | warn (low-yield small call) |
| yes             | no              | any                | warn (overrun, no bloat sig) |
| yes             | yes             | no                 | warn (overrun, findings exist) |
| yes             | yes             | yes                | DEGRADED (BUDGET-03 trip) |
| input over degrade | any          | any                | DEGRADED (hard ceiling) |
```

From RESEARCH sec 6.5 (budgets.yaml schema):
```yaml
schema_version: 1
roles:
  researcher:   { warn_input: 25000,  degrade_input: 25000 }
  planner:      { warn_input: 30000,  degrade_input: 30000 }
  executor:     { warn_input: 40000,  degrade_input: 40000 }
  verifier:     { warn_input: 20000,  degrade_input: 20000 }
  reviewer:     { warn_input: 20000,  degrade_input: 20000 }
  orchestrator: { warn_input: 200000, degrade_input: 750000 }
  classifier:   { warn_input: 15000,  degrade_input: 15000 }
  other:        { warn_input: 25000,  degrade_input: 50000 }
bloat_signature:
  cache_read_ratio_high: 0.90    # MUST equal Phase 41 BLOAT_THRESHOLDS.cache_read_ratio_high
  useful_findings_low:   15      # MUST equal Phase 41 BLOAT_THRESHOLDS.useful_findings_low
overrides:
  - role: researcher
    milestone: v1.9
    phase: "51"
    exempt_via: vtp_research_route
    reason: "Benchmark researcher legitimately uses VTP corpus"
hard_stops_unchanged: true  # reference only; Phase 42 NEVER expands hard stops
```

From RESEARCH sec 5.2 (Phase 47 forward CONTRACT; route_hint shape):
```typescript
interface RouteHint {
  from_role: 'researcher'|'planner'|'executor'|'verifier'|'reviewer'|'orchestrator'|'classifier'|'other';
  from_provider: 'claude'|'codex'|'local-script'|'vtp';
  to_provider_candidates: Array<'claude'|'codex'|'local-script'|'vtp'>;
  reason: 'researcher_local_script_candidate'
        | 'codex_reviewer_fallback_candidate'
        | 'executor_context_packet_candidate'
        | 'verifier_goal_backward_candidate'
        | 'orchestrator_turn_trim_candidate';
  evidence_event_id: string;  // agent-token-spend row's source_event_id
}
```

From RESEARCH sec 5.5 (envelope-v1 status row sample shape):
```json
{
  "envelope_version": 1,
  "ts": "2026-04-27T18:00:00.000Z",
  "command": "checkTokenWaste",
  "status": "warn",
  "reason_codes": ["researcher_input_over_budget", "cache_read_high"],
  "artifacts": [{"kind":"verdict_md","path":".planning/milestones/v1.9/token-waste.md"}],
  "evidence": [{"kind":"agent_token_spend_row","ref":"attribution:agent:..."}],
  "next_action": "Consider local-script substitution",
  "risk": "medium",
  "duration_ms": 320,
  "run_id": "2026-04-27T18:00:00.000Z-1234",
  "phase": "42",
  "milestone": "v1.9",
  "scope": {"milestone":"v1.9","phase":null,"role":null},
  "verdict": "warn",
  "totals": {"rows_evaluated":11295,"ok":11144,"warn":100,"degraded":50,"false_positive":1},
  "rules_tripped": {"researcher_input_over_budget":12,"orchestrator_turn_trim":6710},
  "route_hints": [{"from_role":"orchestrator","reason":"orchestrator_turn_trim_candidate","count":6710}]
}
```

From .planning/metrics/agent-token-spend.jsonl (PRIMARY input; row schema):
```jsonl
{
  "envelope_version":1,"ts":"...","command":"logTokenSpend","status":"ok",
  "reason_codes":["..."],"artifacts":[],"evidence":[{"kind":"agent_token_spend_source","ref":"attribution:agent:..."}],
  "next_action":null,"risk":null,"duration_ms":N,"run_id":"...",
  "phase":"36","milestone":"v1.8",
  "role":"researcher","provider":"claude",
  "token_breakdown":{
    "input_tokens": 1234,
    "cache_read_input_tokens": 121000,
    "cache_creation_input_tokens": 50000,
    "output_tokens": 800,
    "total_tokens": 173034,
    "tool_stats":{"linesAdded": 12, "editFileCount": 0, "searchCount": 5, ...},
    "useful_findings": 12,           // proxy from tool_stats.linesAdded etc.
    "tokens_estimated": false,
    "source_event_id":"agent:abcd...:efgh...",
    "source_stream":"token-attribution.jsonl"
  }
}
```

Phase 42 derives:
  - input_total = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
  - cache_read_ratio = cache_read_input_tokens / max(1, input_total)
  - useful_findings = token_breakdown.useful_findings
  - source_event_id = token_breakdown.source_event_id (used as evidence_event_id in route_hint)
</interfaces>

<reason_codes>
<!-- Closed initial vocabulary added by Phase 42. envelope-v1 reason_codes -->
<!-- field MUST contain at least one of these (or be empty for ok rows). -->

Per-row classification reasons (added to result row's `reasons` array):
- `researcher_input_over_budget` -- researcher row exceeded warn_input
- `planner_input_over_budget`
- `executor_input_over_budget`
- `verifier_input_over_budget`
- `reviewer_input_over_budget`
- `orchestrator_input_over_warn`         -- (200k <= input < 750k)
- `orchestrator_input_over_degrade`      -- (input >= 750k)
- `classifier_input_over_budget`
- `other_input_over_warn`
- `other_input_over_degrade`
- `cache_read_high`                      -- cache_read_ratio > 0.90
- `useful_findings_low`                  -- useful_findings < 15
- `bloat_signature_tripped`              -- BUDGET-03 trip (input over warn AND cache high AND findings low)

Per-row override reasons (false_positive):
- `budget_check_false_positive`          -- generic marker for any false_positive
- `vtp_research_route`                   -- BUDGET-02 "unless VTP" carve-out
- `high_risk_code_phase`                 -- BUDGET-02 "unless high-risk" carve-out
- `full_review_tier`                     -- BUDGET-02 "unless full-review" carve-out

Per-run reasons (added to envelope row's reason_codes):
- `token_waste_check_passed`             -- all rows ok
- `token_waste_warn_present`             -- at least one warn row, no degraded
- `token_waste_degraded_present`         -- at least one degraded row (envelope.status='warn' NOT 'blocked')
- `budgets_yaml_fallback`                -- yaml load/parse failed; compiled BUDGETS used
- `empty_ledger`                         -- agent-token-spend.jsonl absent or empty

Self-test/error reasons:
- `self_test_pass`                       -- --self-test exit 0
- `bad_invocation`                       -- CLI argv malformed (only path to non-zero exit)
</reason_codes>

<known_dead_ends>
<!-- HARD FENCES. Do NOT cross. Tasks that violate these are auto-FAIL. -->

1. Do NOT re-introduce dead BLOAT_THRESHOLDS keys. The Phase 41 review
   (`41-REVIEW.md` MEDIUM finding, commit `ef90751`) trimmed
   BLOAT_THRESHOLDS from 8 keys to 4 keys. The 4 surviving keys are:
   `cache_read_ratio_high:0.90`, `useful_findings_low:15`,
   `files_read_high:50`, `diff_lines_low:100`. Phase 42 IMPORTS this 4-key
   const by reference; Phase 42's `BUDGETS` is a SEPARATE per-role budget
   const that lives in `check.cjs`. Adding `researcher_input_max:25000`
   etc. to Phase 41's BLOAT_THRESHOLDS is an auto-FAIL because Phase 41's
   self-test asserts the 4-key shape (assertion 4 post-fix). Adding them
   to Phase 42's BUDGETS is fine but use the per-role nested shape
   `{ researcher: { warn_input: 25000, degrade_input: 25000 }, ... }`.

2. Do NOT add `blocked` to VERDICTS. The 4-state Phase 42 ladder is
   {ok, warn, degraded, false_positive}. `error` is a CLI-internal handler
   path (try/catch fallthrough), NOT a verdict on a row. Adding `blocked`
   would break design lock 13's autonomy contract: the operator could not
   tell from the verdict alone whether the gate is informational or
   halt-style. Self-test assertion 5 binds the 4-entry shape; F3 fixture
   binds the lock-13 mechanical embodiment (envelope.status='warn' on
   degraded verdict).

3. Do NOT exit non-zero on `degraded` or `warn`. The CLI is informational.
   The ONLY path to a non-zero exit is malformed invocation (unknown flag,
   missing required argument value, conflicting flags). Self-test
   assertion 14 binds: --self-test pass=0; runCheck all-ok=0; runCheck
   degraded=0 (NOT 1); malformed budgets.yaml=0 (graceful fallback);
   bad invocation=2. Phase 36 CRIT regression class: a check that exits
   non-zero on degraded poisons every milestone-close skill in shell-and
   chains.

4. Do NOT write to ANY of the 5 canonical token streams. Phase 42 is
   READ-ONLY against:
     - .planning/metrics/agent-token-spend.jsonl    (Phase 41 owner)
     - .planning/metrics/token-attribution.jsonl    (collect.cjs owner)
     - .planning/metrics/codex-log.jsonl            (codex-exec.sh owner)
     - .planning/metrics/token-log.jsonl            (legacy SGSD owner)
     - .planning/metrics/activity-log.jsonl         (runtime activity owner)
   AND read-only against budgets.yaml (config; never written).
   The ONLY write targets are:
     - .planning/metrics/token-waste-status.jsonl   (Phase 42 OWNED; append-only)
     - .planning/milestones/{id}/token-waste.md     (Phase 42 OWNED; overwrite-per-run)
   Self-test assertion 11 fingerprints all 6 input paths + 1 owned output
   path before any setup; reasserts byte-identical AFTER cleanup.
   Violation FAILS the self-test.

5. Do NOT couple to Phase 47 prematurely. Phase 42 EMITS a route_hint
   (the forward contract) but MUST NOT import or invoke Phase 47 modules.
   No `require('../route-decisions/...')`, no
   `require('../../scripts/lib/route-ledger.cjs')`. The route_hint shape
   is documented in `<interfaces>` and frozen via `ROUTE_REASONS`. Phase 47
   will later read these hints from token-waste-status.jsonl and act on
   them; Phase 42 SAYS but does not DO.

6. Do NOT proliferate docs. The README pointer in Phase 42 is the ONLY
   new doc surface. Specifically, Phase 42 MUST NOT create:
     - super-gsd/tools/token-waste/README.md
     - .planning/milestones/v1.9/phases/42-token-budget-admission/{anything beyond CONTEXT/RESEARCH/PLAN/SUMMARY}
     - super-gsd/docs/token-waste.md
   The runtime `token-waste.md` artifact at milestone close is sufficient
   evidence; the rendered table embeds the rules + budgets + offenders
   inline. Phase 41 EXISTING-SURFACE-AUDIT.md:124-144 explicitly forbids
   doc proliferation.

7. Do NOT introduce ANY new dependencies beyond the pinned js-yaml that
   gates-registry.cjs already loads from
   `super-gsd/tools/plan-schema/node_modules/js-yaml`. Node built-ins
   ONLY: `fs`, `path`, `os`, `crypto`. Markdown rendering is a manual
   string-template (Phase 36 + Phase 39 + Phase 41 pattern); NO marked /
   showdown / handlebars / template engine of ANY kind. The lib MUST load
   in <50ms cold (mirror property preserved from Phase 41).

8. Do NOT use `process.cwd()` for the canonical-path default. Phase 32 W3
   + Phase 36 W2 + Phase 39 W3 lessons: ALWAYS anchor `realLedger` to
   `__dirname` and walk up 3 directories to `.planning`. CLI invocations
   from non-root dirs silently corrupt the wrong ledger when this lock is
   broken. The SKILL.md wire-in (`process.cwd()` at orchestrator-skill
   boundary) is the EXCEPTION at the boundary; INSIDE the lib,
   `__dirname` is the ONLY anchor.

9. ASCII ONLY. Phase 39 W4 lesson: every non-ASCII char in canonical
   tooling has caused at least one downstream encoding bug. Use `--`
   not em-dashes. Use `->` not arrows. Use `>=` not the unicode glyph.
   Use straight quotes. The lib MUST be byte-identical when round-tripped
   through ASCII normalization. The `token-waste.md` artifact MUST also
   be ASCII-only (check via Node `charCodeAt > 127` scan in the
   verification block).

10. Do NOT split the lib across multiple files. The 3 public APIs
    (runCheck, renderTable, appendCheckRun) + 5 frozen consts (VERDICTS,
    ROUTE_REASONS, BUDGETS, COMMAND_NAME, ENVELOPE_VERSION) are ONE file
    by RESEARCH sec 6.1 lock. Future Phase 50 cockpit MAY later import
    selectively without breaking change. Phase 42 keeps everything in
    `super-gsd/tools/token-waste/check.cjs`.

11. Do NOT throw upward at the orchestrator boundary from public APIs.
    runCheck, renderTable, appendCheckRun MUST wrap internals in
    try/catch; on error stderr-warn + return falsey sentinel
    (`runCheck: { verdict: 'error', totals: {}, rules_tripped: {}, route_hints: [], error: <msg> }`;
    `renderTable: '(token-waste render error)'`;
    `appendCheckRun: false`). Self-test assertion 15 binds.

12. Do NOT ship without all 15 self-test assertions PASSING. Self-test
    is the proof-of-correctness gate. Mirror Phase 36 + Phase 39 + Phase
    41 pattern verbatim. 14/15 PASS = phase FAIL. F3 (degraded fixture)
    is the BINDING lock-13 regression test; F3 PASS is non-negotiable.

13. Do NOT change the milestone-close skill ordering. Step 4.7 is placed
    AFTER Step 4.6 (phase-folder-audit, the most-recent soft-warn step)
    and BEFORE Step 5 (cross-phase check). Renumbering Step 4.5 or 4.6
    breaks Phase 39 / Phase 40 wire-ins. The Step 6 SUMMARY.md subsection
    is placed AFTER the existing "Phase Folder Audit" subsection and
    BEFORE the existing "Connections" subsection.

14. Do NOT modify any of the 4 existing contracts:
    - code-reviewer-v1
    - review-providers-v1
    - handover-contract-v2
    - plan-schema-v2
    Phase 31 reconciliation note `does_not_touch` enforces this.
    Phase 42 rides on envelope-v1 `additionalProperties:true` for the 4
    extension fields (scope, verdict, totals, rules_tripped, route_hints
    -- 5 ext fields total) without any schema bump.

15. Do NOT estimate BUDGETS values from this PLAN. The sec 6.3 LOCKED table
    is the source of truth. 5/8 roles are BUDGET-02 verbatim; 3/8
    (orchestrator, classifier, other) are derived from the live 11,295-
    row ledger P75/P90/P95 at research time and MUST equal the values
    in `<interfaces>` BUDGETS table above. Tweaking the budget values
    AT IMPLEMENTATION TIME is an auto-FAIL; if observed evidence
    suggests refinement, that work belongs to Phase 51 benchmark
    (BENCH-04) which validates the >=50% reduction acceptance.
</known_dead_ends>

<tasks>

<task type="auto" tdd="true">
  <name>Task T1: Build check.cjs lib + budgets.yaml + 15-assertion self-test (RED-GREEN)</name>
  <files>super-gsd/tools/token-waste/check.cjs, super-gsd/tools/token-waste/budgets.yaml</files>
  <behavior>
    The lib MUST satisfy these behaviors. The 15 self-test assertions
    describe these behaviors before implementation lands; implementation
    passes when --self-test exits 0 with 15 pass / 0 fail.

    BEHAVIOR 1: Frozen const enums (RESEARCH sec 6.2)
      - VERDICTS = Object.freeze(['ok','warn','degraded','false_positive'])
      - ROUTE_REASONS = Object.freeze({
          R1: 'researcher_local_script_candidate',
          R2: 'codex_reviewer_fallback_candidate',
          R3: 'executor_context_packet_candidate',
          R4: 'verifier_goal_backward_candidate',
          R5: 'orchestrator_turn_trim_candidate',
        })
      - BUDGETS = Object.freeze({
          researcher:   Object.freeze({ warn_input: 25000,  degrade_input: 25000 }),
          planner:      Object.freeze({ warn_input: 30000,  degrade_input: 30000 }),
          executor:     Object.freeze({ warn_input: 40000,  degrade_input: 40000 }),
          verifier:     Object.freeze({ warn_input: 20000,  degrade_input: 20000 }),
          reviewer:     Object.freeze({ warn_input: 20000,  degrade_input: 20000 }),
          orchestrator: Object.freeze({ warn_input: 200000, degrade_input: 750000 }),
          classifier:   Object.freeze({ warn_input: 15000,  degrade_input: 15000 }),
          other:        Object.freeze({ warn_input: 25000,  degrade_input: 50000 }),
        })
      - COMMAND_NAME = 'checkTokenWaste'
      - ENVELOPE_VERSION = 1
      - LEDGER_REL = path.join('metrics', 'token-waste-status.jsonl')
      - All frozen; mutation attempts MUST fail silently in non-strict
        or throw in strict (assertion 5 confirms via
        `try{VERDICTS.push('blocked')}catch{}` then asserts length=4 unchanged).
      - Phase 41 imports: { summarize, BLOAT_THRESHOLDS, ROLES, STATUSES,
        PROVIDERS, ledgerPath } -- by reference, NOT redefined.

    BEHAVIOR 2: _loadBudgets(planningDir, opts) -> { roles, bloat_signature, overrides, source }
      - Default path: __dirname-anchored
        `super-gsd/tools/token-waste/budgets.yaml` (1 dir up from this lib
        already there, since check.cjs sits in tools/token-waste/, the yaml
        sits beside it).
      - Override path: opts.budgetsYamlPath.
      - Loads via pinned js-yaml at
        `super-gsd/tools/plan-schema/node_modules/js-yaml` (mirrors
        gates-registry.cjs:38-44).
      - Fallback chain (NEVER throws upward):
          a) yaml file absent -> log stderr "budgets.yaml absent; using compiled defaults"; return { roles: BUDGETS, bloat_signature: BLOAT_THRESHOLDS-derived, overrides: [], source: 'compiled' }
          b) yaml parse fail -> log stderr; return same compiled fallback; tag source: 'compiled_yaml_parse_error'
          c) yaml schema invalid (missing roles key, wrong shape) -> same compiled fallback; tag source: 'compiled_yaml_schema_invalid'
          d) yaml ok -> return { roles, bloat_signature, overrides, source: 'yaml' }
      - When source !== 'yaml', the EVENTUAL envelope row MUST include
        reason_code 'budgets_yaml_fallback' (added in BEHAVIOR 6
        appendCheckRun).
      - Schema check: roles MUST contain all 8 keys from ROLES enum;
        each role MUST have warn_input + degrade_input as positive
        numbers. Invalid -> fallback.
      - bloat_signature MUST satisfy:
        cache_read_ratio_high === BLOAT_THRESHOLDS.cache_read_ratio_high (0.90)
        useful_findings_low   === BLOAT_THRESHOLDS.useful_findings_low (15)
        Drift -> fallback (drift assertion 7).

    BEHAVIOR 3: _classifyRow(row, budgets) -> { verdict, reasons, rules_tripped, route_hint? }
      - Inputs:
        * row: an envelope-v1 agent-token-spend row with role + token_breakdown
        * budgets: { roles, bloat_signature, overrides } from _loadBudgets
      - Compute:
        * input_total = (token_breakdown.input_tokens || 0)
                      + (token_breakdown.cache_read_input_tokens || 0)
                      + (token_breakdown.cache_creation_input_tokens || 0)
        * cache_read_ratio = input_total > 0
                           ? (token_breakdown.cache_read_input_tokens || 0) / input_total
                           : 0
        * useful_findings = Number(token_breakdown.useful_findings) || 0
        * roleBudget = budgets.roles[row.role] || budgets.roles['other']
      - Override check FIRST (false_positive short-circuit):
        * Match priority: role+milestone+phase > role+milestone > role.
        * Override match -> { verdict: 'false_positive',
            reasons: ['budget_check_false_positive', override.exempt_via],
            rules_tripped: [],
            route_hint: undefined }
        * row.reason_codes containing one of {'vtp_research_route',
          'high_risk_code_phase','full_review_tier'} -> same false_positive
          treatment with the matched reason added.
      - Verdict matrix (RESEARCH sec 4.4) IF NOT false_positive:
        * over_warn    = input_total >= roleBudget.warn_input
        * over_degrade = input_total >= roleBudget.degrade_input
        * cache_high   = cache_read_ratio > budgets.bloat_signature.cache_read_ratio_high
        * findings_low = useful_findings < budgets.bloat_signature.useful_findings_low
        * if over_degrade -> verdict: 'degraded'  (hard ceiling row in matrix)
        * else if over_warn AND cache_high AND findings_low -> verdict: 'degraded'  (BUDGET-03 trip)
        * else if over_warn -> verdict: 'warn'
        * else if cache_high AND findings_low -> verdict: 'warn'  (low-yield small call)
        * else -> verdict: 'ok'
      - Reasons array (closed vocab from <reason_codes>):
        * over_warn (NOT over_degrade) -> "{role}_input_over_budget" or for
          orchestrator/other: "{role}_input_over_warn"
        * over_degrade -> "{role}_input_over_degrade" (orchestrator/other) or
          "{role}_input_over_budget" (single-threshold roles)
        * cache_high  -> "cache_read_high"
        * findings_low -> "useful_findings_low"
        * over_warn AND cache_high AND findings_low -> ALSO append "bloat_signature_tripped"
      - rules_tripped: array of rule ids from the closed enum:
        * 'researcher_input_over_budget'
        * 'planner_input_over_budget'
        * ...
        * 'orchestrator_turn_trim'   (when role==='orchestrator' AND verdict in {warn,degraded})
        * 'researcher_local_script' (when role==='researcher' AND verdict in {warn,degraded} AND cache_high AND findings_low)
        * 'codex_reviewer_fallback' (when role==='reviewer' AND verdict in {warn,degraded})
        * 'executor_context_packet' (when role==='executor' AND verdict in {warn,degraded})
        * 'verifier_goal_backward'  (when role==='verifier' AND verdict in {warn,degraded})
      - route_hint emitted ONLY when verdict in {'warn','degraded'} AND
        the row matches one of the R1..R5 rules:
        * R1: role==='researcher' AND cache_high AND findings_low ->
            { from_role:'researcher', from_provider: row.provider,
              to_provider_candidates:['local-script','codex','vtp'],
              reason:'researcher_local_script_candidate',
              evidence_event_id: row.token_breakdown.source_event_id || null }
        * R2: role==='reviewer' (ANY warn or degraded) ->
            reason:'codex_reviewer_fallback_candidate',
            to_provider_candidates: ['codex']
        * R3: role==='executor' (ANY warn or degraded with cache_high) ->
            reason:'executor_context_packet_candidate',
            to_provider_candidates: ['claude','local-script']  (context packet, same provider)
        * R4: role==='verifier' (ANY warn or degraded) ->
            reason:'verifier_goal_backward_candidate',
            to_provider_candidates: ['claude','local-script']
        * R5: role==='orchestrator' (ANY warn or degraded) ->
            reason:'orchestrator_turn_trim_candidate',
            to_provider_candidates: ['claude']  (same provider, smaller turns)
      - Priority order when multiple rules trip: R1 > R2 > R3 > R4 > R5;
        first-tripped rule populates route_hint.reason; full list goes
        into rules_tripped.
      - degraded over_degrade hard ceiling without bloat signature:
        * No specific Phase 41 R-rule fires; route_hint reason defaults
          to the role-specific default: orchestrator->R5, researcher->R1,
          reviewer->R2, executor->R3, verifier->R4, others -> none.

    BEHAVIOR 4: Override matcher (priority chain)
      - For each override row in budgets.overrides:
        * role+milestone+phase match (all 3 specified+equal) -> match
        * role+milestone match (phase absent or '*') -> match
        * role match alone (milestone absent or '*') -> match
        * No match -> next override
      - First match wins. Higher specificity outranks lower:
        if budgets.overrides has [{role:r}, {role:r, milestone:m},
        {role:r, milestone:m, phase:p}], the most specific one matches.
      - In implementation: sort overrides by specificity descending
        (3-key > 2-key > 1-key) then linear-scan.

    BEHAVIOR 5: runCheck(planningDir, opts) -> { scope, verdict, totals,
                                                rules_tripped, route_hints,
                                                top_offenders, error? }
      - opts: { milestone?, phase?, role?, budgetsYamlPath? }
      - Read rows via DEFENSIVE _readSpendRows (mirrors Phase 41 _readRows
        at report.cjs:291-311; ~20 lines, private to this file -- do
        NOT tempt Phase 41 to expose internals per RESEARCH sec 5.1).
      - Filter: row.role in ROLES, row.milestone===opts.milestone (if
        provided), row.phase===String(opts.phase) (if provided),
        row.role===opts.role (if provided).
      - Empty/no-rows -> return { scope: opts, verdict: 'ok',
          totals: { rows_evaluated: 0, ok: 0, warn: 0, degraded: 0,
                    false_positive: 0 },
          rules_tripped: {}, route_hints: [], top_offenders: [] }
        with reason_code 'empty_ledger' added at appendCheckRun stage.
      - Otherwise: load budgets via _loadBudgets; classify each row;
        accumulate totals; aggregate rules_tripped (closed-vocab rule
        name -> count); aggregate route_hints (group by from_role+reason
        with count).
      - Top offenders: 10 rows sorted by input_total descending; only
        rows with verdict !== 'ok'.
      - Aggregate verdict (the run-level verdict from the totals):
        * any degraded > 0 -> 'degraded'
        * else any warn > 0 -> 'warn'
        * else 'ok'
      - NEVER throws upward. Top-level try/catch returns
        { verdict: 'error', totals: {}, rules_tripped: {}, route_hints: [],
          top_offenders: [], error: e.message }.

    BEHAVIOR 6: appendCheckRun(planningDir, result) -> envelope-v1 row | false
      - Build envelope-v1 row:
        * envelope_version: 1
        * ts: new Date().toISOString()
        * command: 'checkTokenWaste'
        * status:
            result.verdict==='ok'         -> 'ok'
            result.verdict==='warn'       -> 'warn'
            result.verdict==='degraded'   -> 'warn'   (LOCK 13 BINDING; NEVER 'blocked')
            result.verdict==='false_positive' -> 'skipped'  (only at run-level if all rows fp)
            result.verdict==='error'      -> 'fail'
        * reason_codes: assemble from result + load:
            - if result.verdict==='ok' -> ['token_waste_check_passed']
            - if result.verdict==='warn' -> ['token_waste_warn_present']
            - if result.verdict==='degraded' -> ['token_waste_degraded_present']
            - if budgets.source !== 'yaml' -> ALSO 'budgets_yaml_fallback'
            - if result.totals.rows_evaluated === 0 -> ALSO 'empty_ledger'
            - if --self-test mode -> ['self_test_pass']
        * artifacts: when token-waste.md was written this run,
            [{kind:'verdict_md', path:'.planning/milestones/{ms}/token-waste.md'}]
            (relative to repo root)
        * evidence: top 3 offender rows as
            [{kind:'agent_token_spend_row', ref:'attribution:agent:<id>'},...]
        * next_action:
            ok        -> null
            warn      -> "Review top offenders in token-waste.md"
            degraded  -> "Consider local-script substitution; see route_hints"
            error     -> "Inspect token-waste-status.jsonl error reason"
        * risk:
            ok -> null, warn -> 'medium', degraded -> 'high',
            false_positive -> null, error -> 'medium'
        * duration_ms: caller-supplied or computed from start time
        * run_id: generateRunId() ISO + 4hex (mirror Phase 36/41)
        * phase: result.scope.phase || null
        * milestone: result.scope.milestone || null
        * scope: result.scope (Phase 42 ext)
        * verdict: result.verdict (Phase 42 ext; differs from envelope.status)
        * totals: result.totals (Phase 42 ext)
        * rules_tripped: result.rules_tripped (Phase 42 ext)
        * route_hints: result.route_hints (Phase 42 ext)
      - Validate via _normalize + _assertEnvelopeV1.
      - Atomic append via fs.appendFileSync to
        path.join(planningDir, 'metrics', 'token-waste-status.jsonl').
      - NEVER throws upward.

    BEHAVIOR 7: renderTable(result) -> markdown string
      - 4 sections: Verdict Counts | Rules Tripped | Route Hints | Top Offenders.
      - Section 1 (Verdict Counts):
        | Verdict        | Count | %      |
        | ok             | N     | NN.N%  |
        | warn           | N     | NN.N%  |
        | degraded       | N     | NN.N%  |
        | false_positive | N     | NN.N%  |
      - Section 2 (Rules Tripped): rule_name | count, sorted desc by count.
      - Section 3 (Route Hints): from_role | reason | count, sorted desc.
      - Section 4 (Top Offenders): role | phase | total | cache % |
        findings | verdict, capped at 10 rows.
      - Header line: '## Token Waste (milestone {ms}, scope {phase or all})'.
      - Footer line: '> Per design lock 13: degraded continues; halt
        reserved for SGSD-HANDOVER hard stops.'
      - Empty result -> '(no rows evaluated; agent-token-spend.jsonl
        absent or empty)'.
      - NEVER throws upward; on error return '(token-waste render error)'.

    BEHAVIOR 8: CLI argv (run as `node check.cjs ...`)
      - --self-test                 : run 15-assertion self-test; exit 0/1
      - --check                     : run runCheck + appendCheckRun + write token-waste.md (when scope is milestone-level); exit 0 always (unless bad invocation)
      - --milestone <id>            : scope filter
      - --phase <id>                : scope filter
      - --role <id>                 : scope filter
      - --budgets-yaml <path>       : override default budgets.yaml path
      - --planning-dir <path>       : override default __dirname-anchored .planning
      - --json                      : print runCheck result as JSON to stdout (instead of summary)
      - --help                      : print usage; exit 0
      - Unknown flag / missing required arg / both --self-test and --check : exit 2 (bad_invocation)

    BEHAVIOR 9: __dirname-anchored fingerprint guard
      - 6 input paths + 1 owned output path resolved via
        path.resolve(__dirname,'..','..','..','.planning','metrics',<file>)
        for the 5 token streams + 1 owned status stream; budgets.yaml
        resolves via path.resolve(__dirname,'budgets.yaml').
      - Self-test 11 captures {exists, mtimeMs, size} for all 7 paths
        BEFORE setup; reasserts byte-identical AFTER cleanup.

    BEHAVIOR 10: 15 self-test assertions (RESEARCH sec 7)
      Fixtures (4 named):
        F1 normal:           role=researcher, input_total=20000,
                             cache_read_input=16000 (80%), useful_findings=50.
                             Expected: verdict='ok'; no route_hint;
                             envelope.status='ok' on aggregate.
        F2 warning:          role=researcher, input_total=28000,
                             cache_read_input=23520 (84%), useful_findings=50.
                             Expected: verdict='warn';
                             reasons=['researcher_input_over_budget'];
                             rules_tripped includes 'researcher_input_over_budget';
                             NO route_hint (cache not >0.90).
        F3 degraded BINDING: role=researcher, input_total=30000,
                             cache_read_input=29700 (99%), useful_findings=5,
                             token_breakdown.source_event_id='agent:54c3e039-test:a4b4b87c19222f2aa'.
                             Expected: verdict='degraded';
                             reasons includes 'researcher_input_over_budget' + 'cache_read_high' + 'useful_findings_low' + 'bloat_signature_tripped';
                             rules_tripped includes 'researcher_local_script';
                             route_hint.reason==='researcher_local_script_candidate';
                             route_hint.evidence_event_id matches source_event_id;
                             AGGREGATE envelope.status==='warn' (NOT 'blocked');
                             AGGREGATE envelope.verdict==='degraded'.
        F4 false_positive:   role=researcher, milestone=v1.9, phase=51,
                             input_total=60000, cache_read_input=51600 (86%),
                             useful_findings=100,
                             reason_codes=['vtp_research_route'].
                             override row: { role:'researcher', milestone:'v1.9',
                             phase:'51', exempt_via:'vtp_research_route' }.
                             Expected: verdict='false_positive';
                             reasons=['budget_check_false_positive','vtp_research_route'];
                             AGGREGATE envelope.status===
                               (only-fp -> 'skipped'; mixed -> by next-highest);
                             reason_codes includes 'budget_check_false_positive'.
      Secondary assertions (11):
        5.  VERDICTS frozen 4-entry: ok, warn, degraded, false_positive.
            Mutation `try{VERDICTS.push('blocked')}catch{}` -> length===4.
        6.  ROUTE_REASONS frozen 5-entry: R1..R5 names verbatim from
            RESEARCH sec 6.2 / Phase 41 sec 5 R-rules.
        7.  budgets.bloat_signature.cache_read_ratio_high ===
            BLOAT_THRESHOLDS.cache_read_ratio_high (0.90), AND
            budgets.bloat_signature.useful_findings_low ===
            BLOAT_THRESHOLDS.useful_findings_low (15) -- by reference,
            NOT copied.
        8.  Empty ledger (--self-test seeds tmpdir; no agent-token-spend.jsonl)
            -> runCheck returns verdict='ok', totals.rows_evaluated===0,
            no failure, no rows written.
        9.  Malformed budgets.yaml (write `{not yaml: } ::]]`) -> graceful
            fallback; reason_code 'budgets_yaml_fallback' present in
            envelope row; default BUDGETS used; no throw.
        10. Override match priority: 3-key (role+milestone+phase) outranks
            2-key (role+milestone) outranks 1-key (role). Test fixture
            with all three override forms set; verifies the correct one
            matches.
        11. Canonical-stream fingerprint guard: 6 inputs (5 streams +
            budgets.yaml) + 1 owned output (token-waste-status.jsonl in
            real .planning) untouched during --self-test (tmpdir-only
            writes verified via fingerprint capture/recheck).
        12. 1000-row synthetic ledger -> deterministic verdict counts:
            seed 500 ok rows + 300 warn rows + 195 degraded rows + 5 fp
            rows; runCheck returns
            totals === {rows_evaluated:1000, ok:500, warn:300, degraded:195, false_positive:5}.
        13. envelope-v1 schema check on emitted status row: 13 required
            fields + 5 ext fields (scope, verdict, totals, rules_tripped,
            route_hints) + RUN_ID_REGEX match.
        14. CLI exit codes:
              --self-test pass -> exit 0
              runCheck all-ok via --check -> exit 0
              runCheck degraded via --check -> exit 0 (NOT 1; LOCK 13)
              malformed budgets.yaml via --check -> exit 0 (graceful fallback)
              bad invocation (e.g. --unknown-flag) -> exit 2
            ALL 5 sub-cases must hold.
        15. runCheck never throws upward: poison _readSpendRows by
            making fs.readFileSync throw; runCheck returns
            { verdict:'error', totals:{}, ... } sentinel; NO uncaught.
            renderTable on error sentinel returns '(token-waste render error)'
            (or sensible fallback). appendCheckRun on error sentinel
            returns false.

    BEHAVIOR 11: budgets.yaml file
      - Path: super-gsd/tools/token-waste/budgets.yaml
      - Content: exact RESEARCH sec 6.5 schema (see <interfaces>).
      - 1 override row matching RESEARCH sec 7.4 F4 fixture:
        { role:'researcher', milestone:'v1.9', phase:'51',
          exempt_via:'vtp_research_route', reason: '...' }
      - File MUST be ASCII-only, LF endings, < 4 KB.
      - File MUST parse via the pinned js-yaml.

    BEHAVIOR 12: README pointer
      - NO new README.md file in token-waste/. Per dead-end #6.
      - The header comment block at the top of check.cjs IS the
        documentation surface. It cites:
          * 42-RESEARCH.md sections 4 (verdict matrix), 6 (budget table),
            7 (self-test), 11 (single plan recommendation)
          * REQUIREMENTS.md:67-68 (design lock 13)
          * REQUIREMENTS.md:100-109 (BUDGET-01..05)
          * super-gsd/tools/token-attribution/report.cjs (Phase 41
            upstream import surface)
          * super-gsd/tools/gate-keep-kill/rubric.cjs (Phase 39
            architectural mirror)
          * super-gsd/scripts/lib/gate-value-log.cjs (Phase 36 envelope-v1
            writer mirror; never-throws-upward)
          * Lock 13 binding: F3 self-test asserts envelope.status='warn'
            on degraded verdict (NEVER 'blocked').
  </behavior>
  <action>
File 1 of 2: `super-gsd/tools/token-waste/check.cjs` (NEW; ~600 LOC).
File 2 of 2: `super-gsd/tools/token-waste/budgets.yaml` (NEW; ~50 LOC).

Open by mirroring the structure of
`super-gsd/tools/gate-keep-kill/rubric.cjs` line by line. Substitute:

  gate-keep-kill         -> token-waste
  rubric                 -> check
  runRubric              -> runCheck
  renderTable            -> renderTable (kept; same name)
  classifyGate           -> _classifyRow (private)
  KEEP_THRESHOLDS        -> BUDGETS (per-role nested)
  REASONS (closed enum)  -> ROUTE_REASONS (closed enum, R1..R5)
  VERDICTS (3-state)     -> VERDICTS (4-state)
  4 canonical-source paths (gate-value-log.jsonl etc.)
                         -> 5 canonical-source paths (5 token streams)

ADDED public API not present in rubric.cjs:
  appendCheckRun  (envelope-v1 writer to token-waste-status.jsonl)
  _loadBudgets   (private; yaml + fallback)

ADDED Phase 41 imports:
  summarize, BLOAT_THRESHOLDS, ROLES, STATUSES, PROVIDERS, ledgerPath
  from '../token-attribution/report.cjs'

REMOVED: outcomeFromVerdict, _readEdgeGuardRows, _parseGatesYaml,
_readGatesYaml, _filterReviewRowsForGate, _computePassRate,
_buildSummary -- gate-rubric-specific.

Header docblock MUST be rewritten (do NOT leave `gate` / `keep` / `kill`
references). Risk row 1 in RESEARCH sec 11.3 explicitly flags this. The
header cites:
  - 42-RESEARCH.md sections 4 (verdict matrix), 5 (cross-phase contract),
    6 (budget table), 7 (self-test), 8 (hard-stop separation),
    9 (read-only invariant), 11 (single plan recommendation)
  - REQUIREMENTS.md:67-68 (design lock 13 verbatim)
  - REQUIREMENTS.md:100-109 (BUDGET-01..05 verbatim)
  - super-gsd/tools/token-attribution/report.cjs (Phase 41 upstream)
  - super-gsd/tools/gate-keep-kill/rubric.cjs (Phase 39 mirror)
  - super-gsd/scripts/lib/gate-value-log.cjs (Phase 36 mirror)
  - super-gsd/skills/sgsd-complete-milestone/SKILL.md:96-172 (Step 4.5/4.6
    template that Step 4.7 mirrors)

Skeleton: mirror gate-keep-kill/rubric.cjs:1-200 and gate-value-log.cjs:1-280
verbatim with the substitutions table above. Header docblock cites the
sources listed above; do NOT leak gate / keep / kill / Phase 39 references.
Public surface (line-anchor sketch):
  L1-L80    : header docblock + use strict + requires (fs/path/os/crypto)
  L81-L100  : Phase 41 upstream import block (RESEARCH sec 5.1)
  L101-L160 : 5 frozen consts (VERDICTS, ROUTE_REASONS, BUDGETS,
              COMMAND_NAME, ENVELOPE_VERSION) + LEDGER_REL + RUN_ID_REGEX
              + REAL_PLANNING_DIR / REAL_BUDGETS_YAML __dirname-anchored
              guards (mirror gate-value-log.cjs:127-129)
  L161-L230 : _loadBudgets (BEHAVIOR 2; never throws upward; compiled
              fallback + reason_code budgets_yaml_fallback)
  L231-L280 : _readSpendRows (mirror report.cjs:291-311 verbatim)
  L281-L390 : _classifyRow + _matchOverride (BEHAVIOR 3 + 4)
  L391-L470 : runCheck (BEHAVIOR 5; top-level try/catch around all I/O)
  L471-L520 : _normalize + _assertEnvelopeV1 + _appendRowInternal
              (mirror gate-value-log.cjs:200-280 verbatim)
  L521-L580 : appendCheckRun (BEHAVIOR 6; LOCK 13 status mapping)
  L581-L640 : renderTable (BEHAVIOR 7; 4-section markdown)
  L641-L760 : _selfTest (BEHAVIOR 10; 15 assertions; F1-F4 fixtures
              + 11 secondary; tmpdir-only writes; fingerprint pre/post)
  L761-L820 : CLI argv parser (BEHAVIOR 8; bad invocation -> exit 2)
  L821-L840 : module.exports (3 public APIs + 5 frozen consts)

Reference assemblies for each block live in:
  - gate-keep-kill/rubric.cjs    (read-only check + closed-enum verdict +
                                   renderTable; rubric.cjs:1-200 first;
                                   then runRubric body for the loop shape)
  - gate-value-log.cjs           (envelope-v1 writer; _normalize +
                                   _assertEnvelopeV1 + _appendRowInternal +
                                   never-throws-upward + RUN_ID_REGEX)
  - token-attribution/report.cjs (defensive _readRows at 291-311 -> mirror
                                   into _readSpendRows verbatim;
                                   summarize export verbatim)
  - gates-registry.cjs:38-44     (js-yaml load pattern verbatim; wrap in
                                   try/catch -- Phase 42 NEVER throws upward
                                   on poisoned config)
budgets.yaml content (verbatim from RESEARCH sec 6.5):

```yaml
schema_version: 1

# Per-role admission budgets.
# warn_input == degrade_input -> single threshold (BUDGET-02 verbatim).
# warn_input <  degrade_input -> graduated overrun (derived from live
#                                ledger P75/P90/P95).
roles:
  researcher:   { warn_input: 25000,  degrade_input: 25000 }
  planner:      { warn_input: 30000,  degrade_input: 30000 }
  executor:     { warn_input: 40000,  degrade_input: 40000 }
  verifier:     { warn_input: 20000,  degrade_input: 20000 }
  reviewer:     { warn_input: 20000,  degrade_input: 20000 }
  orchestrator: { warn_input: 200000, degrade_input: 750000 }
  classifier:   { warn_input: 15000,  degrade_input: 15000 }
  other:        { warn_input: 25000,  degrade_input: 50000 }

# Inherited from Phase 41 BLOAT_THRESHOLDS verbatim (BUDGET-03).
# Drift between this file and the imported const triggers fallback at
# load time. Self-test assertion 7 binds.
bloat_signature:
  cache_read_ratio_high: 0.90
  useful_findings_low:   15

# Per-row overrides. Match priority: role+milestone+phase > role+milestone > role.
overrides:
  - role: researcher
    milestone: v1.9
    phase: "51"
    exempt_via: vtp_research_route
    reason: "Benchmark researcher legitimately uses VTP corpus"

# Reference only. Phase 42 NEVER expands hard stops -- they remain at
# SGSD-HANDOVER.md:79-86 (credentials / destructive op outside repo /
# privacy-security judgment / runtime cannot continue).
hard_stops_unchanged: true
```

Run --self-test and verify ALL 15 PASS:

```bash
node super-gsd/tools/token-waste/check.cjs --self-test
# Expected stdout last line: "token-waste self-test: 15 pass, 0 fail"
# Exit code: 0
```

Acceptance gates (full battery in <verification> block at end of PLAN; the
subset that MUST pass for this task in particular):

1. --self-test exits 0 with literal stdout last line:
   "token-waste self-test: 15 pass, 0 fail".
2. require(check.cjs) exports exactly: BUDGETS, COMMAND_NAME,
   ENVELOPE_VERSION, ROUTE_REASONS, VERDICTS, appendCheckRun,
   renderTable, runCheck (8 keys, sorted).
3. VERDICTS.length === 4 AND !VERDICTS.includes("blocked") AND every
   member of ["ok","warn","degraded","false_positive"] is present.
4. ROUTE_REASONS values verbatim Phase 41 R1..R5: R1=
   researcher_local_script_candidate, R2=codex_reviewer_fallback_candidate,
   R3=executor_context_packet_candidate, R4=verifier_goal_backward_candidate,
   R5=orchestrator_turn_trim_candidate.
5. BUDGETS values exactly RESEARCH sec 6.3 (researcher 25k/25k, planner
   30k/30k, executor 40k/40k, verifier 20k/20k, reviewer 20k/20k,
   orchestrator 200k/750k, classifier 15k/15k, other 25k/50k).
6. Phase 41 BLOAT_THRESHOLDS exports 4 keys (cache_read_ratio_high,
   useful_findings_low, files_read_high, diff_lines_low) -- NOT 8 (review
   trim ef90751 preserved; dead-end #1).
7. budgets.yaml parses via the pinned js-yaml; contains 8 roles +
   bloat_signature{cache=0.90, findings=15} + at least 1 override row
   matching researcher+v1.9+phase 51+vtp_research_route (F4 fixture).
8. ASCII-only on both check.cjs and budgets.yaml (Phase 39 W4 lock).
9. No package.json / top-level node_modules diff (no new deps).
10. F3 binding spot-check (full Node script in <verification> below):
    a synthetic researcher row with input_total=30000, cache=99%,
    findings=5 produces verdict="degraded" AND envelope.status="warn"
    (NEVER "blocked") AND route_hint.reason=
    "researcher_local_script_candidate" AND envelope.run_id matches
    RUN_ID_REGEX.
11. Read-only invariant: the 5 canonical token streams +
    super-gsd/tools/token-waste/budgets.yaml are byte-identical to HEAD
    after self-test runs (git diff --quiet succeeds).
    ```

Commit: `feat(42-01): token-waste/check.cjs lib + 15-assertion self-test`
Stage: `super-gsd/tools/token-waste/check.cjs super-gsd/tools/token-waste/budgets.yaml`
  </action>
  <verify>
<automated>
node super-gsd/tools/token-waste/check.cjs --self-test
node -e "const {VERDICTS}=require('./super-gsd/tools/token-waste/check.cjs'); if(VERDICTS.length!==4||VERDICTS.includes('blocked')){console.error('FAIL VERDICTS');process.exit(1)} console.log('PASS VERDICTS')"
node -e "const m=require('./super-gsd/tools/token-attribution/report.cjs'); const k=Object.keys(m.BLOAT_THRESHOLDS); if(k.length!==4){console.error('FAIL BLOAT 4-key regressed');process.exit(1)} console.log('PASS BLOAT 4-key')"
node -e "const yaml=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const p=yaml.load(fs.readFileSync('./super-gsd/tools/token-waste/budgets.yaml','utf8'));if(!p.roles.researcher||p.bloat_signature.cache_read_ratio_high!==0.90){console.error('FAIL yaml');process.exit(1)} console.log('PASS yaml schema')"
node -e "const s=require('fs').readFileSync('./super-gsd/tools/token-waste/check.cjs','utf8');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){console.error('non-ASCII');process.exit(1)} console.log('PASS ASCII')"
git diff --quiet HEAD -- .planning/metrics/agent-token-spend.jsonl .planning/metrics/token-attribution.jsonl .planning/metrics/codex-log.jsonl .planning/metrics/token-log.jsonl .planning/metrics/activity-log.jsonl && echo "PASS read-only" || (echo "FAIL canonical mod"; exit 1)
</automated>
  </verify>
  <done>
- super-gsd/tools/token-waste/check.cjs exists, ~600 LOC, ASCII-only,
  exports the locked surface (3 public APIs + 5 frozen consts).
- super-gsd/tools/token-waste/budgets.yaml exists, ~50 LOC, ASCII-only,
  parses via the pinned js-yaml, satisfies RESEARCH sec 6.5 schema.
- VERDICTS frozen 4-entry; NO 'blocked'; ROUTE_REASONS verbatim
  Phase 41 R1..R5; BUDGETS matches RESEARCH sec 6.3.
- Phase 41 imports verified; BLOAT_THRESHOLDS still 4-key
  (review trim NOT regressed).
- node super-gsd/tools/token-waste/check.cjs --self-test exits 0 with
  "token-waste self-test: 15 pass, 0 fail".
- F3 spot-check: degraded verdict produces envelope.status='warn'
  (NEVER 'blocked'); route_hint emitted.
- 5 canonical streams + budgets.yaml byte-identical (read-only invariant
  green).
- Commit landed: `feat(42-01): token-waste/check.cjs lib + 15-assertion self-test`.
  </done>
</task>

<task type="auto">
  <name>Task T2: Wire SKILL.md Step 4.7 + Step 6 SUMMARY.md subsection</name>
  <files>super-gsd/skills/sgsd-complete-milestone/SKILL.md</files>
  <action>
PRECONDITION: Task T1 produced check.cjs + budgets.yaml; --self-test
15/15 PASS; F3 spot-check green.

Edit `super-gsd/skills/sgsd-complete-milestone/SKILL.md`:

1. Add `<step_4_7_token_waste_check>` IMMEDIATELY AFTER the existing
   `<step_4_6_phase_folder_audit>` block (currently ends at line ~172),
   and BEFORE `<step_5_cross_phase_check>` (currently starts at ~174).

   Mirror Step 4.5 + 4.6 verbatim shape. The wire-in MUST anchor
   planningDir to `process.cwd()` at the orchestrator-skill boundary
   explicitly (Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 41
   lessons; never bare relative '.planning').

   Content of new block:

   ```markdown
   <step_4_7_token_waste_check>
   ## Step 4.7: Token Waste Admission Check (Phase 42 -- BUDGET-01..05)

   Run the read-only token-waste check over the milestone's
   `.planning/metrics/agent-token-spend.jsonl` ledger (Phase 41).
   The check emits one envelope-v1 row to
   `.planning/metrics/token-waste-status.jsonl` and renders a verdict
   table to `.planning/milestones/{{version}}/token-waste.md`.

   Per design lock 13 (REQUIREMENTS.md:67-68): a degraded verdict
   continues autonomy. The check NEVER halts close. Halt remains
   reserved for the four hard-stop conditions in
   `SGSD-HANDOVER.md:79-86`.

   ```javascript
   // Phase 42 wire-in: anchor planningDir to process.cwd() at the
   // orchestrator-skill boundary (mirrors Step 4.5 Phase 39 ATC W3 +
   // Step 4.6 Phase 40 W3 fixes). NEVER bare relative '.planning'.
   const path = require('path');
   const fs   = require('fs');
   const { runCheck, renderTable, appendCheckRun } = require(
     path.join(process.cwd(), 'super-gsd', 'tools', 'token-waste', 'check.cjs')
   );
   const planningDir = path.join(process.cwd(), '.planning');
   const result = runCheck(planningDir, { milestone: '{{version}}' });
   const md     = renderTable(result);
   fs.writeFileSync(
     path.join(planningDir, 'milestones', '{{version}}', 'token-waste.md'),
     '# Token Waste (milestone {{version}})\n\n' +
     '> Soft-warn / degraded only. Per design lock 13:\n' +
     '> "Autonomy continues; evidence tells the truth."\n' +
     '> Halt remains reserved for SGSD-HANDOVER.md:79-86 hard stops.\n\n' +
     md + '\n', 'utf8');
   // Append envelope-v1 row to token-waste-status.jsonl. NEVER throws
   // upward; on failure, returns false and Step 5 continues.
   appendCheckRun(planningDir, result);
   ```

   Per lock 13: this step ONLY produces verdict + envelope row + table.
   The script NEVER mutates `super-gsd/registry/gates.yaml` or any
   canonical token stream (5 streams + budgets.yaml byte-identical
   pre/post). `degraded` verdict in the table maps to envelope
   status='warn' (NOT 'blocked'); cockpit consumers must read
   `verdict` (Phase 42 ext field) for the 4-state ladder, not
   `status`.

   Defer-on-empty: if `agent-token-spend.jsonl` is absent or empty
   (no Phase 41 backfill yet), `runCheck` returns
   `{verdict:'ok', totals:{rows_evaluated:0}}` and the rendered table
   reads `(no rows evaluated; agent-token-spend.jsonl absent or empty)`.
   Soft-warn semantics never block close.

   Token-waste-status JSONL row: `appendCheckRun` appends ONE
   envelope-v1 row per close run (run_id unique). Cockpit (Phase 50)
   reads "latest by scope" via `ts` ordering; no dedup needed.
   </step_4_7_token_waste_check>
   ```

2. Add Token Waste subsection to Step 6 SUMMARY.md generator,
   IMMEDIATELY AFTER the existing "Phase Folder Audit subsection"
   (currently ends at line ~258), and BEFORE the existing
   "## Connections" subsection.

   Content of new subsection:

   ```markdown
   ### Token Waste subsection (Phase 42 -- BUDGET-05)

   Append to SUMMARY.md a new subsection AFTER `## Phase Folder Audit`
   and BEFORE the existing `## Connections` section. Source: read the
   file `.planning/milestones/{{version}}/token-waste.md` produced by
   Step 4.7; embed its contents inline:

   ```markdown
   ## Token Waste (milestone {{version}})

   > Per design lock 13: degraded continues autonomy. Operator may
   > consider provider substitution per emitted route_hints; the check
   > itself never halts.

   {{contents of .planning/milestones/{{version}}/token-waste.md}}
   ```

   If `.planning/milestones/{{version}}/token-waste.md` does not exist
   (Step 4.7 failed), write the literal line:
   `(token-waste output unavailable -- see token-waste-status.jsonl)`.
   ```

3. NO renumbering of existing Step 4.5, 4.6, 5, 6, 7 etc. Step 4.7 is
   strictly inserted between 4.6 and 5. (Dead-end #13.)

Acceptance gates (full battery duplicated in <verify> block below):

1. SKILL.md contains the new <step_4_7_token_waste_check> block;
   the block references runCheck, renderTable, appendCheckRun, anchors
   planningDir to process.cwd(), and cites "design lock 13".
2. Step ordering: indexOf(step_4_5_gate_keep_kill_rubric) <
   indexOf(step_4_6_phase_folder_audit) <
   indexOf(step_4_7_token_waste_check) <
   indexOf(step_5_cross_phase_check). All four blocks present.
3. Step 6 SUMMARY.md subsection order:
   indexOf("Phase Folder Audit subsection") <
   indexOf("Token Waste subsection") < indexOf("## Connections").
4. ASCII-only across the entire SKILL.md (charCodeAt > 127 rejected).

Commit: `feat(42-01): budgets.yaml + sgsd-complete-milestone Step 4.7 integration`
Stage: `super-gsd/skills/sgsd-complete-milestone/SKILL.md`

(NOTE: budgets.yaml already committed by Task T1; the commit message
calls out the integration delta. Stage ONLY SKILL.md for this commit.
Phase 41 commit-discipline pattern: stage specific files by name.)
  </action>
  <verify>
<automated>
grep -q "step_4_7_token_waste_check" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS Step 4.7 present" || (echo "FAIL"; exit 1)
grep -q "runCheck" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS runCheck wire-in"
grep -q "appendCheckRun" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS appendCheckRun wire-in"
grep -q "design lock 13" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS lock-13 mention"
node -e "const t=require('fs').readFileSync('super-gsd/skills/sgsd-complete-milestone/SKILL.md','utf8');const i45=t.indexOf('step_4_5');const i46=t.indexOf('step_4_6');const i47=t.indexOf('step_4_7');const i5=t.indexOf('step_5_cross');if(!(i45<i46&&i46<i47&&i47<i5)){console.error('FAIL ordering');process.exit(1)} console.log('PASS Step ordering 4.5<4.6<4.7<5')"
node -e "const t=require('fs').readFileSync('super-gsd/skills/sgsd-complete-milestone/SKILL.md','utf8');const iPF=t.indexOf('Phase Folder Audit subsection');const iTW=t.indexOf('Token Waste subsection');const iC=t.indexOf('## Connections');if(!(iPF<iTW&&iTW<iC)){console.error('FAIL subsection order');process.exit(1)} console.log('PASS subsection order')"
node -e "const s=require('fs').readFileSync('super-gsd/skills/sgsd-complete-milestone/SKILL.md','utf8');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){console.error('non-ASCII');process.exit(1)} console.log('PASS ASCII')"
</automated>
  </verify>
  <done>
- super-gsd/skills/sgsd-complete-milestone/SKILL.md contains
  `<step_4_7_token_waste_check>` between Step 4.6 and Step 5.
- Step 4.7 references runCheck + renderTable + appendCheckRun;
  anchors planningDir to process.cwd() (Phase 32 W3 lesson honored).
- Step 4.7 explicitly cites design lock 13.
- Step 6 SUMMARY.md generator gets a "Token Waste subsection" between
  "Phase Folder Audit subsection" and "## Connections".
- Step ordering preserved (no renumbering of existing 4.5 / 4.6 / 5).
- SKILL.md ASCII-only (no drift introduced).
- Commit landed: `feat(42-01): budgets.yaml + sgsd-complete-milestone Step 4.7 integration`.
  </done>
</task>

<task type="auto">
  <name>Task T3: Live --check against v1.9 ledger; produce token-waste.md + first jsonl row</name>
  <files>.planning/metrics/token-waste-status.jsonl, .planning/milestones/v1.9/token-waste.md</files>
  <action>
PRECONDITION: Tasks T1 + T2 landed. check.cjs --self-test passes 15/15.
SKILL.md Step 4.7 wired. Phase 41 ledger (.planning/metrics/agent-token-
spend.jsonl) has >=10000 rows.

Run the live --check against the v1.9 milestone scope:

```bash
node super-gsd/tools/token-waste/check.cjs --check --milestone v1.9
```

Expected stdout: `token-waste check complete (verdict={verdict}, rows={N})`.
Expected exit: 0 (regardless of verdict).

This call:
  1. Reads `.planning/metrics/agent-token-spend.jsonl` (Phase 41 ledger).
  2. Filters to milestone='v1.9' rows.
  3. Classifies each row via _classifyRow (verdict matrix).
  4. Aggregates totals + rules_tripped + route_hints.
  5. Renders the 4-section table to
     `.planning/milestones/v1.9/token-waste.md`.
  6. Appends ONE envelope-v1 row to
     `.planning/metrics/token-waste-status.jsonl`.

Acceptance gates (BUDGET-04 + BUDGET-05; full battery in <verification>):

1. token-waste-status.jsonl exists with >=1 envelope-v1 row; latest row
   has command="checkTokenWaste", envelope_version=1, run_id matches
   RUN_ID_REGEX, status in {ok,warn,fail,skipped} but NEVER "blocked",
   verdict in {ok,warn,degraded,false_positive}, all 5 ext fields
   present (scope, verdict, totals, rules_tripped, route_hints).
2. token-waste.md exists at .planning/milestones/v1.9/token-waste.md;
   ASCII-only; <200KB; renders 4 sections (Verdict Counts, Rules
   Tripped, Route Hints, Top Offenders) OR an empty-ledger placeholder
   if Phase 41 ledger was empty.
3. Read-only invariant: 5 canonical token streams + budgets.yaml are
   byte-identical to HEAD after --check runs (git diff --quiet wins).
4. CLI exit-0-on-degraded contract (LOCK 13 mechanical): node check.cjs
   --check --milestone v1.9 exits 0 regardless of verdict.
5. Bad-invocation exit-2 contract: node check.cjs --not-a-real-flag
   exits 2.
6. Idempotent run: re-running --check appends EXACTLY 1 new envelope-v1
   row (run_id differs each run; jsonl monotonic-grows by 1).
7. SUMMARY.md proxy: Step 6 wire-in is not exercised here (it runs at
   milestone close, not phase close); the token-waste.md artifact is
   what Step 6 will embed when milestone close runs.

Commit: `feat(42-01): token-waste-status.jsonl first row from live ledger`
Stage: `.planning/metrics/token-waste-status.jsonl .planning/milestones/v1.9/token-waste.md`
  </action>
  <verify>
<automated>
node super-gsd/tools/token-waste/check.cjs --check --milestone v1.9
ec=$?
[ "$ec" -eq 0 ] && echo "PASS --check exit 0" || (echo "FAIL --check exit $ec"; exit 1)
test -f .planning/metrics/token-waste-status.jsonl && echo "PASS jsonl exists" || (echo "FAIL no jsonl"; exit 1)
test -f .planning/milestones/v1.9/token-waste.md && echo "PASS md exists" || (echo "FAIL no md"; exit 1)
node -e "const lines=require('fs').readFileSync('.planning/metrics/token-waste-status.jsonl','utf8').split(/\r?\n/).filter(Boolean);const r=JSON.parse(lines[lines.length-1]);if(r.command!=='checkTokenWaste'||r.envelope_version!==1){console.error('FAIL envelope shape');process.exit(1)} if(r.status==='blocked'){console.error('FAIL status=blocked LOCK 13');process.exit(1)} if(!['ok','warn','degraded','false_positive'].includes(r.verdict)){console.error('FAIL verdict');process.exit(1)} console.log('PASS envelope shape verdict='+r.verdict+' status='+r.status)"
node -e "const s=require('fs').readFileSync('.planning/milestones/v1.9/token-waste.md','utf8');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){console.error('non-ASCII');process.exit(1)} console.log('PASS ASCII')"
git diff --quiet HEAD -- .planning/metrics/agent-token-spend.jsonl .planning/metrics/token-attribution.jsonl .planning/metrics/codex-log.jsonl .planning/metrics/token-log.jsonl .planning/metrics/activity-log.jsonl super-gsd/tools/token-waste/budgets.yaml && echo "PASS read-only" || (echo "FAIL canonical or budgets modified"; exit 1)
node super-gsd/tools/token-waste/check.cjs --not-a-real-flag > /dev/null 2>&1; bec=$?; [ "$bec" -eq 2 ] && echo "PASS bad-invocation exit 2" || (echo "FAIL bad-invocation exit $bec"; exit 1)
</automated>
  </verify>
  <done>
- node super-gsd/tools/token-waste/check.cjs --check --milestone v1.9
  exits 0 (regardless of verdict; LOCK 13 mechanical embodiment).
- .planning/metrics/token-waste-status.jsonl exists with >=1 envelope-v1
  row; latest row's command='checkTokenWaste', envelope_version=1,
  status in {ok,warn,fail,skipped}, NEVER 'blocked', verdict in
  {ok,warn,degraded,false_positive}.
- .planning/milestones/v1.9/token-waste.md exists, ASCII-only, <200KB.
- Re-running --check appends exactly 1 new row (idempotent in the
  envelope-row-per-run sense; not byte-identical because run_id differs).
- All 5 canonical token streams + budgets.yaml byte-identical (read-only
  invariant green).
- Bad invocation (--not-a-real-flag) exits 2.
- Commit landed: `feat(42-01): token-waste-status.jsonl first row from live ledger`.
- BUDGET-01..05 + ROADMAP sec 42 acceptance A1..A4 all GREEN.
  </done>
</task>

</tasks>

<live_or_local_fallback>
RESEARCH sec 6.4 + sec 7. Phase 42 ships TWO modes both required:

| Mode | Source | Use case |
|------|--------|----------|
| LOCAL | `--self-test` seeds tmpdir with 4 named fixtures (F1-F4) + 1000-row synthetic ledger; budgets.yaml read from real path; canonical streams fingerprinted before/after | CI-safe; never touches canonical streams |
| LIVE  | `--check --milestone v1.9` walks production .planning/metrics/agent-token-spend.jsonl (>=10k rows from Phase 41) | Real verdict; runs in T3 against this repo |

LIVE is hard requirement (BUDGET-04 + BUDGET-05 acceptance: cockpit/
report can read result; that requires a real envelope row in
token-waste-status.jsonl). LOCAL is required by EXISTING-SURFACE-AUDIT
("CLI entrypoint, --self-test, deterministic fixtures, production caller
path, JSON output where practical"). Both wired by Task T1 (LOCAL: 15
assertions) and Task T3 (LIVE: --check against v1.9).
</live_or_local_fallback>

<schema_without_consumer_rule>
RESEARCH sec 11.4. Phase 42 ships 4 in-phase consumers exercising the
schema:

1. `runCheck` (verdict producer) -- reads agent-token-spend.jsonl + budgets.yaml,
   classifies every row, returns aggregated result. Self-test assertions
   8, 10, 12 exercise it.
2. `_classifyRow` (per-row classifier) -- private but exercised through
   runCheck self-test fixtures F1-F4 (assertions 1-4 of the named
   fixtures).
3. `appendCheckRun` (envelope-v1 writer) -- writes envelope-v1 rows
   with 5 ext fields. Self-test assertion 13 exercises it. T3 runs it
   against the live ledger.
4. `renderTable` (human consumer) -- reads result, renders 4-section
   markdown. T3 runs it against live result. Self-test assertion 12
   exercises it via 1000-row synthetic.

All 4 exported from one file. All 4 exercised by self-test + LIVE
--check. SKILL.md Step 4.7 + Step 6 SUMMARY.md subsection are FUTURE
consumers (run at milestone close); the schema satisfies the rule on
the merits of its 4 in-phase consumers.

Phase 47, 50, 51 are FUTURE consumers (Phase 47 reads route_hints,
Phase 50 cockpit reads token-waste-status.jsonl tail, Phase 51 benchmark
reads totals before/after); this phase satisfies the rule without
depending on future work.
</schema_without_consumer_rule>

<constraints>
- ASCII only (Phase 39 W4 + Phase 41 W lesson). Use `--` not em-dashes;
  `->` not arrows; `>=` not the unicode glyph; straight quotes only.
- LF line endings (no CRLF; lib loads on WSL CI which is strict).
- No new dependencies. Node built-ins only: fs, path, os, crypto. The
  pinned js-yaml at super-gsd/tools/plan-schema/node_modules/js-yaml is
  already pinned; gates-registry.cjs:38-44 pattern reused. No new
  package.json mod, no new top-level node_modules.
- Mirror gate-keep-kill/rubric.cjs (read-only check + closed-enum +
  renderTable) and gate-value-log.cjs (envelope-v1 writer + _normalize +
  _assertEnvelopeV1 + never-throws-upward + RUN_ID_REGEX) architecturally
  1:1 with Phase 42 substitutions.
- Phase 41 imports BY REFERENCE: summarize, BLOAT_THRESHOLDS, ROLES,
  STATUSES, PROVIDERS, ledgerPath. Do NOT redefine. Do NOT trim or
  expand BLOAT_THRESHOLDS (still 4 keys post-41-REVIEW trim).
- LOCK 13 (REQUIREMENTS:67-68): autonomy continues. degraded verdict
  emits envelope.status='warn' (NEVER 'blocked'); CLI exits 0 on
  degraded; the ONLY non-zero exit is malformed invocation (exit 2).
- LOCK 4 / dead-end #4: read-only against 5 canonical token streams +
  budgets.yaml. Owned writes: token-waste-status.jsonl (append-only) +
  milestones/{id}/token-waste.md (overwrite-per-run).
- LOCK 8: never use process.cwd() for canonical-path default INSIDE
  the lib; always anchor to __dirname with 3-up walk to .planning.
  EXCEPTION: at the SKILL.md orchestrator-skill boundary, process.cwd()
  is required (mirrors Step 4.5 + 4.6 lessons).
- File must load in <50ms (Phase 41 mirror property; no module-level
  work beyond const declarations + Phase 41 require call).
- Public API failure contract: NEVER throw upward at boundary. Closed-
  enum violations raise inside _appendRowInternal; the public API wraps
  every call in try/catch; on error console.warn to stderr and return
  falsey sentinel.
- Header docblock MUST be rewritten on check.cjs (no `gate` / `keep` /
  `kill` / Phase 39 leakage; risk row 1 in RESEARCH sec 11.3).
- token-waste.md size guard: <200KB. Top offenders capped at 10 rows;
  rules_tripped section displays all (closed enum, ~15 entries max);
  route_hints displays all (closed enum, ~5 entries max). NOT a raw
  row dump.
- README pointer ONLY (no token-waste/README.md; dead-end #6).
</constraints>

<commit_plan>
Three atomic commits, in order:

1. `feat(42-01): token-waste/check.cjs lib + 15-assertion self-test`
   Files:
     - super-gsd/tools/token-waste/check.cjs
     - super-gsd/tools/token-waste/budgets.yaml

2. `feat(42-01): budgets.yaml + sgsd-complete-milestone Step 4.7 integration`
   Files:
     - super-gsd/skills/sgsd-complete-milestone/SKILL.md

3. `feat(42-01): token-waste-status.jsonl first row from live ledger`
   Files:
     - .planning/metrics/token-waste-status.jsonl
     - .planning/milestones/v1.9/token-waste.md

Commit discipline (CLAUDE.md):
- Stage specific files by name. Never `git add -A` or `git add .`.
- Commit after EACH atomic deliverable. Do not batch.
- Commit message format: `feat({phase}-{plan}): {one-liner}`.
- If self-test fails after a commit, the NEXT commit fixes it -- never
  amend. (CLAUDE.md: NEVER amend.)
</commit_plan>

<verification>
Runnable phase-acceptance script. Executor MUST run end-to-end after T3:

```bash
# === BUDGET-01 + envelope-v1 conformance ===
node super-gsd/tools/token-waste/check.cjs --self-test
# Expected: token-waste self-test: 15 pass, 0 fail
# Expected exit: 0

# === BUDGET-02 budgets.yaml schema + values ===
node -e "
const yaml = require('./super-gsd/tools/plan-schema/node_modules/js-yaml');
const fs   = require('fs');
const p    = yaml.load(fs.readFileSync('./super-gsd/tools/token-waste/budgets.yaml','utf8'));
const expected = {
  researcher:[25000,25000], planner:[30000,30000], executor:[40000,40000],
  verifier:[20000,20000], reviewer:[20000,20000],
  orchestrator:[200000,750000], classifier:[15000,15000], other:[25000,50000]
};
for (const r of Object.keys(expected)) {
  const b = p.roles[r];
  if (!b) { console.error('FAIL no role',r); process.exit(1) }
  if (b.warn_input !== expected[r][0] || b.degrade_input !== expected[r][1]) {
    console.error('FAIL',r,'expected',expected[r],'got',[b.warn_input,b.degrade_input]); process.exit(1)
  }
}
console.log('PASS BUDGET-02 budgets.yaml values');
"

# === BUDGET-03 bloat_signature inheritance from Phase 41 ===
node -e "
const m = require('./super-gsd/tools/token-attribution/report.cjs');
if (m.BLOAT_THRESHOLDS.cache_read_ratio_high !== 0.90) { console.error('FAIL cache thresh'); process.exit(1) }
if (m.BLOAT_THRESHOLDS.useful_findings_low !== 15) { console.error('FAIL findings thresh'); process.exit(1) }
const k = Object.keys(m.BLOAT_THRESHOLDS);
if (k.length !== 4) { console.error('FAIL BLOAT_THRESHOLDS not 4-key',k); process.exit(1) }
console.log('PASS BUDGET-03 inherited from Phase 41 BLOAT_THRESHOLDS (4-key trim preserved)');
"

# === BUDGET-04 milestone-close wire-in (SKILL.md Step 4.7) ===
grep -q "step_4_7_token_waste_check" super-gsd/skills/sgsd-complete-milestone/SKILL.md \
  && echo "PASS BUDGET-04 SKILL.md Step 4.7 wired" \
  || (echo "FAIL BUDGET-04 wire-in"; exit 1)
grep -q "runCheck" super-gsd/skills/sgsd-complete-milestone/SKILL.md \
  && echo "PASS runCheck reference"
grep -q "appendCheckRun" super-gsd/skills/sgsd-complete-milestone/SKILL.md \
  && echo "PASS appendCheckRun reference"

# === BUDGET-05 cockpit-readable status JSONL ===
node super-gsd/tools/token-waste/check.cjs --check --milestone v1.9
ec=$?
[ "$ec" -eq 0 ] && echo "PASS BUDGET-05 --check exits 0 (LOCK 13)" \
  || (echo "FAIL --check exit $ec"; exit 1)
test -f .planning/metrics/token-waste-status.jsonl \
  && echo "PASS token-waste-status.jsonl exists"
test -f .planning/milestones/v1.9/token-waste.md \
  && echo "PASS token-waste.md exists"

# === Lock 13 mechanical embodiment: F3 spot-check ===
node -e "
const {runCheck, appendCheckRun} = require('./super-gsd/tools/token-waste/check.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-final-'));
fs.mkdirSync(path.join(tmp,'metrics'), {recursive:true});
const f3 = {
  envelope_version:1, ts:'2026-04-27T20:00:00.000Z', command:'logTokenSpend',
  status:'ok', reason_codes:[], artifacts:[], evidence:[], next_action:null,
  risk:null, duration_ms:100, run_id:'2026-04-27T20:00:00.000Z-abcd',
  phase:'36', milestone:'v1.8',
  role:'researcher', provider:'claude',
  token_breakdown:{
    input_tokens:300, cache_read_input_tokens:29700, cache_creation_input_tokens:0,
    output_tokens:200, total_tokens:30200,
    useful_findings:5, tokens_estimated:false,
    source_event_id:'agent:test:f3final', source_stream:'token-attribution.jsonl'
  }
};
fs.writeFileSync(path.join(tmp,'metrics','agent-token-spend.jsonl'), JSON.stringify(f3)+'\\n');
const r = runCheck(tmp, {});
const e = appendCheckRun(tmp, r);
if (r.verdict !== 'degraded') { console.error('FAIL F3 verdict',r.verdict); process.exit(1) }
if (!e || e.status !== 'warn') { console.error('FAIL F3 envelope.status',e && e.status); process.exit(1) }
if (e.status === 'blocked') { console.error('FAIL F3 envelope.status=blocked LOCK 13 BLOWN'); process.exit(1) }
console.log('PASS F3 lock-13 binding (verdict=degraded -> envelope.status=warn)');
"

# === F4 false-positive spot-check ===
node -e "
const {runCheck, appendCheckRun} = require('./super-gsd/tools/token-waste/check.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-fp-'));
fs.mkdirSync(path.join(tmp,'metrics'), {recursive:true});
const f4 = {
  envelope_version:1, ts:'2026-04-27T20:01:00.000Z', command:'logTokenSpend',
  status:'ok', reason_codes:['vtp_research_route'], artifacts:[], evidence:[],
  next_action:null, risk:null, duration_ms:200,
  run_id:'2026-04-27T20:01:00.000Z-bcde',
  phase:'51', milestone:'v1.9',
  role:'researcher', provider:'vtp',
  token_breakdown:{
    input_tokens:1000, cache_read_input_tokens:51600, cache_creation_input_tokens:7400,
    output_tokens:500, total_tokens:60500,
    useful_findings:100, tokens_estimated:false,
    source_event_id:'agent:test:f4final', source_stream:'token-attribution.jsonl'
  }
};
fs.writeFileSync(path.join(tmp,'metrics','agent-token-spend.jsonl'), JSON.stringify(f4)+'\\n');
const r = runCheck(tmp, { milestone:'v1.9' });
if (r.totals.false_positive !== 1) { console.error('FAIL F4 fp count',r.totals); process.exit(1) }
if (r.totals.warn !== 0 && r.totals.degraded !== 0) { console.error('FAIL F4 unexpected w/d'); process.exit(1) }
console.log('PASS F4 false_positive (override matched, fp count=1)');
"

# === Read-only invariant ===
git diff --quiet HEAD -- \
  .planning/metrics/agent-token-spend.jsonl \
  .planning/metrics/token-attribution.jsonl \
  .planning/metrics/codex-log.jsonl \
  .planning/metrics/token-log.jsonl \
  .planning/metrics/activity-log.jsonl \
  super-gsd/tools/token-waste/budgets.yaml \
  && echo "PASS read-only invariant (5 streams + budgets.yaml)" \
  || (echo "FAIL canonical streams or budgets.yaml modified"; exit 1)

# === Bad-invocation exit-2 contract ===
node super-gsd/tools/token-waste/check.cjs --not-a-real-flag > /dev/null 2>&1
bec=$?
[ "$bec" -eq 2 ] && echo "PASS bad-invocation exit 2" \
  || (echo "FAIL bad-invocation exit $bec"; exit 1)

# === BLOAT_THRESHOLDS not regressed (Phase 41 review trim preserved) ===
node -e "
const m = require('./super-gsd/tools/token-attribution/report.cjs');
const k = Object.keys(m.BLOAT_THRESHOLDS);
if (k.length !== 4) { console.error('FAIL BLOAT_THRESHOLDS regressed to',k.length,'keys'); process.exit(1) }
const expected = ['cache_read_ratio_high','useful_findings_low','files_read_high','diff_lines_low'];
for (const x of expected) if (!(x in m.BLOAT_THRESHOLDS)) { console.error('FAIL missing',x); process.exit(1) }
const dead = ['researcher_input_max','planner_input_max','executor_input_max','verifier_input_max'];
for (const d of dead) if (d in m.BLOAT_THRESHOLDS) { console.error('FAIL dead key re-introduced:',d); process.exit(1) }
console.log('PASS BLOAT_THRESHOLDS 4-key trim preserved');
"
```

All ~14 PASS lines required. Any FAIL = phase NOT complete; surface as
gap in VERIFICATION.md.
</verification>

<success_criteria>
Phase 42 ships when ALL of the following are TRUE:

- [ ] `super-gsd/tools/token-waste/check.cjs` exists, ASCII-only, LF line
      endings, no new deps, exports the locked 3 public APIs (runCheck,
      renderTable, appendCheckRun) + 5 frozen consts (VERDICTS,
      ROUTE_REASONS, BUDGETS, COMMAND_NAME, ENVELOPE_VERSION).
- [ ] `super-gsd/tools/token-waste/budgets.yaml` exists, ~50 LOC,
      ASCII-only, parses via pinned js-yaml, contains 8 roles x 2
      thresholds + bloat_signature + 1 F4 fixture override.
- [ ] `node super-gsd/tools/token-waste/check.cjs --self-test` exits 0
      with `token-waste self-test: 15 pass, 0 fail`.
- [ ] VERDICTS = Object.freeze 4-entry: ok, warn, degraded,
      false_positive. NEVER includes 'blocked'.
- [ ] ROUTE_REASONS = Object.freeze 5-entry verbatim Phase 41 R1..R5.
- [ ] BUDGETS values match RESEARCH sec 6.3 LOCKED table exactly.
- [ ] Phase 41 BLOAT_THRESHOLDS is the 4-key shape (cache_read_ratio_high,
      useful_findings_low, files_read_high, diff_lines_low) -- 41-REVIEW
      trim NOT regressed.
- [ ] `super-gsd/skills/sgsd-complete-milestone/SKILL.md` contains
      `<step_4_7_token_waste_check>` between Step 4.6 and Step 5;
      contains `runCheck` + `renderTable` + `appendCheckRun` references;
      anchors planningDir to `process.cwd()`; cites design lock 13.
- [ ] SKILL.md Step 6 SUMMARY.md generator contains "Token Waste
      subsection" between "Phase Folder Audit subsection" and "##
      Connections".
- [ ] `.planning/metrics/token-waste-status.jsonl` exists with >=1
      envelope-v1 row; latest row's command='checkTokenWaste',
      envelope_version=1, run_id matches RUN_ID_REGEX, status in
      {ok,warn,fail,skipped} but NEVER 'blocked', verdict in
      {ok,warn,degraded,false_positive}, all 5 ext fields present
      (scope, verdict, totals, rules_tripped, route_hints).
- [ ] `.planning/milestones/v1.9/token-waste.md` exists, ASCII-only,
      <200KB.
- [ ] CLI exit-0 contract: --check (any verdict) -> exit 0;
      malformed-yaml -> exit 0 (graceful fallback);
      bad invocation (e.g. --unknown-flag) -> exit 2.
- [ ] F3 binding lock-13 spot-check: degraded verdict produces
      envelope.status='warn' (NEVER 'blocked'); route_hint emitted
      with reason='researcher_local_script_candidate';
      evidence_event_id matches source row.
- [ ] F4 false_positive spot-check: override (role+milestone+phase+
      exempt_via) matches and produces verdict='false_positive' with
      reason_codes containing 'budget_check_false_positive'.
- [ ] All 5 canonical token streams (agent-token-spend.jsonl,
      token-attribution.jsonl, codex-log.jsonl, token-log.jsonl,
      activity-log.jsonl) byte-identical to HEAD; budgets.yaml
      byte-identical to HEAD after self-test (read-only invariant; LOCK 4).
- [ ] 3 atomic commits landed: `feat(42-01): ... lib`, `feat(42-01):
      ... Step 4.7 integration`, `feat(42-01): ... first row from live
      ledger`.

Falsifier (RESEARCH sec 11.3 / hypothesis falsifier): F3 self-test fixture
emits envelope.status='blocked' OR CLI exits non-zero on degraded
verdict. If observed: STOP; do NOT commit; surface BLOCKER citing
"design lock 13 binding regression"; revisit `_classifyRow` and
`appendCheckRun` status mapping.

Hard stop (LOCK 4): a check run mutates ANY of the 5 canonical token
streams or budgets.yaml. Revert immediately; the lib has a path bug
that violates read-only invariant.

Hard stop (dead-end #1): Phase 41 BLOAT_THRESHOLDS regressed to 8 keys
(re-introducing the trimmed researcher_input_max etc.). Revert
immediately; per-role budgets belong in Phase 42's BUDGETS const, not
Phase 41's BLOAT_THRESHOLDS.
</success_criteria>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator -> CLI | Operator-invoked `node check.cjs --self-test` / `--check`. Untrusted argv parsed by Phase 42; bad invocation -> exit 2. |
| filesystem -> lib | `.planning/metrics/agent-token-spend.jsonl` is trusted (Phase 41 owner) but defensively parsed (malformed lines skipped). |
| filesystem -> lib | `super-gsd/tools/token-waste/budgets.yaml` is trusted (Phase 42 owner) but defensively parsed (malformed yaml -> compiled fallback). |
| skill -> lib | `sgsd-complete-milestone` Step 4.7 wire-in passes process.cwd()-anchored planningDir at the orchestrator-skill boundary. |
| lib -> filesystem | Owned writes: token-waste-status.jsonl (append) + milestones/{id}/token-waste.md (overwrite). Read-only against 5 canonical token streams + budgets.yaml. |
| lib -> Phase 47 | route_hint is the forward contract; Phase 42 SAYS, Phase 47 DOES. No Phase 47 import allowed. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-42-01 | Spoofing | check.cjs CLI argv | mitigate | Closed-enum flag parser; unknown flags -> exit 2 (bad invocation); no flag value injection (no shell-out, no eval). Self-test assertion 14 binds. |
| T-42-02 | Tampering | budgets.yaml malicious config | mitigate | Schema validation (8 roles, positive numbers, bloat_signature drift check); on any failure -> compiled BUDGETS fallback + reason_code 'budgets_yaml_fallback'; never throws upward. Self-test assertion 9 binds. |
| T-42-03 | Tampering | token-waste-status.jsonl tail-injection | accept | File is append-only owned by Phase 42; envelope-v1 _normalize + _assertEnvelopeV1 reject malformed rows on append; downstream consumers (Phase 50 cockpit) read-only via JSONL parse with malformed-line skip. |
| T-42-04 | Tampering | canonical token-stream write attempt | mitigate | __dirname-anchored fingerprint guard captures {exists, mtimeMs, size} for 5 canonical streams + budgets.yaml; self-test assertion 11 verifies byte-identical pre/post; LOCK 4 + dead-end #4. Production caller anchors planningDir explicitly via process.cwd(). |
| T-42-05 | Repudiation | missing run evidence | mitigate | Every --check run appends ONE envelope-v1 row with unique run_id (RUN_ID_REGEX) + ISO ts; jsonl monotonic-grows; cockpit reads "latest by scope" via ts ordering. T3 acceptance gate 9 binds. |
| T-42-06 | Information Disclosure | sensitive token data in token-waste.md | accept | Source rows are token counts + cache ratios + tool stats -- no PII, no credentials, no source code. token-waste.md is committed to git per Phase 41 precedent (baseline-token-spend.md). |
| T-42-07 | Denial of Service | huge agent-token-spend.jsonl OOM | mitigate | Phase 41 ledger size capped by event-driven nature (~11k rows at research time); _readSpendRows uses streaming-friendly split + JSON.parse; runtime <1s on 100k rows. NO regex multiline scans. |
| T-42-08 | Denial of Service | runaway --self-test in CI | mitigate | Self-test seeds tmpdir only; 1000-row synthetic ledger fixture caps memory; full self-test runs in <2s on developer hardware (Phase 41 mirror property). |
| T-42-09 | Elevation of Privilege | budget breach -> autonomy halt | mitigate | LOCK 13 mechanical embodiment: degraded verdict emits envelope.status='warn' (NEVER 'blocked'); CLI exits 0 on degraded. F3 self-test fixture + assertion 14 are BINDING regression tests. Bypass attempt = phase auto-FAIL. |
| T-42-10 | Elevation of Privilege | Phase 47 route_hint coupling | mitigate | ROUTE_REASONS frozen const verbatim from Phase 41 R1..R5; no Phase 47 module import allowed (dead-end #5); `to_provider_candidates` is informational only -- Phase 47 owns the routing decision and its own ledger writes. |
| T-42-11 | Spoofing | false_positive override exploitation | accept | Operator-controlled budgets.yaml overrides require explicit (role+milestone+phase+exempt_via) match; 4 carve-out reasons (vtp_research_route, high_risk_code_phase, full_review_tier, generic match). Operator owns budgets.yaml in repo; abuse is visible in git diff. Phase 49 governance (REPAIR-04 class) may later add memory-write admission for override changes. |
</threat_model>

<output>
After completion, create
`.planning/milestones/v1.9/phases/42-token-budget-admission/42-01-token-budget-admission-SUMMARY.md`

Required SUMMARY contents (per template):
- Tools created: super-gsd/tools/token-waste/check.cjs (~600 LOC)
- Config created: super-gsd/tools/token-waste/budgets.yaml (~50 LOC)
- Skill edits: super-gsd/skills/sgsd-complete-milestone/SKILL.md
  (+Step 4.7 + Step 6 SUMMARY.md subsection)
- Artifacts produced:
  - .planning/metrics/token-waste-status.jsonl (>=1 envelope-v1 row)
  - .planning/milestones/v1.9/token-waste.md (rendered verdict table)
- Self-test result: 15/15 PASS
- Live --check result: { verdict: <ok|warn|degraded>, totals: {...},
  rules_tripped: {...}, route_hints: [...] } from v1.9 ledger
- Lock-13 binding evidence: F3 fixture asserts envelope.status='warn'
  on degraded verdict; F3 spot-check + verification block both green.
- Read-only invariant: 5 canonical streams + budgets.yaml byte-identical
  to HEAD pre/post.
- BLOAT_THRESHOLDS preserved: 4-key shape from Phase 41 review trim
  NOT regressed; per-role budgets live exclusively in Phase 42's BUDGETS
  const.
- Cross-phase contracts unblocked:
  - Phase 47 (ROUTE-02..05): consumes route_hints from
    token-waste-status.jsonl; ROUTE_REASONS enum frozen verbatim Phase 41
    R1..R5 vocabulary.
  - Phase 50 (COCKPIT-04): reads token-waste-status.jsonl tail for
    "Token Waste" panel (latest by scope; verdict + totals + top 3
    rules + top 3 hints).
  - Phase 51 (BENCH-04): reads totals as the "before" baseline target
    for >=50% researcher-token reduction acceptance.
- Commits: 3 atomic feat(42-01) commits with their SHAs.
- ATC tier observed: FULL (>=600 LOC across 2 new files + skill edit).
- Confidence: HIGH (mirror discipline preserved; Phase 41 imports
  verified by reference; canonical streams + budgets.yaml read-only;
  LOCK 13 binding regression test (F3) green).
</output>
