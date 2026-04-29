---
schema_version: 2
phase: 99
plan: 2
type: execute
expected_ATC_tier: FULL
depends_on: []
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - super-gsd/tools/scenario-suite/fixtures/plan-schema-load-valid/PLAN.md
tags:
  - scenario-suite
  - fixture
  - plan-schema-load-valid
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/scenario-suite/fixtures/plan-schema-load-valid/PLAN.md
    input_contract: scenario-suite fixture build context
    output_contract: a valid schema_v2 multi-task PLAN.md
    hypothesis: A multi-task plan exercises a different frontmatter shape than SH1.
    falsifier: If validate.cjs --mode load exits non-zero, the fixture is broken.
    stop_rule: validate.cjs exits 0.
  - id: T2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/scenario-suite/fixtures/plan-schema-load-valid/README.md
    input_contract: T1 output
    output_contract: companion README documenting the fixture
    hypothesis: Two tasks expand the validator load path.
    falsifier: If the validator rejects multi-task schemas, T2 surfaces it.
    stop_rule: validate.cjs exits 0.
---

# Phase 99 Fixture Plan: plan-schema-load-valid

Multi-task happy-path fixture for SH6. Demonstrates that the schema_v2 load
mode validator accepts more than one task per plan.
