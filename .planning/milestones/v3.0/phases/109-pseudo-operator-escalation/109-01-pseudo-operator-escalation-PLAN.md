---
schema_version: 2
plan_id: 109-01
phase: 109
phase_name: Pseudo Operator Peer + Escalation Gate
milestone: v3.0
title: Pseudo operator peer, escalation gate, and Fixture D restraint proof
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
depends_on: []
lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
semantic_acceptance_criteria:
  - id: SAC-P109-01
    input: "pseudo-operator-peer --self-test-verified-path: evidence_verdict CMB with VERIFIED_CRIT status + low-risk context (e.g., schema-only plan)"
    expected_outcome: "emits decision_recommendation with authority_level=3, confidence>=0.80, real_operator_required=false, carve_outs_triggered=[]"
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --self-test-verified-path; test $? -eq 0"

  - id: SAC-P109-02
    input: "pseudo-operator-peer --self-test-refuted-path: evidence_verdict CMB with REFUTED_CRIT"
    expected_outcome: "emits decision_recommendation suggesting PASS_WITH_REFUTED_REVIEW; cites the refutation"
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --self-test-refuted-path; test $? -eq 0"

  - id: SAC-P109-03
    input: "escalation-gate.checkCarveOuts({ target_systems: ['mongo'], decision_type: 'data_mutation' })"
    expected_outcome: "carve_outs_triggered includes 'production_mutation'; real_operator_required=true"
    verification_cmd: "node super-gsd/tools/mesh-memory/escalation-gate.cjs --self-test-production-mutation; test $? -eq 0"

  - id: SAC-P109-04
    input: "escalation-gate.checkCarveOuts({ target_files: ['secrets.env'], decision_type: 'config_change' })"
    expected_outcome: "carve_outs_triggered includes 'credential_or_security'; real_operator_required=true"
    verification_cmd: "node super-gsd/tools/mesh-memory/escalation-gate.cjs --self-test-credential; test $? -eq 0"

  - id: SAC-P109-05
    input: "pseudo-operator-peer fed an evidence chain with high LLM-judge confidence (0.95) BUT target_systems includes 'sap'"
    expected_outcome: "FIXTURE D — production-mutation hard carve-out FORCES real_operator_required=true regardless of confidence"
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --self-test-fixture-d; test $? -eq 0"

  - id: SAC-P109-06
    input: "pseudo-operator-peer with low confidence (0.50)"
    expected_outcome: "real_operator_required=true regardless of decision type; carve_outs_triggered includes 'low_confidence'"
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --self-test-low-confidence; test $? -eq 0"

  - id: SAC-P109-07
    input: "run-self-test runner covering both new tools + Fixture D restraint proof"
    expected_outcome: "exit 0 with ≥60 assertions passed"
    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs; test $? -eq 0"
tasks:
  - id: t1
    agent: codex-executor
    model: codex
    files_touched:
      - super-gsd/tools/mesh-memory/escalation-gate.cjs
    input_contract: |
      Consume P109 context, DLB-08 hard carve-outs, the frozen P106 CMB schema
      vocabulary, and the P108 evidence_verdict lineage contract. This task owns
      only the pure escalation primitive. Do not read ledgers, call Codex, inspect
      files, mutate state, or implement pseudo-operator recommendation logic here.
    output_contract: |
      escalation-gate.cjs exports a side-effect-free checkCarveOuts(decisionContext)
      function and a small CLI with --help plus local self-test modes. Given
      decision_type, target_files, target_systems, milestone_state, and confidence,
      the function returns { allow_autonomous, real_operator_required,
      carve_outs_triggered } with hard carve-outs for production_mutation,
      credential_or_security, milestone_scope_change, commercial_legal_policy,
      low_confidence, and destructive_or_irreversible. If any carve-out triggers,
      real_operator_required is true regardless of pseudo-operator confidence.
    hypothesis: |
      A tiny pure-function escalation gate can make the DLB-08 restraint policy
      structural: pseudo-operator code can consume a single deterministic result
      instead of re-implementing or weakening hard carve-out checks.
    falsifier: |
      escalation-gate.cjs performs file, process, network, model, environment, or
      ledger I/O; misses SAP/Mongo/Qdrant/Elasticsearch/customer-DB production
      mutation; misses obvious key/token/credential/auth-bypass cues; allows
      confidence >=0.80 to clear a hard carve-out; or cannot be imported and
      tested as a pure module.
    stop_rule: |
      Stop once escalation-gate.cjs exposes checkCarveOuts as an importable pure
      function, --help exits 0, production-mutation and credential self-tests exit
      0, and all carve-out reason codes are stable strings matching P109 context.
    depends_on: []
    verification_cmd: "node super-gsd/tools/mesh-memory/escalation-gate.cjs --help"

  - id: t2
    agent: codex-executor
    model: codex
    files_touched:
      - super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs
      - super-gsd/tools/mesh-memory/run-self-test.cjs
    input_contract: |
      Consume t1 escalation-gate.cjs, P108 evidence_verdict CMBs, context_anchor
      and operator_precedent CMBs, P107 validation/hash behavior, lineage.cjs, and
      echo-detector.cjs. Treat deterministic evidence_verdict states as admitted
      evidence. Use Tier 2 LLM judgment only for genuinely semantic trade-offs,
      and degrade to a rule-based recommendation when Codex CLI is unreachable.
    output_contract: |
      pseudo-operator-peer.cjs consumes admitted evidence_verdict, context_anchor,
      and operator_precedent CMBs and emits schema-valid decision_recommendation
      CMBs with recommendation, authority_level 1-3, confidence 0-1,
      real_operator_required, context_pack_id, evidence_refs[],
      carve_outs_triggered[], and lineage.parents including one or more
      evidence_verdict keys. Matching operator_precedent CMBs are cited in the
      recommendation and lineage for traceability. The peer imports t1's
      escalation gate and cannot downgrade, ignore, or mask hard carve-outs.

      run-self-test.cjs adds at least 10 new assertions covering escalation-gate,
      pseudo-operator-peer, low-risk auto-continue, REFUTED_CRIT routing,
      credential escalation, low-confidence escalation, production mutation, and
      Fixture D. The integrated self-test exits 0 with at least 60 assertions.
    hypothesis: |
      Layering pseudo-operator recommendation on top of validated evidence,
      operator precedents, lineage, echo detection, and the pure escalation gate
      can complete DLB-08 fixtures B-D while preserving the binding rule that no
      LLM judgment overrides hard carve-outs.
    falsifier: |
      pseudo-operator-peer emits decision_recommendation CMBs without evidence
      lineage, ignores matching operator_precedent CMBs, treats REFUTED_CRIT as a
      normal pass, requires network/private KB/external model access for self-test
      or help output, duplicates conflicting carve-out logic, suppresses a t1
      escalation, or passes Fixture D with real_operator_required=false.
    stop_rule: |
      Stop once pseudo-operator-peer.cjs --help exits 0, verified/refuted/Fixture D
      and low-confidence self-test modes exit 0, emitted decision_recommendation
      CMBs satisfy the P106 schema shape, and run-self-test.cjs covers both new
      tools with at least 10 new assertions and at least 60 total passing
      assertions.
    depends_on: [t1]
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --help && node super-gsd/tools/mesh-memory/run-self-test.cjs"
---

# Plan 109-01 — Pseudo Operator Peer and Escalation Gate

## Goal

Ship the final DLB-08 Mesh Memory Lite phase: a pure escalation-gate carve-out
checker, a pseudo-operator peer that emits decision_recommendation CMBs from
validated evidence plus context anchors and operator precedents, and integration
self-test coverage that proves Fixture D restraint.

## Restraint Policy

Hard carve-outs override LLM confidence. Production mutation, credentials or
security, milestone scope change, commercial/legal/policy impact, low confidence,
and destructive or irreversible decisions force real_operator_required=true even
when the Tier 2 judge reports confidence 1.0. The implementation should make that
policy structural: pseudo-operator-peer consumes escalation-gate.cjs and cannot
downgrade, suppress, or reinterpret a hard carve-out result.

## Dispatch

t1 builds escalation-gate.cjs as the importable pure-function carve-out checker.
t2 depends on t1, builds pseudo-operator-peer.cjs, and extends run-self-test.cjs
with at least 10 assertions including Fixture D. The task chain is serial because
the pseudo-operator must consume the gate result rather than duplicating
escalation policy.
