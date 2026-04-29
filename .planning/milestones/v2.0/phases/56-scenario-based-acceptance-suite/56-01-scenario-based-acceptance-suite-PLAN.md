---
schema_version: 2
phase: 56
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: ["55"]
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - super-gsd/tools/scenario-suite/harness.cjs
  - super-gsd/tools/scenario-suite/scenarios.json
  - super-gsd/tools/scenario-suite/SCENARIOS.schema.json
  - super-gsd/tools/scenario-suite/run-self-test.cjs
  - super-gsd/tools/scenario-suite/fixtures/clean-phase-close/PLAN.md
  - super-gsd/tools/scenario-suite/fixtures/plan-schema-load-valid/PLAN.md
  - super-gsd/tools/scenario-suite/fixtures/poisoned-plan-md/PLAN.md
  - super-gsd/tools/scenario-suite/fixtures/malformed-checkpoint/checkpoint.md
  - super-gsd/scripts/sgsd-complete-milestone.cjs
requirements:
  - SCENARIO-SUITE-01
  - SCENARIO-SUITE-02
  - SCENARIO-SUITE-03
  - SCENARIO-SUITE-04
  - SEXT-GATE-V2.0-01
tags:
  - scenario-suite
  - happy-path-suite
  - adversarial-suite
  - sext-gate-v2.0
  - phase-56
  - v2.0
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/scenario-suite/scenarios.json
      - super-gsd/tools/scenario-suite/SCENARIOS.schema.json
    input_contract: 56-CONTEXT.md + 56-RESEARCH.md + Phase 53 closed-vocab manifest pattern (mirror only - never imported)
    output_contract: 10-entry frozen scenarios.json (6 happy + 4 adversarial) + JSON-Schema draft-07 SCENARIOS.schema.json round-trip valid for every entry; closed enum on kind + expected_outcome
    hypothesis: A 10-entry closed-vocab manifest with byte-equal id matching plus an additionalProperties:false schema gives a stable contract that downstream T2-T3 cannot drift.
    falsifier: If the manifest contains fewer than 10 entries OR any entry fails round-trip schema validation OR the schema permits unknown keys, the contract is broken.
    stop_rule: Both files load without error AND scenarios array length === 10 AND every entry passes _validateScenarioEntry with zero errors.
    verification_cmd: "node super-gsd/tools/scenario-suite/harness.cjs --self-test"
  - id: T2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/scenario-suite/harness.cjs
      - super-gsd/tools/scenario-suite/run-self-test.cjs
      - super-gsd/tools/scenario-suite/fixtures/clean-phase-close/PLAN.md
      - super-gsd/tools/scenario-suite/fixtures/plan-schema-load-valid/PLAN.md
      - super-gsd/tools/scenario-suite/fixtures/poisoned-plan-md/PLAN.md
      - super-gsd/tools/scenario-suite/fixtures/malformed-checkpoint/checkpoint.md
    input_contract: scenarios.json + SCENARIOS.schema.json from T1 + Phase 53/54 harness pattern (mirror)
    output_contract: harness.cjs with 8 Lock-13 wrapped public APIs + 11-stream PHASE_56_GUARDED_STREAMS guard + 10 _runScenario_* impls (SH1-SH6 + SA1-SA4) + ~21 self-test assertions + run-self-test.cjs thin shell for dual-pass invocation
    hypothesis: A closed-vocab dispatch table from scenario.id to per-scenario _runScenario_* with each impl using spawnSync subprocess boundary + tmpdir isolation + byte-equality outcome oracle gives mechanical fail-closed coverage of all 10 scenarios.
    falsifier: If --self-test exits non-zero OR --run-all reports cross_run_drift > 0 OR any scenario verdict mismatches its expected_outcome, the harness is broken.
    stop_rule: node super-gsd/tools/scenario-suite/run-self-test.cjs exits 0 with dual-pass green (--self-test green + --run-all 10/10 green).
    verification_cmd: "node super-gsd/tools/scenario-suite/run-self-test.cjs"
  - id: T3
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    input_contract: existing quint-gate sgsd-complete-milestone.cjs from Phase 55 + scenario-suite harness from T2
    output_contract: sgsd-complete-milestone.cjs extended with a 6th gate (scenario-suite via spawnSync run-self-test.cjs) at the v2.0 milestone-close path; v1.9 dual-gate path + Phase 53 triple-gate + Phase 54 quad-gate + Phase 55 quint-gate paths preserved byte-untouched up to the scenario-suite insertion point
    hypothesis: A surgical extension that runs ONLY when milestone === 'v2.0' AND the prior 5 gates already passed preserves the v1.9 dual-gate AND Phase 53 triple-gate AND Phase 54 quad-gate AND Phase 55 quint-gate invariants.
    falsifier: If running --milestone v1.9 changes any observable output vs the Phase 55 baseline OR if --milestone v2.0 fails to exit 0 when all 6 self-tests pass, the contract is broken.
    stop_rule: node sgsd-complete-milestone.cjs --milestone v2.0 exits 0 with sext-gate green emission AND node sgsd-complete-milestone.cjs --milestone v1.9 exits 0 with the same dual-gate green emission as before Phase 56.
    verification_cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0"
  - id: T4
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/milestones/v2.0/phases/56-scenario-based-acceptance-suite/56-RESEARCH.md
      - .planning/milestones/v2.0/phases/56-scenario-based-acceptance-suite/56-VERIFICATION.md
      - .planning/milestones/v2.0/phases/56-scenario-based-acceptance-suite/WASTE.md
      - .planning/milestones/v2.0/phases/56-scenario-based-acceptance-suite/commit-reviews.jsonl
      - .planning/STATE.md
    input_contract: T1+T2+T3 implementations green
    output_contract: full 56-* artifact set (RESEARCH, VERIFICATION, WASTE) + commit-reviews.jsonl + STATE.md advanced 56->57 with phase_56 PASS row
    hypothesis: Closing the phase with the standard 56-* artifact set + STATE advance follows the Phase 41-55 precedent and emits the muda audit + verification artifacts the next phase / milestone close depends on.
    falsifier: If STATE.md current_phase is not 57 after T4 OR if any 56-* artifact is missing, the phase-close contract is broken.
    stop_rule: ls .planning/milestones/v2.0/phases/56-scenario-based-acceptance-suite/ shows {56-CONTEXT.md, 56-RESEARCH.md, 56-01-...-PLAN.md, 56-VERIFICATION.md, WASTE.md, PHASE-CAPSULE.json, commit-reviews.jsonl} AND STATE.md current_phase == 57.
    verification_cmd: "node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v2.0/phases/56-scenario-based-acceptance-suite/56-01-scenario-based-acceptance-suite-PLAN.md --mode load"
acceptance:
  - "node super-gsd/tools/scenario-suite/harness.cjs --self-test exits 0 with ~21/~21 PASS green"
  - "node super-gsd/tools/scenario-suite/harness.cjs --run-all exits 0 with verdict=PASS pass=10/10"
  - "node super-gsd/tools/scenario-suite/run-self-test.cjs exits 0 (dual-pass green)"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 exits 0 (sext-gate green: 33+26+24+10+18+12+self-test+10)"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 exits 0 (no regression on dual-gate)"
  - "ASCII-only across harness.cjs, scenarios.json, SCENARIOS.schema.json, run-self-test.cjs, and the sgsd-complete-milestone.cjs delta"
  - "Lock 4: git diff --quiet on Phase 41-55 trees + sgsd-cockpit-shell.cjs post-T4 (only the 4 surgical files / new scenario-suite tree changed)"
threat_model:
  - file: super-gsd/tools/scenario-suite/harness.cjs
    surface: tmpdir + spawnSync subprocess boundary
    threats:
      - workspace traversal via mkdtemp under non-tmpdir path -> mitigated by safeUnderTmp + notUnderWorkspace defense-in-depth guard in _setupContainer
      - subprocess inheriting parent env credentials -> mitigated by explicit env merge with only required overrides; no secrets injected
      - canonical stream pollution from misrouted writes -> mitigated by 11-stream PHASE_56_GUARDED_STREAMS pre/post fingerprint with byte-equality
  - file: super-gsd/tools/scenario-suite/scenarios.json
    surface: closed-vocab manifest
    threats:
      - schema drift via additional keys -> mitigated by additionalProperties:false at top level and per-entry in SCENARIOS.schema.json
      - non-ASCII smuggling in strings -> mitigated by ASCII-only assertion in self-test
  - file: super-gsd/scripts/sgsd-complete-milestone.cjs
    surface: milestone-close gate dispatch
    threats:
      - gate skipped when scenario-suite require fails -> mitigated by Lock 13 wrap that emits milestone_close_blocked:scenario_suite_unavailable + exit 1
      - regression on v1.9 path -> mitigated by surgical-extension-only contract; insertion is gated on milestone==='v2.0' upstream
