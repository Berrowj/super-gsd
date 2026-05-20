SUCCESS: The process with PID 11724 (child process of PID 22848) has been terminated.
SUCCESS: The process with PID 13676 (child process of PID 22848) has been terminated.
SUCCESS: The process with PID 47936 (child process of PID 22848) has been terminated.
PATCH_BEGIN
diff --git a/.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-01-evidence-validator-lineage-echo-PLAN.md b/.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-01-evidence-validator-lineage-echo-PLAN.md
new file mode 100644
index 0000000..f0eae95
--- /dev/null
+++ b/.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-01-evidence-validator-lineage-echo-PLAN.md
@@ -0,0 +1,217 @@
+---
+schema_version: 2
+plan_id: 108-01
+phase: 108
+phase_name: Evidence Validator + Lineage DAG + Echo Detector
+milestone: v3.0
+title: Evidence validator, lineage DAG walker, echo detector, and self-test extension
+status: PLAN-LOCKED
+expected_ATC_tier: FULL
+skip_gates: []
+depends_on: []
+lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+semantic_acceptance_criteria:
+  - id: SAC-P108-01
+    input: "a review_finding CMB referencing super-gsd/schemas/cmb.schema.json:1-3 with quoted excerpt matching current file"
+    expected_outcome: "evidence-validator emits evidence_verdict with evidence_status=VERIFIED_CRIT and lineage.parents[0]=review_finding key"
+    verification_cmd: "node super-gsd/tools/mesh-memory/evidence-validator.cjs --self-test-verified; test $? -eq 0"
+
+  - id: SAC-P108-02
+    input: "a review_finding CMB claiming a file:line that does not match current HEAD content"
+    expected_outcome: "evidence-validator emits evidence_verdict with evidence_status=REFUTED_CRIT or STALE_CRIT"
+    verification_cmd: "node super-gsd/tools/mesh-memory/evidence-validator.cjs --self-test-refuted; test $? -eq 0"
+
+  - id: SAC-P108-03
+    input: "a review_finding pointing at super-gsd/tools/mesh-memory/__mocks__/fake.json"
+    expected_outcome: "evidence-validator rejects with reason 'fixture_path_in_real_data_check'"
+    verification_cmd: "node super-gsd/tools/mesh-memory/evidence-validator.cjs --self-test-fixture-guard; test $? -eq 0"
+
+  - id: SAC-P108-04
+    input: "lineage.cjs ancestors() over the seed ledger from a deep-leaf CMB"
+    expected_outcome: "ancestors array is correctly ordered and depth-bounded ≤50; provenance walk surfaces the root execution_receipt"
+    verification_cmd: "node super-gsd/tools/mesh-memory/lineage.cjs --self-test-ancestors; test $? -eq 0"
+
+  - id: SAC-P108-05
+    input: "echo-detector with an incoming CMB whose ancestors intersect with the receiver's Kself"
+    expected_outcome: "echoDetected: true; receiver still persists the attempt with lineage.echo_detected=true"
+    verification_cmd: "node super-gsd/tools/mesh-memory/echo-detector.cjs --self-test-echo-hit; test $? -eq 0"
+
+  - id: SAC-P108-06
+    input: "echo-detector with an incoming CMB whose ancestors do NOT intersect Kself"
+    expected_outcome: "echoDetected: false; receiver persists normally"
+    verification_cmd: "node super-gsd/tools/mesh-memory/echo-detector.cjs --self-test-echo-miss; test $? -eq 0"
+
+  - id: SAC-P108-07
+    input: "the integrated self-test runner exercising all three new tools end-to-end"
+    expected_outcome: "run-self-test.cjs exits 0 with ≥30 assertions passed"
+    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs; test $? -eq 0"
+tasks:
+  - id: t1
+    agent: codex-executor
+    model: codex
+    files_touched:
+      - super-gsd/tools/mesh-memory/lineage.cjs
+      - super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl
+    input_contract: |
+      Consume the frozen P106 CMB schema, P107 canonical hash behavior, and the
+      P108 context invariants for bounded lineage walking. Use the seed ledger as
+      realistic local data for multi-CMB lineage chains and echo-detection tests.
+      Do not implement evidence validation or receiver echo policy in this task.
+    output_contract: |
+      lineage.cjs exposes pure DAG walker functions over JSONL CMB ledgers:
+      ancestors(cmbKey, maxDepth=50), descendants(cmbKey), provenance(cmbKey),
+      and siblings(cmbKey). The walker is side-effect-free, depth-bounded at 50,
+      and can be used as both a module and a CLI with --help and self-test modes.
+      seed-ledger.jsonl contains a realistic execution_receipt -> review_finding
+      -> evidence_verdict lineage chain plus sibling/descendant cases for tests.
+    hypothesis: |
+      A small pure lineage module over content-hash keyed CMB rows can provide the
+      provenance, sibling, descendant, and bounded ancestor primitives needed by
+      evidence-validator and echo-detector without expanding the schema surface.
+    falsifier: |
+      lineage.cjs mutates the ledger, requires network or VTP state, walks beyond
+      50 ancestors, returns unordered ancestors, cannot find siblings sharing a
+      parent, fails to surface the root execution_receipt in provenance, or cannot
+      run under Node as a CLI/module.
+    stop_rule: |
+      Stop once lineage.cjs --help exits 0, the exported functions operate over
+      seed-ledger.jsonl, ancestor walks are ordered and bounded, and provenance
+      reaches the root execution_receipt for the deep-leaf fixture.
+    depends_on: []
+    verification_cmd: "node super-gsd/tools/mesh-memory/lineage.cjs --help"
+
+  - id: t2
+    agent: codex-executor
+    model: codex
+    files_touched:
+      - super-gsd/tools/mesh-memory/evidence-validator.cjs
+      - super-gsd/tools/mesh-memory/echo-detector.cjs
+    input_contract: |
+      Consume t1's lineage.cjs and seed ledger plus P107 cmb-validate.cjs and
+      cmb-hash.cjs behavior. Respect DLB-08's claim-versus-observation boundary,
+      P108's Tier 0+1-only policy, the real-data guard, and the mandatory
+      review_finding parent linkage for evidence_verdict CMBs.
+    output_contract: |
+      evidence-validator.cjs consumes review_finding CMBs and emits schema-valid
+      evidence_verdict CMBs created_by=evidence_validator with one of five states:
+      VERIFIED_CRIT, REFUTED_CRIT, STALE_CRIT, UNVERIFIED_CRIT, or GUARDED_CRIT.
+      It uses deterministic and heuristic checks only, rejects disallowed fixture
+      paths with fixture_path_in_real_data_check, validates/hashes before write,
+      and sets lineage.parents[0] to the review_finding content hash.
+
+      echo-detector.cjs consumes an incoming CMB plus a receiver Kself produced-key
+      set, uses lineage.cjs for O(1) ancestor-set intersection, returns
+      echoDetected true or false, and records the receiving attempt with
+      lineage.echo_detected instead of silently dropping echoes.
+    hypothesis: |
+      Evidence admission and echo detection can be implemented as local,
+      deterministic-plus-heuristic CMB tools layered on the P107 validator/hash
+      and t1 lineage primitives, without introducing Tier 2 LLM judgment or new
+      CMB vocabulary.
+    falsifier: |
+      evidence-validator treats reviewer claims as observations, emits an
+      evidence_verdict without review_finding lineage, accepts blocked fixture or
+      mock paths as real evidence, performs an LLM judgment, writes schema-invalid
+      CMBs, or echo-detector drops an echo attempt instead of recording
+      lineage.echo_detected.
+    stop_rule: |
+      Stop once both tools expose --help, the evidence-validator self-test modes
+      cover verified/refuted-or-stale/fixture-guard paths, echo-detector self-test
+      modes cover hit and miss paths, and all emitted CMBs validate through the
+      P107 validator.
+    depends_on: [t1]
+    verification_cmd: "node super-gsd/tools/mesh-memory/evidence-validator.cjs --help && node super-gsd/tools/mesh-memory/echo-detector.cjs --help"
+
+  - id: t3
+    agent: codex-executor
+    model: codex
+    files_touched:
+      - super-gsd/tools/mesh-memory/run-self-test.cjs
+      - super-gsd/skills/sgsd-audit/SKILL.md
+    input_contract: |
+      Consume t1 and t2 outputs plus the existing P107 self-test runner. Keep the
+      P106 schema, P106 fixtures, and P107 CLIs frozen except for the integration
+      self-test extension. Treat the sgsd-audit update as documentation-only
+      wire-in to the evidence_verdict CMB stream.
+    output_contract: |
+      run-self-test.cjs adds at least 10 new assertions for lineage.cjs,
+      evidence-validator.cjs, and echo-detector.cjs, raising the integrated floor
+      to at least 30 total assertions and exiting non-zero on any broken path.
+      super-gsd/skills/sgsd-audit/SKILL.md documents evidence_verdict CMBs as the
+      Layer 4 Semantic-AC admission output source without adding a new mandatory
+      dispatch path.
+    hypothesis: |
+      Extending the existing integration self-test and documenting the Layer 4
+      CMB evidence source is enough to prove P108 is gate-ready while keeping
+      sgsd-audit behavior unchanged until a later phase chooses to enforce it.
+    falsifier: |
+      The self-test has fewer than 30 assertions, omits any of the three new
+      tools, exits 0 when a P108 tool is broken, relies on mock evidence as real
+      data, or the sgsd-audit documentation claims a mandatory dispatch behavior
+      that P108 did not implement.
+    stop_rule: |
+      Stop once run-self-test.cjs executes the three new tools end-to-end with at
+      least 30 passing assertions and the sgsd-audit skill text points Layer 4 to
+      evidence_verdict CMBs as the canonical admission evidence stream.
+    depends_on: [t1, t2]
+    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs"
+---
+
+# Plan 108-01 — Evidence Validator, Lineage DAG, and Echo Detector
+
+## Goal
+
+Ship the P108 executable Mesh Memory Lite layer: a bounded lineage DAG walker,
+Tier 0+1 evidence admission for review_finding CMBs, O(1) echo detection through
+ancestor-set intersection, an integration self-test floor of at least 30
+assertions, and documentation that points sgsd-audit Layer 4 at evidence_verdict
+CMBs.
+
+## Tier Policy
+
+P108 is Tier 0+1 only. The implementation may use deterministic checks such as
+file existence, line existence, excerpt matching, grep matching, validation, and
+test-passed evidence, plus bounded heuristics such as claim class, severity,
+changed-file overlap, and lineage to a prior finding. Tier 2 LLM judgment is
+explicitly out of scope and belongs to P109 pseudo_operator work.
+
+## Dispatch
+
+t1 builds the lineage primitive and seed ledger. t2 consumes lineage.cjs to add
+evidence-validator.cjs and echo-detector.cjs. t3 consumes all three tools to
+extend the integration self-test and perform the soft sgsd-audit documentation
+wire-in. The task chain is serial because evidence validation and echo detection
+both depend on the same lineage walker contract.
+
+## Why no VTP enrichment
+
+This phase is locked by local P106 schema artifacts, P107 CLIs, P108 context, and
+DLB-08. VTP/private KB is optional by project rule and adds no required evidence
+for this bounded implementation plan; relying on it would weaken the Phase 48
+selective-bridge graceful-degradation contract.
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-01-evidence-validator-lineage-echo-PLAN.md (created)
VERIFICATION:
  - PLAN authored against plan-schema-v2 required fields: schema_version, tasks, semantic_acceptance_criteria.
  - 7 semantic acceptance criteria copied verbatim from 108-CONTEXT.
  - 3 tasks declared with required v2 task fields and depends_on chain: t1 none; t2 [t1]; t3 [t1, t2].
  - expected_ATC_tier FULL, skip_gates [], and lessons_path set to .planning/decisions/DLB-08-MESH-MEMORY-LITE.md.
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: P108-01 PLAN authored — evidence_validator + lineage + echo detector + self-test extension; 7 SACs verbatim from CONTEXT.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
