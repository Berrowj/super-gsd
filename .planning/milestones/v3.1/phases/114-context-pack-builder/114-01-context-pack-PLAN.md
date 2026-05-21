---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-11-CHRONICLE-LAYER.md
plan_id: P114-01
phase_id: P114
milestone: v3.1
title: Context-Pack Builder + Validate Helper
context_path: .planning/milestones/v3.1/phases/114-context-pack-builder/114-CONTEXT.md
tasks:
  - id: t1
    title: Add chronicle schema validation helper
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/cmb-validate-helper.cjs
    input_contract: |
      read:
        - .planning/milestones/v3.1/phases/114-context-pack-builder/114-CONTEXT.md
        - .planning/decisions/DLB-11-CHRONICLE-LAYER.md
        - super-gsd/templates/plan-schema-v2.json
        - super-gsd/templates/plan-locked.schema.json
        - super-gsd/schemas/chronicle.schema.json
        - super-gsd/schemas/chronicle-manifest.schema.json
      constraints:
        - Implement only super-gsd/tools/chronicle/cmb-validate-helper.cjs in this task.
        - Keep the helper dependency-light and consistent with existing SGSD CJS tool style.
        - Resolve named schemas chronicle, manifest, cmb, and chronicle-context from repo-local schema files.
        - Validate fixtures with ajv and ajv-errors and print actionable validation failures.
        - Preserve the CONTEXT.md exit-code contract exactly: 0 valid, 1 validation failure, 2 usage or unknown schema, 3 fixture read failure, 4 fixture JSON parse failure, 5 schema load or compile failure.
    output_contract: |
      create:
        - super-gsd/tools/chronicle/cmb-validate-helper.cjs
      guarantees:
        - The helper accepts a named schema and fixture path from CLI flags.
        - The helper validates JSON fixtures using ajv plus ajv-errors.
        - The helper exits with the exact CONTEXT.md exit-code matrix.
        - The helper does not depend on the context-pack builder task.
    hypothesis: |
      A small standalone validator helper can provide stable schema validation and deterministic failure codes for chronicle fixtures without coupling to the builder.
    falsifier: |
      Success is falsified if any named schema cannot be resolved, valid fixtures fail validation, invalid fixtures exit with the wrong code, or the helper imports the builder.
    stop_rule: |
      Stop after the helper exists, exposes the required CLI behavior, and the exit-code matrix can be exercised independently of t2 and t3.
    verification_cmd: "node -e \"const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['super-gsd/tools/chronicle/cmb-validate-helper.cjs','--schema','not-a-schema','--fixture','super-gsd/schemas/chronicle.schema.json'],{stdio:'inherit'}); process.exit(r.status===2?0:1);\""
  - id: t2
    title: Add deterministic context-pack builder
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/build-context-pack.cjs
    input_contract: |
      read:
        - .planning/milestones/v3.1/phases/114-context-pack-builder/114-CONTEXT.md
        - .planning/decisions/DLB-11-CHRONICLE-LAYER.md
        - .planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md
        - super-gsd/schemas/chronicle.schema.json
        - super-gsd/schemas/chronicle-manifest.schema.json
      constraints:
        - Implement only super-gsd/tools/chronicle/build-context-pack.cjs in this task.
        - Read mesh ledger data, planning artefacts, git evidence, and optional cockpit state using repo-local paths.
        - Partition CMB references by class and keep CMB citations by reference only.
        - Populate denominator fields from observable signals rather than invented totals.
        - Produce deterministic output with sorted arrays and stable object key order where practical.
        - Do not place random values or generation timestamps inside the emitted chronicle context body.
        - Gracefully degrade when optional cockpit state or private KB signals are absent.
    output_contract: |
      create:
        - super-gsd/tools/chronicle/build-context-pack.cjs
      guarantees:
        - The builder can emit CHRONICLE-CONTEXT.json for a phase from observable repo inputs.
        - The emitted context conforms to super-gsd/schemas/chronicle.schema.json.
        - CMB references are arrays of CMB ID strings, never embedded CMB bodies.
        - Re-running the builder over the same inputs produces byte-stable JSON.
    hypothesis: |
      A deterministic read-model builder can assemble a chronicle context pack from existing SGSD ledgers and artefacts without becoming a new source of truth.
    falsifier: |
      Success is falsified if the builder duplicates CMB bodies, invents denominators, embeds timestamps in the context body, mutates source ledgers, or produces different output for unchanged inputs.
    stop_rule: |
      Stop after the builder emits schema-valid CHRONICLE-CONTEXT.json from observable inputs and all optional-input absence paths are handled without failure.
    verification_cmd: "node super-gsd/tools/chronicle/build-context-pack.cjs --phase-dir .planning/milestones/v3.1/phases/114-context-pack-builder --out C:/tmp/sgsd-p114-context/CHRONICLE-CONTEXT.json"
  - id: t3
    title: Add chronicle context self-test and fixtures
    agent: codex-executor
    model: codex
    depends_on:
      - t1
      - t2
    files_touched:
      - super-gsd/tools/chronicle/run-self-test.cjs
      - super-gsd/tools/chronicle/fixtures/sample-phase-input.json
      - super-gsd/tools/chronicle/fixtures/sample-chronicle-context.json
    input_contract: |
      read:
        - .planning/milestones/v3.1/phases/114-context-pack-builder/114-CONTEXT.md
        - .planning/decisions/DLB-11-CHRONICLE-LAYER.md
        - super-gsd/tools/chronicle/cmb-validate-helper.cjs
        - super-gsd/tools/chronicle/build-context-pack.cjs
        - super-gsd/schemas/chronicle.schema.json
        - super-gsd/schemas/chronicle-manifest.schema.json
      constraints:
        - Implement the self-test runner plus exactly the two requested sample fixtures.
        - Cover SAC-P114-01 through SAC-P114-12.
        - Include at least 15 assertions total.
        - Include at least 3 extra structural checks beyond the 12 SACs.
        - Keep fixture data small, deterministic, and free of private or environment-specific values.
    output_contract: |
      create:
        - super-gsd/tools/chronicle/run-self-test.cjs
        - super-gsd/tools/chronicle/fixtures/sample-phase-input.json
        - super-gsd/tools/chronicle/fixtures/sample-chronicle-context.json
      guarantees:
        - The self-test exercises the validator helper and builder together.
        - The sample phase input fixture contains representative mesh, planning, git, and optional-state signals.
        - The sample chronicle context fixture validates against the chronicle schema.
        - The self-test fails loudly when any SAC or structural invariant regresses.
    hypothesis: |
      A compact self-test with representative fixtures can lock the chronicle context-pack contract without requiring live SGSD runtime state.
    falsifier: |
      Success is falsified if the self-test has fewer than 15 assertions, misses any SAC ID, relies on local-only runtime state, or passes while malformed context output is accepted.
    stop_rule: |
      Stop after run-self-test.cjs covers all 12 SACs, includes 3 or more additional structural checks, and passes from a clean repository checkout.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
semantic_acceptance_criteria:
  - id: SAC-P114-01
    input: "Run the validation helper against the sample chronicle context fixture with schema name chronicle."
    expected_outcome: "The helper resolves the chronicle schema, validates the fixture with ajv plus ajv-errors, prints a success result, and exits 0."
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture super-gsd/tools/chronicle/fixtures/sample-chronicle-context.json"
  - id: SAC-P114-02
    input: "Run the validation helper against the sample chronicle context fixture with schema name chronicle-context."
    expected_outcome: "The chronicle-context alias resolves to the chronicle context schema and the valid fixture exits 0."
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle-context --fixture super-gsd/tools/chronicle/fixtures/sample-chronicle-context.json"
  - id: SAC-P114-03
    input: "Run the validation helper with schema name manifest against a valid chronicle manifest fixture generated by the self-test."
    expected_outcome: "The helper resolves super-gsd/schemas/chronicle-manifest.schema.json, validates the fixture, and exits 0."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-03"
  - id: SAC-P114-04
    input: "Run the validation helper with schema name cmb against a valid CMB fixture generated by the self-test."
    expected_outcome: "The helper resolves the CMB schema, validates the fixture, and exits 0."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-04"
  - id: SAC-P114-05
    input: "Run the validation helper against a fixture that is valid JSON but violates the selected schema."
    expected_outcome: "The helper reports schema validation errors and exits 1."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-05"
  - id: SAC-P114-06
    input: "Run the validation helper with an unknown schema name."
    expected_outcome: "The helper reports the unknown schema or usage error and exits 2."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-06"
  - id: SAC-P114-07
    input: "Run the validation helper with an existing schema name and a missing fixture path."
    expected_outcome: "The helper reports the fixture read failure and exits 3."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-07"
  - id: SAC-P114-08
    input: "Run the validation helper with an existing schema name and a fixture containing invalid JSON."
    expected_outcome: "The helper reports the JSON parse failure and exits 4."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-08"
  - id: SAC-P114-09
    input: "Run the context-pack builder against the sample phase input fixture."
    expected_outcome: "The builder emits CHRONICLE-CONTEXT.json conforming to super-gsd/schemas/chronicle.schema.json."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-09"
  - id: SAC-P114-10
    input: "Run the context-pack builder twice against identical sample inputs."
    expected_outcome: "Both emitted CHRONICLE-CONTEXT.json payloads are byte-identical, sorted, and contain no random values or body timestamps."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-10"
  - id: SAC-P114-11
    input: "Inspect the context-pack builder output produced from sample mesh, planning, git, and optional cockpit-state inputs."
    expected_outcome: "CMBs are partitioned by class, denominators come from observable signals, optional cockpit state degrades gracefully when absent, and citations are CMB ID strings only."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P114-11"
  - id: SAC-P114-12
    input: "Run the chronicle self-test runner."
    expected_outcome: "The self-test covers SAC-P114-01 through SAC-P114-12 and at least three additional structural checks with 15 or more assertions."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
---

# P114-01 Context-Pack Builder + Validate Helper

PLAN-LOCKED execution plan for Phase 114.
