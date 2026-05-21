---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-11-CHRONICLE-LAYER.md
plan_id: P116-01
phase_id: P116
milestone: v3.1
title: Chronicle Validator + Binding Gate
context_path: .planning/milestones/v3.1/phases/116-chronicle-validator-binding-gate/116-CONTEXT.md
semantic_acceptance_criteria:
  - id: SAC-P116-01
    input: A valid chronicle JSON document and matching chronicle manifest produced by the P115 renderer path.
    expected_outcome: The validator exits 0 and reports that the chronicle document, manifest, and rendered artifact bindings are valid.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/good/minimal-valid/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/good/minimal-valid/manifest.json"
  - id: SAC-P116-02
    input: A chronicle JSON document that violates super-gsd/schemas/chronicle.schema.json.
    expected_outcome: The validator exits non-zero and reports the schema failure with the failing path.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/bad/invalid-chronicle-schema/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/bad/invalid-chronicle-schema/manifest.json"
  - id: SAC-P116-03
    input: A chronicle manifest JSON document that violates super-gsd/schemas/chronicle-manifest.schema.json.
    expected_outcome: The validator exits non-zero and reports the manifest schema failure with the failing path.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/bad/invalid-manifest-schema/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/bad/invalid-manifest-schema/manifest.json"
  - id: SAC-P116-04
    input: A chronicle and manifest whose declared chronicle identifiers do not match.
    expected_outcome: The validator exits non-zero and reports a chronicle/manifest binding mismatch.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/bad/mismatched-chronicle-id/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/bad/mismatched-chronicle-id/manifest.json"
  - id: SAC-P116-05
    input: A chronicle manifest that binds a rendered HTML artifact to a missing or unreadable file.
    expected_outcome: The validator exits non-zero and reports the missing rendered artifact path.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/bad/missing-html-binding/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/bad/missing-html-binding/manifest.json"
  - id: SAC-P116-06
    input: A chronicle manifest whose rendered HTML artifact checksum does not match the artifact on disk.
    expected_outcome: The validator exits non-zero and reports the checksum mismatch without silently accepting stale HTML.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/bad/html-checksum-mismatch/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/bad/html-checksum-mismatch/manifest.json"
  - id: SAC-P116-07
    input: A chronicle whose event sequence violates deterministic ordering or duplicate-event invariants.
    expected_outcome: The validator exits non-zero and reports the ordering or duplicate-event invariant violation.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/bad/event-order-violation/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/bad/event-order-violation/manifest.json"
  - id: SAC-P116-08
    input: A valid chronicle fixture with complete R4 binding metadata for chronicle, manifest, source inputs, and rendered HTML.
    expected_outcome: The validator exits 0 and confirms R4 provenance bindings are present and internally consistent.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/good/r4-binding-valid/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/good/r4-binding-valid/manifest.json"
  - id: SAC-P116-09
    input: A chronicle fixture whose R4 binding metadata is missing a required upstream source reference.
    expected_outcome: The validator exits non-zero and reports the missing R4 upstream source binding.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --chronicle super-gsd/tools/chronicle/benchmarks/bad/r4-source-binding-missing/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/bad/r4-source-binding-missing/manifest.json"
  - id: SAC-P116-10
    input: The chronicle validation CLI wrapper invoked against a valid benchmark fixture.
    expected_outcome: The wrapper delegates to validate-chronicle.cjs, preserves the validator exit code, and emits the same pass/fail summary.
    verification_cmd: "bash super-gsd/scripts/chronicle-validate.sh --chronicle super-gsd/tools/chronicle/benchmarks/good/minimal-valid/chronicle.json --manifest super-gsd/tools/chronicle/benchmarks/good/minimal-valid/manifest.json"
  - id: SAC-P116-11
    input: The full chronicle benchmark suite containing four good fixtures and four bad fixtures.
    expected_outcome: The benchmark runner confirms all good fixtures pass, all bad fixtures fail for the intended reason, and the suite exits 0.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --benchmarks super-gsd/tools/chronicle/benchmarks"
  - id: SAC-P116-12
    input: super-gsd/tools/run-self-test.cjs executed after the P116 validator and benchmark suite are registered.
    expected_outcome: Self-test output includes SAC-P116-01 through SAC-P116-13 and marks their structure as valid structured acceptance criteria.
    verification_cmd: "node super-gsd/tools/run-self-test.cjs --sac-prefix SAC-P116"
  - id: SAC-P116-13
    input: The P116 plan, validator, wrapper, fixtures, and self-test extension run through the PLAN-LOCKED gate stack.
    expected_outcome: The plan validates against plan-locked.schema.json, FULL ATC remains required, no gates are skipped, and the chronicle validator binding gate is ready for executor handoff.
    verification_cmd: "node super-gsd/tools/validate-plan.cjs .planning/milestones/v3.1/phases/116-chronicle-validator-binding-gate/116-01-chronicle-validator-PLAN.md"
tasks:
  - id: t1
    title: Implement Chronicle Validator and CLI Wrapper
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/validate-chronicle.cjs
      - super-gsd/scripts/chronicle-validate.sh
    input_contract: |
      Read the phase context, DLB-11 R4 invariants, plan-lock schemas, chronicle JSON schemas, P115 render-html output shape, P114 cmb-validate-helper validator pattern, and super-gsd/scripts/codex-exec.sh wrapper pattern.

      Implement a Node validator that consumes an explicit chronicle JSON path and chronicle manifest JSON path, validates both against their schemas, checks their binding relationship, checks rendered artifact bindings, and enforces the R4 chronicle-layer invariants called out in DLB-11. Keep validation deterministic, local-file based, and dependency-light in the style of existing super-gsd tools.

      Implement a bash wrapper at super-gsd/scripts/chronicle-validate.sh that delegates to validate-chronicle.cjs, preserves argv and exit codes, and follows the repository script style. Do not duplicate existing SGSD gates; this tool is the chronicle-specific binding validator those gates can call.
    output_contract: |
      super-gsd/tools/chronicle/validate-chronicle.cjs exists, is executable by node, provides clear non-zero failures for schema, binding, rendered artifact, and R4 invariant errors, and supports the benchmark mode required by t2.

      super-gsd/scripts/chronicle-validate.sh exists, is executable in the same style as existing super-gsd scripts, delegates to the Node validator, and does not hide validator stderr/stdout or exit status.

      The validator emits machine-readable enough output for self-test and gate integration without introducing a separate gate implementation.
    hypothesis: |
      A small chronicle-specific validator can bind chronicle JSON, manifest JSON, rendered HTML metadata, and R4 provenance invariants without changing the renderer or reimplementing the generic SGSD gate stack.
    falsifier: |
      If validation requires changing the chronicle schemas, P115 renderer contract, or generic SGSD gates to express the P116 checks, this task has exceeded the intended validator boundary and must stop for plan revision.
    stop_rule: |
      Stop once the validator and wrapper exist, their interfaces are documented by --help or usage errors, and they can be exercised against at least one valid and one invalid local fixture path. Do not broaden into release-readiness or ATC gate code.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --help"
  - id: t2
    title: Add Chronicle Validator Benchmark Fixtures
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/tools/chronicle/benchmarks/
    input_contract: |
      Read the phase context, DLB-11 R4 invariants, chronicle and manifest schemas, P115 render-html output contract, and the P108 evidence-validator benchmark layout. Use t1's validator interface as the fixture execution contract.

      Create exactly eight benchmark fixture cases under super-gsd/tools/chronicle/benchmarks/: four good fixtures that should pass and four bad fixtures that should fail for distinct validator reasons. Keep fixture data minimal but realistic enough to exercise schema validation, chronicle/manifest binding, rendered HTML binding, and R4 provenance invariants.

      Fixture names must make expected behavior obvious. Bad fixtures must be deterministic and should fail for the intended reason rather than relying on incidental parse errors unless the intended reason is invalid JSON/schema shape.
    output_contract: |
      super-gsd/tools/chronicle/benchmarks/ contains four good fixtures and four bad fixtures with chronicle, manifest, and rendered artifact files where needed.

      The benchmark suite can be run by validate-chronicle.cjs in one command. Passing fixtures pass, failing fixtures fail with the expected failure category, and the benchmark command exits 0 only when all expectations hold.

      Fixtures are small enough to review in the repo and do not require network access, private KB access, or nondeterministic timestamps.
    hypothesis: |
      Eight focused fixtures are enough to prove the validator's schema, binding, artifact, and R4 invariant behavior without turning benchmark data into a second implementation of the validator.
    falsifier: |
      If a failure fixture can pass by deleting an unrelated field, or a good fixture relies on behavior not produced by P115 render-html, the fixture set is not proving the intended contract and must be revised.
    stop_rule: |
      Stop once the benchmark suite contains exactly four expected-pass and four expected-fail cases and the validator benchmark mode reports each case and final aggregate status. Do not add broad golden snapshots beyond what the validator needs.
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs --benchmarks super-gsd/tools/chronicle/benchmarks"
  - id: t3
    title: Extend Self-Test Coverage for P116 Structured SACs
    agent: codex-executor
    model: codex
    depends_on:
      - t1
      - t2
    files_touched:
      - super-gsd/tools/run-self-test.cjs
    input_contract: |
      Read the phase context, this plan's semantic_acceptance_criteria, plan-locked.schema.json, plan-schema-v2.json, and existing run-self-test.cjs conventions.

      Extend run-self-test.cjs so it includes SAC-P116-01 through SAC-P116-13 and verifies they are structured objects with id, input, expected_outcome, and verification_cmd fields. Preserve existing self-test behavior and avoid special-casing P116 in a way that weakens other plan or SAC checks.

      Add a STRUCT signal in the self-test output for P116 so the gate can distinguish structured SAC validation from string-only SAC listing.
    output_contract: |
      super-gsd/tools/run-self-test.cjs still passes existing self-tests and now reports P116 SAC coverage, including SAC-P116-01 through SAC-P116-13.

      The self-test fails if P116 SACs are missing, out of range, duplicated, or represented as strings instead of structured objects.

      The self-test integrates with the validator benchmark command from t2 without requiring VTP/private KB access.
    hypothesis: |
      Self-test can bind P116's structured SAC requirement to the existing plan schema and benchmark validator without adding a new gate or weakening previous SAC checks.
    falsifier: |
      If run-self-test.cjs must parse P116 using custom YAML logic that contradicts plan-schema-v2 or plan-locked.schema.json, this task should stop and the schema contract should be clarified first.
    stop_rule: |
      Stop once run-self-test.cjs reports P116 structured SAC coverage and the plan validation plus benchmark validation commands are represented in self-test. Do not modify generic release-readiness gates.
    verification_cmd: "node super-gsd/tools/run-self-test.cjs --sac-prefix SAC-P116"
---

# P116-01 Chronicle Validator + Binding Gate Plan

This PLAN-LOCKED plan implements the chronicle validator, its command-line binding wrapper, a deterministic benchmark suite, and the self-test extension needed to prove all P116 structured semantic acceptance criteria.
