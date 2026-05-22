# Phase 12: Machinery — Research

## RESEARCH COMPLETE

**Researched:** 2026-04-22
**Domain:** Orchestrator internals (JS/CJS modules), SKILL.md surgical edits, bash installer, verify.mjs invariants
**Confidence:** HIGH — every recommendation has a line-number citation to the live code that will be touched.

---

## Executive Summary

- **12-CONTEXT.md is complete.** All 25 decisions are locked. This research answers HOW to land them, not WHAT to build. No policy ambiguity was found.
- **Two new CJS modules, six existing surgical edits, one new bash script, one new verify.mjs.** The phase does not invent new agent types, new gate categories, or new model routing. It consumes Phase 10/11 outputs.
- **MACH-01, 02, 03, 04 all touch the same file** (`super-gsd/skills/sgsd-orchestrate/SKILL.md`) in **four different sections** — this is the reason D-23 serializes 12-02/03/04 across waves.
- **Wave 1 parallelism (12-01 + 12-05 + 12-06) is genuine.** Verified disjoint file lists: 12-01 creates a new module, 12-05 edits two distinct lib files + a different SKILL.md section than MACH-02/03/04, 12-06 creates a brand-new script. Zero file overlap. [VERIFIED: file globs]
- **One CONTEXT.md assumption needs planner flag: D-11 emergency 85% hard cap has no mechanical "context %" oracle in SKILL.md today.** Current triggers (lines 30, 161, 960, 1023) all reference `>70%` as a human/agent-judgment threshold, not a measured value. MACH-03 can either (a) keep it aspirational (same weight as 70%) or (b) introduce a token-log-derived estimate. Recommendation below — this is the single surface that may warrant a planner clarification but does NOT need to re-open the discuss phase (it's a mechanical HOW, not a policy decision).

**Primary recommendation:** author the 6 plans exactly as D-22/D-23 prescribes; the wave model is correct; the parallelism claim in D-23a is honest; the only risk flag is the MACH-03 85% oracle which is a LITE scope bump not a scope rebate.

---

## User Constraints (from 12-CONTEXT.md)

All locked decisions D-01..D-25 are authoritative for this research. No alternatives are explored. Deferred ideas (predicate novelty scoring, cross-session cache, per-task classifier, full-board contrarian, auto-tune rate, MUDA-driven linter) are explicitly out of scope.

### Locked Decisions
- **MACH-01 (D-01..D-04):** per-plan sidecar `.classifier.json` at `.planning/phases/{NN}/plans/{NN-PP}.classifier.json`; mtime-based staleness; v1-plan fallback via `schema_version` check.
- **MACH-02 (D-05..D-08):** new `dispatch-planner.cjs` module; reads `depends_on` + `files_touched`; plan-level waves + task-level parallel within a wave; v1 fallback = single serial wave.
- **MACH-03 (D-09..D-12):** three new checkpoint fields; trigger = `(phase_boundary OR plan_boundary) AND context >70%`; 85% hard cap mid-task.
- **MACH-04 (D-13..D-15):** same gsd-verifier, contrarian prompt header; 20% sampling; promote-to-PASS-WITH-GAPS on challenger-found concerns; auto-mode log-only on flip.
- **ERG-01 (D-16..D-18):** WR-01 narrow edge-guard catch, WR-02 JSDoc block at gates-registry, WR-03 treat SKILL.md as code.
- **ERG-02 (D-19..D-21):** bash installer patches `KNOWN_TOP_LEVEL` Set in cross-repo core.cjs.
- **Plans (D-22..D-24):** 6 plans, 4 waves (W1 parallel, W2/W3/W4 serial), Phase 12 verify.mjs with ≥8 invariants.

### Claude's Discretion
- Module internal structure (function boundaries, helper privates, JSDoc detail level).
- Exact bash patch technique in 12-06 (sed vs awk vs Node-in-bash — recommendation below).
- Exact invariant list in verify.mjs as long as ≥8 and all D-24 categories covered.
- MACH-03 85% oracle mechanism (see Implementation Risks §1).

### Deferred Ideas (OUT OF SCOPE)
See D-25 for the full list. Key: entropy-gated classifier, cross-session cache, per-task classifier, full-board contrarian, rate auto-tune, MUDA-linter.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MACH-01 | Classifier skip policy (per-plan cached verdict) | Q1 (sidecar module), integration site at SKILL.md:163-203 |
| MACH-02 | Parallel/sequential dispatch auto-detection | Q2 (dispatch-planner module), integration at SKILL.md:144-823 loop |
| MACH-03 | Checkpoint schema expansion + 85% hard cap | Q3 (template @ super-gsd/templates/checkpoint.md exists), 85% oracle design |
| MACH-04 | Adversarial verifier sampling | Q4 (contrarian prompt injection at SKILL.md Step 8 dispatch) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classifier verdict caching | Orchestrator lib (CJS module) | SKILL.md dispatch site | Module owns read/write; SKILL.md consumes |
| Dispatch DAG construction | Orchestrator lib (CJS module) | SKILL.md loop | Module owns topo-sort; SKILL.md iterates waves |
| Checkpoint schema | Orchestrator skill + template | — | Pure markdown contract; no new code module |
| Adversarial verifier | Orchestrator skill (prompt injection) | — | No new agent; prompt-only change |
| ATC warnings fix-ups | Existing lib CJS files + SKILL.md predicate | — | Pure surgical edits to Phase 10 outputs |
| Installer script | Cross-repo shell tool | — | Bash script; ships in super-gsd/scripts/ but operates on ~/.claude repo |
| Phase-level verify | Repo-root Node script | — | `.planning/phases/12-machinery/verify.mjs` matching Phase 10 pattern |

---

## Per-Question Findings

### Q1 — MACH-01 classifier-cache module shape (D-01..D-04)

**Verified facts:**
- Sidecar path template: `.planning/phases/{phase_dir}/plans/{NN-PP}.classifier.json`. Phase 10 & 11 both use `plans/` subdirectory. [VERIFIED: Glob on .planning/phases/10-gate-policy/plans/ and .planning/phases/11-plan-schema-v2/plans/]
- Classifier dispatch site: `super-gsd/skills/sgsd-orchestrate/SKILL.md:195` spawns `sgsd-classifier` (inside Step 2 block lines 163-203). SCHEMA-04 v2-synthesis path is at lines 166-186 (classifier_result built from frontmatter, no Agent spawn). v1 path is 188-203 (real Haiku dispatch).
- The `classifier_result` object shape (canonical from SKILL.md:176-184): `{complexity, model, atc_tier, deliberate, reason}`. MACH-01 must cache this exact shape.
- v2 plans already skip the classifier per SCHEMA-04 at line 170-186 — **MACH-01 only affects the v1 path**. For v2 plans, the synthesis is pure-function over frontmatter and has no cost to cache (it's already ~zero tokens). So MACH-01's practical effect: cache the Haiku-classifier verdict for v1 plans during execution of their multiple tasks.

**Recommended module API** (`super-gsd/scripts/lib/classifier-cache.cjs`, ~60 LOC):

```javascript
'use strict';
const fs   = require('fs');
const path = require('path');

/**
 * Classifier verdict sidecar cache (MACH-01).
 * Per-plan, mtime-invalidated. Scope: orchestrator run.
 *
 *   readCache(planFile)          → verdict | null
 *   writeCache(planFile, verdict)→ sidecar absolute path
 *   clearCache(planFile)         → void (called at plan completion)
 */

function sidecarFor(planFile) {
  const dir  = path.dirname(planFile);
  const base = path.basename(planFile, path.extname(planFile)); // '11-02-validator-cli'
  // D-02: cache key is the full plan id — extract the 'NN-PP' prefix
  const m = base.match(/^(\d{2}-\d{2})/);
  const planId = m ? m[1] : base;
  return path.join(dir, `${planId}.classifier.json`);
}

function readCache(planFile) {
  const side = sidecarFor(planFile);
  if (!fs.existsSync(side)) return null;
  const planStat = fs.statSync(planFile);
  const sideStat = fs.statSync(side);
  // D-03: cache stale if plan mtime > cache mtime
  if (planStat.mtimeMs > sideStat.mtimeMs) return null;
  const parsed = JSON.parse(fs.readFileSync(side, 'utf8'));
  return parsed.verdict || null;
}

function writeCache(planFile, verdict) {
  const side = sidecarFor(planFile);
  const body = {
    classified_at: new Date().toISOString(),
    verdict: verdict, // {complexity, model, atc_tier, deliberate, reason}
    plan_schema_version: 2 // or 1 — caller decides, Claude: pass frontmatter.schema_version ?? 1
  };
  fs.writeFileSync(side, JSON.stringify(body, null, 2));
  return side;
}

function clearCache(planFile) {
  const side = sidecarFor(planFile);
  if (fs.existsSync(side)) fs.unlinkSync(side);
}

module.exports = { readCache, writeCache, clearCache, sidecarFor };
```

**Integration edit at SKILL.md Step 2:**
Wrap the `FIRST: TaskCreate(...) / THEN: Agent(subagent_type: "sgsd-classifier", ...)` block (lines 190-202) with:

```
const cached = classifierCache.readCache(planFilePath);
if (cached) {
  classifier_result = cached;
  // Log cache-hit event (D-04)
  Append to .planning/metrics/token-log.jsonl:
    {"ts":"{ISO}","phase":N,"plan":P,"event":"classifier_skip","role":"classifier-skip","reason":"sidecar_hit","verdict":{cached}}
} else {
  // [existing FIRST/THEN/AFTER Haiku dispatch at lines 190-202]
  classifier_result = await agent_result;
  classifierCache.writeCache(planFilePath, classifier_result);
}
```

**Integration note:** the **v1 path** (lines 188-203) is the only path that dispatches a live classifier. Wrap only that branch. The v2 synthesis path (166-186) is already free.

**Cache-hit event for Phase 12 verify.mjs D-04 invariant:** planner must include `role: 'classifier-skip'` as the identifying token-log row field — query via `grep classifier_skip .planning/metrics/token-log.jsonl`.

[VERIFIED: super-gsd/skills/sgsd-orchestrate/SKILL.md:163-203]
[VERIFIED: super-gsd/templates/plan-schema-v2.json for schema_version enum]

---

### Q2 — MACH-02 dispatch-planner module shape (D-05..D-08)

**Verified facts:**
- No existing parallel-dispatch code in SKILL.md. Grep for `run_in_background` returned zero hits in the skill file. [VERIFIED: Grep]
- The current dispatch pattern is the `REPEAT` loop (SKILL.md:148-823). Each iteration picks ONE unit from dispatch rules (6.a-h, lines 277-285), dispatches ONE agent (Step 8, lines 669-697), processes ONE report (Step 9), commits, loops. It is **inherently serial.**
- MACH-02 is therefore a **new dispatch layer** that sits INSIDE a single iteration of the REPEAT loop at rule 6.e (line 282) when pending tasks exist. Instead of dispatching one `gsd-executor`, it asks `dispatch-planner` for a wave structure and fans out.
- Plan schema already has `depends_on` (plan-level, line 31) and `files_touched` (task-level, line 89) per plan-schema-v2.json.

**Recommended module API** (`super-gsd/scripts/lib/dispatch-planner.cjs`, ~80 LOC):

```javascript
'use strict';

/**
 * Build a dispatch plan from a v2 PLAN.md frontmatter (MACH-02).
 *
 *   buildDispatchPlan(plan) → [{wave: N, taskIds: [...], serial: bool}]
 *
 * Algorithm:
 *   1. v1 detection: if plan.schema_version !== 2, return [{wave:1, taskIds: all, serial:true}]
 *   2. Build task dependency edges:
 *        - explicit: task.depends_on → precedes task.id
 *        - implicit (D-05a): tasks with overlapping files_touched → precede in id-order
 *   3. Topo-sort into waves (Kahn's algorithm — tasks with no unresolved deps get wave N,
 *      remove them, repeat).
 *   4. Within each wave: serial=false IF all tasks in wave have disjoint files_touched
 *      AND no explicit depends_on among them; else serial=true (D-05a).
 */

function buildDispatchPlan(plan) {
  // v1 fallback (D-07)
  if (!plan || plan.schema_version !== 2 || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    const taskIds = (plan?.tasks || []).map(t => t.id);
    return [{ wave: 1, taskIds, serial: true }];
  }

  const tasks = plan.tasks;
  const byId  = Object.fromEntries(tasks.map(t => [t.id, t]));

  // Build predecessor map: taskId → Set<predecessorId>
  const preds = Object.fromEntries(tasks.map(t => [t.id, new Set()]));
  for (const t of tasks) {
    for (const dep of (t.depends_on || [])) {
      if (byId[dep]) preds[t.id].add(dep);
    }
  }
  // D-05a: implicit file-overlap dependency — earlier id in sorted-order precedes later
  const sorted = [...tasks].sort((a,b) => a.id.localeCompare(b.id));
  for (let i=0; i<sorted.length; i++) {
    for (let j=i+1; j<sorted.length; j++) {
      const ft_a = new Set(sorted[i].files_touched || []);
      const ft_b = sorted[j].files_touched || [];
      if (ft_b.some(f => ft_a.has(f))) {
        preds[sorted[j].id].add(sorted[i].id);
      }
    }
  }

  // Kahn's topo-sort into waves
  const waves = [];
  const done = new Set();
  const remaining = new Set(tasks.map(t => t.id));
  let waveNum = 1;
  while (remaining.size > 0) {
    const layer = [...remaining].filter(id =>
      [...preds[id]].every(p => done.has(p))
    );
    if (layer.length === 0) {
      // Cycle detected — dump remainder as a single serial wave
      waves.push({ wave: waveNum, taskIds: [...remaining], serial: true, cycle: true });
      break;
    }
    // D-05a: serial=false only if ALL pairwise disjoint + no explicit depends_on among them
    const layerTasks = layer.map(id => byId[id]);
    const serial = hasInternalConflict(layerTasks);
    waves.push({ wave: waveNum, taskIds: layer.sort(), serial });
    for (const id of layer) { done.add(id); remaining.delete(id); }
    waveNum++;
  }
  return waves;
}

function hasInternalConflict(tasks) {
  for (let i=0; i<tasks.length; i++) {
    const ft_i = new Set(tasks[i].files_touched || []);
    for (let j=i+1; j<tasks.length; j++) {
      const ft_j = tasks[j].files_touched || [];
      if (ft_j.some(f => ft_i.has(f))) return true;
      if ((tasks[j].depends_on || []).includes(tasks[i].id)) return true;
    }
  }
  return false;
}

module.exports = { buildDispatchPlan };
```

**Integration edit at SKILL.md dispatch rule 6.e:**
Replace the single-task dispatch at line 282 (`Phase has checked plans, pending tasks → run PLAN LOAD-TIME VALIDATION (Step 6.2) then dispatch gsd-executor (Sonnet)`) with a wave-aware variant:

```
e. Phase has checked plans, pending tasks → run PLAN LOAD-TIME VALIDATION (Step 6.2),
   then dispatch per MACH-02 wave plan:

   const waves = dispatchPlanner.buildDispatchPlan(plan);
   for (const w of waves) {
     if (w.serial || w.taskIds.length === 1) {
       for (const taskId of w.taskIds) {
         // existing single gsd-executor dispatch pattern
       }
     } else {
       // Parallel wave: fan out Task() with run_in_background
       const handles = w.taskIds.map(taskId => TaskCreate(...) + Agent(... run_in_background: true ...));
       // Await all handles; gather reports
       const reports = await Promise.all(handles);
       // D-08: if any report has BLOCKER, halt after remaining tasks settle
     }
   }
```

**Failure semantics note (D-08):** "Does not cancel in-flight agents (no cancellation protocol for Task())" — the planner should surface this as a LITE-tier edge case, not a blocker. It's a known limitation of the Task harness.

[VERIFIED: super-gsd/tools/plan-schema/plan-schema-v2.json:31,89 for depends_on + files_touched]
[VERIFIED: super-gsd/skills/sgsd-orchestrate/SKILL.md:277-285 for dispatch rules]
[VERIFIED: Grep for `run_in_background` in SKILL.md — zero hits]

---

### Q3 — MACH-03 checkpoint schema (D-09..D-12)

**Verified facts:**
- `super-gsd/templates/checkpoint.md` **exists already** (~30 lines). [VERIFIED: Read]
- Current schema has: `created_at, active_milestone, active_phase, last_completed, next_unit, phase_state, units_this_session, estimated_tokens_used, model_breakdown, context_percent_at_write, resume_instruction`.
- **Three new fields must be added** per D-09: `approaches_tried_and_abandoned: []`, `rules_learned_this_session: []`, `dispatches_summary: {total, by_agent, by_outcome}`.
- The existing field `context_percent_at_write: {N}` already implies a detection mechanism. [VERIFIED: super-gsd/templates/checkpoint.md:14]
- SKILL.md references 70% threshold in 4 places (lines 30, 161, 960, 1023). None is mechanical — all are operator/agent judgment calls at present.

**The 85% hard cap oracle problem (D-11):**
D-11 says "context >= 85% forces checkpoint mid-task." There is currently no explicit context-% oracle in SKILL.md — the 70% threshold is implicit (agent self-awareness). Two plausible mechanisms:

| Option | Mechanism | Cost | Accuracy |
|--------|-----------|------|----------|
| A (recommended) | Keep "agent self-reports its own context use, hard cap at 85%" — document in SKILL.md as an **explicit instruction** matching the 70% convention | 0 tokens | Same as current 70% trigger — i.e. self-report-honest |
| B | Derive from token-log.jsonl — sum `total` across current session and divide by model max-context estimate | ~20 tokens per loop to tally | More mechanical but still approximate (token-log is post-dispatch, lags real context) |

**Recommendation: Option A.** The 70% trigger is already self-report; the 85% trigger extends the same convention. No need to invent an oracle — the planner should add explicit text to SKILL.md's Step 1 (READ STATE):

> *Before proceeding to Step 2, self-assess context use. If ≥85%, write emergency checkpoint with `emergency_halt: true` and exit (see checkpoint_protocol §Emergency). If ≥70% AND (plan_boundary OR phase_boundary), write normal checkpoint. Otherwise continue.*

**Recommended checkpoint.md additions (append after line 15, before `resume_instruction`):**

```yaml
emergency_halt: false   # set true only if the 85% hard-cap fired mid-task (D-11)
approaches_tried_and_abandoned: []
  # each entry: {approach: "...", why_abandoned: "...", artifact_refs: [...]}
rules_learned_this_session: []
  # each entry: {rule: "...", context: "...", curated_to: ".brv/..."}
dispatches_summary:
  total: 0
  by_agent:
    executor: 0
    verifier: 0
    planner: 0
    researcher: 0
    classifier: 0
    code_reviewer: 0
  by_outcome:
    pass: 0
    fail: 0
    warn: 0
    blocker: 0
```

**Integration edit at SKILL.md `<checkpoint_protocol>` (lines 959-989):**
Extend the YAML block at lines 964-974 to include the three new fields. Extend the prose at line 960 to read "When context ≥85% OR ((phase_boundary OR plan_boundary) AND context ≥70%) OR user says stop" (D-10).

Add an "Emergency halt path" subsection: when 85% fires, the checkpoint is written with `emergency_halt: true`, a DEVIATIONS row is logged per D-11 steps 1-3.

**D-11a feedback loop:** planner should note that the emergency_halt→curate-on-≥10%-milestone-rate logic is cheap to specify but lives at milestone close, not in-loop. Safe to defer the actual counter logic to Phase 13/14 — D-11a only requires writing the `emergency_halt: true` marker so a future tool can count them.

[VERIFIED: super-gsd/templates/checkpoint.md exists @ lines 1-30]
[VERIFIED: SKILL.md 70%-trigger grep hits at 30,161,960,1023 — none mechanical]

---

### Q4 — MACH-04 adversarial verifier (D-13..D-15)

**Verified facts:**
- `gsd-verifier` is dispatched via the generic Step 8 pattern (SKILL.md:669-697). No verifier-specific block exists in the skill — it flows through dispatch rule 6.f (line 283).
- Current verifier verdict parsing: Step 9 (lines 699-717). Report sections are the canonical 6: FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER.
- The `STATUS:` header line mentioned in CONTEXT D-13b is the verifier's own convention (PASS | PASS-WITH-DEVIATIONS | FAIL). [CITED: D-13b] — The planner should confirm this by checking the gsd-verifier agent definition; if absent, Phase 12 adds it to the verifier's output contract.
- There is NO existing composable prompt-injection helper. The intent-injection at Step 5.5 (lines 241-274) is the closest precedent — it prepends an `<intent>` block verbatim.

**Recommended approach:**

After rule 6.f returns (verifier report parsed at Step 9), insert a new Step 9.6 immediately after Step 9.5 (per-dispatch ATC, lines 745-795):

```
9.6. ADVERSARIAL VERIFIER CHALLENGER PASS (MACH-04, D-13..D-15)
     Fires only when:
       - step 6.f completed (i.e., this iteration dispatched gsd-verifier)
       - verifier report STATUS in {PASS, PASS-WITH-DEVIATIONS}
       - Math.random() < config.atc.verifier_adversarial_rate  (default 0.2 — D-14)

     If gate fires:
       a. TaskCreate({content: "Phase {N} adversarial challenger", activeForm: "gsd-verifier [sonnet] P{N} — contrarian pass"})
       b. Compose prompt: prepend the ADVERSARIAL CHALLENGER PASS header (D-13a)
          verbatim to the same prompt used for the primary verifier dispatch.
       c. Agent(subagent_type: "gsd-verifier", model: "sonnet", mode: "auto", prompt: {above})
       d. Parse challenger STATUS:
            PASS                → log verifier_adversarial_agreement:true to .planning/metrics/token-log.jsonl
            PASS-WITH-GAPS      → promote phase verdict to PASS-WITH-GAPS; append challenger findings to {NN}-VERIFICATION.md as `## Adversarial Challenge` section
            FAIL (flip)         → auto mode: log VERIFIER_ADVERSARIAL_FLIP as CRITICAL in DEVIATIONS, append challenger report, continue (never auto-block — D-13b)
                                  interactive mode: STOP with blocker for operator arbitration
       e. TaskUpdate(same taskId, status: "completed")
```

**Prompt composition pattern** (matches DLB-03 structural injection style from lines 256-262):

```
const challengerPrompt =
  `ADVERSARIAL CHALLENGER PASS — the primary verifier returned PASS. You are challenging that verdict. Assume the primary verifier missed something. List the top 3 ways this phase might silently fail despite the PASS. Focus on: cross-plan integration gaps the primary verifier didn't exercise, assumptions baked into plan contracts that weren't proven in execution, invariants that are mechanically true but semantically vacuous.\n\n` +
  primaryVerifierPrompt;
```

**Config addition (D-14):** append to `.planning/config.json` under `atc`:

```json
"atc": {
  ...,
  "verifier_adversarial_rate": 0.2
}
```

**Invariant for verify.mjs:** `grep "verifier_adversarial_rate"` in config.json returns ≥1 match AND value is numeric in [0,1].

[VERIFIED: SKILL.md:669-697 generic dispatch, lines 699-717 result parsing]
[VERIFIED: SKILL.md:241-274 intent-injection precedent for prompt composition]
[VERIFIED: .planning/config.json atc block lines 68-77]

---

### Q5 — ERG-01 WR-01 fix (edge-guard.cjs:83)

**Verified facts:**
- Current code at `super-gsd/scripts/lib/edge-guard.cjs:78-86`:
  ```javascript
  if (gateName && gatesYamlPath) {
    try {
      const gate = getGate(gateName, gatesYamlPath);
      if (gate && gate.escalation === 'halt') {
        escalation = 'halt';
      }
    } catch (_) {
      // gate not found or registry error — fall back to log-only (defensive)
    }
  }
  ```
- `getGate` in `gates-registry.cjs:59-64` throws with message `` `gate '${name}' not in registry` `` (line 62). This is the **only** error this function produces; all other errors (ENOENT on the YAML path, YAML parse errors) come from the underlying `loadGates` call.
- WR-01's recommended fix (from 10-ATC-REVIEW.md:61-71) is already the right shape:

**Exact fix:**

```javascript
if (gateName && gatesYamlPath) {
  try {
    const gate = getGate(gateName, gatesYamlPath);
    if (gate && gate.escalation === 'halt') {
      escalation = 'halt';
    }
  } catch (err) {
    // Narrow: only swallow "gate name not in registry" — rethrow registry errors
    if (!err.message.startsWith("gate '")) throw err;
    // gate not found → fall back to log-only (registry may not have this name)
  }
}
```

**Why this works:** `gates-registry.cjs:62` throws `gate '${name}' not in registry` — the message always starts with `gate '`. ENOENT on the YAML path is thrown BEFORE getGate runs (in `loadGates`) with a different message shape. js-yaml parse errors likewise have distinct messages. Any non-"gate '..." error is legitimately a bug that must surface.

**No type changes needed to `getGate`.** The existing string-prefix discriminator is sufficient. A purer refactor (introducing a `GateNotFoundError` class) is LOW-value and high-churn — don't do it.

[VERIFIED: super-gsd/scripts/lib/gates-registry.cjs:62]
[VERIFIED: super-gsd/scripts/lib/edge-guard.cjs:78-86]

---

### Q6 — ERG-01 WR-02 fix (gates-registry.cjs:23)

**Verified facts:**
- Current code at `super-gsd/scripts/lib/gates-registry.cjs:23`: `let _cache = null; // { all: Gate[], byName: Record<string,Gate> }`.
- The file already has JSDoc conventions in place — see lines 3-17 (module-level block comment) and 25-31 (`loadGates` JSDoc). Style: `/** ... */` multi-line with `@param`/`@returns` tags.
- WR-02 (from 10-ATC-REVIEW.md:76-80) specifies the exact warning text to add.

**Exact insertion (replace line 23 with):**

```javascript
/**
 * WARNING — module-level cache is a PROCESS SINGLETON.
 * Tests MUST call resetCache() in afterEach() to avoid pollution.
 * Long-running processes that hot-swap gates.yaml MUST call resetCache()
 * after the file mtime changes (or after a SIGHUP equivalent).
 */
let _cache = null; // { all: Gate[], byName: Record<string,Gate> }
```

**JSDoc style match:** the block at lines 3-17 uses the same multi-line `/** */` with prose content (no tags) — this fits. [VERIFIED: super-gsd/scripts/lib/gates-registry.cjs:3-17]

---

### Q7 — ERG-01 WR-03 fix (SKILL.md:731-733)

**Verified facts:**
- Current code at SKILL.md:729-734:
  ```javascript
  files_changed_count:      filesChanged.length,
  code_files_changed_count: filesChanged.filter(f =>
    !f.endsWith('.md') && !f.startsWith('.planning/')
  ).length,
  diff_lines:               parseDiffLines(),
  ```
- WR-03 says: a commit that only touches `super-gsd/skills/sgsd-orchestrate/SKILL.md` currently produces `code_files_changed_count: 0`, making the `per-dispatch-ATC` gate miss the dispatch.

**Exact fix — narrow the .md exclusion:**

```javascript
files_changed_count:      filesChanged.length,
code_files_changed_count: filesChanged.filter(f => {
  // Exclude planning tree in full (.planning/**)
  if (f.startsWith('.planning/')) return false;
  // Treat skill files as code — SKILL.md IS orchestrator logic (D-18, WR-03)
  if (/^super-gsd\/skills\/[^/]+\/SKILL\.md$/.test(f)) return true;
  // Exclude other .md files (docs, READMEs, plan summaries)
  if (f.endsWith('.md')) return false;
  return true;
}).length,
diff_lines:               parseDiffLines(),
```

**Why a regex vs a string prefix:**
- Substring match (`f.includes('super-gsd/skills/')`) would false-positive on any `.md` file under that subtree (e.g. skill READMEs if introduced).
- The regex `^super-gsd/skills/[^/]+/SKILL\.md$` pins to the exact skill-file pattern only.
- If in future `AGENTS.md` or other skill-local canon files need inclusion, add a second regex in the positive branch. For now, SKILL.md is the only file the ATC review wants treated as code.

**Cross-platform path note:** predicate-eval.cjs runs on Node on Windows/Mac/Linux, but git diff paths use forward slashes on all platforms. The regex as written is safe.

[VERIFIED: super-gsd/skills/sgsd-orchestrate/SKILL.md:729-734]
[VERIFIED: 10-ATC-REVIEW.md WR-03 lines 83-88]

---

### Q8 — ERG-02 installer script shape (D-19..D-21)

**Verified facts about the patch target:**
- File: `C:/Users/user/.claude/get-shit-done/bin/lib/core.cjs:322-331`. [VERIFIED: grep]
- Current code:
  ```javascript
  const KNOWN_TOP_LEVEL = new Set([
    // Extract top-level key names from dot-notation paths (e.g., 'workflow.research' → 'workflow')
    ...[...VALID_CONFIG_KEYS].map(k => k.split('.')[0]),
    // Section containers that hold nested sub-keys
    'git', 'workflow', 'planning', 'hooks', 'features',
    // Internal keys loadConfig reads but config-set doesn't expose
    'model_overrides', 'agent_skills', 'context_window', 'resolve_model_ids', 'claude_md_path',
    // Deprecated keys (still accepted for migration, not in config-set)
    'depth', 'multiRepo',
  ]);
  ```
- The 7 CONTEXT-required keys (`safety`, `model_routing`, `token_efficiency`, `deliberation`, `atc`, `browser_verify`, `overwatcher`) are top-level containers present in `.planning/config.json` but NOT in `VALID_CONFIG_KEYS` (config.cjs:14) as dot-prefixed keys, so they don't get auto-included and they aren't in the hardcoded second line. [VERIFIED: grep on both files]
- Target insertion point: line 326 — after `'git', 'workflow', 'planning', 'hooks', 'features',` append `'safety', 'model_routing', 'token_efficiency', 'deliberation', 'atc', 'browser_verify', 'overwatcher',`.
- `.planning/config.json` confirms these are the 7 containers currently emitting warnings. [VERIFIED: Read lines 21,36,47,55,68,78,107]
- Cross-repo location: the file is in `C:/Users/user/.claude/` which is a separate git repo per `.planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml`. The GSDedits executor MUST NOT commit there.

**Recommended patch technique: Node-in-bash (not sed/awk).**

Rationale:
- sed portability across BSD sed (mac) and GNU sed (linux/WSL) is painful — `-i` flag differs, escape rules differ, multiline matching is finicky.
- awk would work but the Set initializer spans multiple lines; block-match in awk is awkward.
- Node is **already a dependency** (core.cjs is a Node file — node must be available to run it). Running a tiny Node patcher from bash avoids shell-portability pain and lets us use JS string replacement with exact indentation.

**Recommended script** (`super-gsd/scripts/patch-gsd-tools-known-keys.sh`, ~80 lines):

```bash
#!/usr/bin/env bash
# ERG-02 — Patch KNOWN_TOP_LEVEL in gsd-tools core.cjs so SGSD v2 config keys
# (safety, model_routing, token_efficiency, deliberation, atc, browser_verify,
#  overwatcher) stop emitting "unknown config key" warnings.
#
# Idempotent: running twice is a no-op. Cross-platform (WSL/mac/linux).
set -euo pipefail

DRY_RUN=false
AUTO_YES=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -y|--yes)  AUTO_YES=true ;;
    -h|--help)
      cat <<'EOF'
Usage: patch-gsd-tools-known-keys.sh [--dry-run] [-y|--yes]
  --dry-run   Show diff; do not write
  -y --yes    Skip confirmation prompt
EOF
      exit 0
      ;;
  esac
done

# 1. Locate core.cjs
if command -v gsd-tools >/dev/null 2>&1; then
  BIN_PATH=$(command -v gsd-tools)
  CORE_CJS="$(dirname "$BIN_PATH")/lib/core.cjs"
else
  CORE_CJS="$HOME/.claude/get-shit-done/bin/lib/core.cjs"
fi

if [[ ! -f "$CORE_CJS" ]]; then
  echo "ERROR: core.cjs not found at $CORE_CJS" >&2
  exit 1
fi
echo "Target: $CORE_CJS"

# 2. Check cross-repo status
CORE_DIR=$(dirname "$CORE_CJS")
if TOP=$(git -C "$CORE_DIR" rev-parse --show-toplevel 2>/dev/null); then
  if [[ "$(basename "$TOP")" != "GSDedits" ]]; then
    echo "NOTE: core.cjs lives in a separate git repo at $TOP"
    echo "      Patch will be applied but not auto-committed there."
  fi
fi

# 3. Idempotency check + patch — via Node for reliability
NEW_KEYS=(safety model_routing token_efficiency deliberation atc browser_verify overwatcher)
NODE_SCRIPT=$(cat <<'NODEEOF'
const fs = require('fs');
const path = process.argv[2];
const wantedKeys = process.argv[3].split(',');
const src = fs.readFileSync(path, 'utf8');

// Idempotency — are all 7 keys already present in the Set?
const allPresent = wantedKeys.every(k => {
  const re = new RegExp(`['"]${k}['"]`);
  return re.test(src);
});
if (allPresent) { console.log('ALREADY_PATCHED'); process.exit(0); }

// Find the line with 'git', 'workflow', 'planning', 'hooks', 'features',
const anchorRe = /^(\s*)('git', 'workflow', 'planning', 'hooks', 'features',)(\s*)$/m;
const m = src.match(anchorRe);
if (!m) {
  console.error('ANCHOR_NOT_FOUND'); process.exit(2);
}
const indent = m[1];
const newLine = `${indent}${m[2]}\n${indent}${wantedKeys.map(k => `'${k}'`).join(', ')},`;
const patched = src.replace(anchorRe, newLine);

if (process.argv[4] === '--dry-run') {
  // Emit a unified-ish diff preview
  console.log('PREVIEW');
  console.log('--- old');
  console.log(m[0]);
  console.log('+++ new');
  console.log(newLine);
  process.exit(0);
}
fs.writeFileSync(path + '.bak', src);
fs.writeFileSync(path, patched);
console.log('PATCHED');
NODEEOF
)

RESULT=$(node -e "$NODE_SCRIPT" -- "$CORE_CJS" "$(IFS=,; echo "${NEW_KEYS[*]}")" "$([ "$DRY_RUN" = true ] && echo --dry-run || true)")

case "$RESULT" in
  ALREADY_PATCHED*) echo "PASS: KNOWN_TOP_LEVEL already contains all 7 keys"; exit 0 ;;
  PREVIEW*)         echo "$RESULT"; exit 0 ;;
  PATCHED*)         echo "OK: patched (backup at $CORE_CJS.bak)" ;;
  ANCHOR_NOT_FOUND) echo "ERROR: expected anchor line not found in $CORE_CJS" >&2; exit 2 ;;
  *)                echo "ERROR: unexpected result: $RESULT" >&2; exit 3 ;;
esac

# 4. Verify post-patch
node -e "
const src = require('fs').readFileSync('$CORE_CJS','utf8');
const need = ['safety','model_routing','token_efficiency','deliberation','atc','browser_verify','overwatcher'];
const missing = need.filter(k => !new RegExp(\"['\\\"]\"+k+\"['\\\"]\").test(src));
if (missing.length) { console.error('POST-VERIFY FAIL: missing '+missing.join(',')); process.exit(1); }
console.log('POST-VERIFY PASS: all 7 keys present');
"

echo "If core.cjs is in a separate git repo, remember to: cd $CORE_DIR && git add lib/core.cjs && git commit -m 'feat: add SGSD v2 top-level keys to KNOWN_TOP_LEVEL'"
```

**Idempotency contract (D-20):** first run emits `PATCHED`; second run emits `PASS: KNOWN_TOP_LEVEL already contains all 7 keys` with exit 0. The verify.mjs invariant for D-24 runs the script twice; both exits must be 0 and the diff between the two must be zero (no `.bak` creation on second run).

**Portability note:** the script uses `bash` (not sh). WSL, macOS, and Linux all have bash. The Node patcher works because node is already a dependency (core.cjs IS a node file).

**Documentation (D-21):** add a 10-line section to `super-gsd/README.md` (or create `super-gsd/docs/INSTALL-NOTES.md`) titled "Post-install: patch gsd-tools KNOWN_TOP_LEVEL" with the invocation and the "separate-repo commit reminder."

[VERIFIED: `~/.claude/get-shit-done/bin/lib/core.cjs:322-331`]
[VERIFIED: `~/.claude/get-shit-done/bin/lib/config.cjs:14` — VALID_CONFIG_KEYS Set definition]
[VERIFIED: `.planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml` — cross-repo status]
[VERIFIED: `.planning/config.json` — 7 top-level keys present: safety@21, model_routing@36, token_efficiency@47, deliberation@55, atc@68, browser_verify@78, overwatcher@107]

---

### Q9 — Phase 12 verify.mjs invariants (D-24)

**Recommended ≥10 invariants** (follows Phase 10 verify.mjs pattern — exit code = failing invariant number):

| # | Invariant | Check |
|---|-----------|-------|
| 1 | `super-gsd/scripts/lib/classifier-cache.cjs` parses and exports `{readCache, writeCache, clearCache, sidecarFor}` | `require()` then `typeof fn === 'function'` ×4 |
| 2 | classifier-cache sidecar schema is valid JSON when written | `writeCache` tmp-path round-trip: readback JSON.parse → assert shape `{classified_at, verdict, plan_schema_version}` |
| 3 | `super-gsd/scripts/lib/dispatch-planner.cjs` parses and exports `buildDispatchPlan` | require + typeof |
| 4 | dispatch-planner builds non-cyclic wave plan for fixture v2 plan | feed minimal test plan → assert waves[].wave are ascending integers + no repeated taskIds |
| 5 | dispatch-planner v1 fallback returns single serial wave | feed `{schema_version:1, tasks:[{id:'a'},{id:'b'}]}` → expect `[{wave:1, taskIds:['a','b'], serial:true}]` |
| 6 | checkpoint template has 3 new D-09 fields | grep `super-gsd/templates/checkpoint.md` for `approaches_tried_and_abandoned`, `rules_learned_this_session`, `dispatches_summary` (all 3 must match) |
| 7 | SKILL.md mentions the 85% hard-cap instruction | grep `super-gsd/skills/sgsd-orchestrate/SKILL.md` for `85%` — must be ≥1 match (current state: zero per grep; green after 12-03) |
| 8 | `config.atc.verifier_adversarial_rate` is present AND in [0,1] | JSON.parse config.json → assert numeric |
| 9 | WR-01 fix landed: edge-guard.cjs:78-90 has narrow catch (string-prefix discriminator) | grep for `err.message.startsWith("gate '")` in edge-guard.cjs |
| 10 | WR-02 fix landed: JSDoc block present above `let _cache = null` in gates-registry.cjs | grep `PROCESS SINGLETON` in gates-registry.cjs lines 1-30 |
| 11 | WR-03 fix landed: code_files_changed_count logic in SKILL.md treats skill-SKILL.md as code | grep `super-gsd/skills/[^/]+/SKILL\.md` in SKILL.md Step 9.2 region |
| 12 | `super-gsd/scripts/patch-gsd-tools-known-keys.sh` exists, is executable, parses via `bash -n` | `fs.accessSync(x, fs.constants.X_OK)` + `execSync('bash -n PATH')` |
| 13 | Patch script is idempotent: two successive runs both exit 0, second produces no diff | execSync twice on a fixture core.cjs copy; assert exit 0, assert hash-equal after |
| 14 | `.planning/metrics/token-log.jsonl` contains at least one `role: classifier-skip` event | grep `classifier_skip` (green after Phase 12 first runs with a v1 plan having ≥2 tasks) — **EXPECTED RED** until a v1 plan executes post-landing; gate the invariant on `if milestone has completed a v1 plan, assert ≥1 row`. For strict verify-green, mark this as WARN-only or defer to Phase 13 smoke. |

**Invariant #14 is the D-04 accounting check.** Planner must decide: **make it a hard invariant** (and then arrange a test fixture that exercises the classifier-skip code path in CI), **or** demote it to warn-with-expected-green-at-milestone-close. Recommendation: make it **soft-warn** in verify.mjs (exit 0 even if zero rows, but log a WARN line) — matches the pattern Phase 10 uses for invariants 7/8 that are "expected red during Wave 1." Plan 12-01 can provide a test fixture script.

**Pattern to copy:** `.planning/phases/10-gate-policy/verify.mjs:20-118` — same Node-ESM imports, same `fail(n,msg)` helper, same exit code convention.

[VERIFIED: .planning/phases/10-gate-policy/verify.mjs lines 1-118]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node builtin `assert` + `child_process.execSync`; js-yaml pinned at `super-gsd/tools/plan-schema/node_modules/js-yaml` |
| Config file | None — invariants inline in `verify.mjs` per phase |
| Quick run command | `node .planning/phases/12-machinery/verify.mjs` |
| Full suite command | `node .planning/phases/09-atc-147-evidence/verify.mjs && node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/12-machinery/verify.mjs` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Command | File |
|-----|----------|-----------|---------|------|
| MACH-01 | Classifier cache reads + writes + invalidates on mtime | unit (inline in verify.mjs #1,#2) | `node verify.mjs` | existing |
| MACH-02 | DAG build for v2 + v1 fallback | unit (inline #3,#4,#5) | same | existing |
| MACH-03 | Checkpoint template has 3 fields; 85% instruction in SKILL.md | integration grep (#6,#7) | same | existing |
| MACH-04 | config.atc.verifier_adversarial_rate exists in [0,1] | config check (#8) | same | existing |
| ERG-01 WR-01 | edge-guard narrow catch | grep (#9) | same | existing |
| ERG-01 WR-02 | gates-registry JSDoc | grep (#10) | same | existing |
| ERG-01 WR-03 | SKILL.md skill-SKILL.md treated as code | grep (#11) | same | existing |
| ERG-02 | Patch script exists, idempotent | exec-twice (#12,#13) | same | existing |
| D-04 soft | classifier-skip event in token-log | grep soft-warn (#14) | same | existing |

### Sampling Rate
- **Per task commit:** `node verify.mjs` (each Phase 12 plan commits stage-and-run)
- **Per wave merge:** full suite command
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No new framework install — all dependencies already pinned (js-yaml via plan-schema tools)
- [ ] Phase 12 verify.mjs MUST import fixtures from somewhere testable — recommend inline fixtures rather than separate files (matches Phase 10 pattern: invariant 7 uses execSync on a real sibling file, not a fixture dir).

---

## Implementation Risks

### Risk 1 — MACH-03 85% oracle has no mechanical detector (MEDIUM)

**What can go wrong:** the 85% hard-cap is specified but there's no concrete "what returns a number" source. Agent self-report is how 70% already works, but 85% is an *emergency* trigger — relying on self-report at the moment of runaway growth is the exact moment self-report is least reliable.

**Mitigation:** Plan 12-03 SHOULD include a LITE sub-task that extends `.planning/metrics/token-log.jsonl` accumulator logic to surface a running total, with 85% being "sum-this-session ≥ 170k tokens for 200k-context Sonnet" as a concrete threshold. This is ~20 LOC in a new `super-gsd/scripts/lib/context-gauge.cjs` helper. If scope is tight, fall back to Option A (self-report at 85% same as 70%).

**Planner flag:** surface this as a 12-03 sub-decision; do not re-open the phase discuss.

### Risk 2 — Plan-level dispatch in MACH-02 requires Task() parallelism that doesn't exist yet (LOW-MEDIUM)

**What can go wrong:** SKILL.md currently has zero `run_in_background` usage (verified). Fanning out `Agent()` calls with `run_in_background: true` is a harness capability Claude Code already provides for the `Bash` tool, but the contract for `Agent()` is less tested in this codebase. D-08 acknowledges no cancellation — that's OK — but "await all parallel tasks then harvest reports" needs the harness to actually resolve each Agent() call concurrently.

**Mitigation:** Plan 12-02 first task should be a **spike** that verifies Agent() fan-out works as expected. If not, fall back to serialized wave execution (the DAG is still useful — dispatch-planner.cjs becomes advisory, serial execution still happens in wave-order, so parallel benefit is deferred but no feature breaks).

**Planner flag:** this is a planner concern, not a research concern. Document clearly in 12-02 plan hypothesis.

### Risk 3 — MACH-02 may race with per-dispatch ATC (Step 9.5) (LOW)

**What can go wrong:** per-dispatch ATC (SKILL.md Step 9.5) currently runs serially after each executor dispatch. If MACH-02 fans out 3 parallel executors, does each pay its own ATC or do they batch? D-05/D-06 doesn't specify.

**Mitigation:** document in plan 12-02 that parallel executor wave → each executor's report gets its own ATC review, sequentially after the parallel wave settles. Matches Phase 10's existing amortized boundary semantics (ATC is per-report, not per-batch). This is a clarification, not a scope change.

### Risk 4 — ERG-02 installer could corrupt core.cjs on edge-case bracket/quote mismatch (LOW)

**What can go wrong:** the node-patcher regex `^(\s*)('git', 'workflow', 'planning', 'hooks', 'features',)(\s*)$` is exact-match. If core.cjs is updated upstream (e.g., a new key `observability` is inserted in that line), the anchor won't match. Also the `.bak` backup + recoverability path matters.

**Mitigation:** the script exits with `ANCHOR_NOT_FOUND` (code 2) when the anchor line is absent — this is the correct failure mode. Operator sees a specific error and can hand-apply. The script writes `.bak` before touching the file so rollback is `mv core.cjs.bak core.cjs`. Verify.mjs invariant #13 runs the script on a throwaway fixture, not the real file, so no risk of CI corruption.

### Risk 5 — Challenger verifier at 0.2 rate may never fire during Phase 12 itself (LOW)

**What can go wrong:** Phase 12 ships MACH-04 with `verifier_adversarial_rate: 0.2`. During Phase 12's own verifier dispatch (the one that checks Phase 12 is complete), the challenger has a 20% chance of firing. If it doesn't fire, there is NO mechanical proof the challenger path works. Verify.mjs invariant #14 (classifier-skip row) has the same "proof by usage" issue.

**Mitigation:** verify.mjs invariant #8 only checks **config presence and shape**, not that a challenger has ever fired. Treat "actually fired once" as a milestone-close concern (Phase 13 dashboard can audit). Alternatively, a LITE-scope additional task could force `verifier_adversarial_rate: 1.0` for Phase 12's own verifier pass (one-shot demonstration) — not required by CONTEXT, suggest planner leave at 0.2.

---

## Recommended Plan Decomposition

**D-22 (6 plans) is correct as specified.** No change.

**D-23 (wave model) is correct as specified with one caveat.** The wave serialization of 12-02/03/04 is honest — all three touch SKILL.md in different sections but collisions in the same file are still merge-risk. Serializing is the right call per Phase 10 W-2 lesson.

**D-23a Wave 1 parallelism claim is verified:**

| Plan | Files touched | Wave 1 peers? |
|------|---------------|----------------|
| 12-01 | (NEW) `super-gsd/scripts/lib/classifier-cache.cjs` + SKILL.md:163-203 | edits Step 2 block |
| 12-05 | `super-gsd/scripts/lib/edge-guard.cjs` + `super-gsd/scripts/lib/gates-registry.cjs` + SKILL.md:729-734 | edits Step 9.2 block (different from 12-01's Step 2) |
| 12-06 | (NEW) `super-gsd/scripts/patch-gsd-tools-known-keys.sh` + `super-gsd/README.md` | no SKILL.md edit at all |

**Conflict check:**
- 12-01 + 12-05 both touch SKILL.md BUT in **disjoint sections** (Step 2 @ 163-203 vs. Step 9.2 @ 729-734). Git will merge cleanly. [VERIFIED: line ranges]
- 12-06 touches zero shared files with 12-01 or 12-05.
- **Conclusion: Wave 1 parallel is genuine.** D-23a stands.

**Serialization in Waves 2-4 is correct:**
- 12-02 touches SKILL.md dispatch rule at line 282 AND adds fan-out code inside the loop at lines 144-823. Large surgical area.
- 12-03 touches SKILL.md checkpoint_protocol at 959-989 + 70% trigger sites at 30, 161, 1023, PLUS the template at super-gsd/templates/checkpoint.md.
- 12-04 touches SKILL.md (new Step 9.6 after 795) AND config.json.

All three overlap on SKILL.md structure — serialize per D-23.

**D-24 verify.mjs ≥8 invariants: recommend 11 + 3 soft.** See Q9 table.

**One suggested refinement (not a revision to D-22/23):** the planner should sequence **12-03 before 12-04** within the serial chain. Reason: MACH-03's new `dispatches_summary.by_outcome` field includes `warn` — and MACH-04's challenger PASS-WITH-GAPS adds a `warn`-class outcome. If 12-04 lands first, the checkpoint schema drifts against the challenger pathway. Ordering 12-03 → 12-04 keeps the dispatches_summary schema authoritative by the time challenger results need to be counted.

D-23 already has 12-03 as Wave 3 and 12-04 as Wave 4, so this is preserved — flagged here as the *rationale* for that ordering.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Agent() in the Task harness supports genuine parallel fan-out when called with `run_in_background: true`-equivalent semantics | Q2 / Risk 2 | MACH-02 degrades to serial in practice; feature ships but savings zero. Test in 12-02 first task. |
| A2 | The `STATUS: PASS-WITH-GAPS` verdict vocabulary already exists in gsd-verifier output contract (or can be added by Phase 12-04 without a cascading agent rewrite) | Q4 | Planner must confirm by reading the gsd-verifier agent file; if absent, Phase 12-04 adds it to the verifier's output contract (one-line addition, LITE scope). [ASSUMED — not directly verified in this research session; verifier agent file not read] |
| A3 | 85% context detection via agent self-report is acceptable (same mechanism as 70%) | Q3 / Risk 1 | Emergency halt may miss; Risk 1 mitigation applies. |
| A4 | The 7 KNOWN_TOP_LEVEL keys (`safety, model_routing, token_efficiency, deliberation, atc, browser_verify, overwatcher`) are genuinely all container keys currently emitting warnings | Q8 | Verified in .planning/config.json. If any key is a dot-notation entry in VALID_CONFIG_KEYS (not observed), it'd be a no-op — no harm. |
| A5 | The Phase 10 verify.mjs exit-code-per-invariant convention is the right pattern for Phase 12 | Q9 | Low risk — it's the established convention. Re-use as-is. |

**If this table requires user confirmation:** only A2 warrants a look. Recommendation: planner spends 30 seconds reading `super-gsd/agents/gsd-verifier/*` (or skill equivalent) before finalizing 12-04 to confirm STATUS vocabulary. Do NOT re-open the discuss phase for this.

---

## Open Questions

1. **Where does the gsd-verifier agent file live, and does it already emit `STATUS: PASS-WITH-GAPS`?**
   - What we know: SKILL.md dispatches `gsd-verifier` via generic Step 8 and expects a 6-section report + STATUS.
   - What's unclear: exact file path of the agent definition; whether PASS-WITH-GAPS is part of the spec or a Phase 12 addition.
   - Recommendation: 12-04 plan includes a first task "verify/extend gsd-verifier output contract to include STATUS: PASS-WITH-GAPS" — LITE scope, ≤5 LOC edit.

2. **Does `config.atc.enabled` already gate the primary verifier dispatch, or only ATC review?**
   - What we know: `config.atc.enabled` gates per-dispatch ATC at Step 9.5 and phase-level ATC at Step 6.5.
   - What's unclear: the challenger in 9.6 should logically respect `config.atc.verifier_adversarial_rate === 0` as its kill-switch (D-14) — but should it also respect `config.atc.enabled`? Probably yes (consistent disable semantics).
   - Recommendation: plan 12-04 gates Step 9.6 on `config.atc.enabled && Math.random() < config.atc.verifier_adversarial_rate` — matches Step 9.5 dual-gate pattern.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All verify.mjs and new .cjs modules | ✓ | Already used | — |
| bash | ERG-02 installer | ✓ (WSL/mac/linux) | — | — |
| js-yaml | Module loading (if any) | ✓ | pinned at super-gsd/tools/plan-schema/node_modules | — |
| git | Cross-repo probe in installer | ✓ | — | graceful if core.cjs dir isn't a repo |

**Missing dependencies: none.** All Phase 12 code reuses existing pinned deps.

---

## Security Domain

**Applicable:** LOW (no user auth, no crypto, no network). Listed for completeness per security_enforcement=true.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | classifier-cache must reject malformed JSON sidecar (use try/catch around JSON.parse, treat as cache-miss). dispatch-planner must reject non-v2 or malformed frontmatter (v1 fallback). |
| V6 Cryptography | no | — |

**Known threat patterns for this phase:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `.classifier.json` sidecar → crash | Denial-of-service (self) | JSON.parse wrapped in try/catch; treat as cache-miss |
| Cyclic `depends_on` in v2 plan → infinite loop | Logic bug | Kahn's algorithm detects cycles; dump remainder as single serial wave with `cycle:true` flag |
| Installer script hits unexpected core.cjs structure → corruption | Tampering (local file) | `.bak` backup before write; exit ≠0 on anchor-not-found; verify pass after write |

---

## Project Constraints (from CLAUDE.md)

- **NEVER expose secrets:** N/A for Phase 12 (no secrets touched — config changes are `verifier_adversarial_rate: 0.2`, a public tuning number).
- **Windows/WSL environment:** all scripts must work with bash (not PowerShell). ERG-02 installer uses bash explicitly. [Honored]
- **ATC 6-step gate:** Phase 12 is FULL tier (6 plans, 2 new modules, 1 shell script). All plan authors must run the 7-step and 10-point anti-slop checklist per plan.
- **Atomic commits:** verify.mjs-green gate enforces.
- **Path idioms:** CLAUDE.md notes forward-slash paths on Unix — ERG-02 regex respects this (core.cjs uses forward-slash internally regardless of host OS).

---

## Sources

### Primary (HIGH confidence — file:line citations)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — 1085 lines; integration sites at 163-203 (Step 2), 277-285 (dispatch rules), 669-717 (Step 8-9 dispatch + parse), 729-734 (Step 9.2 filter), 745-795 (Step 9.5 ATC), 959-989 (checkpoint protocol)
- `super-gsd/scripts/lib/gates-registry.cjs` — 91 lines; WR-02 insertion at :23; `getGate` error shape at :62
- `super-gsd/scripts/lib/edge-guard.cjs` — 264 lines; WR-01 catch at :83; self-test pattern 126-263
- `super-gsd/scripts/lib/predicate-eval.cjs` — 96 lines; DISPATCH_CONTEXT_FIELDS registry at :14-27
- `super-gsd/templates/checkpoint.md` — 30 lines; existing schema fields 2-15
- `super-gsd/templates/plan-schema-v2.json` — 157 lines; `depends_on` at :31; `files_touched` at :89
- `.planning/phases/10-gate-policy/verify.mjs` — 118 lines; 8-invariant template to copy
- `.planning/phases/10-gate-policy/10-ATC-REVIEW.md` — 206 lines; WR-01/02/03 full text at 56-90
- `.planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml` — confirms core.cjs in separate repo
- `.planning/config.json` — 112 lines; atc block at 68-77 is MACH-04 target
- `~/.claude/get-shit-done/bin/lib/core.cjs:322-331` — ERG-02 patch target (verified via Grep)
- `~/.claude/get-shit-done/bin/lib/config.cjs:14` — VALID_CONFIG_KEYS Set (verified via Grep)

### Secondary (MEDIUM confidence)
- Phase 10 CONTEXT.md / RESEARCH.md conventions for plan structure (verified via Glob on plans/ subdir)

### Tertiary (LOW confidence)
- None. All claims in this research are grounded in file:line citations.

---

## Metadata

**Confidence breakdown:**
- Classifier-cache module shape: HIGH — mtime invariance pattern is standard CJS; sidecar path verified against Phase 10/11 plan layout
- Dispatch-planner algorithm: HIGH — Kahn's topo-sort is textbook; fallback behavior defined in CONTEXT D-07
- Checkpoint schema: HIGH for 3 new fields; MEDIUM for 85% oracle (Risk 1)
- Adversarial verifier: HIGH — pattern matches intent-injection precedent; contrarian prompt is locked in D-13a
- WR-01/02/03 fixes: HIGH — file:line exact, ATC review already documents the fixes
- Installer script: HIGH — patch target verified; Node-in-bash is pragmatic choice
- Verify.mjs invariants: HIGH — pattern matches Phase 10

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — stable foundation; nothing cited is fast-moving)
