SUCCESS: The process with PID 46148 (child process of PID 34608) has been terminated.
SUCCESS: The process with PID 32728 (child process of PID 34608) has been terminated.
SUCCESS: The process with PID 34540 (child process of PID 34608) has been terminated.
PATCH_BEGIN
diff --git a/.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md b/.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md
--- a/.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md
+++ b/.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md
@@ -1,164 +1,208 @@
 ---
 schema_version: 2
-plan_id: P111-01
-phase_id: 111-plan-locked-codex-hooks
+plan_id: 111-01
+phase: 111
+phase_name: PLAN-LOCKED Contract + Codex Hooks
 milestone: v3.0
-title: PLAN-LOCKED Codex Hooks
-status: draft
-agent: codex-executor
-model: codex
+title: PLAN-LOCKED contract and Codex hook safety rails
+status: PLAN-LOCKED
 expected_ATC_tier: FULL
 skip_gates: []
-lessons_path: .planning/decisions/DLB-08-MESH-MEMORY-LITE.md
-sacs:
-  - "PLAN-LOCKED contract is defined as a JSON Schema that extends plan-schema-v2 and makes task-scoped file locks explicit."
-  - "PLAN-LOCKED validator accepts valid v2 PLAN files with complete lock metadata and rejects missing or malformed lock metadata with actionable diagnostics."
-  - ".codex/hooks.json registers exactly five Codex hooks: block-forbidden-write, block-secret-leak, log-tool-event, validate-stop-contract, and enforce-allowed-files."
-  - "Forbidden writes are blocked before mutation when the active PLAN forbids the target path."
-  - "Secret leaks are blocked before tool output can expose high-risk credential material."
-  - "Stop-contract validation requires Codex runs to finish with the expected REPORT block and evidence fields."
-  - "Codex hook self-test covers allowed-path, forbidden-path, secret-leak, tool-log, and stop-contract outcomes without network or private KB dependencies."
+depends_on: []
+lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+semantic_acceptance_criteria:
+  - id: SAC-P111-01
+    input: "a PLAN.md fixture missing lock_status / locked_at / allowed_files"
+    expected_outcome: "validate-plan-locked.cjs exits non-zero with PLAN-LOCKED-SCHEMA error"
+    verification_cmd: "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --self-test-incomplete; test $? -eq 0"
+
+  - id: SAC-P111-02
+    input: "a fully-formed PLAN-LOCKED.md fixture (extends v2-schema plus lock metadata)"
+    expected_outcome: "validate-plan-locked.cjs exits 0 (VALID)"
+    verification_cmd: "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --self-test-valid; test $? -eq 0"
+
+  - id: SAC-P111-03
+    input: "block-forbidden-write hook invoked with target path outside PLAN-LOCKED allowed_files"
+    expected_outcome: "exits non-zero (block); logs blocked event"
+    verification_cmd: "node super-gsd/tools/codex-hooks/block-forbidden-write.cjs --self-test-blocked; test $? -eq 0"
+
+  - id: SAC-P111-04
+    input: "block-secret-leak hook with prompt containing 'API_KEY=sk_...'"
+    expected_outcome: "exits non-zero (block); logs blocked secret pattern"
+    verification_cmd: "node super-gsd/tools/codex-hooks/block-secret-leak.cjs --self-test-secret; test $? -eq 0"
+
+  - id: SAC-P111-05
+    input: "log-tool-event hook with a sample tool invocation"
+    expected_outcome: "appends one row to .planning/metrics/codex-tool-events.jsonl"
+    verification_cmd: "node super-gsd/tools/codex-hooks/log-tool-event.cjs --self-test; test $? -eq 0"
+
+  - id: SAC-P111-06
+    input: "validate-stop-contract hook on a completed dispatch missing the result report"
+    expected_outcome: "exits non-zero (block); flags missing contract"
+    verification_cmd: "node super-gsd/tools/codex-hooks/validate-stop-contract.cjs --self-test-missing-report; test $? -eq 0"
+
+  - id: SAC-P111-07
+    input: "self-test runner over schema + all 5 hooks"
+    expected_outcome: "exit 0 with ≥15 assertions passed"
+    verification_cmd: "node super-gsd/tools/codex-hooks/run-self-test.cjs; test $? -eq 0"
 tasks:
   - id: t1
-    title: PLAN-LOCKED schema and validator
     agent: codex-executor
     model: codex
     expected_ATC_tier: FULL
     skip_gates: []
-    lessons_path: .planning/decisions/DLB-08-MESH-MEMORY-LITE.md
-    depends_on: []
-    allowed_files:
-      - super-gsd/tools/plan-lock/plan-locked.schema.json
+    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+    files_touched:
+      - super-gsd/schemas/plan-locked.schema.json
       - super-gsd/tools/plan-lock/validate-plan-locked.cjs
       - super-gsd/tools/plan-lock/package.json
       - super-gsd/tools/plan-lock/README.md
-    outputs:
-      - super-gsd/tools/plan-lock/plan-locked.schema.json
-      - super-gsd/tools/plan-lock/validate-plan-locked.cjs
-      - super-gsd/tools/plan-lock/package.json
-      - super-gsd/tools/plan-lock/README.md
-    verification_cmds:
-      - node super-gsd/tools/plan-lock/validate-plan-locked.cjs --help
+    input_contract: |
+      Consume Phase 111 context, plan-schema-v2, and P110 Codex Pro Mode
+      profile registry fields. Treat PLAN-LOCKED as an extension of v2 PLAN.md,
+      not a replacement, and keep SCHEMA-09/SCHEMA-10 semantic acceptance
+      criteria requirements intact.
+    output_contract: |
+      super-gsd/schemas/plan-locked.schema.json extends
+      super-gsd/templates/plan-schema-v2.json and requires lock_status: locked,
+      locked_at, locked_by, allowed_files, forbidden_files, invariants,
+      acceptance_commands, rollback_plan, risk_rating, and
+      operator_checkpoints. validate-plan-locked.cjs exposes an importable
+      validator plus CLI help and self-test modes for incomplete and valid
+      fixtures. package.json and README.md document local use and the lock
+      metadata contract.
+    hypothesis: |
+      A dedicated PLAN-LOCKED schema and validator can make Codex write
+      authority explicit while preserving every existing v2 PLAN requirement.
+    falsifier: |
+      The validator accepts missing lock metadata, fails valid v2 PLAN fields,
+      replaces plan-schema-v2 instead of extending it, lacks actionable
+      PLAN-LOCKED-SCHEMA diagnostics, or requires network/private KB access for
+      help or self-tests.
+    stop_rule: |
+      Stop once the schema, validator, package metadata, and README exist;
+      validate-plan-locked.cjs --help exits 0; the incomplete self-test blocks
+      with PLAN-LOCKED-SCHEMA; and the valid self-test exits 0.
+    depends_on: []
+    verification_cmd: "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --help"
+
   - id: t2
-    title: Codex hook registration and scripts
     agent: codex-executor
     model: codex
     expected_ATC_tier: FULL
     skip_gates: []
-    lessons_path: .planning/decisions/DLB-08-MESH-MEMORY-LITE.md
-    depends_on: []
-    allowed_files:
+    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+    files_touched:
       - .codex/hooks.json
       - super-gsd/tools/codex-hooks/block-forbidden-write.cjs
       - super-gsd/tools/codex-hooks/block-secret-leak.cjs
       - super-gsd/tools/codex-hooks/log-tool-event.cjs
       - super-gsd/tools/codex-hooks/validate-stop-contract.cjs
       - super-gsd/tools/codex-hooks/enforce-allowed-files.cjs
-    outputs:
-      - .codex/hooks.json
-      - super-gsd/tools/codex-hooks/block-forbidden-write.cjs
-      - super-gsd/tools/codex-hooks/block-secret-leak.cjs
-      - super-gsd/tools/codex-hooks/log-tool-event.cjs
-      - super-gsd/tools/codex-hooks/validate-stop-contract.cjs
-      - super-gsd/tools/codex-hooks/enforce-allowed-files.cjs
-    verification_cmds:
-      - >-
-        cat .codex/hooks.json | node -e "JSON.parse(require('fs').readFileSync('.codex/hooks.json'))" && echo OK
+    input_contract: |
+      Consume the PLAN-LOCKED metadata from t1, Phase 111 hook invariants, and
+      P110 profile registry semantics. Hooks must be deterministic, fail closed
+      on ambiguity, and log decisions without duplicating SGSD gates.
+    output_contract: |
+      .codex/hooks.json registers exactly five Codex hooks:
+      block-forbidden-write, block-secret-leak, log-tool-event,
+      validate-stop-contract, and enforce-allowed-files. The hook scripts map to
+      UserPromptSubmit, PreToolUse, PostToolUse, and Stop events; reject
+      forbidden writes, secret-bearing prompts, and missing stop contracts; read
+      active PLAN-LOCKED allowed_files/forbidden_files where applicable; and
+      append auditable decisions to .planning/metrics/codex-tool-events.jsonl.
+    hypothesis: |
+      Deterministic Codex hooks can enforce PLAN-LOCKED file boundaries and
+      prompt hygiene before mutation while leaving ATC/verifier/MUDA gates as
+      the authoritative SGSD review layer.
+    falsifier: |
+      hooks rely on LLM judgment, silently allow ambiguous writes, skip logging,
+      fail to parse the active PLAN-LOCKED allowed_files, miss obvious secret
+      patterns, register fewer or more than five hooks, or require optional VTP
+      or private KB services.
+    stop_rule: |
+      Stop once .codex/hooks.json is valid JSON, registers the five expected
+      scripts, each script exposes help/self-test behavior where applicable, and
+      the forbidden-write, secret-leak, tool-log, allowed-files, and
+      stop-contract policies are covered by local fixtures.
+    depends_on: []
+    verification_cmd: "cat .codex/hooks.json | node -e \"JSON.parse(require('fs').readFileSync('.codex/hooks.json'))\" && echo OK"
+
   - id: t3
-    title: Codex hook self-test package
     agent: codex-executor
     model: codex
     expected_ATC_tier: FULL
     skip_gates: []
-    lessons_path: .planning/decisions/DLB-08-MESH-MEMORY-LITE.md
-    depends_on:
-      - t1
-      - t2
-    allowed_files:
+    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+    files_touched:
       - super-gsd/tools/codex-hooks/run-self-test.cjs
       - super-gsd/tools/codex-hooks/package.json
       - super-gsd/tools/codex-hooks/README.md
-    outputs:
-      - super-gsd/tools/codex-hooks/run-self-test.cjs
-      - super-gsd/tools/codex-hooks/package.json
-      - super-gsd/tools/codex-hooks/README.md
-    verification_cmds:
-      - node super-gsd/tools/codex-hooks/run-self-test.cjs
+    input_contract: |
+      Consume t1's PLAN-LOCKED schema/validator and t2's hook config/scripts.
+      Use only local fixtures and deterministic assertions; do not require
+      network access, Codex cloud features, or private KB/VTP availability.
+    output_contract: |
+      run-self-test.cjs exercises schema validation and all five hooks with at
+      least 15 assertions, including incomplete plan rejection, valid
+      PLAN-LOCKED acceptance, blocked forbidden write, blocked secret prompt,
+      tool-event JSONL append, missing stop-contract rejection, and allowed-file
+      enforcement. package.json and README.md document the self-test command and
+      expected local-only behavior.
+    hypothesis: |
+      A single local self-test runner can prove the PLAN-LOCKED contract and
+      hook policy as one executable safety surface before orchestrator
+      integration work begins.
+    falsifier: |
+      The runner covers fewer than 15 assertions, omits any of the five hooks,
+      depends on unavailable services, writes outside task-owned paths, or
+      reports success when schema or hook assertions fail.
+    stop_rule: |
+      Stop once codex-hooks/run-self-test.cjs exits 0 with at least 15
+      assertions passed, package metadata exists, and README.md explains how to
+      run and interpret the self-test.
+    depends_on: [t1, t2]
+    verification_cmd: "node super-gsd/tools/codex-hooks/run-self-test.cjs"
 ---
 
-# P111-01 PLAN-LOCKED Codex Hooks PLAN
+# Plan 111-01 - PLAN-LOCKED Contract + Codex Hooks
 
 ## Goal
 
-Implement the DLB-09.2 PLAN-LOCKED contract and Codex hook surface for Phase 111. The executor must add a lock-aware PLAN schema and validator, register five Codex hooks, and provide a local self-test that proves the hook policy works without network access or private KB dependencies.
+Ship the DLB-09.2 PLAN-LOCKED execution contract and Codex hook surface for
+Phase 111. The work creates the schema and validator for locked plans, registers
+five deterministic Codex hooks, and adds a local self-test runner that covers
+schema behavior plus all hook policies.
 
 ## Hook Policy
 
-The hook layer is policy enforcement around a concrete PLAN, not a replacement for SGSD gates. Hooks must consume PLAN-LOCKED metadata, respect task-scoped allowed files and forbidden files, block pre-mutation violations, and leave existing ATC, verifier, MUDA, release-readiness, edge-guard, and registry gates untouched.
+PLAN-LOCKED.md is an extension of a v2 PLAN.md, so every locked plan must still
+satisfy plan-schema-v2 and its semantic acceptance criteria. The lock metadata is
+the binding authority for write scope: hooks must read allowed_files,
+forbidden_files, invariants, acceptance_commands, rollback_plan,
+risk_rating, and operator_checkpoints, then fail closed when the requested
+action cannot be proven safe.
 
-Required hooks:
+The hook set is exactly `block-forbidden-write`, `block-secret-leak`,
+`log-tool-event`, `validate-stop-contract`, and `enforce-allowed-files`.
+`block-secret-leak` runs at UserPromptSubmit; write guards run before tool use;
+`log-tool-event` runs after tool use; and `validate-stop-contract` runs at Stop.
+All decisions must be deterministic and auditable in
+`.planning/metrics/codex-tool-events.jsonl`; no hook may use LLM judgment or
+optional VTP/private KB context.
 
-- `block-forbidden-write`
-- `block-secret-leak`
-- `log-tool-event`
-- `validate-stop-contract`
-- `enforce-allowed-files`
-
-Profiles in `super-gsd/registry/codex-profiles.yaml` that require hooks or `locked_plan` must have an installable `.codex/hooks.json` path through this phase. The implementation must degrade cleanly when optional VTP/private KB context is absent.
+Per `super-gsd/registry/codex-profiles.yaml`, `codex.goal`,
+`codex.execute.bounded`, `codex.app_lab`, and `codex.cloud_lab` require both
+hooks and locked plans. `codex.execute.patch` requires a locked plan while
+remaining read-only and hook-optional.
 
 ## Dispatch
 
-Dispatch all tasks to `codex-executor` on model `codex` with `expected_ATC_tier: FULL`, `skip_gates: []`, and lessons loaded from `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md`.
-
-Task order:
-
-1. `t1` has no dependencies and creates the PLAN-LOCKED schema and validator package.
-2. `t2` has no dependencies and creates `.codex/hooks.json` plus the five hook scripts.
-3. `t3` depends on `t1` and `t2`, then adds the self-test package and documentation.
-
-## Success Acceptance Criteria
-
-1. PLAN-LOCKED contract is defined as a JSON Schema that extends plan-schema-v2 and makes task-scoped file locks explicit.
-2. PLAN-LOCKED validator accepts valid v2 PLAN files with complete lock metadata and rejects missing or malformed lock metadata with actionable diagnostics.
-3. .codex/hooks.json registers exactly five Codex hooks: block-forbidden-write, block-secret-leak, log-tool-event, validate-stop-contract, and enforce-allowed-files.
-4. Forbidden writes are blocked before mutation when the active PLAN forbids the target path.
-5. Secret leaks are blocked before tool output can expose high-risk credential material.
-6. Stop-contract validation requires Codex runs to finish with the expected REPORT block and evidence fields.
-7. Codex hook self-test covers allowed-path, forbidden-path, secret-leak, tool-log, and stop-contract outcomes without network or private KB dependencies.
-
-## Tasks
-
-### t1 - PLAN-LOCKED schema and validator
-
-Create `super-gsd/tools/plan-lock/plan-locked.schema.json`, `super-gsd/tools/plan-lock/validate-plan-locked.cjs`, `super-gsd/tools/plan-lock/package.json`, and `super-gsd/tools/plan-lock/README.md`.
-
-Verification:
-
-```powershell
-node super-gsd/tools/plan-lock/validate-plan-locked.cjs --help
-```
-
-### t2 - Codex hook registration and scripts
-
-Create `.codex/hooks.json` and five hook scripts under `super-gsd/tools/codex-hooks/`: `block-forbidden-write`, `block-secret-leak`, `log-tool-event`, `validate-stop-contract`, and `enforce-allowed-files`.
-
-Verification:
-
-```powershell
-cat .codex/hooks.json | node -e "JSON.parse(require('fs').readFileSync('.codex/hooks.json'))" && echo OK
-```
-
-### t3 - Codex hook self-test package
-
-Create `super-gsd/tools/codex-hooks/run-self-test.cjs`, `super-gsd/tools/codex-hooks/package.json`, and `super-gsd/tools/codex-hooks/README.md`.
-
-Depends on:
-
-- `t1`
-- `t2`
-
-Verification:
-
-```powershell
-node super-gsd/tools/codex-hooks/run-self-test.cjs
-```
+Dispatch all tasks to `codex-executor` on model `codex`, with
+`expected_ATC_tier: FULL`, `skip_gates: []`, and lessons from
+`.planning/decisions/DLB-08-MESH-MEMORY-LITE.md`.
+
+`t1` has no dependencies and creates the PLAN-LOCKED schema and validator
+package. `t2` has no dependencies and creates `.codex/hooks.json` plus the five
+hook scripts. `t3` depends on `t1` and `t2`, then creates the self-test package
+and documentation.
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md (updated)
VERIFICATION:
  Static read-pack check only: v2 required fields are present, all 7 SACs are copied verbatim from 111-CONTEXT.md, and the task dependency chain is t1=[], t2=[], t3=[t1,t2]. No commands run per executor rule.
DEVIATIONS:
  <none>
BLOCKERS:
  <none>
ONE_LINER:
  P111-01 PLAN authored - PLAN-LOCKED schema + validator + .codex/hooks.json + 5 hook scripts + self-test.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
