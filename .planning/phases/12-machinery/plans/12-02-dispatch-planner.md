---
phase: 12-machinery
plan: 02
type: execute
wave: 2
depends_on:
  - 12-01
files_modified:
  - super-gsd/scripts/lib/dispatch-planner.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - .planning/phases/12-machinery/verify.mjs
  - .planning/phases/12-machinery/plans/12-02-00-spike.md
  - .planning/phases/12-machinery/plans/12-02-SUMMARY.md
autonomous: true
requirements:
  - MACH-02

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 12-02-00
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/12-machinery/plans/12-02-00-spike.md
    input_contract: |
      12-RESEARCH.md §Risk 2 — plan-level fan-out via `Agent(run_in_background: true)` is
      unverified in this codebase (zero hits on `run_in_background` in SKILL.md).
      Research recommendation: Plan 12-02's FIRST task is a LIVE SMOKE SPIKE — dispatch 3
      trivial parallel gsd-executor Agent() calls via the Task harness and observe whether
      they run concurrently (distinct start timestamps, overlapping duration) or serialize.
      The spike WRITES a note file documenting the result and the decision for task 12-02-02
      (fallback behaviour). It does NOT modify any orchestrator code.
      Acceptable spike outcomes:
      - PARALLEL_CONFIRMED — fan-out works; 12-02-01 implements parallel-wave semantics as designed.
      - SERIALIZED_FALLBACK — Task() runs sequentially despite parallel intent; 12-02-01 still
        ships `buildDispatchPlan` (DAG becomes advisory), but SKILL.md integration at 12-02-03
        documents serial-execution fallback explicitly (hypothesis: the DAG still prevents
        file-conflict bugs even when execution is serial).
    output_contract: |
      `.planning/phases/12-machinery/plans/12-02-00-spike.md` exists with sections:
      - "## Spike Design" — 3 parallel Agent() dispatches with trivial read-only workloads
      - "## Observations" — recorded start/end timestamps (ISO) per dispatch; concurrency verdict
      - "## Decision" — `PARALLEL_CONFIRMED` or `SERIALIZED_FALLBACK` (one of the two)
      - "## Impact on 12-02-01/03" — explicit note of how downstream tasks proceed given the verdict
      No orchestrator code is modified. No module is created in this task. This is pure discovery.
    hypothesis: |
      Per §Risk 2: feature intent (parallel Wave execution) hinges on a harness capability that
      has zero existing usage in this codebase. Proving the capability before writing the
      integration prevents shipping 80 LOC of dispatch-planner logic that assumes a harness
      semantic the runtime doesn't provide. Either verdict is acceptable — PARALLEL_CONFIRMED
      lets 12-02-03 ship the designed fan-out; SERIALIZED_FALLBACK still justifies the DAG
      (conflict-free topo-sort is valuable even when execution is serial).
    falsifier: |
      (a) Spike is not run (`12-02-00-spike.md` absent) — downstream tasks proceed without
      evidence. Risk 2 unmitigated.
      (b) Spike decision cell contains text other than `PARALLEL_CONFIRMED` or `SERIALIZED_FALLBACK`.
      (c) Spike modifies `dispatch-planner.cjs` or SKILL.md (scope creep — this task is discovery only).
      (d) Observations section is empty or lacks per-dispatch timestamps (no evidence).
    stop_rule: |
      Spike document exists, verdict recorded as one of the two acceptable values, evidence
      (timestamps) captured. No other files touched by this task.
    verification_cmd: |
      test -f .planning/phases/12-machinery/plans/12-02-00-spike.md && grep -qE "PARALLEL_CONFIRMED|SERIALIZED_FALLBACK" .planning/phases/12-machinery/plans/12-02-00-spike.md && grep -q "Observations" .planning/phases/12-machinery/plans/12-02-00-spike.md
    verification_gates:
      - "spike document exists → exit 0"
      - "verdict recorded as PARALLEL_CONFIRMED or SERIALIZED_FALLBACK → grep exit 0"
      - "Observations section present → grep exit 0"

  - id: 12-02-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/dispatch-planner.cjs
    input_contract: |
      12-CONTEXT.md D-05, D-05a, D-05b, D-06, D-08 (v2 DAG build; explicit depends_on +
      implicit files_touched overlap; plan-level waves; failure semantics — no cancellation).
      12-RESEARCH.md §Q2 — ~80 LOC CJS module exporting `buildDispatchPlan(plan)` →
      `[{wave: N, taskIds: [...], serial: bool}]`. Algorithm:
      1. Kahn's topo-sort on explicit depends_on edges.
      2. Add implicit edges when files_touched overlap (D-05a) — earlier taskId in sorted
         order precedes later.
      3. Per-wave `serial` flag: false iff ALL pairwise disjoint files_touched AND no
         explicit inner-wave depends_on; else true.
      4. Cycle detection: if Kahn emits empty layer with remainder, dump remainder as single
         serial wave with `cycle: true` flag.
      Zero runtime deps. v1 fallback at 12-02-02 in a separate task.
    output_contract: |
      `super-gsd/scripts/lib/dispatch-planner.cjs` exists as a CJS module exporting exactly
      `{ buildDispatchPlan }`. Zero runtime deps. ~80 LOC including JSDoc.
      Algorithm matches §Q2 recommended shape:
      - Build predecessor map from task.depends_on + implicit file-overlap edges
      - Kahn's topo-sort layering (layer N = tasks with no unresolved deps)
      - Per-layer `serial` computed via `hasInternalConflict` helper (pairwise file overlap
        OR explicit inner-wave depends_on)
      - Cycle path: dump remainder with `cycle: true` to avoid infinite loop (V5/security
        threat-model from research §Security Domain)
      Returns waves in ascending `wave: N` order starting at 1.
    hypothesis: |
      Kahn's topo-sort is textbook and produces a deterministic layering that respects both
      explicit dependencies and implicit file-conflict edges. The `serial` flag per wave
      captures the MACH-02 gate: fan out only when safe, serialize within a wave when
      file overlap exists. Pure-function shape makes every invariant testable with inline
      node -e fixtures — no mocks needed.
    falsifier: |
      (a) `require('./dispatch-planner.cjs').buildDispatchPlan` is not a function.
      (b) For a fixture v2 plan with tasks `[{id:'a'},{id:'b',depends_on:['a']}]`,
      output is not `[{wave:1,taskIds:['a'],serial:false|true}, {wave:2,taskIds:['b'],serial:false|true}]`
      (explicit dep violated).
      (c) For tasks `[{id:'a',files_touched:['x']},{id:'b',files_touched:['x']}]`,
      both tasks end up in the SAME wave (file-overlap rule broken — D-05a).
      (d) For tasks `[{id:'a',files_touched:['x']},{id:'b',files_touched:['y']}]`,
      resulting wave has `serial: true` (no conflict exists — should be parallel-eligible).
      (e) Cyclic plan `[{id:'a',depends_on:['b']},{id:'b',depends_on:['a']}]` hangs or throws
      (should dump single serial wave with `cycle: true` flag — no infinite loop).
      (f) Introduces any runtime dep.
    stop_rule: |
      Module loads via require; `buildDispatchPlan` exported; inline smoke test exercises
      explicit-dep ordering, file-overlap implicit ordering, pairwise-disjoint parallel flag,
      and cycle-safe behaviour. All four fixtures return the expected wave structure.
    verification_cmd: |
      node -e "const d=require('./super-gsd/scripts/lib/dispatch-planner.cjs');if(typeof d.buildDispatchPlan!=='function'){console.error('FAIL export');process.exit(1);}const p1={schema_version:2,tasks:[{id:'a',files_touched:['fa']},{id:'b',depends_on:['a'],files_touched:['fb']}]};const w1=d.buildDispatchPlan(p1);if(!Array.isArray(w1)||w1.length!==2||!w1[0].taskIds.includes('a')||!w1[1].taskIds.includes('b')){console.error('FAIL depends_on',JSON.stringify(w1));process.exit(2);}const p2={schema_version:2,tasks:[{id:'a',files_touched:['x']},{id:'b',files_touched:['x']}]};const w2=d.buildDispatchPlan(p2);if(w2.length!==2){console.error('FAIL overlap',JSON.stringify(w2));process.exit(3);}const p3={schema_version:2,tasks:[{id:'a',files_touched:['x']},{id:'b',files_touched:['y']}]};const w3=d.buildDispatchPlan(p3);if(w3.length!==1||w3[0].serial!==false){console.error('FAIL parallel',JSON.stringify(w3));process.exit(4);}const p4={schema_version:2,tasks:[{id:'a',depends_on:['b'],files_touched:['f1']},{id:'b',depends_on:['a'],files_touched:['f2']}]};const w4=d.buildDispatchPlan(p4);if(!w4.some(x=>x.cycle)){console.error('FAIL cycle',JSON.stringify(w4));process.exit(5);}console.log('PASS');"
    verification_gates:
      - "node -e ... dispatch-planner v2 smoke (explicit + overlap + parallel + cycle) → exit 0"
    depends_on: [12-02-00]

  - id: 12-02-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/dispatch-planner.cjs
      - .planning/phases/12-machinery/verify.mjs
    input_contract: |
      12-CONTEXT.md D-07 — v1 fallback: plans with no `schema_version: 2` OR no per-task
      `files_touched` serialize all tasks sequentially. Detection: `plan.schema_version !== 2`.
      12-RESEARCH.md §Q2 recommended code path (first branch of `buildDispatchPlan`).
      Returns `[{wave:1, taskIds: [all in order], serial: true}]`.
      Also append invariants 3, 4, 5 to `.planning/phases/12-machinery/verify.mjs`:
      Invariant 3 — `dispatch-planner.cjs` parses and exports buildDispatchPlan (typeof);
      Invariant 4 — v2 plan produces non-cyclic ascending-wave output + no duplicate taskIds;
      Invariant 5 — v1 plan returns single-wave-all-serial output (D-07 contract).
      Note: this task edits BOTH dispatch-planner.cjs (adding the v1 branch if 12-02-01 didn't
      include it) AND verify.mjs (appending invariants). Keep the module edit minimal — only
      the v1-fallback branch; do NOT refactor 12-02-01's v2 algorithm.
    output_contract: |
      `dispatch-planner.cjs` now handles v1 input: `plan.schema_version !== 2` OR
      `!Array.isArray(plan.tasks)` returns `[{wave:1, taskIds:(plan.tasks||[]).map(t=>t.id), serial:true}]`.
      Empty/missing-tasks returns `[{wave:1, taskIds:[], serial:true}]`.
      `.planning/phases/12-machinery/verify.mjs` gains Invariant 3, 4, 5 blocks (exit codes
      match invariant numbers per Phase 10 convention). Running `node verify.mjs` post-commit
      exits 0 (invariants 1-5 all green).
    hypothesis: |
      The v1 fallback is a 4-line early-return branch. Isolating it in a separate task keeps
      the 12-02-01 commit focused on the v2 algorithm and lets verify.mjs assert each branch
      independently. After 12-02-02 commits, invariants 3/4/5 become green and lock the
      dispatch-planner contract against future regressions.
    falsifier: |
      (a) v1 input `{schema_version:1, tasks:[{id:'a'},{id:'b'}]}` does NOT return
      `[{wave:1, taskIds:['a','b'], serial:true}]`.
      (b) `verify.mjs` missing numbered blocks 3, 4, or 5 (`grep -cE 'Invariant [345]\\b'` < 3).
      (c) `node verify.mjs` exits non-zero on committed modules (contract drift).
      (d) 12-02-01's v2 algorithm regresses — v2 smoke from prior task no longer passes.
      (e) Empty plan input throws (should return single empty wave).
    stop_rule: |
      Module handles v1 plan per D-07 contract; `verify.mjs` contains Invariant 3/4/5 blocks;
      `node verify.mjs` exits 0. Prior v2 smoke from 12-02-01 still passes.
    verification_cmd: |
      node -e "const d=require('./super-gsd/scripts/lib/dispatch-planner.cjs');const v1={schema_version:1,tasks:[{id:'a'},{id:'b'}]};const w=d.buildDispatchPlan(v1);if(w.length!==1||w[0].serial!==true||w[0].taskIds.join(',')!=='a,b'){console.error('FAIL v1',JSON.stringify(w));process.exit(1);}const empty=d.buildDispatchPlan({schema_version:2,tasks:[]});if(empty.length!==1||empty[0].taskIds.length!==0){console.error('FAIL empty',JSON.stringify(empty));process.exit(2);}console.log('PASS');" && test $(grep -cE 'Invariant [345]\b' .planning/phases/12-machinery/verify.mjs) -ge 3 && node .planning/phases/12-machinery/verify.mjs
    verification_gates:
      - "v1 plan returns single-wave-all-serial → exit 0"
      - "empty tasks returns single empty wave → exit 0"
      - "verify.mjs contains Invariant 3/4/5 blocks → count >= 3"
      - "node verify.mjs → exit 0 (invariants 1-5 all green)"
    depends_on: [12-02-01]

  - id: 12-02-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - .planning/phases/12-machinery/plans/12-02-SUMMARY.md
    input_contract: |
      12-CONTEXT.md D-06 — SKILL.md dispatch rule 6.e replaced with a wave-aware variant
      that calls `dispatchPlanner.buildDispatchPlan(plan)` and iterates through waves.
      Within a wave: if `w.serial || w.taskIds.length === 1` → sequential single-agent loop;
      else → fan out Agent() calls (guarded by 12-02-00 spike verdict) and await all.
      12-CONTEXT.md D-08 — on BLOCKER: halt after remaining parallel tasks settle, no
      cancellation (limitation accepted).
      12-RESEARCH.md §Risk 3 — each parallel executor still pays its own per-dispatch ATC
      (Step 9.5) SEQUENTIALLY after the parallel wave settles. This is a clarification
      requirement, not a scope change — document it in the SKILL.md dispatch block.
      12-RESEARCH.md §Q2 "Integration edit at SKILL.md dispatch rule 6.e" — the exact
      replacement pattern (for/of wave loop + parallel fan-out when !serial).
      Also produce 12-02-SUMMARY.md.
    output_contract: |
      `super-gsd/skills/sgsd-orchestrate/SKILL.md` at dispatch rule 6.e now shows:
      - `const waves = dispatchPlanner.buildDispatchPlan(plan);` call
      - `for (const w of waves)` iteration
      - `if (w.serial || w.taskIds.length === 1)` sequential branch (existing single-agent dispatch)
      - `else` parallel branch with `Task(... run_in_background: true ...)` fan-out + `await` all
      - Explicit note in prose that BLOCKER in parallel wave halts AFTER remaining tasks
        settle (D-08, no cancellation)
      - Explicit note that per-dispatch ATC (Step 9.5) runs SEQUENTIALLY per report post-wave
        (§Risk 3 clarification)
      Measurable invariants:
      - `grep -q "dispatch-planner" SKILL.md` → exit 0
      - `grep -q "buildDispatchPlan" SKILL.md` → exit 0
      - `grep -q "run_in_background" SKILL.md` → exit 0 (first occurrence in this file — zero hits before this task)
      SPIKE-VERDICT-CONDITIONAL behaviour: if 12-02-00 emitted `SERIALIZED_FALLBACK`, the
      parallel branch is STILL authored (DAG remains advisory) but prose explicitly notes
      the runtime falls back to serial execution per spike evidence.
      `12-02-SUMMARY.md` records: spike verdict, artefacts, commit SHAs, handoff to 12-03.
    hypothesis: |
      Wiring the SKILL.md dispatch loop to consume `buildDispatchPlan` output makes the
      module load-bearing: every plan that dispatches executors now flows through
      dispatch-planner. The spike-conditional prose ensures the documentation matches
      the observed runtime behaviour (PARALLEL_CONFIRMED → genuine fan-out;
      SERIALIZED_FALLBACK → DAG-advisory serial). Either way, the module is integrated
      and the DAG prevents file-conflict bugs.
    falsifier: |
      (a) `grep -q "dispatch-planner" SKILL.md` fails (integration didn't land).
      (b) `grep -q "buildDispatchPlan" SKILL.md` fails (call site absent).
      (c) `grep -q "run_in_background" SKILL.md` fails (parallel branch missing even as
      authored code — D-06 violation).
      (d) Dispatch rule 6.e text at line 282 retains the single-agent pattern unchanged
      (integration skipped).
      (e) SUMMARY.md omits spike-verdict section (12-02-00 evidence not carried forward).
    stop_rule: |
      Three greppable markers present in SKILL.md; SUMMARY.md references spike verdict;
      dispatch rule 6.e shows the wave-loop pattern.
    verification_cmd: |
      grep -q "dispatch-planner" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "buildDispatchPlan" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "run_in_background" super-gsd/skills/sgsd-orchestrate/SKILL.md && test -f .planning/phases/12-machinery/plans/12-02-SUMMARY.md
    verification_gates:
      - "grep dispatch-planner SKILL.md → exit 0"
      - "grep buildDispatchPlan SKILL.md → exit 0"
      - "grep run_in_background SKILL.md → exit 0"
      - "12-02-SUMMARY.md exists → exit 0"
    depends_on: [12-02-02]

must_haves:
  truths:
    - "12-02-00 spike documents a live Agent() fan-out test with PARALLEL_CONFIRMED or SERIALIZED_FALLBACK verdict before any integration code is written (Risk 2 mitigated)"
    - "`dispatch-planner.cjs` exports `{buildDispatchPlan}` — pure CJS, zero runtime deps, ~80 LOC"
    - "v2 plan: Kahn topo-sort respects explicit depends_on + implicit files_touched overlap (D-05 / D-05a)"
    - "v1 plan: returns single-wave-all-serial — `[{wave:1, taskIds:[all], serial:true}]` (D-07)"
    - "Cyclic plan: dumps remainder as single serial wave with `cycle:true` flag — no infinite loop (V5 threat)"
    - "verify.mjs gains invariants 3 (exports), 4 (v2 DAG non-cyclic ascending), 5 (v1 fallback serial); exit 0 after 12-02-02"
    - "SKILL.md dispatch rule 6.e now consumes `dispatchPlanner.buildDispatchPlan(plan)` and iterates waves"
    - "SKILL.md contains three greppable markers: `dispatch-planner`, `buildDispatchPlan`, `run_in_background`"
    - "Prose explicitly documents D-08 (no cancellation on BLOCKER) and §Risk 3 (per-dispatch ATC runs sequentially post-wave)"
    - "Plan close: 12-02-SUMMARY.md records spike verdict + commit SHAs + handoff to plan 12-03"
  artifacts:
    - path: ".planning/phases/12-machinery/plans/12-02-00-spike.md"
      provides: "Live smoke-test evidence for Agent() parallel fan-out before any integration lands (Risk 2)"
      contains: "Spike Design, Observations (timestamps), Decision (PARALLEL_CONFIRMED | SERIALIZED_FALLBACK), Impact"
    - path: "super-gsd/scripts/lib/dispatch-planner.cjs"
      provides: "Topo-sorted wave planner from v2 depends_on + files_touched; v1 fallback returns single serial wave"
      contains: "buildDispatchPlan + internal hasInternalConflict helper; module.exports = { buildDispatchPlan }"
    - path: ".planning/phases/12-machinery/verify.mjs"
      provides: "Phase-12 verifier gains invariants 3/4/5 (MACH-02 contract)"
      contains: "Invariant 3 (exports), Invariant 4 (v2 non-cyclic ascending), Invariant 5 (v1 single-wave-serial)"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Dispatch rule 6.e now wave-aware; parallel branch (spike-conditional) + serial branch + D-08/§Risk 3 prose"
      contains: "greppable markers dispatch-planner, buildDispatchPlan, run_in_background"
    - path: ".planning/phases/12-machinery/plans/12-02-SUMMARY.md"
      provides: "Plan close: artefacts + spike verdict + commit SHAs + handoff to 12-03"
      contains: "sections Artifacts, Spike Verdict, Commit SHAs, Next"
  key_links:
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/scripts/lib/dispatch-planner.cjs"
      via: "require at dispatch rule 6.e; call to buildDispatchPlan(plan)"
      pattern: "dispatch-planner"
    - from: ".planning/phases/12-machinery/verify.mjs"
      to: "super-gsd/scripts/lib/dispatch-planner.cjs"
      via: "createRequire + require for invariants 3/4/5"
      pattern: "dispatch-planner\\.cjs"
    - from: "12-02-00 spike decision"
      to: "12-02-03 SKILL.md integration (parallel vs serial prose)"
      via: "SUMMARY.md cross-reference"
      pattern: "PARALLEL_CONFIRMED|SERIALIZED_FALLBACK"
---

# Plan 12-02: Dispatch Planner (MACH-02)

## Objective

Ship the parallel/sequential auto-detection module that reads v2 plan `depends_on` +
`files_touched` and produces wave-layered task IDs. Module at
`super-gsd/scripts/lib/dispatch-planner.cjs`; integration lands in SKILL.md dispatch rule 6.e;
Phase 12's `verify.mjs` gains invariants 3-5 (MACH-02 contract). A MANDATORY live smoke
spike precedes integration — Risk 2 mitigation per 12-RESEARCH.md.

Purpose: Satisfies **MACH-02** per D-05..D-08. Wave 2 of phase 12 — depends on plan 12-01
(wave serialization for SKILL.md merge safety, not a semantic dependency on classifier-cache).

Output: 2 code-bearing files + 1 SKILL.md edit + 1 verify.mjs append + 1 spike note +
1 SUMMARY. Wave 2 — serialized per D-23 because this plan and plans 12-03/12-04 all edit
the same SKILL.md (different sections but proximity-risky for merges).

## Tasks

Task breakdown follows 12-VALIDATION.md (4 tasks: 12-02-00, 12-02-01, 12-02-02, 12-02-03).
All contracts live in the frontmatter above.

### 12-02-00 — Live smoke spike (Risk 2 mitigation)

FIRST TASK, ALWAYS. Dispatch 3 trivial parallel `gsd-executor` Agent() calls via the
Task harness with read-only workloads. Record per-dispatch start/end timestamps. Classify
concurrency as `PARALLEL_CONFIRMED` (overlapping duration observed) or `SERIALIZED_FALLBACK`
(sequential). Produce `.planning/phases/12-machinery/plans/12-02-00-spike.md` with the
verdict. NO orchestrator code modified. This task is pure discovery and gates 12-02-03's
prose choice.

### 12-02-01 — `dispatch-planner.cjs` v2 algorithm

Build the ~80-LOC module per 12-RESEARCH.md §Q2. Export `{buildDispatchPlan}`. Kahn's
topo-sort on explicit `depends_on` edges + implicit edges from files_touched overlap
(D-05a). Per-wave `serial` flag via `hasInternalConflict` helper. Cycle detection dumps
remainder with `cycle: true` flag (V5 security pattern, no infinite loop).

### 12-02-02 — v1 fallback branch + verify.mjs invariants 3-5

Add the v1 early-return branch per D-07: `plan.schema_version !== 2` → single-wave-all-serial.
Append invariants 3 (exports typeof), 4 (v2 non-cyclic ascending waves), 5 (v1 fallback
single-serial) to Phase-12 `verify.mjs`. Running `node verify.mjs` exits 0 post-commit
(invariants 1-5 all green).

### 12-02-03 — SKILL.md dispatch rule 6.e integration + SUMMARY

Replace the single-agent dispatch at line 282 with the wave-loop pattern from §Q2. Keep
the serial branch for `w.serial || w.taskIds.length === 1`; author the parallel branch
with `run_in_background: true` fan-out + `await`-all. Prose explicitly documents:
- D-08 (no cancellation on BLOCKER; halt after remaining parallel tasks settle)
- §Risk 3 (per-dispatch ATC runs SEQUENTIALLY per report post-wave)
Spike-conditional flavour: if 12-02-00 said `SERIALIZED_FALLBACK`, the parallel branch is
still authored (DAG advisory) but prose notes runtime falls back to serial per spike.
Produce 12-02-SUMMARY.md.

## Verification Gates (Wave close)

1. 12-02-00 spike document exists + verdict in {PARALLEL_CONFIRMED, SERIALIZED_FALLBACK} → PASS
2. dispatch-planner v2 smoke (explicit-dep + file-overlap + disjoint-parallel + cycle-safe) → exit 0
3. dispatch-planner v1 smoke (single-wave-all-serial + empty-tasks) → exit 0
4. `verify.mjs` contains Invariant 3/4/5 markers → count ≥ 3
5. `node .planning/phases/12-machinery/verify.mjs` → exit 0
6. `grep -q "dispatch-planner" SKILL.md` → exit 0
7. `grep -q "buildDispatchPlan" SKILL.md` → exit 0
8. `grep -q "run_in_background" SKILL.md` → exit 0 (first-ever hit in this file)
9. `test -f .planning/phases/12-machinery/plans/12-02-SUMMARY.md` → exit 0

## Success Criteria

- All 4 task `verification_cmd`s exit 0.
- `dispatch-planner.cjs` passes all 5 falsifier cases (export / depends_on / overlap /
  disjoint-parallel / cycle / v1 / empty).
- Phase-12 `verify.mjs` runs green on invariants 1-5.
- SKILL.md integration markers all present; D-08 and §Risk 3 prose visible.
- Spike evidence captured — Risk 2 not deferred.

## Output

After completion, `12-02-SUMMARY.md` records:
- Spike verdict verbatim from 12-02-00
- 2 committed modules (dispatch-planner.cjs, SKILL.md edit)
- verify.mjs state (invariants 1-5 green)
- Commit SHAs (one per 12-02-0N task)
- Handoff to plan 12-03 (Wave 3: checkpoint schema + 85% cap).
