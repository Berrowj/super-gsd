---
phase: 10-gate-policy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/scripts/lib/predicate-eval.cjs
  - super-gsd/scripts/lib/gates-registry.cjs
  - super-gsd/registry/gates.yaml
  - .planning/phases/10-gate-policy/verify.mjs
autonomous: true
requirements:
  - GATE-01
  - GATE-02
  - GATE-03

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 10-01-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/predicate-eval.cjs
    input_contract: |
      10-CONTEXT.md D-10, D-10a, D-10b, D-10c (predicate encoding: 10 ops, top-level AND,
      explicit `any:` for OR, unknown-field = throw loud).
      10-RESEARCH.md §Pattern 2 (recommended ~80 LOC shape with full JSDoc) and §Q1 (pure
      function rationale — zero deps, hand-rolled not jsonlogic/jexl/filtrex per R1).
      Reference: `super-gsd/tools/plan-schema/validate.cjs:133-151` for the createRequire
      yaml-load pattern (but predicate-eval.cjs itself has NO yaml dependency — it is pure).
    output_contract: |
      `super-gsd/scripts/lib/predicate-eval.cjs` exists as a CJS module that exports exactly
      `{ evalPredicate }` (other helpers may be internal). Zero runtime deps. ~80 LOC total
      (function body ~60 + JSDoc ~20). Signature `evalPredicate(triggerList, ctx) → bool`.
      Operators supported (switch statement): eq, neq, in, not_in, gt, gte, lt, lte, contains.
      Special form `{any: [...]}` recurses via OR semantics.
      Unknown dotted-field in ctx → `throw new Error("dispatch context missing field...")`.
      Empty/missing triggerList → returns `true` (per D-10 "absent trigger = always fires").
    hypothesis: |
      A ~60-LOC pure function over structured clauses satisfies every D-10 semantic
      (implicit AND, explicit `any:` OR, 10 ops, loud unknown-field) without any
      npm dep. This is provable by direct one-liner unit checks with node -e against
      every operator + the `any:` branch + the missing-field throw branch.
    falsifier: |
      (a) `require('./predicate-eval.cjs').evalPredicate` returns something other than
      boolean for a valid leaf clause (breaks type contract).
      (b) `evalPredicate([{field:'foo',op:'eq',value:1}], {bar:1})` returns `false`
      silently instead of throwing (D-10c violation).
      (c) `evalPredicate([{any:[{field:'x',op:'eq',value:1},{field:'x',op:'eq',value:2}]}], {x:2})`
      returns `false` (any-branch broken).
      (d) Introduces any runtime dep (`require('js-yaml')` or similar — predicate-eval must stay pure).
    stop_rule: |
      File exists, `node -e "const p=require('./super-gsd/scripts/lib/predicate-eval.cjs');
      console.log(p.evalPredicate([{field:'classifier.complexity',op:'neq',value:'trivial'}],
      {classifier:{complexity:'medium'}}))"` prints `true`; the same call with
      `{classifier:{complexity:'trivial'}}` prints `false`; and an unknown-field call throws
      with a message containing the missing path.
    verification_cmd: |
      node -e "const p=require('./super-gsd/scripts/lib/predicate-eval.cjs');const a=p.evalPredicate([{field:'classifier.complexity',op:'neq',value:'trivial'}],{classifier:{complexity:'medium'}});const b=p.evalPredicate([{field:'classifier.complexity',op:'neq',value:'trivial'}],{classifier:{complexity:'trivial'}});if(a!==true||b!==false){console.error('FAIL ops');process.exit(1);}const c=p.evalPredicate([{any:[{field:'x',op:'eq',value:1},{field:'x',op:'eq',value:2}]}],{x:2});if(c!==true){console.error('FAIL any');process.exit(2);}try{p.evalPredicate([{field:'missing.path',op:'eq',value:1}],{});console.error('FAIL throw');process.exit(3);}catch(e){if(!/missing/.test(e.message)){console.error('FAIL msg');process.exit(4);}}console.log('PASS');"
    verification_gates:
      - "node -e ... predicate-eval sanity → exit 0"

  - id: 10-01-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/gates-registry.cjs
    input_contract: |
      10-RESEARCH.md §Pattern 3 (recommended ~60 LOC singleton shape).
      10-CONTEXT.md D-15 (accept scaffold schema as-is), D-15a (order by category then step).
      10-RESEARCH.md §Q3 "Registry load site" — cache-once, O(1) subsequent lookups.
      Reference: `super-gsd/tools/plan-schema/validate.cjs:133-151` for yaml createRequire pattern.
    output_contract: |
      `super-gsd/scripts/lib/gates-registry.cjs` exists as a CJS module with exports:
      `{ loadGates, getGate, shouldFire, resetCache }`. ~60 LOC. Depends only on
      `./predicate-eval.cjs` (10-01-01) + `fs`, `path`, and the pinned js-yaml loaded via
      `require(path.resolve(__dirname,'..','..','tools','plan-schema','node_modules','js-yaml'))`.
      `loadGates(yamlPath)` parses once, caches `{all, byName}` object, returns cache on
      subsequent calls. `getGate(name,yamlPath)` throws if name absent from registry.
      `shouldFire(name,ctx,yamlPath)` returns false if `enforcement_mode==='disabled'`,
      otherwise delegates to `evalPredicate(gate.trigger||[], ctx)`.
    hypothesis: |
      A ~60-LOC singleton that loads gates.yaml once and exposes shouldFire(name,ctx)
      is the minimal surface needed by every SKILL.md call site. Caching prevents
      re-parsing the YAML on every step (O(n) reads for a 10-plan phase → O(1) after first).
      Reusing the pinned js-yaml via createRequire avoids an npm install, matching the
      in-repo precedent at 09-verify.mjs:12 and validate.cjs:166.
    falsifier: |
      (a) Module imports js-yaml via `require('js-yaml')` bare (would break — package not
      at repo root). Must use the resolved-path form.
      (b) `loadGates` re-parses on each call (cache not populated). Observable: mock a
      counter around `yaml.load` and call `loadGates` twice — count should be 1.
      (c) `shouldFire` on a gate with `enforcement_mode: disabled` returns true despite
      disabled state (kill-switch broken).
      (d) `getGate('nonexistent-gate')` returns undefined instead of throwing.
    stop_rule: |
      File exists; with a fixture gates.yaml containing at least one gate
      `{name:'test-gate', enforcement_mode:'soft-warn', trigger:[]}`,
      `loadGates(path)` returns `{all:[...], byName:{'test-gate':...}}`,
      `getGate('test-gate', path)` returns the row, and
      `shouldFire('test-gate', {}, path)` returns true (empty trigger = always fires).
    verification_cmd: |
      node -e "const fs=require('fs');const path=require('path');const tmp='/tmp/gtest.yaml';fs.writeFileSync(tmp,'gates:\\n  - name: test-gate\\n    enforcement_mode: soft-warn\\n    trigger: []\\n');const r=require('./super-gsd/scripts/lib/gates-registry.cjs');r.resetCache();const reg=r.loadGates(tmp);if(!reg.byName['test-gate']){console.error('FAIL load');process.exit(1);}const g=r.getGate('test-gate',tmp);if(g.name!=='test-gate'){console.error('FAIL get');process.exit(2);}if(!r.shouldFire('test-gate',{},tmp)){console.error('FAIL fire');process.exit(3);}try{r.getGate('nope',tmp);console.error('FAIL throw');process.exit(4);}catch(e){}console.log('PASS');"
    verification_gates:
      - "node -e ... gates-registry sanity → exit 0"
    depends_on: [10-01-01]

  - id: 10-01-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/registry/gates.yaml
    input_contract: |
      10-CONTEXT.md D-01..D-09 (per-gate enforcement defaults, trigger clauses, token budgets)
      and D-12 (WR-01 `verifier-row-arithmetic` + WR-02 `verifier-detail-vs-summary` become
      two `verify-completeness` gates, both soft-warn, trigger
      `[{field: phase_has_verify_mjs, op: eq, value: true}]`).
      D-15 (accept scaffold schema as-is — preserve `_example_entries` formatting, only
      populate the empty `gates: []` list; remove `_example_entries:` block only AFTER 11
      real entries exist since D-15 says it becomes redundant).
      D-15a (order: category then step number — code-quality, process-hygiene, functional,
      verify-completeness). D-15b (`state: active` on all Phase-10 rows).
      10-RESEARCH.md §Q3 integration table (9 gate names mapped to steps) and §Code Example 1
      (canonical row shape with `escalation: log-only` default per D-11).
    output_contract: |
      `super-gsd/registry/gates.yaml` has `gates:` populated with exactly 11 entries:
      9 per-step gates (`classifier-haiku` step 2, `context-selector-haiku` step 4,
      `sgsd-recall-queries` step 5, `intent-injection` step 5.5, `per-dispatch-ATC` step 9.5,
      `phase-level-ATC` step 6.5, `MUDA-waste-audit` step 6.55, `sgsd-curate-learnings` step 10,
      `token-log` step 11) + 2 verify-completeness gates (`verifier-row-arithmetic`,
      `verifier-detail-vs-summary`).
      Each row has ALL required fields: `name`, `category`, `enforcement_mode`,
      `trigger` (list; may be empty for always-fires per D-01/D-02/D-04/D-09/D-06),
      `step` (the SKILL.md step number — floats allowed e.g. 5.5, 6.55, 9.5),
      `evidence_emitted` (list; may be empty for in-memory steps like classifier — per D-11c
      token-log is exempt from edge-guard check regardless),
      `escalation` (`log-only` default per D-11; only per-gate opt-in sets `halt`),
      `reviewer_agent` or `script` as applicable,
      `source_dlb` (e.g., DLB-02 for ATC), `state: active`, `version: 2.0`.
      `enforcement_mode` values drawn ONLY from {hard-halt, soft-warn, amortized, disabled}.
      The `_example_entries:` block is REMOVED (redundant once real entries exist per D-15).
      Rows ordered by category (code-quality → process-hygiene → functional →
      verify-completeness), then by step number ascending within category.
    hypothesis: |
      Directly transcribing D-01..D-09 and D-12 into 11 gates.yaml rows with the scaffold's
      existing field set exhausts the empirical evidence from Phase 9. Because the predicate
      evaluator (10-01-01) and registry (10-01-02) already match this trigger shape, the
      rows are runtime-loadable the moment they're committed. Deterministic ordering
      (category → step) keeps future diff noise minimal per D-15a.
    falsifier: |
      (a) `yaml.load(gates.yaml)` throws (YAML syntax invalid).
      (b) `gates.length !== 11` (D-12 said 9 base + 2 verify = 11 minimum).
      (c) Any row's `enforcement_mode` is not in {hard-halt, soft-warn, amortized, disabled}.
      (d) D-05 ATC row has `enforcement_mode` other than `hard-halt` OR missing
      `trigger: [classifier.atc_tier in [full,gate], code_files_changed_count > 0]`
      (would violate ATC-147 evidence-driven policy).
      (e) D-07 MUDA row missing the explicit `any:` nested list (would break OR semantics
      per D-10b).
      (f) D-12 verify-completeness gates missing `{field: phase_has_verify_mjs, op: eq, value: true}`
      trigger (would fire on every phase, not just verifier-equipped ones).
      (g) `_example_entries:` block still present (D-15 says remove once real entries exist).
      (h) Any duplicate gate name across the 11 rows.
    stop_rule: |
      `node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');
      const fs=require('fs');const d=y.load(fs.readFileSync('super-gsd/registry/gates.yaml','utf8'));
      if(!Array.isArray(d.gates)||d.gates.length!==11)process.exit(1);
      const names=d.gates.map(g=>g.name);if(new Set(names).size!==11)process.exit(2);
      const modes=new Set(['hard-halt','soft-warn','amortized','disabled']);
      for(const g of d.gates){if(!modes.has(g.enforcement_mode))process.exit(3);}
      console.log('OK');"` exits 0. AND `grep -q '_example_entries:' super-gsd/registry/gates.yaml`
      returns non-zero (block removed).
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('super-gsd/registry/gates.yaml','utf8'));if(!Array.isArray(d.gates)||d.gates.length!==11){console.error('FAIL count',d.gates?.length);process.exit(1);}const names=d.gates.map(g=>g.name);if(new Set(names).size!==11){console.error('FAIL dup');process.exit(2);}const modes=new Set(['hard-halt','soft-warn','amortized','disabled']);for(const g of d.gates){if(!modes.has(g.enforcement_mode)){console.error('FAIL mode',g.name);process.exit(3);}}const atc=d.gates.find(g=>g.name==='per-dispatch-ATC');if(!atc||atc.enforcement_mode!=='hard-halt'){console.error('FAIL ATC mode');process.exit(4);}console.log('PASS');" && ! grep -q "_example_entries:" super-gsd/registry/gates.yaml
    verification_gates:
      - "node -e ... gates.yaml shape assertion → exit 0"
      - "! grep -q _example_entries: super-gsd/registry/gates.yaml → exit 0"
    depends_on: [10-01-02]

  - id: 10-01-04
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/10-gate-policy/verify.mjs
    input_contract: |
      10-RESEARCH.md §Q7 (the 8 recommended invariants with exit-code-matches-invariant-number
      convention). 10-VALIDATION.md Wave 0 list. 10-CONTEXT.md D-13 (byterover key must be
      absent — invariant 8).
      Reference pattern: `.planning/phases/09-atc-147-evidence/verify.mjs` (ESM, createRequire,
      ~63 LOC for 7 invariants). Invariant numbering aligns to §Q7 table.
      Note: Invariants 7 (09-verify.mjs exits 0) and 8 (no byterover key) will FAIL until
      Plan 10-03 retrofits 09-verify.mjs (D-12b) and deletes the byterover block (D-13).
      THIS IS EXPECTED — Wave 1 verify.mjs captures the full Phase-10 invariant set; Wave 2
      integration work (10-03) turns the remaining reds green.
    output_contract: |
      `.planning/phases/10-gate-policy/verify.mjs` is an ESM Node script (~100 LOC) that
      asserts all 8 invariants per 10-RESEARCH.md §Q7. Exit code matches the failing
      invariant number (1-8); exit 0 = all PASS.
      Invariants:
      1. gates.yaml parses as valid YAML.
      2. `gates` list has >= 11 rows (D-01..D-09 + D-12 minimum).
      3. Every row has required fields (`name`, `category`, `enforcement_mode`, `state`,
         `source_dlb`, `version`).
      4. `enforcement_mode` value ∈ {hard-halt, soft-warn, amortized, disabled}.
      5. No duplicate gate names (`new Set(gates.map(g=>g.name)).size === gates.length`).
      6. Every `trigger` clause is parseable via
         `require('super-gsd/scripts/lib/predicate-eval.cjs').evalPredicate(g.trigger||[], sampleCtx)`
         without throwing, where sampleCtx is a known-complete fixture covering all 11
         enumerated dispatch-context fields (Q2 table — 10 fields + phase_has_verify_mjs).
      7. `.planning/phases/09-atc-147-evidence/verify.mjs` exits 0 when invoked via
         `execSync('node .planning/phases/09-atc-147-evidence/verify.mjs')` — D-12b retrofit
         check. WILL FAIL during Wave 1 commit; turns green after 10-03-03.
      8. `.planning/config.json` parsed as JSON does NOT contain a `byterover` key — D-13
         cleanup check. WILL FAIL during Wave 1 commit; turns green after 10-03-04.
      Uses `super-gsd/tools/plan-schema/node_modules/js-yaml` via createRequire (no npm install).
    hypothesis: |
      Authoring verify.mjs in Wave 1 (alongside gates.yaml population) means the verifier
      exists to gate ALL subsequent Phase 10 work. Invariants 1-6 turn green the moment
      task 10-01-03 commits a valid gates.yaml. Invariants 7 and 8 remain red until Plan
      10-03 completes — this is the correct signal (Phase 10 is not finished until all
      8 invariants pass).
    falsifier: |
      (a) Fewer than 8 numbered invariants in the file (`grep -c "Invariant [1-8]"` < 8).
      (b) Exit codes don't match invariant numbers (invariant-6 failure exits 5, etc.).
      (c) Invariants 1-6 fail on the committed gates.yaml from 10-01-03 (means 10-01-03 is bad
      OR verify.mjs is bad — executor must re-check).
      (d) verify.mjs uses bare `import ... from 'js-yaml'` instead of the createRequire path.
      (e) Sample ctx in invariant 6 doesn't cover all 11 fields — would hide unknown-field
      typos in real gates.yaml triggers.
    stop_rule: |
      `test -f .planning/phases/10-gate-policy/verify.mjs` is true; `node .planning/phases/10-gate-policy/verify.mjs`
      runs without syntax error; after 10-01-03 commits, the script exits 7 (inv-7 fails
      because 09-verify.mjs doesn't yet have WR-01/02 invariants — expected)
      or exit 8 (inv-8, byterover still present — expected). Exits 1-6 during this task
      indicate a Phase-10 verifier or gates.yaml bug — MUST be fixed before task closes.
    verification_cmd: |
      test -f .planning/phases/10-gate-policy/verify.mjs && node -e "const fs=require('fs');const c=fs.readFileSync('.planning/phases/10-gate-policy/verify.mjs','utf8');for(let i=1;i<=8;i++){if(!new RegExp('Invariant '+i+'\\\\b').test(c)){console.error('FAIL missing Invariant',i);process.exit(i);}}console.log('PASS');" && node .planning/phases/10-gate-policy/verify.mjs; EC=$?; if [ $EC -eq 0 ] || [ $EC -eq 7 ] || [ $EC -eq 8 ]; then echo "verify.mjs authored correctly (exit $EC expected during Wave 1)"; else echo "unexpected exit $EC"; exit $EC; fi
    verification_gates:
      - "test -f .planning/phases/10-gate-policy/verify.mjs → exit 0"
      - "verify.mjs contains Invariant 1..8 markers → all 8 present"
      - "node .planning/phases/10-gate-policy/verify.mjs → exit 0 | 7 | 8 (7/8 expected red pre-Wave-2)"
    depends_on: [10-01-03]

must_haves:
  truths:
    - "`predicate-eval.cjs` exports `evalPredicate(triggerList, ctx) → bool` with 10 ops + `any:` OR + loud unknown-field throw (D-10 / D-10a / D-10b / D-10c)"
    - "`gates-registry.cjs` loads gates.yaml once (cached), exposes `shouldFire(name, ctx, path)` that short-circuits on `enforcement_mode: disabled`"
    - "`gates.yaml` has 11 populated rows: 9 per-step (D-01..D-09) + 2 verify-completeness (D-12); no `_example_entries:` block remaining"
    - "Every gates.yaml row's `enforcement_mode` is in {hard-halt, soft-warn, amortized, disabled}"
    - "per-dispatch-ATC row is `hard-halt` with trigger `classifier.atc_tier in [full,gate] AND code_files_changed_count > 0` per D-05"
    - "MUDA-waste-audit row uses the explicit `any:` nested-list form per D-07 and D-10b"
    - "Both verify-completeness gates carry `trigger: [{field: phase_has_verify_mjs, op: eq, value: true}]` per D-12a"
    - "Rows ordered by category then step per D-15a; all rows `state: active` per D-15b"
    - "`.planning/phases/10-gate-policy/verify.mjs` exists with 8 numbered invariants per Q7; exit codes map 1-to-1"
    - "Wave 1 verifier exit ∈ {0, 7, 8} (7/8 are expected-red until Wave 2 integration completes)"
  artifacts:
    - path: "super-gsd/scripts/lib/predicate-eval.cjs"
      provides: "Pure-function structured-clause evaluator (zero deps, 10 operators)"
      contains: "evalPredicate, evalClause, getDottedField, applyOp; `module.exports = { evalPredicate }`"
    - path: "super-gsd/scripts/lib/gates-registry.cjs"
      provides: "Cached YAML-load singleton + shouldFire/getGate API"
      contains: "loadGates, getGate, shouldFire, resetCache; yaml loaded via createRequire"
    - path: "super-gsd/registry/gates.yaml"
      provides: "Populated policy registry — 11 rows per D-01..D-09 + D-12"
      contains: "gates: (list of 11); each row with name, category, enforcement_mode, trigger, step, evidence_emitted, escalation, state:active, version:2.0"
    - path: ".planning/phases/10-gate-policy/verify.mjs"
      provides: "Phase-10 mechanical verifier — 8 invariants per Q7"
      contains: "invariants 1-8 with exit-code-matches-invariant-number; sample ctx covers all 11 dispatch-context fields"
  key_links:
    - from: "super-gsd/scripts/lib/gates-registry.cjs"
      to: "super-gsd/scripts/lib/predicate-eval.cjs"
      via: "require('./predicate-eval.cjs')"
      pattern: "require\\(['\"]\\./predicate-eval\\.cjs['\"]\\)"
    - from: "super-gsd/scripts/lib/gates-registry.cjs"
      to: "super-gsd/tools/plan-schema/node_modules/js-yaml"
      via: "path.resolve(__dirname,'..','..','tools','plan-schema','node_modules','js-yaml')"
      pattern: "plan-schema/node_modules/js-yaml"
    - from: ".planning/phases/10-gate-policy/verify.mjs"
      to: "super-gsd/registry/gates.yaml"
      via: "yaml.load(fs.readFileSync(...))"
      pattern: "registry/gates\\.yaml"
    - from: ".planning/phases/10-gate-policy/verify.mjs"
      to: "super-gsd/scripts/lib/predicate-eval.cjs"
      via: "require() inside invariant 6"
      pattern: "scripts/lib/predicate-eval\\.cjs"
---

# Plan 10-01: Predicate Evaluator + Gates Registry + gates.yaml Population

## Objective

Ship the three Wave-1 code artefacts that give Phase 10 a policy runtime: a pure-function predicate evaluator (`predicate-eval.cjs`), a cached registry singleton (`gates-registry.cjs`), and the populated `gates.yaml` with all 11 rows (9 per-step per D-01..D-09 + 2 verify-completeness per D-12). Also stand up Phase 10's own `verify.mjs` so every downstream commit gates against the 8 invariants from Q7.

Purpose: Satisfies **GATE-01** (per-gate decision matrix with empirical triggers), **GATE-02** (ATC gates land in gates.yaml with enforcement_mode, not prose), **GATE-03** (all 7 non-ATC gates get explicit verdicts).

Output: 4 files (`predicate-eval.cjs`, `gates-registry.cjs`, populated `gates.yaml`, `verify.mjs`). Wave 1 — parallel with Plan 10-02 (zero file overlap).

## Tasks

Task breakdown follows the 10-VALIDATION.md map (4 tasks: 10-01-01 through 10-01-04). All task contracts, hypotheses, falsifiers, and stop rules live in the frontmatter above — that is the canonical contract the executor reads.

### 10-01-01 — `predicate-eval.cjs`

Build the structured-clause evaluator per 10-RESEARCH.md §Pattern 2. Zero runtime deps. 10 ops. `any:` nested for OR. Unknown dotted field → throw loud (D-10c). Full JSDoc listing the 11 enumerated dispatch-context fields (the 10 from D-10c plus `phase_has_verify_mjs` added by D-12a). ~80 LOC.

### 10-01-02 — `gates-registry.cjs`

Cached singleton per 10-RESEARCH.md §Pattern 3. Loads gates.yaml once via `require(path.resolve(__dirname,'..','..','tools','plan-schema','node_modules','js-yaml'))` — SAME pattern as `validate.cjs:166` and `09-verify.mjs:12`. Exports `{loadGates, getGate, shouldFire, resetCache}`. `shouldFire` short-circuits to false when `enforcement_mode === 'disabled'`. Depends on 10-01-01 (`require('./predicate-eval.cjs')`).

### 10-01-03 — Populate `gates.yaml`

Fill the scaffold's empty `gates: []` with 11 rows. 9 per-step from D-01..D-09; 2 verify-completeness from D-12 (`verifier-row-arithmetic` and `verifier-detail-vs-summary`). Remove `_example_entries:` block (redundant per D-15). Sort by category → step. Every row: `state: active`, `version: 2.0`, `escalation: log-only` default (D-11).

**Critical trigger shapes to preserve verbatim:**

- `per-dispatch-ATC` (D-05): `trigger: [{field: classifier.atc_tier, op: in, value: [full, gate]}, {field: code_files_changed_count, op: gt, value: 0}]`
- `MUDA-waste-audit` (D-07): `trigger: [{any: [{field: files_changed, op: gte, value: 4}, {field: diff_lines, op: gte, value: 100}]}, {field: phase_type, op: not_in, value: [docs, config, refactor]}]`
- `sgsd-recall-queries` (D-03): `trigger: [{field: classifier.complexity, op: neq, value: trivial}]`
- `sgsd-curate-learnings` (D-08): `trigger: [{any: [{field: new_pattern_detected, op: eq, value: true}, {field: script_created, op: eq, value: true}, {field: error_discovered, op: eq, value: true}]}]`
- `verifier-row-arithmetic` + `verifier-detail-vs-summary` (D-12a): both `trigger: [{field: phase_has_verify_mjs, op: eq, value: true}]`
- `classifier-haiku`, `context-selector-haiku`, `intent-injection`, `phase-level-ATC`, `token-log`: `trigger: []` (always fires per D-01, D-02, D-04, D-06, D-09)

Step 11 (`token-log`) MUST have `evidence_emitted: []` explicitly — it IS the logger (D-11c).

### 10-01-04 — `verify.mjs` (Phase 10's own verifier)

Mirror the shape of `09-verify.mjs` (ESM, createRequire, fail(N,msg) helper, exit code = invariant number). 8 invariants from 10-RESEARCH.md §Q7. Invariant 6 executes `evalPredicate` against a sample ctx covering all 11 enumerated fields — this is the single gate that catches trigger-clause typos before they reach the live orchestrator (R8 mitigation). Invariants 7 and 8 SHOULD fail after this task commits: they turn green in Plan 10-03 (Wave 2).

## Verification Gates (Wave close)

Run in sequence:

1. `node -e "..."` predicate-eval sanity → PASS
2. `node -e "..."` gates-registry sanity (with a /tmp fixture) → PASS
3. `node -e "..."` gates.yaml shape (11 rows, unique names, valid modes, ATC hard-halt) → PASS
4. `! grep -q '_example_entries:' super-gsd/registry/gates.yaml` → exit 0
5. `node .planning/phases/10-gate-policy/verify.mjs` → exit 0, 7, or 8 (7 and 8 are acceptable red invariants during Wave 1; any other exit code = plan-10-01 bug to fix before commit)

## Success Criteria

- All 4 files exist at the paths declared in `files_modified`.
- All 4 task `verification_cmd`s exit 0.
- `gates.yaml` parses as valid YAML, 11 rows, no duplicate names, all `enforcement_mode` values valid.
- Phase-10 `verify.mjs` exits 0 OR 7 OR 8 (invariants 7/8 remain red until Plan 10-03 lands).

## Output

After completion, create `.planning/phases/10-gate-policy/plans/10-01-SUMMARY.md` summarising:
- 4 files created (paths + LOC counts — predicate-eval ~80, gates-registry ~60, gates.yaml +11 rows, verify.mjs ~100)
- Which 3 invariants (1-6) pass on the committed artefacts; which 2 (7, 8) remain expected-red for Wave 2.
- The 4 commit SHAs (one per task).
