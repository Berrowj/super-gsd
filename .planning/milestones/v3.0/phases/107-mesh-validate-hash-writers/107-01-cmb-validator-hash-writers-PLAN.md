---
schema_version: 2
plan_id: 107-01
phase: 107
phase_name: CMB Validator + Canonical Hash + Receipt and Finding Writers
milestone: v3.0
title: CMB validator, canonical hash, receipt writer, and finding writer
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
depends_on: []
lessons_path: .planning/decisions/DLB-08-MESH-MEMORY-LITE.md
semantic_acceptance_criteria:
  - id: SAC-P107-01
    input: "the 7 good fixtures from P106"
    expected_outcome: "cmb-validate.cjs exits 0 for all 7 good fixtures"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/good-*.json; test $? -eq 0"

  - id: SAC-P107-02
    input: "the 6 bad fixtures from P106 that should reject"
    expected_outcome: "cmb-validate.cjs exits non-zero with the appropriate SCHEMA-MML-* error code for each"
    verification_cmd: "for f in bad-claim-as-observation bad-context-anchor-without-source bad-execution-receipt-created-by-agent bad-cmb-missing-cat7 bad-cmb-missing-type bad-review-finding-without-lineage; do node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/$f.json && exit 1; done; exit 0"

  - id: SAC-P107-03
    input: "hash-a.json + hash-a-created-at-changed.json (identical except for created_at)"
    expected_outcome: "cmb-hash.cjs --compare produces 'same' (hash equality)"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-created-at-changed.json | grep -q 'same'"

  - id: SAC-P107-04
    input: "hash-a.json + hash-a-body-changed.json (identical except for body content)"
    expected_outcome: "cmb-hash.cjs --compare produces 'different'"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-body-changed.json | grep -q 'different'"

  - id: SAC-P107-05
    input: "execution-receipt.cjs invoked with fixture input emulating a Codex post-executor sequence"
    expected_outcome: "writes one execution_receipt CMB to .planning/mesh/memory/cmbs.jsonl with created_by=sgsd-wrapper, role=sgsd, authority_level=observation"
    verification_cmd: "node super-gsd/tools/mesh-memory/execution-receipt.cjs --self-test; test $? -eq 0"

  - id: SAC-P107-06
    input: "review-finding-writer.cjs invoked with fixture reviewer prose pointing at the execution_receipt's content hash"
    expected_outcome: "emits one review_finding CMB with lineage.parents[0] = receipt content hash; authority_level=claim"
    verification_cmd: "node super-gsd/tools/mesh-memory/review-finding-writer.cjs --self-test; test $? -eq 0"

  - id: SAC-P107-07
    input: "self-test runner over all fixtures + writer smokes"
    expected_outcome: "run-self-test.cjs exits 0 with at least 15 assertions"
    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs; test $? -eq 0"
tasks:
  - id: t1
    agent: codex-executor
    model: codex
    files_touched:
      - super-gsd/tools/mesh-memory/cmb-validate.cjs
      - super-gsd/tools/mesh-memory/cmb-hash.cjs
      - super-gsd/tools/mesh-memory/package.json
    input_contract: |
      Consume the frozen P106 schema at super-gsd/schemas/cmb.schema.json and the
      P106 fixtures under super-gsd/tools/mesh-memory/fixtures/. Implement only
      CLI tooling for validation and canonical hashing; do not implement writers
      in this task.
    output_contract: |
      cmb-validate.cjs validates one or more CMB JSON files against the P106 schema
      and exits non-zero with actionable SCHEMA-MML diagnostics on invalid input.
      cmb-hash.cjs computes sha256 over the sorted-keys canonical payload excluding
      created_at and status, and supports --compare with same/different output.
      package.json declares the local dependencies and package entrypoints needed
      by these tools.
    hypothesis: |
      A shared validator and canonical hasher can make the P106 CMB schema
      executable without duplicating schema rules or introducing writer behavior.
    falsifier: |
      Either CLI duplicates the schema contract, includes created_at or status in
      the canonical hash, accepts invalid fixtures, rejects good fixtures, cannot
      run under Node, or writes receipt/finding CMBs during this task.
    stop_rule: |
      Stop once cmb-validate.cjs --help works, cmb-hash.cjs can compute and compare
      fixture hashes, package dependencies are declared, and no writer behavior has
      been added.
    depends_on: []
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --help"

  - id: t2
    agent: codex-executor
    model: codex
    files_touched:
      - super-gsd/tools/mesh-memory/execution-receipt.cjs
      - super-gsd/tools/mesh-memory/review-finding-writer.cjs
    input_contract: |
      Consume t1's validator and canonical hasher. Use DLB-08, REQ-MML-09,
      REQ-MML-10, and the P107 context invariants as the writer contract.
    output_contract: |
      execution-receipt.cjs emits one schema-valid execution_receipt CMB from
      observable SGSD wrapper facts and appends to .planning/mesh/memory/cmbs.jsonl
      with created_by=sgsd or sgsd-wrapper only. review-finding-writer.cjs emits
      one review_finding CMB per structured finding and requires lineage.parents[0]
      to reference the execution_receipt content hash. Both writers validate and
      hash before write.
    hypothesis: |
      The two writer tools can share t1's validator/hash layer and preserve the
      observation-versus-claim boundary without adding new schema surface.
    falsifier: |
      execution_receipt accepts executor/agent created_by values, review_finding
      writes without receipt lineage, either writer bypasses validation/hash, or
      either writer emits a CMB that fails the P106 schema.
    stop_rule: |
      Stop once both writers expose --help, support their --self-test paths, fail
      closed on invalid input, and append only schema-valid CMB JSONL rows.
    depends_on: [t1]
    verification_cmd: "node super-gsd/tools/mesh-memory/execution-receipt.cjs --help"

  - id: t3
    agent: codex-executor
    model: codex
    files_touched:
      - super-gsd/tools/mesh-memory/run-self-test.cjs
      - super-gsd/tools/mesh-memory/README.md
    input_contract: |
      Consume t1 and t2 outputs plus the P106 good, bad, and hash fixtures. Do not
      alter the frozen P106 schema or fixtures.
    output_contract: |
      run-self-test.cjs loads cmb.schema.json through ajv, runs at least 15
      assertions covering the seven good fixtures, six rejection fixtures, hash
      created_at/body behavior, the six P106 SAC command paths, and both writer
      smoke tests. README.md documents operator usage for cmb-validate, cmb-hash,
      execution-receipt, review-finding-writer, and run-self-test.
    hypothesis: |
      One local integration self-test can retire the P106 bootstrapping SACs and
      prove the P107 validator/hasher/writer path is gate-ready.
    falsifier: |
      The self-test has fewer than 15 assertions, fails to execute either writer,
      omits the P106 fixture/hash behavior, exits 0 on a broken tool, or documents
      unsupported commands.
    stop_rule: |
      Stop once run-self-test.cjs is the authoritative integration verifier and
      README.md documents only the supported operator path for this phase.
    depends_on: [t1, t2]
    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs"
---

# Plan 107-01 — CMB Validator, Canonical Hash, Receipt Writer, and Finding Writer

## Goal

Ship the first executable consumers of the P106 CMB schema contract: validator CLI, canonical hash CLI, SGSD-emitted execution receipt writer, reviewer finding writer, integration self-test, and operator README.

## Bootstrapping note

P106 declared SACs for validator and hash behavior before the tools existed. Once P107 lands, SAC-P107-01 through SAC-P107-04 subsume the P106 schema/hash SACs operationally because the same fixtures are validated and hashed by real tools.

## Dispatch

t1 builds the validator and canonical hasher foundation. t2 consumes t1 to add the execution_receipt and review_finding writers. t3 consumes t1 and t2 to prove the full path with at least 15 assertions and document the supported operator workflow.

## Why no VTP enrichment

This phase is locked by local P106 artifacts, DLB-08 Mesh Memory Lite, and v3.0 requirements REQ-MML-03, REQ-MML-09, REQ-MML-10, REQ-POL-01, and REQ-POL-08. VTP/private KB is optional and adds no required evidence for this bounded tooling plan.
