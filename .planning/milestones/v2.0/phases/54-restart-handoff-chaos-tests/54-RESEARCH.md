---
phase: 54
plan: 01
milestone: v2.0
type: research
created: 2026-04-29
sources:
  - .planning/ROADMAP-AGENT.md (line 650)
  - 54-CONTEXT.md
  - 53-RESEARCH.md (Phase 53 patterns)
  - 53-VERIFICATION.md (Phase 53 close evidence)
  - super-gsd/tools/failure-injection/harness.cjs (mirror reference)
  - super-gsd/scripts/sgsd-complete-milestone.cjs (gate insertion point)
---

# Phase 54 Research - Restart + Handoff Chaos Tests

## 1. Goal Restatement

Mid-phase kill simulation at 5 named points (mid-research / mid-plan /
mid-execute / mid-verify / mid-close) + manifest-shape validation on
ORCHESTRATOR-CHECKPOINT.md. Locked decision: **54=C** (real subprocess
kill via spawnSync timeout + manifest validator with closed-vocab
REQUIRED_FIELDS).

The acceptance bar from CONTEXT.md:

- Each of 5 kill points yields a valid resume scenario; harness verifies
  the workflow can resume from checkpoint and reach phase close.
- Manifest validator rejects checkpoint with missing required field.

## 2. Design Decisions

### 2.1 Kill simulation mechanism

**Decision**: real subprocess kill via `child_process.spawnSync` with a
short timeout (200ms). The simulator child writes a `PARTIAL_WRITE:<kp>`
sentinel to stdout, then loops forever via `setTimeout`. The parent
spawnSync timeout drives a SIGTERM that kills the child mid-execution.

**Rationale**: this matches Phase 53's _spawnTool branch B precedent and
makes the kill observable (spawnSync reports `signal === 'SIGTERM'` and
`status === null`). A pure mock-predicate approach would not exercise the
real OS process lifecycle, which is the point of chaos testing.

**Alternative rejected**: in-process throw simulation. Could not reliably
exercise the partial-write -> resume path, and would not produce a real
SIGTERM signal that future tooling could observe.

### 2.2 Resume probe contract

**Decision**: the resume probe consumes the synthetic checkpoint.md and
state.md from each fixture's tmpdir copy, calls `validateManifest`, then
emits a `synthetic-close.sentinel` file in the tmpdir to prove the resume
path executed end-to-end.

**Verdict tree** (per scenario):

| Pre-condition                              | Verdict                | Reason                       |
| ------------------------------------------ | ---------------------- | ---------------------------- |
| canonical streams drifted post-scenario    | FAIL                   | chaos_fail_canonical_drift   |
| validateManifest returned ok=false         | FAIL                   | chaos_fail_manifest_invalid  |
| synthetic_close_emitted=false              | FAIL                   | chaos_fail_resume_blocked    |
| spawn.ok=false (simulator itself failed)   | FAIL                   | chaos_fail_timeout           |
| else                                       | PASS                   | chaos_pass                   |

**Rationale**: closed-vocab reason codes mirror Phase 53's
FAIL_INJ_REASON_CODES contract. The 4-state verdict tree is set-membership
only (Lock 11 byte-equality on the boolean flags from probe / spawn /
fingerprint).

### 2.3 Manifest validator REQUIRED_FIELDS

**Decision**: 6-entry frozen closed-vocab list:

```
['next_unit', 'controlling_principle', 'mode',
 'emergency_halt', 'session', 'created']
```

**Rationale**: these are the load-bearing fields in the real
`.planning/ORCHESTRATOR-CHECKPOINT.md`. A resume that lacks `next_unit`
has no dispatch target. A resume that lacks `controlling_principle` may
silent-stop on the next ambiguous decision. A resume that lacks
`emergency_halt` cannot distinguish autopilot from halted-by-operator.
`mode` discriminates autonomous vs interactive; `session` carries the
model+context-window identifier; `created` provides the staleness anchor.

**Field treatment**: a field is counted as "missing" if absent OR null OR
empty-string. Booleans (including `false`) and numbers (including `0`)
ARE valid presences (so `emergency_halt: false` is NOT missing).

### 2.4 Public API surface

**Decision**: 8 entries on module.exports, all Lock-13 wrapped:

1. `runAll(opts)` - top-level driver, 5 scenarios + aggregate.
2. `runChaosScenario(args)` - per-scenario driver.
3. `validateManifest(path)` - re-exported from manifest-validator.cjs.
4. `selfTest()` - 18-assertion bootstrap suite.
5. `aggregateResults(rs)` - cross-scenario verdict tree.
6. `appendLogRow(row, opts)` - envelope-v1 JSONL writer.
7. `_internals` - bag of helpers for cross-task composition.
8. Frozen surfaces: `KILL_POINTS`, `FAIL_INJ_REASON_CODES`,
   `REQUIRED_FIELDS`, `PHASE_54_GUARDED_STREAMS` (counted as part of the
   public-API contract since they are read-only exports consumed by
   downstream tooling).

**Rationale**: mirrors Phase 53's 9-stub pattern. The `selfTest A4`
assertion verifies module.exports identity-equality with internal scope
references (Phase 53 contract).

### 2.5 11-stream fingerprint guard

**Decision**: the `PHASE_54_GUARDED_STREAMS` constant is byte-equal to
Phase 53's `PHASE_53_GUARDED_STREAMS`. The harness fingerprints the
project's real `.planning/metrics/*.jsonl` set pre/post each scenario
AND pre/post the full --run-all in the bootstrap suite (assertion 18).

**Rationale**: the chaos harness MUST be a perfect canonical-stream-
respecting tool. Any drift -> FAIL chaos_fail_canonical_drift. This is
the same anti-pollution invariant as Phase 53.

## 3. Locked Invariants

- **Lock 4**: Phase 41-53 trees byte-untouched. The chaos-restart harness
  never imports anything from those trees; it duplicates safe patterns
  locally. The only exception is the surgical insertion in
  `sgsd-complete-milestone.cjs` (a single block appended after the
  failure-injection --run-all gate output - the prior code is preserved
  verbatim above the insertion point).
- **Lock 11**: byte-equality on field validation. Field names match
  literally; closed-vocab reason codes match by string equality.
- **Lock 13**: every public API wraps internals in try/catch; never
  throws upward. Every internal helper that touches FS or spawns wraps
  errors in degraded sentinels.
- **ASCII-only**: no smart quotes, no emoji, no non-ASCII anywhere in
  the harness, validator, fixtures, or thin shell.

## 4. Self-Test Coverage Map (18 assertions)

| #   | Assertion                                                | Invariant                          |
| --- | -------------------------------------------------------- | ---------------------------------- |
| 1   | KILL_POINTS_frozen_5_entry_ordered                       | Lock 11 freeze + closed-vocab      |
| 2   | FAIL_INJ_REASON_CODES_frozen_ge11                        | reason vocabulary floor            |
| 3   | REQUIRED_FIELDS_frozen_6_entry_ordered                   | manifest contract                  |
| 4   | public_api_8_surface_identity_equal                      | Lock 13 surface + me identity      |
| 5   | lock13_wrapper_present_and_ascii_clean                   | Lock 13 + ASCII                    |
| 6   | kill_point_mid_research_PASS                             | scenario 1 acceptance              |
| 7   | kill_point_mid_plan_PASS                                 | scenario 2 acceptance              |
| 8   | kill_point_mid_execute_PASS                              | scenario 3 acceptance              |
| 9   | kill_point_mid_verify_PASS                               | scenario 4 acceptance              |
| 10  | kill_point_mid_close_PASS                                | scenario 5 acceptance              |
| 11  | manifest_missing_next_unit_rejected                      | manifest validator missing-field-1 |
| 12  | manifest_missing_controlling_principle_rejected          | manifest validator missing-field-2 |
| 13  | manifest_missing_mode_rejected                           | manifest validator missing-field-3 |
| 14  | manifest_missing_emergency_halt_rejected                 | manifest validator missing-field-4 |
| 15  | manifest_missing_session_rejected                        | manifest validator missing-field-5 |
| 16  | manifest_missing_created_rejected                        | manifest validator missing-field-6 |
| 17  | manifest_valid_complete_fixture                          | manifest validator happy path      |
| 18  | runall_canonical_streams_byte_equal                      | anti-pollution invariant           |

## 5. Fixture Layout

Five fixture directories under `super-gsd/tools/chaos-restart/fixtures/`:
- `mid-research/` - researcher killed after partial RESEARCH.md write
- `mid-plan/` - planner killed after partial PLAN.md write
- `mid-execute/` - executor killed mid-task-T3 (T1, T2 already committed)
- `mid-verify/` - verifier killed mid-VERIFICATION.md write
- `mid-close/` - close commit killed after STATE.md edit, before commit

Each contains:
- `checkpoint.md` - synthetic ORCHESTRATOR-CHECKPOINT.md with all 6
  REQUIRED_FIELDS populated AND `killed_at_step:<kp>`.
- `state.md` - synthetic STATE.md with `current_phase: 99` and
  `killed_at_step: <kp>`.
- `README.md` - per-fixture documentation of the kill point and resume
  expectation.

## 6. Milestone-Close Quad-Gate

Phase 53 wired the v2.0 triple-gate (context-bench + redis-adapter +
failure-injection). Phase 54 surgically extends this to a quad-gate by
appending a 4th-step block AFTER the failure-injection --run-all output
in `sgsd-complete-milestone.cjs`:

```
1. context-bench self-test (Phase 51)            33/33
2. redis-adapter self-test (Phase 52)            26/26
3. failure-injection self-test (Phase 53)        24/24
4. failure-injection --run-all (Phase 53)        10/10
5. chaos-restart self-test (Phase 54)            18/18
```

All five spawnSync invocations must exit 0 for `--milestone v2.0` to
exit 0. The v1.9 dual-gate path is preserved byte-untouched: the
chaos-restart block is reached ONLY when `milestone === 'v2.0'`.

**Decision (NOT chained)**: the Phase 54 --run-all path is intentionally
not chained as a separate 6th spawn. The harness self-test at assertion
18 already exercises the full driver (runs `runAll({no_log: true})` and
asserts 5/5 PASS without canonical drift). Adding a 6th spawn would
double-write to `chaos-restart-log.jsonl` on every milestone-close call,
inflating the log without adding new evidence.

## 7. Falsifiers (Anti-Drift)

The following would make this research falsifiable:

- **F1**: any change to KILL_POINTS order or membership requires a new
  phase artifact. Frozen.
- **F2**: any change to REQUIRED_FIELDS membership requires a new phase
  artifact. Adding a field is a breaking change to every existing
  ORCHESTRATOR-CHECKPOINT.md.
- **F3**: any new self-test assertion requires a new phase artifact.
  18 is the contract count.
- **F4**: any non-ASCII character introduced into the harness, validator,
  fixtures, or thin shell is a Lock violation.
- **F5**: any drift in the canonical 11-stream fingerprint after a
  --run-all is a chaos_fail_canonical_drift verdict.

## 8. Outputs

Per CONTEXT.md:
- `super-gsd/tools/chaos-restart/harness.cjs` (CREATE, ~1200 lines)
- `super-gsd/tools/chaos-restart/manifest-validator.cjs` (CREATE, ~350 lines)
- `super-gsd/tools/chaos-restart/run-self-test.cjs` (CREATE, ~100 lines)
- `super-gsd/tools/chaos-restart/fixtures/{mid-research,mid-plan,mid-execute,mid-verify,mid-close}/{checkpoint.md,state.md,README.md}` (CREATE, 15 files)
- `super-gsd/scripts/sgsd-complete-milestone.cjs` (EDIT, surgical append after failure-injection --run-all)
- `.planning/metrics/chaos-restart-log.jsonl` (CREATE, envelope-v1 first row)
- 54-* artifacts (this file, PLAN, VERIFICATION, WASTE, commit-reviews)

## 9. Hand-off Note for Planner

Planner produces `54-01-restart-handoff-chaos-tests-PLAN.md` schema_v2
with 4-5 tasks:
- T1: chaos-restart harness skeleton + manifest validator + 5 fixture dirs
- T2: 18-assertion self-test wiring + run-self-test thin shell
- T3: v2.0 quad-gate surgical extension in sgsd-complete-milestone.cjs
- T4: end-of-phase artifacts (RESEARCH, VERIFICATION, WASTE, commit-reviews)

The plan was executed end-to-end in a single dispatch per the compressed
phase contract; T1-T4 have been collapsed into a single atomic commit.
