SUCCESS: The process with PID 37744 (child process of PID 44364) has been terminated.
SUCCESS: The process with PID 34676 (child process of PID 44364) has been terminated.
SUCCESS: The process with PID 12892 (child process of PID 44364) has been terminated.
PATCH_BEGIN
diff --git a/.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md b/.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md
index 0000000..1111111 100644
--- a/.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md
+++ b/.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md
@@ -1,155 +1,157 @@
 ---
 schema_version: 2
-plan_id: P106-01-cmb-schema
-phase_id: P106
-phase_name: 106-mesh-cmb-schema
+plan_id: 106-01
+phase: 106
+phase_name: Mesh CMB Schema and Canonical Hashing
 milestone: v3.0
-title: Mesh CMB Schema and Canonical Hashing
+title: Mesh CMB schema and canonical hashing contract
 status: PLAN-LOCKED
 expected_ATC_tier: FULL
 skip_gates: []
-lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+depends_on: []
+lessons_path: .planning/decisions/DLB-08-MESH-MEMORY-LITE.md
 semantic_acceptance_criteria:
   - id: SAC-P106-01
-    statement: "cmb-validate.cjs accepts all seven good CMB fixtures: execution-receipt, review-finding, evidence-verdict, decision-recommendation, operator-precedent, context-anchor, and promotion-decision."
-    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json super-gsd/tools/mesh-memory/fixtures/good-review-finding.json super-gsd/tools/mesh-memory/fixtures/good-evidence-verdict.json super-gsd/tools/mesh-memory/fixtures/good-decision-recommendation.json super-gsd/tools/mesh-memory/fixtures/good-operator-precedent.json super-gsd/tools/mesh-memory/fixtures/good-context-anchor.json super-gsd/tools/mesh-memory/fixtures/good-promotion-decision.json"
+    input: "fixtures/good-execution-receipt.json"
+    expected_outcome: "validates successfully and is classified as observation CMB"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --fixture fixtures/good-execution-receipt.json && test $? -eq 0"
+
   - id: SAC-P106-02
-    statement: "cmb-validate.cjs rejects the intentionally bad CMB fixtures that violate category, source, author, CAT7, hash, and lineage constraints."
-    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/bad-claim-as-observation.json super-gsd/tools/mesh-memory/fixtures/bad-context-anchor-without-source.json super-gsd/tools/mesh-memory/fixtures/bad-execution-receipt-created-by-agent.json super-gsd/tools/mesh-memory/fixtures/bad-cmb-missing-cat7.json super-gsd/tools/mesh-memory/fixtures/bad-cmb-created-at-affects-hash.json super-gsd/tools/mesh-memory/fixtures/bad-review-finding-without-lineage.json"
+    input: "fixtures/bad-execution-receipt-created-by-agent.json"
+    expected_outcome: "validation rejects (non-zero exit) because execution_receipt may only be emitted by SGSD/system roles"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --fixture fixtures/bad-execution-receipt-created-by-agent.json; test $? -ne 0"
+
   - id: SAC-P106-03
-    statement: "cmb-hash.cjs produces the same canonical hash for hash-a.json and hash-a-created-at-changed.json because created_at is metadata, not semantic content."
-    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-created-at-changed.json"
+    input: "two CMB fixtures identical except for created_at"
+    expected_outcome: "content_hash is identical — created_at is excluded from the canonical payload"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare fixtures/hash-a.json fixtures/hash-a-created-at-changed.json | grep -q 'same'"
+
   - id: SAC-P106-04
-    statement: "cmb-hash.cjs produces a different canonical hash for hash-a.json and hash-a-body-changed.json because semantic content changed."
-    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-body-changed.json"
+    input: "two CMB fixtures differing only in body content"
+    expected_outcome: "content_hash differs — body IS part of canonical payload"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare fixtures/hash-a.json fixtures/hash-a-body-changed.json | grep -q 'different'"
+
   - id: SAC-P106-05
-    statement: "The CMB schema keeps observation and claim semantics distinct: claim-like content cannot pass as an observation CMB."
-    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/bad-claim-as-observation.json"
+    input: "fixtures/bad-context-anchor-without-source.json"
+    expected_outcome: "validation rejects because context_anchor must include canonical_source_path AND canonical_source_hash"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --fixture fixtures/bad-context-anchor-without-source.json; test $? -ne 0"
+
   - id: SAC-P106-06
-    statement: "The CMB schema enforces lineage for review findings so reviewer memory cannot detach from the reviewed artifact."
-    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/bad-review-finding-without-lineage.json"
+    input: "fixtures/bad-review-finding-without-lineage.json (claiming blocking status without evidence_verdict parent)"
+    expected_outcome: "validation rejects — review_finding may not assert blocking authority without an evidence_verdict lineage parent"
+    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --fixture fixtures/bad-review-finding-without-lineage.json; test $? -ne 0"
 tasks:
   - id: t1
     agent: codex-executor
     model: codex
     files_touched:
       - super-gsd/schemas/cmb.schema.json
-    input_contract: "Use 106-CONTEXT.md and DLB-08 to author only the JSON Schema contract for seven CMB types. Do not add validator, hashing, executor, reviewer, pseudo-operator, hook, audit-skill, or runtime memory files."
-    output_contract: "super-gsd/schemas/cmb.schema.json exists, parses as JSON, defines the common CAT7 envelope, and enforces class-specific required-field rules for the seven CMB types."
-    hypothesis: "A single schema file can express the locked CMB envelope and per-type constraints without introducing runtime behavior."
-    falsifier: "The schema cannot parse as JSON, permits a missing CAT7 field, omits one of the seven CMB types, or requires implementation code outside the schema file."
-    stop_rule: "Stop after the schema parses and its declared type branches cover exactly the seven locked CMB types."
+    input_contract: |
+      Read 106-CONTEXT.md, DLB-08, v3.0 INTENT, and REQUIREMENTS. Author only
+      the schema contract for the seven locked CMB types. Do not implement
+      cmb-validate.cjs, cmb-hash.cjs, executor/reviewer/pseudo-operator code,
+      Codex hooks, audit skills, or runtime CMB files.
+    output_contract: |
+      super-gsd/schemas/cmb.schema.json exists, parses as JSON, declares exactly
+      the seven allowed CMB types, requires the full CAT7 envelope, and enforces
+      class-specific required fields and role/created_by separation for the CMB
+      contract.
+    hypothesis: |
+      One JSON Schema file can encode the locked CMB envelope, vocabulary, and
+      per-type constraints without adding runtime behavior that belongs to P107+.
+    falsifier: |
+      The schema fails JSON parsing, omits any locked CMB type, allows incomplete
+      CAT7, permits executor-authored execution receipts, or requires source
+      changes outside super-gsd/schemas/cmb.schema.json.
+    stop_rule: |
+      Stop once cmb.schema.json parses and its branches cover exactly the seven
+      locked CMB types with the class-specific required fields from 106-CONTEXT.md.
     verification_cmd: "node -e \"JSON.parse(require('fs').readFileSync('super-gsd/schemas/cmb.schema.json'))\""
+
   - id: t2
     agent: codex-executor
     model: codex
@@ -162,12 +164,26 @@ tasks:
       - super-gsd/tools/mesh-memory/fixtures/good-operator-precedent.json
       - super-gsd/tools/mesh-memory/fixtures/good-context-anchor.json
       - super-gsd/tools/mesh-memory/fixtures/good-promotion-decision.json
-    input_contract: "Use the locked CMB schema contract to create one positive fixture for each of the seven CMB types. Fixtures must remain static examples only."
-    output_contract: "Seven good fixture JSON files exist, parse as JSON, and each represents a distinct valid CMB type for later P107 validation tooling."
-    hypothesis: "The schema contract is concrete enough to demonstrate one valid instance for every CMB type using fixtures alone."
-    falsifier: "Any good fixture fails JSON parsing, duplicates another CMB type instead of covering its own type, or requires runtime CMB files under .planning/mesh/memory/."
-    stop_rule: "Stop after all seven good fixtures parse and map one-to-one to the seven locked CMB types."
+    input_contract: |
+      Use the locked CMB schema and fixture contract from 106-CONTEXT.md. Create
+      one positive static fixture for each of the seven CMB types. Fixtures are
+      repo test data for P107 tooling, not runtime memory records.
+    output_contract: |
+      Seven good fixture JSON files exist under super-gsd/tools/mesh-memory/fixtures/,
+      parse as JSON, and demonstrate valid execution_receipt, review_finding,
+      evidence_verdict, decision_recommendation, operator_precedent,
+      context_anchor, and promotion_decision instances.
+    hypothesis: |
+      The P106 schema contract is concrete enough to express one valid fixture
+      for every locked CMB type without introducing validator or hash tooling.
+    falsifier: |
+      Any good fixture fails JSON parsing, duplicates another type instead of
+      covering its assigned type, lacks required class-specific fields, or writes
+      runtime CMB records under .planning/mesh/memory/.
+    stop_rule: |
+      Stop once all seven good fixtures parse and map one-to-one to the seven
+      locked CMB types.
     verification_cmd: "node -e \"for (const f of ['good-execution-receipt','good-review-finding','good-evidence-verdict','good-decision-recommendation','good-operator-precedent','good-context-anchor','good-promotion-decision']) JSON.parse(require('fs').readFileSync('super-gsd/tools/mesh-memory/fixtures/'+f+'.json'))\""
+
   - id: t3
     agent: codex-executor
     model: codex
@@ -181,25 +197,39 @@ tasks:
       - super-gsd/tools/mesh-memory/fixtures/hash-a.json
       - super-gsd/tools/mesh-memory/fixtures/hash-a-created-at-changed.json
       - super-gsd/tools/mesh-memory/fixtures/hash-a-body-changed.json
-    input_contract: "Use the locked negative and hash-demonstration fixture list from 106-CONTEXT.md. These files are fixtures for P107 tooling, not runtime memory records."
-    output_contract: "Six bad fixture JSON files and three hash variant JSON files exist, parse as JSON, and demonstrate the P106 semantic constraints consumed by P107."
-    hypothesis: "Negative and hash-variant fixtures can make the schema and canonical hashing contract testable without implementing cmb-validate.cjs or cmb-hash.cjs in P106."
-    falsifier: "Any fixture fails JSON parsing, any required negative fixture is missing, hash variants do not isolate created_at versus body changes, or the task edits P107 tooling."
-    stop_rule: "Stop after the six bad fixtures and three hash variants parse and no validator or hashing tool files have been added or modified."
+    input_contract: |
+      Use the locked negative fixture and hash-variant list from 106-CONTEXT.md.
+      These files are fixtures for P107 validation and hashing tools, not runtime
+      memory records.
+    output_contract: |
+      Six bad fixture JSON files and three hash-variant JSON files exist under
+      super-gsd/tools/mesh-memory/fixtures/, parse as JSON, and demonstrate claim
+      vs observation separation, context-anchor source requirements,
+      executor-authorship rejection, CAT7 completeness, reviewer self-authority
+      rejection, and canonical-hash created_at/body behavior.
+    hypothesis: |
+      Negative and hash-variant fixtures can make the schema and canonical hashing
+      contract testable while P106 remains schema-only.
+    falsifier: |
+      Any fixture fails JSON parsing, any required negative fixture is missing,
+      hash variants fail to isolate created_at versus body changes, or the task
+      edits cmb-validate.cjs, cmb-hash.cjs, hooks, audit skills, or runtime CMBs.
+    stop_rule: |
+      Stop once all six bad fixtures and all three hash variants parse and no P107
+      tooling files have been added or modified.
     verification_cmd: "node -e \"for (const f of ['bad-claim-as-observation','bad-context-anchor-without-source','bad-execution-receipt-created-by-agent','bad-cmb-missing-cat7','bad-cmb-created-at-affects-hash','bad-review-finding-without-lineage','hash-a','hash-a-created-at-changed','hash-a-body-changed']) JSON.parse(require('fs').readFileSync('super-gsd/tools/mesh-memory/fixtures/'+f+'.json'))\""
 ---
 
-## Goal
+# Plan 106-01 — CMB Schema and Canonical Hashing Contract
 
-P106-01 defines the schema-only CMB contract for DLB-08 Mesh Memory Lite: one JSON Schema plus static good, bad, and hash-demonstration fixtures.
+## Goal
+
+Define the schema-only CMB contract for DLB-08 Mesh Memory Lite: one JSON Schema plus static good, bad, and hash-demonstration fixtures.
 
 ## Bootstrapping note
 
-P106 deliberately stops before validator and hash tooling. `cmb-validate.cjs` and `cmb-hash.cjs` are P107 consumers of the schema and fixtures, not P106 outputs.
+P106 deliberately stops before validator and hash tooling. `cmb-validate.cjs` and `cmb-hash.cjs` are P107 consumers of this contract, so their commands appear in semantic acceptance criteria but their implementations are out of scope here.
 
 ## Dispatch
 
-Dispatch three codex-executor tasks: schema first, seven positive fixtures second, six negative fixtures plus three hash variants third.
+Serial SDD: t1 authors the schema, t2 authors the seven positive fixtures, and t3 authors the six negative fixtures plus three hash variants.
 
 ## Why no VTP enrichment
 
-VTP/private KB is optional under the Phase 48 selective-bridge contract. This phase is locked by local DLB-08 and 106-CONTEXT design rules, so no VTP enrichment is required.
+This phase is locked by local DLB-08, v3.0 requirements, and 106-CONTEXT. VTP/private KB is optional under the Phase 48 selective-bridge contract and adds no required evidence for this schema-only plan.
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md (updated)
VERIFICATION:
  - PLAN.md frontmatter now matches plan-schema-v2 required shape: schema_version, tasks, semantic_acceptance_criteria
  - 6 semantic_acceptance_criteria copied verbatim from CONTEXT
  - 3 tasks declared (schema, good fixtures, bad fixtures)
  - All 17 files_touched paths captured across the 3 tasks
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: P106-01 PLAN authored against plan-schema-v2 with 6 verbatim SACs from CONTEXT.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
