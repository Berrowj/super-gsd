# Phase 16: VTP Enrichment as Cross-Phase Primitive — Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 11 (plus 1 config modification)
**Analogs found:** 11 / 11 (one novel — VTP-EVIDENCE.md template has no analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `super-gsd/scripts/lib/vtp-context-composer.cjs` (NEW) | lib / utility | request-response + JSONL append | `super-gsd/scripts/lib/gates-registry.cjs` + `edge-guard.cjs` | strong (CJS module + JSONL writer hybrid) |
| `super-gsd/skills/sgsd-triage/SKILL.md` (MOD) | skill / orchestrator | event-driven (auto-fire) | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (allowed-tools + inline VTP) | exact (same YAML frontmatter shape) |
| `super-gsd/skills/sgsd-sepl/SKILL.md` (MOD) | skill / gated branch | request-response | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | exact (frontmatter pattern) |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` (MOD, optional) | skill / orchestrator | event-driven | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | exact |
| `super-gsd/skills/sgsd-write-plan/SKILL.md` (MOD, optional) | skill / plan author | request-response | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | exact |
| `super-gsd/skills/sgsd-vtp-advise/SKILL.md` (NEW) | skill / standalone | request-response | `super-gsd/skills/sgsd-muda-audit/SKILL.md` + `sgsd-complete-milestone/SKILL.md` | strong (standalone-skill + VTP-tools hybrid) |
| `custom-gsd-extract/claude-agents/gsd-phase-researcher.md` (MOD) | agent / researcher | request-response | same file; pattern IS the analog — add to `tools:` comma-list | in-place edit |
| `custom-gsd-extract/claude-agents/gsd-planner.md` (MOD) | agent / planner | request-response | same file — add to `tools:` comma-list | in-place edit |
| `custom-gsd-extract/claude-agents/gsd-codebase-mapper.md` (MOD, per E-01) | agent / mapper | request-response | same file — add to `tools:` comma-list | in-place edit |
| `custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md` (MOD) | agent / analyzer | request-response | same file — add to `tools:` comma-list | in-place edit |
| `.planning/metrics/vtp-routing-log.jsonl` (NEW schema; runtime-created) | metrics / telemetry | append-only event stream | `.planning/metrics/plan-errors.jsonl` (`event:` key) + `edge-guard-log.jsonl` (10-key row shape + `appendFileSync`) | exact (house JSONL shape) |
| `.planning/phases/{N}/VTP-EVIDENCE.md` (NEW template) | artifact / framing | write-once-per-phase | **no direct analog** — novel; loosely modelled on `.planning/phases/*/NN-CONTEXT.md` frontmatter | weak (novel artifact) |
| `.planning/config.json` (MOD) | config / project | configuration read | same file — extend existing `workflow.*` block | in-place edit |

---

## Pattern Assignments

### `super-gsd/scripts/lib/vtp-context-composer.cjs` (NEW — lib / utility, VTP-04)

**Primary analog:** `super-gsd/scripts/lib/gates-registry.cjs` (module shape + cache discipline)
**Secondary analog:** `super-gsd/scripts/lib/edge-guard.cjs` (JSONL writer + `--self-test` CLI)
**Tertiary analog:** `super-gsd/scripts/lib/context-gauge.cjs` (zero-dep pure function shape for `isFastPathEligible`)

**File header + imports pattern** — copy from `gates-registry.cjs:1-21`:
```javascript
'use strict';

/**
 * vtp-context-composer.cjs — Shared VTP context builder and tier projector.
 *
 * Exports: { compose, project, isFastPathEligible, callVtp, TIERS, resetCache }
 *
 * compose(sgsd_state)         — build full_context_object once (reads STATE.md, git log, errors)
 * project(ctx, tier)          — zero-cost tier slice: triage|research|plan|pattern|assumptions|standalone
 * isFastPathEligible(ctx)     — true when current_task maps to active phase AND explicit_constraints non-empty
 * callVtp(tool, args)         — Date.now()-bracketed MCP wrapper; returns {response, elapsed_ms, ok, reason?}
 * TIERS                       — Object.freeze({...}) declarative field-map per tier
 * resetCache()                — test-only: clear in-memory cache
 */

const fs   = require('fs');
const path = require('path');
```

**Cache + exports shape** — from `gates-registry.cjs:29,96`:
```javascript
let _cache = null;
// ...
module.exports = { compose, project, isFastPathEligible, callVtp, TIERS, resetCache };
```

**Narrow-catch error handling** — from `edge-guard.cjs:83-87`:
```javascript
try {
  const result = mcpCall(...);
  // ...
} catch (err) {
  // Narrow: only swallow VTP-shape errors; rethrow unknown
  if (!err.message.startsWith('vtp_')) throw err;
  return { ok: false, reason: err.message, elapsed_ms: Date.now() - t0 };
}
```

**JSONL append pattern** — copy from `edge-guard.cjs:109-112`:
```javascript
const logPath = path.resolve(projectDir, RELATIVE_LOG);
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
```

**`callVtp` wrapper pattern (NEW — enforces E-03 contract)** — synthesized from `context-gauge.cjs` pure-function style:
```javascript
async function callVtp(tool, args) {
  const t0 = Date.now();
  try {
    const response = await /* MCP invocation */;
    return { ok: true, response, elapsed_ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, reason: err.message || 'unknown', elapsed_ms: Date.now() - t0 };
  }
}
```

**`--self-test` CLI tail** — copy the entire shape from `edge-guard.cjs:128-265`:
- Use `fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-composer-'))` for sandbox
- Assert all TIERS keys projectable from a canned `sgsd_state`
- Assert `isFastPathEligible` true/false cases
- Assert routing-log row has 10 required keys (`ts, event, tier, skill_or_agent, raw_query, selected_query, retrieval_mode, reflection_verdict, evidence_hit_count, top_doc_id, elapsed_ms`)
- `process.exit(0)` PASS / `process.exit(1)` FAIL

---

### `super-gsd/skills/sgsd-triage/SKILL.md` (MOD — VTP-01, Wave A)

**Analog:** `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (frontmatter + inline VTP)

**Frontmatter patch pattern** — extend existing list at `sgsd-triage/SKILL.md:4-9` following `sgsd-complete-milestone/SKILL.md:5-14`:
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
  - Skill
  - AskUserQuestion
  - mcp__vtp-kb__vtp_route_and_retrieve
  - mcp__vtp-kb__vtp_search_substrate
```

**In-body invocation pattern** — mirror `sgsd-complete-milestone/SKILL.md:93`:
> "Query `mcp__vtp-kb__vtp_search` for prior milestone-like artifacts..."

So triage Step 0 body reads:
> "Call `mcp__vtp-kb__vtp_route_and_retrieve` via `vtp-context-composer.callVtp(...)` with the operator's raw query and the `triage`-tier context slice."

**Step 0 injection anchor (from RESEARCH.md §sgsd-triage Step 0 Injection):**
- Insert new `## Step 0: VTP Enrichment (triage context grounding)` between line 37 (`<process>` open) and line 39 (existing `## Step 1: Brainstorm`).
- 10-step pseudo-spec already in RESEARCH.md line 268-284 — copy verbatim into plan's `<action>` block.

**Graceful-fail discipline** — RESEARCH.md step 10 (critical):
> On MCP failure or timeout >3s: log row with elapsed_ms = budget-exceeded marker; do NOT block — proceed to Step 1 with operator's raw query verbatim.

---

### `super-gsd/skills/sgsd-sepl/SKILL.md` (MOD — VTP-08b, Wave C)

**Analog:** `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (frontmatter + tiered VTP call)

**Frontmatter patch** — extend `sgsd-sepl/SKILL.md:4-7`:
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
  - mcp__vtp-kb__vtp_advise_service_enrichment
  - mcp__vtp-kb__vtp_route_and_retrieve
```

**Major-detection placement** — per RESEARCH.md §sepl Major-Proposal Detection:
- Add `is_major_proposal()` bash function to `sgsd-sepl-propose.sh` BEFORE the existing HEREDOC at line 131.
- If major → call `vtp_advise_service_enrichment` via composer (5s timeout); append findings to proposal body BEFORE the HEREDOC write.
- Fallback: frontmatter-flag + separate hook if timeout fires.

**Proposal frontmatter extension** — add two keys to existing template at `sgsd-sepl-propose.sh:131-141`:
```yaml
major: false                   # written by is_major_proposal scan
vtp_advise_applied: false      # written by advise-enrich step
```
Existing `grep ^status:` logic in `sgsd-sepl-commit.sh` is agnostic to new keys — backward compatible.

---

### `super-gsd/skills/sgsd-orchestrate/SKILL.md` (MOD, optional — VTP-09 consumer)

**Analog:** `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — no new tools needed (Read is already declared).

**Patch scope:** add prelude-injection paragraph in the dispatch-loop body describing:
> "Before composing each agent prompt, read `.planning/phases/{active_phase}/VTP-EVIDENCE.md` if present. Inject its framing block (selected_query, retrieval_mode, reflection_verdict, top-3 doc-IDs) as a prelude in the agent prompt."

**No frontmatter change needed** — sgsd-orchestrate/SKILL.md:4-14 already has `Read` + `Agent`.

---

### `super-gsd/skills/sgsd-write-plan/SKILL.md` (MOD, optional)

**Analog:** `super-gsd/skills/sgsd-complete-milestone/SKILL.md`

**Frontmatter patch** — extend `sgsd-write-plan/SKILL.md:7-10`:
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
  - mcp__vtp-kb__vtp_route_and_retrieve
```

**In-body patch:** before plan drafting, read `.planning/phases/{N}/VTP-EVIDENCE.md` if present; else call composer + `vtp_route_and_retrieve` directly with plan-tier slice.

---

### `super-gsd/skills/sgsd-vtp-advise/SKILL.md` (NEW — VTP-08a, Wave C)

**Primary analog:** `super-gsd/skills/sgsd-muda-audit/SKILL.md` (standalone-skill shape + `<process>` body)
**Secondary analog:** `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (VTP-tool frontmatter)

**Frontmatter** — synthesize from both analogs:
```yaml
---
name: sgsd-vtp-advise
description: "Standalone VTP service-enrichment advisor. Operator-invoked ad-hoc for conservative proposal-grounding ('should we evolve X?'). Writes report to .planning/advise/{YYYY-MM-DD}-{slug}.md."
argument-hint: "<service-name>"
allowed-tools:
  - Read
  - Write
  - Bash
  - mcp__vtp-kb__vtp_advise_service_enrichment
  - mcp__vtp-kb__vtp_route_and_retrieve
---
```

**Body skeleton** — copy `<objective>` + `<script_location>` + `<process>` structure from `sgsd-muda-audit/SKILL.md:9-23`:
```markdown
<objective>
[one paragraph — service-enrichment purpose + operator-invocation semantics]
</objective>

<process>
## Step 1: Determine service + areas
[parse <service-name> arg; client-side validate candidate_areas against 9-enum (Risk 4 in RESEARCH.md)]

## Step 2: Compose context
[call vtp-context-composer.compose(sgsd_state); project(ctx, 'standalone')]

## Step 3: Call advise
[mcp__vtp-kb__vtp_advise_service_enrichment via callVtp wrapper]

## Step 4: Write report
[.planning/advise/{YYYY-MM-DD}-{slug}.md; mirror sgsd-complete-milestone SUMMARY.md layout]
</process>
```

**Client-side validation pattern for 9-enum `candidate_areas`** (Risk 4) — enumerate in skill body: `retrieval, routing, evaluation, tooling, memory, observability, safety, workflow, planning`.

---

### `custom-gsd-extract/claude-agents/gsd-phase-researcher.md` (MOD — VTP-02, Wave B)

**Analog:** the file itself at line 4. **Agents use `tools:` comma-string, NOT `allowed-tools:` list.**

**Current frontmatter** (gsd-phase-researcher.md:4):
```yaml
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*
```

**Patch pattern** — append comma-separated VTP tools to the existing line:
```yaml
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_get_research, mcp__vtp-kb__vtp_research_gate, mcp__vtp-kb__vtp_route_and_retrieve
```

**Wildcard alternative (more concise):** `mcp__vtp-kb__*` — legal per RESEARCH.md §SGSD Precedent Patterns point 2.

**In-body patch:** add one paragraph after `<role>` describing WHEN to call VTP (gated `vtp_research_gate` only when research-grounded AND raw_query mentions research/paper/principle keywords — per RESEARCH.md §Risk notes on cost-sensitivity).

---

### `custom-gsd-extract/claude-agents/gsd-planner.md` (MOD — VTP-03, Wave B)

**Analog:** file itself at line 4.

**Current frontmatter** (gsd-planner.md:4):
```yaml
tools: Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*
```

**Patch pattern:**
```yaml
tools: Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*, mcp__vtp-kb__vtp_route_and_retrieve, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_get_evidence_bundle
```

**In-body patch:** add paragraph on architecture-mode invocation — cite evidence inline with VTP doc-IDs when drafting PLAN.md.

---

### `custom-gsd-extract/claude-agents/gsd-codebase-mapper.md` (MOD — VTP-06, Wave B, per E-01)

**Analog:** file itself at line 4.

**Current frontmatter** (gsd-codebase-mapper.md:4):
```yaml
tools: Read, Bash, Grep, Glob, Write
```

**Patch pattern:**
```yaml
tools: Read, Bash, Grep, Glob, Write, mcp__vtp-kb__vtp_search_substrate
```

**In-body patch:** when mapping patterns, call `vtp_search_substrate` with `source_types` + `topics` filters to retrieve analog code/doc references alongside in-repo Grep.

**IMPORTANT per E-01:** the original VTP-06 target `gsd-pattern-mapper.md` does NOT exist in this directory (verified via Glob). Phase 16 patches `gsd-codebase-mapper.md` instead. The global `gsd-pattern-mapper` at `C:\Users\jack.berrow\.claude\agents\` is out of scope.

---

### `custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md` (MOD — VTP-07, Wave B)

**Analog:** file itself at line 4.

**Current frontmatter** (gsd-assumptions-analyzer.md:4):
```yaml
tools: Read, Bash, Grep, Glob
```

**Patch pattern:**
```yaml
tools: Read, Bash, Grep, Glob, mcp__vtp-kb__wiki_find_contradictions, mcp__vtp-kb__wiki_search
```

**In-body patch:** use `wiki_find_contradictions` as primary entry point (no search-first needed per RESEARCH.md §VTP Tool Surface row 9). Stress assumptions against wiki narrative pages for contradictions.

---

### `.planning/metrics/vtp-routing-log.jsonl` (NEW schema; runtime-created — VTP-05, Wave A)

**Primary analog:** `.planning/metrics/plan-errors.jsonl` (uses `event:` key discipline)
**Secondary analog:** `.planning/metrics/edge-guard-log.jsonl` (10-key row shape + `appendFileSync` write)

**House shape invariants** (observed across 8 metrics files):
1. First key is always `ts` — ISO 8601 UTC.
2. Event-type key is `event:` OR `tool:` OR `type:` depending on purpose.
3. Minified JSON, one row per line, `\n`-terminated.
4. Append-only via `appendFileSync`.
5. Nested objects allowed but shallow (≤1 level).

**Representative existing rows (verbatim):**
```json
{"ts":"2026-04-21T19:53:45.413Z","event":"validation_run","plan_file":"11-01-schema-file.md","phase":11,"plan":1,"schema_version":2,"mode":"load","valid":true,"error_count":0,"errors":[]}
```
```json
{"ts":"2026-04-19T19:59:00Z","phase":"08","warn":0,"fail":1,"exit":2,"probes":{"haiku":"PASS","narrative":"FAIL","git":"PASS"}}
```
```json
{"ts":"2026-04-21T21:15:28.566Z","type":"schema_pin_drift","expected_hash":"...","actual_hash":"..."}
```
```json
{"ts":"2026-04-08T22:56:44.557Z","tool":"Agent","model":"unknown","description":"unknown","est_input":1,"est_output":0,"total":1}
```

**Recommended `vtp-routing-log.jsonl` row shape** (10 fields matching CONTEXT.md canonical_refs, using `event:` key convention):
```json
{"ts":"2026-04-23T12:34:56.789Z","event":"vtp_call","tier":"triage","skill_or_agent":"sgsd-triage","raw_query":"how should sgsd query vtp","selected_query":"routed retrieval for sgsd triage","retrieval_mode":"architecture_hybrid","reflection_verdict":"sufficient","evidence_hit_count":7,"top_doc_id":"doc:abc123","elapsed_ms":1840}
```

**Field notes:**
- `event:"vtp_call"` — single event type (matches plan-errors.jsonl `validation_run` discipline)
- `tier` ∈ `triage | research | plan | pattern | assumptions | standalone`
- `reflection_verdict` — direct passthrough from `vtp_route_and_retrieve.reflection.verdict` (or `null` when reflection is null per VTP schema)
- `top_doc_id` — `evidence.documents[0]?.doc_id || null`
- `elapsed_ms` — composer-computed via `Date.now()` bracket (VTP has no native field — per E-03)

**File is created on first write.** Composer uses `fs.mkdirSync(path.dirname(logPath), { recursive: true })` + `appendFileSync` (same as `edge-guard.cjs:111-112`). No template file checked into repo — only the schema documented here.

---

### `.planning/phases/{N}/VTP-EVIDENCE.md` (NEW template — VTP-09, Wave A)

**No direct analog in the codebase.** This is a novel artifact per D-04.

**Closest shape reference:** `.planning/phases/*/NN-CONTEXT.md` YAML frontmatter pattern (sparse, declarative, ≤300 lines).

**Proposed template structure (planner's discretion per D-04):**
```markdown
# Phase {N}: VTP Evidence Framing

**Generated by:** sgsd-triage Step 0
**Generated at:** {ISO timestamp}
**Composer version:** {TIERS schema version}

## Framing

- **raw_query:** {operator message or agent-internal task}
- **selected_query:** {from vtp_route_and_retrieve.retrieval_plan.selected_query}
- **retrieval_mode:** {from retrieval_plan.retrieval_mode}
- **reflection_verdict:** {sufficient | too_generic | over_narrowed | weak_evidence | null}

## Top-3 Evidence Doc-IDs (references only — not full content)

1. `{doc_id}` — {rel_path, title}
2. `{doc_id}` — {rel_path, title}
3. `{doc_id}` — {rel_path, title}

## Re-query Contract

Downstream agents must re-query VTP for tier-specific evidence at call time using these doc-IDs as seeds. This file holds framing only; evidence is always fresh-at-use.
```

**Framing-only discipline (D-04):** no full document content embedded; doc-IDs are references. ≤300 lines total.

**Write path:** `sgsd-triage` Step 0 writes via `Write` tool. Downstream agents read via `Read` tool.

---

### `.planning/config.json` (MOD — VTP-10, Wave A)

**Analog:** same file, existing `workflow` block at lines 1-20.

**Existing `workflow.*` convention (verified):** flat keys under `workflow`, boolean/integer/string values, snake_case naming.

**Existing keys as reference:**
```json
"nyquist_validation": true,
"security_enforcement": true,
"auto_advance": true,
"skip_discuss": false,
"plan_check": true,
"verifier": true,
"research": true,
```

**Patch pattern** — add one key under `workflow`:
```json
"triage_vtp_enrichment": true
```

**Placement suggestion:** insert after `research: true` (line 6) to group with other preflight-style toggles.

**Consumed by:** `vtp-context-composer.cjs` reads via `JSON.parse(fs.readFileSync('.planning/config.json','utf8')).workflow.triage_vtp_enrichment`. When `false`, composer short-circuits the triage Step 0 call — no MCP fire, no log row, no VTP-EVIDENCE.md write.

---

## Shared Patterns

### MCP Tool Declaration Convention

**Two distinct shapes — DO NOT mix:**

| Surface | Frontmatter key | Value format | Example |
|---------|-----------------|--------------|---------|
| Skills (`super-gsd/skills/*/SKILL.md`) | `allowed-tools:` | YAML list of strings | `- mcp__vtp-kb__vtp_route_and_retrieve` |
| Agents (`custom-gsd-extract/claude-agents/*.md`) | `tools:` | single comma-separated string | `..., mcp__vtp-kb__vtp_route_and_retrieve` |

**Source of truth:** `sgsd-complete-milestone/SKILL.md:5-14` (skills) vs `gsd-phase-researcher.md:4` (agents).

**Apply to:** all skill and agent patches in Phase 16.

### In-Body Tool Invocation

From `sgsd-complete-milestone/SKILL.md:93`:
> "Query `mcp__vtp-kb__vtp_search` for prior milestone-like artifacts and adjacent governance research."

**Apply to:** every VTP call-site — invoke by canonical name including the `mcp__vtp-kb__` prefix inside backticks. This is how tool-gating actually works.

### CJS Module Discipline (from `gates-registry.cjs`, `edge-guard.cjs`, `context-gauge.cjs`)

1. **`'use strict';` at line 1.**
2. **JSDoc at file top** — one-line summary, `Exports: { ... }` list, per-export signature.
3. **Aligned `const fs = require('fs')` block** — not destructured imports.
4. **No external runtime deps** — zero-dep like `context-gauge.cjs`, or lazy-load like `gates-registry.cjs:41-44`.
5. **Per-function JSDoc** with `@param`, `@returns`, defensive input handling.
6. **`module.exports = { ... }` at EOF** — object-literal, not named assignments.
7. **Cache discipline** — expose `resetCache()` for tests; document "process singleton" loudly.
8. **Atomic writes** via `appendFileSync` for JSONL (append is atomic enough).
9. **Narrow catches, rethrow on unknown** (see `edge-guard.cjs:83-87`).
10. **`--self-test` CLI tail** — full self-contained test with temp-dir sandbox, assertion of required row keys, exit 0/1 PASS/FAIL.

### JSONL Telemetry Conventions (from 8 metrics files)

1. First key is always `ts` (ISO 8601 UTC, millisecond or second granularity).
2. Event-type key: `event:` (preferred when multiple event types coexist) OR `tool:` OR `type:`.
3. Minified JSON, one row per line, newline-terminated.
4. Append-only — never edited in place.
5. Nested objects allowed but shallow (≤1 level).
6. Directory-create via `fs.mkdirSync(dir, { recursive: true })`.
7. Row write via `fs.appendFileSync(path, JSON.stringify(row) + '\n')`.

### Graceful-Fail / Circuit-Breaker

All VTP call-sites must fall through cleanly on:
- MCP offline (`.mcp.json` misconfigured, server down)
- Timeout >3s (D-07 P95 budget)
- Config toggle `workflow.triage_vtp_enrichment === false`

**Pattern** (synthesized from composer contract + `edge-guard.cjs:83-87`):
- On failure: log routing-log row with `elapsed_ms` = budget-exceeded marker, `reflection_verdict: null`.
- Do NOT block the calling skill/agent — proceed with raw query as fallback.
- Never fail-closed; always fail-open-and-degraded.

---

## No Analog Found

Files with no close match in the codebase (planner should synthesize from CONTEXT.md + RESEARCH.md):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/{N}/VTP-EVIDENCE.md` (template) | artifact / framing | write-once | Novel artifact; loose reference to existing CONTEXT.md frontmatter style only. D-04 defines the fields; planner picks the exact layout. |

**Mitigation:** RESEARCH.md §Phase Requirements row VTP-09 confirms every field is sourceable from `vtp_route_and_retrieve` response at `intent-routing.ts:302-316`. Template shape proposed above under the VTP-EVIDENCE.md section.

---

## Metadata

**Analog search scope:**
- `super-gsd/scripts/lib/*.cjs` (10 modules — 3 read in full: `gates-registry`, `edge-guard`, `context-gauge`)
- `super-gsd/skills/sgsd-*/SKILL.md` (20 skills — 6 read: `sgsd-complete-milestone`, `sgsd-triage`, `sgsd-sepl`, `sgsd-orchestrate` header, `sgsd-write-plan` header, `sgsd-muda-audit` header, `sgsd-distill` header)
- `custom-gsd-extract/claude-agents/*.md` (headers verified for 4 target agents + codebase-mapper)
- `.planning/metrics/*.jsonl` (5 files sampled: activity, muda, plan-errors, readiness, token)
- `.planning/config.json` (full read)

**Files scanned:** ~30
**Pattern extraction date:** 2026-04-23
**Research errata applied:** E-01 (VTP-06 → gsd-codebase-mapper), E-02 (current_task not current_focus), E-03 (composer wraps elapsed_ms)
