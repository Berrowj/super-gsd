---
phase: 16-vtp-enrichment
plan: 01
type: execute
wave: A
depends_on: []
files_modified:
  - C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\vtp-context-composer.cjs
  - C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-triage\SKILL.md
  - C:\Users\jack.berrow\GSDedits\.planning\config.json
  - C:\Users\jack.berrow\GSDedits\super-gsd\docs\vtp-enrichment-smoke.md
autonomous: true
requirements:
  - VTP-04
  - VTP-01
  - VTP-05
  - VTP-09
  - VTP-10
tags:
  - vtp
  - composer
  - triage
  - telemetry
must_haves:
  truths:
    - "vtp-context-composer.cjs exists and its --self-test exits 0"
    - "sgsd-triage SKILL.md has a Step 0 that fires BEFORE Step 1 Brainstorm"
    - "Step 0 graceful-fails when MCP call errors or exceeds 3s — Step 1 still proceeds"
    - "workflow.triage_vtp_enrichment key exists in .planning/config.json (default true)"
    - "Every VTP call emits a row to .planning/metrics/vtp-routing-log.jsonl with elapsed_ms"
    - "VTP-EVIDENCE.md is framing-only (selected_query + retrieval_mode + reflection + top-3 doc-IDs), ≤300 lines"
    - "All VTP calls route through composer.callVtp wrapper — no direct mcp__vtp-kb__* calls from triage body"
  artifacts:
    - path: "super-gsd/scripts/lib/vtp-context-composer.cjs"
      provides: "compose() + project() + isFastPathEligible() + callVtp() + TIERS + resetCache"
      contains: "module.exports = { compose, project, isFastPathEligible, callVtp, TIERS, resetCache }"
    - path: "super-gsd/skills/sgsd-triage/SKILL.md"
      provides: "Step 0 VTP-enrichment injection + updated allowed-tools list"
      contains: "## Step 0: VTP Enrichment"
    - path: ".planning/config.json"
      provides: "workflow.triage_vtp_enrichment boolean toggle"
      contains: "\"triage_vtp_enrichment\": true"
    - path: "super-gsd/docs/vtp-enrichment-smoke.md"
      provides: "Manual smoke runbook for Step 0 happy/fail/toggle paths"
  key_links:
    - from: "super-gsd/skills/sgsd-triage/SKILL.md#Step 0"
      to: "super-gsd/scripts/lib/vtp-context-composer.cjs"
      via: "Bash-invoked Node one-liner calling compose()/project()/callVtp()"
      pattern: "vtp-context-composer"
    - from: "super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp"
      to: ".planning/metrics/vtp-routing-log.jsonl"
      via: "fs.mkdirSync(dir,{recursive:true}) + fs.appendFileSync(logPath, JSON.stringify(row)+'\\n')"
      pattern: "appendFileSync.*vtp-routing-log"
    - from: "super-gsd/scripts/lib/vtp-context-composer.cjs#compose"
      to: ".planning/config.json"
      via: "JSON.parse(fs.readFileSync(config,'utf8')).workflow.triage_vtp_enrichment"
      pattern: "triage_vtp_enrichment"
---

<objective>
Wave A establishes the Phase 16 primitive. Ship the shared `vtp-context-composer.cjs` helper (one module, six exports), wire `sgsd-triage` Step 0 to call VTP via the composer before Step 1 Brainstorm, add the `workflow.triage_vtp_enrichment` config toggle, and prove the pattern end-to-end via a manual smoke runbook. Every other Wave B/C surface consumes this composer — no direct `mcp__vtp-kb__*` calls from skills or agents allowed.

Purpose: satisfies D-04 (framing-only VTP-EVIDENCE.md), D-05 (one composer, tier projections), D-06 (config toggle, no per-call flag), D-07 (3s P95 + fast-path + elapsed_ms wrapping per E-03), and requirements VTP-01/04/05/09/10.

Output: composer CJS module + patched triage SKILL.md + config toggle + smoke doc. Wave B + C start with a working primitive to consume.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:\Users\jack.berrow\GSDedits\.planning\STATE.md
@C:\Users\jack.berrow\GSDedits\.planning\ROADMAP.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-CONTEXT.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-RESEARCH.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md

<interfaces>
<!-- Key structural contracts extracted from codebase. Executor uses these directly — no exploration. -->

**CJS module skeleton (verbatim from gates-registry.cjs:1-21 + edge-guard.cjs:108-119):**
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
 * callVtp(tool, args)         — Date.now()-bracketed MCP wrapper; returns {ok, response, elapsed_ms, reason?}
 * TIERS                       — Object.freeze({...}) declarative field-map per tier
 * resetCache()                — test-only: clear in-memory cache
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

let _cache = null;

const TIERS = Object.freeze({
  triage:      { fields: ['repo','current_task','recent_turns','explicit_constraints'] },
  research:    { fields: ['repo','current_task','explicit_constraints','recent_errors'] },
  plan:        { fields: ['repo','active_file','current_task','blockers','explicit_constraints'] },
  pattern:     { fields: ['repo','active_file','current_task'] },
  assumptions: { fields: ['repo','current_task','recent_turns','recent_errors'] },
  standalone:  { fields: ['repo','current_task','explicit_constraints'] },
});

// ... compose, project, isFastPathEligible, callVtp, resetCache ...

module.exports = { compose, project, isFastPathEligible, callVtp, TIERS, resetCache };

// --self-test CLI tail — mirrors edge-guard.cjs:128-265
if (require.main === module && process.argv.includes('--self-test')) {
  runSelfTest();
}
```

**VTP ContextInput schema (from Voice-Text-Plan/src/mcp/tools/intent-routing.ts:37-47 — E-02):**
```
{ session_id?, repo?, active_file?, recent_turns?[], recent_commands?[],
  recent_errors?[], current_task?, blockers?[], explicit_constraints?[] }
```
Note: schema field is `current_task`, NOT `current_focus`. D-07 fast-path operates on `ctx.current_task`.

**vtp_route_and_retrieve response shape (intent-routing.ts:302-316 — no native elapsed_ms per E-03):**
```
{ context_summary, project_intent_state, routing_weights, query_frame, decision_matrix,
  expanded_queries[], retrieval_plan: { selected_query, alternate_queries, retrieval_mode, answer_shape },
  evidence: { hits[], entities[], documents[] }, reflection: {verdict, ...} | null }
```
Composer wraps every MCP call with `Date.now()` bracket. `reflection` can be null — code handles both.

**raw_query constraint (intent-routing.ts:299):** `z.string().min(3)` — composer pre-guards.

**Routing-log row shape (10 keys, house JSONL convention from edge-guard.cjs + plan-errors.jsonl):**
```json
{"ts":"2026-04-23T12:34:56.789Z","event":"vtp_call","tier":"triage","skill_or_agent":"sgsd-triage","raw_query":"...","selected_query":"...","retrieval_mode":"architecture_hybrid","reflection_verdict":"sufficient","evidence_hit_count":7,"top_doc_id":"doc:abc123","elapsed_ms":1840}
```

**JSONL write pattern (verbatim from edge-guard.cjs:109-112):**
```javascript
const logPath = path.resolve(projectDir, '.planning/metrics/vtp-routing-log.jsonl');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
```

**Skill frontmatter shape (verbatim schema from sgsd-complete-milestone/SKILL.md:5-14):**
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
DO NOT convert to `tools:` comma-string — that's agent-only.

**Triage Step 0 anchor (sgsd-triage/SKILL.md line 37-39):**
- Line 37: `<process>` open
- Line 38: blank
- Line 39: `## Step 1: Brainstorm (superpowers:brainstorming)`

Inject new `## Step 0: VTP Enrichment (triage context grounding)` block between lines 37 and 39.

**Step 0 pseudo-spec (verbatim from RESEARCH.md §sgsd-triage Step 0 Injection Analysis):**
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

**VTP-EVIDENCE.md template (verbatim from PATTERNS.md §VTP-EVIDENCE.md template):**
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

**Config.json workflow block (existing verified keys):**
```json
"workflow": {
  "mode": "yolo",
  "granularity": "standard",
  "skip_discuss": false,
  "research": true,
  "triage_vtp_enrichment": true,   ← NEW (insert after "research")
  "plan_check": true,
  ...
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship vtp-context-composer.cjs with callVtp wrapper + --self-test</name>
  <files>C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\vtp-context-composer.cjs</files>
  <read_first>
    - C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\gates-registry.cjs (module shape + cache singleton — lines 1-96)
    - C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\edge-guard.cjs (JSONL writer + --self-test CLI — lines 83-265)
    - C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\context-gauge.cjs (zero-dep pure-function shape)
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md (§vtp-context-composer.cjs section)
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-RESEARCH.md (§Node CJS Module Conventions + §JSONL Telemetry Shape + §Validation Architecture)
  </read_first>
  <behavior>
    - compose({milestone:'v1.3',phase:16,active_file:'...',blockers:[],explicit_constraints:['D-07'],recent_turns:[],recent_errors:[]}) returns an object with ALL fields from every TIER's field list populated (or null when absent).
    - project(ctx, 'triage') returns {repo, current_task, recent_turns, explicit_constraints} only — no other keys.
    - project(ctx, 'research'), ('plan'), ('pattern'), ('assumptions'), ('standalone') each return the matching TIERS[tier].fields slice.
    - project(ctx, 'bogus_tier') throws a narrow Error whose message starts with 'vtp_tier_unknown:'.
    - isFastPathEligible(ctx) returns true ONLY when ctx.current_task is a non-empty string AND ctx.explicit_constraints is a non-empty array.
    - isFastPathEligible({}) returns false. isFastPathEligible({current_task:'x'}) returns false (no constraints). isFastPathEligible({current_task:'', explicit_constraints:['y']}) returns false (empty task).
    - callVtp(tool, args) returns {ok:true, response, elapsed_ms:Number} on success. elapsed_ms is Date.now() - t0, always present even on failure.
    - callVtp catches VTP-shape errors (message starts with 'vtp_' or 'mcp_') and returns {ok:false, reason, elapsed_ms}. Unknown errors rethrow.
    - callVtp guards raw_query < 3 chars and returns {ok:false, reason:'query_too_short', elapsed_ms:0} without invoking MCP.
    - Routing-log row has all 10 house-shape keys in documented order: ts, event, tier, skill_or_agent, raw_query, selected_query, retrieval_mode, reflection_verdict, evidence_hit_count, top_doc_id, elapsed_ms. event is always 'vtp_call'.
    - Log writer creates `.planning/metrics/` directory if absent (fs.mkdirSync recursive:true) and uses appendFileSync — idempotent on parent-dir absence.
    - resetCache() clears _cache so subsequent compose() calls re-read STATE.md.
    - --self-test exits 0 on all asserts passing, 1 on first failure with a reason string naming the failing key/case. Uses fs.mkdtempSync temp dir — never touches real .planning/metrics/.
  </behavior>
  <action>
Create `C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\vtp-context-composer.cjs` matching the CJS module skeleton shown in <interfaces>. Structure:

1. `'use strict';` on line 1.
2. JSDoc block with `Exports: {...}` list and per-export one-line signature (verbatim from <interfaces>).
3. Requires: `const fs = require('fs'); const path = require('path'); const os = require('os');`. Zero external deps.
4. Module-level `let _cache = null;` for compose() memoization.
5. `const TIERS = Object.freeze({...})` with the exact 6-tier field map from <interfaces>.
6. Constant `const ROUTING_LOG_PATH = '.planning/metrics/vtp-routing-log.jsonl';` (relative to projectDir).
7. Constant `const FAST_PATH_TIMEOUT_MS = 3000;` and `const BUDGET_EXCEEDED = -1;` (the marker used when elapsed_ms exceeds budget).

Functions (order: pure helpers first, main exports last):

**`function readConfigToggle(projectDir)`** — reads `.planning/config.json`, returns `workflow.triage_vtp_enrichment` boolean. Defaults to `true` if file missing or key absent. Narrow-catch: rethrow JSON-parse errors (real bugs), swallow ENOENT.

**`function compose(sgsd_state)`** — returns a full context object shaped like VTP's ContextInput:
```
{ session_id, repo, active_file, recent_turns: [], recent_commands: [], recent_errors: [],
  current_task, blockers: [], explicit_constraints: [] }
```
Derive `current_task` from `sgsd_state.phase` + `sgsd_state.plan` (e.g., `"phase:16,plan:01"`). Cache the result in `_cache` keyed by a hash of sgsd_state inputs so repeat-reads of STATE.md/git-log are O(1).

**`function project(ctx, tier)`** — O(1) slice. If `!TIERS[tier]` throw `new Error('vtp_tier_unknown: ' + tier)`. Return `Object.fromEntries(TIERS[tier].fields.map(k => [k, ctx[k] ?? null]))`.

**`function isFastPathEligible(ctx)`** — returns `Boolean(ctx && typeof ctx.current_task === 'string' && ctx.current_task.length > 0 && Array.isArray(ctx.explicit_constraints) && ctx.explicit_constraints.length > 0)`.

**`async function callVtp(tool, args, {projectDir, skillOrAgent, tier, rawQuery})`** — the E-03 wrapper. Logic:
```
const t0 = Date.now();
if (!rawQuery || rawQuery.length < 3) return { ok:false, reason:'query_too_short', elapsed_ms:0 };
try {
  // MCP invocation — the actual tool dispatch happens in the caller context; this wrapper
  // expects `args.mcpInvoke` to be a function that calls the MCP tool and returns its result.
  // If args.mcpInvoke missing, return {ok:false, reason:'no_mcp_invoke'} (allows test fixture injection).
  const response = await args.mcpInvoke(tool, args.payload);
  const elapsed_ms = Date.now() - t0;
  writeRoutingLogRow({ projectDir, skillOrAgent, tier, rawQuery, response, elapsed_ms });
  return { ok:true, response, elapsed_ms };
} catch (err) {
  const elapsed_ms = Date.now() - t0;
  // Narrow: swallow VTP/MCP shape errors; rethrow unknown
  const msg = err && err.message ? err.message : String(err);
  if (!/^(vtp_|mcp_|timeout)/.test(msg)) throw err;
  writeRoutingLogRow({ projectDir, skillOrAgent, tier, rawQuery, response:null, elapsed_ms, failureReason:msg });
  return { ok:false, reason:msg, elapsed_ms };
}
```

**`function writeRoutingLogRow({projectDir, skillOrAgent, tier, rawQuery, response, elapsed_ms, failureReason})`** — builds the 10-key row per house shape. Extract from response:
- `selected_query = response?.retrieval_plan?.selected_query ?? null`
- `retrieval_mode = response?.retrieval_plan?.retrieval_mode ?? null`
- `reflection_verdict = response?.reflection?.verdict ?? null`
- `evidence_hit_count = Array.isArray(response?.evidence?.hits) ? response.evidence.hits.length : 0`
- `top_doc_id = response?.evidence?.documents?.[0]?.doc_id ?? null`
Row is `{ts: new Date().toISOString(), event:'vtp_call', tier, skill_or_agent: skillOrAgent, raw_query: rawQuery, selected_query, retrieval_mode, reflection_verdict, evidence_hit_count, top_doc_id, elapsed_ms}`. Write via:
```javascript
const logPath = path.resolve(projectDir, ROUTING_LOG_PATH);
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
```

**`function resetCache()`** — test-only: `_cache = null;`.

**`module.exports = { compose, project, isFastPathEligible, callVtp, TIERS, resetCache };`**

**--self-test CLI tail (mirror edge-guard.cjs:128-265 structure exactly):**
```javascript
if (require.main === module && process.argv.includes('--self-test')) {
  runSelfTest();
}

function runSelfTest() {
  const REQUIRED_ROW_KEYS = ['ts','event','tier','skill_or_agent','raw_query','selected_query','retrieval_mode','reflection_verdict','evidence_hit_count','top_doc_id','elapsed_ms'];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-composer-'));
  let passed = true; let failReason = '';
  function fail(r) { passed = false; failReason = r; }

  // Test 1: compose() returns all documented fields
  // Test 2: project(ctx, tier) for all 6 TIERS returns exact field subset
  // Test 3: project(ctx, 'bogus') throws Error starting with 'vtp_tier_unknown:'
  // Test 4: isFastPathEligible true/false cases (4 scenarios)
  // Test 5: callVtp with rawQuery of 2 chars returns {ok:false, reason:'query_too_short', elapsed_ms:0}
  // Test 6: callVtp happy path writes row with all 10 keys + writes to tmpDir/.planning/metrics/vtp-routing-log.jsonl
  // Test 7: callVtp failure path (mcpInvoke throws 'vtp_timeout') returns {ok:false, reason:'vtp_timeout'} + row logged
  // Test 8: callVtp unknown-shape error (throws 'RuntimeError: bug') rethrows
  // Test 9: readConfigToggle defaults to true when config missing

  if (passed) { console.log('PASS'); process.exit(0); }
  else { console.error('FAIL: ' + failReason); process.exit(1); }
}
```

Error handling discipline (verbatim from edge-guard.cjs:83-87):
- Narrow catches — swallow VTP/MCP shape errors only.
- Rethrow anything else (programming bugs).
- Never fail-closed — all caller-facing paths return `{ok:false, reason, elapsed_ms}` instead of throwing.

Per D-07 and E-03: `callVtp` is the single measurement point. Skills and agents NEVER call MCP directly — always via `callVtp(...)`. This is a binding contract.

Per CLAUDE.md security rule: `compose()` MUST NOT include env-var values in `recent_commands` passthrough. Filter any string matching `/[A-Z_]+=/` or `/[A-Z][A-Z_]+_KEY/` out of `recent_commands` before returning.

**Commit:** `feat(16-01): add vtp-context-composer.cjs with callVtp wrapper + self-test`
  </action>
  <verify>
    <automated>node "C:/Users/jack.berrow/GSDedits/super-gsd/scripts/lib/vtp-context-composer.cjs" --self-test</automated>
  </verify>
  <acceptance_criteria>
    - `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` exits 0 with stdout `PASS`.
    - `grep -q "'use strict';" super-gsd/scripts/lib/vtp-context-composer.cjs` passes.
    - `grep -q "module.exports = { compose, project, isFastPathEligible, callVtp, TIERS, resetCache }" super-gsd/scripts/lib/vtp-context-composer.cjs` passes.
    - `grep -q "Object.freeze" super-gsd/scripts/lib/vtp-context-composer.cjs` passes (TIERS is frozen).
    - `grep -q "fs.appendFileSync" super-gsd/scripts/lib/vtp-context-composer.cjs` passes (JSONL write pattern).
    - `grep -q "fs.mkdirSync.*recursive" super-gsd/scripts/lib/vtp-context-composer.cjs` passes (idempotent parent-dir).
    - `grep -q "Date.now()" super-gsd/scripts/lib/vtp-context-composer.cjs` passes at least twice (E-03 wrapping).
    - `grep -c "require(" super-gsd/scripts/lib/vtp-context-composer.cjs` returns exactly 3 (fs, path, os) — zero external deps per CLAUDE.md rule 5.
  </acceptance_criteria>
  <done>Composer module exists, --self-test exits 0, all grep-verifiable shape invariants hold, zero external runtime deps.</done>
</task>

<task type="auto">
  <name>Task 2: Wire sgsd-triage Step 0 + add workflow.triage_vtp_enrichment config key</name>
  <files>
    C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-triage\SKILL.md
    C:\Users\jack.berrow\GSDedits\.planning\config.json
  </files>
  <read_first>
    - C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-triage\SKILL.md (lines 1-50 — current frontmatter + process block)
    - C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-complete-milestone\SKILL.md (lines 1-20 + lines 90-120 — VTP-tool frontmatter + in-body canonical-name invocation)
    - C:\Users\jack.berrow\GSDedits\.planning\config.json (workflow block — lines 1-20)
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md (§sgsd-triage/SKILL.md section + §sepl SKILL.md frontmatter example)
  </read_first>
  <action>
**File 1: `super-gsd/skills/sgsd-triage/SKILL.md` — patch frontmatter + inject Step 0**

**Frontmatter patch** (edit lines 4-10, current shape):
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
  - Skill
  - AskUserQuestion
```

Extend to (append 2 VTP tools after AskUserQuestion):
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

**Step 0 injection** (insert between line 37 `<process>` open and line 39 `## Step 1: Brainstorm...`):

```markdown

## Step 0: VTP Enrichment (triage context grounding)

Before brainstorming, run a VTP-routing pass so the downstream steps act against routed evidence instead of raw operator prose. This step is implemented via `super-gsd/scripts/lib/vtp-context-composer.cjs` — never call `mcp__vtp-kb__*` directly from this skill body.

1. **Config toggle check.** Read `.planning/config.json#workflow.triage_vtp_enrichment`. If `false`, skip Step 0 entirely and proceed to Step 1 with the operator's raw query verbatim.
2. **Compose context.** Invoke `node super-gsd/scripts/lib/vtp-context-composer.cjs` via Bash to run `compose(sgsd_state)` and return the `full_context_object`. `sgsd_state` is derived from `.planning/STATE.md` frontmatter (milestone, phase, plan, active_file) + the operator's raw message.
3. **Project to triage tier.** Call `project(ctx, 'triage')` → returns the 4-field slice `{repo, current_task, recent_turns, explicit_constraints}`.
4. **Fast-path check.** If `isFastPathEligible(ctx)` returns true (current_task resolves to a known active phase AND explicit_constraints is non-empty), call `mcp__vtp-kb__vtp_search_substrate` via `callVtp(...)` with phase-scoped `source_types` and `topics` filters.
   Else: call `mcp__vtp-kb__vtp_route_and_retrieve` via `callVtp(...)` with `{raw_query: operator_message, context: tier_slice}`.
5. **Timing.** `callVtp` already brackets the MCP invocation with `Date.now()` — no additional timing needed here. Budget is 3s P95 per D-07.
6. **Parse response.** Extract `{selected_query, retrieval_mode, reflection_verdict, top_3_doc_ids}` from `response.retrieval_plan` + `response.reflection` + `response.evidence.documents`. When `response.reflection` is null, record `reflection_verdict: null` verbatim.
7. **Write VTP-EVIDENCE.md.** Write framing-only artifact to `.planning/phases/{active_phase}/VTP-EVIDENCE.md` using the template below. Framing-only per D-04 — never embed full document content, only doc-ID references. Target ≤300 lines.
8. **Routing log.** `callVtp` already appends a row to `.planning/metrics/vtp-routing-log.jsonl` — no additional logging needed here.
9. **Hand to Step 1.** Pass `{selected_query, reflection_verdict, top_3_doc_ids}` into Step 1 brainstorming as a context prelude so the brainstorm receives routed framing instead of raw query.
10. **Graceful-fail discipline (critical).** If `callVtp` returns `{ok:false}` OR `elapsed_ms > 3000`:
    - The row is already logged with the failure reason (or with `elapsed_ms` exceeding budget as the marker).
    - Do NOT block — proceed to Step 1 with the operator's raw query verbatim.
    - Do NOT retry — one attempt, one fall-through. Retry logic belongs in a later phase.

**VTP-EVIDENCE.md template:**

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

**Trigger exclusion (D-06):** Step 0 relies on the existing `<trigger>` block's "Do NOT invoke when..." list (trivial questions, execution requests, mid-build fixes) to handle Path D style queries. No per-call flag — see D-06 rationale. System-wide disable via `workflow.triage_vtp_enrichment: false`.

```

**File 2: `.planning/config.json` — add workflow.triage_vtp_enrichment key**

Edit the `workflow` block (lines 1-20). Insert new key `"triage_vtp_enrichment": true` immediately after existing `"research": true` line (per PATTERNS.md placement suggestion — groups with other preflight-style toggles). Preserve exact JSON formatting (2-space indent, trailing comma handling).

**Before (line 6-7):**
```json
    "research": true,
    "plan_check": true,
```

**After (new line 7):**
```json
    "research": true,
    "triage_vtp_enrichment": true,
    "plan_check": true,
```

Ensure the JSON remains valid — verify with `node -e "JSON.parse(require('fs').readFileSync('.planning/config.json','utf8'))"`.

**Commit:** `feat(16-01): wire sgsd-triage Step 0 VTP enrichment + config toggle`
  </action>
  <verify>
    <automated>node -e "const c=JSON.parse(require('fs').readFileSync('C:/Users/jack.berrow/GSDedits/.planning/config.json','utf8'));if(c.workflow.triage_vtp_enrichment!==true){process.exit(1)};console.log('config_ok')" &amp;&amp; grep -q "mcp__vtp-kb__vtp_route_and_retrieve" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-triage/SKILL.md" &amp;&amp; grep -q "## Step 0: VTP Enrichment" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-triage/SKILL.md" &amp;&amp; grep -n "## Step 0\|## Step 1" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-triage/SKILL.md" | head -2</automated>
  </verify>
  <acceptance_criteria>
    - `jq -e '.workflow.triage_vtp_enrichment == true' .planning/config.json` returns 0.
    - `jq -e '.workflow' .planning/config.json` still validates (no JSON corruption).
    - `grep -q "mcp__vtp-kb__vtp_route_and_retrieve" super-gsd/skills/sgsd-triage/SKILL.md` passes.
    - `grep -q "mcp__vtp-kb__vtp_search_substrate" super-gsd/skills/sgsd-triage/SKILL.md` passes.
    - `grep -q "## Step 0: VTP Enrichment" super-gsd/skills/sgsd-triage/SKILL.md` passes.
    - Line number of `## Step 0:` comes BEFORE line number of `## Step 1:` (verified via `grep -n`).
    - Triage SKILL.md contains the phrase "Do NOT block — proceed to Step 1 with the operator's raw query verbatim" (graceful-fail discipline per RESEARCH.md).
    - Triage SKILL.md contains the phrase "never call `mcp__vtp-kb__*` directly" (composer-contract assertion).
    - Existing `## Step 1: Brainstorm` heading is UNTOUCHED — no content removed.
  </acceptance_criteria>
  <done>Step 0 injected, frontmatter extended with 2 VTP tools, config toggle present and JSON still valid.</done>
</task>

<task type="auto">
  <name>Task 3: Write manual smoke runbook for Wave A primitive</name>
  <files>C:\Users\jack.berrow\GSDedits\super-gsd\docs\vtp-enrichment-smoke.md</files>
  <read_first>
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-RESEARCH.md (§Validation Architecture — 8 dimensions + Wave 0 Gaps)
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md (§Graceful-Fail / Circuit-Breaker)
  </read_first>
  <action>
Create a smoke-test runbook at `super-gsd/docs/vtp-enrichment-smoke.md` that an operator can execute by hand to verify the Wave A primitive works end-to-end. This is the manual-verification layer RESEARCH.md §Validation Architecture called out as Wave 0 Gap #5.

**File contents:**

```markdown
# VTP Enrichment Smoke Runbook

**Phase:** 16 (VTP Enrichment as Cross-Phase Primitive)
**Scope:** Wave A primitive — vtp-context-composer.cjs + sgsd-triage Step 0 + config toggle.
**Runtime:** ~5 minutes.

## Preflight

- [ ] `.mcp.json` lists `vtp-kb` server pointing at `C:/Users/jack.berrow/Voice-Text-Plan/dist/cli.js`.
- [ ] `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` exits 0 (unit-level green).
- [ ] `.planning/config.json` has `workflow.triage_vtp_enrichment: true`.

## Dimension 2: Triage Step 0 happy path (VTP live, toggle true)

1. Ensure VTP MCP server is reachable: invoke any VTP tool from a Claude session (e.g., `mcp__vtp-kb__vtp_search_substrate query:"test"`) and confirm a response returns.
2. Invoke `/sgsd-triage` on a canned operator message: `"I want to figure out how to structure our retrieval layer"`.
3. Expected:
   - `.planning/phases/16-vtp-enrichment/VTP-EVIDENCE.md` exists (or updated) with `raw_query`, `selected_query`, `retrieval_mode`, `reflection_verdict`, and 3 doc-IDs.
   - `.planning/metrics/vtp-routing-log.jsonl` has a new tail row with `event:"vtp_call"`, `tier:"triage"`, `skill_or_agent:"sgsd-triage"`, all 10 keys populated, `elapsed_ms < 3000`.
   - Step 1 Brainstorm ran with the routed framing prelude.

## Dimension 3: Triage Step 0 VTP-failure path (graceful-fail)

1. Temporarily break the MCP binding: edit `.mcp.json` to point `vtp-kb.args` at a nonexistent path. OR set `FAST_PATH_TIMEOUT_MS` to 1 via env override (if the composer supports it).
2. Invoke `/sgsd-triage` on the same canned message.
3. Expected:
   - A routing-log row still appears, but with `reflection_verdict: null`, `evidence_hit_count: 0`, `top_doc_id: null`, and `elapsed_ms` = a failure marker (negative or the full timeout budget).
   - Step 1 Brainstorm still ran — the triage skill did NOT halt.
   - No `.planning/phases/*/VTP-EVIDENCE.md` was written for this invocation (or the prior one is stale — either is fine; graceful-fail is about NOT blocking).
4. Restore `.mcp.json` to the working path.

## Dimension 6: Config toggle disables Step 0

1. Edit `.planning/config.json`: set `workflow.triage_vtp_enrichment: false`.
2. Invoke `/sgsd-triage` on the canned message.
3. Expected:
   - NO new row in `.planning/metrics/vtp-routing-log.jsonl` (tail line count unchanged from before invocation).
   - NO new `.planning/phases/*/VTP-EVIDENCE.md` write.
   - Step 1 Brainstorm ran normally with raw operator message.
4. Restore toggle to `true`.

## Dimension 5: Fast-path short-circuit fires

1. With toggle on and VTP live, invoke `/sgsd-triage` under conditions where `isFastPathEligible(ctx)` is true (active phase present in STATE.md AND `explicit_constraints` non-empty — e.g., operator message cites a specific D-XX decision).
2. Expected:
   - Routing-log row has `retrieval_mode` indicating a substrate-direct call (distinct from `route_and_retrieve`'s default).
   - Elapsed_ms is typically faster than the full-routing path (<1500ms on a warm cache).

## Rollback

- Set `workflow.triage_vtp_enrichment: false` — disables Step 0 system-wide.
- Revert the SKILL.md Step 0 block — removes the injection point entirely.
- Delete `super-gsd/scripts/lib/vtp-context-composer.cjs` — removes the primitive (only safe AFTER Wave B + C agent patches are also rolled back, as they call into it).

## Related

- `.planning/metrics/vtp-routing-log.jsonl` — append-only telemetry.
- `.planning/phases/{N}/VTP-EVIDENCE.md` — per-phase framing artifact (framing-only, ≤300 lines, D-04).
- `super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` — unit-level green gate.
```

**Commit:** `docs(16-01): add VTP enrichment smoke runbook`
  </action>
  <verify>
    <automated>test -f "C:/Users/jack.berrow/GSDedits/super-gsd/docs/vtp-enrichment-smoke.md" &amp;&amp; grep -q "Dimension 2: Triage Step 0 happy path" "C:/Users/jack.berrow/GSDedits/super-gsd/docs/vtp-enrichment-smoke.md" &amp;&amp; grep -q "Dimension 3: Triage Step 0 VTP-failure path" "C:/Users/jack.berrow/GSDedits/super-gsd/docs/vtp-enrichment-smoke.md" &amp;&amp; grep -q "Dimension 6: Config toggle disables Step 0" "C:/Users/jack.berrow/GSDedits/super-gsd/docs/vtp-enrichment-smoke.md"</automated>
  </verify>
  <acceptance_criteria>
    - File `super-gsd/docs/vtp-enrichment-smoke.md` exists.
    - Contains sections for Dimensions 2, 3, 5, and 6 from RESEARCH.md §Validation Architecture.
    - Contains a Rollback section.
    - Contains a Preflight section referencing `--self-test`.
    - File is ≤200 lines (lightweight runbook, not a novel).
  </acceptance_criteria>
  <done>Smoke runbook exists, covers 4 of the 8 validation dimensions (triage-centric ones), rollback path documented.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| SGSD ↔ VTP MCP | Untrusted response body crosses into SGSD — the VTP process is vendor code, could return malformed JSON, long strings, or code-fence-breaking content. |
| Operator input ↔ composer | Raw operator query flows into composer → VTP → routing-log. Contains arbitrary user prose. |
| Composer ↔ config.json | Config read is a trust boundary for the toggle itself — malformed JSON could corrupt dispatch logic. |
| Composer ↔ .env / settings.json | CLAUDE.md absolute rule: NEVER read env-var values. Composer's `recent_commands` sanitizer is the enforcement point. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-01 | Tampering | VTP-EVIDENCE.md write (composer writes response fields into markdown) | mitigate | When writing `selected_query` + `raw_query` into the evidence file, escape backticks and code-fence sequences (````` → literal). Never `eval` response. Template enforces framing-only so full document text never lands in this file. |
| T-16-02 | Tampering (log-injection) | Routing-log JSONL append (raw_query → row) | mitigate | Use `JSON.stringify(row)` before append — already the existing `edge-guard.cjs:112` pattern. Newline-in-raw_query is safely escaped by JSON.stringify. NEVER use string concatenation. |
| T-16-03 | Info-disclosure | Composer reads SGSD state — could passthrough env-var values | mitigate | Composer's `compose()` filters `recent_commands` entries matching `/[A-Z_]+=/` or `/[A-Z][A-Z_]+_KEY/` before returning. Unit-test this in --self-test Test 9 (extend). |
| T-16-04 | Info-disclosure | Routing log captures `raw_query` (operator prose may include sensitive info) | accept | Same trust boundary as existing `activity-log.jsonl` which already logs operator inputs. No new surface created. Documented in VTP-EVIDENCE.md template as framing-only. |
| T-16-05 | DoS / Denial-of-Service | VTP MCP call hangs, blocking triage | mitigate | 3s P95 budget (D-07). Graceful-fail discipline in Step 0 step 10: timeout → proceed with raw query. Never retry within Step 0. Config toggle provides system-wide kill. |
| T-16-06 | Elevation-of-privilege | Config-key injection (malicious `.planning/config.json` edit) | accept | `.planning/config.json` is already operator-owned + git-tracked. Tampering requires filesystem access that bypasses repo controls. Same trust level as existing `workflow.*` keys. |
| T-16-07 | Spoofing | VTP response spoofs `reflection.verdict` to "sufficient" when evidence is weak | accept | Reflection is advisory framing, not an access-control decision. Operator + downstream agents re-query evidence. No privilege escalates from a false "sufficient". |
| T-16-08 | Repudiation | Routing-log row could be omitted to hide a bad VTP call | mitigate | `callVtp` writes the row in BOTH success AND failure paths — failure path still logs with `failureReason`. Append-only JSONL is not mutable by the composer. |
</threat_model>

<verification>
End-of-wave gate:

```bash
# Unit-level green
node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test   # → PASS, exit 0

# Config-key landed
jq -e '.workflow.triage_vtp_enrichment == true' .planning/config.json

# Triage Step 0 injection landed
grep -q "## Step 0: VTP Enrichment" super-gsd/skills/sgsd-triage/SKILL.md
grep -q "mcp__vtp-kb__vtp_route_and_retrieve" super-gsd/skills/sgsd-triage/SKILL.md

# Smoke runbook exists
test -f super-gsd/docs/vtp-enrichment-smoke.md

# House-shape invariants (composer file)
grep -q "'use strict';" super-gsd/scripts/lib/vtp-context-composer.cjs
grep -q "Object.freeze" super-gsd/scripts/lib/vtp-context-composer.cjs
grep -q "fs.appendFileSync" super-gsd/scripts/lib/vtp-context-composer.cjs
```

Manual smoke (operator runs once before Wave B starts):
Follow `super-gsd/docs/vtp-enrichment-smoke.md` — verify Dimensions 2, 3, 5, 6 pass.
</verification>

<success_criteria>
Wave A is complete when:
1. `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` exits 0.
2. `jq -e '.workflow.triage_vtp_enrichment == true' .planning/config.json` returns 0.
3. `sgsd-triage/SKILL.md` has `## Step 0: VTP Enrichment` placed BEFORE `## Step 1: Brainstorm` (grep line-number ordering).
4. `sgsd-triage/SKILL.md` frontmatter `allowed-tools:` includes `mcp__vtp-kb__vtp_route_and_retrieve` AND `mcp__vtp-kb__vtp_search_substrate`.
5. `super-gsd/docs/vtp-enrichment-smoke.md` exists with Dimension 2/3/5/6 sections.
6. Composer uses `Date.now()` bracket (E-03) — grep confirms ≥2 occurrences in callVtp function.
7. Composer has zero external runtime deps (`grep -c "require(" composer.cjs` = 3, limited to fs/path/os).
8. All 3 atomic commits landed: one per task, using `feat(16-01): ...` / `docs(16-01): ...` prefix.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.3/phases/16-vtp-enrichment/16-01-SUMMARY.md` capturing:
- files_changed list
- verification commands and their outputs
- any deviations from plan
- one-liner summary for the orchestrator
</output>
