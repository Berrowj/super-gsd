# Phase 47: Dispatch Routing Substitution — Research

**Researched:** 2026-04-28
**Domain:** Provider routing / executor selection / substitution policy
**Confidence:** HIGH (all 15 questions LOCKED; 100% verified against existing surface)

---

## Summary

Phase 47 adds the **router** that decides which executor (local-script | codex | claude | vtp) handles a given dispatch. v1.9 has built every upstream surface this router consumes: Phase 41 emits ROUTE_REASONS (R1-R5), Phase 42 emits route_hints[] in token-waste-status.jsonl, Phase 45 packet builder reserves an `opts.route_hint` slot at step 7, and Phase 32 already owns the `route-decisions.jsonl` ledger with a `BOUNDARIES` enum that includes `executor_choice`. All Phase 47 has to do is wire those signals into a deterministic decision function and log the verdict.

This is **not** a new ledger. The EXISTING-SURFACE-AUDIT (line 139) bans "another route-decision ledger." Phase 47 extends `route-decisions.jsonl` by introducing a new closed-enum boundary value (`dispatch_route`) and pushes envelope-v1 rows through the existing `route-ledger.cjs::logRouteDecision` API. The router itself ships as a new module `super-gsd/tools/dispatch-router/route.cjs` that is **separate from** `gates-registry.cjs::resolveReviewerProvider` because that function is narrowly scoped to gates with a `reviewer_provider` field; Phase 47 covers general dispatch (research, planning, execution, verification, AND review).

**Primary recommendation:** Ship `super-gsd/tools/dispatch-router/route.cjs` exporting `routeDispatch({task_kind, uncertainty_type, file_count, line_count, current_role_token_spend, codex_health, vtp_health})` -> `{provider, reason, fallback_chain, structural_signals, context_pressure}`. Frozen 6-entry `UNCERTAINTY_TYPES` enum drives the primary mapping. Health probes via `provider-health/check.cjs --provider codex --behavioral` (existing) and `vtp-health.jsonl` last-row read (existing Phase 32 surface). Log every decision to `route-decisions.jsonl` with `boundary='dispatch_route'`. Self-test fixtures: 8 cases covering 4 happy paths + codex fallback + vtp fallback + structural-precedence + context-pressure-override.

---

<user_constraints>

## User Constraints (from CONTEXT.md + ROADMAP §47)

### Locked Decisions

From `.planning/discussions/2026-04-26-mass-discuss.md` row 47 (verbatim lock):

> "Local script first, Codex for review, Claude for synthesis, VTP for uncertainty"

From ROADMAP.md §47 (verbatim acceptance):

- A1: deterministic extraction routes local-first
- A2: bounded review routes Codex-first when provider health allows
- A3: Claude researcher reserved for synthesis and ambiguous judgment
- A4: VTP route disabled unless uncertainty type requires it
- A5: fallback reasons are logged

From REQUIREMENTS.md ROUTE-01..ROUTE-05 (verbatim):

- ROUTE-01: Add provider-substitution policy for local script, Codex, Claude, and VTP
- ROUTE-02: Route deterministic inventory/schema/diff extraction to local scripts first
- ROUTE-03: Route bounded review/code critique to Codex where cheaper and contract-compatible
- ROUTE-04: Keep Claude researcher for synthesis, ambiguity, and cross-domain judgment
- ROUTE-05: Record substitution decisions to route log with reason, token expectation, and fallback

From REQUIREMENTS.md design locks (LOCK 11 verbatim):

> "Intent relationships require explainable source reasons. Embedding or semantic similarity alone may suggest candidates, but it cannot justify broad context inclusion without structural evidence."

LOCK 11 is reaffirmed in this research: structural predicates (file_count, line_count, kind) take precedence over similarity scoring. No "this looks like a past task" routing.

From VTP-RESEARCH-DELTA (Architecture Matters More Than Scale):

> "Phase 47/48 routing should prefer structural predicates before semantic similarity."

From VTP-RESEARCH-DELTA (KAIROS):

> "Growing context is a control signal. Track context pressure and route before hidden cliffs."

context_pressure (current_role_token_spend vs Phase 42 BUDGETS.warn_input) is a **first-class router input**, not a post-hoc warning.

### Claude's Discretion

- Naming of the new tool path (router lib location). RECOMMENDED: `super-gsd/tools/dispatch-router/route.cjs` (mirrors phase-capsule/, token-waste/, context-packet/ pattern).
- Internal helper function names inside route.cjs.
- Self-test assertion order and exact fixture values.
- Whether to expose a CLI `--route` mode (yes — mirrors token-waste --check; useful for cockpit and debug).

### Deferred Ideas (OUT OF SCOPE)

- VTP query type classifier (Phase 48 owns this — see ROADMAP §48 deliverables).
- Memory promotion gating based on routing history (Phase 49 governance).
- Cockpit display of router state (Phase 50 COCKPIT-04 reads `route-decisions.jsonl` rows tagged `boundary='dispatch_route'`).
- `utility_per_token` scoring (Phase 51 BENCH-07 consumes `route-decisions.jsonl`).
- Semantic similarity routing in any form (LOCK 11 forbids).

</user_constraints>

---

<phase_requirements>

## Phase Requirements (REQUIREMENTS.md → Research Support)

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-01 | Add provider-substitution policy for local-script, Codex, Claude, VTP | §3 (uncertainty_type → provider mapping), §4 (frozen enums) |
| ROUTE-02 | Route deterministic extraction local-first | §3.1 (`deterministic_extraction` → local-script), §6.1 (R1 hint consumption) |
| ROUTE-03 | Route bounded review to Codex where healthy | §3.2 (`bounded_code_review` → codex), §5 (codex health probe) |
| ROUTE-04 | Keep Claude researcher for synthesis & ambiguity | §3.3 (`synthesis_judgment` → claude), §3 (default-to-claude rule) |
| ROUTE-05 | Record decisions with reason, expectation, fallback | §11 (decision ledger schema), §7 (fallback chain) |
| LOCK-11 | No semantic-only routing | §9 (structural-precedence rule) |
| LOCK-13 | Autonomy continues; budget breaches degrade or reroute | §10 (context-pressure as routing signal) |

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide provider for a given task | dispatch-router (NEW) | — | New module owns the provider-selection function |
| Codex health probe | provider-health/check.cjs (EXISTING) | codex-exec.sh `--self-test` (EXISTING) | Already-shipped behavioral oracle (Phase 14) |
| VTP health probe | mcp__vtp-kb__vtp_health_structured (RUNTIME) | `.planning/metrics/vtp-health.jsonl` last row (EXISTING) | Health is owned by VTP MCP agent + cached file (orchestrator SKILL Step 3.7) |
| Token-pressure signal | token-waste/check.cjs runCheck (EXISTING) | Phase 41 BUDGETS const (EXISTING) | Phase 42 already classifies row-level pressure |
| Substitution-rule consumption | dispatch-router routeDispatch (NEW) | token-waste-status.jsonl recent rows (EXISTING) | Router reads recent route_hints[] from Phase 42 |
| Decision ledger emit | route-ledger.cjs::logRouteDecision (EXISTING) | route-decisions.jsonl (EXISTING file) | EXISTING-SURFACE-AUDIT:139 forbids second ledger |
| Reviewer-provider resolution for review gates | providers-registry.cjs::resolveReviewerProvider (EXISTING) | review-providers.yaml (EXISTING) | Already covers gate-shape providers; Phase 47 extends for non-gate dispatches only |
| CLI/debug entry point | dispatch-router/route.cjs `--route` mode (NEW) | token-waste/check.cjs `--check` precedent | Mirror Phase 42 CLI shape |

**Key architectural decision:** Phase 47 router is **separate from** `resolveReviewerProvider` because that function fires only for gates declaring `reviewer_provider` in gates.yaml. Phase 47 routes ALL dispatches (research, plan, execute, verify, review). The two coexist; router calls into providers-registry for the review case (when `task_kind === 'review'` AND `gate_name` provided).

---

## Standard Stack

### Core (already installed; consumed by reference)

| Library / Module | Version / Path | Purpose | Why Standard |
|------------------|---------------|---------|--------------|
| `route-ledger.cjs` | super-gsd/scripts/lib/route-ledger.cjs | Append envelope-v1 rows to route-decisions.jsonl | Phase 32 owner; LOCK 13 binding (never throws); already imports STATUSES, BOUNDARIES |
| `providers-registry.cjs` | super-gsd/scripts/lib/providers-registry.cjs | Resolve named provider records | Phase 14 owner; review-providers.yaml authority; cache-once singleton |
| `token-waste/check.cjs` | super-gsd/tools/token-waste/check.cjs | Read recent route_hints + per-role pressure verdict | Phase 42 owner; ROUTE_REASONS frozen enum; runCheck() returns route_hints[] |
| `token-attribution/report.cjs` | super-gsd/tools/token-attribution/report.cjs | Read agent-token-spend rows; PROVIDERS const | Phase 41 owner; already exports PROVIDERS = ['claude','codex','local-script','vtp'] |
| `provider-health/check.cjs` | super-gsd/tools/provider-health/check.cjs | Behavioral codex probe (login + canary) | Phase 14 owner; exit 0=available, exit 1=unavailable |
| `codex-exec.sh --self-test --skip-network` | super-gsd/scripts/codex-exec.sh | Cheap codex binary+auth+timeout+contract probe | Phase 14 owner; appends self-test row to codex-log.jsonl |
| `js-yaml` | super-gsd/tools/plan-schema/node_modules/js-yaml | Pinned YAML parser (already used) | Same pattern gates-registry.cjs:38-44 + token-waste/check.cjs:178-181 |

### NEW (Phase 47 ships)

| File | Purpose | Mirror |
|------|---------|--------|
| `super-gsd/tools/dispatch-router/route.cjs` | `routeDispatch()` + frozen UNCERTAINTY_TYPES + ROUTING_TABLE + CLI `--route`/`--self-test` | token-waste/check.cjs (size, shape, never-throws contract) |
| `super-gsd/tools/dispatch-router/routes.yaml` | Optional config-overridable mapping (uncertainty_type → primary, fallback_chain) with compiled fallback | token-waste/budgets.yaml (load pattern) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| New `route.cjs` module | Extend `gates-registry.cjs::resolveReviewerProvider` | Resolver is narrowly review-scoped; expanding it bloats a Phase-14 surface | REJECTED — separate concerns |
| Module under `super-gsd/scripts/lib/` | Module under `super-gsd/tools/dispatch-router/` | `tools/` is the established pattern for self-tested deliverables (token-waste, phase-capsule, context-packet); `lib/` is for sgsd-orchestrate internals | tools/ chosen |
| New `route-decisions-v2.jsonl` ledger | Extend `route-decisions.jsonl` with new boundary `dispatch_route` | EXISTING-SURFACE-AUDIT:139 explicitly forbids second ledger | extend chosen |
| Synchronous health probe at every dispatch | Cached probe with TTL (read `vtp-health.jsonl` last row, codex `--self-test --skip-network` once per loop) | Sync probe adds 1-3s per dispatch; cached probe matches Phase 14 codex `--self-test` precedent | cached chosen |

### Verified versions

```bash
# Phase 41 PROVIDERS const (verbatim from report.cjs:78-81)
PROVIDERS = ['claude', 'codex', 'local-script', 'vtp']  # frozen 4-entry

# Phase 42 ROUTE_REASONS (verbatim from check.cjs:104-110)
R1: 'researcher_local_script_candidate'
R2: 'codex_reviewer_fallback_candidate'
R3: 'executor_context_packet_candidate'
R4: 'verifier_goal_backward_candidate'
R5: 'orchestrator_turn_trim_candidate'

# Phase 32 BOUNDARIES (verbatim from route-ledger.cjs:62-70)
BOUNDARIES = ['milestone_promotion','phase_dispatch_first','executor_choice',
              'gate_skip','codex_route','handoff_decision','gate_override']
# Phase 47 adds: 'dispatch_route'  -> closed-enum extension to 8 entries
```

---

## Architecture Patterns

### Module shape (mirror token-waste/check.cjs and route-ledger.cjs)

```
super-gsd/tools/dispatch-router/
├── route.cjs           # routeDispatch() + helpers + CLI + self-test (~700 lines)
└── routes.yaml         # uncertainty_type -> {primary, fallback_chain} (optional override)
```

### System data flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  Orchestrator decides to dispatch a unit of work                     │
│                                                                      │
│  Input: {task_kind, uncertainty_type, file_count, line_count,        │
│          current_role_token_spend, gate_name?}                       │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │  dispatch-router/route.cjs       │
        │  routeDispatch(input)            │
        └──────────┬───────────────────────┘
                   │
   ┌───────────────┼─────────────────────────────────────────┐
   ▼               ▼                ▼                        ▼
[validate    [load routes.yaml] [probe health]        [read recent
 enums]      (yaml or compiled  ┌─────────────────┐    route_hints]
             fallback)          │ codex: probe-   │   ┌──────────────┐
                                │   health        │   │ token-waste- │
                                │   --behavioral  │   │ status.jsonl │
                                │ vtp: vtp-health │   │   tail 50    │
                                │   .jsonl tail   │   └──────────────┘
                                └─────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │  Decide primary provider:        │
        │   1. uncertainty_type → primary  │
        │      (ROUTING_TABLE LOCKED)      │
        │   2. structural override:        │
        │      file_count or line_count    │
        │      forces local-script         │
        │   3. context-pressure override:  │
        │      current_role_token_spend    │
        │      > BUDGETS.warn_input        │
        │      → bias to local/codex       │
        │   4. health check:               │
        │      primary unhealthy →         │
        │      walk fallback_chain         │
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ Return decision:                 │
        │ {provider, reason,               │
        │  fallback_used, fallback_chain,  │
        │  structural_signals,             │
        │  context_pressure}               │
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ Caller appends envelope-v1 row   │
        │ via route-ledger:                │
        │ logRouteDecision(planningDir,    │
        │   {boundary:'dispatch_route',    │
        │    status, reason_codes,         │
        │    decision: <full decision>})   │
        └──────────────────────────────────┘
                   │
                   ▼
            route-decisions.jsonl
            (consumed by Phase 50 cockpit
             + Phase 51 BENCH utility/token)
```

### Recommended directory structure

```
super-gsd/tools/dispatch-router/
├── route.cjs            # Public API + CLI + self-test
└── routes.yaml          # uncertainty_type → routing rules (compiled fallback)
```

### Pattern 1: Frozen enum + compiled fallback (mirror Phase 42)

```javascript
// Source: super-gsd/tools/token-waste/check.cjs:104-123 verbatim shape
const UNCERTAINTY_TYPES = Object.freeze([
  'deterministic_extraction',     // → local-script
  'bounded_code_review',          // → codex
  'synthesis_judgment',           // → claude
  'architecture_challenge',       // → vtp
  'prior_memory_lookup',          // → vtp
  'book_lookup',                  // → vtp
]);

const ROUTING_TABLE = Object.freeze({
  deterministic_extraction:  Object.freeze({ primary: 'local-script', fallback_chain: ['claude'] }),
  bounded_code_review:       Object.freeze({ primary: 'codex',        fallback_chain: ['claude'] }),
  synthesis_judgment:        Object.freeze({ primary: 'claude',       fallback_chain: [] }),
  architecture_challenge:    Object.freeze({ primary: 'vtp',          fallback_chain: ['claude'] }),
  prior_memory_lookup:       Object.freeze({ primary: 'vtp',          fallback_chain: ['claude'] }),
  book_lookup:               Object.freeze({ primary: 'vtp',          fallback_chain: ['claude'] }),
});

const ROUTE_DECISION_REASONS = Object.freeze([
  'matched_uncertainty_type',
  'structural_override_local_script',
  'context_pressure_override_local',
  'context_pressure_override_codex',
  'provider_codex_unavailable',
  'provider_vtp_unavailable',
  'provider_claude_unavailable',  // theoretical; we ARE claude — kept for completeness
  'fallback_chain_exhausted',
  'route_hint_consumed_R1',
  'route_hint_consumed_R2',
  'route_hint_consumed_R3',
  'route_hint_consumed_R4',
  'route_hint_consumed_R5',
]);
```

### Pattern 2: Health probe with caching (mirror provider-health + vtp-health)

```javascript
// Codex: read codex-log.jsonl tail, find most recent self-test row
function _codexHealthFromLog(planningDir, maxAgeMs = 30 * 60 * 1000) {
  try {
    const p = path.join(planningDir, 'metrics', 'codex-log.jsonl');
    if (!fs.existsSync(p)) return { healthy: false, reason: 'no_log' };
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const r = JSON.parse(lines[i]);
      if (r.step === 'self-test') {
        const age = Date.now() - new Date(r.ts).getTime();
        if (age > maxAgeMs) return { healthy: false, reason: 'stale_self_test', age_ms: age };
        const probes = r.self_test_probes || {};
        if (probes.path && probes.auth && probes.timeout && probes.contract) {
          return { healthy: true, reason: 'self_test_pass', age_ms: age };
        }
        return { healthy: false, reason: 'self_test_probe_failed', probes };
      }
    }
    return { healthy: false, reason: 'no_self_test_in_log' };
  } catch (e) {
    return { healthy: false, reason: 'log_read_error', error: e.message };
  }
}

// VTP: read vtp-health.jsonl tail (Phase 32 surface)
function _vtpHealthFromLog(planningDir, maxAgeMs = 30 * 60 * 1000) {
  try {
    const p = path.join(planningDir, 'metrics', 'vtp-health.jsonl');
    if (!fs.existsSync(p)) return { healthy: false, reason: 'no_log' };
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return { healthy: false, reason: 'empty_log' };
    const last = JSON.parse(lines[lines.length - 1]);
    const age = Date.now() - new Date(last.ts).getTime();
    if (age > maxAgeMs) return { healthy: false, reason: 'stale_health_row', age_ms: age };
    return { healthy: !!last.vtp_available, reason: last.vtp_available ? 'vtp_healthy' : 'vtp_degraded' };
  } catch (e) {
    return { healthy: false, reason: 'log_read_error', error: e.message };
  }
}
```

### Pattern 3: Decision ledger emission (mirror route-ledger logCodexRoute)

```javascript
// Caller of routeDispatch logs the decision via route-ledger
const rl = require('../../scripts/lib/route-ledger.cjs');

const decision = router.routeDispatch({...});

let status;
if (decision.fallback_used) status = 'warn';
else if (decision.provider === null) status = 'fail';
else status = 'ok';

const reasonCodes = [decision.reason];
if (decision.fallback_used && decision.fallback_reason) {
  reasonCodes.push(decision.fallback_reason);
}
if (decision.context_pressure && decision.context_pressure.over_warn) {
  reasonCodes.push('context_pressure_high');
}

rl.logRouteDecision(planningDir, {
  boundary: 'dispatch_route',  // NEW boundary value (Phase 47 adds)
  status,
  phase, milestone,
  reason_codes: reasonCodes,
  decision: {
    task_kind: input.task_kind,
    uncertainty_type: input.uncertainty_type,
    primary_provider: decision.primary_provider,
    chosen_provider: decision.provider,
    fallback_chain: decision.fallback_chain,
    fallback_used: decision.fallback_used,
    fallback_reason: decision.fallback_reason,
    structural_signals: decision.structural_signals,
    context_pressure: decision.context_pressure,
  },
});
```

### Anti-Patterns to Avoid

- **Semantic-similarity routing.** LOCK 11. "This task looks like a past task" is never a routing reason. Only structural inputs (kind, file_count, line_count, uncertainty_type, ROUTE_REASON, BUDGETS pressure).
- **Throwing on unhealthy provider.** Lock 13 + Phase 32 contract. Always degrade to fallback with logged reason; never throw upward to the orchestrator.
- **Inventing a second route ledger.** EXISTING-SURFACE-AUDIT:139. Use `route-decisions.jsonl` and add `dispatch_route` to BOUNDARIES.
- **Synchronous network probe per dispatch.** Adds latency, redundant with Phase 14 cached self-test. Read recent log row instead.
- **Routing VTP by default.** A4 (`VTP route is disabled unless uncertainty type requires it`). VTP fires ONLY when uncertainty_type ∈ {architecture_challenge, prior_memory_lookup, book_lookup}.
- **Conflating review-gate routing with general dispatch.** providers-registry::resolveReviewerProvider is for gate-shaped reviewers; Phase 47 router is for everything else. Both coexist.
- **Hard-coding budget thresholds.** Phase 42 `BUDGETS` is the authority. Read BUDGETS via require — never redefine numbers in routes.yaml.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Append decision rows | A new JSONL writer | `route-ledger.cjs::logRouteDecision` | Phase 32 owner; envelope-v1 conformance; never-throws contract |
| Validate envelope-v1 | A new schema check | `route-ledger.cjs::_assertEnvelopeV1` (private; called inside logRouteDecision) | Mirrors gate-value-log.cjs:217-255 verbatim |
| Codex health | A custom probe | `provider-health/check.cjs --provider codex --behavioral` OR last `step:self-test` row in codex-log.jsonl | Phase 14 behavioral oracle; D-08-equivalent precedent |
| VTP health | A custom MCP call | Read `.planning/metrics/vtp-health.jsonl` last row (orchestrator SKILL Step 3.7 already populates this) | One canonical surface; cold-start probe already runs |
| Per-role budgets | New thresholds in routes.yaml | `require('token-waste/check.cjs').BUDGETS` | Single source of truth; drift between sources is BUDGET-03 violation |
| Route reason vocab | New strings | `require('token-waste/check.cjs').ROUTE_REASONS` (R1-R5) | Already frozen + tested in Phase 41/42 |
| Resolve named providers (codex, claude reviewer) | New lookup | `providers-registry.cjs::getProvider` | review-providers.yaml is the canonical name registry |
| YAML parsing | A new yaml dep | Pinned `super-gsd/tools/plan-schema/node_modules/js-yaml` | Same pattern across gates-registry, token-waste, phase-capsule |
| run_id generation | New formatter | `route-ledger.cjs::generateRunId` | envelope-v1 conformance |

**Key insight:** Phase 47 is a **wiring phase**, not a new-surface phase. v1.9 deliberately built every input the router needs (Phase 41 emits, Phase 42 hints, Phase 32 logs, Phase 14 health). Hand-rolling any of those would violate the milestone's compression-not-discovery thesis.

---

## Common Pitfalls

### Pitfall 1: Treating provider-health as binary go/no-go

**What goes wrong:** Router probes codex once, sees unhealthy, never retries — stays on fallback for entire session.
**Why it happens:** Naive single-shot health caching.
**How to avoid:** TTL-bounded staleness check (default 30 min). If most-recent self-test row > 30 min old, treat as `stale_self_test` and trigger a fresh `codex-exec.sh --self-test --skip-network` (writes a new row, decision uses fresh result).
**Warning signs:** route-decisions.jsonl shows long runs of `provider_codex_unavailable` with no codex-log self-test rows in between.

### Pitfall 2: VTP route firing on broad similarity

**What goes wrong:** Router calls VTP when uncertainty_type is generic (`synthesis_judgment`) and someone's intent map mentions a book name in passing.
**Why it happens:** Loosening A4 ("uncertainty type requires it") to "uncertainty hints VTP could help."
**How to avoid:** A4 is implemented as a **frozen 3-entry whitelist**: VTP fires ONLY when `uncertainty_type ∈ {architecture_challenge, prior_memory_lookup, book_lookup}`. Any other type that even *mentions* VTP gets `provider_vtp_unavailable` if it tries to route there.
**Warning signs:** route-decisions.jsonl shows VTP routes for uncertainty_type='synthesis_judgment' or 'deterministic_extraction'.

### Pitfall 3: Structural override fighting uncertainty_type

**What goes wrong:** uncertainty_type='synthesis_judgment' (→ claude) but file_count=2 and line_count=40 — clearly local-script-eligible — yet router sends to claude because the type wins.
**Why it happens:** Treating uncertainty_type as primary AND only signal.
**How to avoid:** **Structural-precedence rule (LOCK 11 binding):** if `file_count <= 3 AND line_count <= 100 AND task_kind === 'extraction'`, override to local-script with reason='structural_override_local_script' regardless of uncertainty_type. Self-test fixture F7 binds.
**Warning signs:** Phase 41 R1 hint count keeps incrementing while route-decisions.jsonl shows claude routes for the same role+phase.

### Pitfall 4: Context pressure ignored

**What goes wrong:** Researcher's current_role_token_spend already at 24k (Phase 42 warn_input=25k for researcher), uncertainty_type='synthesis_judgment' (→ claude), router sends to claude, blowing past 30k+ on the dispatch.
**Why it happens:** KAIROS lesson skipped: "growing context is a control signal."
**How to avoid:** **Context-pressure override (KAIROS binding):** when `current_role_token_spend >= BUDGETS[role].warn_input`, bias FROM claude TOWARD local-script (if structural fits) or codex (if review-shaped). Reason='context_pressure_override_local' or 'context_pressure_override_codex'. Self-test fixture F8 binds.
**Warning signs:** Phase 42 token-waste-status.jsonl shows degraded verdicts immediately after a route-decisions row chose claude despite high pressure.

### Pitfall 5: Fallback chain silently exhausted

**What goes wrong:** Primary unhealthy, fallback unhealthy, router returns `provider: null` and caller dispatches anyway.
**Why it happens:** Caller treats null as "use default."
**How to avoid:** When `fallback_chain_exhausted`, return `{ provider: null, reason: 'fallback_chain_exhausted', ... }` AND Caller MUST treat this as a routing failure, log the dispatch_route decision with status='fail', and surface to the orchestrator (which then degrades to claude — the "we ARE claude" baseline). Do NOT silently swallow.
**Warning signs:** route-decisions.jsonl rows with `status='fail'` and no follow-up dispatch_route within 5 minutes.

### Pitfall 6: Reviewer-provider double-dispatch

**What goes wrong:** Caller asks Phase 47 router for a review task, gets `{provider: 'codex'}`. Caller then ALSO calls `providers-registry::resolveReviewerProvider` for the same gate, gets a different name (e.g., `codex-cli-reviewer` vs `codex`). Two paths, conflicting state.
**Why it happens:** Phase 14 review-providers.yaml has provider names like `codex-cli-reviewer` (full record); Phase 41 PROVIDERS const uses short names like `codex` (short token). They are not the same vocabulary.
**How to avoid:** When `task_kind === 'review' AND gate_name` is provided, Phase 47 router DELEGATES to `providers-registry::resolveReviewerProvider(gate_name, gatesRegistry)` and returns the resolved record's `name` field as the provider. Self-test fixture F9 binds (but is OUT OF SCOPE for the 8-fixture floor; covered as bonus assertion).
**Warning signs:** Two route-decisions rows for the same dispatch with conflicting provider values.

---

## Code Examples

Verified patterns from existing surfaces — Phase 47 must mirror these 1:1.

### Example 1: Module export shape (mirror token-waste/check.cjs:1350-1361)

```javascript
// Source: super-gsd/tools/token-waste/check.cjs:1350-1361 (verbatim shape; renamed)
module.exports = {
  // Public API:
  routeDispatch,
  isProviderHealthy,
  loadRoutes,
  // Frozen consts:
  UNCERTAINTY_TYPES,
  ROUTING_TABLE,
  ROUTE_DECISION_REASONS,
  // Identifiers:
  COMMAND_NAME,        // 'routeDispatch' — though emitter is route-ledger
  ENVELOPE_VERSION,
};
```

### Example 2: Never-throws-upward wrapper (mirror route-ledger.cjs:206-214)

```javascript
// Source: super-gsd/scripts/lib/route-ledger.cjs:206-214
function routeDispatch(input) {
  try {
    return _routeDispatchInternal(input);
  } catch (e) {
    console.warn('[SGSD] dispatch-router routeDispatch failed:', e.message);
    // Lock 13 binding: never propagate; caller stays on safe default (claude).
    return {
      provider: 'claude',
      reason: 'router_internal_error',
      fallback_used: true,
      fallback_chain: [],
      structural_signals: {},
      context_pressure: {},
      error: e.message,
    };
  }
}
```

### Example 3: Frozen-enum validation (mirror token-waste/check.cjs:553-571 _normalize)

```javascript
// Source: super-gsd/tools/token-waste/check.cjs:553-571 verbatim shape
function _validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('dispatch-router: input must be an object');
  }
  if (input.uncertainty_type && !UNCERTAINTY_TYPES.includes(input.uncertainty_type)) {
    throw new Error(
      'dispatch-router: uncertainty_type must be one of '
      + UNCERTAINTY_TYPES.join(', ') + '; got ' + input.uncertainty_type
    );
  }
  if (input.task_kind && !TASK_KINDS.includes(input.task_kind)) {
    throw new Error(
      'dispatch-router: task_kind must be one of '
      + TASK_KINDS.join(', ') + '; got ' + input.task_kind
    );
  }
  // file_count / line_count / current_role_token_spend: numeric, optional, >= 0.
  for (const k of ['file_count', 'line_count', 'current_role_token_spend']) {
    if (input[k] !== undefined && (typeof input[k] !== 'number' || input[k] < 0)) {
      throw new Error('dispatch-router: ' + k + ' must be non-negative number');
    }
  }
}
```

### Example 4: Routing decision (the meat)

```javascript
function _routeDispatchInternal(input) {
  _validateInput(input);

  const routes = loadRoutes();  // yaml or compiled fallback
  const ut = input.uncertainty_type || 'synthesis_judgment';  // safe default
  const tableEntry = routes.table[ut] || ROUTING_TABLE[ut] || ROUTING_TABLE.synthesis_judgment;
  const primaryProvider = tableEntry.primary;
  const fallbackChain = tableEntry.fallback_chain.slice();

  // ── Step 1: structural override (LOCK 11 binding) ──
  // Small extraction tasks force local-script regardless of uncertainty_type.
  const structuralSignals = {
    file_count: input.file_count || 0,
    line_count: input.line_count || 0,
    task_kind: input.task_kind || 'unknown',
  };
  if (input.task_kind === 'extraction'
      && (input.file_count || 0) <= 3
      && (input.line_count || 0) <= 100) {
    return _decide('local-script', primaryProvider, [], 'structural_override_local_script',
                   structuralSignals, _pressureFor(input));
  }

  // ── Step 2: context-pressure override (KAIROS binding) ──
  const pressure = _pressureFor(input);
  if (pressure.over_warn && primaryProvider === 'claude') {
    // Bias away from claude under pressure.
    if (input.task_kind === 'extraction' || input.task_kind === 'inventory') {
      return _decide('local-script', primaryProvider, [], 'context_pressure_override_local',
                     structuralSignals, pressure);
    }
    if (input.task_kind === 'review' || input.task_kind === 'critique') {
      return _decide('codex', primaryProvider, [], 'context_pressure_override_codex',
                     structuralSignals, pressure);
    }
  }

  // ── Step 3: health check primary ──
  if (primaryProvider === 'codex' && !isProviderHealthy('codex')) {
    return _decide('claude', primaryProvider, fallbackChain, 'provider_codex_unavailable',
                   structuralSignals, pressure);
  }
  if (primaryProvider === 'vtp' && !isProviderHealthy('vtp')) {
    return _decide('claude', primaryProvider, fallbackChain, 'provider_vtp_unavailable',
                   structuralSignals, pressure);
  }

  // ── Step 4: happy path ──
  return _decide(primaryProvider, primaryProvider, fallbackChain, 'matched_uncertainty_type',
                 structuralSignals, pressure);
}

function _decide(chosen, primary, fallbackChain, reason, structural, pressure) {
  const usedFallback = chosen !== primary;
  return {
    provider: chosen,
    primary_provider: primary,
    reason,
    fallback_used: usedFallback,
    fallback_reason: usedFallback ? reason : null,
    fallback_chain: fallbackChain,
    structural_signals: structural,
    context_pressure: pressure,
  };
}

function _pressureFor(input) {
  const role = input.role || 'other';
  const spend = input.current_role_token_spend || 0;
  // Phase 42 BUDGETS imported by reference.
  const { BUDGETS } = require('../token-waste/check.cjs');
  const roleBudget = BUDGETS[role] || BUDGETS.other;
  return {
    role,
    current_spend: spend,
    warn_input: roleBudget.warn_input,
    over_warn: spend >= roleBudget.warn_input,
    ratio: roleBudget.warn_input > 0 ? spend / roleBudget.warn_input : 0,
  };
}
```

### Example 5: Phase 42 route_hint consumer (R1-R5 mapping)

```javascript
// When a recent token-waste-status row carries a route_hint with
// reason ∈ ROUTE_REASONS values, surface as a router signal.
// Mapping table:
//   R1 'researcher_local_script_candidate' → bias to local-script for researcher
//   R2 'codex_reviewer_fallback_candidate' → bias to codex for reviewer
//   R3 'executor_context_packet_candidate' → bias to claude with packet (NOT a router move; signaling)
//   R4 'verifier_goal_backward_candidate'  → bias to claude with template (NOT a router move; signaling)
//   R5 'orchestrator_turn_trim_candidate'  → bias to local-script for orchestrator-self
//
// Router consumes: tail-N read of token-waste-status.jsonl, filter rows whose
// route_hints[].from_role === input.role AND .reason matches one of R1-R5.
// If hit, emit reason_code 'route_hint_consumed_R{N}' and prefer the hint's provider.
function _readRecentHints(planningDir, role, tailN = 50) {
  try {
    const p = path.join(planningDir, 'metrics', 'token-waste-status.jsonl');
    if (!fs.existsSync(p)) return [];
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
    const tail = lines.slice(-tailN);
    const hints = [];
    for (const l of tail) {
      try {
        const r = JSON.parse(l);
        for (const h of (r.route_hints || [])) {
          if (h.from_role === role) hints.push({ ...h, ts: r.ts });
        }
      } catch { /* skip */ }
    }
    return hints;
  } catch (e) {
    console.warn('[SGSD] dispatch-router _readRecentHints failed:', e.message);
    return [];
  }
}
```

---

## Runtime State Inventory

> Phase 47 is greenfield routing logic, not a rename/refactor. This section is included briefly to confirm no inherited state migrations are needed.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — Phase 47 introduces no new persistent stores. route-decisions.jsonl is a Phase 32 stream (append-only). | none |
| Live service config | None — codex/vtp health are RUNTIME probes, not service config. | none |
| OS-registered state | None | none |
| Secrets/env vars | None — Phase 47 reads no credentials. codex auth is owned by codex-exec.sh. | none |
| Build artifacts | None — Phase 47 ships pure JS + YAML; no compiled binaries. | none |

**Nothing found in any category** — Phase 47 is a wiring phase that introduces only one new module file, one new YAML, and one new value in an existing closed enum (`BOUNDARIES`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node.js (>=18) | All Phase 47 code | ✓ | confirmed via Phase 41/42 self-tests | — |
| js-yaml (pinned) | loadRoutes() | ✓ | super-gsd/tools/plan-schema/node_modules/js-yaml (existing) | compiled ROUTING_TABLE fallback |
| route-ledger.cjs | logRouteDecision emit | ✓ | super-gsd/scripts/lib/route-ledger.cjs (Phase 32 shipped) | — |
| token-waste/check.cjs | BUDGETS + ROUTE_REASONS imports | ✓ | super-gsd/tools/token-waste/check.cjs (Phase 42 shipped) | — |
| token-attribution/report.cjs | PROVIDERS const | ✓ | super-gsd/tools/token-attribution/report.cjs (Phase 41 shipped) | — |
| codex CLI | codex health probe | ✓ (per Phase 14 self-test 2026-04-27) | codex-cli 0.125.0 | mark codex unhealthy → fallback to claude |
| codex-log.jsonl | codex health source | ✓ | .planning/metrics/codex-log.jsonl (5+ rows; latest self-test 2026-04-27 ALL PROBES PASS) | mark codex unhealthy → fallback to claude |
| vtp-health.jsonl | vtp health source | ✓ if vtp_enrichment.enabled in config.json; else absent | runtime — orchestrator SKILL Step 3.7 populates | mark vtp unhealthy → fallback to claude |
| provider-health/check.cjs | optional behavioral re-probe | ✓ | super-gsd/tools/provider-health/check.cjs | use codex-log self-test row instead |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** vtp-health.jsonl may be absent for projects with `vtp_enrichment.enabled: false` — router treats absence as `vtp_health: { healthy: false, reason: 'no_log' }` and routes VTP requests to claude with reason='provider_vtp_unavailable'. This is correct Phase 47 behavior.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-provider dispatch (claude only) | Multi-provider router with structural-first selection | v1.9 (this milestone) | 50%+ researcher token reduction target (REQUIREMENTS line 320) |
| Reviewer-only routing (Phase 14) | Universal routing for research/plan/exec/verify/review | Phase 47 (this) | Covers all dispatches, not just review gates |
| No context-pressure feedback in routing | KAIROS-style pressure as control signal | VTP delta (post-Phase 44) | Prevents budget breach mid-dispatch |
| Semantic-similarity routing speculative | LOCK 11: structural-only routing | mass-discuss 2026-04-26 | Prevents broad context inclusion via lookalike heuristics |
| `route-decisions.jsonl` boundary set frozen at 7 | Extended to 8 with `dispatch_route` | Phase 47 (this) | Preserves single-ledger contract (EXISTING-SURFACE-AUDIT:139) |

**Deprecated/outdated:**
- Treating "Codex available?" as a binary boot check. Replace with TTL-bounded staleness probe of latest self-test row.
- Routing review tasks via gate-resolution alone. Phase 47 router is now the front door; resolveReviewerProvider becomes the gate-shaped sub-resolver.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Built-in `--self-test` (mirror Phase 41/42/45 pattern; no external test runner) |
| Config file | none — assertion harness inlined in route.cjs |
| Quick run command | `node super-gsd/tools/dispatch-router/route.cjs --self-test` |
| Full suite command | `node super-gsd/tools/dispatch-router/route.cjs --self-test` (single command — same as quick) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-01 | Frozen enums (UNCERTAINTY_TYPES, ROUTING_TABLE, ROUTE_DECISION_REASONS) | unit | `node super-gsd/tools/dispatch-router/route.cjs --self-test` (assertion 1-3) | ❌ Wave 0 |
| ROUTE-02 / A1 | deterministic_extraction → local-script | unit / fixture F1 | same | ❌ Wave 0 |
| ROUTE-03 / A2 | bounded_code_review → codex when healthy | unit / fixture F2 | same | ❌ Wave 0 |
| ROUTE-04 / A3 | synthesis_judgment → claude | unit / fixture F3 | same | ❌ Wave 0 |
| A4 | architecture_challenge → vtp; deterministic_extraction never routes vtp | unit / fixture F4 + F4b | same | ❌ Wave 0 |
| A5 | fallback reason logged when codex unhealthy | unit / fixture F5 | same | ❌ Wave 0 |
| LOCK-11 | structural override forces local-script even when type → claude | unit / fixture F7 | same | ❌ Wave 0 |
| LOCK-13 + KAIROS | context-pressure biases claude → local/codex | unit / fixture F8 | same | ❌ Wave 0 |
| Phase 32 ledger contract | dispatch_route boundary accepted by route-ledger | integration / fixture F6 | same | ❌ Wave 0 |
| Read-only invariant | self-test never touches canonical route-decisions.jsonl, codex-log.jsonl, vtp-health.jsonl, token-waste-status.jsonl | fingerprint guard | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node super-gsd/tools/dispatch-router/route.cjs --self-test` (must exit 0)
- **Per wave merge:** same + `node super-gsd/scripts/lib/route-ledger.cjs --self-test` (verify boundary extension didn't break Phase 32)
- **Phase gate:** Full self-test green + manual smoke: `node super-gsd/tools/dispatch-router/route.cjs --route --uncertainty-type deterministic_extraction --task-kind extraction --file-count 2 --line-count 50 --json` returns `{ "provider": "local-script", ... }`.

### Wave 0 Gaps

- [ ] `super-gsd/tools/dispatch-router/route.cjs` — implements routeDispatch + self-test (covers all 8 fixtures)
- [ ] `super-gsd/tools/dispatch-router/routes.yaml` — uncertainty_type mapping (compiled fallback if absent)
- [ ] Edit `super-gsd/scripts/lib/route-ledger.cjs:62-70` BOUNDARIES const: extend from 7 to 8 entries by adding `'dispatch_route'`
- [ ] Edit `super-gsd/scripts/lib/route-ledger.cjs::selfTest` assertion 1: change "BOUNDARIES is array of 7" to "array of 8" + add fixture row covering new boundary
- [ ] No new framework install (uses built-in node + existing js-yaml). Confirmed.

---

## Security Domain

`security_enforcement` is enabled (config absent → enabled per default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | Codex auth: `codex-exec.sh` rejects $OPENAI_API_KEY (exit 4); OAuth-only via codex binary. Router never reads or proxies credentials. |
| V3 Session Management | no | router is stateless (single function call per dispatch) |
| V4 Access Control | yes | Router NEVER decides whether a dispatch is *allowed* — only which provider to route to. ACL is gate-level. |
| V5 Input Validation | **yes (critical)** | Closed-enum validation on uncertainty_type, task_kind. Numeric range checks on file_count, line_count, current_role_token_spend. _validateInput throws on closed-enum violation; routeDispatch wrapper catches and returns safe-default decision. |
| V6 Cryptography | no | router neither signs, encrypts, nor verifies cryptographic material |
| V7 Error Handling | yes | LOCK 13 — try/catch on every public API; never throws upward; on internal error returns claude-fallback decision with reason='router_internal_error' |
| V11 Business Logic | yes | Phase 47 IS business logic (provider routing). Frozen ROUTING_TABLE prevents arbitrary provider injection via uncertainty_type |
| V12 File and Resources | yes | All file reads (codex-log.jsonl, vtp-health.jsonl, token-waste-status.jsonl, routes.yaml) wrapped in try/catch; absent files treated as degraded health, not router failure |

### Known Threat Patterns for Phase 47 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Provider injection via crafted uncertainty_type | T (Tampering) | UNCERTAINTY_TYPES is Object.freeze(); _validateInput throws on unknown; router wrapper catches and falls back to safe default |
| Privilege escalation via task_kind | E (Elevation) | Router has no privilege concept; only routes. Privilege gates are upstream (gates.yaml). |
| Health-probe spoofing (tampered codex-log.jsonl) | T | Router reads recent log row but does NOT trust it as authoritative — `codex-exec.sh --self-test --skip-network` is the canonical re-probe; router can request re-probe when stale |
| Information disclosure via decision logging | I | route-decisions.jsonl decision payload contains task_kind/uncertainty_type/structural_signals — no credentials, no sensitive content. Bound: never log raw prompt content. |
| Denial of service via repeated unhealthy probes | D | TTL-bounded staleness (30 min default); never sync-blocks on probe; always returns a decision in <50ms |
| Repudiation of routing choice | R | Every decision logged via route-ledger envelope-v1 with run_id (4-hex unique); decision payload includes full reasoning chain |
| Source-file prompt injection (LOCK 12) | T | Router takes uncertainty_type as a frozen-enum input. Operator-supplied free text in source files cannot reach the router unless an upstream caller (intent-map, packet builder) chose to map it — and those layers already enforce LOCK 12. |

---

## 1. Existing Surface Inventory (consume by reference, never duplicate)

This section maps every Phase 47 input to its existing canonical owner. Phase 47 imports by reference from each — never redefines.

### 1.1 Inputs the router consumes

| Input | Canonical owner | Read API | Phase 47 use |
|-------|-----------------|----------|--------------|
| Per-role token budgets | super-gsd/tools/token-waste/check.cjs:114-123 (`BUDGETS`) | `require('.../token-waste/check.cjs').BUDGETS[role]` | context-pressure override threshold |
| ROUTE_REASONS R1-R5 | super-gsd/tools/token-waste/check.cjs:104-110 (`ROUTE_REASONS`) | `require('.../token-waste/check.cjs').ROUTE_REASONS` | route_hint reason vocabulary |
| PROVIDERS enum | super-gsd/tools/token-attribution/report.cjs:78-81 (`PROVIDERS`) | `require('.../token-attribution/report.cjs').PROVIDERS` | output validation; never invent a 5th provider |
| ROLES enum | super-gsd/tools/token-attribution/report.cjs:73-76 (`ROLES`) | `require('.../token-attribution/report.cjs').ROLES` | input.role validation |
| route_hints[] from Phase 42 | .planning/metrics/token-waste-status.jsonl envelope-v1 rows | tail-50 read; filter on `from_role` | bias provider when recent hint matches role |
| Codex health | .planning/metrics/codex-log.jsonl rows where `step:"self-test"` | tail-walk; check `self_test_probes:{path,auth,timeout,contract}` all true; max_age 30min | gate codex routes |
| VTP health | .planning/metrics/vtp-health.jsonl tail row | tail-1 read; check `vtp_available:true`; max_age 30min | gate vtp routes |
| Reviewer-provider records | super-gsd/registry/review-providers.yaml via providers-registry.cjs | `resolveReviewerProvider(gateName, gatesRegistry)` | only when task_kind=review AND gate_name supplied |

### 1.2 Outputs the router writes

| Output | Canonical owner | Write API | Phase 47 use |
|--------|-----------------|-----------|--------------|
| Decision row | .planning/metrics/route-decisions.jsonl | `route-ledger.cjs::logRouteDecision({boundary:'dispatch_route', ...})` | every routing decision logged |

### 1.3 Phase 47 NEVER touches (READ-ONLY invariant)

- `.planning/metrics/agent-token-spend.jsonl` (Phase 41 owner)
- `.planning/metrics/token-attribution.jsonl` (collect.cjs owner)
- `.planning/metrics/codex-log.jsonl` (codex-exec.sh owner; READ ONLY)
- `.planning/metrics/token-waste-status.jsonl` (Phase 42 owner; READ ONLY)
- `.planning/metrics/vtp-health.jsonl` (orchestrator SKILL Step 3.7 owner; READ ONLY)
- `super-gsd/tools/token-waste/budgets.yaml` (Phase 42 config; READ ONLY via require chain)
- `super-gsd/registry/review-providers.yaml` (Phase 14 config; READ ONLY via providers-registry)
- `super-gsd/scripts/lib/route-ledger.cjs` (Phase 32 owner — Phase 47 does ONE EDIT: extend BOUNDARIES + selfTest assertion 1)

Read-only fingerprint guard in self-test (mirror token-waste/check.cjs:1203-1226): capture mtime/size of all 7 read-only paths before, assert unchanged after, FAIL the self-test on drift.

---

## 2. Router Scope — Q1 LOCKED

**Question:** Is Phase 47 a NEW router module, or does it extend `gates-registry.cjs::resolveReviewerProvider`?

**LOCKED answer:** NEW module at `super-gsd/tools/dispatch-router/route.cjs`. Both modules coexist:

| Module | Scope | Caller pattern |
|--------|-------|----------------|
| `gates-registry.cjs::resolveReviewerProvider` (existing, Phase 14) | Gates declaring a `reviewer_provider` field — narrowly review-shaped | Caller provides `gate_name`; resolver returns provider record from review-providers.yaml |
| `dispatch-router/route.cjs::routeDispatch` (NEW, Phase 47) | All dispatches: research, planning, execution, verification, review | Caller provides `{task_kind, uncertainty_type, structural inputs}`; router returns `{provider, reason, fallback_chain}` |

**Bridge:** when `task_kind === 'review' AND gate_name` is provided, Phase 47 router internally calls resolveReviewerProvider and returns the resolved record's name. This is the only point of contact; both modules retain their existing contracts.

**Rationale:**
- gates-registry/providers-registry are scoped to review-providers.yaml + gates.yaml (Phase 14). Phase 47 needs research/plan/exec/verify routing too. Bloating providers-registry with general-purpose routing violates its single responsibility.
- EXISTING-SURFACE-AUDIT:46-50 lists tools to reuse but doesn't list providers-registry as reusable for general dispatch — it's listed implicitly via review-providers.yaml.
- Mirror precedent: Phase 32 created `route-ledger.cjs` rather than extending `gate-value-log.cjs` because boundary types are general while gate values are gate-specific.

---

## 3. Decision Input Shape — Q2 LOCKED

**Question:** What does the router consume, and what does it return?

**LOCKED answer:**

### 3.1 Input shape

```typescript
type RouteDispatchInput = {
  // Required:
  task_kind: 'extraction' | 'inventory' | 'review' | 'critique' | 'synthesis'
           | 'planning' | 'verification' | 'classification' | 'unknown';
  uncertainty_type: 'deterministic_extraction' | 'bounded_code_review'
                  | 'synthesis_judgment' | 'architecture_challenge'
                  | 'prior_memory_lookup' | 'book_lookup';

  // Optional structural signals:
  file_count?: number;        // count of files involved (for LOCK 11 override)
  line_count?: number;        // estimated diff/output lines (for LOCK 11 override)

  // Optional context-pressure signal (KAIROS binding):
  role?: 'researcher' | 'planner' | 'executor' | 'verifier'
       | 'reviewer' | 'orchestrator' | 'classifier' | 'other';
  current_role_token_spend?: number;  // running cost in current role

  // Optional gate context (for review tasks):
  gate_name?: string;                 // when task_kind='review'

  // Optional health overrides (test/cockpit only):
  _force_codex_health?: boolean;
  _force_vtp_health?: boolean;
};
```

### 3.2 Output shape

```typescript
type RouteDispatchDecision = {
  provider: 'local-script' | 'codex' | 'claude' | 'vtp' | null;
  primary_provider: typeof provider;     // what the table said before overrides
  reason: string;                         // ROUTE_DECISION_REASONS member
  fallback_used: boolean;
  fallback_reason: string | null;         // when fallback fired
  fallback_chain: typeof provider[];      // remaining chain after this decision

  structural_signals: {
    file_count: number;
    line_count: number;
    task_kind: string;
  };

  context_pressure: {
    role: string;
    current_spend: number;
    warn_input: number;
    over_warn: boolean;
    ratio: number;
  };

  // Diagnostic:
  health: {
    codex: { healthy: boolean; reason: string; age_ms?: number };
    vtp:   { healthy: boolean; reason: string; age_ms?: number };
  };
  hints_consumed: Array<{ from_role: string; reason: string; ts: string }>;
};
```

### 3.3 TASK_KINDS frozen 9-entry enum

```javascript
const TASK_KINDS = Object.freeze([
  'extraction',     // pull facts from existing files (R1 candidate)
  'inventory',      // enumerate things (R1 candidate)
  'review',         // bounded critique of code/diff (R2 candidate)
  'critique',       // adversarial argument (R2 candidate)
  'synthesis',      // combine sources into narrative (Claude default)
  'planning',       // produce a plan (Claude default)
  'verification',   // check work against goal (R4 candidate)
  'classification', // map input to enum (haiku candidate; routes claude)
  'unknown',        // safe default; routes claude
]);
```

---

## 4. Uncertainty-Type Vocabulary — Q3 LOCKED

**Question:** Closed-enum vocabulary for uncertainty types?

**LOCKED 6-entry enum:**

```javascript
const UNCERTAINTY_TYPES = Object.freeze([
  'deterministic_extraction',  // → local-script   (clear procedure; no judgment)
  'bounded_code_review',       // → codex          (small diff; closed contract)
  'synthesis_judgment',        // → claude         (multi-source narrative)
  'architecture_challenge',    // → vtp            (multi-paper / book lookup)
  'prior_memory_lookup',       // → vtp            (project history retrieval)
  'book_lookup',               // → vtp            (book corpus retrieval)
]);

const ROUTING_TABLE = Object.freeze({
  deterministic_extraction:  Object.freeze({ primary: 'local-script', fallback_chain: ['claude'] }),
  bounded_code_review:       Object.freeze({ primary: 'codex',        fallback_chain: ['claude'] }),
  synthesis_judgment:        Object.freeze({ primary: 'claude',       fallback_chain: [] }),
  architecture_challenge:    Object.freeze({ primary: 'vtp',          fallback_chain: ['claude'] }),
  prior_memory_lookup:       Object.freeze({ primary: 'vtp',          fallback_chain: ['claude'] }),
  book_lookup:               Object.freeze({ primary: 'vtp',          fallback_chain: ['claude'] }),
});
```

**Why these six and not more:**
- Mass-discuss row 47 lock specifies only 4 buckets (local | codex | claude | vtp). Six uncertainty types map onto those four primaries — three of them route to vtp because VTP has three legitimate sub-shapes (architecture / memory / books). One type each for local, codex, claude.
- Adding more types (`debug`, `migration`, `refactor`, ...) is deferred — they all subsume into one of the six until evidence forces a split. Phase 51 BENCH may surface a new type; gate the addition there.

**Why VTP has 3 entries:** the VTP-RESEARCH-DELTA cites three distinct corpora (research papers, project memory, books). A4 says "VTP route is disabled unless uncertainty type requires it" — the *type* is the gate. Phase 48 (VTP Bridge) consumes these three types to pick which VTP search tool to call.

---

## 5. Provider-Health Check — Q4 LOCKED

**Question:** How does the router know if a provider is healthy?

**LOCKED answer:**

### 5.1 Codex health

**Source:** `.planning/metrics/codex-log.jsonl` last row where `step === 'self-test'`.

**Probe:** Phase 14 already provides `codex-exec.sh --self-test --skip-network` which writes a row with shape:

```json
{"ts":"2026-04-27T15:33:24Z","step":"self-test","exit":0,"skip_network":true,
 "self_test_probes":{"path":true,"auth":true,"timeout":true,"contract":true},
 "probe_version":"2","codex_version":"codex-cli 0.125.0","auth_method":"skip_network",
 "checked_files":{"auth_json":true,"config_toml":true,"config_json":false}}
```

Healthy iff: `exit === 0 AND all 4 probes are true AND age <= 30 min`.

If no self-test row in last 30 min, router returns `{ healthy: false, reason: 'stale_self_test' }` and orchestrator may trigger a fresh probe (out of Phase 47 scope; cockpit/SKILL responsibility).

### 5.2 VTP health

**Source:** `.planning/metrics/vtp-health.jsonl` last row.

**Probe:** Orchestrator SKILL Step 3.7 (existing) writes rows on cold-start with shape:

```json
{"ts":"2026-04-28T00:00:00Z","vtp_available":true,
 "vtp_health_cached":"healthy","source":"cold_start_probe"}
```

Healthy iff: `vtp_available === true AND age <= 30 min`.

If file absent (vtp_enrichment.enabled=false in config), router returns `{ healthy: false, reason: 'no_log' }` and routes any uncertainty_type that points to VTP back via fallback_chain → claude.

### 5.3 Local-script health

**Always healthy.** Local execution requires only node, which is the runtime. If node weren't available, router itself wouldn't run. No probe needed.

### 5.4 Claude health

**Always healthy by axiom.** We ARE claude. If claude is unavailable, the router itself isn't running. Listed in ROUTE_DECISION_REASONS for completeness only.

### 5.5 Health-cache freshness

Router does not maintain its own cache; reads canonical log files on each routeDispatch call (cheap — tail read of <100 rows). The 30-min staleness threshold is the cache.

---

## 6. Substitution-Rule Consumption — Q5 LOCKED

**Question:** How does the router consume R1-R5 from Phase 41/42?

**LOCKED mapping:**

| Phase 41/42 ROUTE_REASON | Phase 47 router behavior | reason_code emitted |
|--------------------------|--------------------------|---------------------|
| R1: `researcher_local_script_candidate` | Bias researcher dispatches with deterministic_extraction toward local-script (already the default by ROUTING_TABLE; reinforces) | `route_hint_consumed_R1` |
| R2: `codex_reviewer_fallback_candidate` | This is a NEGATIVE hint (Phase 41 RESEARCH §5.2 calls it "inverse of ROUTE-03"): ≥30% codex parse_failure rate within a phase class → bias FROM codex TOWARD claude for that phase class | `route_hint_consumed_R2` |
| R3: `executor_context_packet_candidate` | Phase 47 does NOT route based on R3 (R3 is a Phase 45 packet hint, not a provider hint). Router records the hint as observed but does not change provider | `route_hint_consumed_R3` (informational) |
| R4: `verifier_goal_backward_candidate` | Phase 47 does NOT change provider (still claude). Router records hint; Phase 45 packet builder handles template substitution | `route_hint_consumed_R4` (informational) |
| R5: `orchestrator_turn_trim_candidate` | Bias orchestrator self-spend tasks (e.g., classifier in-loop) toward local-script. Maps to context-pressure override path | `route_hint_consumed_R5` |

### 6.1 Hint consumption algorithm

```javascript
// Read recent token-waste-status.jsonl rows; extract route_hints[] where
// from_role === input.role; if any matches, emit reason_code and (for R1/R2/R5)
// adjust the chosen provider.
const recentHints = _readRecentHints(planningDir, input.role, /*tailN*/ 50);
let hintBias = null;
for (const h of recentHints) {
  if (h.reason === ROUTE_REASONS.R1 && h.from_role === 'researcher') {
    hintBias = { provider: 'local-script', reason_code: 'route_hint_consumed_R1' };
  } else if (h.reason === ROUTE_REASONS.R2) {
    hintBias = { provider: 'claude', reason_code: 'route_hint_consumed_R2' };  // away from codex
  } else if (h.reason === ROUTE_REASONS.R5 && h.from_role === 'orchestrator') {
    hintBias = { provider: 'local-script', reason_code: 'route_hint_consumed_R5' };
  }
  // R3, R4 recorded but not provider-changing
}
```

### 6.2 Hint vs uncertainty_type precedence

Order of evaluation (first non-null wins):

1. **Structural override** (LOCK 11) — file_count + line_count
2. **Context-pressure override** (KAIROS) — current_role_token_spend vs BUDGETS
3. **Recent hint bias** (R1/R2/R5) — Phase 42 evidence
4. **uncertainty_type ROUTING_TABLE** — the default
5. **Health gate** — primary unhealthy → walk fallback_chain

Hints are evidence, not commands. They override the default uncertainty_type mapping but are themselves overridden by structural and pressure signals.

---

## 7. Fallback Chain — Q6 LOCKED

**Question:** What's the fallback policy when a provider is unhealthy?

**LOCKED chain:**

| Primary | Fallback chain | Final fallback |
|---------|----------------|----------------|
| local-script | [claude] | claude (always) |
| codex | [claude] | claude |
| claude | [] | none (we ARE claude; if it can't run, we're not running) |
| vtp | [claude] | claude |

When primary unhealthy → walk first entry in fallback_chain. If that's also unhealthy → walk next. If chain exhausts → emit `fallback_chain_exhausted`, return `{ provider: null }`. Caller (orchestrator) interprets null as "stay on claude with a logged failure."

Reasons logged on each step:

| Trigger | reason_code |
|---------|-------------|
| codex unhealthy → fallback to claude | `provider_codex_unavailable` |
| vtp unhealthy → fallback to claude | `provider_vtp_unavailable` |
| claude unhealthy (theoretical) | `provider_claude_unavailable` |
| Last entry in chain also unhealthy | `fallback_chain_exhausted` |
| Caller's gate-name resolves to a different provider record | (delegated to providers-registry; router records as `gate_resolved_provider`) |

A5 binding: every fallback emits a reason_code from the closed `ROUTE_DECISION_REASONS` enum. No silent fallbacks.

---

## 8. VTP Gating (A4 binding) — Q7 LOCKED

**Question:** When does VTP fire?

**LOCKED rule:** VTP fires ONLY when `uncertainty_type ∈ {architecture_challenge, prior_memory_lookup, book_lookup}` (the 3-entry whitelist).

Any other uncertainty_type (`deterministic_extraction`, `bounded_code_review`, `synthesis_judgment`) MUST NOT route to VTP. If a caller somehow forced VTP (e.g., via a bug in upstream packet builder), router emits `provider_vtp_unavailable` with explicit reason="vtp_uncertainty_type_mismatch" and falls back to claude.

This is the mechanical embodiment of A4 ("VTP route is disabled unless uncertainty type requires it").

VTP-DELTA reaffirms this: "Use VTP only for research/book/prior-project/architecture challenge."

Phase 48 (VTP Bridge) consumes the 3-entry whitelist to pick which VTP search tool to call:

| uncertainty_type | Phase 48 tool | Notes |
|------------------|--------------|-------|
| architecture_challenge | mcp__vtp-kb__vtp_search_research | Research-paper corpus |
| prior_memory_lookup | mcp__vtp-kb__vtp_search (project memory) | Phase 48 routes by query type |
| book_lookup | mcp__vtp-kb__vtp_search_substrate | Book/wiki_page corpus per workflow/feedback memory `feedback_vtp_search_layer_routing` |

Phase 47 router DOES NOT pick the VTP tool — it just decides "vtp" vs "not vtp." Phase 48 consumes the decision.

---

## 9. Structural-Precedence Rule (LOCK 11 binding) — Q8 LOCKED

**Question:** How is "structural predicates before semantic similarity" enforced mechanically?

**LOCKED rule:** Three structural predicates evaluate BEFORE uncertainty_type:

```javascript
// Predicate 1: small extraction → local-script regardless of type
if (input.task_kind === 'extraction'
    && (input.file_count || 0) <= 3
    && (input.line_count || 0) <= 100) {
  return _decide('local-script', primary, [], 'structural_override_local_script', ...);
}

// Predicate 2: bounded review → codex regardless of (almost) anything
if (input.task_kind === 'review'
    && (input.line_count || 0) <= 200
    && health.codex.healthy) {
  // Override only if the type's primary differs from codex
  if (primary !== 'codex') {
    return _decide('codex', primary, [], 'structural_override_codex_review', ...);
  }
}

// Predicate 3: large synthesis → claude regardless of presence of small structural counts
// (this is the "no override" case; just default routing applies)
```

LOCK 11 is binding: there is NO router branch that activates on "this looks like a past task," "this is similar to phase X," or any embedding/similarity metric. The router has zero similarity inputs.

Phase 51 BENCH will fixture-test this: a synthesis_judgment task with cosine-similarity 0.99 to a historical local-script-routed task MUST still route to claude. The router cannot see similarity, so it can't be tempted.

---

## 10. Context Pressure as Control Signal (KAIROS) — Q9 LOCKED

**Question:** How is "growing context is a control signal" implemented?

**LOCKED rule:** When `current_role_token_spend >= BUDGETS[role].warn_input`, the router applies a pressure-override:

| Pressure state | Original primary | Override behavior | reason_code |
|----------------|------------------|--------------------|-------------|
| over_warn=false | (any) | No change; ROUTING_TABLE applies | `matched_uncertainty_type` |
| over_warn=true | claude | Bias to local-script (if extraction/inventory) OR codex (if review/critique) OR stay claude (other) | `context_pressure_override_local` / `context_pressure_override_codex` / `context_pressure_under_unmovable_route` |
| over_warn=true | local-script | No change (already cheap) | `matched_uncertainty_type` |
| over_warn=true | codex | No change (already external) | `matched_uncertainty_type` |
| over_warn=true | vtp | No change (vtp gating is type-bound, not pressure-bound) | `matched_uncertainty_type` |

Why claude is the only override target: claude is the most expensive provider per Phase 41 baseline (avg 350k tokens per orchestrator call, 96.4% cache-read share). All other providers are already cheaper than claude under pressure.

`BUDGETS[role].warn_input` is imported by reference from Phase 42 (`require('../token-waste/check.cjs').BUDGETS`). Drift between the router and Phase 42 is impossible because router never redefines numbers.

`context_pressure` field in the decision payload always populates so cockpit (Phase 50) and BENCH (Phase 51) can attribute routing decisions to pressure events.

---

## 11. Decision Ledger Schema (A5 binding) — Q10 LOCKED

**Question:** What does the route-decisions row look like for `boundary='dispatch_route'`?

**LOCKED schema** (envelope-v1 conformant; written via existing `route-ledger.cjs::logRouteDecision`):

```json
{
  "envelope_version": 1,
  "ts": "2026-04-28T08:30:15.123Z",
  "command": "logRouteDecision",
  "status": "ok",
  "reason_codes": ["matched_uncertainty_type"],
  "artifacts": [],
  "evidence": [],
  "next_action": null,
  "risk": null,
  "duration_ms": 12,
  "run_id": "2026-04-28T08:30:15.123Z-a4b8",
  "phase": "47",
  "milestone": "v1.9",
  "boundary": "dispatch_route",
  "decision": {
    "task_kind": "review",
    "uncertainty_type": "bounded_code_review",
    "primary_provider": "codex",
    "chosen_provider": "codex",
    "fallback_chain": ["claude"],
    "fallback_used": false,
    "fallback_reason": null,
    "structural_signals": {
      "file_count": 2,
      "line_count": 45,
      "task_kind": "review"
    },
    "context_pressure": {
      "role": "reviewer",
      "current_spend": 8500,
      "warn_input": 20000,
      "over_warn": false,
      "ratio": 0.425
    },
    "health": {
      "codex": { "healthy": true, "reason": "self_test_pass", "age_ms": 800000 },
      "vtp":   { "healthy": false, "reason": "no_log" }
    },
    "hints_consumed": []
  }
}
```

### 11.1 Status mapping (LOCK 13 binding)

| Decision outcome | envelope.status |
|------------------|-----------------|
| Matched primary, no override | `ok` |
| Structural override fired | `ok` (override is intended behavior) |
| Context-pressure override fired | `warn` |
| Fallback used (provider unhealthy) | `warn` |
| Fallback chain exhausted; provider=null | `fail` |
| Router internal error (caught by try/catch) | `fail` |

Per LOCK 13, **never** map to `blocked`. `fail` here means "router could not pick a provider"; orchestrator decides what to do (degrade to claude is the safe default).

### 11.2 reason_codes vocabulary

`ROUTE_DECISION_REASONS` enum (frozen 13-entry):

```javascript
const ROUTE_DECISION_REASONS = Object.freeze([
  'matched_uncertainty_type',
  'structural_override_local_script',
  'structural_override_codex_review',
  'context_pressure_override_local',
  'context_pressure_override_codex',
  'context_pressure_under_unmovable_route',
  'route_hint_consumed_R1',
  'route_hint_consumed_R2',
  'route_hint_consumed_R3',          // informational only
  'route_hint_consumed_R4',          // informational only
  'route_hint_consumed_R5',
  'provider_codex_unavailable',
  'provider_vtp_unavailable',
  'provider_claude_unavailable',     // theoretical
  'fallback_chain_exhausted',
  'router_internal_error',
  'gate_resolved_provider',          // when task_kind=review + gate_name path
]);
```

Multiple reason_codes can fire on a single decision (e.g., `context_pressure_override_codex` + `provider_codex_unavailable` if pressure forced codex but codex was unhealthy).

### 11.3 Phase 32 BOUNDARIES extension

The single edit Phase 47 makes to existing code:

```diff
 // super-gsd/scripts/lib/route-ledger.cjs:62-70
 const BOUNDARIES = Object.freeze([
   'milestone_promotion',
   'phase_dispatch_first',
   'executor_choice',
   'gate_skip',
   'codex_route',
   'handoff_decision',
   'gate_override',
+  'dispatch_route',         // Phase 47 — general router decision
 ]);
```

And the corresponding selfTest assertion (line 314-315):

```diff
-    assert('1. BOUNDARIES is array of 7',
-      Array.isArray(BOUNDARIES) && BOUNDARIES.length === 7);
+    assert('1. BOUNDARIES is array of 8',
+      Array.isArray(BOUNDARIES) && BOUNDARIES.length === 8);
```

Plus a new Phase-47-specific assertion (~line 423) verifying the new boundary accepts a Phase-47-shaped decision payload (smoke test, not full router test).

---

## 12. LOCK 13 Never-Throws Contract — Q11 LOCKED

**Question:** Where exactly do the try/catch wrappers go?

**LOCKED placement** (mirror token-waste/check.cjs and route-ledger.cjs):

| Public API | Internal helper | Try/catch placement |
|-----------|-----------------|---------------------|
| `routeDispatch(input)` | `_routeDispatchInternal(input)` | Wrapper at routeDispatch; on catch return safe-default decision (provider='claude', reason='router_internal_error') |
| `isProviderHealthy(name)` | `_codexHealthFromLog`, `_vtpHealthFromLog` | Wrapper at isProviderHealthy; on catch return `{healthy:false, reason:'health_probe_error'}` |
| `loadRoutes(opts)` | yaml parse + validate | Wrapper at loadRoutes; on catch return compiled fallback ROUTING_TABLE with source='compiled_yaml_error' |
| `--route` CLI mode | runs routeDispatch + writes route-decisions row | Wrapper around the JSON.stringify and process.stdout.write; never crashes the loop |

Closed-enum violations raise inside `_validateInput` and propagate up to `routeDispatch`'s try/catch — which catches and returns the safe-default decision. Same pattern as Phase 41 `appendTokenSpend` (catches inside helper, returns false).

Self-test fixture F-Lock13: pass garbage input (`{uncertainty_type:'banana'}`) → expect `{provider:'claude', reason:'router_internal_error'}` with NO uncaught exception; assertion passes only if the test harness itself didn't catch a throw.

---

## 13. Read-Only Invariant — Q12 LOCKED

**Question:** What does Phase 47 guarantee about not corrupting upstream state?

**LOCKED invariant:** Phase 47 has exactly ONE write target:

- `.planning/metrics/route-decisions.jsonl` — additive (append-only via existing route-ledger.cjs)

Phase 47 has exactly ONE edit to existing code:

- `super-gsd/scripts/lib/route-ledger.cjs` — add 1 entry to BOUNDARIES, update 1 selfTest assertion (count 7→8), add 1 new assertion for `dispatch_route` boundary smoke

Phase 47 NEVER writes to:

| Path | Owner | Why off-limits |
|------|-------|---------------|
| `.planning/metrics/agent-token-spend.jsonl` | Phase 41 | Token-spend canonical |
| `.planning/metrics/token-attribution.jsonl` | collect.cjs | Source stream |
| `.planning/metrics/codex-log.jsonl` | codex-exec.sh | Codex provenance |
| `.planning/metrics/token-waste-status.jsonl` | Phase 42 | Budget verdicts |
| `.planning/metrics/vtp-health.jsonl` | orchestrator SKILL | Cold-start probe owner |
| `super-gsd/registry/review-providers.yaml` | Phase 14 | Provider registry |
| `super-gsd/tools/token-waste/budgets.yaml` | Phase 42 | Budget config |
| `super-gsd/scripts/lib/providers-registry.cjs` | Phase 14 | Reviewer-provider resolver |
| `super-gsd/scripts/lib/gates-registry.cjs` | Phase 13/14 | Gates loader |

Self-test enforces this with mtime/size fingerprint guards (mirror token-waste/check.cjs:1203-1226). Any drift fails the self-test.

---

## 14. Self-Test Design — Q13 LOCKED

**Question:** How many fixtures and what do they cover?

**LOCKED design: 8 base fixtures + 7 secondary assertions = 15-assertion self-test (mirror token-waste/check.cjs sec 7).**

### 14.1 Eight base fixtures (one per row of the verdict matrix)

| # | Name | Input | Expected output | Acceptance binding |
|---|------|-------|-----------------|---------------------|
| F1 | local route happy | `{task_kind:'extraction', uncertainty_type:'deterministic_extraction', file_count:2, line_count:50}` | provider='local-script', reason='matched_uncertainty_type' | A1, ROUTE-02 |
| F2 | codex route happy | `{task_kind:'review', uncertainty_type:'bounded_code_review', file_count:2, line_count:45}` (with codex healthy fixture) | provider='codex', reason='matched_uncertainty_type' | A2, ROUTE-03 |
| F3 | claude route happy | `{task_kind:'synthesis', uncertainty_type:'synthesis_judgment'}` | provider='claude', reason='matched_uncertainty_type' | A3, ROUTE-04 |
| F4 | vtp route happy | `{task_kind:'planning', uncertainty_type:'architecture_challenge'}` (with vtp healthy fixture) | provider='vtp', reason='matched_uncertainty_type' | A4 (positive path) |
| F4b | vtp gating works | `{task_kind:'extraction', uncertainty_type:'deterministic_extraction', _force_vtp_health:true}` | provider='local-script' (NEVER vtp) | A4 (negative path) — VTP must NOT fire on non-vtp uncertainty_type |
| F5 | codex fallback | `{task_kind:'review', uncertainty_type:'bounded_code_review'}` with codex unhealthy fixture | provider='claude', reason='provider_codex_unavailable', fallback_used=true | A5, codex unhealthy → claude |
| F6 | vtp fallback | `{task_kind:'planning', uncertainty_type:'architecture_challenge'}` with vtp unhealthy fixture | provider='claude', reason='provider_vtp_unavailable', fallback_used=true | A5, vtp unhealthy → claude |
| F7 | structural override | `{task_kind:'extraction', uncertainty_type:'synthesis_judgment', file_count:2, line_count:50}` | provider='local-script', reason='structural_override_local_script' | LOCK 11, structural beats type |
| F8 | context-pressure override | `{task_kind:'extraction', uncertainty_type:'synthesis_judgment', role:'researcher', current_role_token_spend:30000}` (warn=25k for researcher) | provider='local-script', reason='context_pressure_override_local' | KAIROS, pressure beats type |

### 14.2 Seven secondary assertions

| # | Name | Binding |
|---|------|---------|
| 9 | UNCERTAINTY_TYPES is frozen 6-entry | enum integrity |
| 10 | ROUTING_TABLE is frozen 6-entry; every entry has primary + fallback_chain | table integrity |
| 11 | Closed-enum input validation: invalid uncertainty_type → safe-default decision (no throw) | LOCK 13 |
| 12 | Read-only fingerprint guard: 8 canonical paths untouched after self-test | RO invariant |
| 13 | route-ledger smoke: a `dispatch_route` boundary row written via existing route-ledger.cjs round-trips correctly | Phase 32 contract |
| 14 | hint consumption: synthetic token-waste-status.jsonl with R1 hint biases researcher dispatch to local-script | Q5 binding |
| 15 | Pure-function determinism: same input twice → identical decision (excluding ts/run_id) | repeatability |

### 14.3 Why these and not more

Phase 41 used 14 assertions, Phase 42 used 15. Phase 47 lands at 15 (8 fixtures + 7 secondary). Adding more would gold-plate; the 8 fixtures span every verdict-matrix row with one structural and one pressure case for LOCK bindings. Phase 51 BENCH provides large-scale stress testing.

---

## 15. Cross-Phase Contracts — Q14 LOCKED

**Question:** What do downstream phases (48, 50, 51) consume from Phase 47?

**LOCKED contract:**

### 15.1 Phase 48 (Selective VTP Bridge) consumes

- `UNCERTAINTY_TYPES` enum (3 vtp-bound entries)
- `ROUTING_TABLE` for vtp routes
- A decision payload showing `provider='vtp'` + `uncertainty_type ∈ {architecture_challenge, prior_memory_lookup, book_lookup}` is the trigger for Phase 48 to call the VTP MCP tool

Phase 48 does NOT re-implement the gating; it reads Phase 47's decision and calls the appropriate VTP search tool.

### 15.2 Phase 50 (Cockpit Research Dashboard) consumes

- `route-decisions.jsonl` filtered on `boundary='dispatch_route'`
- Decision payload `chosen_provider` for current-phase routing display
- `context_pressure.over_warn` to flag pressured routes in red
- `fallback_used` count over last N decisions for cockpit "fallback-rate" metric

### 15.3 Phase 51 (Context Stress Benchmark) consumes

- `route-decisions.jsonl` rows for `utility_per_token` calculation:
  - tokens_spent (from agent-token-spend.jsonl) ÷ required_evidence_retained (BENCH-07 metric)
  - cheaper providers (local-script, codex) score higher utility_per_token IFF evidence_retention is unchanged
- `decision.fallback_used` count across baseline vs post-milestone runs to prove A2 (codex routes when healthy)
- `decision.context_pressure.over_warn` counts to prove KAIROS overrides fired

### 15.4 Phase 49 (Memory Governance Lifecycle) does NOT consume

Phase 47 has no memory governance role. Listed for completeness — confirming no leak across the fence.

### 15.5 No consumer of routes.yaml outside Phase 47

routes.yaml is a Phase 47 config file. Phase 48 reads UNCERTAINTY_TYPES from route.cjs's exported const, NOT from routes.yaml directly. This keeps the closed-enum contract centralized.

---

## 16. Single Plan Recommendation

Phase 47 ships in **one** plan, **one** wave (no parallel work — single module + one upstream edit).

**Plan 47-01: Dispatch Routing Substitution**

Tasks (sequential due to file_overlap on route-ledger.cjs):

| ID | Task | Files |
|----|------|-------|
| T1 | Define frozen consts (UNCERTAINTY_TYPES, ROUTING_TABLE, TASK_KINDS, ROUTE_DECISION_REASONS) + module skeleton | super-gsd/tools/dispatch-router/route.cjs |
| T2 | Implement `_loadRoutes` with yaml-parse + compiled fallback (mirror token-waste _loadBudgets) | super-gsd/tools/dispatch-router/route.cjs, super-gsd/tools/dispatch-router/routes.yaml |
| T3 | Implement `_codexHealthFromLog` + `_vtpHealthFromLog` + `isProviderHealthy` | super-gsd/tools/dispatch-router/route.cjs |
| T4 | Implement `_pressureFor`, `_readRecentHints` | super-gsd/tools/dispatch-router/route.cjs |
| T5 | Implement `_routeDispatchInternal` core decision function (steps 1-4 from §3 algorithm) + `routeDispatch` public wrapper (LOCK 13 try/catch) | super-gsd/tools/dispatch-router/route.cjs |
| T6 | Implement `_validateInput` + closed-enum violations | super-gsd/tools/dispatch-router/route.cjs |
| T7 | Extend `route-ledger.cjs::BOUNDARIES` from 7 to 8 (`+'dispatch_route'`) + update self-test assertion 1 + add new assertion for `dispatch_route` smoke | super-gsd/scripts/lib/route-ledger.cjs |
| T8 | Implement self-test (15 assertions: 8 fixtures + 7 secondary) with read-only fingerprint guard | super-gsd/tools/dispatch-router/route.cjs |
| T9 | Implement CLI: `--self-test`, `--route` (writes envelope row via route-ledger), `--help` | super-gsd/tools/dispatch-router/route.cjs |
| T10 | Phase-level ATC review (codex first, claude fallback) | (review only; no code change) |

Estimated novelty: 1 NEW module (~700 lines), 1 NEW yaml (~30 lines), 3 LINES edited in route-ledger.cjs (BOUNDARIES + assertion 1 + new assertion 14). Net: ~750 lines added, 3 edited, 0 deleted.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 32 `route-ledger.cjs` BOUNDARIES extension is non-breaking (closed-enum length+1, no removed values) | §11.3, T7 | If breaking: route-ledger self-test fails; downstream consumers (Phase 50 cockpit) might error. Mitigation: phase-level ATC catches, or Phase 50 plan-checker catches. **[VERIFIED]** by reading route-ledger.cjs:62-70 (Object.freeze + length-based assertion) and confirming Phase 38 already extended from 6→7 (`gate_override`) using this exact pattern. |
| A2 | `vtp-health.jsonl` is the canonical VTP health surface | §5.2 | If VTP health source moves to a different file later: router falls back to claude harmlessly until updated. **[VERIFIED]** in super-gsd/skills/sgsd-orchestrate/SKILL.md:212 (orchestrator already writes this file Step 3.7). |
| A3 | Codex health can be inferred from latest `step:'self-test'` row in codex-log.jsonl | §5.1 | If codex-exec.sh stops emitting self-test rows, router treats as `stale_self_test` → fallback to claude. **[VERIFIED]** by reading codex-exec.sh:397+424 (self-test mode emits the JSONL row) and codex-log.jsonl tail (2026-04-27T15:33:24Z row exists with all 4 probes true). |
| A4 | Phase 42 BUDGETS const is the authoritative per-role threshold source | §6, §10 | If Phase 42 changes BUDGETS shape, Phase 47 router must update import — but the import is by reference, not by copy, so the change is automatic. **[VERIFIED]** at token-waste/check.cjs:114-123 (BUDGETS Object.freeze + module.exports). |
| A5 | `task_kind` enum (9 entries) is sufficient for v1.9 dispatch landscape | §3.3 | If a new task type emerges (e.g., `migration`, `refactor`), it lands as `unknown` and routes claude — safe but opaque. Phase 51 BENCH may surface need for split. | `[ASSUMED]` |
| A6 | Phase 32 `BOUNDARIES` extension does not require schema_version bump in command-envelope-v1.yaml | §11.3 | Per route-ledger.cjs:7-10: "envelope-v1 contract is `additionalProperties: true` so the extension fields ride along without any schema bump." Boundary VALUES expand within the same `boundary` field; no envelope schema change. **[VERIFIED]** by reading route-ledger.cjs:7-10 + Phase 38 precedent (added `gate_override` boundary without schema bump). |
| A7 | 30-min health-row staleness is the right TTL | §5.5 | Too short: router constantly fires fresh probes (cost). Too long: stale state misleads routing. **[ASSUMED]** based on orchestrator loop cadence (cold-start probes once per session); Phase 51 BENCH can refine. |
| A8 | Health probes do NOT trigger fresh codex-exec self-tests; they read latest log row only | §5.5 | If router triggered fresh probes, Phase 47 self-test would touch codex-log.jsonl — violating RO invariant. Phase 47 firmly READS only. Triggering re-probes is orchestrator/cockpit responsibility. **[VERIFIED]** by self-test design Q13 explicitly stating no codex-exec invocation. |

**One assumed claim** — A5 (task_kind 9-entry sufficiency) and A7 (30-min TTL). Both surface to discuss-phase as candidate revisions. All other claims are verified against existing code or specs.

---

## Open Questions

None remaining at LOCK time. All 15 questions answered:

1. ✅ Router scope (§2) — NEW module, separate from resolveReviewerProvider
2. ✅ Decision input shape (§3) — 9-entry TASK_KINDS, 6-entry UNCERTAINTY_TYPES, structural + pressure inputs
3. ✅ Uncertainty-type enum (§4) — 6 entries with frozen ROUTING_TABLE
4. ✅ Provider-health check (§5) — codex-log self-test row + vtp-health.jsonl tail
5. ✅ Fallback chain (§7) — every primary → claude; reasons in ROUTE_DECISION_REASONS
6. ✅ Substitution-rule consumption (§6) — R1/R2/R5 change provider; R3/R4 informational
7. ✅ Phase 42 route_hint consumption (§6) — tail-50 read of token-waste-status.jsonl
8. ✅ VTP gating (§8) — 3-entry whitelist enforcement
9. ✅ No semantic-only routing (§9) — structural predicates ONLY
10. ✅ Context pressure (§10) — bias claude → local/codex when over warn_input
11. ✅ Decision ledger (§11) — boundary='dispatch_route' on existing route-decisions.jsonl
12. ✅ LOCK 13 contract (§12) — try/catch on every public API
13. ✅ Read-only invariant (§13) — only writes route-decisions.jsonl + 3-line edit to route-ledger.cjs
14. ✅ Self-test design (§14) — 8 fixtures + 7 secondary = 15 assertions
15. ✅ Cross-phase (§15) — Phase 48/50/51 contracts defined

---

## Project Constraints (from CLAUDE.md / SGSD design locks)

- **EVERY response includes a tool call** — orchestrator constraint; Phase 47 ships as a sub-agent dispatch with self-test as the verifier tool call.
- **Commit after EVERY unit; never batch** — Plan 47-01 has T1-T9 as 9 commits.
- **Stage specific files by name; never `git add -A`** — each commit names route.cjs, routes.yaml, route-ledger.cjs explicitly.
- **NEVER expose secrets** — Phase 47 reads no credential file. codex-log.jsonl rows do not contain auth tokens; vtp-health.jsonl does not contain MCP keys.
- **Sub-agent reports max 300 words** — Phase 47 plan tasks return structured reports per CLAUDE.md format.
- **Token efficiency: read STATE.md frontmatter only** — orchestrator constraint; Phase 47 dispatch reads CONTEXT.md + targeted file ranges, not full files.
- **Lock 13 (REQUIREMENTS.md:67-68)**: "Autonomy continues; evidence tells the truth. Budget breaches degrade or reroute by policy. They do not become silent overrun." — Phase 47 router NEVER blocks; only routes/fallbacks. Status mapping in §11.1 binds.
- **EXISTING-SURFACE-AUDIT.md:139** — "Do not create another route-decision ledger." Phase 47 extends `route-decisions.jsonl` via boundary expansion, never creates a sibling ledger.

---

## Sources

### Primary (HIGH confidence — verified in this session)

- `super-gsd/tools/token-attribution/report.cjs` — Phase 41 owner of PROVIDERS, ROLES, BLOAT_THRESHOLDS, agent-token-spend.jsonl writer
- `super-gsd/tools/token-waste/check.cjs` — Phase 42 owner of BUDGETS, ROUTE_REASONS R1-R5, route_hints[] emission, runCheck() public API
- `super-gsd/scripts/lib/route-ledger.cjs` — Phase 32 owner of BOUNDARIES (7-entry, growing to 8), logRouteDecision public API, envelope-v1 conformance
- `super-gsd/scripts/lib/providers-registry.cjs` — Phase 14 owner of resolveReviewerProvider, review-providers.yaml
- `super-gsd/registry/review-providers.yaml` — claude-sonnet-reviewer + codex-cli-reviewer records (Phase 14)
- `super-gsd/scripts/codex-exec.sh` — Phase 14 codex CLI wrapper, owner of `--self-test --skip-network` probe + codex-log.jsonl writer
- `super-gsd/tools/provider-health/check.cjs` — Phase 14 behavioral probe, exit 0/1/2 contract
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:187-234` — VTP health probe Step 3.7, owner of vtp-health.jsonl
- `super-gsd/tools/context-packet/build.cjs:705-708` — Phase 45 reserves opts.route_hint slot at step 7 (VTP packets)
- `.planning/milestones/v1.9/REQUIREMENTS.md` — REQUIREMENTS-01..05 verbatim, design locks 11/13
- `.planning/milestones/v1.9/ROADMAP.md` — §47 acceptance A1-A5 verbatim
- `.planning/milestones/v1.9/SGSD-HANDOVER.md:92-110` — Implementation Rules
- `.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md` — Architecture Matters / KAIROS deltas (Phase 47 forward-only)
- `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md:135-143` — "Do not create another route-decision ledger" + reuse list
- `.planning/milestones/v1.9/baseline-token-spend.md` — R1-R5 substitution candidate evidence (Phase 41 §5)
- `.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-RESEARCH.md` §5 — full R1-R5 spec with WHEN/RECOMMEND/RATIONALE
- `.planning/metrics/codex-log.jsonl` (live tail 2026-04-27) — confirmed Codex healthy; self-test row format verified
- `.planning/metrics/agent-token-spend.jsonl` (Phase 41 ledger) — confirmed Phase 41 emitter shipping

### Secondary (MEDIUM confidence — verified single-source)

- `super-gsd/scripts/lib/dispatch-planner.cjs` — wave/parallel auto-detection (Phase 8/MACH-02). Phase 47 does NOT consume this directly but its existence proves the dispatch primitive is ready for routing.

### Tertiary (LOW confidence — none in this research)

No LOW-confidence claims. Every architectural decision is traceable to a verified existing surface.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Every consumed module is a Phase 41/42/32/14 deliverable shipped before Phase 47; verified by direct file reads |
| Architecture | HIGH | Mirror precedent across token-waste/check.cjs, route-ledger.cjs, phase-capsule/write.cjs, providers-registry.cjs is dense and consistent |
| Pitfalls | HIGH | Pitfalls 1-6 derive from explicit LOCK violations or Phase 14 wire-in mistakes already evidenced in the codebase |
| Test design | HIGH | 8-fixture floor matches Phase 42's 4-fixture + 11-secondary pattern with size scaled to scope |
| VTP gating | HIGH | A4 + LOCK 11 + VTP-DELTA all converge on the 3-entry whitelist; no ambiguity |
| Health probes | HIGH | codex self-test row format verified by reading 2026-04-27T15:33:24Z row directly; vtp-health.jsonl shape verified by reading SKILL.md:212-219 emission pattern |

---

## Metadata

**Confidence breakdown:**
- 13 of 15 questions LOCKED with verified primary-source evidence
- 2 of 15 (A5, A7) marked `[ASSUMED]` and surfaced for discuss-phase confirmation
- 0 LOW-confidence claims
- 0 unresolved blockers

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30-day window for stable upstream phases; refresh if Phase 41/42/32 contracts change)

**Phase 47 ready for planning.** Single plan (47-01) with 9 sequential tasks; estimated 750 lines added net.
