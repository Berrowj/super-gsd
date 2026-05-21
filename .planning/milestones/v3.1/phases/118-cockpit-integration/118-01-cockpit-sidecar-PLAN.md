---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-11-CHRONICLE-LAYER.md
plan_id: P118-01
phase_id: P118
milestone: v3.1
title: Cockpit Sidecar
context_path: .planning/milestones/v3.1/phases/118-cockpit-integration/118-CONTEXT.md
semantic_acceptance_criteria:
  - id: SAC-118-01
    input: "Run the cockpit sidecar against the default SGSD workspace after Chronicle publish has emitted INDEX rows and Chronicle validation has emitted validator log rows."
    expected_outcome: "The sidecar emits one deterministic JSON object to stdout with chronicle, validation, fog, signals, warnings, and generated_at sections, without mutating any source file."
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --json"
  - id: SAC-118-02
    input: "Provide Fog Score inputs that exercise every weighted component defined in 118-CONTEXT.md."
    expected_outcome: "fog-score.cjs returns the exact deterministic weighted sum from CONTEXT, with no ML, no tuning, no randomness, and no time-dependent behavior."
    verification_cmd: "node -e \"const { computeFogScore } = require('./super-gsd/tools/cockpit-sidecar/fog-score.cjs'); const sample = require('./super-gsd/tools/chronicle/fixtures/sample-fog-inputs.json'); const result = computeFogScore(sample.inputs); if (result.score !== sample.expected.score) process.exit(1);\""
  - id: SAC-118-03
    input: "Run the sidecar where Chronicle INDEX rows are present but validator rows are empty."
    expected_outcome: "The sidecar reports available Chronicle INDEX signals, marks validator evidence as unavailable, includes a warning, and exits successfully without fabricating validator data."
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --chronicle-index .planning/metrics/chronicle-index.jsonl --validator-log C:/tmp/sgsd-missing-validator.jsonl --json"
  - id: SAC-118-04
    input: "Run the sidecar where validator rows are present but Chronicle INDEX rows are empty."
    expected_outcome: "The sidecar reports available validator signals, marks Chronicle INDEX evidence as unavailable, includes a warning, and exits successfully without fabricating Chronicle data."
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --chronicle-index C:/tmp/sgsd-missing-index.jsonl --validator-log .planning/metrics/chronicle-validator.jsonl --json"
  - id: SAC-118-05
    input: "Run the sidecar from a clean workspace with no cockpit-sidecar output path argument."
    expected_outcome: "The sidecar writes nothing by default; stdout is the only output channel and all SGSD data sources are opened read-only."
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --json > C:/tmp/sgsd-sidecar-output.json"
  - id: SAC-118-06
    input: "Inspect the implementation diff for Phase 118."
    expected_outcome: "No file under super-gsd/tools/cockpit/ is modified; Lock-13 protected cockpit code remains untouched."
    verification_cmd: "git diff --name-only -- super-gsd/tools/cockpit"
  - id: SAC-118-07
    input: "Feed the sidecar mixed valid, malformed, and unrelated JSONL rows from Chronicle publish and validator logs."
    expected_outcome: "The sidecar ignores unrelated rows, records malformed rows as warnings, preserves valid signals, and never throws on a recoverable row-level parse error."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
  - id: SAC-118-08
    input: "Run the sidecar twice against unchanged fixture inputs."
    expected_outcome: "The semantic sidecar payload is stable across runs except for explicitly documented generated_at metadata."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
  - id: SAC-118-09
    input: "Compare sample-sidecar-output.json with live output produced from sample-fog-inputs.json and the chronicle self-test fixtures."
    expected_outcome: "The fixture comparison passes and proves the sidecar output shape expected by cockpit consumers without integrating into the protected cockpit package."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
  - id: SAC-118-10
    input: "Validate the locked plan and run the Phase 118 self-test path."
    expected_outcome: "The plan validates against plan-locked.schema.json and the self-test covers Fog Score calculation, sidecar JSON shape, warning behavior, and read-only source handling."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs && node super-gsd/tools/validate-plan.cjs .planning/milestones/v3.1/phases/118-cockpit-integration/118-01-cockpit-sidecar-PLAN.md --schema super-gsd/templates/plan-locked.schema.json"
tasks:
  - id: t1
    title: Implement read-only cockpit sidecar and Fog Score calculator
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/cockpit-sidecar/fog-score.cjs
      - super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
    input_contract: |
      Read 118-CONTEXT.md, DLB-11-CHRONICLE-LAYER.md, super-gsd/tools/chronicle/publish.cjs, and super-gsd/tools/chronicle/validate-chronicle.cjs before implementing.
      Create fog-score.cjs as a pure CommonJS calculator that implements exactly the deterministic weighted Fog Score formula from CONTEXT. The calculator must accept explicit numeric inputs, clamp/normalize only as CONTEXT specifies, return an inspectable breakdown, and avoid filesystem, process, Date, random, network, or ML/tuning behavior.
      Create cockpit-sidecar.cjs as a read-only CLI outside super-gsd/tools/cockpit/. It must read Chronicle INDEX rows emitted by publish.cjs and validator rows emitted by validate-chronicle.cjs, tolerate missing or malformed data sources with warnings, and emit one JSON payload to stdout by default.
      The CLI may accept explicit path flags for tests, but it must not write to SGSD ledgers, mutate state, modify cockpit files, or invent missing phase, gate, token, Chronicle, or validator facts.
    output_contract: |
      Deliver two new executable CommonJS modules under super-gsd/tools/cockpit-sidecar/.
      fog-score.cjs exports the calculator API used by tests and the sidecar CLI.
      cockpit-sidecar.cjs emits stable JSON suitable for cockpit consumers while remaining a detached sidecar; it includes source availability, parsed signals, Fog Score output, warnings, and generated_at metadata.
      The implementation preserves Lock-13 by leaving super-gsd/tools/cockpit/* untouched and keeps all data-source access read-only.
    hypothesis: |
      A detached read-only sidecar can expose Chronicle and validator state to cockpit consumers without reopening the protected cockpit package, and a pure deterministic Fog Score calculator keeps the operator-facing signal auditable.
    falsifier: |
      The task is falsified if the implementation edits super-gsd/tools/cockpit/*, writes to any SGSD data source, computes Fog Score with anything other than the CONTEXT weighted sum, fabricates unavailable evidence, or produces nondeterministic semantic output for unchanged inputs.
    stop_rule: |
      Stop after the two sidecar modules exist, the calculator is pure, the CLI is read-only by default, missing/malformed data produces warnings instead of crashes, and the task verification command passes.
    verification_cmd: "node -e \"const { computeFogScore } = require('./super-gsd/tools/cockpit-sidecar/fog-score.cjs'); const result = computeFogScore({}); if (!result || typeof result.score !== 'number') process.exit(1);\""
  - id: t2
    title: Extend Chronicle self-test with cockpit sidecar fixtures
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/tools/chronicle/run-self-test.cjs
      - super-gsd/tools/chronicle/fixtures/sample-sidecar-output.json
      - super-gsd/tools/chronicle/fixtures/sample-fog-inputs.json
    input_contract: |
      Read the existing run-self-test.cjs harness and extend it narrowly to cover the new sidecar without changing Chronicle publish or validation semantics.
      Add sample-fog-inputs.json with deterministic inputs and the expected Fog Score breakdown from the CONTEXT formula.
      Add sample-sidecar-output.json with the expected semantic payload shape produced by cockpit-sidecar.cjs from fixture data. The fixture must exclude volatile generated_at values or compare them through a documented normalization step.
      Keep tests self-contained, do not require live cockpit integration, and do not touch super-gsd/tools/cockpit/*.
    output_contract: |
      run-self-test.cjs covers Fog Score calculation, sidecar output shape, sidecar warning behavior for malformed or missing rows, and fixture stability.
      The two JSON fixtures are committed under the Chronicle fixture area and are usable by future ATC checks.
      The self-test remains deterministic, offline, and read-only with respect to SGSD planning state and metrics ledgers.
    hypothesis: |
      Extending the Chronicle self-test is enough to prove the sidecar contract because the sidecar consumes Chronicle publish INDEX rows and validator log rows but remains outside cockpit integration.
    falsifier: |
      The task is falsified if self-tests depend on live mutable SGSD state, update source ledgers, require cockpit package changes, compare volatile timestamps directly, or fail to detect a regression in Fog Score arithmetic or sidecar JSON shape.
    stop_rule: |
      Stop after run-self-test.cjs passes locally, the two fixtures are present, the fixture comparison normalizes volatile metadata, and no protected cockpit file appears in the diff.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
---
