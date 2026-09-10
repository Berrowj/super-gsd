---
schema_version: 2
status: ACTIVE
phase: 170
plan: "170-14"
authorized_at: "2026-09-10"
authorization: "Operator approved general worktree session ownership and instructed: Lets start working through this; it is holding me up."
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: T170-14-1
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/tools/telemetry-atlas/fleet.cjs, super-gsd/tools/telemetry-atlas/fleet.test.cjs]
    input_contract: "Existing exact Atlas registrations, private global root and Linux process identity."
    output_contract: "One persistent host coordinator identity; exclusive per-project run ownership; verified process binding and explicit release/status."
    hypothesis: "Atomic local claims prevent competing SGSD launches without another daemon or model."
    falsifier: "Two runs own one real project, stale PID is adopted, wrong project binds, or release stops another process."
    stop_rule: "Failing-first fixtures, bounded implementation, green concurrency and identity tests. Never auto-steal a claim or stop a process."
  - id: T170-14-2
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/tools/telemetry-atlas/global.cjs, super-gsd/tools/telemetry-atlas/global.test.cjs, super-gsd/hooks/sgsd-session-start.js, super-gsd/scripts/lib/atlas-session-owner.cjs, super-gsd/scripts/lib/atlas-session-owner.test.cjs, super-gsd/config/hook-manifest.json]
    input_contract: "Approved fleet API and existing prepare/finish plus session-start hook; remote 170-13 briefing changes remain separately owned."
    output_contract: "Managed orchestrator preparation reserves the exact generated run; real provider binding is checked at boot; failed capture cannot authorize unattended work."
    hypothesis: "Shared prepare integration protects arbitrary normal SGSD entrypoints, not only named tmux sessions."
    falsifier: "Launcher label replaces run UUID, worker claims orchestrator ownership, or manually booted provider is reported retrofitted."
    stop_rule: "Failing-first fixtures; preserve 170-13 read-only briefing; expose unsupported Windows binding without claiming Linux verification."
  - id: T170-14-3
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/scripts/sgsd-remote-tmux.sh, super-gsd/scripts/sg, super-gsd/scripts/sgsd-boot.sh, super-gsd/scripts/lib/atlas-shell.sh, super-gsd/scripts/lib/atlas-powershell.ps1, super-gsd/install.sh, super-gsd/scripts/sgsd-global-snapshot.sh, super-gsd/tests/propagation/sg-shortcut.test.cjs, super-gsd/tests/propagation/owned-sessions.test.cjs, super-gsd/tests/propagation/runtime-provenance.test.cjs, super-gsd/tools/telemetry-atlas/runtime.test.cjs]
    input_contract: "Existing real worktree, normal source/pin gate, receiver preparation and explicitly selected native Codex binary."
    output_contract: "CWD-derived worktree launch, project-specific name, verified reuse or refusal, fail-closed managed preparation and direct Claude topology."
    hypothesis: "Small launcher checks eliminate silent untracked starts and name-only attachment."
    falsifier: "Wrong-project name collision attaches, failed tmux launch succeeds, or older implicit Codex is labelled accounting-capable without evidence."
    stop_rule: "Real isolated Linux shell fixtures; no new paid model probes, no pin edits, no session reset during rollout."
  - id: T170-14-4
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/skills/sgsd-sessions/SKILL.md, super-gsd/tools/telemetry-atlas/README.md, super-gsd/tools/telemetry-atlas/run-self-test.cjs, super-gsd/tests/propagation/owned-sessions.test.cjs]
    input_contract: "Arbitrary operator-selected existing worktrees, collected private handovers, completed integration and installer skill discovery."
    output_contract: "Globally installable session skill, bounded truthful readiness report, independent review and scoped Linux rollout evidence."
    hypothesis: "One repeatable operator path can show source, run, worker communication, native and gate evidence without inventing coverage."
    falsifier: "Missing evidence becomes green, inherited STATE resumes wrong work, or handover bodies enter telemetry."
    stop_rule: "Baseline/forward skill scenario, focused and propagation tests, required FULL ATC, then intended-only publication and normal update."
semantic_acceptance_criteria:
  - input: "Concurrent claims, wrong project/run, PID reuse, partial launch, unsupported/manual boot and fresh but undelivered registration fixtures."
    expected_outcome: "One owner at most; no automatic takeover, process stop, false capture or wrong-worktree resume."
    verification_cmd: "node --test super-gsd/tools/telemetry-atlas/fleet.test.cjs super-gsd/scripts/lib/atlas-session-owner.test.cjs super-gsd/tests/propagation/owned-sessions.test.cjs"
  - input: "One normal freshly installed DEVCP launch followed by serialized business-lane handover."
    expected_outcome: "Exact project/run/provider ownership and real native delivery; operational gaps and unexercised gates remain explicit; old sessions preserved until verified replacement."
    verification_cmd: "node super-gsd/tools/telemetry-atlas/fleet.cjs status"
---

# Owned SGSD sessions: minimal launcher integration

Approved design: `.planning/analyses/2026-09-10-sgsd-sessions-DESIGN.md`.
Use existing isolated Windows branch; do not edit the live DEVCP source while
the separate 170-13 owner reviews and publishes its briefing. No implementer
commits. Preserve unrelated dirty planning documents and all private handovers.

## API and ownership

Integration completion scope: monitor-schedule.cjs and its existing tests gain
an additive locked `include --project-dir` operation (configure remains explicit
replacement under the same lock). Shared launchers call include without audit,
collector startup or model turns so arbitrary new repositories enter visible
monitor scope, preserving all existing entries. sgsd-headless.sh also checks the
shared attachment return status; Linux PowerShell attachment fails closed for
managed orchestrators. These are T2/T3 seams, not a monitoring redesign.
PowerShell caller missing-helper guards include sgsd-headless.ps1 and
Install-SgsdShortcut.ps1; restore must not finish an inherited run when Start
threw before returning its saved environment. Windows capability is not claimed.

`fleet.cjs` exports synchronous `reserve({root,run})`,
`bind({root,runId,projectDir,pid,sessionId,tmux})`,
`release({root,runId,allowPending:false})`, and `status({root,projectDir})`.
Read and validate existing registrations; no alternate accounting identity.
Private fleet coordinator ID is stable for the real Atlas root, not an extra LLM.
Claims serialize under private safe paths; stale/unknown claims are reported,
never automatically stolen. Linux binding checks actual process start identity
and its exact SGSD_RUN_ID/project environment. Persist selected identity only,
not argv, environment, prompts, secrets or handover bodies. Expose a bounded
read-only status and CLI bind/release; release requires the exact run and a
proved-dead bound process, or an explicit never-bound launch abort. It never
signals processes. Persist terminal receipts before removing an owned claim.

`global.prepare` integrates claims for managed Linux orchestrators only; worker,
recovery and narrator roles retain their current bridge/registration contracts.
The hook binds the actual ancestor provider, not the short-lived hook PID. A
manual process without prepared run stays unregistered; hook cannot retrofit
startup telemetry environment. Host ownership metadata does not imply complete
capture. Delivery remains the existing monitor/170-13 briefing's evidence.

## Execution and verification

Runtime-selection correction within T3: add a private, optional OS-user
`~/.config/sgsd/codex-command` single absolute executable path. Explicit existing
SGSD_CODEX_APP_SERVER_COMMAND / SGSD_CODEX_COMMAND still win; otherwise this
operator-approved pin precedes PATH. Missing pin retains current selection;
invalid configured pin refuses, never silently falls back. No model/auth changes
or version-based guesses. Own additional files: scripts/lib/codex-worker-shell.sh
and tests/propagation/codex-runtime-pin.test.cjs under super-gsd. DEVCP rollout
pins its already verified 0.153.4 executable; record its actual --version without
a model turn. This fixes the demonstrated NVM-old-binary selection independently
of model routing or telemetry parsing.

1. RED real-file/process fixtures before source changes, including concurrent
   claim attempts and wrong-project registration. Record baseline skill behavior
   honestly: agent chose safe actions, but current launchers lack enforcement.
2. Implement minimal claims and launcher seams; preserve direct provider launch,
   normal provenance gates, actual run UUIDs and no-model boot checks.
3. Skill forward test plus independent spec then quality review. Existing FULL
   ATC remains required before publication. No discretionary cleanup loop once
   binding criteria and gate contract pass; retain accepted warnings explicitly.
4. Normal publication/update, then one supported launch with exact selected
   Codex executable/version (0.153.4 is observed working on DEVCP, not a universal
   hard-coded minimum). Reuse this verification for rollout where possible.
5. Serially replace selected quiesced business owners, preserving task approval
   holds. Never classify historical gaps, pending delivery or gate-not-exercised
   as collecting normally. Windows remains unverified; no telemetry redesign.

## Current operational evidence

Operator explicitly added DEVCP `sg` shortcut update during implementation.
Installed ~/.local/bin/sg is a custom file, SHA256
c4208e385404c8fb381fad7733bef2ca02b3fb7a38c25e4497f5bd00a55baf27.
It currently launches bare Claude inside tmux without Atlas or model selection.
Make `sg` a tracked installed entrypoint forwarding to the common launcher in
`--current-terminal` mode: Claude stays in the caller's terminal, no nested tmux.
Preserve the old installed shortcut in the normal snapshot before replacement.
Add the new owned path to snapshot/update rollback coverage, not an ad-hoc fix
that the next update loses. Fresh literal `sg` invocation is required rollout
evidence, in addition to the tmux session path.

Thirteen owner handovers are privately copied and independently SHA256-verified.
Remote 170-13 publication still pending at plan creation. Source worker token gap
is evidenced CLI 0.144.3 token_count-only rollouts versus successful 0.153.4 exact
token_usage_record rollouts; do not rewrite accounting or synthesize request IDs.
