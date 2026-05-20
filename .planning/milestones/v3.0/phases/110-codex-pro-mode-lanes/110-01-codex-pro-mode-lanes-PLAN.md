---
schema_version: 2
plan_id: 110-01
phase: 110
phase_name: Codex Pro Mode Lanes + Stoplight Routing + Native Review
milestone: v3.0
title: Codex Pro Mode profiles, stoplight routing, and native review mesh wire-in
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
depends_on: []
lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
semantic_acceptance_criteria:
  - id: SAC-P110-01
    input: "profile-resolver.cjs --resolve with context {phase_type: 'plan'}"
    expected_outcome: "returns codex.plan profile envelope with sandbox: 'read-only', approval: 'never'"
    verification_cmd: "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-plan; test $? -eq 0"

  - id: SAC-P110-02
    input: "profile-resolver.cjs --resolve with context {phase_type: 'execute', allowed_files: ['src/x.ts'], risk: 'low'}"
    expected_outcome: "returns codex.execute.bounded profile with sandbox: 'workspace-write', requires_worktree: true, native_review_required: true"
    verification_cmd: "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-bounded; test $? -eq 0"

  - id: SAC-P110-03
    input: "stoplight.cjs --classify with context {locked_plan: true, allowed_files_count: 3, risk: 'low', production_writes: false, secrets_required: false}"
    expected_outcome: "verdict: GREEN; logs one row to pro-mode-stoplight.jsonl"
    verification_cmd: "node super-gsd/tools/codex-pro/stoplight.cjs --self-test-green; test $? -eq 0"

  - id: SAC-P110-04
    input: "stoplight.cjs --classify with context {production_writes: true OR no locked_plan OR no acceptance_command}"
    expected_outcome: "verdict: RED; allow_execution: false"
    verification_cmd: "node super-gsd/tools/codex-pro/stoplight.cjs --self-test-red; test $? -eq 0"

  - id: SAC-P110-05
    input: "native-review-runner.cjs --self-test against a fixture diff with one obvious issue"
    expected_outcome: "emits at least 1 review_finding CMB to mesh memory ledger with proper CAT7 + lineage; writes CODEX-NATIVE-REVIEW.md"
    verification_cmd: "node super-gsd/tools/codex-pro/native-review-runner.cjs --self-test; test $? -eq 0"

  - id: SAC-P110-06
    input: "self-test runner over all 3 codex-pro tools"
    expected_outcome: "exit 0 with ≥15 assertions passed"
    verification_cmd: "node super-gsd/tools/codex-pro/run-self-test.cjs; test $? -eq 0"
tasks:
  - id: t1
    agent: codex-executor
    model: codex
    expected_ATC_tier: FULL
    skip_gates: []
    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
    files_touched:
      - super-gsd/registry/codex-profiles.yaml
      - super-gsd/tools/codex-pro/profile-resolver.cjs
      - super-gsd/tools/codex-pro/package.json
      - super-gsd/tools/codex-pro/README.md
    input_contract: |
      Consume P110 context and SGSD-PRO proposal sections 4.1 through 4.5,
      especially the profile list, profile envelope fields, stoplight preconditions,
      and native-review ordering. Treat DLB-08 mesh memory as already complete and
      available, but do not implement stoplight routing or native-review execution
      in this task.
    output_contract: |
      super-gsd/registry/codex-profiles.yaml defines exactly 10 Codex Pro Mode
      profiles: codex.readonly.audit, codex.plan, codex.goal,
      codex.execute.bounded, codex.execute.patch, codex.review.native,
      codex.review.swarm, codex.cockpit.brief, codex.app_lab, and
      codex.cloud_lab. Each profile declares model, reasoning, sandbox, approval,
      requires_worktree, requires_locked_plan, hooks_required,
      native_review_required, allowed_write_roots, and max_changed_files.

      profile-resolver.cjs loads the registry, validates profile shape, exposes an
      importable deterministic resolver, supports operator override as an explicit
      escape hatch, and provides --help plus self-test modes for plan and bounded
      executor profile resolution. package.json and README.md document local usage,
      CLI modes, and the safety envelope without adding orchestrator integration.
    hypothesis: |
      A registry-backed deterministic resolver can replace generic Codex dispatch
      with typed safety envelopes while preserving SGSD as the control plane and
      keeping the profile mapping inspectable, testable, and overrideable.
    falsifier: |
      profile resolution uses LLM judgment, returns profiles outside the 10-profile
      registry, omits required envelope fields, silently grants write permission
      without locked-plan requirements for source-changing lanes, fails to expose
      importable resolver functions, or requires external services for help output
      or self-tests.
    stop_rule: |
      Stop once codex-profiles.yaml contains the 10 validated profile definitions,
      profile-resolver.cjs --help exits 0, the plan and bounded self-test modes
      exit 0, package metadata exists, and README.md explains the registry,
      resolver inputs, outputs, and operator override behavior.
    depends_on: []
    verification_cmd: "node super-gsd/tools/codex-pro/profile-resolver.cjs --help"

  - id: t2
    agent: codex-executor
    model: codex
    expected_ATC_tier: FULL
    skip_gates: []
    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
    files_touched:
      - super-gsd/tools/codex-pro/stoplight.cjs
    input_contract: |
      Consume t1's profile registry and profile-resolver module, P110 context
      binding invariants, P109 escalation-gate behavior, and SGSD-PRO proposal
      section 4.2. This task owns only pre-execution GREEN/AMBER/RED
      classification and stoplight ledger emission. Do not implement native review
      or executor invocation here.
    output_contract: |
      stoplight.cjs exposes an importable deterministic classifier and CLI with
      --help plus self-test modes. Given a dispatch context, it returns a verdict
      of GREEN, AMBER, or RED, an allow_execution boolean, route/profile guidance,
      and reason codes. GREEN requires locked plan, limited allowed files,
      acceptance command, low or medium risk, no production writes, no secrets, and
      complete route evidence. AMBER routes broad but bounded or long-running work
      to goal/app-lab style lanes. RED denies execution for missing locked plan,
      missing acceptance command, high ambiguity, production/SAP/Mongo/Qdrant
      mutation risk, secrets, or destructive command requirements.

      Each classification appends one JSONL row to
      .planning/metrics/pro-mode-stoplight.jsonl with timestamp, verdict,
      allow_execution, selected profile/lane when applicable, and reasons. RED
      output includes escalation-gate routing metadata compatible with P109.
    hypothesis: |
      A preventative stoplight classifier can make write permission conditional on
      bounded context before Codex execution starts, reducing unsafe dispatches and
      providing auditable route evidence for SGSD gates.
    falsifier: |
      stoplight.cjs permits execution without a locked plan or acceptance command,
      allows production writes or secrets through GREEN/AMBER, duplicates profile
      definitions instead of consuming t1's registry, fails to log classifications,
      logs malformed JSONL, or requires external services for help output or local
      self-tests.
    stop_rule: |
      Stop once stoplight.cjs --help exits 0, GREEN and RED self-test modes exit 0,
      classification rows are appended to pro-mode-stoplight.jsonl, RED verdicts
      produce allow_execution=false, and profile/lane choices are derived from the
      t1 registry.
    depends_on: [t1]
    verification_cmd: "node super-gsd/tools/codex-pro/stoplight.cjs --help"

  - id: t3
    agent: codex-executor
    model: codex
    expected_ATC_tier: FULL
    skip_gates: []
    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
    files_touched:
      - super-gsd/tools/codex-pro/native-review-runner.cjs
      - super-gsd/tools/codex-pro/run-self-test.cjs
    input_contract: |
      Consume t1's profile registry and resolver, t2's stoplight classifier, P107
      review-finding-writer CMB shape, P106 CAT7 schema shape, P108 lineage
      expectations, and P110 context invariants. Native review must run before
      SGSD ATC for source-changing work and must produce mesh-memory
      review_finding CMBs rather than loose prose only.
    output_contract: |
      native-review-runner.cjs exposes an importable runner and CLI with --help and
      --self-test. For source-changing work with an execution receipt and diff, it
      runs or simulates native Codex review through a deterministic local test path,
      writes CODEX-NATIVE-REVIEW.md to the phase directory, and emits one
      schema-shaped review_finding CMB per finding into
      .planning/mesh/memory/cmbs.jsonl using the P107 review-finding writer shape.
      Each review_finding includes proper CAT7 envelope fields, evidence, severity,
      and lineage back to the executor's execution_receipt.

      run-self-test.cjs exercises profile resolution, stoplight classification,
      native-review output, mesh-memory review_finding emission, and error paths
      with at least 15 assertions. The integrated runner exits 0 when all three
      Codex Pro Mode tools satisfy the P110 SACs.
    hypothesis: |
      Treating native Codex review as a first-class mesh-memory producer makes
      Codex Pro Mode compatible with DLB-08: SGSD ATC can review executor diffs and
      native findings together from one structured substrate.
    falsifier: |
      native-review-runner.cjs emits prose without review_finding CMBs, writes CMBs
      without CAT7 shape or lineage, runs after SGSD ATC in its documented flow,
      ignores t1/t2 eligibility signals, requires unavailable external Codex access
      for self-test, writes CODEX-NATIVE-REVIEW.md outside the phase directory, or
      run-self-test.cjs reports fewer than 15 assertions.
    stop_rule: |
      Stop once native-review-runner.cjs --help exits 0, native review self-test
      emits at least one review_finding CMB with CAT7 + lineage and writes
      CODEX-NATIVE-REVIEW.md, and run-self-test.cjs exits 0 with at least 15
      assertions covering all three Codex Pro Mode tools.
    depends_on: [t1, t2]
    verification_cmd: "node super-gsd/tools/codex-pro/run-self-test.cjs"
---

# Plan 110-01 — Codex Pro Mode Lanes

## Goal

Ship the first DLB-09 Codex Pro Mode toolset: a deterministic profile registry
and resolver, preventative GREEN/AMBER/RED stoplight routing, and native Codex
review as a first-class gate for source-changing work.

## DLB-08 Wire-In

Native Codex review must not become a separate prose-only review channel. It
emits `review_finding` CMBs into `.planning/mesh/memory/cmbs.jsonl` using the
P107/P108 mesh-memory substrate, with CAT7 shape and lineage back to the
executor's execution receipt. SGSD ATC then reviews the executor diff and native
review findings together.

## Dispatch

t1 builds the Codex profile registry, resolver, package metadata, and README.
t2 depends on t1 and builds the preventative stoplight classifier and route
ledger. t3 depends on t1 and t2, builds native-review-runner.cjs, and extends the
self-test runner to cover all three Codex Pro Mode tools with at least 15
assertions.
