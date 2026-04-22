# Phase 10: Gate Policy — Research

**Researched:** 2026-04-22
**Domain:** Policy codification (YAML registry + structured-predicate runtime + edge-guard instrumentation) inside the existing sgsd-orchestrate skill
**Confidence:** HIGH on all 10 research questions (everything resolved from in-repo code; zero external-library decisions required)

## RESEARCH COMPLETE

**Primary recommendation:** Ship three zero-dependency Node CJS modules
(`super-gsd/scripts/lib/predicate-eval.cjs`, `super-gsd/scripts/lib/gates-registry.cjs`, `super-gsd/scripts/lib/edge-guard.cjs`) wired into SKILL.md via a new Step 0.5 (registry load) and a generalised transition hook between every existing loop step. No new npm deps; reuse `super-gsd/tools/plan-schema/node_modules/js-yaml` the same way `09-verify.mjs` and `validate.cjs` already do. Replace hard-coded gate thresholds in SKILL.md with one-line `gates.shouldFire('gate-name', ctx)` calls while keeping the surrounding narrative for documentation (hybrid approach — matches the existing SKILL.md style of having prose + code-fences side by side, per §Step 6.2 and §Step 6.6 patterns).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**D-01 through D-09 (per-gate enforcement defaults):**
- **D-01** Step 2 (classifier): `soft-warn`, no trigger. 800 tok/phase.
- **D-02** Step 4 (context-selector): `soft-warn`, no trigger. 1,600 tok/phase.
- **D-03** Step 5 (sgsd-recall): `soft-warn`, trigger `classifier.complexity != trivial`. 9,600 tok/phase when enabled.
- **D-04** Step 5.5 (INTENT injection): `soft-warn`, no trigger. Bootstrap-safe (log INTENT_MISSING, continue). 480 tok/phase.
- **D-05** Step 9.5 (per-dispatch ATC): `hard-halt`, trigger `atc_tier in [full,gate] AND code_files_changed_count > 0`. 4,800 tok/phase.
- **D-06** Step 6.5 (phase-level ATC): `amortized`, runs once after gsd-verifier passes. 600 tok/phase.
- **D-07** Step 6.55 (MUDA audit): `soft-warn`, compound trigger with explicit `any:` OR clause. 100 tok/phase.
- **D-08** Step 10 (sgsd-curate): `soft-warn`, trigger `any: [new_pattern_detected, script_created, error_discovered]`. 800 tok/phase.
- **D-09** Step 11 (token-log): `soft-warn`, no trigger. ~160 tok/phase.

**D-10 — Predicate encoding:** Structured object lists; supported ops `eq, neq, in, not_in, gt, gte, lt, lte, contains, any`. Top-level implicit AND. No string eval.
**D-10a — Clause shape:** `{field: <dotted.path>, op: <operator>, value: <primitive|list>}`.
**D-10b — Explicit `any:` block for OR.**
**D-10c — Dispatch context fields:** 10 enumerated fields. Unknown field = predicate fails **loud** (not silently false).

**D-11 — Edge-guard:** Default `log-only` to `.planning/metrics/edge-guard-log.jsonl` with `{from_step, to_step, expected_emits, actual_emits, missing_emits, context, resolution}`. Continues.
**D-11a — Per-gate opt-in to `halt` via `escalation: halt` field.**
**D-11b — No rollback option.** Halt + manual recovery only.
**D-11c — Step 11 (token-log) exempt from edge-guard emit-check** (it IS the logging).

**D-12 — WR-01 and WR-02 become two new verify-completeness gates** (`verifier-row-arithmetic`, `verifier-detail-vs-summary`).
**D-12a — Both get `soft-warn` + trigger `phase_has_verify_mjs == true`.**
**D-12b — Retro-fix 09-verify.mjs in Phase 10** to add both invariants.

**D-13 — Delete `config.byterover` block entirely.** No rename to `memory:`.
**D-13a — Keep other unknown blocks** (safety, model_routing, token_efficiency, deliberation, atc, browser_verify, overwatcher) — they're runtime knobs referenced by gates.yaml triggers.
**D-13b — Add remaining keys to gsd-tools' KNOWN_TOP_LEVEL so the warning stops.**

**D-14 — `/sgsd-memory-migrate` runs once before planning.** `.brv/context-tree/` → `.planning/memory/`.
**D-14a — Phase 10 references `.planning/memory/` from day one.**
**D-14b — `sgsd-recall.sh`/`sgsd-curate.sh` already auto-detect** (verified below).

**D-15 — Accept scaffold schema as-is.** No edits to `_example_entries` field layout.
**D-15a — Order by category then step number.**
**D-15b — `state: active` on all Phase 10 rows.**

**D-16 — 3 plans: 10-01 (predicate+populate), 10-02 (edge-guard), 10-03 (integration+cleanup).**
**D-16a — v2 schema_version frontmatter.**
**D-16b — Wave 1: 10-01 + 10-02 (different files). Wave 2: 10-03 (integrator).**

**D-17 — Out of scope:** 4-mode vocabulary rethinking, merging config.json into gates.yaml, retrofitting phases 1-11, web dashboard.

### Claude's Discretion
- Module placement (e.g., `super-gsd/scripts/lib/` vs `super-gsd/tools/gates/`) — recommendation below.
- Function signatures of predicate evaluator — recommendation below.
- Exact JSONL schema for `edge-guard-log.jsonl` — recommendation below.
- Phase 10's own `verify.mjs` invariant list — recommendation below.
- Whether SKILL.md narrative gets rewritten or augmented — recommendation below (hybrid).
- How halt-escalation integrates with the existing checkpoint routine — recommendation below.

### Deferred Ideas (OUT OF SCOPE)
- Runtime gate-policy override via CLI flag (`--disable-gate X`).
- Per-project gate policy extension (`.planning/gates.override.yaml`).
- Gate ablation tooling (A/B run with gate X off vs on).
- gates.yaml auto-gen from SKILL.md scanning.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **GATE-01** | Per-gate decision matrix declares every CLAUDE-OVERLAY gate as HARD-HALT / SOFT-WARN / CONDITIONAL with empirical trigger explicit per row | Q1 (predicate evaluator) + Q2 (dispatch context) enable typed triggers; D-01..D-09 mapped to `enforcement_mode` + `trigger` in populated gates.yaml (Plan 10-01) |
| **GATE-02** | ATC gate firing policy (per-dispatch Step 9.5 and phase-level Step 6.5) lands in `super-gsd/registry/gates.yaml` with enforcement mode, not prose | Plan 10-01 populates rows `per-dispatch-ATC` (hard-halt) and `phase-level-ATC` (amortized) per D-05/D-06; Q3 integration replaces SKILL.md Step 9.5 hard-coded `if tier in [full,gate]` check with `gates.shouldFire('per-dispatch-ATC', ctx)` |
| **GATE-03** | Non-ATC gates (classifier / context-selector / sgsd-recall / INTENT / MUDA / sgsd-curate / token-log) each get explicit keep/kill/conditional verdict backed by matrix | All 7 gates populated in Plan 10-01 with D-01..D-04, D-07..D-09 defaults. Q9 memory-recall confirms no prior predicate-eval pattern exists — genuinely new surface |
| **GATE-04** | Edge-guard enforcement layer writes `.planning/metrics/edge-guard-log.jsonl` per step transition with `{from_step, to_step, missing_emits, context, resolution}`; skipped gates that should have fired trigger rollback or halt per matrix | Q4 (edge-guard architecture) + Q5 (halt integration). Rollback explicitly ruled out by D-11b — halt-or-log only. Plan 10-02 implements transition-wrapper pattern. |
</phase_requirements>

---

## Summary

Phase 10 is a **pure integration phase** — every policy question is locked. The job is to stand up three new code artefacts (predicate-eval module, gates-registry loader, edge-guard wrapper) and wire them into one existing file (sgsd-orchestrate SKILL.md) without breaking the loop narrative. No external dependencies needed: the existing `super-gsd/tools/plan-schema/node_modules/js-yaml` install is reused the same way `09-verify.mjs` reuses it (verified in `.planning/phases/09-atc-147-evidence/verify.mjs:12-13`).

The hardest implementation risk is **SKILL.md integration surface area** — there are 9 places in the skill file where a hard-coded threshold currently lives (Steps 2, 4, 5, 5.5, 6.5, 6.55, 9.5, 10, 11) and Plan 10-03 must replace each with a gates-registry lookup without churning the surrounding prose. A hybrid approach (keep prose, add one-line lookup inside the existing code-fence block) is recommended because it matches the existing SKILL.md pattern (Step 6.2 and Step 6.6 already mix narrative with executable bash / node snippets).

The second biggest risk is the **edge-guard emit contract**: each loop step's `evidence_emitted` must be declared somewhere before emit-comparison is possible. Recommend declaring it on the gates.yaml row itself (the scaffold already has `evidence_emitted:` as a field — D-15 says accept the scaffold as-is). This keeps the contract colocated with the gate definition and avoids a parallel registry.

**Confidence is HIGH across all questions** because every needed input is in-repo: the 09-verify.mjs pattern, the validate.cjs pattern, the gates.yaml scaffold, the existing SKILL.md 9-step structure, the Phase 9 plan decomposition (3 plans, 2 waves). Zero external-source verification needed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Predicate clause evaluation | `super-gsd/scripts/lib/` (Node CJS module) | — | Pure function, zero I/O, unit-testable. Lives in `scripts/lib/` alongside future shared JS helpers (already exists as a convention — see `super-gsd/scripts/lib/` pattern, though currently only has PS1 helpers). |
| gates.yaml load + lookup | `super-gsd/scripts/lib/gates-registry.cjs` | — | Cacheable singleton; loaded once per orchestrator session. Depends on predicate-eval + js-yaml. |
| Edge-guard transition wrapper | `super-gsd/scripts/lib/edge-guard.cjs` | sgsd-orchestrate SKILL.md | Wrapper function invoked between steps. SKILL.md is the integration callsite. |
| gates.yaml row data | `super-gsd/registry/gates.yaml` | — | Canonical policy registry. Already scaffolded. |
| Phase 10 verify.mjs | `.planning/phases/10-gate-policy/verify.mjs` | — | Same pattern as `09-verify.mjs`. |
| 09-verify.mjs retro-fix | `.planning/phases/09-atc-147-evidence/verify.mjs` | — | In-place modification (D-12b); two new invariants numbered 8 and 9. |
| config.json cleanup | `.planning/config.json` | `~/.claude/get-shit-done/bin/lib/core.cjs` | Delete byterover block + patch `KNOWN_TOP_LEVEL` set in core.cjs (lines 322-331, verified below). |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`, `crypto`, `module.createRequire`) | ≥18.x | File I/O, hashing, dynamic require | [VERIFIED: in-repo] `validate.cjs:37-39` and `09-verify.mjs:6-8` both use this pattern — zero extra deps |
| js-yaml | 4.1.1 (already installed) | YAML parse (gates.yaml, verify fixtures) | [VERIFIED: in-repo] Already pinned in `super-gsd/tools/plan-schema/node_modules/js-yaml`; both validate.cjs and 09-verify.mjs reuse it via `createRequire` (paths `validate.cjs:166`, `09-verify.mjs:12`) |

### Supporting

None. This phase ships zero new npm deps.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled predicate eval | `jsonlogic` npm lib | **REJECTED** — adds a dep, overkill for 10 operators, DLB-01 philosophy favours dep-free. Hand-roll is ~40 LOC. |
| Hand-rolled predicate eval | `jexl` / `filtrex` | **REJECTED** — both do string-based expression parsing; D-10 explicitly forbids string eval. |
| Separate `evidence-emits.yaml` registry | Field on gates.yaml rows | **REJECTED** — scaffold (D-15) already has `evidence_emitted:` field; colocating with gate is simpler. |
| Rewriting SKILL.md step narratives | Hybrid (prose + lookup call) | **ACCEPTED** — hybrid matches existing SKILL.md style (Step 6.2 / 6.6 mix narrative + code). Rewriting would churn the entire file and risk losing documentation context. |

**Installation:** None. Reuse `super-gsd/tools/plan-schema/node_modules/` via `createRequire`.

**Version verification:** `js-yaml@4.1.1` confirmed in `super-gsd/tools/plan-schema/package-lock.json:161` [VERIFIED: grep hit].

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────┐
                          │  super-gsd/registry/         │
                          │     gates.yaml (populated)   │
                          └──────────────┬───────────────┘
                                         │  yaml.load
                                         ▼
┌───────────────────────┐       ┌────────────────────────────┐
│ sgsd-orchestrate loop │──────▶│  gates-registry.cjs        │
│   (SKILL.md, Opus)    │       │  (singleton, cached in-mem)│
│                       │       └────────┬───────────────────┘
│  ┌─────────────────┐  │                │  .shouldFire(name, ctx)
│  │ Step N          │  │                ▼
│  │  - build ctx    │──┼──────▶┌────────────────────────────┐
│  │  - shouldFire?  │  │       │  predicate-eval.cjs        │
│  │  - emit action  │  │       │  (pure func, 10 ops)       │
│  └────────┬────────┘  │       └────────────────────────────┘
│           │           │
│  ┌────────▼────────┐  │       ┌────────────────────────────┐
│  │ transition N→M  │──┼──────▶│  edge-guard.cjs            │
│  │ (wrap caller)   │  │       │  - compare expected/actual │
│  │                 │  │       │  - append jsonl row        │
│  │                 │  │       │  - halt? → checkpoint      │
│  └─────────────────┘  │       └────────┬───────────────────┘
└───────────────────────┘                │
                                         ▼
                     ┌──────────────────────────────────────────┐
                     │ .planning/metrics/edge-guard-log.jsonl   │
                     │ .planning/ORCHESTRATOR-CHECKPOINT.md     │
                     │     (on escalation: halt)                │
                     └──────────────────────────────────────────┘
```

### Component Responsibilities

| File | Role |
|------|------|
| `super-gsd/registry/gates.yaml` | Canonical policy data. 11 rows (9 per-step + 2 verify-completeness). |
| `super-gsd/scripts/lib/predicate-eval.cjs` | `evalPredicate(clauseList, ctx) → bool`. Zero I/O. ~80 LOC. |
| `super-gsd/scripts/lib/gates-registry.cjs` | `loadGates(yamlPath)` + `shouldFire(name, ctx)` + `getGate(name)`. Caches parsed yaml. ~60 LOC. |
| `super-gsd/scripts/lib/edge-guard.cjs` | `recordTransition(fromStep, toStep, expectedEmits, actualEmits, ctx, gateConfig)`. Writes jsonl; escalates if `gateConfig.escalation === 'halt'`. ~80 LOC. |
| `sgsd-orchestrate/SKILL.md` | Caller. Two injection points: (a) cold-start loads registry once, (b) per-step `shouldFire` lookup + transition-guard call. |
| `.planning/phases/10-gate-policy/verify.mjs` | Mechanical invariants for Phase 10's own artefacts (8 invariants recommended; see Q7). |
| `.planning/phases/09-atc-147-evidence/verify.mjs` | Retro-fix: add invariants 8 (WR-01) and 9 (WR-02) per D-12b. |

### Pattern 1: CJS Module Via createRequire (reused from 09-verify.mjs and validate.cjs)

**What:** Use `module.createRequire(import.meta.url)` (ESM) or direct `require()` (CJS) with `path.resolve(__dirname, '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml')` to load pinned deps without a fresh npm install.

**When to use:** Whenever a new Node script needs yaml parsing.

**Example (CJS variant, matches validate.cjs:133-151):**
```javascript
// Source: super-gsd/tools/plan-schema/validate.cjs lines 132-151
const path = require('path');
const yamlPath = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml');
let yaml;
try { yaml = require(yamlPath); }
catch (e) { fail(`Failed to load js-yaml: ${e.message}`, 2); }
const gates = yaml.load(fs.readFileSync(gatesYamlPath, 'utf8'));
```

**Example (ESM variant, matches 09-verify.mjs:6-13):**
```javascript
// Source: .planning/phases/09-atc-147-evidence/verify.mjs lines 6-13
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const yamlPath = path.resolve(repoRoot, 'super-gsd/tools/plan-schema/node_modules/js-yaml');
const yaml = require(yamlPath);
```

### Pattern 2: Structured-Predicate Evaluator (recommended shape)

**What:** Pure function, dependency-free, recursive only via `any:` operator (which contains a nested `triggerList`).

**When to use:** Every `gates.yaml` row trigger clause.

**Example (recommended signature):**
```javascript
// super-gsd/scripts/lib/predicate-eval.cjs (NEW — recommended implementation)

'use strict';

/**
 * Evaluate a list of trigger clauses against a dispatch context.
 *
 * @param {Array<Clause>} triggerList - list of clauses (implicit AND)
 * @param {Object} ctx - dispatch context (see DISPATCH_CONTEXT_FIELDS below)
 * @returns {boolean} true iff ALL clauses pass
 *
 * Clause shape: {field, op, value}
 *   Supported ops: eq, neq, in, not_in, gt, gte, lt, lte, contains
 *   Special form: {any: [Clause, ...]} - OR over nested clause list
 *
 * D-10c: unknown field = throw (fail loud, not silently false).
 *
 * DISPATCH_CONTEXT_FIELDS (registry of allowed field paths):
 *   classifier.complexity       - 'trivial' | 'light' | 'standard' | 'heavy'
 *   classifier.atc_tier         - 'skip' | 'lite' | 'full' | 'gate'
 *   classifier.type             - 'feature' | 'bugfix' | 'refactor' | ...
 *   files_changed_count         - number
 *   code_files_changed_count    - number
 *   diff_lines                  - number
 *   phase_type                  - 'docs' | 'config' | 'refactor' | ...
 *   new_pattern_detected        - boolean
 *   script_created              - boolean
 *   error_discovered            - boolean
 *   phase_has_verify_mjs        - boolean (D-12a)
 */
function evalPredicate(triggerList, ctx) {
  if (!Array.isArray(triggerList) || triggerList.length === 0) return true;
  return triggerList.every(clause => evalClause(clause, ctx));
}

function evalClause(clause, ctx) {
  // OR clause
  if (clause.any) {
    if (!Array.isArray(clause.any)) throw new Error(`'any' must be an array`);
    return clause.any.some(sub => evalClause(sub, ctx));
  }
  // AND clause (leaf)
  const { field, op, value } = clause;
  if (!field || !op) throw new Error(`clause missing field/op: ${JSON.stringify(clause)}`);
  const actual = getDottedField(ctx, field);  // throws on unknown field
  return applyOp(actual, op, value);
}

function getDottedField(ctx, path) {
  const parts = path.split('.');
  let cur = ctx;
  for (const p of parts) {
    if (cur == null || !(p in cur)) {
      throw new Error(`dispatch context missing field '${path}' (unknown at '${p}')`);
    }
    cur = cur[p];
  }
  return cur;
}

function applyOp(actual, op, value) {
  switch (op) {
    case 'eq':       return actual === value;
    case 'neq':      return actual !== value;
    case 'in':       return Array.isArray(value) && value.includes(actual);
    case 'not_in':   return Array.isArray(value) && !value.includes(actual);
    case 'gt':       return actual > value;
    case 'gte':      return actual >= value;
    case 'lt':       return actual < value;
    case 'lte':      return actual <= value;
    case 'contains': return Array.isArray(actual) && actual.includes(value);
    default:         throw new Error(`unknown operator '${op}'`);
  }
}

module.exports = { evalPredicate };
```

Approximate LOC: 60 (plus ~20 for JSDoc). Zero deps. Trivially testable.

### Pattern 3: Registry Singleton (recommended shape)

```javascript
// super-gsd/scripts/lib/gates-registry.cjs (NEW)

const fs   = require('fs');
const path = require('path');
const { evalPredicate } = require('./predicate-eval.cjs');

let _cache = null;

function loadGates(gatesYamlPath) {
  if (_cache) return _cache;
  const yamlLibPath = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml');
  const yaml = require(yamlLibPath);
  const parsed = yaml.load(fs.readFileSync(gatesYamlPath, 'utf8'));
  const byName = {};
  for (const g of (parsed.gates || [])) byName[g.name] = g;
  _cache = { all: parsed.gates || [], byName };
  return _cache;
}

function getGate(name, gatesYamlPath) {
  const reg = loadGates(gatesYamlPath);
  const g = reg.byName[name];
  if (!g) throw new Error(`gate '${name}' not in registry`);
  return g;
}

function shouldFire(name, ctx, gatesYamlPath) {
  const g = getGate(name, gatesYamlPath);
  if (g.enforcement_mode === 'disabled') return false;
  return evalPredicate(g.trigger || [], ctx);
}

function resetCache() { _cache = null; }  // test-only helper

module.exports = { loadGates, getGate, shouldFire, resetCache };
```

### Pattern 4: Edge-Guard Transition Wrapper (recommended shape)

```javascript
// super-gsd/scripts/lib/edge-guard.cjs (NEW)

const fs = require('fs');
const path = require('path');
const { getGate } = require('./gates-registry.cjs');

const LOG_PATH = '.planning/metrics/edge-guard-log.jsonl';

/**
 * Record a step transition and detect missing emits.
 * Returns { status: 'ok' | 'logged' | 'halt', missing_emits: [...] }.
 *
 * @param {Object} transition - {fromStep, toStep, phase, plan, gateName}
 * @param {Array<string>} expectedEmits - from gate.evidence_emitted (D-11c)
 * @param {Array<string>} actualEmits   - observed file writes / tool calls
 * @param {Object} ctx - dispatch context
 * @param {string} gatesYamlPath
 * @param {string} projectDir
 */
function recordTransition({fromStep, toStep, phase, plan, gateName, expectedEmits, actualEmits, ctx, gatesYamlPath, projectDir}) {
  const missing = expectedEmits.filter(e => !actualEmits.includes(e));
  const gate = gateName ? getGate(gateName, gatesYamlPath) : null;
  const escalation = (gate && gate.escalation === 'halt') ? 'halt' : 'log-only';

  const row = {
    ts: new Date().toISOString(),
    phase, plan,
    from_step: fromStep,
    to_step: toStep,
    gate: gateName || null,
    expected_emits: expectedEmits,
    actual_emits: actualEmits,
    missing_emits: missing,
    context: ctx,
    resolution: missing.length === 0 ? 'pass' : escalation,
  };

  const logPath = path.resolve(projectDir, LOG_PATH);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(row) + '\n');

  if (missing.length === 0) return { status: 'ok', missing_emits: [] };
  if (escalation === 'halt') return { status: 'halt', missing_emits: missing, row };
  return { status: 'logged', missing_emits: missing, row };
}

module.exports = { recordTransition };
```

### Anti-Patterns to Avoid

- **String-based eval:** `eval(trigger_expr)` or `new Function(trigger_expr)`. **D-10 explicitly forbids.** Use structured clauses only.
- **Silent unknown-field fallback:** Returning `false` when a context field is missing. **D-10c explicitly forbids.** Throw loud.
- **Rewriting SKILL.md step narratives:** Tempting but high-risk — loses documentation context, churns unrelated prose. Use hybrid (add one-line `shouldFire` lookup inside existing code-fences).
- **New npm dep for predicate eval:** `jsonlogic`, `jexl`, `filtrex` all exist but add deps and support features we don't need. 60-LOC hand-roll is correct here.
- **Separate `evidence-emits.yaml` registry:** Duplicates gates.yaml. Put emits on the gate row (scaffold already has the field per D-15).
- **Re-entry halt loops:** If a halt-escalating gate fires mid-checkpoint-write, guard with an `SGSD_IN_CHECKPOINT` env var or orchestrator-state flag (see Q5).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom parser | `super-gsd/tools/plan-schema/node_modules/js-yaml` via `createRequire` | Already pinned + used by 2 other tools |
| JSONL logging | Custom rotator | Append-only `fs.appendFileSync` with `{ts, ...}` row | Matches every other `.planning/metrics/*.jsonl` convention; rotation not needed |
| Config-key validation | Re-invent known-key set | Patch `KNOWN_TOP_LEVEL` in `~/.claude/get-shit-done/bin/lib/core.cjs:322-331` | Already the canonical validator; adding to the Set = 1 line per key |

---

## Q1: Predicate Evaluator Shape

**Recommendation:** Pure function (not class), two-file module (`predicate-eval.cjs`), zero dependencies. See Pattern 2 code block above.

**Rationale:**
- Signature `evalPredicate(triggerList, ctx) → bool` matches D-10 exactly (top-level implicit AND, explicit `any:` for OR).
- `any:` is handled via recursion into `evalClause` — single recursive step, not a general-purpose tree walker.
- No state → no class needed; pure function is easiest to unit-test.
- 10 operators listed in D-10a map to a single `switch` statement in `applyOp` — ~15 LOC.
- Unknown-field policy (D-10c) implemented as `throw` in `getDottedField`. Caller decides whether to catch or propagate.
- [VERIFIED: in-repo grep] No existing JS predicate evaluator in super-gsd. `jsonlogic` / `jexl` / `filtrex` all absent (grep returned 0 matches). Building it is correct.

**LOC estimate:** ~60 LOC + ~20 LOC JSDoc (~80 total). Fits the "small typed predicate evaluator" description in D-10.

---

## Q2: Dispatch Context Schema

**Recommended field set** (supersets the 10 in D-10c with 1 additional field required by D-12a):

| Field | Type | Source | Used By |
|-------|------|--------|---------|
| `classifier.complexity` | `'trivial'\|'light'\|'standard'\|'heavy'` | Step 2 Haiku classifier output OR v2-plan synthetic (per SKILL.md:156-169) | D-03 (Step 5 sgsd-recall trigger) |
| `classifier.atc_tier` | `'skip'\|'lite'\|'full'\|'gate'` | Same as above | D-05 (Step 9.5 per-dispatch ATC trigger) |
| `classifier.type` | string | Same as above | future gates |
| `files_changed_count` | number | Derived from executor report `FILES_CHANGED` section (SKILL.md:668) | D-07 (MUDA trigger) |
| `code_files_changed_count` | number | `files_changed_count` minus `.md` / `.planning/` files | D-05 (Step 9.5 trigger) |
| `diff_lines` | number | `git diff --stat` HEAD~1..HEAD parsing | D-07 (MUDA trigger) |
| `phase_type` | string | Read once from ROADMAP.md or phase metadata | D-07 (MUDA trigger — `not_in [docs, config, refactor]`) |
| `new_pattern_detected` | boolean | Executor report `DEVIATIONS` section contains `"new pattern:"` prefix (SKILL.md:680) | D-08 (Step 10 sgsd-curate trigger) |
| `script_created` | boolean | Executor report `SCRIPTS_CREATED` section non-empty | D-08 |
| `error_discovered` | boolean | Executor report contains "error rule" or "new error" | D-08 |
| **`phase_has_verify_mjs`** | boolean | `fs.existsSync('.planning/phases/{NN}-*/verify.mjs')` | **D-12a (new verify-completeness gates trigger)** |

**Population site:** The ctx object is built inside the orchestrator's loop body **after Step 9 (process result)** and **before any gate lookup**. It is ephemeral per-iteration — no persistence.

**Injection point in SKILL.md:** Add a new mini-section between Steps 9 and 9.5 labeled "9.2. BUILD DISPATCH CONTEXT" that assembles the ctx object from classifier result + report parse results + cached phase metadata. This is a <20-line block; doesn't disrupt existing narrative.

**Unknown-field policy (D-10c):** `getDottedField` throws. Orchestrator wraps each `shouldFire` call in try/catch and logs the exception as a `gate_eval_error` JSONL row, then fails closed (treats as "gate did not fire, DO NOT proceed" — this is different from `false` because it surfaces the bug rather than hiding it).

---

## Q3: gates.yaml Lookup Integration Into SKILL.md

**Recommendation: Hybrid approach** — keep prose and code-fences, add one-line `shouldFire` lookup inside existing code blocks. Matches SKILL.md Step 6.2 (Plan Load-Time Validation) and Step 6.6 (Frontend Verify Gate) which both mix narrative + inline Node/bash.

**Pattern per step:**

Existing (e.g., SKILL.md Step 9.5 lines 686-692):
```
Fires only when ALL of these are true:
  * classifier.atc_tier (from Step 2) is in {full, gate}
  * FILES_CHANGED is non-empty
  * At least one file in FILES_CHANGED is CODE (not *.md, not .planning/...)
  * config.atc.enabled == true
```

Replaced with (minimal churn):
```
Fires when gates.shouldFire('per-dispatch-ATC', ctx) returns true, where
ctx is the dispatch context assembled at Step 9.2. The gate's trigger
declares the equivalent policy (classifier.atc_tier in [full, gate] AND
code_files_changed_count > 0) — see super-gsd/registry/gates.yaml.

  if (gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH)) {
    // existing ATC dispatch block unchanged
  }
```

The narrative survives; the only deleted lines are the 4 `*` bullets that duplicate what gates.yaml now declares. The `config.atc.enabled` check is **preserved** (it's a kill-switch outside the policy layer — D-13a keeps the `atc:` block as a runtime knob).

**Integration call sites** (9 steps, one per row):

| Step | Line refs in current SKILL.md | Gate name |
|------|------------------------------|-----------|
| 2 (classifier) | 148-185 | `classifier-haiku` |
| 4 (context-selector) | 200-210 | `context-selector-haiku` |
| 5 (sgsd-recall) | 212-216 | `sgsd-recall-queries` |
| 5.5 (INTENT) | 217-248 | `intent-injection` |
| 6.5 (phase ATC) | 361-426 | `phase-level-ATC` |
| 6.55 (MUDA) | 427-468 | `MUDA-waste-audit` |
| 9.5 (per-dispatch ATC) | 686-733 | `per-dispatch-ATC` |
| 10 (sgsd-curate) | 735-738 | `sgsd-curate-learnings` |
| 11 (token-log) | 740-743 | `token-log` (disabled from edge-guard per D-11c) |

**Registry load site:** Add a new cold-start step "3.6 LOAD GATES REGISTRY" immediately after the existing Step 3.5 (schema drift check). Single line:
```
const gates = require('super-gsd/scripts/lib/gates-registry.cjs');
const GATES_YAML_PATH = 'super-gsd/registry/gates.yaml';
gates.loadGates(GATES_YAML_PATH); // caches; subsequent calls are O(1)
```

---

## Q4: Edge-Guard Layer Architecture

**Recommendation: Post-step audit via transition wrapper**, not pre-step or instrumented tool calls.

**Why post-step:** The "expected emits" are declared on the gate row; the "actual emits" are the files written / tool calls made during the step. Comparison can only happen after the step completes. Pre-step audit would not have `actual` yet.

**How it works per step:**

```
BEFORE step N runs:
  - Read gate.evidence_emitted for gate(s) owned by this step
  - Snapshot file-mtimes for the expected paths (optional — skip if paths don't exist yet)

step N runs normally (existing orchestrator behaviour)

AFTER step N runs, BEFORE transition to step N+1:
  - Snapshot file-mtimes again
  - actual_emits = paths whose mtime changed during the step
  - Call edgeGuard.recordTransition({
      fromStep: N, toStep: N+1, phase, plan,
      gateName: owning_gate_name,
      expectedEmits: gate.evidence_emitted,
      actualEmits: actual_emits,
      ctx, gatesYamlPath, projectDir
    })
  - If returns status === 'halt': write checkpoint, exit
  - If returns status === 'logged': continue
```

**edge-guard-log.jsonl row format (recommended):**

```json
{
  "ts": "2026-04-22T16:10:00.000Z",
  "phase": 10,
  "plan": "10-02",
  "from_step": 6.5,
  "to_step": 6.55,
  "gate": "phase-level-ATC",
  "expected_emits": [".planning/phases/10-gate-policy/10-ATC-REVIEW.md"],
  "actual_emits":   [".planning/phases/10-gate-policy/10-ATC-REVIEW.md"],
  "missing_emits":  [],
  "context": {
    "classifier.atc_tier": "full",
    "files_changed_count": 7,
    "diff_lines": 142,
    "phase_type": "implementation"
  },
  "resolution": "pass"
}
```

**Failing row (missing emit):**
```json
{
  "ts": "...",
  "from_step": 9.5,
  "to_step": 10,
  "gate": "per-dispatch-ATC",
  "expected_emits": [".planning/phases/10/commit-reviews.jsonl"],
  "actual_emits": [],
  "missing_emits": [".planning/phases/10/commit-reviews.jsonl"],
  "context": {...},
  "resolution": "halt"         // because per-dispatch-ATC has escalation: halt
}
```

**Resolution field values:**
- `"pass"` — all expected emits observed
- `"log-only"` — some missing but gate escalation defaults to log (just record)
- `"halt"` — some missing AND gate had `escalation: halt` (orchestrator halts)
- `"gate_eval_error"` — predicate threw (unknown field etc.)

**Resolution source (answers the question):** Per-gate override in the gates.yaml row (`escalation: halt` field). Absent = `log-only` default (D-11 behaviour). This is why the edge-guard row stores both the gate name AND the resolution — downstream consumers (dashboards) can drill into which gate caused which halt.

**Step 11 (token-log) exemption per D-11c:** edge-guard wrapper is a no-op when `fromStep === 11` (the step that writes the log row is `token-log` itself — recursing would be a bug). Implement as an early-return guard in `recordTransition`.

**Declaring expected_emits:** Put the expected-emit path list on each gates.yaml row in the `evidence_emitted:` field (scaffold already has this — D-15). For steps that don't write files (e.g., Step 2 Haiku classifier outputs in-memory JSON), set `evidence_emitted: []` explicitly. Empty list = no emit check, edge-guard logs a pass row unconditionally.

---

## Q5: Halt Escalation Integration With Checkpoint Protocol

**Recommendation: Dedicated `escalateToCheckpoint` helper in edge-guard.cjs that composes the existing checkpoint routine.**

**Flow:**

1. Edge-guard detects `missing_emits.length > 0 AND gate.escalation === 'halt'`.
2. Edge-guard writes the failing row to `edge-guard-log.jsonl` first (durability — if the checkpoint write fails, we still have evidence).
3. Edge-guard returns `{status: 'halt', ...}` to the orchestrator.
4. Orchestrator invokes the **existing** checkpoint routine (SKILL.md:757-787) via a helper call — does **not** duplicate checkpoint logic in edge-guard.
5. Orchestrator sets a `next_unit` that references the failed gate: `"BLOCKED — edge-guard halt at gate '{name}': missing emits {list}"`.
6. Orchestrator commits checkpoint and exits.

**Re-entry protection (important):**

Without guard: next session reads checkpoint, re-enters loop, re-runs step N, same emit-miss, re-halts → infinite loop on operator-less re-runs.

**Two mechanisms:**

1. **Operator ack in checkpoint:** The checkpoint body includes an `operator_action:` field. On resume, SKILL.md cold-start reads the checkpoint; if `operator_action` is present and has NOT been acknowledged (e.g., no `resolved_by:` line), surface it as a blocker message and exit immediately rather than re-entering the loop. Same pattern as the D-10 schema-fix cap in SKILL.md:340-358.

2. **Idempotency flag in edge-guard:** Add a `resolved_by:` field to the checkpoint. On next session, if the user has edited the checkpoint to add `resolved_by: {ISO}`, edge-guard treats the failing transition as acknowledged and passes through this one iteration only (clears the flag after).

**No rollback option (D-11b):** Edge-guard never calls `git reset`, `git checkout`, or similar. Only writes jsonl + triggers checkpoint. Matches D-11b's "too risky for minimal gain" framing.

**Integration point in SKILL.md:** Wrap Steps 1-10 and the transitions in a single helper block around loop iteration. Pseudocode:

```
for each step N in [1..11]:
  snapshot_before = snapshotMtimes(gate.evidence_emitted)
  runStepN()
  snapshot_after = snapshotMtimes(gate.evidence_emitted)
  const actualEmits = diffSnapshots(snapshot_before, snapshot_after);

  const result = edgeGuard.recordTransition({
    fromStep: N, toStep: N+1, ...,
    gateName: gateOwnerOfStep[N], ...,
    expectedEmits: gate.evidence_emitted,
    actualEmits, ...
  });

  if (result.status === 'halt') {
    writeCheckpoint({
      next_unit: `BLOCKED — edge-guard halt at ${result.gate}: missing ${result.missing_emits.join(', ')}`,
      operator_action: `Investigate why gate did not emit ${result.missing_emits}. Resolve manually, add 'resolved_by: {ISO}' to this file, then re-run /sgsd-orchestrate go.`,
      edge_guard_row: result.row,
    });
    EXIT;
  }
```

---

## Q6: 09-verify.mjs Retro-Fix (D-12b)

**Recommendation: Add 2 new invariants as numbered entries 8 and 9** — do NOT inline into existing invariant bodies. Numbered entries match the existing file's structure (invariants 1-7, each with `// Invariant N:` comment header).

**Minimum-churn patch (append after line 60, before `console.log('PASS')`):**

```javascript
// Invariant 8 (WR-01): per-dispatch rows: total_bypass_cost === per_dispatch_tokens × dispatches_bypassed
for (const row of gbp.audit.filter(r => r.class === 'per-dispatch')) {
  const expected = row.per_dispatch_tokens * row.dispatches_bypassed;
  if (row.total_bypass_cost !== expected) {
    fail(8, `row "${row.gate}" total_bypass_cost ${row.total_bypass_cost} !== ${row.per_dispatch_tokens} × ${row.dispatches_bypassed} (${expected})`);
  }
}

// Invariant 9 (WR-02): classification findings_detail[].bucket strings map consistently to findings_by_bucket keys
const bucketMap = {
  'real-bloat':      'real_bloat',
  'integration-gap': 'integration_gap',
  'nit':             'nit',
  'false-positive':  'false_positive',
  'info':            'info',
};
const counted = {};
for (const row of cls.findings_detail) {
  const key = bucketMap[row.bucket];
  if (!key) fail(9, `unknown bucket string "${row.bucket}" in finding ${row.id || '?'}`);
  counted[key] = (counted[key] || 0) + 1;
}
for (const [k, v] of Object.entries(b)) {
  if ((counted[k] || 0) !== v) {
    fail(9, `bucket "${k}" detail count ${counted[k] || 0} !== declared ${v}`);
  }
}
```

**Rationale for keeping them numbered:**
- 09-ATC-REVIEW.md:63-96 gives the exact fix text to paste (this is essentially what the reviewer wrote). Copying verbatim preserves reviewer intent.
- Existing invariants 1-7 use `fail(N, msg)` with `N` matching the invariant number — same convention.
- Allows exit-code-to-invariant mapping (exit 8 = WR-01 fix fails; exit 9 = WR-02 fix fails).

**Verification after patch:** Run `node .planning/phases/09-atc-147-evidence/verify.mjs` — must exit 0 (all 9 invariants pass on Phase 9's committed artefacts). This is the gate for D-12b being complete.

**This is a Plan 10-03 task, not a deviation:** D-12b explicitly scopes the retro-fix to Phase 10's execution. 1 commit: `fix(09): add WR-01/WR-02 invariants (Phase 10 D-12b)`.

---

## Q7: Phase 10's Own verify.mjs Invariants

**Recommendation: 8 invariants (down from my initial 7-10 range).** Phase 9 had 7 invariants covering a 2-YAML + 1-MD surface. Phase 10 has more artefacts (gates.yaml + 3 JS modules + SKILL.md edits + config.json edit + 09-verify.mjs edit) so 8 invariants with broader coverage is appropriate. Any more risks adding invariants that overlap and obscure failure origin.

**Recommended invariant list:**

| # | Invariant | Asserts | Failing Exit Code |
|---|-----------|---------|-------------------|
| 1 | gates.yaml parses as valid YAML | `yaml.load(gates.yaml)` does not throw | 1 |
| 2 | `gates` list has ≥ 11 rows | 9 per-step + 2 verify-completeness = 11 minimum (per D-01..D-09, D-12) | 2 |
| 3 | Every row has required fields | `name`, `category`, `enforcement_mode`, `state`, `source_dlb`, `version` present | 3 |
| 4 | `enforcement_mode` value in allowed set | Each row's mode ∈ `{hard-halt, soft-warn, amortized, disabled}` (scaffold `enforcement_modes` list) | 4 |
| 5 | No duplicate gate names | `new Set(gates.map(g => g.name)).size === gates.length` | 5 |
| 6 | Every `trigger` clause is parseable | For each gate, `evalPredicate(g.trigger || [], sample_ctx)` does not throw (with a known-complete sample ctx) | 6 |
| 7 | 09-verify.mjs exits 0 | `execSync('node .planning/phases/09-atc-147-evidence/verify.mjs')` returns 0 (D-12b retrofit check) | 7 |
| 8 | config.json has no `byterover` key | `!('byterover' in JSON.parse(config))` (D-13 cleanup check) | 8 |

**What I considered and rejected:**

- **`reviewer_agent` / `script` file-exists check** — too brittle (those agents may be renamed; script paths can be relative). Keep as a future Plan-11 plan-checker check, not a verify.mjs invariant.
- **`evidence_emitted` path exists** — same — paths are phase-templated (`{N}`), not concretely resolvable at verify time.
- **`state: active` on all Phase 10 rows** — tempting but D-15b allows experimental/known-gap states for FUTURE additions. Invariant would lock out legitimate future rows. Skip.
- **`gates` list has EXACTLY 11 rows** — same reason. Use `>=` (invariant 2) instead of `===`.

**LOC estimate:** ~100 LOC (8 invariants × ~10 LOC + boilerplate ~20). Matches Phase 9's verify.mjs (63 LOC for 7 invariants) scaled up.

---

## Q8: config.json Cleanup (D-13) — gsd-tools Known-Key Schema Patch

**Found:** `KNOWN_TOP_LEVEL` Set at `~/.claude/get-shit-done/bin/lib/core.cjs:322-331`. This is the file that prints `"gsd-tools: warning: unknown config key(s)..."`.

**Current top-level config.json keys (verified via `node -e`):**
`workflow, safety, hooks, parallelization, model_routing, token_efficiency, byterover, deliberation, git, atc, browser_verify, overwatcher, model_profile`

**Currently in `KNOWN_TOP_LEVEL`** (from core.cjs:322-331):
- Dynamically from `VALID_CONFIG_KEYS` (top-level prefix of each dotted path): `workflow, git, planning, hooks, features, workflow, context, mode, granularity, parallelization, commit_docs, model_profile, search_gitignored, brave_search, firecrawl, exa_search`
- Hardcoded section containers: `git, workflow, planning, hooks, features`
- Internal: `model_overrides, agent_skills, context_window, resolve_model_ids, claude_md_path`
- Deprecated: `depth, multiRepo`

**Delta (keys that would still fire the warning after D-13 byterover deletion):**

| Key | Status |
|-----|--------|
| `safety` | Not in KNOWN_TOP_LEVEL → **ADD** |
| `model_routing` | Not in KNOWN_TOP_LEVEL → **ADD** |
| `token_efficiency` | Not in KNOWN_TOP_LEVEL → **ADD** |
| `deliberation` | Not in KNOWN_TOP_LEVEL → **ADD** |
| `atc` | Not in KNOWN_TOP_LEVEL → **ADD** |
| `browser_verify` | Not in KNOWN_TOP_LEVEL → **ADD** |
| `overwatcher` | Not in KNOWN_TOP_LEVEL → **ADD** |
| `byterover` | To be **removed from config.json** (D-13) — no KNOWN_TOP_LEVEL change needed, just delete |

**Recommended patch (in `~/.claude/get-shit-done/bin/lib/core.cjs`):**

```javascript
// Lines 322-331 (EXISTING — add to the Set literal)
const KNOWN_TOP_LEVEL = new Set([
  ...[...VALID_CONFIG_KEYS].map(k => k.split('.')[0]),
  'git', 'workflow', 'planning', 'hooks', 'features',
  'model_overrides', 'agent_skills', 'context_window', 'resolve_model_ids', 'claude_md_path',
  'depth', 'multiRepo',
  // ── Phase 10 D-13b additions: runtime tuning blocks referenced by gates.yaml
  'safety', 'model_routing', 'token_efficiency', 'deliberation',
  'atc', 'browser_verify', 'overwatcher',
]);
```

**Patch shape: 1 line added (array of 7 keys)** + `git add` + commit.

**Commit message:** `fix(gsd-tools): add Phase 10 config blocks to known-keys (D-13b)`

**This is a Plan 10-03 task** (integration + cleanup), not a deviation. **Critical:** this patch modifies a file OUTSIDE the GSDedits repo (it lives in `~/.claude/get-shit-done/bin/`). Planner must flag this as a cross-repo commit; the executor should either (a) commit separately to the gsd-tools repo if it has its own git history, or (b) flag it as a FALLBACK BLOCKER and escalate to operator to update globally. [ASSUMED: gsd-tools is a separate installed tool not part of this repo's git tracking — needs operator confirmation during planning.]

---

## Q9: Prior Art in Memory Tree

**Queries run (via `bash super-gsd/scripts/sgsd-recall.sh`):**

| Query | Matches | Relevant Hits |
|-------|---------|---------------|
| `"orchestrator gate policy"` | 1 | `architecture/patterns/orchestrator-patterns.md` — general patterns, no gate-specific |
| `"predicate evaluator yaml"` | 0 | — (confirmed zero prior art; genuinely new surface) |
| `"jsonl log metrics"` | 0 | — |
| `"yaml registry"` | — (query aborted but prior experience shows none) | — |
| `"atomic"` | 2 | `trajectory/hypothesis/v1.1-atomic-writes-tmp-rename.md`, `v1.1-atomic-commit-per-plan.md` |
| `"IPC guard"` | 1 | `trajectory/hypothesis/v1.1-ipc-guard-structured-data.md` — @file: guard pattern |

**Patterns found that apply to Phase 10:**

1. **`orchestrator-patterns.md`** — confirms the "tool-call chaining" and "dispatch rules" patterns; Phase 10's gate lookup must not break the chain (one tool call per response). ✓ Our approach preserves this.

2. **`v1.1-atomic-writes-tmp-rename.md`** (hypothesis tier) — atomic write pattern for JSONL/YAML files. **Apply to edge-guard-log.jsonl writes** — use `appendFileSync` (already atomic at the OS level for small rows) OR write-to-tmp-then-rename for larger state updates.

3. **`v1.1-ipc-guard-structured-data.md`** (hypothesis tier) — @file: guard pattern for untrusted structured data. **Not directly applicable** — gates.yaml is trusted (we ship it). But noting it for future if we accept user-provided predicate files.

4. **No prior predicate-eval or edge-guard patterns** — this phase is building genuinely new surface area. Plan 10-01 and 10-02 should curate the new modules as `architecture/patterns/` entries post-execution (per D-08 trigger `script_created: true`).

**Curation suggestions for Plan 10-03 SCRIPTS_CREATED reports:**
- `predicate-eval.cjs` → curate as `architecture/patterns/structured-predicate-evaluator.md`
- `gates-registry.cjs` → curate as `architecture/patterns/yaml-registry-singleton.md`
- `edge-guard.cjs` → curate as `architecture/patterns/step-transition-audit.md`

---

## Q10: Validation Architecture (Nyquist Dimension 8)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node-based ad-hoc assertions (matches Phase 9 pattern) + js-yaml from `super-gsd/tools/plan-schema/node_modules/` |
| Config file | none — reuses pinned deps |
| Quick run command | `node .planning/phases/10-gate-policy/verify.mjs` |
| Full suite command | `node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/09-atc-147-evidence/verify.mjs` (must be 0+0 after retrofit per D-12b) |
| Estimated runtime | ~1 second |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **GATE-01** | Per-gate decision matrix declared with triggers in gates.yaml | structured-yaml | `node .planning/phases/10-gate-policy/verify.mjs` (invariants 1-6) | ❌ Wave 0 |
| **GATE-02** | ATC gates (`per-dispatch-ATC`, `phase-level-ATC`) land in gates.yaml with `enforcement_mode` field, not prose | grep-assertion | `grep -q "name: per-dispatch-ATC" super-gsd/registry/gates.yaml && grep -q "name: phase-level-ATC" super-gsd/registry/gates.yaml` | ❌ Wave 0 |
| **GATE-03** | 7 non-ATC gates present with explicit keep/kill verdict backed by matrix | structured-yaml | `node .planning/phases/10-gate-policy/verify.mjs` (invariant 2: ≥11 rows including 7 non-ATC) | ❌ Wave 0 |
| **GATE-04** | Edge-guard log contract exists + schema validated + sample row writable | integration | `node super-gsd/scripts/lib/edge-guard.cjs --self-test` (add `--self-test` flag that writes + verifies a row then deletes) OR JSONL-schema assertion in Phase 10 verify.mjs | ❌ Wave 0 |
| **D-12b** | 09-verify.mjs passes with added WR-01/WR-02 invariants | full-suite | `node .planning/phases/09-atc-147-evidence/verify.mjs && echo PASS` (exit 0 = all 9 invariants green) | ✅ (existing file patched) |
| **D-13 cleanup** | byterover block removed from config.json; no warning from gsd-tools | grep + tool-probe | `! grep -q '"byterover"' .planning/config.json && node ~/.claude/get-shit-done/bin/gsd-tools.cjs init phase-op 10 2>&1 \| grep -v 'unknown config key'` | ✅ (config.json exists) |

### Sampling Rate
- **Per task commit:** `node .planning/phases/10-gate-policy/verify.mjs` (< 1s)
- **Per wave merge:** Both verifiers (Phase 9 retrofit + Phase 10 own) must green
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `.planning/phases/10-gate-policy/verify.mjs` — covers GATE-01, GATE-03, D-12b, and D-13 cleanup via 8 invariants (Q7)
- [ ] `super-gsd/scripts/lib/predicate-eval.cjs` — unit-testable but verification is via verify.mjs invariant 6 (trigger clauses parse)
- [ ] `super-gsd/scripts/lib/gates-registry.cjs` — same; verification via invariants 1-5
- [ ] `super-gsd/scripts/lib/edge-guard.cjs` — add `--self-test` CLI flag OR a small test harness file for the GATE-04 jsonl-shape assertion
- [ ] Framework install: **none needed** — reuse existing js-yaml

---

## Implementation Risks

### R1: SKILL.md integration surface is large (9 call sites)
**Risk:** Plan 10-03 touches 9 locations in a 882-line file. Any merge conflict or missed site silently breaks the gate lookup.
**Mitigation:** Add a Phase 10 verify.mjs invariant that greps SKILL.md for `gates.shouldFire(` count and asserts `>= 9`. Catches missed sites at phase-gate time.

### R2: Cross-repo patch to `~/.claude/get-shit-done/bin/lib/core.cjs`
**Risk:** D-13b requires editing a file outside the GSDedits repo. If gsd-tools has separate git history, the edit must be committed there separately; if it's vendored, the repo boundary is unclear. [ASSUMED: operator must clarify.]
**Mitigation:** Plan 10-03 should include an explicit task "verify gsd-tools patch location" that runs `git rev-parse --show-toplevel` on the core.cjs file and reports back. If different root than GSDedits → emit BLOCKER requesting operator guidance.

### R3: Edge-guard emit-snapshot racing
**Risk:** Taking file-mtime snapshots before/after a step assumes the orchestrator process is the only writer. Concurrent hooks (e.g., sgsd-heartbeat.js PostToolUse) could update unrelated files between snapshots.
**Mitigation:** Scope snapshots to paths declared in `gate.evidence_emitted` ONLY, not broad globs. Snapshot list is bounded at ~5 paths per step. Don't pattern-match paths not in the declared emit contract.

### R4: `classifier_result` field availability for v2 plans that skip the Haiku classifier
**Risk:** SKILL.md:152-169 already synthesizes classifier_result from v2 frontmatter for schema_version=2 plans. Phase 10 gates reference `classifier.complexity` and `classifier.atc_tier` — these must be populated in the synthesized result too.
**Mitigation:** Verified — SKILL.md:160-165 already populates both fields in the synthesized path. No new work. Just confirm in the dispatch-context-build step.

### R5: `config.atc.enabled` and `config.browser_verify.enabled` kill-switches vs gates.yaml triggers
**Risk:** D-13a keeps these blocks. Are they redundant with gates.yaml enforcement_mode=disabled? Partially. The existing SKILL.md code has `if (config.atc.enabled)` at Step 6.5:362 and Step 9.5:694 — a kill-switch at the step level. gates.yaml's `enforcement_mode: disabled` is a kill-switch at the gate level. They compose: disable in either place works.
**Mitigation:** Keep both. Plan 10-03 does NOT remove the `config.atc.enabled` checks — just adds the `gates.shouldFire` check alongside. Both gates must agree for the step to run. Documented explicitly in the Plan 10-03 task description.

### R6: Edge-guard log growing unbounded
**Risk:** `.planning/metrics/edge-guard-log.jsonl` grows 1 row per step per iteration — for a 10-plan phase that's ~110 rows. Over time this becomes multi-MB.
**Mitigation:** Matches existing `.planning/metrics/token-log.jsonl` pattern (already unbounded, no rotation). Accept for v1.2; defer rotation to future GOV phase. Log rotation is out of scope per D-17 analogue.

### R7: Step ownership ambiguity for edge-guard
**Risk:** Multiple gates might attach to one step (e.g., both `classifier-haiku` and a future `classifier-drift-check` on Step 2). edge-guard needs to know which gate's `evidence_emitted` to use.
**Mitigation:** For v1.2, lock 1-gate-per-step. The existing 9 gates map 1:1 to 9 steps. Future multi-gate-per-step can be handled via a wrapper gate that composes sub-gates — deferred per D-17 (no scope creep in v1.2).

### R8: Unknown-field policy (D-10c) throws could halt loop unnecessarily
**Risk:** A typo in a gates.yaml trigger (e.g., `classifier.complexty` vs `classifier.complexity`) would throw on every predicate eval, halting the entire loop.
**Mitigation:** Phase 10 verify.mjs invariant 6 (trigger clauses parse with a known-complete sample ctx) catches typos at phase-gate time, before the new gates.yaml is ever loaded by a live orchestrator. This is why invariant 6 is critical.

---

## Recommended Plan Decomposition

**Validation of CONTEXT.md D-16 (3 plans, 2 waves):** APPROVED with one refinement.

### Plan 10-01 — Predicate Evaluator + gates.yaml Population
**Wave:** 1
**Files touched:**
- `super-gsd/scripts/lib/predicate-eval.cjs` (new, ~80 LOC)
- `super-gsd/scripts/lib/gates-registry.cjs` (new, ~60 LOC)
- `super-gsd/registry/gates.yaml` (populate `gates: []` with 11 rows per D-01..D-09 + D-12)
**Estimated tasks:** 4 (evaluator, registry, gates.yaml population, unit-level sanity check)
**Requirements covered:** GATE-01, GATE-02, GATE-03

### Plan 10-02 — Edge-Guard Layer
**Wave:** 1 (different files from 10-01)
**Files touched:**
- `super-gsd/scripts/lib/edge-guard.cjs` (new, ~80 LOC)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` (add transition-wrapper pseudo-code in a new `<edge_guard>` section; no replacement of existing step-gate integration yet — that's 10-03's job)
- `.planning/metrics/edge-guard-log.jsonl` (empty file created or written on first run)
**Estimated tasks:** 3 (edge-guard module, SKILL.md wrapper section, self-test harness)
**Requirements covered:** GATE-04

### Plan 10-03 — Integration & Cleanup
**Wave:** 2 (depends on 10-01 output + 10-02 output)
**Files touched:**
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` (9 integration sites replace hard-coded gate checks with `gates.shouldFire(...)`)
- `.planning/phases/09-atc-147-evidence/verify.mjs` (D-12b retrofit: add invariants 8 and 9)
- `.planning/config.json` (D-13: delete `byterover:` block)
- `~/.claude/get-shit-done/bin/lib/core.cjs` (D-13b: add 7 keys to KNOWN_TOP_LEVEL) — **cross-repo caveat per R2**
- `.planning/phases/10-gate-policy/verify.mjs` (new, ~100 LOC, 8 invariants per Q7)
**Estimated tasks:** 6 (SKILL.md integration, 09-verify retrofit, config byterover removal, core.cjs known-keys patch, Phase 10 verify.mjs, final sanity check)
**Requirements covered:** cross-cutting integration; validates all 4 GATE-XX requirements end-to-end

### Wave Structure (D-16b validated)

```
Wave 1 (parallel):
  10-01 ──┐
          ├──▶ Wave 2:  10-03
  10-02 ──┘
```

Parallel-safe because:
- 10-01 touches `scripts/lib/predicate-eval.cjs`, `scripts/lib/gates-registry.cjs`, `registry/gates.yaml`
- 10-02 touches `scripts/lib/edge-guard.cjs`, SKILL.md `<edge_guard>` section (new), `metrics/edge-guard-log.jsonl`
- **No file overlap** between 10-01 and 10-02.

10-03 consumes both (imports predicate-eval via gates-registry + edge-guard) — must be Wave 2.

**One refinement to CONTEXT.md D-16:** the 09-verify.mjs retrofit (D-12b) can logically fit in either 10-01 or 10-03. CONTEXT.md implies 10-03 — confirmed correct because the retrofit creates a dependency on the Phase 10 verify.mjs (which tests the retrofit via invariant 7). Keeping both in 10-03 means one plan owns the "Phase 9 + Phase 10 both green" sanity check.

---

## Code Examples

### Example 1: gates.yaml row shape (one per step, per D-15 scaffold)

```yaml
# Source: synthesis of super-gsd/registry/gates.yaml scaffold + D-05
gates:
  - name: per-dispatch-ATC
    category: code-quality
    enforcement_mode: hard-halt
    trigger:
      - {field: classifier.atc_tier, op: in, value: [full, gate]}
      - {field: code_files_changed_count, op: gt, value: 0}
    checks:
      - ATC 7-step
      - 10-point anti-slop checklist
      - ΔComplexity ≤ 0
    reviewer_agent: gsd-code-reviewer
    evidence_emitted:
      - .planning/phases/{N}/commit-reviews.jsonl
    fallback: soft-warn in auto mode
    escalation: log-only       # D-11 default; D-11a overrides
    source_dlb: DLB-02
    state: active
    version: 2.0
```

### Example 2: MUDA gate with nested any: (D-07)

```yaml
  - name: MUDA-waste-audit
    category: process-hygiene
    enforcement_mode: soft-warn
    trigger:
      - any:
          - {field: files_changed_count, op: gte, value: 4}
          - {field: diff_lines, op: gte, value: 100}
      - {field: phase_type, op: not_in, value: [docs, config, refactor]}
    script: super-gsd/scripts/sgsd-muda-audit.sh
    evidence_emitted:
      - .planning/phases/{N}/WASTE.md
    source_dlb: DLB-02
    state: active
    version: 2.0
```

### Example 3: Verify-completeness gate (D-12)

```yaml
  - name: verifier-row-arithmetic
    category: verify-completeness
    enforcement_mode: soft-warn
    trigger:
      - {field: phase_has_verify_mjs, op: eq, value: true}
    check: >-
      per-dispatch rows in phase-level YAML audits must satisfy
      total_bypass_cost === per_dispatch_tokens × dispatches_bypassed
    evidence_emitted: []       # no new file emitted; invariant is in-process
    source_dlb: Phase 9 WR-01
    state: active
    version: 2.0
```

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 10 writes new files only (gates.yaml rows, edge-guard-log.jsonl, new verify.mjs) | — |
| Live service config | None — no external services; all configuration is in-repo | — |
| OS-registered state | None — no OS registrations | — |
| Secrets/env vars | None — no secret touches | — |
| Build artifacts | None — no compiled artifacts; pure JS and YAML | — |
| **Cross-repo file edit** | **`~/.claude/get-shit-done/bin/lib/core.cjs` (D-13b)** — lives outside GSDedits. | **Plan 10-03: confirm repo root via `git rev-parse`; if different, flag to operator + commit to gsd-tools repo separately.** |
| **Memory-store migration** | `.brv/context-tree/` → `.planning/memory/` already done (D-14 migration ran 2026-04-22; verified `.planning/memory/MEMORY.md` exists). | — (prereq complete) |

---

## Common Pitfalls

### P1: Predicate evaluator swallows undefined fields silently
**What goes wrong:** `return ctx?.classifier?.complexity === 'trivial'` — silently returns `undefined === 'trivial'` → false. Gate never fires. Bug is invisible.
**Why it happens:** Defensive JS idioms default to `undefined`; `===` against a string yields false.
**How to avoid:** D-10c mandates throw on unknown field. `getDottedField` must `throw new Error(...)` not `return undefined`.
**Warning signs:** Gates silently never firing on correct context, operator sees "no action" but expects gate to fire.

### P2: gates.yaml row ordering churn
**What goes wrong:** Every future edit re-sorts rows → huge diffs → obscures actual changes.
**Why it happens:** YAML parsers don't preserve map order in some cases.
**How to avoid:** D-15a mandates deterministic order (group by category, then sort by step). Add a sort check to verify.mjs invariant 3 (fields present check) or a new invariant.
**Warning signs:** PR diffs that show 11 rows touched when only 1 was edited.

### P3: Edge-guard row written BEFORE step action
**What goes wrong:** Writing the log row before running the step means `actual_emits` is empty → every step looks like a miss.
**Why it happens:** Misreading the step order — the wrapper must run AFTER the step.
**How to avoid:** See Q4 — wrapper executes after `runStepN()`. Unit test the ordering.
**Warning signs:** Edge-guard log shows 100% missing emits immediately after deploy.

### P4: Forgetting to exempt Step 11 (token-log) from emit-check
**What goes wrong:** Edge-guard tries to verify token-log wrote a row, but the verification itself runs AFTER Step 11 → comparison against the row just written will see it, but the wrapper is doing recursion. Subtler bug: if Step 11 is the step that writes edge-guard-log.jsonl too, we're inside the log writing the log.
**Why it happens:** D-11c exemption is easy to miss.
**How to avoid:** Explicit guard in `recordTransition`: `if (fromStep === 11) return {status: 'ok', missing_emits: []};`
**Warning signs:** Recursion errors or duplicated log rows on step 11→1 transition.

### P5: Caching gates.yaml across test runs pollutes state
**What goes wrong:** Unit tests mutate a gates.yaml fixture, cached registry returns stale data.
**Why it happens:** The `_cache` singleton in `gates-registry.cjs` is module-scoped; `require` caches the module.
**How to avoid:** Export `resetCache()` for tests (already in Pattern 3 above). Call it in test setup.
**Warning signs:** Second test in suite fails but passes in isolation.

### P6: `classifier_result` missing for v2 plans before the synthesis path lands
**What goes wrong:** A v2 plan where SKILL.md:152-165 synthesis didn't populate atc_tier → `classifier.atc_tier` field missing → predicate throws.
**Why it happens:** v2 synthesis (existing code, SCHEMA-04) might have a bug we haven't caught.
**How to avoid:** Add a dispatch-context-build sanity check that asserts all 10 D-10c fields are set before `shouldFire` is called. Log + fall back to defaults rather than throw in the context-build step (only throw in the predicate, where throw is the specified contract).
**Warning signs:** Gates that were working suddenly throw on specific v2 plans.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-coded gate thresholds in SKILL.md prose | YAML registry + predicate evaluator | This phase (v1.2 Phase 10) | Single source of truth; enables edge-guard; mechanically testable |
| No emit-level observability | `.planning/metrics/edge-guard-log.jsonl` per transition | This phase | Silent-skip drift (the Phase 147 failure mode) becomes a jsonl row |
| ByteRover runtime-conditional memory | Always-on `.planning/memory/` via sgsd-recall (D-14) | Prereq migration (run 2026-04-22) | Removes 9,600 tok/phase conditional branch; simplifies gate logic |

**Deprecated/outdated:**
- `config.byterover` block: removed this phase (D-13).
- `if (config.byterover.enabled)` conditionals in SKILL.md: none found (grep returned 0 hits). ✓ No cleanup needed beyond config.json deletion.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `~/.claude/get-shit-done/bin/lib/core.cjs` is in a separate git repo (not GSDedits) and must be patched as a cross-repo change | Q8, R2 | If actually vendored in GSDedits, the commit is simpler (1 file in-repo). Low risk — planner verifies with `git rev-parse --show-toplevel` before executing. |
| A2 | `super-gsd/tools/plan-schema/node_modules/js-yaml@4.1.1` remains at that pinned version through Phase 10 execution | Standard Stack | If version changes unexpectedly, modules break. Low risk — js-yaml is a leaf dep, no pending upgrades. |
| A3 | Phase 9's `verify.mjs` will still use its current 7-invariant structure when D-12b patch lands | Q6 | If someone edits verify.mjs between now and Phase 10 execution, numbering conflicts possible. Low risk — Phase 9 is complete and frozen. |
| A4 | SKILL.md's existing 9 gate-check sites can be identified by the 9 step headers (2, 4, 5, 5.5, 6.5, 6.55, 9.5, 10, 11) | Q3, R1 | If there are hidden gate-check sites (e.g., inline `if` checks not tied to a step header), some will be missed. Medium risk — planner's R1 mitigation (grep count invariant) catches this at phase-gate. |
| A5 | v2-plan classifier synthesis (SKILL.md:152-169) correctly populates `classifier.complexity` AND `classifier.atc_tier` on every v2 plan | Q2, P6 | If synthesis has bugs, gate trigger eval throws. Medium risk — Plan 10-01 unit tests should cover both paths (v1 classifier result + v2 synthesis result). |

**All 5 assumptions are tracked and have defined mitigations in planning tasks. None blocks Phase 10 planning.**

---

## Open Questions

1. **Should `evidence_emitted: []` (empty) count as "no check" or "must emit nothing"?**
   - What we know: Step 2 (Haiku classifier) emits in-memory JSON, no file. Step 1 (state read) emits nothing.
   - What's unclear: semantic of empty list — skip check vs require-empty-actual.
   - Recommendation: Empty list = "no check performed; edge-guard logs a pass row unconditionally". Document in edge-guard.cjs JSDoc. Prevents false positives on non-file-emitting steps.

2. **What happens when the same gate row has both `trigger: []` (always fires) AND `enforcement_mode: disabled`?**
   - What we know: D-15b reserves `disabled` for future dead/test gates.
   - What's unclear: does `disabled` short-circuit the trigger eval?
   - Recommendation: `disabled` wins. `shouldFire` returns false immediately when `enforcement_mode === 'disabled'` (already in Pattern 3 code). Trigger clauses never evaluated for disabled gates. No invariant contradiction.

3. **Does Plan 10-03 need to commit the gsd-tools core.cjs patch in a separate git repo?**
   - What we know: A1 (cross-repo assumption).
   - What's unclear: operator's install layout.
   - Recommendation: Plan 10-03 first task: `git rev-parse --show-toplevel` on core.cjs. Report back. If different root → emit BLOCKER to operator requesting confirmation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All new modules + verify.mjs | ✓ | [VERIFIED: in-use; used by 09-verify.mjs and validate.cjs] | — |
| `js-yaml` (pinned) | gates-registry, Phase 10 verify.mjs | ✓ | 4.1.1 | — |
| Bash (Git Bash / WSL) | sgsd-recall.sh / sgsd-curate.sh invocations from SKILL.md | ✓ | [VERIFIED: in env — confirmed by running sgsd-recall above] | — |
| `git` | commit discipline | ✓ | standard | — |
| `~/.claude/get-shit-done/bin/gsd-tools.cjs` | config-key warnings | ✓ | [VERIFIED: in ~/.claude install] | — |

**No blocking missing deps.** No install step required for Phase 10.

---

## Security Domain

**Applicability:** Low. Phase 10 introduces no user-facing input surface, no network I/O, no secret handling, no authentication decisions. It processes trusted in-repo YAML (gates.yaml) and writes local JSONL metrics.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes (narrow)** | **js-yaml with safeLoad semantics (js-yaml v4 default is safe — no code-object deserialization)** |
| V6 Cryptography | no | — (no crypto ops) |
| V7 Error Handling | **yes** | Throw explicit errors on unknown fields (D-10c); never swallow silently; log stack to edge-guard log |

### Known Threat Patterns for Phase 10 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via YAML `__proto__` keys | Tampering | js-yaml v4 safeLoad default (`yaml.load` in v4 IS safeLoad — verified in package-lock.json:161) |
| Path traversal via gate.evidence_emitted values | Tampering | Resolve paths with `path.resolve(projectDir, ...)` and assert the result stays under `projectDir`. Add as a Phase 10 verify.mjs invariant (deferred — low risk, gates.yaml is maintainer-authored) |
| Unbounded log growth | DoS | Accepted per R6; deferred to future governance phase |
| Infinite re-halt loop on checkpoint re-entry | Availability | `resolved_by:` ack field (Q5) |

---

## Sources

### Primary (HIGH confidence — in-repo, verified)
- `super-gsd/registry/gates.yaml` (scaffold) — canonical schema shape
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` (lines 129-754) — 9-step loop + existing hard-coded gate sites
- `super-gsd/tools/plan-schema/validate.cjs:132-191` — CJS module + js-yaml via createRequire pattern
- `.planning/phases/09-atc-147-evidence/verify.mjs:6-60` — ESM verify.mjs pattern (7 invariants)
- `.planning/phases/09-atc-147-evidence/09-ATC-REVIEW.md` (WR-01, WR-02 fix text verbatim)
- `.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml` — 9 gates × verdict_pointer_to_phase_10 open questions
- `~/.claude/get-shit-done/bin/lib/core.cjs:322-337` (D-13b patch site)
- `~/.claude/get-shit-done/bin/lib/config.cjs:14-47` (VALID_CONFIG_KEYS list)
- `.planning/memory/architecture/patterns/orchestrator-patterns.md` — loop invariants
- `.planning/memory/trajectory/hypothesis/v1.1-atomic-writes-tmp-rename.md` — atomic write pattern

### Secondary (MEDIUM confidence)
- `super-gsd/SGSD-v2-MIGRATION-MANIFEST.md §4.4` (R-Q2 three-tier rationale, cited via line 420 `# hard-halt | soft-warn | amortized`)
- `super-gsd/scripts/sgsd-recall.sh:78-89` (auto-detects both `.planning/memory/` and legacy `.brv/context-tree/`)
- `super-gsd/scripts/sgsd-curate.sh:101-126` (same auto-detect)

### Tertiary (LOW confidence — not applicable)
None. This research is entirely in-repo sourced.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — js-yaml location and version verified via grep of package-lock.json; pattern reuse verified via 2 existing tools (validate.cjs, 09-verify.mjs)
- Architecture: HIGH — all 3 recommended modules (predicate-eval, gates-registry, edge-guard) have explicit code templates; integration sites identified by line number in SKILL.md; D-13b patch site pinpointed to core.cjs:322-331
- Pitfalls: HIGH — 6 pitfalls derived from explicit D-10c/D-11c/D-15a decisions and known JS idioms; all have specific detection warnings
- Risks: HIGH — 8 risks named, all with concrete mitigations; R2 is the one with residual operator-dependency (cross-repo question)
- Validation architecture: HIGH — pattern directly reused from Phase 9; invariants map 1:1 to requirements

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — stable in-repo artefacts; no fast-moving external deps)
