---
schema_version: 2
phase: 54
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: ["53"]
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - super-gsd/tools/chaos-restart/harness.cjs
  - super-gsd/tools/chaos-restart/manifest-validator.cjs
  - super-gsd/tools/chaos-restart/run-self-test.cjs
  - super-gsd/tools/chaos-restart/fixtures/mid-research/checkpoint.md
  - super-gsd/tools/chaos-restart/fixtures/mid-research/state.md
  - super-gsd/tools/chaos-restart/fixtures/mid-research/README.md
  - super-gsd/tools/chaos-restart/fixtures/mid-plan/checkpoint.md
  - super-gsd/tools/chaos-restart/fixtures/mid-plan/state.md
  - super-gsd/tools/chaos-restart/fixtures/mid-plan/README.md
  - super-gsd/tools/chaos-restart/fixtures/mid-execute/checkpoint.md
  - super-gsd/tools/chaos-restart/fixtures/mid-execute/state.md
  - super-gsd/tools/chaos-restart/fixtures/mid-execute/README.md
  - super-gsd/tools/chaos-restart/fixtures/mid-verify/checkpoint.md
  - super-gsd/tools/chaos-restart/fixtures/mid-verify/state.md
  - super-gsd/tools/chaos-restart/fixtures/mid-verify/README.md
  - super-gsd/tools/chaos-restart/fixtures/mid-close/checkpoint.md
  - super-gsd/tools/chaos-restart/fixtures/mid-close/state.md
  - super-gsd/tools/chaos-restart/fixtures/mid-close/README.md
  - super-gsd/scripts/sgsd-complete-milestone.cjs
  - .planning/metrics/chaos-restart-log.jsonl
requirements:
  - CHAOS-RESTART-01
  - CHAOS-RESTART-02
  - CHAOS-RESTART-03
  - CHAOS-RESTART-04
  - CHAOS-RESTART-05
  - MANIFEST-VALID-01
tags:
  - chaos-restart
  - mid-phase-kill-simulation
  - manifest-validator
  - quad-gate-v2.0
  - 5-kill-points
  - phase-54
  - v2.0
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/chaos-restart/manifest-validator.cjs
      - super-gsd/tools/chaos-restart/harness.cjs
      - super-gsd/tools/chaos-restart/fixtures/mid-research/checkpoint.md
      - super-gsd/tools/chaos-restart/fixtures/mid-research/state.md
      - super-gsd/tools/chaos-restart/fixtures/mid-research/README.md
      - super-gsd/tools/chaos-restart/fixtures/mid-plan/checkpoint.md
      - super-gsd/tools/chaos-restart/fixtures/mid-plan/state.md
      - super-gsd/tools/chaos-restart/fixtures/mid-plan/README.md
      - super-gsd/tools/chaos-restart/fixtures/mid-execute/checkpoint.md
      - super-gsd/tools/chaos-restart/fixtures/mid-execute/state.md
      - super-gsd/tools/chaos-restart/fixtures/mid-execute/README.md
      - super-gsd/tools/chaos-restart/fixtures/mid-verify/checkpoint.md
      - super-gsd/tools/chaos-restart/fixtures/mid-verify/state.md
      - super-gsd/tools/chaos-restart/fixtures/mid-verify/README.md
      - super-gsd/tools/chaos-restart/fixtures/mid-close/checkpoint.md
      - super-gsd/tools/chaos-restart/fixtures/mid-close/state.md
      - super-gsd/tools/chaos-restart/fixtures/mid-close/README.md
    input_contract: 54-CONTEXT.md + 54-RESEARCH.md + Phase 53 harness pattern reference (NOT imported - mirrored)
    output_contract: chaos-restart harness skeleton (8 public APIs Lock-13 wrapped) + manifest validator (closed-vocab REQUIRED_FIELDS, validateManifest) + 5 fixture dirs each with checkpoint.md + state.md + README.md
    hypothesis: A real subprocess kill via spawnSync timeout, paired with closed-vocab REQUIRED_FIELDS, gives mechanical fail-closed coverage of the 5 named mid-phase kill points.
    falsifier: If the simulator child process exits cleanly (no SIGTERM signal) OR the manifest validator accepts a checkpoint missing a required field, the contract is broken.
    stop_rule: node super-gsd/tools/chaos-restart/manifest-validator.cjs --self-test exits 0 AND node super-gsd/tools/chaos-restart/harness.cjs --help exits 0.
    verification_cmd: "node super-gsd/tools/chaos-restart/manifest-validator.cjs --self-test"
  - id: T2
    agent: gsd-executor
    model: sonnet
    depends_on: ["T1"]
    files_touched:
      - super-gsd/tools/chaos-restart/harness.cjs
      - super-gsd/tools/chaos-restart/run-self-test.cjs
      - .planning/metrics/chaos-restart-log.jsonl
    input_contract: T1 skeleton + 18-assertion list-lock from 54-RESEARCH.md sec 4
    output_contract: harness selfTest() body wired (5 frozen-surface + 5 scenarios + 7 manifest tests + 1 anti-pollution = 18) + run-self-test thin shell + first envelope-v1 row in chaos-restart-log.jsonl
    hypothesis: Wiring 18 list-locked assertions covering frozen-surfaces + 5 scenarios + 7 manifest cases + 1 anti-pollution invariant gives complete coverage of the contract surface without false positives.
    falsifier: Any assertion fails OR run-all writes any byte to a canonical stream OTHER than chaos-restart-log.jsonl.
    stop_rule: node super-gsd/tools/chaos-restart/harness.cjs --self-test exits 0 with 18/18 PASS AND run-self-test.cjs exits 0 (dual-pass).
    verification_cmd: "node super-gsd/tools/chaos-restart/run-self-test.cjs"
  - id: T3
    agent: gsd-executor
    model: sonnet
    depends_on: ["T2"]
    files_touched:
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    input_contract: Phase 53 triple-gate sgsd-complete-milestone.cjs at HEAD
    output_contract: surgical extension appending chaos-restart self-test as 5th spawn after failure-injection --run-all (v2.0 quad-gate); v1.9 dual-gate path byte-untouched
    hypothesis: Appending the chaos-restart spawn block AFTER the failure-injection --run-all output preserves Lock 4 byte-equality on prior code AND extends the v2.0 gate to a 4-step quad-gate without touching the v1.9 path.
    falsifier: git diff on the v1.9 dual-gate code path shows ANY byte change OR v1.9 gate exit code changes from 0.
    stop_rule: v1.9 gate exits 0 (no regression) AND v2.0 gate exits 0 (5 spawns green) AND git diff --quiet on Phase 41-53 trees + cockpit-shell.
    verification_cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0"
  - id: T4
    agent: gsd-executor
    model: sonnet
    depends_on: ["T3"]
    files_touched:
      - .planning/milestones/v2.0/phases/54-restart-handoff-chaos-tests/54-RESEARCH.md
      - .planning/milestones/v2.0/phases/54-restart-handoff-chaos-tests/54-VERIFICATION.md
      - .planning/milestones/v2.0/phases/54-restart-handoff-chaos-tests/WASTE.md
      - .planning/milestones/v2.0/phases/54-restart-handoff-chaos-tests/commit-reviews.jsonl
      - .planning/STATE.md
    input_contract: T1-T3 evidence + STATE.md current_phase=54
    output_contract: 4 closing artifacts written + STATE.md advanced to current_phase=55 + atomic close commit
    hypothesis: Documenting the design + verification evidence + waste audit + per-task commit reviews gives downstream readers (Phase 55+) sufficient context to consume the chaos-restart contract by reference.
    falsifier: Any artifact missing OR STATE.md still showing current_phase=54 OR phase_54 row missing from v2.0 progress.
    stop_rule: All 4 artifacts present AND STATE.md current_phase=55 AND v2_0_progress.phase_54 PASS row present AND atomic close commit fired.
    verification_cmd: null
---

# Phase 54-01 - Restart + Handoff Chaos Tests Plan

## Objective

Ship a chaos-restart harness that simulates mid-phase subprocess kill at 5
named points + a manifest-shape validator for ORCHESTRATOR-CHECKPOINT.md.
Quad-gate the v2.0 milestone-close on the harness self-test passing 18/18.

## Context

@.planning/milestones/v2.0/phases/54-restart-handoff-chaos-tests/54-CONTEXT.md
@.planning/milestones/v2.0/phases/54-restart-handoff-chaos-tests/54-RESEARCH.md

## Tasks

<task id="T1" type="auto" tdd="false">
<title>Chaos-restart harness skeleton + manifest validator + 5 kill-point fixtures</title>

<behavior>
The harness exposes 8 public APIs (Lock-13 wrapped):
- runAll, runChaosScenario, validateManifest, selfTest,
  aggregateResults, appendLogRow + frozen surfaces
  (KILL_POINTS, FAIL_INJ_REASON_CODES, REQUIRED_FIELDS).

The manifest validator validates ORCHESTRATOR-CHECKPOINT.md frontmatter:
- REQUIRED_FIELDS = Object.freeze(['next_unit', 'controlling_principle',
  'mode', 'emergency_halt', 'session', 'created']).
- Returns {ok, missing_fields[], reason} with closed-vocab reasons.

5 fixture directories under fixtures/ with checkpoint.md + state.md + README.md.
</behavior>

<implementation>
1. CREATE super-gsd/tools/chaos-restart/manifest-validator.cjs (~350L).
   Hand-rolled YAML-subset frontmatter parser + validateManifest.
2. CREATE super-gsd/tools/chaos-restart/harness.cjs (~1200L).
   8 public APIs, 11-stream fingerprint guard, real subprocess kill
   simulation via spawnSync timeout.
3. CREATE super-gsd/tools/chaos-restart/fixtures/mid-research/{checkpoint.md,state.md,README.md}.
4. CREATE super-gsd/tools/chaos-restart/fixtures/mid-plan/{checkpoint.md,state.md,README.md}.
5. CREATE super-gsd/tools/chaos-restart/fixtures/mid-execute/{checkpoint.md,state.md,README.md}.
6. CREATE super-gsd/tools/chaos-restart/fixtures/mid-verify/{checkpoint.md,state.md,README.md}.
7. CREATE super-gsd/tools/chaos-restart/fixtures/mid-close/{checkpoint.md,state.md,README.md}.
</implementation>

<verification>
node super-gsd/tools/chaos-restart/manifest-validator.cjs --self-test exits 0.
node super-gsd/tools/chaos-restart/harness.cjs --help exits 0.
</verification>

<done_criteria>
- harness.cjs imports cleanly via require().
- manifest-validator.cjs exports REQUIRED_FIELDS, validateManifest.
- All 5 fixture dirs contain checkpoint.md, state.md, README.md.
- ASCII-only.
</done_criteria>
</task>

<task id="T2" type="auto" tdd="false">
<title>18-assertion self-test + run-self-test thin shell</title>

<behavior>
The harness selfTest() method runs 18 assertions:
- 1-5: KILL_POINTS / FAIL_INJ_REASON_CODES / REQUIRED_FIELDS frozen +
  public_api_8_surface + lock13_wrapper + ASCII clean.
- 6-10: each of 5 kill-point scenarios PASS via runChaosScenario.
- 11-16: 6 manifest-validator missing-field cases (one per REQUIRED_FIELDS
  entry) all rejected with reason manifest_missing_field.
- 17: validateManifest returns manifest_valid on a complete fixture.
- 18: canonical streams byte-untouched after a full run-all.

The run-self-test.cjs thin shell spawns harness --self-test, then on green
spawns harness --run-all, propagates exit codes verbatim.
</behavior>

<implementation>
1. EDIT super-gsd/tools/chaos-restart/harness.cjs - selfTest() body.
2. CREATE super-gsd/tools/chaos-restart/run-self-test.cjs (~100L).
3. CREATE .planning/metrics/chaos-restart-log.jsonl (envelope-v1 first row
   from a self-test run).
</implementation>

<verification>
node super-gsd/tools/chaos-restart/harness.cjs --self-test exits 0 with 18/18 PASS.
node super-gsd/tools/chaos-restart/run-self-test.cjs exits 0 (dual-pass green).
chaos-restart-log.jsonl contains a JSON row with envelope_version=1, verdict=PASS, total=5.
</verification>

<done_criteria>
- 18/18 PASS on self-test.
- 5/5 PASS on run-all.
- Envelope-v1 row present in chaos-restart-log.jsonl.
</done_criteria>
</task>

<task id="T3" type="auto" tdd="false">
<title>v2.0 quad-gate surgical extension in sgsd-complete-milestone.cjs</title>

<behavior>
Phase 53 wired the v2.0 triple-gate (context-bench + redis-adapter +
failure-injection). Phase 54 extends this to a quad-gate by appending a
4th-step block AFTER the failure-injection --run-all gate output. The
v1.9 dual-gate path is preserved byte-untouched: the chaos-restart block
is reached ONLY when milestone === 'v2.0'.

Lock 13: try/catch on require AND on spawnSync; never throw upward.
Lock 4: only the surgical insertion point is modified; all prior code
stays byte-equal.
</behavior>

<implementation>
1. EDIT super-gsd/scripts/sgsd-complete-milestone.cjs - append the
   chaos-restart require + spawnSync block after the failure-injection
   --run-all output. Update the header docstring to mention Phase 54.
</implementation>

<verification>
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 exits 0
  (no regression; dual-gate green: context-bench + redis-adapter).
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 exits 0
  (quad-gate green: context-bench + redis-adapter + failure-injection +
  chaos-restart).
git diff --quiet -- super-gsd/tools/failure-injection/ exits 0 (Phase 53
  byte-untouched).
</verification>

<done_criteria>
- v1.9 gate exits 0.
- v2.0 gate exits 0.
- Phase 53 tree byte-untouched.
</done_criteria>
</task>

<task id="T4" type="auto" tdd="false">
<title>End-of-phase artifacts (RESEARCH, VERIFICATION, WASTE, commit-reviews)</title>

<behavior>
Write the 4 closing artifacts: 54-RESEARCH.md (~300L), 54-VERIFICATION.md
(close summary), WASTE.md (sgsd-muda-audit.sh 54), commit-reviews.jsonl
(per-task evidence). Final atomic close commit advances STATE.md to
current_phase=55.
</behavior>

<implementation>
1. CREATE 54-RESEARCH.md.
2. CREATE 54-VERIFICATION.md.
3. CREATE WASTE.md (or run sgsd-muda-audit.sh 54 if available).
4. CREATE commit-reviews.jsonl.
5. EDIT .planning/STATE.md (advance current_phase 54 -> 55).
</implementation>

<verification>
All 4 artifacts present.
STATE.md current_phase=55 with phase_54 PASS row.
</verification>

<done_criteria>
- 4 artifacts created.
- STATE.md advanced.
- Phase close atomic commit fired.
</done_criteria>
</task>

## Success Criteria (Phase-Level)

- [x] All 5 kill-point scenarios PASS via runChaosScenario.
- [x] All 6 missing-field manifest cases rejected.
- [x] Harness self-test 18/18 green.
- [x] run-self-test dual-pass green.
- [x] v2.0 quad-gate green (5 spawns).
- [x] v1.9 dual-gate green (no regression).
- [x] Phase 41-53 trees byte-untouched (Lock 4).
- [x] cockpit-shell byte-untouched.
- [x] ASCII-only across all changed files.
- [x] Envelope-v1 row present in chaos-restart-log.jsonl.

## Output Specification

| File                                                                                   | Action     | Approx Size |
| -------------------------------------------------------------------------------------- | ---------- | ----------- |
| super-gsd/tools/chaos-restart/harness.cjs                                              | CREATE     | ~1200 L     |
| super-gsd/tools/chaos-restart/manifest-validator.cjs                                   | CREATE     | ~350 L      |
| super-gsd/tools/chaos-restart/run-self-test.cjs                                        | CREATE     | ~100 L      |
| super-gsd/tools/chaos-restart/fixtures/mid-*/checkpoint.md (5 files)                   | CREATE     | ~25 L each  |
| super-gsd/tools/chaos-restart/fixtures/mid-*/state.md (5 files)                        | CREATE     | ~15 L each  |
| super-gsd/tools/chaos-restart/fixtures/mid-*/README.md (5 files)                       | CREATE     | ~30 L each  |
| super-gsd/scripts/sgsd-complete-milestone.cjs                                          | EDIT       | +~80 L      |
| .planning/metrics/chaos-restart-log.jsonl                                              | CREATE     | 1 JSON row  |
| .planning/milestones/v2.0/phases/54-*/54-RESEARCH.md                                   | CREATE     | ~300 L      |
| .planning/milestones/v2.0/phases/54-*/54-VERIFICATION.md                               | CREATE     | ~150 L      |
| .planning/milestones/v2.0/phases/54-*/WASTE.md                                         | CREATE     | ~30 L       |
| .planning/milestones/v2.0/phases/54-*/commit-reviews.jsonl                             | CREATE     | 1 JSON row  |
