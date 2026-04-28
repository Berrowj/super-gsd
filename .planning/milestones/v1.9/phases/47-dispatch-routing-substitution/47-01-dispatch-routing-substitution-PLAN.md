---
schema_version: 2
phase: 47
plan: 01
name: Dispatch Routing Substitution
milestone: v1.9
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/tools/dispatch-router/route.cjs
  - super-gsd/tools/dispatch-router/routes.yaml
  - super-gsd/scripts/lib/route-ledger.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
autonomous: true
requirements:
  - ROUTE-01
  - ROUTE-02
  - ROUTE-03
  - ROUTE-04
  - ROUTE-05
  - LOCK-11
  - LOCK-13
tags:
  - routing
  - provider-substitution
  - dispatch
  - v1.9
  - phase-47
user_setup: []

must_haves:
  truths:
    - "deterministic_extraction routes local-first (A1)"
    - "bounded_code_review routes Codex-first when Codex is healthy (A2)"
    - "synthesis_judgment routes Claude (A3)"
    - "VTP only fires when uncertainty_type in {architecture_challenge, prior_memory_lookup, book_lookup} (A4)"
    - "every fallback emits a closed-vocab reason_code via existing route-ledger (A5)"
    - "structural predicates (file_count, line_count, task_kind) override uncertainty_type when small-extraction or bounded-review thresholds met (A6 / LOCK 11)"
    - "context_pressure (Phase 42 BUDGETS warn_input) biases away from claude under pressure (A7 / KAIROS)"
    - "router never throws upward; on internal error returns claude-fallback decision (LOCK 13)"
    - "Phase 32 BOUNDARIES extends 7 to 8 entries by adding 'dispatch_route' (no new ledger; EXISTING-SURFACE-AUDIT:139)"
    - "no semantic-similarity input or branch exists in router code (LOCK 11)"
  artifacts:
    - path: "super-gsd/tools/dispatch-router/route.cjs"
      provides: "routeDispatch + frozen UNCERTAINTY_TYPES/ROUTING_TABLE/TASK_KINDS/ROUTE_DECISION_REASONS + health probes + 15-assertion self-test + CLI"
      min_lines: 550
      contains: "Object.freeze"
      exports: ["routeDispatch", "isProviderHealthy", "loadRoutes", "UNCERTAINTY_TYPES", "ROUTING_TABLE", "ROUTE_DECISION_REASONS", "TASK_KINDS", "COMMAND_NAME", "ENVELOPE_VERSION"]
    - path: "super-gsd/tools/dispatch-router/routes.yaml"
      provides: "uncertainty_type -> {primary, fallback_chain} optional override config (compiled fallback baked into route.cjs)"
      min_lines: 25
      contains: "deterministic_extraction"
    - path: "super-gsd/scripts/lib/route-ledger.cjs"
      provides: "BOUNDARIES extended 7->8 with 'dispatch_route'; selfTest assertion 1 updated; new assertion 14 for dispatch_route smoke"
      contains: "'dispatch_route'"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Step 6.X wires dispatch-router consultation into agent dispatch path"
      contains: "dispatch-router/route.cjs"
  key_links:
    - from: "super-gsd/tools/dispatch-router/route.cjs"
      to: "super-gsd/tools/token-waste/check.cjs"
      via: "require('../token-waste/check.cjs') -> { BUDGETS, ROUTE_REASONS }"
      pattern: "require\\(.*token-waste/check\\.cjs.*\\)"
    - from: "super-gsd/tools/dispatch-router/route.cjs"
      to: "super-gsd/tools/token-attribution/report.cjs"
      via: "require('../token-attribution/report.cjs') -> { PROVIDERS, ROLES }"
      pattern: "require\\(.*token-attribution/report\\.cjs.*\\)"
    - from: "super-gsd/tools/dispatch-router/route.cjs"
      to: "super-gsd/scripts/lib/route-ledger.cjs"
      via: "logRouteDecision({boundary:'dispatch_route', ...}) called by orchestrator after routeDispatch returns"
      pattern: "boundary:\\s*'dispatch_route'"
    - from: "super-gsd/tools/dispatch-router/route.cjs"
      to: ".planning/metrics/codex-log.jsonl"
      via: "tail-walk for step:'self-test' row, age <= 30 min, all 4 probes true"
      pattern: "codex-log\\.jsonl"
    - from: "super-gsd/tools/dispatch-router/route.cjs"
      to: ".planning/metrics/vtp-health.jsonl"
      via: "last-row read; vtp_available=true and age <= 30 min"
      pattern: "vtp-health\\.jsonl"
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/tools/dispatch-router/route.cjs"
      via: "routeDispatch consulted before Agent dispatch; logRouteDecision emits envelope row"
      pattern: "routeDispatch"
---

<objective>
Phase 47 ships THE ROUTER: a single deterministic decision function that decides which executor (local-script | codex | claude | vtp) handles a given dispatch. v1.9 has built every input the router consumes (Phase 41 PROVIDERS + ROUTE_REASONS, Phase 42 BUDGETS + route_hints[], Phase 32 route-decisions.jsonl + envelope-v1, Phase 14 codex-log.jsonl self-test rows + providers-registry). All Phase 47 has to do is wire those signals into one frozen-enum decision function, log every decision via the EXISTING route-ledger surface (NEW boundary value `dispatch_route`, NOT a new ledger), and add a single SKILL.md wire so the orchestrator consults the router before any Agent dispatch.

Purpose: stop handing broad raw context to claude by default. Route work to the cheapest competent executor. Local for deterministic extraction. Codex for bounded review when healthy. Claude for synthesis and ambiguity. VTP only for the 3-entry whitelist of corpus-bound uncertainty types (architecture_challenge, prior_memory_lookup, book_lookup).

Output:
- 1 NEW module: `super-gsd/tools/dispatch-router/route.cjs` (~600 LOC, 15-assertion self-test, CLI `--route` + `--self-test`)
- 1 NEW config: `super-gsd/tools/dispatch-router/routes.yaml` (compiled fallback baked into route.cjs)
- 1 EDIT: `super-gsd/scripts/lib/route-ledger.cjs` BOUNDARIES const grows 7 -> 8 with `'dispatch_route'`; selfTest assertion 1 count update; one new assertion 14 verifying dispatch_route boundary accepts a Phase-47-shaped decision payload smoke
- 1 EDIT: `super-gsd/skills/sgsd-orchestrate/SKILL.md` adds Step 6.X consulting routeDispatch before Agent invocation; emits dispatch_route envelope row via existing logRouteDecision

Acceptance bindings (verbatim from RESEARCH and intent):
- A1: deterministic_extraction routes local-first
- A2: bounded_code_review routes Codex-first when Codex health green
- A3: synthesis_judgment reserved for Claude
- A4: VTP DISABLED unless uncertainty_type in {architecture_challenge, prior_memory_lookup, book_lookup}
- A5: every fallback logs reason via existing route-ledger envelope-v1
- A6: structural predicates (file_count, line_count) override semantic similarity (LOCK 11 binding)
- A7: context_pressure (Phase 42 budget overrun) biases away from claude (KAIROS lesson)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/milestones/v1.9/ROADMAP.md
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md
@.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md
@.planning/milestones/v1.9/phases/47-dispatch-routing-substitution/47-CONTEXT.md
@.planning/milestones/v1.9/phases/47-dispatch-routing-substitution/47-RESEARCH.md

# Mirror references (read for shape; never duplicate logic)
@super-gsd/tools/token-waste/check.cjs
@super-gsd/tools/token-attribution/report.cjs
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/scripts/lib/providers-registry.cjs
@super-gsd/registry/review-providers.yaml
@super-gsd/scripts/codex-exec.sh

<interfaces>
<!-- These are the EXACT contracts the executor MUST consume by reference. -->
<!-- DO NOT redefine. DO NOT copy values. require() them at runtime. -->

From super-gsd/tools/token-attribution/report.cjs:73-81 (Phase 41 SHIPPED):
```javascript
const ROLES = Object.freeze([
  'researcher', 'planner', 'executor', 'verifier',
  'reviewer', 'orchestrator', 'classifier', 'other',
]);
const PROVIDERS = Object.freeze(['claude', 'codex', 'local-script', 'vtp']);
```

From super-gsd/tools/token-waste/check.cjs:104-123 (Phase 42 SHIPPED):
```javascript
const ROUTE_REASONS = Object.freeze({
  R1: 'researcher_local_script_candidate',
  R2: 'codex_reviewer_fallback_candidate',
  R3: 'executor_context_packet_candidate',
  R4: 'verifier_goal_backward_candidate',
  R5: 'orchestrator_turn_trim_candidate',
});
const BUDGETS = Object.freeze({
  researcher:   { warn_input: 25000,  hard_input: 40000  },
  planner:      { warn_input: 30000,  hard_input: 50000  },
  executor:     { warn_input: 35000,  hard_input: 60000  },
  verifier:     { warn_input: 25000,  hard_input: 40000  },
  reviewer:     { warn_input: 20000,  hard_input: 35000  },
  orchestrator: { warn_input: 50000,  hard_input: 80000  },
  classifier:   { warn_input: 5000,   hard_input: 10000  },
  other:        { warn_input: 30000,  hard_input: 50000  },
});
```
NOTE: import these by reference. NEVER hard-code budget numbers in routes.yaml. NEVER redefine PROVIDERS or ROLES.
The exact BUDGETS shape MUST be discovered at runtime via `require('../token-waste/check.cjs').BUDGETS` so drift is impossible.

From super-gsd/scripts/lib/route-ledger.cjs:62-70, 73-75, 86-90, 206-214 (Phase 32 SHIPPED):
```javascript
const BOUNDARIES = Object.freeze([
  'milestone_promotion', 'phase_dispatch_first', 'executor_choice',
  'gate_skip', 'codex_route', 'handoff_decision', 'gate_override',
]);  // Phase 47 will add 'dispatch_route' as 8th entry
const STATUSES = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
function generateRunId() { /* returns ISO ts + 4-hex */ }
function logRouteDecision(planningDir, args) {
  try { appendRow(planningDir, args || {}); return true; }
  catch (e) { console.warn('[SGSD] route-ledger logRouteDecision failed:', e.message); return false; }
}
```
NOTE: route-ledger NEVER throws upward (Lock 13). Phase 47 router calls logRouteDecision with
boundary='dispatch_route' once that value is added in Task 2.

From super-gsd/scripts/lib/route-ledger.cjs:312-433 (selfTest, current count = 13 assertions):
- Assertion 1 currently: "BOUNDARIES is array of 7"
- Assertion 13 currently: gate_override boundary smoke
- Phase 47 MUST: bump assertion 1 to "array of 8"; ADD assertion 14 for dispatch_route smoke (mirror
  the existing assertion 13 pattern using the new boundary value)

From super-gsd/scripts/lib/providers-registry.cjs (Phase 14 SHIPPED):
```javascript
function resolveReviewerProvider(gateName, gatesRegistry) -> { name, ... } | null
```
NOTE: Phase 47 router DELEGATES to this only when `task_kind === 'review' AND gate_name` provided.
Returns the resolved record's `name` field as the chosen provider. reason_code = 'gate_resolved_provider'.

From super-gsd/scripts/codex-exec.sh self-test row format (Phase 14 SHIPPED, verified at codex-log.jsonl tail 2026-04-27):
```json
{"ts":"2026-04-27T15:33:24Z","step":"self-test","exit":0,"skip_network":true,
 "self_test_probes":{"path":true,"auth":true,"timeout":true,"contract":true},
 "probe_version":"2","codex_version":"codex-cli 0.125.0","auth_method":"skip_network"}
```
Healthy iff: exit===0 AND all 4 probes true AND age <= 30 min.

From .planning/metrics/vtp-health.jsonl row format (orchestrator SKILL Step 3.7 SHIPPED):
```json
{"ts":"2026-04-28T00:00:00Z","vtp_available":true,
 "vtp_health_cached":"healthy","source":"cold_start_probe"}
```
Healthy iff: vtp_available===true AND age <= 30 min.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship dispatch-router/route.cjs (~600 LOC) + routes.yaml + 15-assertion self-test</name>
  <files>
    super-gsd/tools/dispatch-router/route.cjs (NEW)
    super-gsd/tools/dispatch-router/routes.yaml (NEW)
  </files>
  <behavior>
    Frozen-enum integrity (assertions 9-10):
    - UNCERTAINTY_TYPES.length === 6, Object.isFrozen(UNCERTAINTY_TYPES) true.
    - ROUTING_TABLE has exactly 6 entries; every entry is Object.frozen and has {primary, fallback_chain}.
    - TASK_KINDS.length === 9, Object.isFrozen(TASK_KINDS) true.
    - ROUTE_DECISION_REASONS.length is the closed-enum count from RESEARCH sec.11.2 (16 entries; matched_uncertainty_type, structural_override_local_script, structural_override_codex_review, context_pressure_override_local, context_pressure_override_codex, context_pressure_under_unmovable_route, route_hint_consumed_R1..R5, provider_codex_unavailable, provider_vtp_unavailable, provider_claude_unavailable, fallback_chain_exhausted, router_internal_error, gate_resolved_provider). Object.isFrozen true.
    - PROVIDERS imported by reference from token-attribution/report.cjs (assert require result equals).

    Eight base fixtures (assertions 1-8 in self-test order):
    - F1 local route happy: input {task_kind:'extraction', uncertainty_type:'deterministic_extraction', file_count:2, line_count:50} -> provider='local-script', primary_provider='local-script', reason='matched_uncertainty_type', fallback_used=false, fallback_chain=['claude'].
    - F2 codex route happy: input {task_kind:'review', uncertainty_type:'bounded_code_review', file_count:2, line_count:45, _force_codex_health:true, _force_vtp_health:false} -> provider='codex', reason='matched_uncertainty_type', fallback_used=false.
    - F3 claude route happy: input {task_kind:'synthesis', uncertainty_type:'synthesis_judgment'} -> provider='claude', reason='matched_uncertainty_type', fallback_used=false, fallback_chain=[].
    - F4 vtp route happy: input {task_kind:'planning', uncertainty_type:'architecture_challenge', _force_vtp_health:true} -> provider='vtp', reason='matched_uncertainty_type', fallback_used=false.
    - F4b vtp gating works: input {task_kind:'extraction', uncertainty_type:'deterministic_extraction', _force_vtp_health:true, file_count:5, line_count:200} -> provider='local-script' (NEVER 'vtp'). The non-vtp uncertainty_type CANNOT escalate to vtp even when health is forced green. (Bonus assertion: assert provider !== 'vtp' for all 6 uncertainty_types except the 3-entry whitelist.)
    - F5 codex fallback (provider_codex_unavailable): input {task_kind:'review', uncertainty_type:'bounded_code_review', _force_codex_health:false} -> provider='claude', reason='provider_codex_unavailable', fallback_used=true, fallback_reason='provider_codex_unavailable'.
    - F6 vtp fallback (provider_vtp_unavailable): input {task_kind:'planning', uncertainty_type:'architecture_challenge', _force_vtp_health:false} -> provider='claude', reason='provider_vtp_unavailable', fallback_used=true.
    - F7 structural override (LOCK 11 binding): input {task_kind:'extraction', uncertainty_type:'synthesis_judgment', file_count:2, line_count:50} -> provider='local-script' (overrides synthesis_judgment->claude), reason='structural_override_local_script'. THIS IS THE CRITICAL LOCK 11 ASSERTION: structural beats type.
    - F8 context-pressure override (KAIROS binding): input {task_kind:'extraction', uncertainty_type:'synthesis_judgment', role:'researcher', current_role_token_spend:30000} (BUDGETS.researcher.warn_input=25000) -> provider='local-script', reason='context_pressure_override_local', context_pressure.over_warn=true. (Variant test: same input but task_kind:'review' -> provider='codex', reason='context_pressure_override_codex'.)

    Seven secondary assertions (9-15):
    - 9 UNCERTAINTY_TYPES frozen 6-entry as above.
    - 10 ROUTING_TABLE frozen 6-entry; every entry frozen w/ primary + fallback_chain (array).
    - 11 Closed-enum input validation: routeDispatch({uncertainty_type:'banana'}) returns {provider:'claude', reason:'router_internal_error', fallback_used:true} with NO uncaught throw (Lock 13). Use try/catch around the call in the harness; assert no exception escaped.
    - 12 Read-only fingerprint guard: capture mtime+size of all 8 canonical paths BEFORE self-test (route-decisions.jsonl, codex-log.jsonl, vtp-health.jsonl, token-waste-status.jsonl, agent-token-spend.jsonl, token-attribution.jsonl, super-gsd/tools/token-waste/budgets.yaml, super-gsd/registry/review-providers.yaml). After self-test, assert UNCHANGED. Anchor paths via __dirname-relative resolve so the guard works from any cwd. (Mirror pattern: route-ledger.cjs:306, token-waste/check.cjs:1203-1226.)
    - 13 route-ledger smoke (cross-module integration): write a synthetic dispatch_route row via require('../../scripts/lib/route-ledger.cjs').logRouteDecision into a tmp planningDir; read back; assert envelope_version===1, command='logRouteDecision', boundary='dispatch_route', decision payload preserved. NOTE: this assertion is GATED on Task 2 having shipped (BOUNDARIES already extended). If run before Task 2, assertion 13 must throw a clear "Task 2 prerequisite missing: BOUNDARIES does not yet include dispatch_route" diagnostic and EXIT NON-ZERO. (This forces sequential execution.)
    - 14 hint consumption (Q5 binding): create a synthetic .planning/metrics/token-waste-status.jsonl in a tmp planningDir with a row whose route_hints=[{from_role:'researcher', reason:'researcher_local_script_candidate'}]. Call routeDispatch({task_kind:'synthesis', uncertainty_type:'synthesis_judgment', role:'researcher', _planning_dir:<tmp>}). Assert provider='local-script', reason_code includes 'route_hint_consumed_R1'. (Hint biases researcher synthesis to local-script.)
    - 15 Pure-function determinism: same input twice (excluding ts/run_id) -> identical decision. Run F2 twice; deep-equal compare excluding `health.codex.age_ms` (varies by ms).

    Module shape:
    - module.exports = { routeDispatch, isProviderHealthy, loadRoutes, UNCERTAINTY_TYPES, ROUTING_TABLE, ROUTE_DECISION_REASONS, TASK_KINDS, COMMAND_NAME, ENVELOPE_VERSION }.
    - COMMAND_NAME = 'routeDispatch'; ENVELOPE_VERSION = 1.

    LOCK 13 wrappers (mirror token-waste/check.cjs and route-ledger.cjs):
    - routeDispatch(input) wraps _routeDispatchInternal(input) in try/catch. On catch: log to stderr console.warn '[SGSD] dispatch-router routeDispatch failed:' + e.message; return safe-default {provider:'claude', primary_provider:null, reason:'router_internal_error', fallback_used:true, fallback_reason:'router_internal_error', fallback_chain:[], structural_signals:{}, context_pressure:{}, health:{codex:{healthy:false,reason:'not_probed'}, vtp:{healthy:false,reason:'not_probed'}}, hints_consumed:[], error:e.message}.
    - isProviderHealthy(name, planningDir) wraps _codexHealthFromLog/_vtpHealthFromLog in try/catch; returns {healthy, reason, age_ms?}; on catch returns {healthy:false, reason:'health_probe_error'}. local-script and claude are always healthy by axiom.
    - loadRoutes(opts?) parses routes.yaml using the SAME pinned js-yaml instance the rest of v1.9 uses (require('../plan-schema/node_modules/js-yaml') -- same pattern as token-waste/check.cjs:178-181). On parse error or absent file: return compiled fallback derived from ROUTING_TABLE const, with .source='compiled_fallback' (or 'compiled_yaml_error' if file existed but parse threw).

    Decision algorithm (mirror RESEARCH sec.3.4 verbatim):
    Order of evaluation in _routeDispatchInternal (first non-null wins):
    1. _validateInput(input) -- throws on closed-enum violation; routeDispatch wrapper catches.
    2. Resolve tableEntry from routes.yaml (or compiled fallback) by uncertainty_type; default 'synthesis_judgment' if missing/invalid.
    3. Compute structural_signals = {file_count, line_count, task_kind}; compute pressure via _pressureFor(input) which imports BUDGETS by require.
    4. STEP 1 -- Structural override (LOCK 11): if task_kind==='extraction' AND file_count<=3 AND line_count<=100 -> _decide('local-script', primary, [], 'structural_override_local_script', structuralSignals, pressure). Predicate 2: if task_kind==='review' AND line_count<=200 AND codex healthy AND primary !== 'codex' -> _decide('codex', primary, [], 'structural_override_codex_review', ...). (Predicate 3 is no-op; default ROUTING_TABLE applies.)
    5. STEP 2 -- Context-pressure override (KAIROS): if pressure.over_warn AND primary==='claude' -> if task_kind in {extraction, inventory} -> _decide('local-script', ..., 'context_pressure_override_local'); else if task_kind in {review, critique} -> _decide('codex', ..., 'context_pressure_override_codex'); else _decide(primary, ..., 'context_pressure_under_unmovable_route') with status -> warn but provider unchanged.
    6. STEP 3 -- Recent hint bias (R1/R2/R5): _readRecentHints reads tail-50 of <planningDir>/metrics/token-waste-status.jsonl; filter on from_role===input.role; if R1+role='researcher' bias to local-script (reason_code 'route_hint_consumed_R1'); if R2 bias AWAY from codex (provider='claude' reason_code 'route_hint_consumed_R2'); if R5+role='orchestrator' bias to local-script (reason_code 'route_hint_consumed_R5'). R3 and R4 RECORDED in hints_consumed but NEVER change provider (informational).
    7. STEP 4 -- Bridge for review gates: if input.task_kind==='review' AND input.gate_name -> require('../../scripts/lib/providers-registry.cjs').resolveReviewerProvider(gate_name, gatesRegistry); if it returns a record, set chosen=record.name and reason='gate_resolved_provider'. If null, fall through.
    8. STEP 5 -- Health gate primary: if primary==='codex' AND !isProviderHealthy('codex',planningDir).healthy -> _decide('claude', primary, fallback_chain, 'provider_codex_unavailable', ...). Same pattern for primary==='vtp' -> 'provider_vtp_unavailable'. If first fallback also unhealthy, walk chain; if exhausted -> _decide(null, primary, [], 'fallback_chain_exhausted', ...) and set status -> fail.
    9. STEP 6 -- Happy path: _decide(primary, primary, fallback_chain, 'matched_uncertainty_type', ...).

    _decide(chosen, primary, fallbackChain, reason, structural, pressure, hintsConsumed=[], extra={}) returns:
    {provider:chosen, primary_provider:primary, reason, fallback_used: chosen !== primary, fallback_reason: chosen !== primary ? reason : null, fallback_chain: fallbackChain.slice(), structural_signals: structural, context_pressure: pressure, health: extra.health || {codex:_lastCodexProbe, vtp:_lastVtpProbe}, hints_consumed: hintsConsumed.slice()}.

    _validateInput(input):
    - Throw 'dispatch-router: input must be an object' if !input || typeof !== 'object'.
    - Throw 'dispatch-router: uncertainty_type must be one of <list>; got <val>' if uncertainty_type provided AND not in UNCERTAINTY_TYPES.
    - Throw 'dispatch-router: task_kind must be one of <list>; got <val>' if task_kind provided AND not in TASK_KINDS.
    - For each of [file_count, line_count, current_role_token_spend]: if defined AND (typeof !== 'number' OR < 0) -> throw 'dispatch-router: <field> must be non-negative number'.

    _codexHealthFromLog(planningDir, maxAgeMs=30*60*1000):
    - Path: <planningDir>/metrics/codex-log.jsonl. If !fs.existsSync -> {healthy:false, reason:'no_log'}.
    - Read file, split lines, walk BACKWARD until finding row with step==='self-test'. If none in 200 most-recent rows -> {healthy:false, reason:'no_self_test_in_log'}.
    - Compute age = Date.now() - new Date(r.ts).getTime(). If age > maxAgeMs -> {healthy:false, reason:'stale_self_test', age_ms:age}.
    - Else require r.exit===0 AND probes.{path,auth,timeout,contract} all true. If pass -> {healthy:true, reason:'self_test_pass', age_ms:age}. Else {healthy:false, reason:'self_test_probe_failed', probes:r.self_test_probes}.

    _vtpHealthFromLog(planningDir, maxAgeMs=30*60*1000):
    - Path: <planningDir>/metrics/vtp-health.jsonl. If !fs.existsSync -> {healthy:false, reason:'no_log'}.
    - Read file, split lines, take LAST line. If empty -> {healthy:false, reason:'empty_log'}.
    - Parse JSON. age = Date.now() - new Date(last.ts). If > maxAgeMs -> {healthy:false, reason:'stale_health_row', age_ms:age}.
    - Else {healthy: !!last.vtp_available, reason: last.vtp_available?'vtp_healthy':'vtp_degraded', age_ms:age}.

    isProviderHealthy(name, planningDir, _forces={}):
    - if name==='claude' || name==='local-script' -> {healthy:true, reason:'always_healthy'}.
    - if _forces[name] !== undefined -> return {healthy:!!_forces[name], reason: _forces[name] ? 'forced_healthy_test_only' : 'forced_unhealthy_test_only'}. (test-only override; documented as starting with underscore to mark internal.)
    - if name==='codex' -> _codexHealthFromLog(planningDir).
    - if name==='vtp' -> _vtpHealthFromLog(planningDir).
    - else -> {healthy:false, reason:'unknown_provider'}.

    _pressureFor(input):
    - role = input.role || 'other'.
    - spend = input.current_role_token_spend || 0.
    - const { BUDGETS } = require('../token-waste/check.cjs').
    - roleBudget = BUDGETS[role] || BUDGETS.other.
    - return {role, current_spend:spend, warn_input:roleBudget.warn_input, over_warn: spend >= roleBudget.warn_input, ratio: roleBudget.warn_input > 0 ? spend/roleBudget.warn_input : 0}.

    _readRecentHints(planningDir, role, tailN=50):
    - Wrap in try/catch; on error return [] and console.warn.
    - Read <planningDir>/metrics/token-waste-status.jsonl tail-N rows; for each parse JSON; for each row.route_hints[] entry whose from_role===role push {...h, ts:r.ts} into hints. Return hints array.

    CLI shape (require.main === module):
    - --self-test -> process.exit(selfTest()) where selfTest returns 0 on all-pass, 1 on any-fail. Console output mirrors route-ledger.cjs:439-442 ("dispatch-router self-test: N pass, M fail" + per-failure listing).
    - --route --uncertainty-type X --task-kind Y [--file-count N] [--line-count N] [--role R] [--current-role-token-spend N] [--gate-name G] [--json] -> calls routeDispatch with parsed flags; if --json prints JSON.stringify(decision); else pretty-print "provider: X, reason: Y" one-liner.
    - --help / no args -> usage banner listing UNCERTAINTY_TYPES, TASK_KINDS, PROVIDERS.
    - NEVER crash the loop: wrap all CLI bodies in try/catch; on error console.error and exit 2.

    routes.yaml shape (RESEARCH sec.4 LOCKED):
    ```yaml
    # Phase 47 dispatch routing config. Compiled fallback in route.cjs ROUTING_TABLE
    # is authoritative; this file is an OPTIONAL override surface for cockpit / ops.
    # NEVER redefine BUDGETS or PROVIDERS here -- import by reference from Phase 41/42.
    schema_version: 1
    table:
      deterministic_extraction:
        primary: local-script
        fallback_chain: [claude]
      bounded_code_review:
        primary: codex
        fallback_chain: [claude]
      synthesis_judgment:
        primary: claude
        fallback_chain: []
      architecture_challenge:
        primary: vtp
        fallback_chain: [claude]
      prior_memory_lookup:
        primary: vtp
        fallback_chain: [claude]
      book_lookup:
        primary: vtp
        fallback_chain: [claude]
    ```

    Read-only invariant (RESEARCH sec.13): self-test NEVER writes to canonical .planning/metrics/* files OR Phase 41-46 source files OR review-providers.yaml OR budgets.yaml. All writes go to fs.mkdtempSync tmpdir; tmpdir cleaned in finally{}. Fingerprint guard verifies untouched.

    ASCII-only: route.cjs source MUST be ASCII (no smart quotes, em-dashes, ellipses, non-ASCII whitespace). Mirror token-waste/check.cjs (verified ASCII).
  </behavior>
  <action>
    Per D-research sec.16 and sec.11.1, ship a single JS module (~600 LOC including the 15-assertion self-test) plus the YAML config.

    Step A. Create directory: `mkdir -p super-gsd/tools/dispatch-router`.

    Step B. Write `super-gsd/tools/dispatch-router/route.cjs`. Mirror module shape verbatim from
    `super-gsd/tools/token-waste/check.cjs:1-200` (header banner, imports, frozen consts) and
    `:1350-1361` (module.exports). Mirror never-throws-upward wrapper from
    `super-gsd/scripts/lib/route-ledger.cjs:206-214` (logRouteDecision pattern). Mirror frozen-enum
    validation from `token-waste/check.cjs:553-571` (_normalize). Mirror fingerprint guard from
    `token-waste/check.cjs:1203-1226` (canonical-path mtime+size capture before/after). Mirror CLI
    shape from `route-ledger.cjs:447-455` (require.main === module + --self-test exit code).

    Use `require('../token-waste/check.cjs').BUDGETS` and `.ROUTE_REASONS` -- NEVER hard-code.
    Use `require('../token-attribution/report.cjs').PROVIDERS` and `.ROLES` -- NEVER hard-code.
    Use `require('../../scripts/lib/route-ledger.cjs').logRouteDecision` -- only for assertion 13
    smoke test (NOT for the actual routing logic; the orchestrator owns the emission in Task 3).
    Use `require('../plan-schema/node_modules/js-yaml')` -- same pinned instance as gates-registry,
    token-waste, phase-capsule (token-waste/check.cjs:178-181 is the precedent).

    All 15 assertions wired per <behavior>. Closed-enum reasons MUST be drawn from
    ROUTE_DECISION_REASONS (assertion enforces this list-membership check).

    Step C. Write `super-gsd/tools/dispatch-router/routes.yaml` with the YAML in <behavior>. ASCII only.
    Validate with `node -e "console.log(JSON.stringify(require('./super-gsd/tools/plan-schema/node_modules/js-yaml').load(require('fs').readFileSync('super-gsd/tools/dispatch-router/routes.yaml','utf8'))))"` returns the expected shape (6 entries, each with primary + fallback_chain).

    Step D. Run `node super-gsd/tools/dispatch-router/route.cjs --self-test`. EXPECT: assertion 13
    will FAIL with the diagnostic "Task 2 prerequisite missing: BOUNDARIES does not yet include
    dispatch_route" because Task 2 has not yet shipped. This is expected and DESIRED -- it forces
    Task 2 ordering. Capture exit code === 1; capture pass count === 14 (assertions 1-12, 14, 15).
    DO NOT proceed to Task 2 until 14/15 pass with the EXPECTED failure being assertion 13.

    Step E. Atomic commit ONE: `git add super-gsd/tools/dispatch-router/route.cjs super-gsd/tools/dispatch-router/routes.yaml` then `git commit -m "feat(47-01): dispatch-router/route.cjs + routes.yaml + 15-assertion self-test"`.
    Per CLAUDE.md commit discipline: stage specific files by name; never `git add -A`.

    DO NOT write to canonical streams. DO NOT redefine PROVIDERS/ROLES/BUDGETS. DO NOT use
    semantic-similarity inputs. DO NOT throw upward from any public API.
  </action>
  <verify>
    <automated>node super-gsd/tools/dispatch-router/route.cjs --self-test</automated>
    <expected>Exit 1 with output "dispatch-router self-test: 14 pass, 1 fail" where the single fail is assertion 13 with detail "Task 2 prerequisite missing: BOUNDARIES does not yet include dispatch_route". This is the SEQUENCING signal that Task 2 must run next. After Task 2 completes, re-run is expected to be 15/15 (verified in Task 2's verify block).</expected>
  </verify>
  <done>
    - super-gsd/tools/dispatch-router/route.cjs exists, ASCII-only, ~550-700 LOC.
    - super-gsd/tools/dispatch-router/routes.yaml exists, ASCII-only, parseable as the documented shape.
    - All frozen consts (UNCERTAINTY_TYPES, ROUTING_TABLE, TASK_KINDS, ROUTE_DECISION_REASONS) Object.frozen and shipping the LOCKED counts.
    - module.exports surface includes routeDispatch, isProviderHealthy, loadRoutes, all 4 frozen consts, COMMAND_NAME, ENVELOPE_VERSION.
    - 14/15 self-test assertions pass; assertion 13 fails with the expected sequencing diagnostic ONLY because Task 2 has not yet extended BOUNDARIES.
    - Read-only fingerprint guard reports zero drift on the 8 canonical paths.
    - Atomic commit 1 landed: `feat(47-01): dispatch-router/route.cjs + routes.yaml + 15-assertion self-test`.
    - `git diff --quiet` over .planning/metrics/* and Phase 41-46 source files (read-only invariant intact).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend route-ledger.cjs BOUNDARIES 7 to 8 with 'dispatch_route' (single 3-line edit + selfTest count update + new assertion 14)</name>
  <files>
    super-gsd/scripts/lib/route-ledger.cjs (EDIT)
  </files>
  <behavior>
    The single edit Phase 47 makes to existing code (RESEARCH sec.11.3 + sec.13 LOCKED).

    Edit 1 -- Extend BOUNDARIES (line 62-70):
    Add `'dispatch_route',` as the 8th entry after `'gate_override',`. Object.freeze stays. Comment
    above (line 56-61) MUST be updated to mention Phase 47 extension precedent. Format:
    ```
    // Phase 47 (ROUTE-01..05): added 'dispatch_route' for general dispatch routing
    // (research, planning, execution, verification, review). Uses the same closed-enum
    // extension pattern as Phase 38 'gate_override'. envelope-v1 contract unchanged
    // (additionalProperties:true at registry/command-envelope-v1.yaml:260).
    ```

    Edit 2 -- selfTest assertion 1 count (line 314-315):
    Change literal "7" to "8" in BOTH the assertion name string AND the predicate's length check:
    ```javascript
    assert('1. BOUNDARIES is array of 8',
      Array.isArray(BOUNDARIES) && BOUNDARIES.length === 8);
    ```

    Edit 3 -- Add new assertion 14 BEFORE the `} finally {` close (after current assertion 13, around line 434):
    Mirror the gate_override smoke pattern at lines 417-433 verbatim. Must verify:
    - appendRow(tmp, {boundary:'dispatch_route', status:'ok', phase:'47', milestone:'v1.9', reason_codes:['matched_uncertainty_type'], decision:{task_kind:'review', uncertainty_type:'bounded_code_review', primary_provider:'codex', chosen_provider:'codex', fallback_used:false}}) succeeds.
    - readRows returns the appended row last with boundary==='dispatch_route', decision.task_kind==='review', decision.chosen_provider==='codex', reason_codes contains 'matched_uncertainty_type'.

    Increment final pass-count by 1 (now 14 assertions; route-ledger self-test reports "14 pass, 0 fail").

    Read-only invariant: route-ledger.cjs::selfTest already has fingerprint guard at lines 306-309 +
    409-415. The new assertion 14 must NOT touch the canonical .planning/metrics/route-decisions.jsonl
    -- only the tmpdir. Verified by re-running route-ledger self-test post-edit and confirming
    fingerprint assertion 12 still passes.

    NO CHANGES TO API. logRouteDecision, logCodexRoute, appendRow, readRows, generateRunId all
    keep their exact signatures and try/catch contracts. The closed enum just grew one entry.
  </behavior>
  <action>
    Step A. Read super-gsd/scripts/lib/route-ledger.cjs lines 56-90 to confirm current BOUNDARIES
    layout (already done in planning context: 7-entry frozen array; comment block above at 56-61).

    Step B. Apply Edit 1: insert `'dispatch_route',` as the 8th entry. Update the preceding comment
    block to mention Phase 47 extension precedent in the same style as Phase 38's gate_override
    comment.

    Step C. Apply Edit 2: change BOTH occurrences of "7" to "8" in the assertion 1 line (line ~314-315).

    Step D. Apply Edit 3: insert the new assertion 14 immediately AFTER the existing assertion 13
    block (currently lines 417-434, ending with `void r13;`) and BEFORE `} finally {` at line 435.
    Mirror the assertion 13 pattern verbatim with values from <behavior>.

    Step E. Run `node super-gsd/scripts/lib/route-ledger.cjs --self-test`. EXPECT exit 0 with
    "route-ledger self-test: 14 pass, 0 fail". If any assertion regresses, fix before commit.

    Step F. Re-run `node super-gsd/tools/dispatch-router/route.cjs --self-test`. EXPECT exit 0 with
    "dispatch-router self-test: 15 pass, 0 fail" -- assertion 13 (the cross-module smoke that was
    expected-failing in Task 1) now passes because BOUNDARIES includes 'dispatch_route'.

    Step G. Atomic commit TWO: `git add super-gsd/scripts/lib/route-ledger.cjs` then
    `git commit -m "feat(47-01): extend route-ledger/log.cjs BOUNDARIES 7->8 with 'dispatch_route'"`.

    DO NOT change appendRow / logRouteDecision / logCodexRoute API. DO NOT remove existing entries
    from BOUNDARIES (closed-enum extension only). DO NOT touch the envelope-v1 schema. DO NOT bump
    schema_version on command-envelope-v1.yaml (RESEARCH A6 verified: additionalProperties:true so
    boundary VALUES expand without schema bump).
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/route-ledger.cjs --self-test &amp;&amp; node super-gsd/tools/dispatch-router/route.cjs --self-test</automated>
    <expected>Both exit 0. route-ledger reports "14 pass, 0 fail" (was 13). dispatch-router reports "15 pass, 0 fail" (was 14/15 because cross-module assertion 13 now satisfies its prerequisite).</expected>
  </verify>
  <done>
    - super-gsd/scripts/lib/route-ledger.cjs:62-70 BOUNDARIES has exactly 8 frozen entries; 'dispatch_route' is the 8th.
    - selfTest assertion 1 reads "BOUNDARIES is array of 8" with length===8 predicate.
    - selfTest now contains 14 assertions (previously 13); the new assertion 14 verifies dispatch_route boundary smoke acceptance.
    - route-ledger self-test exits 0 (14/14).
    - dispatch-router self-test exits 0 (15/15) -- cross-module smoke assertion 13 now satisfies its prerequisite.
    - logRouteDecision API signature unchanged; envelope-v1 schema unchanged.
    - Atomic commit 2 landed: `feat(47-01): extend route-ledger/log.cjs BOUNDARIES 7->8 with 'dispatch_route'`.
    - `git diff --quiet` over .planning/metrics/* (RO invariant intact; no canonical writes).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire dispatch-router into sgsd-orchestrate SKILL.md (Step 6.X consults router before Agent dispatch + emits dispatch_route envelope row)</name>
  <files>
    super-gsd/skills/sgsd-orchestrate/SKILL.md (EDIT)
  </files>
  <behavior>
    SKILL.md gets one new step (numbered to fit the existing flow -- typically a Step 6.X
    sub-step right BEFORE the Agent() dispatch invocation, or right AFTER the Phase 42 budget
    admission check, depending on existing numbering). The wire MUST be additive only -- it
    inserts router consultation; it does NOT remove or restructure existing steps.

    Behavioral contract (the skill instruction text MUST encode all of this):

    1. BEFORE invoking Agent() for any dispatch (research / planning / execution / verification /
       review), the orchestrator computes a route input shape:
       ```
       const routeInput = {
         task_kind: <derived from dispatch class; one of TASK_KINDS>,
         uncertainty_type: <derived from dispatch class; one of UNCERTAINTY_TYPES>,
         file_count: <count of files the dispatch will touch (best-known estimate)>,
         line_count: <estimated diff/output lines>,
         role: <orchestrator-set role; one of ROLES>,
         current_role_token_spend: <running spend for that role; from Phase 41 spend ledger or session accumulator>,
         gate_name: <when task_kind='review' AND a gate is implicated>
       };
       ```

    2. Call: `const router = require('../../tools/dispatch-router/route.cjs');
       const decision = router.routeDispatch(routeInput);`

    3. If decision.provider === null (fallback_chain_exhausted) -> orchestrator degrades to claude
       and proceeds (RESEARCH sec.7 LOCKED: "Caller treats null as 'use default.'" we ARE claude).
       Otherwise the orchestrator uses decision.provider as the routing hint for Agent() dispatch
       (e.g., model selection, sub-agent identity, or local-script fallthrough).

    4. AFTER routeDispatch returns (provider===null OR not), orchestrator emits ONE envelope row:
       ```
       const rl = require('../../scripts/lib/route-ledger.cjs');
       const status = decision.provider === null ? 'fail'
                    : decision.fallback_used ? 'warn'
                    : decision.context_pressure?.over_warn ? 'warn'
                    : 'ok';
       const reasonCodes = [decision.reason];
       if (decision.fallback_reason && decision.fallback_reason !== decision.reason) {
         reasonCodes.push(decision.fallback_reason);
       }
       if (decision.context_pressure?.over_warn) {
         reasonCodes.push('context_pressure_high');
       }
       rl.logRouteDecision(planningDir, {
         boundary: 'dispatch_route',
         status,
         phase: <currentPhase>,
         milestone: <currentMilestone>,
         reason_codes: reasonCodes,
         artifacts: [],
         evidence: [],
         decision: {
           task_kind: routeInput.task_kind,
           uncertainty_type: routeInput.uncertainty_type,
           primary_provider: decision.primary_provider,
           chosen_provider: decision.provider,
           fallback_chain: decision.fallback_chain,
           fallback_used: decision.fallback_used,
           fallback_reason: decision.fallback_reason,
           structural_signals: decision.structural_signals,
           context_pressure: decision.context_pressure,
           health: decision.health,
           hints_consumed: decision.hints_consumed
         }
       });
       ```

    5. NEVER block on routeDispatch. If routeDispatch returns the safe-default
       {provider:'claude', reason:'router_internal_error'}, the orchestrator continues with claude
       (Lock 13). The envelope row still gets emitted with status='warn', reason_codes including
       'router_internal_error', so the failure is visible in cockpit/BENCH.

    6. NEVER bypass VTP gating. Phase 47 router enforces A4 by ROUTING_TABLE structure. The skill
       text MUST NOT add a "but if VTP feels relevant, override the router" branch. The orchestrator
       trusts decision.provider verbatim (modulo null -> claude fallback).

    Skill section ordering rule (mirror existing SKILL.md structure):
    - Find the existing step block where the orchestrator dispatches Agent() (commonly Step 5/6
      depending on current SKILL.md numbering). The new sub-step lands immediately BEFORE that
      Agent() call as Step <N>.X (where N is the parent step number).
    - The new sub-step is titled "Step <N>.X -- Consult dispatch-router before Agent invocation".
    - It includes a brief "When to use" note: "Every Agent() dispatch -- research, planning,
      execution, verification, review. The router decides which executor handles the dispatch
      and writes a single envelope row to route-decisions.jsonl with boundary='dispatch_route'."

    READ-ONLY INVARIANT for SKILL.md: Phase 47 ADDS one new step block. Phase 47 does NOT modify
    or delete any existing skill steps. The diff is purely additive.

    ASCII-only.
  </behavior>
  <action>
    Step A. Read super-gsd/skills/sgsd-orchestrate/SKILL.md to identify the dispatch step (likely
    Step 5 or 6 depending on current numbering; look for the line where Agent() is invoked or where
    the orchestrator selects model/sub-agent for a dispatch). Use Grep with pattern `Agent\(` or
    `sub-agent dispatch` or `Step.*[Dd]ispatch` to find the insertion point.

    Step B. Insert a new sub-step block titled "Step <N>.X -- Consult dispatch-router before Agent
    invocation" immediately BEFORE the Agent() invocation step. The block MUST contain:
    - A 1-sentence "Why" (route work to the cheapest competent executor; A1-A7).
    - The routeInput shape with the 7 fields (task_kind, uncertainty_type, file_count, line_count,
      role, current_role_token_spend, gate_name?) -- in a fenced javascript block.
    - The require('../../tools/dispatch-router/route.cjs') call.
    - The status mapping (provider===null -> fail; fallback_used -> warn; over_warn -> warn; else ok).
    - The logRouteDecision call with boundary:'dispatch_route' and the full decision payload.
    - The Lock 13 reminder: "router never throws upward; safe-default is claude with reason='router_internal_error'."
    - The A4 reminder: "VTP gating is encoded in ROUTING_TABLE; never add a manual VTP override branch in the skill."

    Step C. Validate the SKILL.md edit is purely additive: `git diff super-gsd/skills/sgsd-orchestrate/SKILL.md`
    should show only insertions, no deletions, except possibly minor whitespace before/after the
    insertion point. Run a quick render check: `head -200 super-gsd/skills/sgsd-orchestrate/SKILL.md`
    -- existing structure intact.

    Step D. Smoke-confirm the wire compiles cleanly:
    `node -e "const r=require('./super-gsd/tools/dispatch-router/route.cjs'); const d=r.routeDispatch({task_kind:'extraction',uncertainty_type:'deterministic_extraction',file_count:2,line_count:50}); console.log(JSON.stringify({provider:d.provider,reason:d.reason}));"` -> expect `{"provider":"local-script","reason":"matched_uncertainty_type"}`.

    Step E. Smoke-confirm the envelope round-trips through the real route-ledger (writes to a
    temp planningDir to keep RO invariant):
    `node -e "const fs=require('fs'),os=require('os'),path=require('path'); const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'p47-')); fs.mkdirSync(path.join(tmp,'metrics')); const rl=require('./super-gsd/scripts/lib/route-ledger.cjs'); const ok=rl.logRouteDecision(tmp,{boundary:'dispatch_route',status:'ok',phase:'47',milestone:'v1.9',reason_codes:['matched_uncertainty_type'],decision:{task_kind:'extraction',uncertainty_type:'deterministic_extraction',primary_provider:'local-script',chosen_provider:'local-script',fallback_used:false}}); const rows=rl.readRows(tmp); console.log('ok=',ok,'rows=',rows.length,'last_boundary=',rows[rows.length-1].boundary); fs.rmSync(tmp,{recursive:true,force:true});"`
    -> expect `ok= true rows= 1 last_boundary= dispatch_route`.

    Step F. Atomic commit THREE: `git add super-gsd/skills/sgsd-orchestrate/SKILL.md` then
    `git commit -m "feat(47-01): SKILL.md wire -- orchestrate consults router before Agent dispatch"`.

    DO NOT modify existing skill steps. DO NOT add a manual VTP override branch (A4 binding). DO NOT
    write to canonical streams in the smoke commands -- both use mkdtempSync tmpdirs and rmSync clean.
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/route-ledger.cjs --self-test &amp;&amp; node super-gsd/tools/dispatch-router/route.cjs --self-test &amp;&amp; node -e "const r=require('./super-gsd/tools/dispatch-router/route.cjs'); const fs=require('fs'),os=require('os'),path=require('path'); const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'p47v-')); fs.mkdirSync(path.join(tmp,'metrics')); const rl=require('./super-gsd/scripts/lib/route-ledger.cjs'); const d=r.routeDispatch({task_kind:'extraction',uncertainty_type:'deterministic_extraction',file_count:2,line_count:50}); const ok=rl.logRouteDecision(tmp,{boundary:'dispatch_route',status:'ok',phase:'47',milestone:'v1.9',reason_codes:[d.reason],decision:{task_kind:'extraction',uncertainty_type:'deterministic_extraction',primary_provider:d.primary_provider,chosen_provider:d.provider,fallback_used:d.fallback_used}}); const rows=rl.readRows(tmp); if(d.provider!=='local-script')process.exit(1); if(!ok)process.exit(2); if(rows[0].boundary!=='dispatch_route')process.exit(3); fs.rmSync(tmp,{recursive:true,force:true}); console.log('OK');"</automated>
    <expected>route-ledger 14/14 pass; dispatch-router 15/15 pass; final smoke prints "OK" and exits 0 -- proving the end-to-end wire (router -> decision -> route-ledger envelope row -> readback) round-trips with provider='local-script' and boundary='dispatch_route'.</expected>
  </verify>
  <done>
    - super-gsd/skills/sgsd-orchestrate/SKILL.md contains a new sub-step block titled "Consult dispatch-router before Agent invocation" with the routeDispatch + logRouteDecision wire encoded in skill text.
    - The diff is PURELY ADDITIVE -- no existing skill steps modified or removed.
    - End-to-end smoke confirms: route-ledger 14/14 + dispatch-router 15/15 + the wire smoke prints OK with boundary='dispatch_route' round-tripping through the existing route-ledger envelope.
    - `git diff --quiet` over .planning/metrics/* (RO invariant intact -- canonical streams untouched).
    - Atomic commit 3 landed: `feat(47-01): SKILL.md wire -- orchestrate consults router before Agent dispatch`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| orchestrator -> router input | task_kind, uncertainty_type, file_count, line_count, role, current_role_token_spend cross from caller into router. Router validates closed-enum membership; numeric range >=0. |
| router -> codex-log.jsonl | router READS only; never writes. Tampered codex-log.jsonl can spoof "codex healthy" -- but the canonical re-probe is `codex-exec.sh --self-test` (out of Phase 47 scope). |
| router -> vtp-health.jsonl | router READS only; never writes. Same tamper surface; orchestrator SKILL Step 3.7 owns the writer. |
| router -> token-waste-status.jsonl | router READS recent rows for hint consumption; never writes. Tamper would mislead routing hints; mitigated by closed-enum filter on R1-R5 reasons. |
| router -> route-decisions.jsonl | router NEVER writes directly. Caller (orchestrator) emits via existing route-ledger.cjs::logRouteDecision public API after routeDispatch returns. |
| route-ledger.cjs BOUNDARIES extension | router code references 'dispatch_route' only as a string literal; the closed-enum check is enforced inside route-ledger appendRow. Router cannot inject a non-enum value because route-ledger throws and route-ledger's logRouteDecision wrapper catches and returns false. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-47-01 | T (Tampering) | router input uncertainty_type / task_kind | mitigate | UNCERTAINTY_TYPES + TASK_KINDS Object.freeze(); _validateInput throws on unknown member; routeDispatch wrapper catches and returns claude-fallback decision (Lock 13). Self-test assertion 11 binds. |
| T-47-02 | T (Tampering) | tampered codex-log.jsonl rows (spoof healthy) | mitigate | Router treats log row as evidence with TTL (30 min); does NOT trust as authoritative re-probe. Re-probe is codex-exec.sh --self-test owned by codex provenance (Phase 14). Tamper window bounded by TTL + cockpit visibility of route-decisions rows. |
| T-47-03 | E (Elevation) | provider injection via crafted uncertainty_type | mitigate | Frozen ROUTING_TABLE; even if uncertainty_type bypassed validation, lookup returns undefined -> default to synthesis_judgment -> claude (safe). |
| T-47-04 | I (Information disclosure) | route-decisions.jsonl decision payload | mitigate | Decision payload contains task_kind, uncertainty_type, structural_signals, context_pressure, health -- NO credentials, NO raw prompt content. Bound: structural_signals fields are integers; context_pressure fields are role+spend ratios. (Audit: router never logs input.role values that could carry user-content; role is a closed enum.) |
| T-47-05 | D (Denial of service) | repeated unhealthy-probe spinning | mitigate | TTL-bounded staleness (30 min default); router never sync-blocks on a network call (codex-log.jsonl is local file read, vtp-health.jsonl is local file read). Always returns a decision in <50ms. |
| T-47-06 | R (Repudiation) | routing choice cannot be traced | mitigate | Every decision logged via route-ledger envelope-v1 with run_id (4-hex unique per call). Decision payload includes full reasoning chain (primary_provider, chosen_provider, fallback_chain, structural_signals, context_pressure, hints_consumed). |
| T-47-07 | S (Spoofing) | caller spoofs gate_name to influence routing | mitigate | gate_name is only consulted when task_kind==='review'; resolution delegates to providers-registry::resolveReviewerProvider which validates against gates.yaml. Unknown gates resolve to null -> fall through to ROUTING_TABLE primary. |
| T-47-08 | E (Elevation) | LOCK 12 (source-file prompt injection) reaching router | accept | Router takes uncertainty_type as a frozen-enum input. Operator-supplied free text in source files cannot reach the router unless an upstream caller (intent-map, packet builder) chose to map it. Those layers enforce LOCK 12 (Phase 45 packet builder responsibility). Router is downstream of LOCK 12 enforcement; defense-in-depth via closed-enum validation handles residual risk. |
| T-47-09 | T (Tampering) | routes.yaml override file modified to inject providers | mitigate | YAML loader rejects unknown providers (validated against require('../token-attribution/report.cjs').PROVIDERS); on validation failure or YAML parse error, loadRoutes returns compiled fallback ROUTING_TABLE. ASCII-only (no homoglyph attacks via non-ASCII identifiers). |
| T-47-10 | I (Information disclosure) | health probe reads .planning/metrics/* and could leak via stderr | mitigate | All console.warn / console.error calls in router log only the operation name + e.message (never log the file content). Mirrors route-ledger.cjs:211 stderr-only error pattern. |
</threat_model>

<verification>
Phase-level verification (RESEARCH sec.14.3 LOCKED):

Per-task commit:
- `node super-gsd/tools/dispatch-router/route.cjs --self-test` exits 0 after Task 2 (15/15 pass).
- `node super-gsd/scripts/lib/route-ledger.cjs --self-test` exits 0 after Task 2 (14/14 pass).

Per-wave merge:
- Both self-tests exit 0 -- regression check confirms boundary extension didn't break Phase 32.

Phase gate (full smoke matrix):
- F1: `node super-gsd/tools/dispatch-router/route.cjs --route --uncertainty-type deterministic_extraction --task-kind extraction --file-count 2 --line-count 50 --json` -> `{"provider":"local-script","reason":"matched_uncertainty_type",...}`
- F2: `--uncertainty-type bounded_code_review --task-kind review` (with healthy codex via tail of codex-log.jsonl 2026-04-27 self-test row) -> `{"provider":"codex","reason":"matched_uncertainty_type",...}`
- F3: `--uncertainty-type synthesis_judgment --task-kind synthesis` -> `{"provider":"claude","reason":"matched_uncertainty_type",...}`
- F4: `--uncertainty-type architecture_challenge --task-kind planning` (with vtp-health.jsonl healthy tail row OR forced via test injection) -> `{"provider":"vtp",...}`
- F5: same F2 input but with codex-log.jsonl mtime forced stale (or no self-test row in last 30 min) -> `{"provider":"claude","reason":"provider_codex_unavailable","fallback_used":true,...}`
- F6: same F4 input but with vtp-health absent -> `{"provider":"claude","reason":"provider_vtp_unavailable","fallback_used":true,...}`
- F7: structural-precedence: `--uncertainty-type synthesis_judgment --task-kind extraction --file-count 2 --line-count 50` -> `{"provider":"local-script","reason":"structural_override_local_script",...}`
- F8: context-pressure: `--uncertainty-type synthesis_judgment --task-kind extraction --role researcher --current-role-token-spend 30000` -> `{"provider":"local-script","reason":"context_pressure_override_local",...}`

Closed-vocab assertions (secondary 9-15 in self-test):
- UNCERTAINTY_TYPES.length===6 frozen.
- ROUTING_TABLE 6-entry frozen with primary+fallback_chain on each.
- Closed-enum input validation never throws upward (Lock 13).
- Read-only fingerprint guard: 8 canonical paths untouched.
- route-ledger smoke: dispatch_route boundary round-trips envelope-v1.
- Hint consumption: synthetic R1 hint biases researcher synthesis_judgment to local-script.
- Pure-function determinism: same input -> identical decision (excluding ts/run_id/age_ms).

Phase 32 BOUNDARIES extension verification:
- `node -e "console.log(require('./super-gsd/scripts/lib/route-ledger.cjs').BOUNDARIES.length)"` -> 8.
- route-ledger self-test count grows by 1 (was 13, now 14).

Read-only invariant (RESEARCH sec.13):
- `git diff --quiet -- .planning/metrics/agent-token-spend.jsonl .planning/metrics/token-attribution.jsonl .planning/metrics/codex-log.jsonl .planning/metrics/token-waste-status.jsonl .planning/metrics/vtp-health.jsonl .planning/metrics/route-decisions.jsonl super-gsd/registry/review-providers.yaml super-gsd/tools/token-waste/budgets.yaml super-gsd/scripts/lib/providers-registry.cjs super-gsd/scripts/lib/gates-registry.cjs super-gsd/tools/token-waste/check.cjs super-gsd/tools/token-attribution/report.cjs` -> exit 0 (no drift).
- Phase 41-46 source files untouched (Phase 41 report.cjs, Phase 42 check.cjs, Phase 43 phase-capsule, Phase 44 legal-context-registry, Phase 45 context-packet, Phase 46 sqlite-context-index).

ASCII-only:
- `node -e "for (const f of ['super-gsd/tools/dispatch-router/route.cjs','super-gsd/tools/dispatch-router/routes.yaml']) { const c=require('fs').readFileSync(f,'utf8'); for (let i=0;i<c.length;i++){const cc=c.charCodeAt(i);if(cc>127){console.error('non-ASCII at',f,'pos',i,'cp',cc);process.exit(1);}} }"` -> exit 0.

Three atomic commits land in order:
1. `feat(47-01): dispatch-router/route.cjs + routes.yaml + 15-assertion self-test`
2. `feat(47-01): extend route-ledger/log.cjs BOUNDARIES 7->8 with 'dispatch_route'`
3. `feat(47-01): SKILL.md wire -- orchestrate consults router before Agent dispatch`

`git log --oneline -3` confirms exact subjects.
</verification>

<success_criteria>
Phase 47 SHIPPED when ALL of:

1. `super-gsd/tools/dispatch-router/route.cjs` exists, ASCII-only, ~550-700 LOC, exports the locked surface (routeDispatch + isProviderHealthy + loadRoutes + 4 frozen consts + COMMAND_NAME + ENVELOPE_VERSION).
2. `super-gsd/tools/dispatch-router/routes.yaml` exists, ASCII-only, parseable, 6-entry table matches ROUTING_TABLE compiled fallback.
3. `node super-gsd/tools/dispatch-router/route.cjs --self-test` exits 0 with "15 pass, 0 fail".
4. `node super-gsd/scripts/lib/route-ledger.cjs --self-test` exits 0 with "14 pass, 0 fail" (was 13; +1 from new dispatch_route boundary smoke assertion).
5. BOUNDARIES is exactly 8 frozen entries; 'dispatch_route' is the 8th.
6. The SKILL.md wire is in place: orchestrator dispatch path consults routeDispatch then emits envelope-v1 row via existing logRouteDecision with boundary='dispatch_route'.
7. End-to-end smoke (Task 3 verify command) prints "OK" -- proving router -> decision -> route-ledger envelope row -> readback round-trip.
8. Eight verdict-matrix CLI smoke commands (F1-F8) return the expected provider+reason pairs.
9. Read-only invariant intact: git diff --quiet on 13 canonical streams + Phase 41-46 source files.
10. Three atomic commits land in the prescribed order with the prescribed subjects.
11. Acceptance bindings traced: A1 (F1), A2 (F2), A3 (F3), A4 (F4 + F4b vtp-gating-works), A5 (F5+F6 fallback reasons logged via existing route-ledger), A6 (F7 LOCK 11 structural override), A7 (F8 KAIROS context-pressure override).
12. Lock 13 demonstrated: assertion 11 in self-test confirms invalid input returns claude-fallback with reason='router_internal_error' WITHOUT throwing upward.
13. EXISTING-SURFACE-AUDIT:139 honored: zero new ledgers; only the closed-enum BOUNDARIES extension and the existing route-decisions.jsonl additive append.
14. Phase 41 PROVIDERS, Phase 42 BUDGETS+ROUTE_REASONS, Phase 32 logRouteDecision all imported by reference -- never redefined.
15. No semantic-similarity input or branch present in route.cjs (LOCK 11 mechanically guaranteed).
</success_criteria>

<output>
After completion, create `.planning/phases/47-dispatch-routing-substitution/47-01-SUMMARY.md`
following the standard summary template. Include:
- Files created (route.cjs, routes.yaml) with line counts
- Files edited (route-ledger.cjs +1 boundary +1 selfTest count +1 new assertion; SKILL.md +1 sub-step block)
- Self-test totals (dispatch-router 15/15, route-ledger 14/14)
- Eight CLI smoke verdicts (F1-F8) one-liner each
- Read-only invariant proof: `git diff --quiet` exit 0 over the 12 paths
- Three atomic commit SHAs
- Acceptance bindings -> fixture map (A1->F1, A2->F2, A3->F3, A4->F4+F4b, A5->F5+F6, A6->F7, A7->F8)
- Open items for Phase 48: Phase 48 consumes UNCERTAINTY_TYPES (3 vtp-bound entries) + ROUTING_TABLE for vtp routes; reads decision payload showing provider='vtp' to trigger appropriate VTP MCP search tool (vtp_search_research / vtp_search / vtp_search_substrate).
</output>
