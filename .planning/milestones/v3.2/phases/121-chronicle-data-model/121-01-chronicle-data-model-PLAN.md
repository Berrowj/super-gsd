---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md
plan_id: P121-01
phase_id: P121
milestone: v3.2
title: Chronicle Data-Model Upgrade
context_path: .planning/milestones/v3.2/phases/121-chronicle-data-model/121-CONTEXT.md
semantic_acceptance_criteria:
  - id: SAC-P121-01
    input: "chronicle.schema.json after upgrade"
    expected_outcome: "schema declares big_idea, big_idea_citation, sections[].signal, fog.dominant_signal, next.primary_action, next.alternatives, and why SCQA slots as OPTIONAL properties with shape constraints; parses as valid JSON Schema; remains backward-compatible (a pre-v3.2 chronicle without the fields still validates)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-01"
  - id: SAC-P121-02
    input: "good-with-answer-first.json fixture"
    expected_outcome: "validates against the upgraded chronicle.schema.json with every new field populated"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-02"
  - id: SAC-P121-03
    input: "build-context-pack.cjs run on the self-test sample phase"
    expected_outcome: "emitted CHRONICLE-CONTEXT.json carries a non-empty big_idea <=200 chars with a big_idea_citation"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-03"
  - id: SAC-P121-04
    input: "builder output sections"
    expected_outcome: "every section node carries signal in {high, low}"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-04"
  - id: SAC-P121-05
    input: "builder output fog object"
    expected_outcome: "fog.dominant_signal equals the arg-max key of the fog breakdown (deterministic)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-05"
  - id: SAC-P121-06
    input: "builder output next object"
    expected_outcome: "next.primary_action is a non-empty string; next.alternatives is an array (may be empty)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-06"
  - id: SAC-P121-07
    input: "builder output why section"
    expected_outcome: "why section carries situation + question slots; complication present or explicitly null"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-07"
  - id: SAC-P121-08
    input: "same builder inputs twice"
    expected_outcome: "all new fields are byte-identical across runs (deterministic projection, DLB-11 R3)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-08"
  - id: SAC-P121-09
    input: "full chronicle self-test"
    expected_outcome: "all prior 96 assertions still green PLUS the P121 SAC additions — zero regression"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
tasks:
  - id: t1
    title: "Upgrade chronicle schema and context-pack builder"
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/schemas/chronicle.schema.json
      - super-gsd/tools/chronicle/build-context-pack.cjs
    input_contract: |
      Read .planning/milestones/v3.2/phases/121-chronicle-data-model/121-CONTEXT.md,
      .planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md,
      super-gsd/schemas/chronicle.schema.json, and
      super-gsd/tools/chronicle/build-context-pack.cjs.

      Treat P113 chronicle.schema.json and P114 build-context-pack.cjs as frozen
      substrate upgrades: preserve every existing v3.1 chronicle behaviour while
      adding the v3.2 operator-comprehension fields. Do not duplicate SGSD gates
      and do not introduce agent-authored prose for derived fields.
    output_contract: |
      super-gsd/schemas/chronicle.schema.json requires the v3.2 fields:
      big_idea, big_idea_citation, sections[].signal, fog.dominant_signal,
      next.primary_action, why.situation, and why.question.

      why.complication and next.alternatives remain optional. sections[].signal
      accepts only high or low. build-context-pack.cjs deterministically
      populates all required new fields, with big_idea composed from verdict and
      denominators and fog.dominant_signal computed as the arg-max of the fog
      breakdown.
    hypothesis: |
      Extending the existing schema and builder in place gives the cockpit the
      operator-comprehension fields it needs without changing the chronicle
      substrate contract or adding nondeterministic model prose.
    falsifier: |
      Falsify this task if any new field is populated by free-form agent prose,
      if required fields are missing from builder output, if optional fields are
      made mandatory against the context contract, or if the legacy v3.1
      chronicle self-test regresses.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-05"
    stop_rule: |
      Stop after schema and builder outputs satisfy the SAC checks for the new
      deterministic fields and before making fixture or self-test changes owned
      by t2, except for local inspection needed to preserve compatibility.
  - id: t2
    title: "Upgrade chronicle fixtures and SAC self-test coverage"
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/tools/chronicle/fixtures/sample-chronicle-context.json
      - super-gsd/tools/chronicle/run-self-test.cjs
      - super-gsd/schemas/fixtures/chronicle/good-with-answer-first.json
    input_contract: |
      Read .planning/milestones/v3.2/phases/121-chronicle-data-model/121-CONTEXT.md,
      super-gsd/tools/chronicle/run-self-test.cjs, the existing
      sample-chronicle-context.json fixture, and all seven existing good-*.json
      chronicle fixtures.

      Consume the schema and builder contract produced by t1. Preserve every
      prior v3.1 chronicle assertion and extend coverage for SAC-P121-01 through
      SAC-P121-09 without replacing the frozen regression checks.
    output_contract: |
      sample-chronicle-context.json, the seven existing good-*.json fixtures,
      and new good-with-answer-first.json all validate against the upgraded
      chronicle schema and include the required v3.2 fields.

      run-self-test.cjs supports the SAC-P121-01 through SAC-P121-09 selectors
      using the exact command shape node super-gsd/tools/chronicle/run-self-test.cjs
      --sac SAC-P121-NN, and SAC-P121-09 proves the legacy 96 assertions still
      pass after the upgrade.
    hypothesis: |
      Updating fixtures and extending the existing self-test harness makes the
      data-model upgrade auditable at the SAC level while keeping the v3.1
      regression suite as the release keystone.
    falsifier: |
      Falsify this task if any fixture passes by weakening schema requirements,
      if good-with-answer-first.json is absent, if any SAC selector is missing or
      implemented with an inline one-off command, or if the 96 legacy assertions
      no longer pass.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-09"
    stop_rule: |
      Stop when all nine SAC selectors pass through run-self-test.cjs, every
      upgraded fixture validates through the shared chronicle schema path, and
      the v3.1 96-assertion regression result is still green.
---

# P121-01 Chronicle Data-Model Upgrade Plan

This plan upgrades the chronicle schema, deterministic context-pack builder,
fixtures, and SAC self-test coverage as one frozen-substrate change. The split
keeps the schema/builder contract in t1 and the fixture/self-test proof in t2,
with SAC-P121-09 as the zero-regression release keystone.
