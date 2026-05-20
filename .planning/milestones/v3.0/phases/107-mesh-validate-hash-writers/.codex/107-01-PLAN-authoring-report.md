SUCCESS: The process with PID 37924 (child process of PID 46388) has been terminated.
SUCCESS: The process with PID 36572 (child process of PID 46388) has been terminated.
SUCCESS: The process with PID 32284 (child process of PID 46388) has been terminated.
PATCH_BEGIN
diff --git a/.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md b/.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md
index 5f3b5f1..b6a7d2c 100644
--- a/.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md
+++ b/.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md
@@ -1,88 +1,137 @@
 ---
 schema_version: 2
-id: P107-01
-title: "CMB Validator + Canonical Hash + Receipt and Finding Writers"
+plan_id: 107-01
+phase: 107
+phase_name: CMB Validator + Canonical Hash + Receipt and Finding Writers
 milestone: v3.0
-phase: 107-mesh-validate-hash-writers
+title: CMB validator, canonical hash, receipt writer, and finding writer
 status: PLAN-LOCKED
 expected_ATC_tier: FULL
 skip_gates: []
-lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+depends_on: []
+lessons_path: .planning/decisions/DLB-08-MESH-MEMORY-LITE.md
 semantic_acceptance_criteria:
-  - "SAC-P107-01: cmb-validate.cjs validates CMB artifacts against the P106 schema contract and rejects invalid artifacts with actionable non-zero failures."
-  - "SAC-P107-02: cmb-hash.cjs emits deterministic canonical hashes for schema-valid CMB artifacts, independent of JSON key order and insignificant whitespace."
-  - "SAC-P107-03: CLI tooling is invocable from Node, exposes --help, consumes the P106 schema instead of duplicating it, and is wired through package.json without bypassing SGSD gates."
-  - "SAC-P107-04: execution-receipt.cjs writes schema-valid execution receipts linked to the canonical CMB hash, preserving provenance, timestamps, command metadata, and evidence paths."
-  - "SAC-P107-05: review-finding-writer.cjs writes schema-valid review findings linked to the canonical CMB hash, preserving severity, status, reviewer, and evidence references."
-  - "SAC-P107-06: Receipt and finding writers consume the shared validator and hasher and fail closed when validation or canonical hashing fails."
-  - "SAC-P107-07: run-self-test.cjs proves the validator, canonical hasher, receipt writer, finding writer, package wiring, and README operator path with at least 15 assertions and exits 0 on success."
+  - id: SAC-P107-01
+    input: "the 7 good fixtures from P106"
+    expected_outcome: "cmb-validate.cjs exits 0 for all 7 good fixtures"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/good-*.json; test $? -eq 0"
+
+  - id: SAC-P107-02
+    input: "the 6 bad fixtures from P106 that should reject"
+    expected_outcome: "cmb-validate.cjs exits non-zero with the appropriate SCHEMA-MML-* error code for each"
+    verification_cmd: "for f in bad-claim-as-observation bad-context-anchor-without-source bad-execution-receipt-created-by-agent bad-cmb-missing-cat7 bad-cmb-missing-type bad-review-finding-without-lineage; do node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/$f.json && exit 1; done; exit 0"
+
+  - id: SAC-P107-03
+    input: "hash-a.json + hash-a-created-at-changed.json (identical except for created_at)"
+    expected_outcome: "cmb-hash.cjs --compare produces 'same' (hash equality)"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-created-at-changed.json | grep -q 'same'"
+
+  - id: SAC-P107-04
+    input: "hash-a.json + hash-a-body-changed.json (identical except for body content)"
+    expected_outcome: "cmb-hash.cjs --compare produces 'different'"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-body-changed.json | grep -q 'different'"
+
+  - id: SAC-P107-05
+    input: "execution-receipt.cjs invoked with fixture input emulating a Codex post-executor sequence"
+    expected_outcome: "writes one execution_receipt CMB to .planning/mesh/memory/cmbs.jsonl with created_by=sgsd-wrapper, role=sgsd, authority_level=observation"
+    verification_cmd: "node super-gsd/tools/mesh-memory/execution-receipt.cjs --self-test; test $? -eq 0"
+
+  - id: SAC-P107-06
+    input: "review-finding-writer.cjs invoked with fixture reviewer prose pointing at the execution_receipt's content hash"
+    expected_outcome: "emits one review_finding CMB with lineage.parents[0] = receipt content hash; authority_level=claim"
+    verification_cmd: "node super-gsd/tools/mesh-memory/review-finding-writer.cjs --self-test; test $? -eq 0"
+
+  - id: SAC-P107-07
+    input: "self-test runner over all fixtures + writer smokes"
+    expected_outcome: "run-self-test.cjs exits 0 with at least 15 assertions"
+    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs; test $? -eq 0"
 tasks:
   - id: t1
     agent: codex-executor
     model: codex
-    depends_on: []
     files_touched:
       - super-gsd/tools/mesh-memory/cmb-validate.cjs
       - super-gsd/tools/mesh-memory/cmb-hash.cjs
-      - package.json
-    input_contract: "Consume the P106 CMB schema contract as the only schema authority; expose validator and canonical-hash CLIs without receipt or finding writer behavior."
-    output_contract: "Working cmb-validate.cjs and cmb-hash.cjs CLIs plus package.json wiring; --help works and invalid CMB input fails non-zero with actionable diagnostics."
-    hypothesis: "A small shared validator plus deterministic canonical JSON hashing layer can make the P106 schema executable for downstream CMB consumers."
-    falsifier: "If either CLI duplicates schema definitions, accepts invalid CMB artifacts, emits nondeterministic hashes, or cannot be invoked from Node, the task fails."
-    stop_rule: "Stop after validator/hasher CLI behavior and package wiring are complete; do not implement receipt or finding writers in this task."
+      - super-gsd/tools/mesh-memory/package.json
+    input_contract: |
+      Consume the frozen P106 schema at super-gsd/schemas/cmb.schema.json and the
+      P106 fixtures under super-gsd/tools/mesh-memory/fixtures/. Implement only
+      CLI tooling for validation and canonical hashing; do not implement writers
+      in this task.
+    output_contract: |
+      cmb-validate.cjs validates one or more CMB JSON files against the P106 schema
+      and exits non-zero with actionable SCHEMA-MML diagnostics on invalid input.
+      cmb-hash.cjs computes sha256 over the sorted-keys canonical payload excluding
+      created_at and status, and supports --compare with same/different output.
+      package.json declares the local dependencies and package entrypoints needed
+      by these tools.
+    hypothesis: |
+      A shared validator and canonical hasher can make the P106 CMB schema
+      executable without duplicating schema rules or introducing writer behavior.
+    falsifier: |
+      Either CLI duplicates the schema contract, includes created_at or status in
+      the canonical hash, accepts invalid fixtures, rejects good fixtures, cannot
+      run under Node, or writes receipt/finding CMBs during this task.
+    stop_rule: |
+      Stop once cmb-validate.cjs --help works, cmb-hash.cjs can compute and compare
+      fixture hashes, package dependencies are declared, and no writer behavior has
+      been added.
+    depends_on: []
     verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --help"
+
   - id: t2
     agent: codex-executor
     model: codex
-    depends_on: [t1]
     files_touched:
       - super-gsd/tools/mesh-memory/execution-receipt.cjs
       - super-gsd/tools/mesh-memory/review-finding-writer.cjs
-    input_contract: "Consume t1's validator and canonical hasher; write only execution receipts and review findings that conform to the P106 CMB schema contract."
-    output_contract: "Working receipt and finding writer CLIs that validate inputs, attach canonical CMB hashes, write deterministic artifacts, and fail closed on validation/hash errors."
-    hypothesis: "The two writer tools can share t1's validation/hash layer and produce auditable CMB artifacts without re-implementing schema or canonicalization logic."
-    falsifier: "If either writer bypasses t1, writes artifacts that fail validation, omits canonical hash linkage, or mutates unrelated evidence, the task fails."
-    stop_rule: "Stop after the two writers are functional and smoke-invocable; leave integration assertions and operator docs to t3."
+    input_contract: |
+      Consume t1's validator and canonical hasher. Use DLB-08, REQ-MML-09,
+      REQ-MML-10, and the P107 context invariants as the writer contract.
+    output_contract: |
+      execution-receipt.cjs emits one schema-valid execution_receipt CMB from
+      observable SGSD wrapper facts and appends to .planning/mesh/memory/cmbs.jsonl
+      with created_by=sgsd or sgsd-wrapper only. review-finding-writer.cjs emits
+      one review_finding CMB per structured finding and requires lineage.parents[0]
+      to reference the execution_receipt content hash. Both writers validate and
+      hash before write.
+    hypothesis: |
+      The two writer tools can share t1's validator/hash layer and preserve the
+      observation-versus-claim boundary without adding new schema surface.
+    falsifier: |
+      execution_receipt accepts executor/agent created_by values, review_finding
+      writes without receipt lineage, either writer bypasses validation/hash, or
+      either writer emits a CMB that fails the P106 schema.
+    stop_rule: |
+      Stop once both writers expose --help, support their --self-test paths, fail
+      closed on invalid input, and append only schema-valid CMB JSONL rows.
+    depends_on: [t1]
     verification_cmd: "node super-gsd/tools/mesh-memory/execution-receipt.cjs --help"
+
   - id: t3
     agent: codex-executor
     model: codex
-    depends_on: [t1, t2]
     files_touched:
       - super-gsd/tools/mesh-memory/run-self-test.cjs
       - super-gsd/tools/mesh-memory/README.md
-    input_contract: "Consume t1 and t2 tooling as implemented; document the operator path and build an integration self-test with at least 15 assertions."
-    output_contract: "run-self-test.cjs exits 0 after proving validator, hasher, writers, package wiring, and invalid-input failure paths; README.md documents supported usage and evidence expectations."
-    hypothesis: "A local self-test and concise README can make the CMB validator/hash/writer path independently executable by operators and gates."
-    falsifier: "If the self-test has fewer than 15 assertions, misses invalid-path coverage, fails to exercise both writers, or the README documents unsupported behavior, the task fails."
-    stop_rule: "Stop once the self-test is the single integration verifier and README documents the supported operator path; do not expand scope into VTP or non-CMB tooling."
+    input_contract: |
+      Consume t1 and t2 outputs plus the P106 good, bad, and hash fixtures. Do not
+      alter the frozen P106 schema or fixtures.
+    output_contract: |
+      run-self-test.cjs loads cmb.schema.json through ajv, runs at least 15
+      assertions covering the seven good fixtures, six rejection fixtures, hash
+      created_at/body behavior, the six P106 SAC command paths, and both writer
+      smoke tests. README.md documents operator usage for cmb-validate, cmb-hash,
+      execution-receipt, review-finding-writer, and run-self-test.
+    hypothesis: |
+      One local integration self-test can retire the P106 bootstrapping SACs and
+      prove the P107 validator/hasher/writer path is gate-ready.
+    falsifier: |
+      The self-test has fewer than 15 assertions, fails to execute either writer,
+      omits the P106 fixture/hash behavior, exits 0 on a broken tool, or documents
+      unsupported commands.
+    stop_rule: |
+      Stop once run-self-test.cjs is the authoritative integration verifier and
+      README.md documents only the supported operator path for this phase.
+    depends_on: [t1, t2]
     verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs"
 ---
 
-## Goal
+# Plan 107-01 — CMB Validator, Canonical Hash, Receipt Writer, and Finding Writer
 
-Implement the first consumer phase of the P106 CMB schema contract: validator CLI, canonical hash CLI, execution receipt writer, review finding writer, integration self-test, and operator README.
+## Goal
+
+Ship the first executable consumers of the P106 CMB schema contract: validator CLI, canonical hash CLI, SGSD-emitted execution receipt writer, reviewer finding writer, integration self-test, and operator README.
 
 ## Bootstrapping note
 
-P106 defined the CMB schema contract before executable consumers existed. Once P107 lands, these P107 SACs subsume the P106 SACs operationally because the schema will be validated, hashed, written, and smoke-tested by real tools.
+P106 declared SACs for validator and hash behavior before the tools existed. Once P107 lands, SAC-P107-01 through SAC-P107-04 subsume the P106 schema/hash SACs operationally because the same fixtures are validated and hashed by real tools.
 
 ## Dispatch
 
-t1 builds the validator and canonical hasher foundation. t2 consumes t1 to add the two writer tools. t3 consumes t1 and t2 to prove the full path with at least 15 assertions and document the supported operator workflow.
+t1 builds the validator and canonical hasher foundation. t2 consumes t1 to add the execution_receipt and review_finding writers. t3 consumes t1 and t2 to prove the full path with at least 15 assertions and document the supported operator workflow.
 
 ## Why no VTP enrichment
 
-This phase is load-bearing local SGSD tooling. The implementation should stay bounded to the P106 CMB schema contract, DLB-08 Mesh Memory Lite design lock, and v3.0 mesh-memory requirements; VTP enrichment is intentionally out of scope.
+This phase is locked by local P106 artifacts, DLB-08 Mesh Memory Lite, and v3.0 requirements REQ-MML-03, REQ-MML-09, REQ-MML-10, REQ-POL-01, and REQ-POL-08. VTP/private KB is optional and adds no required evidence for this bounded tooling plan.
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md (modified)
VERIFICATION:
  - Not executed per no-tool rule; patch uses plan-schema-v2 required fields and object-shaped semantic_acceptance_criteria.
  - 7 SACs declared verbatim from 107-CONTEXT.
  - 3 tasks with depends_on chain (t2 <- t1; t3 <- t1, t2).
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: P107-01 PLAN corrected — 3 tasks for validator/hasher/writers/self-test; 7 SACs verbatim from CONTEXT.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
