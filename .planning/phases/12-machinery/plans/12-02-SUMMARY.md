---
phase: 12-machinery
plan: "02"
subsystem: orchestrator-dispatch
tags: [MACH-02, dispatch-planner, parallel-dispatch, topo-sort, DAG, wave-model]
schema_version: 2

dependency_graph:
  requires:
    - 12-01  # wave serialization; classifier-cache pattern reference
  provides:
    - dispatch-planner.cjs  # wave-layered executor dispatch
    - SKILL.md dispatch rule 6.e wave-loop integration
    - verify.mjs invariants 3-5 (MACH-02 contract)
  affects:
    - super-gsd/skills/sgsd-orchestrate/SKILL.md  # rule 6.e replaced
    - .planning/phases/12-machinery/verify.mjs    # invariants 3-5 appended

tech_stack:
  added:
    - super-gsd/scripts/lib/dispatch-planner.cjs  # new pure-CJS module, zero deps
  patterns:
    - Kahn topo-sort for DAG wave layering
    - Implicit file-overlap edges (D-05a)
    - Per-wave serial flag via hasInternalConflict helper
    - Cycle detection: dump remainder with cycle:true flag (V5)
    - v1 fallback: schema_version !== 2 → single serial wave (D-07)

key_files:
  created:
    - super-gsd/scripts/lib/dispatch-planner.cjs
    - .planning/phases/12-machinery/plans/12-02-00-spike.md
    - .planning/phases/12-machinery/plans/12-02-SUMMARY.md
  modified:
    - super-gsd/skills/sgsd-orchestrate/SKILL.md  # dispatch rule 6.e
    - .planning/phases/12-machinery/verify.mjs     # invariants 3-5

decisions:
  - "PARALLEL_CONFIRMED: 3 background dispatches in one message started within 666ms; Risk 2 resolved"
  - "dispatch-planner.cjs: pure CJS, zero deps, ~131 LOC; Kahn topo-sort + implicit file-overlap edges"
  - "SKILL.md rule 6.e: wave-loop replaces single-agent dispatch; parallel branch is live (not advisory stub)"
  - "D-08: no cancellation on BLOCKER; halt after remaining parallel tasks settle (documented in rule 6.e)"
  - "Risk 3: per-dispatch ATC (Step 9.5) runs sequentially per report after parallel wave settles"
  - "v1 fallback early-return included in dispatch-planner.cjs from task 12-02-01 (not a separate commit)"

metrics:
  duration: "~30 minutes"
  completed: "2026-04-22"
  tasks_completed: 4
  files_changed: 4
---

# Phase 12 Plan 02: Dispatch Planner (MACH-02) Summary

**One-liner:** Kahn topo-sort DAG dispatch planner with implicit file-overlap edges, per-wave serial flag, and wave-loop integration in SKILL.md rule 6.e.

---

## Artifacts

| Artifact | Purpose |
|----------|---------|
| `super-gsd/scripts/lib/dispatch-planner.cjs` | Pure CJS module exporting `{buildDispatchPlan}`; Kahn topo-sort on explicit `depends_on` + implicit `files_touched` overlap; v1 fallback; cycle detection |
| `.planning/phases/12-machinery/plans/12-02-00-spike.md` | Live smoke evidence: 3 parallel background dispatches, PARALLEL_CONFIRMED verdict, Risk 2 resolved |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Dispatch rule 6.e now wave-aware; parallel branch with `run_in_background: true` + await-all; D-08 and §Risk 3 prose |
| `.planning/phases/12-machinery/verify.mjs` | Invariants 3-5 appended (exports, v2 DAG non-cyclic ascending, v1 single-serial) |

---

## Spike Verdict

**PARALLEL_CONFIRMED**

Three trivial Bash background tasks dispatched in one message (tool call IDs:
`toolu_013jQXqVccartsFNdiT1pkfJ`, `toolu_017aSKTfiTABHer3ntD5uB4Q`, `toolu_01DM9GxBateFZrHWv9XmhPnT`).

| Dispatch | Start Timestamp              | Delta from A |
|----------|------------------------------|--------------|
| A        | 2026-04-22T18:35:22.828Z     | 0 ms         |
| B        | 2026-04-22T18:35:23.492Z     | +664 ms      |
| C        | 2026-04-22T18:35:23.494Z     | +666 ms      |

All three completed before the harvest read at `2026-04-22T18:35:28.691Z`. B and C started
while A was still running — confirming concurrent execution. Risk 2 resolved.

---

## Commit SHAs

| Task    | SHA       | Message                                                        |
|---------|-----------|----------------------------------------------------------------|
| 12-02-00 | dca8ef6  | feat(12-02): 12-02-00 live spike — PARALLEL_CONFIRMED          |
| 12-02-01 | 1deef53  | feat(12-02): dispatch-planner.cjs v2 algorithm (MACH-02)       |
| 12-02-02 | 9c866f8  | feat(12-02): verify.mjs invariants 3-5 + dispatch-planner v1 fallback confirmed |
| 12-02-03 | 8e63854  | feat(12-02): SKILL.md rule 6.e wave-loop integration + plan 02 SUMMARY |

---

## Verification Gates — All Passed

1. Spike document exists + PARALLEL_CONFIRMED verdict + Observations section → PASS
2. dispatch-planner v2 smoke (explicit-dep + file-overlap + disjoint-parallel + cycle-safe) → exit 0
3. dispatch-planner v1 smoke (single-wave-all-serial + empty-tasks) → exit 0
4. `verify.mjs` contains Invariant 3/4/5 markers → count 3 (≥ 3) → PASS
5. `node .planning/phases/12-machinery/verify.mjs` → exit 0 (invariants 1-5 all green)
6. `grep -q "dispatch-planner" SKILL.md` → exit 0
7. `grep -q "buildDispatchPlan" SKILL.md` → exit 0
8. `grep -q "run_in_background" SKILL.md` → exit 0 (first-ever hit in this file)
9. `test -f .planning/phases/12-machinery/plans/12-02-SUMMARY.md` → exit 0

---

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] v1 fallback included in 12-02-01 commit**

- **Found during:** Task 12-02-02
- **Issue:** Plan 12-02-02 says "add the v1 early-return branch per D-07 if 12-02-01 didn't include it." The research module shape in 12-RESEARCH.md §Q2 included the v1 fallback as the first branch of `buildDispatchPlan`. 12-02-01 implemented the full recommended module shape including the v1 branch.
- **Fix:** No separate edit needed in 12-02-02. verify.mjs Invariant 5 still asserts the v1 contract independently. No code was lost.
- **Impact:** None — contract verified by Invariant 5; all falsifier cases pass.

---

## Next

**Plan 12-03** (Wave 3): Checkpoint schema expansion + 85% hard cap.

- Adds three new checkpoint frontmatter fields (`approaches_tried_and_abandoned`,
  `rules_learned_this_session`, `dispatches_summary`) to `super-gsd/templates/checkpoint.md`.
- Extends SKILL.md checkpoint_protocol section with 85% emergency halt instruction (D-11).
- Appends verify.mjs invariants 6-7 (checkpoint template fields + 85% instruction present).

The dispatch-planner module is now available for plan 12-03 to reference as a dependency pattern.
