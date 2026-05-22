---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md
plan_id: P123-01
phase_id: P123
milestone: v3.2
title: Chronicle Validator Lints
context_path: .planning/milestones/v3.2/phases/123-chronicle-validator-lints/123-CONTEXT.md
semantic_acceptance_criteria:
  - id: SAC-P123-01
    input: Validate a chronicle HTML report that contains unexplained operator-facing jargon while all binding evidence remains grounded.
    expected_outcome: The validator emits a CHRONICLE-JARGON advisory warning derived from the raw HTML and context, and the verdict remains GROUNDED.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-01"
  - id: SAC-P123-02
    input: Validate a chronicle HTML report whose takeaway section is missing the required operator-comprehension heading.
    expected_outcome: The validator emits a takeaway-heading advisory warning derived from the rendered HTML structure, and the warning does not change the verdict by itself.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-02"
  - id: SAC-P123-03
    input: Validate a chronicle HTML report that exposes more than one primary operator action.
    expected_outcome: The validator treats the one-primary-action rule as binding and returns REPORT_UNGROUNDED with a precise warning or error that identifies the multiple primary actions.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-03"
  - id: SAC-P123-04
    input: Validate a chronicle HTML report whose figure caption duplicates the report title instead of adding operator-facing explanation.
    expected_outcome: The validator emits a figcaption-title advisory warning derived from raw HTML, and the advisory never flips an otherwise grounded verdict.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-04"
  - id: SAC-P123-05
    input: Validate a chronicle HTML report that fails the shared P120 conformance checker while local chronicle-only evidence is otherwise present.
    expected_outcome: The validator wires super-gsd/tools/shared/conformance-check.cjs as a binding gate and returns REPORT_UNGROUNDED when conformance fails.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-05"
  - id: SAC-P123-06
    input: Validate a fixture that self-reports compliant lint metadata but whose raw HTML violates the chronicle lint rules.
    expected_outcome: The validator ignores self-reported lint claims, re-derives lint state from raw HTML plus context, and reports the actual advisory or binding result.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-06"
  - id: SAC-P123-07
    input: Run the chronicle self-test suite after the validator changes are applied.
    expected_outcome: The pre-existing chronicle self-test assertions remain green, proving no regression to the P113 schema, P114 builder, or P122 renderer substrates.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-07"
  - id: SAC-P123-08
    input: Validate a prior v3.1 GROUNDED chronicle that only triggers advisory lint warnings under the new v3.2 checks.
    expected_outcome: Advisory lints add warnings but never flip the prior v3.1 GROUNDED verdict.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-08"
  - id: SAC-P123-09
    input: Validate the good-v32-conformant benchmark fixture.
    expected_outcome: The fixture passes the new advisory and binding lint checks with a GROUNDED verdict and no chronicle-comprehension warnings.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-09"
tasks:
  - id: t1
    title: Extend chronicle validator with advisory and binding comprehension lints
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/validate-chronicle.cjs
    input_contract: |
      Read 123-CONTEXT.md, DLB-12, validate-chronicle.cjs, and shared/conformance-check.cjs before editing. Preserve the existing chronicle validator API, output shape, and all current binding evidence semantics. Treat raw HTML plus validator context as the source of truth; do not trust self-reported lint metadata in reports.
    output_contract: |
      validate-chronicle.cjs derives and reports four new v3.2 lints: CHRONICLE-JARGON advisory, takeaway-heading advisory, one-primary-action binding, and figcaption-title advisory. The P120 shared conformance checker is wired as a binding gate. Advisory lints add warnings only; one-primary-action and conformance failures return REPORT_UNGROUNDED. P113 schema, P114 builder, and P122 renderer files remain untouched.
    hypothesis: |
      The chronicle validator can improve operator comprehension by re-deriving lint evidence from rendered HTML and context while keeping advisory checks verdict-neutral and reserving REPORT_UNGROUNDED for binding action/conformance failures.
    falsifier: |
      This task is false if any advisory-only fixture flips from GROUNDED to REPORT_UNGROUNDED, if a multi-primary-action or conformance failure remains GROUNDED, if validator output depends on self-reported lint metadata, or if substrate files outside validate-chronicle.cjs must be edited.
    stop_rule: |
      Stop after validate-chronicle.cjs exposes the new lint behavior through the existing validator result contract and the baseline chronicle self-test still runs. Do not create new fixtures or SAC assertions in this task.
    verification_cmd: 'node super-gsd/tools/chronicle/run-self-test.cjs'
  - id: t2
    title: Add v3.2 chronicle lint fixtures and SAC self-test coverage
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/tools/chronicle/fixtures/bad-jargon-eli5.json
      - super-gsd/tools/chronicle/fixtures/bad-multi-primary-action.json
      - super-gsd/tools/chronicle/fixtures/good-v32-conformant.json
      - super-gsd/tools/chronicle/run-self-test.cjs
    input_contract: |
      Build on the validator behavior from t1. Read the existing chronicle benchmark fixture conventions and run-self-test.cjs assertion style before adding coverage. Use fixtures that prove raw HTML/context derivation and do not rely on self-reported lint metadata.
    output_contract: |
      Add bad-jargon-eli5.json, bad-multi-primary-action.json, and good-v32-conformant.json benchmark fixtures in the existing chronicle fixture location. Extend run-self-test.cjs with SAC-P123-01 through SAC-P123-09 assertions, including the SAC-P123-08 keystone that advisory warnings never flip a prior v3.1 GROUNDED verdict. Keep the existing 102 chronicle assertions green.
    hypothesis: |
      Focused benchmark fixtures and SAC-specific self-test switches can lock the v3.2 lint contract without broadening the validator surface or mutating existing chronicle substrates.
    falsifier: |
      This task is false if the SAC commands cannot isolate each SAC-P123 assertion, if the good v3.2 fixture is not GROUNDED, if bad-multi-primary-action is not REPORT_UNGROUNDED, if advisory fixtures flip verdicts, or if the baseline 102 chronicle assertions regress.
    stop_rule: |
      Stop after all nine SAC-P123 verification commands pass, the full chronicle self-test passes, and no P113 schema, P114 builder, or P122 renderer files have been touched.
    verification_cmd: 'node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-09'
---
