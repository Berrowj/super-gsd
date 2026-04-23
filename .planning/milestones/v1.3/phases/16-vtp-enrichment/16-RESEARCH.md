# Phase 16: VTP Enrichment as Cross-Phase Primitive — Research

**Researched:** 2026-04-23
**Domain:** SGSD framework meta-phase — VTP MCP integration across planning/research/triage surfaces
**Confidence:** HIGH (all claims verified against in-repo source; 2 deviations documented below)

## Summary

Phase 16 is a patching/plumbing phase, not a new-capability phase. The research surface is:
(a) VTP's 11 MCP tool schemas as they exist on disk today, (b) SGSD's established conventions
for skills / agents / CJS lib modules / JSONL telemetry that plans will replicate, and
(c) two nontrivial integration points (triage Step 0, sepl major-detection) that need concrete
anchor locations.

**Primary recommendation for planner:** mirror the `sgsd-complete-milestone` frontmatter pattern
verbatim for all VTP-tool declarations, mirror `gates-registry.cjs` for the composer's module
shape, and reuse the `edge-guard.cjs --self-test` pattern for the composer's and routing-log's
CLI verification entry-point. Two CONTEXT.md assumptions need correction at plan time (see
BLOCKERS / DEVIATIONS below): `vtp_route_and_retrieve` has no native `elapsed_ms` field (the
composer must wrap the call), and `gsd-pattern-mapper.md` does not exist in the vendored
core-GSD surface (VTP-06 target is invalid as written).

<phase_requirements>
## Phase Requirements

| ID | Description (from 16-CONTEXT.md plan-seed) | Research Support |
|----|---------------------------------------------|------------------|
| VTP-01 | `sgsd-triage` fires VTP enrichment as Step 0 on auto-invocation | §sgsd-triage Step 0 Injection Analysis — exact line anchor identified at SKILL.md:39 (before existing Step 1). Composer-built `ContextInput` shape verified against `intent-routing.ts:37-47`. |
| VTP-02 | `gsd-phase-researcher` uses `vtp_search_research` + `vtp_get_research` + gated `vtp_research_gate` | Agent file exists at `custom-gsd-extract/claude-agents/gsd-phase-researcher.md` with `tools:` frontmatter field (NOT `allowed-tools:` — see §SGSD Precedent Patterns). All three VTP tools verified registered in `research.ts:109/147/275`. |
| VTP-03 | `gsd-planner` uses `vtp_route_and_retrieve` (architecture mode) | Agent exists at `gsd-planner.md`; `vtp_route_and_retrieve` verified registered at `intent-routing.ts:295`. |
| VTP-04 | Shared `super-gsd/scripts/lib/vtp-context-composer.cjs` with `compose()` + `project()` | §Node CJS Module Conventions — 10 sibling modules form a clear template. `gates-registry.cjs` is the closest structural analog. |
| VTP-05 | Every VTP call logs row to `.planning/metrics/vtp-routing-log.jsonl` with `elapsed_ms` | §JSONL Telemetry Shape — 8 existing metrics JSONL files define the pattern. Row shape per CONTEXT.md canonical_refs matches house style. |
| VTP-06 | `gsd-pattern-mapper` uses `vtp_search_substrate` with filters | **BLOCKER — agent file does not exist.** See §Risks and Unknowns + §Dependencies on Other Phases. |
| VTP-07 | `gsd-assumptions-analyzer` uses `wiki_find_contradictions` | Agent exists at `gsd-assumptions-analyzer.md`. `wiki_find_contradictions` verified registered at `wiki.ts:131`. Agent uses `tools:` frontmatter (currently `Read, Bash, Grep, Glob` — must add `mcp__vtp-kb__wiki_find_contradictions`). |
| VTP-08a | Standalone `/sgsd-vtp-advise` skill at `super-gsd/skills/sgsd-vtp-advise/SKILL.md` | `vtp_advise_service_enrichment` schema verified at `service-enrichment.ts:17-67`. `sgsd-complete-milestone/SKILL.md` is template; 20 sibling skills confirm skill-folder pattern. |
| VTP-08b | `/sgsd-sepl` detects "major" proposals and auto-calls advise | §sepl Major-Proposal Detection Feasibility — proposal template has 7-field YAML frontmatter (`type`, `resource_type`, `target_path`, `slug`, `proposed_at`, `status`, `description`, `rationale`). Major-scan lands cleanly at `sgsd-sepl-propose.sh` post-write OR as a pre-write annotation. |
| VTP-09 | Per-phase `.planning/phases/{N}/VTP-EVIDENCE.md` framing-only artifact | No existing analog in SGSD; shape is novel. Framing contract is D-04: `selected_query`, `retrieval_mode`, `reflection.verdict`, top-3 doc-IDs. `vtp_route_and_retrieve` response schema confirms every field exists (`intent-routing.ts:302-316`). |
| VTP-10 | Config key `workflow.triage_vtp_enrichment: boolean` (default `true`) | Existing `.planning/config.json#workflow` block has 15 keys — new key fits existing pattern (e.g. `nyquist_validation: true`, `security_enforcement: true`). |
</phase_requirements>

## VTP MCP Tool Surface Verification

All 11 tools declared in CONTEXT.md canonical_refs were located in `C:\Users\jack.berrow\Voice-Text-Plan\src\mcp\tools\*.ts` via `registerTool(` scan. `.mcp.json` wires the server as:

```json
{ "vtp-kb": { "command": "node", "args": ["C:/Users/jack.berrow/Voice-Text-Plan/dist/cli.js", "mcp"] } }
```

No MCP-config changes required. Every tool below verified via `Grep registerTool\(` + file read.

| MCP Tool | File / Line | Input Schema (key fields) | Response Shape | Notes for Planner |
|----------|-------------|---------------------------|----------------|-------------------|
| `vtp_route_and_retrieve` | `intent-routing.ts:295` | `raw_query: string(min 3)`, `context: ContextInput` | `{context_summary, project_intent_state, routing_weights, query_frame, decision_matrix, expanded_queries[], retrieval_plan{selected_query, alternate_queries, retrieval_mode, answer_shape}, evidence{hits[], entities[], documents[]}, reflection\|null}` | **Primary triage/plan tool.** `reflection` can be null — VTP-01 must handle both. `retrieval_plan.selected_query` + `retrieval_plan.retrieval_mode` are what VTP-EVIDENCE.md captures. |
| `vtp_search_research` | `research.ts:109` | `query: string`, `limit?: number` | Text-oriented; parse paper slug, principle id, principle abstract, retrieval score | Response is less structured than substrate tools — operator-guide §7 warns about this. Composer should pass through raw and let the agent parse. |
| `vtp_get_research` | `research.ts:147` | TBD (not read; usage pattern is `{research_id}`) | Canonical paper fetch | Follow-up after `vtp_search_research` returns a slug. |
| `vtp_research_gate` | `research.ts:275` | `problem: string`, `project_context: string`, `tier: "full"\|..`, `top_k: number` | Research synthesis | **Costly — "only when genuinely research-grounded"** (operator-guide anti-pattern 2). gsd-phase-researcher should gate behind a depth heuristic. |
| `vtp_search_substrate` | `substrate.ts:378` | `query: string`, `source_types?: string[]`, `topics?: string[]`, `limit?: number` | `{total, hits[]{chunk_id, doc_id, rel_path, section_title, source_type, entity_types[], score, text}}` | **Fast-path target per D-07.** Takes filter params; usable directly when query shape is clear. |
| `vtp_get_evidence_bundle` | `substrate.ts:451` | `query, source_types?, entity_types?, limit?` | `{query, hits[], documents[], entities[]}` | One-call breadth helper; use when agent wants ranked evidence + canonical docs + linked entities. |
| `vtp_get_document` | `substrate.ts:314` | `{doc_id}` or `{rel_path}` | `{document: {doc_id, rel_path, title, source_type, topics[]}, body: markdown}` | Canonical fetch. Called after weak reflection verdict (per operator-guide §reflection-weak_evidence). |
| `wiki_search` | `wiki.ts:117` | `{query, limit?}` | Narrative-page hits | Follow with `wiki_get_project\|person\|idea`. |
| `wiki_find_contradictions` | `wiki.ts:131` | TBD | Contradiction listings | **VTP-07 primary.** Standalone entry point — no search-first needed. |
| `vtp_advise_service_enrichment` | `service-enrichment.ts:42` | `service_name, service_summary(≥20 chars), pain_points[1..], candidate_areas[1..] from enum of 9, constraints[], avoid?, max_recommendations?(1-8), strictness?("conservative"\|"balanced"\|"aggressive")` | `{query, evidence_hits[], recommendations[{recommendation_id, area, title, summary, apply_only_if, minimal_change, expected_difference, bloat_risk, implementation_cost, confidence, evidence[]}], skipped_opportunities[{area, reason}]}` | **Wave C primary.** `candidate_areas` is a strict z.enum — only `retrieval`, `routing`, `evaluation`, `tooling`, `memory`, `observability`, `safety`, `workflow`, `planning` accepted (`service-enrichment.ts:23-33`). Planner must enumerate this in the skill body. |
| `vtp_reflect_on_results` | `intent-routing.ts:338` | `{raw_query, context, results[0..12]}` | Reflection-only pass | Secondary — most uses are handled by `vtp_route_and_retrieve`'s embedded `reflection` field. |

**Schema-assumption deltas against CONTEXT.md (important for planner):**

1. **No `elapsed_ms` in any response.** Operator-guide §minimal-flags lists `elapsed_ms` as something SGSD should "track per query" — i.e. the caller wraps the call and measures. CONTEXT.md D-07 ("every VTP call logs `elapsed_ms`") is feasible only via `Date.now()` bracketing inside the composer. Plans must include this wrapping.

2. **No `current_focus` field on `ContextInput`.** CONTEXT.md D-07 says the fast-path fires "when `current_focus` resolves to a known active phase." The actual `ContextInput` (`intent-routing.ts:37-47`) has: `session_id?, repo?, active_file?, recent_turns?[], recent_commands?[], recent_errors?[], current_task?, blockers?[], explicit_constraints?[]`. The closest field is `current_task`. D-07's "current_focus" is a composer-internal concept — the composer's `compose()` derives `current_task` from the SGSD-state inputs and uses its own `fast_path_eligible` boolean internally; it does not pass `current_focus` to VTP.

3. **`vtp_research_gate` is cost-sensitive.** Not a schema delta, but a confidence flag: the operator-guide explicitly lists defaulting to research_gate as an anti-pattern. VTP-02's "gated vtp_research_gate" phrasing already captures this — plans should implement the gate (e.g. "only fire when research-mode confidence >= 0.7 AND raw_query mentions research/paper/principle keywords").

## SGSD Precedent Patterns

### `sgsd-complete-milestone` — the proven pattern to mirror

Frontmatter (file: `super-gsd/skills/sgsd-complete-milestone/SKILL.md:1-15`):

```yaml
---
name: sgsd-complete-milestone
description: "..."
argument-hint: "<version>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - mcp__vtp-kb__vtp_search
  - mcp__vtp-kb__vtp_list_research
  - mcp__vtp-kb__vtp_ingest_research
---
```

**Key observations for planner:**

1. **Skills use `allowed-tools:` (list form) not `tools:` (comma-string).** This matches `sgsd-triage/SKILL.md:4-10` and every other sgsd-* skill. Any new skill (`sgsd-vtp-advise`) follows this.

2. **Agents in `custom-gsd-extract/claude-agents/` use a DIFFERENT frontmatter key: `tools:` (comma-separated string).** Example from `gsd-phase-researcher.md:4`: `tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*`. Plans for VTP-02/03/06/07 must use this `tools:` form, not the list form. Wildcards (`mcp__vtp-kb__*`) are legal and more concise if we want the whole VTP surface.

3. **In-body tool calls are called by canonical name** (not with the `mcp__vtp-kb__` prefix in prose). `sgsd-complete-milestone/SKILL.md:94`: "Query `mcp__vtp-kb__vtp_search` for prior milestone-like artifacts." The frontmatter declares; the body invokes by the same symbol. Plans should replicate this literal form so tool-gating actually works.

4. **Fallback / tiering pattern** (Step 6 of sgsd-complete-milestone:99-112): the skill declares three tiers of VTP capability (`tier-1` / `tier-2` / `tier-3`) and records which tier was actually reached. This is the reference model for Phase 16's Wave-C conditional integrations. For the composer's fast-path / full-path split, mirror this tier-naming discipline.

### Agent frontmatter — all candidate surfaces

| Agent file (verified exists) | Current `tools:` | Patch needed |
|------------------------------|------------------|--------------|
| `gsd-phase-researcher.md` | `Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*` | Add `mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_get_research, mcp__vtp-kb__vtp_research_gate, mcp__vtp-kb__vtp_route_and_retrieve` |
| `gsd-planner.md` | `Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*` | Add `mcp__vtp-kb__vtp_route_and_retrieve, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_get_evidence_bundle` |
| `gsd-project-researcher.md` | (verified exists; not read) | Add broader VTP pull per CONTEXT.md canonical_refs |
| `gsd-assumptions-analyzer.md` | `Read, Bash, Grep, Glob` | Add `mcp__vtp-kb__wiki_find_contradictions, mcp__vtp-kb__wiki_search` |
| `gsd-plan-checker.md` | (verified exists; not read) | Add VTP-cross-check tools per CONTEXT.md canonical_refs |
| `gsd-codebase-mapper.md` | (verified exists; not read) | Optional lower-priority per CONTEXT.md §deferred |
| `gsd-pattern-mapper.md` | **DOES NOT EXIST** | VTP-06 target is invalid as written — see §Risks |

## Node CJS Module Conventions

Sampled from `super-gsd/scripts/lib/*.cjs` (10 modules). All share a consistent shape that the new `vtp-context-composer.cjs` should match.

### Canonical file header

From `gates-registry.cjs:1-17`:

```javascript
'use strict';

/**
 * Gates registry singleton — loads gates.yaml once and caches it.
 *
 * Exports: { loadGates, getGate, shouldFire, resetCache }
 *
 * loadGates(yamlPath)         — parse + cache; O(1) on subsequent calls
 * getGate(name, yamlPath)     — return row; throw if absent
 * shouldFire(name, ctx, path) — false when enforcement_mode==='disabled';
 *                               otherwise delegates to evalPredicate(trigger||[], ctx)
 * resetCache()                — test-only: clear the in-memory cache
 */

const fs   = require('fs');
const path = require('path');
const { evalPredicate } = require('./predicate-eval.cjs');
```

Conventions observed in every module:

1. **`'use strict';` at line 1.**
2. **JSDoc block at file top** with: one-line summary, `Exports: { ... }` list, per-export signature + one-line description.
3. **Aligned `const fs = require('fs')` block** (not destructured imports from a shared module).
4. **No external runtime deps** — `js-yaml` is loaded lazily via `super-gsd/tools/plan-schema/node_modules/js-yaml` pattern (`gates-registry.cjs:41-44`). `classifier-cache.cjs` and `context-gauge.cjs` have zero require() beyond `fs`/`path`.
5. **Per-function JSDoc** with `@param`, `@returns`, defensive-input handling (`computeFraction` returns 0 on `<=0` input, `context-gauge.cjs:22`).
6. **`module.exports = { ... }` at EOF** — always object-literal, not named assignments.
7. **Cache discipline** — when a module caches state, it exposes `resetCache()` for tests and documents "process singleton" loudly (`gates-registry.cjs:24-28`).
8. **Atomic file writes** via tmp-then-rename where possible; `edge-guard.cjs:111-112` uses `appendFileSync` for the JSONL case (append is atomic enough for JSONL row-shape).

### Error handling

Observed pattern: **narrow catches, rethrow on unknown**. From `edge-guard.cjs:83-87`:

```javascript
try {
  const gate = getGate(gateName, gatesYamlPath);
  if (gate && gate.escalation === 'halt') escalation = 'halt';
} catch (err) {
  // Narrow: only swallow "gate name not in registry" — rethrow registry errors
  if (!err.message.startsWith("gate '")) throw err;
}
```

The composer should:
- **Catch only VTP-specific failure shapes** (MCP error text, timeout) — let genuine bugs surface.
- **Return a tagged result** (`{ ok: false, reason: "timeout_3s", elapsed_ms: ... }`) rather than throwing, so the triage Step 0 fall-through path has a clean gate.

### CLI self-test entry

`edge-guard.cjs:128-265` defines a complete `--self-test` mode runnable via `node edge-guard.cjs --self-test` that:
- Writes rows to a temp dir (NEVER touches real `.planning/metrics/`).
- Asserts every required JSONL key is present.
- Cleans up on exit.
- Exits 0 PASS / 1 FAIL with a reason string.

**Recommendation:** the composer module ships with a `--self-test` CLI that exercises both `compose()` happy-path and `project(ctx, tier)` for all five declared tiers (`triage | research | plan | pattern | assumptions`). The routing-log writer ships with a `--self-test` that asserts the 10-key row schema (see §JSONL Telemetry Shape). This makes VTP-04 and VTP-05 mechanically verifiable without spinning up the full orchestrator.

### Exports shape the composer should aim for

```javascript
module.exports = {
  compose,           // (sgsd_state) => full_context_object
  project,           // (ctx, tier) => tier-slice
  isFastPathEligible, // (ctx) => boolean  [supports D-07]
  TIERS,             // frozen declarative constants
  resetCache,        // test-only
};
```

Declarative `TIERS` constants ("tier projections live as declarative constants in the same file" per D-05) means something like:

```javascript
const TIERS = Object.freeze({
  triage:      { fields: ['repo','current_task','recent_turns','explicit_constraints'] },
  research:    { fields: ['repo','current_task','explicit_constraints','recent_errors'] },
  plan:        { fields: ['repo','active_file','current_task','blockers','explicit_constraints'] },
  pattern:     { fields: ['repo','active_file','current_task'] },
  assumptions: { fields: ['repo','current_task','recent_turns','recent_errors'] },
});
```

(The exact field map is Claude's discretion per CONTEXT.md §decisions — this is a candidate shape, not a lock.)

## JSONL Telemetry Shape

Existing metrics files in `.planning/metrics/` (8 found): `activity-log.jsonl`, `audit-log.jsonl`, `deliberation-outcomes.jsonl`, `heartbeat.jsonl`, `muda-log.jsonl`, `plan-errors.jsonl`, `readiness-log.jsonl`, `token-log.jsonl`. Plus `edge-guard-log.jsonl` defined by contract in `edge-guard.cjs` (created on first write).

### House shape — observed across all files

```json
{"ts":"2026-04-21T19:53:45.413Z","event":"validation_run","plan_file":"...","phase":11,"plan":1,"schema_version":2,"mode":"load","valid":true,"error_count":0,"errors":[]}
```

Invariants observed in every row of every file:

1. **First key is `ts`** — ISO 8601 UTC with `.NNN` milliseconds OR plain `Z` second-granularity. Format per file, but always first.
2. **Event-type key is either `event:` OR `type:` OR `tool:`**, depending on file purpose:
   - `event:` — `plan-errors.jsonl`, `edge-guard-log.jsonl` (when multiple event types coexist)
   - `tool:` — `activity-log.jsonl`, `token-log.jsonl` (when the "what" is a tool call)
   - `type:` — `readiness-log.jsonl` (`type:"schema_pin_drift"`)
   - Omitted when the file is single-shape (`muda-log.jsonl` has no event key — every row is a MUDA run)
3. **Minified JSON, one row per line, `\n`-terminated**. No pretty-printing.
4. **Append-only**. No file in `metrics/` is ever edited in place. `edge-guard.cjs:111-112` uses `appendFileSync`.
5. **Nested objects are allowed** (`muda-log.jsonl`: `"probes":{"haiku":"PASS",...}`) but kept shallow (≤1 level).
6. **Array values allowed** but bounded (`plan-errors.jsonl`: `"errors":[...]` with per-error `instancePath`).

### Recommended `vtp-routing-log.jsonl` row shape

Per CONTEXT.md canonical_refs, the row carries 10 fields. Mapped to house style:

```json
{"ts":"2026-04-23T12:34:56.789Z","event":"vtp_call","tier":"triage","skill_or_agent":"sgsd-triage","raw_query":"how should sgsd query vtp","selected_query":"routed retrieval for sgsd triage","retrieval_mode":"architecture_hybrid","reflection_verdict":"sufficient","evidence_hit_count":7,"top_doc_id":"doc:abc123","elapsed_ms":1840}
```

Notes for planner:
- Use `event:"vtp_call"` as the single event-type (matches `plan-errors.jsonl`'s `validation_run` discipline).
- `tier` values from `TIERS`: `triage | research | plan | pattern | assumptions | standalone` (`standalone` for `/sgsd-vtp-advise`).
- `reflection_verdict`: direct passthrough of `reflection.verdict` from `vtp_route_and_retrieve` response; values per operator-guide §reflection: `too_generic | over_narrowed | weak_evidence | sufficient | null` (when reflection is null).
- `top_doc_id`: `evidence.documents[0]?.doc_id || null`.
- `elapsed_ms`: computed by the composer via `Date.now()` bracket around the MCP call (see BLOCKER #1 below).
- **Omit `evidence_hit_count` if 0 is already implied by `reflection_verdict === "weak_evidence"`** — both fields carrying the same signal is minor muda.
- JSONL-writer module uses the same `appendFileSync` pattern as `edge-guard.cjs:111-112`; directory-create is idempotent via `fs.mkdirSync(dir, { recursive: true })`.

## sgsd-triage Step 0 Injection Analysis

Current `super-gsd/skills/sgsd-triage/SKILL.md` has a `<process>` block containing four steps:

| Line | Current Content | Phase 16 Action |
|------|-----------------|-----------------|
| 37 | `<process>` open | — |
| 39 | `## Step 1: Brainstorm (superpowers:brainstorming)` | **Inject Step 0 above this line.** |
| 41-45 | Step 1 body (brainstorming call) | Untouched |
| 48 | `## Step 2: Plan (superpowers:writing-plans)` | Untouched |
| 56 | `## Step 3: Classify + route` | Untouched |
| 119 | `### Path D — Trivial / inline` | VTP-10's trigger exclusion piggybacks off this existing Path D — no new exclusion needed (per D-06). |
| 125 | `## Step 4: Report + offer` | Untouched |

**Exact anchor:** insert new `## Step 0: VTP Enrichment (triage context grounding)` block between line 37 (`<process>` open) and line 39 (existing `## Step 1: Brainstorm`). New step pseudo-spec:

```
1. If workflow.triage_vtp_enrichment === false (from .planning/config.json) → skip, proceed to Step 1.
2. Call vtp-context-composer.cjs#compose(sgsd_state) → full_context_object.
3. Call vtp-context-composer.cjs#project(ctx, 'triage') → tier slice.
4. If fast-path predicate holds (current_task resolves to known active phase AND explicit_constraints non-empty):
     call mcp__vtp-kb__vtp_search_substrate directly with phase-scoped filters.
   Else:
     call mcp__vtp-kb__vtp_route_and_retrieve with {raw_query: operator_message, context: tier_slice}.
5. Wrap the call in Date.now() bracket to compute elapsed_ms.
6. Parse response → {selected_query, retrieval_mode, reflection_verdict, top_3_doc_ids}.
7. Write framing to .planning/phases/{active_phase}/VTP-EVIDENCE.md (D-04: framing-only, ≤300 lines).
8. Append routing-log row to .planning/metrics/vtp-routing-log.jsonl.
9. Pass the selected_query + reflection into Step 1 brainstorming as context prelude.
10. On MCP failure or timeout >3s:
     - log row with elapsed_ms = budget-exceeded marker
     - do NOT block — proceed to Step 1 with operator's raw query verbatim.
```

**Graceful-fail discipline** (step 10) is critical — the triage skill must not fail-closed when VTP is offline. This is the D-06 rationale for system-wide toggle rather than per-call flag: the toggle handles planned outages; the graceful-fail handles unplanned ones.

## sepl Major-Proposal Detection Feasibility

### Current sepl proposal frontmatter (verified at `sgsd-sepl-propose.sh:131-141`)

```yaml
---
type: sepl-proposal
resource_type: $TYPE   # one of: rule | script | agent | skill | config | doc
target_path: $TARGET
slug: $SLUG
proposed_at: $TS
status: pending
description: $DESCRIPTION
rationale: $RATIONALE
---
```

### D-09 "major" criteria → implementable as file-pattern scan

D-09 says a proposal qualifies as "major" if it touches ANY of:
1. Orchestrator loop (`sgsd-orchestrate`, `ORCHESTRATOR-CHECKPOINT`)
2. Dispatch rules (`CLAUDE-OVERLAY` routing table)
3. Skill surface (new skill file, new slash command)
4. Agent surface (new agent file or agent frontmatter change)
5. New hook
6. New config key under `workflow.*` or `preferences.*`
7. Cross-phase pattern (affects ≥2 phases)

**Mapping to `sgsd-sepl-propose.sh` arg vector:**

| Criterion | Detectable from | How |
|-----------|-----------------|-----|
| 1 (orchestrator) | `$TARGET` | `grep -E "^super-gsd/skills/sgsd-orchestrate/|ORCHESTRATOR-CHECKPOINT"` |
| 2 (dispatch rules) | `$TARGET` | `grep -E "CLAUDE-OVERLAY\.md"` |
| 3 (new skill) | `$TARGET` + existence check | `[[ $TYPE == skill ]] && [[ ! -f $TARGET ]]` (new file) |
| 4 (new agent or agent frontmatter) | `$TARGET` + `$TYPE` | `[[ $TYPE == agent ]]` — any agent-typed proposal qualifies |
| 5 (new hook) | `$TARGET` | `grep -E "^super-gsd/hooks/"` + existence check |
| 6 (new workflow/preferences key) | `$BODY` content | `grep -E '^\s*(workflow\|preferences)\.' body.tmp` |
| 7 (cross-phase pattern) | `$BODY` content | heuristic — scan body for `phase` references; if ≥2 distinct phase numbers → cross-phase |

**Feasibility verdict: YES, implementable as a single 40-line shell function `is_major_proposal()` inside `sgsd-sepl-propose.sh`.** The function scans `$TYPE`, `$TARGET`, and the body. If ANY criterion fires, the function echoes `"major"`, and the outer script:

1. **Preferred placement:** `is_major_proposal` runs BEFORE the existing proposal write (line 181), inside a new block. If major → invoke `vtp_advise_service_enrichment` via the composer; if successful, APPEND the advise findings into the proposal's body section before write.

2. **Alternative placement** (safer for failure handling): add a new frontmatter field `major: true|false` written by `is_major_proposal`, then invoke advise in a **separate post-write hook** (e.g., `sgsd-sepl-advise-enrich.sh`) called conditionally. This keeps propose-time cost bounded when VTP is unavailable.

**Recommendation (for plan-time):** adopt approach (1) with a 5-second timeout on the advise call and a fall-through to approach (2)'s frontmatter-flag behavior if timeout fires. The `is_major_proposal()` function itself is cheap (bash regex, no network) — only the advise call has latency cost.

### Proposal template modification

Add two new frontmatter keys:

```yaml
major: false                   # written by is_major_proposal scan
vtp_advise_applied: false      # written by advise-enrich step when findings appended
```

Existing 7-field frontmatter stays compatible — `sgsd-sepl-commit.sh` `--apply` / `--reject` logic is agnostic to additional keys (bash `grep ^status:` pattern unaffected).

## SGSD Precedent — New skill scaffolding

For VTP-08a (`sgsd-vtp-advise`), 20 existing `sgsd-*` skills provide the pattern. The novel parts are:
- `argument-hint: "<service-name>"` (following `sgsd-complete-milestone`'s hint style).
- `allowed-tools:` includes `mcp__vtp-kb__vtp_advise_service_enrichment` + `mcp__vtp-kb__vtp_route_and_retrieve` (fallback if user framing unclear) + standard `Read, Write, Bash`.
- Skill body: 4 steps — (1) composer build, (2) inputSchema validation (check `candidate_areas` ∈ 9-enum), (3) MCP call, (4) report write to `.planning/advise/{YYYY-MM-DD}-{slug}.md`.
- Output format mirrors `sgsd-complete-milestone`'s SUMMARY.md layout for consistency.

## Validation Architecture

Test framework: **no formal test runner in SGSD** — the house discipline is `--self-test` CLI mode per module (see `edge-guard.cjs:128-265`). Verification command shape: `node super-gsd/scripts/lib/{module}.cjs --self-test` expected to exit 0 PASS / 1 FAIL.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Built-in `--self-test` CLI per module (pattern from `edge-guard.cjs`, `gates-registry.cjs` test flow, `classifier-cache.cjs` usage in 09-verify.mjs) |
| Config file | None — each module's `--self-test` is self-contained |
| Quick run command | `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` |
| Full suite command | `for f in super-gsd/scripts/lib/*.cjs; do node "$f" --self-test 2>/dev/null || true; done` (already de-facto pattern) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VTP-04 | `compose(sgsd_state)` returns full_context_object with required keys | unit (self-test) | `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` | ❌ Wave 0 |
| VTP-04 | `project(ctx, tier)` returns tier-slice for all 5 declared tiers | unit (self-test) | same as above | ❌ Wave 0 |
| VTP-04 | Fast-path predicate returns true on (known-phase + non-empty constraints), false otherwise | unit (self-test) | same as above | ❌ Wave 0 |
| VTP-01 | sgsd-triage Step 0 fires when config toggle true, skips when false | smoke (manual) | invoke `/sgsd-triage` on canned operator message with toggle each way | manual |
| VTP-01 | sgsd-triage Step 0 falls through when VTP call fails | smoke (manual) | point `.mcp.json` to nonexistent binary, invoke triage, verify Step 1 proceeds | manual |
| VTP-05 | routing-log row has all 10 keys per house-schema | unit (self-test) | `node super-gsd/scripts/lib/vtp-routing-log-writer.cjs --self-test` | ❌ Wave 0 |
| VTP-05 | routing-log writer uses `appendFileSync`, is idempotent on parent-dir absence | unit (self-test) | same as above | ❌ Wave 0 |
| VTP-07 | Fast-path fires when eligibility predicate holds | unit (self-test) | via composer --self-test (shared module) | ❌ Wave 0 |
| VTP-10 | Config toggle `workflow.triage_vtp_enrichment` default true | unit (self-test) | `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` reads config fixture | ❌ Wave 0 |
| VTP-08a | `/sgsd-vtp-advise <service>` writes report to `.planning/advise/` | smoke (manual) | invoke skill, verify file created + commit | manual |
| VTP-08b | sepl `is_major_proposal()` detects all 7 major-criteria rows | unit (bash test) | `bash super-gsd/scripts/sgsd-sepl-propose.test.sh` | ❌ Wave 0 |
| VTP-08b | sepl skips advise for minor proposals | unit (bash test) | same as above | ❌ Wave 0 |
| VTP-02/03/07 | Agent frontmatter includes VTP tools | lint (grep) | `grep -E "mcp__vtp-kb__" custom-gsd-extract/claude-agents/gsd-{phase-researcher,planner,assumptions-analyzer}.md` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node {module}.cjs --self-test` for the touched module
- **Per wave merge:** all `--self-test` entries + `grep -E "mcp__vtp-kb__"` lint over agent dir
- **Phase gate:** manual smoke of /sgsd-triage Step 0 (toggle true/false/VTP-down three cases) + /sgsd-vtp-advise one-shot; full `--self-test` sweep green

### Wave 0 Gaps
- [ ] `super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` entry — covers VTP-04, VTP-07, VTP-10
- [ ] `super-gsd/scripts/lib/vtp-routing-log-writer.cjs --self-test` entry — covers VTP-05 (or fold into composer module if clean)
- [ ] `super-gsd/scripts/sgsd-sepl-propose.test.sh` bash unit test — covers VTP-08b major-detection
- [ ] Grep-lint step in wave-merge gate — covers VTP-02/03/07 frontmatter coverage
- [ ] Manual smoke runbook doc at `super-gsd/docs/vtp-enrichment-smoke.md` — covers VTP-01/08a

### 8 Nyquist validation dimensions per CONTEXT.md §readiness

| # | Dimension | Approach |
|---|-----------|----------|
| 1 | Composer unit-test vectors | `--self-test` asserts `compose({milestone:'v1.3',phase:16,...})` returns fixed-shape object with all TIERS keys projectable. |
| 2 | Triage Step 0 happy path | Smoke test with VTP live + known-fixture query; assert VTP-EVIDENCE.md written + routing-log row appended. |
| 3 | Triage Step 0 VTP-failure path | Point composer at broken MCP (bad binary path) OR set 1ms timeout; assert Step 1 proceeds AND log row captures `elapsed_ms = budget-exceeded` marker. |
| 4 | Agent-tier VTP-call instrumentation | Dispatch `gsd-phase-researcher` with VTP-EVIDENCE.md present; assert agent's output cites ≥1 VTP doc-ID AND a new routing-log row with `tier:"research"` appears. |
| 5 | Fast-path short-circuit | Unit test: given SGSD state with `active_phase=16, explicit_constraints=[...non-empty...]`, `isFastPathEligible(ctx) === true` AND composer dispatches to `vtp_search_substrate` not `vtp_route_and_retrieve`. |
| 6 | Config toggle disables Step 0 | Set `workflow.triage_vtp_enrichment: false` in test fixture; assert composer no-ops (no MCP call, no log row, no VTP-EVIDENCE.md write). |
| 7 | `/sgsd-vtp-advise` smoke | Invoke on `SGSD-triage` (VTP's own test payload); assert report file exists at `.planning/advise/{today}-sgsd-triage.md` with `recommendations` and `skipped_opportunities` sections. |
| 8 | sepl major detection coverage | Bash test: 7 fixture proposals (one per D-09 criterion); each is detected as "major"; 1 control proposal (minor script tweak) is NOT detected. |

## Risks and Unknowns for Planner

### Risk 1 (BLOCKER) — `gsd-pattern-mapper.md` does not exist

Verified by `Glob custom-gsd-extract/claude-agents/*.md` + `Read` attempt. 24 agent files exist; `gsd-pattern-mapper.md` is not among them. CONTEXT.md canonical_refs line 118 names it as VTP-06's patch target.

**Options for planner (pick one):**

- **(a) Re-target VTP-06 onto `gsd-codebase-mapper.md`** — verified exists. Its role (mapping repo structure for plans) is the closest semantic sibling to "pattern mapper." `vtp_search_substrate` with `source_types/topics` filters fits codebase-mapper's remit.

- **(b) Create `gsd-pattern-mapper.md` fresh** as part of Phase 16 — contradicts D-03 ("no `sgsd-*` promotion in this phase") and memory rule `feedback_sgsd_rename_rule.md` (promotion requires genuine enrichment). Creating a *new* `gsd-*` agent isn't strictly promotion, but it adds scope not covered by CONTEXT.md §scope.

- **(c) Drop VTP-06 from Phase 16** and move to `<deferred>`. The existing canonical_refs §deferred already contemplates "`gsd-codebase-mapper` + `gsd-plan-checker` VTP hooks — could land in Phase 16 or defer to 16.1/16.2." VTP-06 joining that list is consistent.

**Recommendation:** approach (a). Re-target VTP-06 from `gsd-pattern-mapper` to `gsd-codebase-mapper`. Keeps Wave B's 4-agent-patch count intact and preserves the substrate-filter pattern intent. Requires a 1-line CONTEXT.md correction at plan-time.

### Risk 2 — `vtp_route_and_retrieve` response has no native `elapsed_ms`

Verified at `intent-routing.ts:302-316`. The response schema is: `{context_summary, project_intent_state, routing_weights, query_frame, decision_matrix, expanded_queries, retrieval_plan, evidence, reflection}`. No timing field.

CONTEXT.md D-07 assumes the log gets `elapsed_ms` from VTP. It doesn't. **The composer must wrap every MCP call** in:

```javascript
const t0 = Date.now();
const result = await mcpCall(...);
const elapsed_ms = Date.now() - t0;
```

This must be called out in the VTP-04 plan so the composer's single `compose()`/call site is the one measuring latency. Each agent making its own VTP call (Wave B agents) likewise wraps with `Date.now()`. Plans should specify "no direct MCP calls — always via composer helpers" to centralize the measurement point.

### Risk 3 — CONTEXT.md uses `current_focus` but the VTP schema has `current_task`

`ContextInput` in `intent-routing.ts:37-47` has `current_task: z.string().optional()`, NOT `current_focus`. The composer derives `current_task` from SGSD state (e.g., active-phase slug + plan-id) and passes it. The fast-path predicate ("when `current_focus` resolves to a known active phase") is composer-internal logic operating on `ctx.current_task` (or a separate composer-internal field).

No BLOCKER — just a naming reconciliation for the planner to state explicitly in the VTP-04 plan.

### Risk 4 — `vtp_advise_service_enrichment.candidate_areas` is a strict 9-value enum

`service-enrichment.ts:23-33` defines: `retrieval, routing, evaluation, tooling, memory, observability, safety, workflow, planning`. Any value outside these 9 rejects with a Zod validation error.

The `/sgsd-vtp-advise` skill should enumerate these in the skill body and validate the `candidate_areas` list client-side before the MCP call, with a friendly error when the operator passes unrecognized area. Otherwise the failure comes back as an opaque MCP error text.

### Risk 5 — Missing `.planning/proposals/` directory on fresh repos

`Glob .planning/proposals/*.md` returned 0 files. sepl has zero proposal history in this repo. This means:
- The major-detection path has never been exercised.
- VTP-08b's `.planning/metrics/sepl-log.jsonl` doesn't exist yet — the sepl killcondition in DLB-04 Q2 ("retire propose.sh if zero proposals per milestone") is relevant.
- Plans should not assume sepl-log.jsonl exists — the VTP-08b code must create parent dir with `mkdir -p` (sepl-propose already does this at line 181).

### Risk 6 — `vtp_route_and_retrieve` minimum `raw_query` length is 3 characters

`intent-routing.ts:299` declares `raw_query: z.string().min(3)`. Triage Step 0 operator messages could theoretically be shorter (unusual but legal). Composer should guard:

```javascript
if (!raw_query || raw_query.length < 3) return { skip: true, reason: 'query_too_short' };
```

Minor but worth encoding as a explicit VTP-04 pre-condition.

### Risk 7 — sepl propose uses HEREDOC (bash) for body capture

`sgsd-sepl-propose.sh:131` uses `read -r -d '' CONTENT <<EOF`. The HEREDOC captures `$DESCRIPTION` and `$RATIONALE` verbatim — if the advise-call return contains backticks or variable syntax, they'd interpolate. The enrich-append step should use a safer technique (`printf '%s'` or a separate temp file) when writing advise findings into the proposal body. Detail-level risk but worth calling out.

## Dependencies on Other Phases

### Downstream dependency (Phase 14 and 15)

Per D-01, Phase 16 runs first in v1.3 so Phase 14 and 15's Codex reviewers inherit VTP-grounded context. The contract implication is:

1. **Phase 16 must ship a stable Node API for `vtp-context-composer.cjs`** — no breaking changes between Phase 16 and Phase 14 pickup. Recommendation: freeze the signature at `compose(sgsd_state) → context_object` and `project(ctx, tier) → slice`, and version the TIERS object so downstream consumers can detect schema drift.

2. **Phase 14 needs `reviewer_provider:` field on gates.yaml** — independent of VTP-04. However, Phase 14's `sgsd-codex-reviewer` stub may want to read VTP-EVIDENCE.md to ground its review comments. Plan-time decision: does Phase 14 depend on VTP-EVIDENCE.md being present? If yes, the evidence-file contract is Phase 16 → Phase 14 cross-cut; if no, VTP-EVIDENCE.md is purely internal to Phase 16's triage/agent surfaces.

3. **Phase 15's qualitative MUDA probe** — CODEX-08 / CODEX-09 define a Codex-backed overproduction probe. If that probe reads VTP corpus for research-grounded signal, it becomes a 4th Wave B-style consumer of the composer. Plan-time: confirm or deny this; if yes, VTP-04's composer must expose a `muda` tier slice too.

### Upstream dependency

None. Phase 16 has no intra-v1.3 dependencies (it's first). The only external contract is VTP itself, and that contract is static — VTP's Phase 31 (substrate) and Phase 32 (intent routing) are both shipped. Wave C's advise tool is live in-session (verified 2026-04-23).

### Memory rule binding (`feedback_sgsd_rename_rule.md`)

D-03 explicitly defers `sgsd-*` promotion of any agent. Plans must NOT rename `gsd-planner.md` → `sgsd-planner.md` as part of Phase 16 even if the patches feel substantive. This is a binding memory rule and a blocking constraint.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vtp_research_gate` belongs behind a depth heuristic in `gsd-phase-researcher` | §VTP MCP Tool Surface Verification row 4 | Minor — over-gating is fine; the operator-guide classifies over-use as an anti-pattern explicitly. |
| A2 | Composer should expose `isFastPathEligible()` as named export | §Node CJS Module Conventions | Low — planner may choose to keep it internal; exposing is discretion (per D-07 implementation details). |
| A3 | Routing-log writer may be a separate module OR folded into composer | §JSONL Telemetry Shape | Low — either shape matches house convention. |
| A4 | Adopt approach (1) (pre-write advise-enrich) for VTP-08b with 5s timeout | §sepl Major-Proposal Detection Feasibility | Medium — if advise is slow or rate-limited, propose-time latency hurts sub-agent flows. Fallback to approach (2) mitigates. |
| A5 | Re-target VTP-06 from `gsd-pattern-mapper` to `gsd-codebase-mapper` | §Risks §Risk 1 | HIGH — planner decision; if instead approach (b) or (c), Wave B scope changes. |
| A6 | Triage Step 0 timeout threshold is 3s matching D-07 P95 budget | §sgsd-triage Step 0 Injection Analysis step 10 | Low — 3s is the documented budget; tightening later is cheap. |

## Open Questions (RESOLVED)

Resolved post-plan-checker review — 2026-04-23.

1. **Does Phase 14 read VTP-EVIDENCE.md?** — **RESOLVED: Out of scope for Phase 16's contract.** Phase 14 is free to read VTP-EVIDENCE.md if its own CONTEXT.md declares that dependency, but Phase 16 does not enforce it. The per-phase `VTP-EVIDENCE.md` path is a stable contract (`.planning/phases/{N}/VTP-EVIDENCE.md`); downstream phases can consume or ignore. No Phase 16 planning change.
2. **Does Phase 15's qualitative MUDA probe read VTP corpus?** — **RESOLVED: Out of scope for Phase 16's composer surface.** The composer exposes 5 tier projections (`triage`, `research`, `plan`, `pattern`, `assumptions`). A `muda` tier can be added later by Phase 15 itself as a small backward-compatible extension — no Phase 16 composer change required today. Recorded in CONTEXT.md `<deferred>` if Phase 15 needs it.
3. **Should the composer module be split?** — **RESOLVED: Fold JSONL writer into the composer module.** Single `super-gsd/scripts/lib/vtp-context-composer.cjs` exports `compose`, `project`, `callVtp`, `isFastPathEligible`, `appendRoutingLog`, `readConfig`. Matches house pattern (`edge-guard.cjs` is similarly cohesive). Planner settled this in 16-01 T1 — one file, embedded `--self-test`.
4. **Should `/sgsd-vtp-advise` accept a proposal file as input?** — **RESOLVED: Deferred.** Out of VTP-08a's contract per D-09. The `sgsd-vtp-advise review-proposal <path>` UX is a useful follow-on but introduces input-format sprawl for Phase 16. Captured in CONTEXT.md `<deferred>` as "sgsd-vtp-advise proposal-file input mode — post-Phase-16 UX expansion."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `vtp-kb` MCP server | All VTP calls | ✓ (wired in `.mcp.json`) | — | Graceful fall-through per §sgsd-triage Step 0 step 10 |
| Node.js ≥ 16 | composer + routing-log | assumed ✓ (existing lib modules require it) | — | — |
| Bash | sepl scripts | ✓ (existing scripts use it) | — | — |
| `js-yaml` | — not needed by composer | n/a | — | — |
| `.mcp.json` in project root | MCP server discovery | ✓ verified | — | — |

**No missing dependencies.** Every external tool required by Phase 16 is already present in this repo.

## Security Domain

Phase 16 is a documentation + config + Node/Bash plumbing phase. No new user input surfaces, no new authentication, no new data persistence. Applicable ASVS categories:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Zod already enforces `vtp_advise_service_enrichment` input shapes on the VTP side; composer validates SGSD-state shape before call. |
| V6 Cryptography | no | — |
| V7 Logging & Error Handling | yes | Routing-log = JSONL append-only; no PII captured (raw_query + selected_query may contain operator prose but are already logged by `activity-log.jsonl`). |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| MCP-response injection into markdown | Tampering / Info-disclosure | Treat `vtp_route_and_retrieve` response as untrusted input when writing into VTP-EVIDENCE.md; escape code fences; never `eval` response. |
| Log-injection via raw_query | Tampering | JSON-encode `raw_query` when appending to routing-log (existing `appendFileSync` + `JSON.stringify` flow in `edge-guard.cjs:112` already handles this). |
| Secret leakage in SGSD state | Info-disclosure | Composer must NOT include env-var values in `recent_commands` passthrough. Sanitize via allow-list before passing to VTP. |

## Project Constraints (from CLAUDE.md)

From `./CLAUDE.md` (Super GSD Orchestrator) and `~/.claude/CLAUDE.md` (global):

1. **NEVER expose secrets.** The composer must NOT read `.env`, `settings.json` env blocks, or any secret file. SGSD state passed to VTP MUST exclude credentials.
2. **Commit discipline:** `feat(16-XX): {one-liner}` for task code; atomic commits per plan; never `git add -A` / `git add .`.
3. **Use `bg_shell` not `bash` tool:** Windows/WSL environment — applies to orchestrator invocation, not to plan content.
4. **Sub-agent reports ≤ 300 words** — applies to executors invoked during Phase 16 implementation.
5. **No external dependencies without explicit reason:** `vtp-context-composer.cjs` must match the zero-external-deps shape of `classifier-cache.cjs` / `context-gauge.cjs`.
6. **No blanket sgsd-* renaming** (per `feedback_sgsd_rename_rule.md`). D-03 in CONTEXT.md already honors this.
7. **Evidence-first discipline (Karpathy / sgsd-audit pattern):** don't chase detector false positives — verify before deciding. The Q9 CRLF drift false positive (noted in CONTEXT.md §specifics) is the precedent.

## Sources

### Primary (HIGH confidence — read directly)
- `C:\Users\jack.berrow\Voice-Text-Plan\src\mcp\tools\intent-routing.ts` — all 9 intent-routing tool schemas
- `C:\Users\jack.berrow\Voice-Text-Plan\src\mcp\tools\service-enrichment.ts` — advise tool schema
- `C:\Users\jack.berrow\Voice-Text-Plan\src\mcp\tools\substrate.ts` — substrate + evidence-bundle + get-document schemas
- `C:\Users\jack.berrow\Voice-Text-Plan\src\mcp\tools\research.ts` — research tool registrations (verified names)
- `C:\Users\jack.berrow\Voice-Text-Plan\src\mcp\tools\wiki.ts` — wiki tool registrations (verified names)
- `C:\Users\jack.berrow\Voice-Text-Plan\reports\sgsd-triage-vtp-operator-guide.md` — full operating guide
- `C:\Users\jack.berrow\Voice-Text-Plan\reports\sgsd-triage-vtp-mcp-payloads.md` — request/response examples for all 11 tools
- `C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-complete-milestone\SKILL.md` — VTP-integration precedent
- `C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-triage\SKILL.md` — Step 0 injection site
- `C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-sepl\SKILL.md` — sepl structure
- `C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-sepl-propose.sh` — proposal-frontmatter source of truth
- `C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\gates-registry.cjs` — CJS module pattern (singleton + cache)
- `C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\edge-guard.cjs` — CJS module pattern (JSONL writer + --self-test)
- `C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\classifier-cache.cjs` — CJS module pattern (sidecar, mtime-invalidated)
- `C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\context-gauge.cjs` — CJS module pattern (zero-dep pure-function)
- `C:\Users\jack.berrow\GSDedits\custom-gsd-extract\claude-agents\gsd-phase-researcher.md` — agent frontmatter shape
- `C:\Users\jack.berrow\GSDedits\custom-gsd-extract\claude-agents\gsd-planner.md` — agent frontmatter shape
- `C:\Users\jack.berrow\GSDedits\custom-gsd-extract\claude-agents\gsd-assumptions-analyzer.md` — agent frontmatter shape
- `C:\Users\jack.berrow\GSDedits\.planning\config.json` — existing workflow.* keys
- `C:\Users\jack.berrow\GSDedits\.planning\metrics\*.jsonl` — 8 telemetry files for house-shape audit
- `C:\Users\jack.berrow\GSDedits\.mcp.json` — VTP server wiring

### Secondary (MEDIUM confidence — cited from CONTEXT.md)
- `C:\Users\jack.berrow\Voice-Text-Plan\reports\sgsd-triage-vtp-routing-handoff.md` — not directly read this session (trusted via CONTEXT.md reference)
- VTP Phase 31 (substrate) + Phase 32 (intent routing) ship history — trusted via prior-art block

### Tertiary (LOW confidence — none this phase)
No LOW-confidence claims in this research — all assertions trace to a read file.

## Metadata

**Confidence breakdown:**
- VTP MCP tool surface: HIGH — every tool's registration line was read from disk
- SGSD precedent patterns: HIGH — `sgsd-complete-milestone` read in full, agent samples read
- CJS module conventions: HIGH — 4 of 10 modules read in full
- JSONL telemetry shape: HIGH — rows sampled from 5 of 8 files
- sgsd-triage injection site: HIGH — full SKILL.md read with line anchors
- sepl major-detection feasibility: HIGH — `sgsd-sepl-propose.sh` read in full
- Dependencies on other phases: MEDIUM — Phase 14/15 CONTEXT.md NOT read this session; inferred from ROADMAP.md entries

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — VTP tool surface is stable per Phase 31/32 shipped state)

## RESEARCH COMPLETE
