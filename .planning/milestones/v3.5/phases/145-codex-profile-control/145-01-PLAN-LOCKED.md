---
schema_version: 2
phase: 145
plan: "145-01"
title: "Codex Profile Registry and sgsd-codex-control"
model: codex
expected_ATC_tier: GATE
prior_errors_lookup: true
depends_on: []
skip_gates: []
lessons_path: null
vtp_status: "empty_hit: corpus_gap_for_cli_registry_mechanics"
lock_status: locked
locked_at: "2026-08-05T19:31:16+01:00"
locked_by: "codex-phase-planner"
risk_rating: high
allowed_files:
  - ".planning/milestones/v3.5/phases/145-codex-profile-control/145-01-PLAN-LOCKED.md"
  - "super-gsd/registry/codex-profiles.yaml"
  - "super-gsd/tools/codex-pro/profile-resolver.cjs"
  - "super-gsd/tools/codex-pro/run-self-test.cjs"
  - "super-gsd/tools/codex-pro/README.md"
  - "super-gsd/scripts/lib/codex-profile-shell.sh"
  - "super-gsd/scripts/codex-executor.sh"
  - "super-gsd/scripts/codex-exec.sh"
  - "super-gsd/scripts/codex-exec.README.md"
  - "super-gsd/scripts/sgsd-codex-control.sh"
  - "super-gsd/docs/CODEX-EXECUTOR.md"
  - "super-gsd/skills/sgsd-codex-control/SKILL.md"
  - ".planning/metrics/codex-profile-resolution-log.jsonl"
  - ".planning/metrics/codex-log.jsonl"
  - ".planning/metrics/codex-live.json"
  - ".planning/metrics/narrative.md"
forbidden_files:
  - ".planning/config.json"
  - "super-gsd/scripts/codex-patch-executor.sh"
  - "super-gsd/tools/double-agent-executor/run.cjs"
  - "super-gsd/tools/provider-health/check.cjs"
  - "super-gsd/tools/codex-rerun/rerun-missing-reviews.cjs"
  - "super-gsd/skills/rd-board/SKILL.md"
  - "super-gsd/scripts/lib/sgsd-codex-status.ps1"
  - "super-gsd/tools/feature-propagation/audit.cjs"
  - "devcp/**"
invariants:
  - "No new runtime dependencies; resolver uses the existing vendored js-yaml loading pattern."
  - "Untouched registry keeps executor and review codex exec dry-run strings byte-identical to the pre-P145 literals."
  - "Executor keeps the hidden --full-auto fragment byte-identical; do not normalize it to expanded sandbox flags."
  - "Registry load, parse, or validation failure never bricks dispatch; wrappers fail open to built-in defaults and append a loud fallback row."
  - "Bash wrappers consume resolver KEY=VALUE output with while IFS='=' read and whitelisted case arms only; no eval, no source of generated shell."
  - "codex-exec.sh explicit --timeout precedence is preserved; profiles do not introduce timeout fields."
  - "REPORT_OUT and codex-log.jsonl are written for every codex-exec.sh post-invocation exit path after --report-out is known."
  - "danger-full-access and trust-field changes require [ -t 0 ] && [ -t 1 ] plus exact typed confirmation; non-TTY attempts refuse loudly."
  - "No behavior change to devcp's gpt-5.6-sol pin or other deferred hardcoded callers."
acceptance_commands:
  - "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --plan-file .planning/milestones/v3.5/phases/145-codex-profile-control/145-01-PLAN-LOCKED.md"
  - "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-registry"
  - "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-parity"
  - "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-fail-open"
  - "bash super-gsd/scripts/codex-executor.sh --self-test"
  - "bash super-gsd/scripts/codex-exec.sh --self-test --skip-network"
  - "bash super-gsd/scripts/sgsd-codex-control.sh --self-test"
  - "node super-gsd/tools/codex-pro/run-self-test.cjs"
operator_checkpoints:
  - "After T145-03, operator reviews the parity self-test output because --full-auto is hidden but binding."
  - "Before any real danger-full-access or trust-field edit, operator must be present in an interactive terminal."
  - "Before phase close, operator confirms deferred hardcoded callers remain untouched."
semantic_acceptance_criteria:
  - input: >
      Default super-gsd/registry/codex-profiles.yaml with executor, review, and triage CLI profiles resolved for both direct and cmd launchers.
    expected_outcome: >
      Resolver and wrapper dry-run self-tests produce the exact pre-P145 executor and review command strings, including executor --full-auto, and produce the P145 triage command without --ephemeral.
    verification_cmd: "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-parity"
  - input: >
      A missing and a syntactically corrupt registry supplied through the resolver self-test fixture path.
    expected_outcome: >
      Resolution exits 0, emits built-in executor/review/triage defaults, and appends codex-profile-resolution-log.jsonl rows with fallback status and reason codes.
    verification_cmd: "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-fail-open"
  - input: >
      codex-exec.sh invoked against a fake codex binary that exits 0 but emits stdout missing FINDINGS, CRITICAL, WARNINGS, PASS_RATE, or ONE_LINER.
    expected_outcome: >
      Wrapper exits 6 loudly, writes REPORT_OUT with diagnostic/raw stdout content, appends a codex-log.jsonl row with exit 6 and report_bytes greater than zero, and does not die under set -e after codex-review END.
    verification_cmd: "bash super-gsd/scripts/codex-exec.sh --self-test --skip-network"
  - input: >
      sgsd-codex-control self-test uses an isolated temporary registry, sets triage.ephemeral from false to true, then resolves codex-exec.sh --profile triage dry-run.
    expected_outcome: >
      The next triage dispatch uses the changed registry value and includes --ephemeral; resetting the value removes --ephemeral.
    verification_cmd: "bash super-gsd/scripts/sgsd-codex-control.sh --self-test"
  - input: >
      A non-interactive attempt to set sandbox=danger-full-access or a trust field through sgsd-codex-control.
    expected_outcome: >
      The command refuses before mutation, prints the required interactive confirmation rule, exits non-zero, and leaves the registry fingerprint unchanged.
    verification_cmd: "bash super-gsd/scripts/sgsd-codex-control.sh --self-test"
  - input: >
      codex-exec.sh dry-run with an explicit --timeout and any profile resolution path.
    expected_outcome: >
      The resolved dry-run timeout remains the explicit timeout value; registry resolution does not override timeout behavior.
    verification_cmd: "bash super-gsd/scripts/codex-exec.sh --self-test --skip-network"
tasks:
  - id: "T145-01"
    type: "registry"
    agent: "gsd-executor"
    model: "codex"
    depends_on: []
    files_touched:
      - "super-gsd/registry/codex-profiles.yaml"
    acceptance_commands:
      - "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-registry"
    input_contract: >
      Use CONTEXT.md approved profile table, 145-RESEARCH.md Q1/Q2/Q4 exact current flags, and existing codex-profiles.yaml shape.
    output_contract: >
      Add a top-level cli_profiles section for executor, review, and triage while preserving the existing top-level profiles map and its exact 10 Codex Pro profiles.
    hypothesis: >
      Keeping Codex Pro profiles under profiles and adding CLI dispatch profiles under a separate key gives P145 a single registry without breaking profile-resolver.cjs existing 10-profile contract.
    falsifier: >
      super-gsd/tools/codex-pro/run-self-test.cjs no longer sees exactly 10 entries under profiles, or the new CLI defaults do not encode executor workspace-write non-ephemeral full-auto, review read-only ephemeral, and triage read-only non-ephemeral.
    stop_rule: >
      Registry self-test parses the canonical file, validates all three CLI profiles, and confirms executor default_flag_fragment contains byte-identical --full-auto.
    expected_ATC_tier: GATE

  - id: "T145-02"
    type: "resolver"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T145-01"
    files_touched:
      - "super-gsd/tools/codex-pro/profile-resolver.cjs"
      - "super-gsd/scripts/lib/codex-profile-shell.sh"
      - ".planning/metrics/codex-profile-resolution-log.jsonl"
    acceptance_commands:
      - "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-registry"
      - "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-fail-open"
    input_contract: >
      Reuse profile-resolver.cjs requireDependency/js-yaml pattern; use the codex-exec.sh KEY=VALUE read precedent from lines 204-208; do not add a Bash YAML parser.
    output_contract: >
      Extend or wrap the resolver with CLI modes that print sanitized KEY=VALUE lines for wrappers, export helper functions for tests, and fail open to built-in defaults with loud JSONL evidence rows.
    hypothesis: >
      A Node resolver can validate YAML and emit scalar shell data while a Bash helper safely consumes only whitelisted keys, avoiding eval and keeping dispatch alive when the registry is absent or bad.
    falsifier: >
      Any resolver failure exits non-zero for wrapper dispatch, any wrapper consumes generated shell through eval/source, or missing/corrupt registry fails to append codex-profile-resolution-log.jsonl.
    stop_rule: >
      Resolver self-tests cover valid registry, unknown profile fallback, missing registry fallback, corrupt YAML fallback, invalid field fallback, and shell output sanitization.
    expected_ATC_tier: GATE

  - id: "T145-03"
    type: "wrapper-refactor"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T145-02"
    files_touched:
      - "super-gsd/scripts/codex-executor.sh"
      - "super-gsd/scripts/codex-exec.sh"
      - "super-gsd/scripts/lib/codex-profile-shell.sh"
      - ".planning/metrics/codex-profile-resolution-log.jsonl"
    acceptance_commands:
      - "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-parity"
      - "bash super-gsd/scripts/codex-executor.sh --self-test"
      - "bash super-gsd/scripts/codex-exec.sh --self-test --skip-network"
    input_contract: >
      Refactor only the current hardcoded model/reasoning/sandbox/ephemeral/approval flag fragments in codex-executor.sh and codex-exec.sh. Preserve launcher detection and explicit timeout precedence.
    output_contract: >
      codex-executor.sh defaults to profile executor; codex-exec.sh defaults to profile review and accepts --profile triage. CLI --profile beats SGSD_CODEX_PROFILE, which beats wrapper default. Existing alias codex.review.native maps to review.
    hypothesis: >
      If wrappers build the same argv from validated profile scalars, default dry-runs remain byte-identical while per-dispatch profile overrides become runtime decisions.
    falsifier: >
      Untouched registry changes executor/review dry-run strings, triage still emits --ephemeral by default, explicit --timeout is overridden by profile resolution, or cmd/direct launch paths read different profile sources.
    stop_rule: >
      Wrapper self-tests force direct and cmd launchers without network, compare executor/review strings to pre-P145 literals, and verify triage read-only non-ephemeral output.
    expected_ATC_tier: GATE

  - id: "T145-04"
    type: "wrapper-defect-fix"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T145-03"
    files_touched:
      - "super-gsd/scripts/codex-exec.sh"
      - ".planning/metrics/codex-log.jsonl"
      - ".planning/metrics/codex-live.json"
      - ".planning/metrics/narrative.md"
    acceptance_commands:
      - "bash super-gsd/scripts/codex-exec.sh --self-test --skip-network"
    input_contract: >
      Fix observed 2026-08-05 route-decisions row codex_report_write_lost: codex-exec.sh reached codex-review END exit=0 but died during post-run parse before REPORT_OUT and codex-log.jsonl writes.
    output_contract: >
      Guard code-reviewer-v1 and rd-memo-v1 parse pipelines under set +e or equivalent no-match collection, write report artifacts on all post-invocation exits, append exactly one codex-log.jsonl row, and exit 6 loudly on contract violations.
    hypothesis: >
      Centralizing post-invocation finalization and explicitly collecting parser exit codes prevents set -e from masking contract violations while preserving current timeout/auth/generic failure remaps.
    falsifier: >
      A fake codex output with no contract lines can terminate after codex-review END without report/log writes, exits 0/1 instead of 6, or appends duplicate codex-log rows.
    stop_rule: >
      Offline self-test fixtures cover success, contract violation, generic non-zero, auth denial, and timeout paths with report existence, nonzero report_bytes where REPORT_OUT is known, and one JSONL row per invocation.
    expected_ATC_tier: GATE

  - id: "T145-05"
    type: "operator-control"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T145-02"
      - "T145-03"
    files_touched:
      - "super-gsd/scripts/sgsd-codex-control.sh"
      - "super-gsd/skills/sgsd-codex-control/SKILL.md"
      - "super-gsd/tools/codex-pro/profile-resolver.cjs"
      - ".planning/metrics/codex-profile-resolution-log.jsonl"
    acceptance_commands:
      - "bash super-gsd/scripts/sgsd-codex-control.sh --self-test"
    input_contract: >
      Follow skill layout under super-gsd/skills/<name>/SKILL.md and TTY precedent from sgsd-distill-milestone.sh. VTP enrichment is empty_hit and adds no extra requirements.
    output_contract: >
      Add /sgsd-codex-control with show, set <profile> <field> <value>, and per-dispatch --profile guidance. Add a thin script CLI that performs guarded registry edits atomically and logs show/set/refuse outcomes.
    hypothesis: >
      Putting mutation behind a small operator command gives runtime control without asking operators to hand-edit YAML, and TTY plus typed confirmation prevents unattended danger/trust escalation.
    falsifier: >
      Non-TTY danger-full-access or trust-field set mutates the registry, unguarded fields cannot round-trip into the next dry-run, or the skill omits the actual commands operators must run.
    stop_rule: >
      CLI self-test uses a temporary registry to show profiles, set triage.ephemeral and observe next-dispatch change, refuse non-TTY danger/trust mutation, and verify canonical registry is untouched by self-test.
    expected_ATC_tier: GATE

  - id: "T145-06"
    type: "self-test-and-docs"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T145-01"
      - "T145-02"
      - "T145-03"
      - "T145-04"
      - "T145-05"
    files_touched:
      - "super-gsd/tools/codex-pro/run-self-test.cjs"
      - "super-gsd/tools/codex-pro/README.md"
      - "super-gsd/scripts/codex-exec.README.md"
      - "super-gsd/docs/CODEX-EXECUTOR.md"
    acceptance_commands:
      - "node super-gsd/tools/codex-pro/run-self-test.cjs"
      - "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --plan-file .planning/milestones/v3.5/phases/145-codex-profile-control/145-01-PLAN-LOCKED.md"
    input_contract: >
      Register P145 coverage in existing house self-test surfaces without broadening runtime dependencies or touching deferred hardcoded callers.
    output_contract: >
      Add P145 resolver/control assertions to the Codex Pro self-test runner and update docs to describe cli_profiles, --profile, fail-open logging, and the danger confirmation rule.
    hypothesis: >
      Wiring P145 into existing self-test entry points makes absence of profile evidence loud during boot/milestone checks while keeping docs aligned with the new runtime mechanism.
    falsifier: >
      P145 can pass local wrapper tests but codex-pro run-self-test has no profile/control assertions, or docs still claim Codex wrapper model/flags are only hardcoded literals.
    stop_rule: >
      Full acceptance command list passes and docs identify the registry as the source of CLI profile defaults while preserving explicit note that legacy/deferred callers are out of scope.
    expected_ATC_tier: FULL
---

# P145 Codex Profile Registry + /sgsd-codex-control PLAN-LOCKED

> For agentic workers: implement task-by-task. Each changed line must trace to one task above. Do not touch forbidden files.

## Goal

Move Codex CLI dispatch posture into a runtime registry and operator control surface while preserving today's default wrapper behavior and making missing evidence loud.

## Architecture

Keep the existing `profiles:` map in `super-gsd/registry/codex-profiles.yaml` intact for Codex Pro Mode. Add a separate `cli_profiles:` map with `executor`, `review`, and `triage`. The existing `profile-resolver.cjs` becomes the single parser/validator for both old Codex Pro profiles and the new wrapper-facing CLI profiles.

Wrappers do not parse YAML and do not eval generated shell. They call the resolver, read sanitized `KEY=VALUE` lines through a shared Bash helper, and fall back to built-in defaults if anything about registry resolution fails. Fallback is allowed only with loud evidence in `.planning/metrics/codex-profile-resolution-log.jsonl`.

## Required Evidence Read

- `.planning/milestones/v3.5/phases/145-codex-profile-control/CONTEXT.md`
- `.planning/milestones/v3.5/phases/145-codex-profile-control/145-RESEARCH.md`
- `.planning/milestones/v3.5/phases/145-codex-profile-control/145-VTP-ENRICHMENT.md`
- `.planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md`, P145 section
- `super-gsd/templates/plan-schema-v2.json`
- `super-gsd/scripts/codex-executor.sh`
- `super-gsd/scripts/codex-exec.sh`
- `super-gsd/tools/codex-pro/profile-resolver.cjs`

VTP status is `empty_hit`; do not add invented VTP findings.

## Exact Default Fragments

Do not normalize these default fragments:

- executor: `exec --full-auto --model "$1" -c "model_reasoning_effort=\"$2\"" --skip-git-repo-check --cd "$3" -`
- review: `exec --model "$4" -c "model_reasoning_effort=\"$5\"" --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -`
- triage: `exec --model "$4" -c "model_reasoning_effort=\"$5\"" --sandbox read-only --skip-git-repo-check --cd "$1" -`

Executor's `--full-auto` is hidden in Codex CLI help but accepted by the installed CLI per research. Keep it byte-identical.

## Implementation Notes

T145-01 adds `cli_profiles:` only. The existing Codex Pro `profiles:` map must still contain exactly 10 entries so the current Codex Pro self-test remains valid.

T145-02 extends `profile-resolver.cjs` with CLI profile modes such as `--resolve-cli <profile>`, `--show-cli`, and self-tests. The resolver validates scalar fields and generates wrapper fragments from safe profile fields; wrappers must never execute registry-provided text through eval.

T145-03 adds `--profile` support. `codex-executor.sh` defaults to `executor`. `codex-exec.sh` defaults to `review`, supports `triage`, and accepts `codex.review.native` as an alias for `review` because `native-review-runner.cjs` already sends that profile string. CLI `--model` and `--reasoning` overrides in `codex-exec.sh` remain higher precedence than profile defaults so per-seat and remote pins are not disturbed.

T145-04 fixes the observed `codex_report_write_lost` class. After a Codex invocation starts and `REPORT_OUT` is known, every timeout, auth, generic failure, contract violation, and success path writes `REPORT_OUT` and appends one `codex-log.jsonl` row. Usage errors before a report path exists may still fail with usage only.

T145-05 creates the operator command and skill. Guarded fields include `sandbox=danger-full-access` and fields named or nested as `trust`, `trust_required`, `hook_trust`, `hooks_required`, `approval`, or equivalent trust/approval aliases. The confirmation phrase should be dynamic and exact: `CONFIRM SGSD CODEX PROFILE <profile> <field> <value>`.

T145-06 registers self-test coverage in existing house surfaces and updates docs only for changed behavior.

## Deferred

Do not modify these hardcoded callers in P145; list them for a later pass:

- `super-gsd/scripts/codex-patch-executor.sh`
- `super-gsd/tools/double-agent-executor/run.cjs`
- `super-gsd/tools/provider-health/check.cjs`
- `super-gsd/tools/codex-rerun/rerun-missing-reviews.cjs`
- `super-gsd/skills/rd-board/SKILL.md`
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` and `super-gsd/tools/feature-propagation/audit.cjs` display/test constants

Also out of scope: any behavior change to devcp's `gpt-5.6-sol` pin.
