---
phase: 170
plan: "170-03"
status: IMPLEMENTED_LOCAL
implementation_evidence: 170-03-EXECUTOR-REPORT.md
deployed: false
formal_phase_close: NOT_CLAIMED
authorized_by: operator
authorized_at: 2026-09-08
---

# Codex Worker two-way connection implementation plan

> Agentic workers: use subagent-driven-development with test-first implementation
> and independent specification then code-quality review. Preserve the existing
> dirty Atlas/board work. Do not commit, push or deploy as part of this plan.

Goal: Fable and SGSD orchestration units can receive worker questions and send
answers/steering into the exact active Codex task, with unsandboxed SGSD workers
as explicitly requested by the operator.

Architecture: Node stdio App Server adapter plus private project worker mailbox,
integrated beneath the existing Bash wrapper report/gate contracts. Existing
profiles become full-access; model choices and SGSD gates do not change.

Tech: Node 22 built-ins, node:test, existing YAML profile resolver, Bash,
Codex App Server v2 with experimental dynamic tools (local CLI 0.153.4).
Design: `.planning/analyses/2026-09-08-codex-worker-bridge-design.md`.

## Task 1 — consistent SGSD full-access profiles

Files: `super-gsd/registry/codex-profiles.yaml`,
`super-gsd/tools/codex-pro/{profile-resolver.cjs,run-self-test.cjs,README.md}`,
`super-gsd/scripts/lib/codex-profile-shell.sh`,
`super-gsd/tests/codex-worker/permissions.test.cjs`.

- [x] Add failing tests covering all profiles, built-in/fallback resolution and
  emitted flags. Assert `sandbox === 'danger-full-access'`, approval `never`,
  retained CLI sessions and no `--full-auto` downgrade.
- [x] Change all shipped profiles and both resolver fallback implementations.
  Preserve role limits, locked plans, hook requirements, model/effort, and
  existing dangerous-control mutation confirmation. Legacy profile IDs remain.
- [x] Update existing self-test expectations and runtime docs to distinguish
  advisory no-edit instructions from removed OS enforcement.
- [x] Run `node --test super-gsd/tests/codex-worker/permissions.test.cjs` and
  `node super-gsd/tools/codex-pro/run-self-test.cjs`; independent reviews.

## Task 2 — task-bound host communication

Files: new `super-gsd/tools/codex-worker/{mailbox.cjs,rpc.cjs,run.cjs,control.cjs,
worker.test.cjs,fixtures/app-server.cjs,README.md}`.

- [x] Write failing real-process fixtures first. Core case starts two workers,
  waits for `waiting_input`, replies through `control.cjs`, and requires each
  original worker to receive only its own answer before returning its report.
- [x] Implement newline-JSON RPC request IDs, bounded frames/pending requests,
  initialize/initialized handshake, thread/start or recorded thread/resume,
  turn/start, turn/steer with expectedTurnId, turn/interrupt and final report
  from completed agentMessage items. Non-completed turns never count as success.
- [x] Thread start uses `{sandbox:'danger-full-access',approvalPolicy:'never',
  ephemeral:false,allowProviderModelFallback:false,dynamicTools:[...]}`;
  turn start uses `{sandboxPolicy:{type:'dangerFullAccess'},approvalPolicy:'never'}`.
  Explicit model/effort and telemetry-only config propagate unchanged.
- [x] Implement private `.planning/worker-sessions/<uuid>/` state and atomic
  exclusive control messages. Bind records to resolved project, worker, thread,
  turn and request. Validate containment, limits, stale owner/turn and duplicates.
  Requests use `sgsd_ask_orchestrator({question,context})`; valid host response:
  `{success:true,contentItems:[{type:'inputText',text:answer}]}`.
- [x] CLI `control.cjs status --project DIR`, `reply --project DIR --worker ID
  --request ID --text TEXT`, `steer ... --text TEXT`, `stop ...` and explicit
  recorded worker resume. Worker control is local; no HTTP port or auth changes.
- [x] Preserve bounded deadline, process cleanup, shutdown/disconnect evidence,
  no raw event persistence. Never auto-answer permission requests. Test wrong
  project/worker, duplicates, stale turn, malformed frames, timeout, disconnect,
  failed turn, explicit resume and cancellation.
- [x] Run explicit worker tests and no-model local CLI/schema protocol checks.

## Task 3 — existing launch integration, reports and gates

Files: new `super-gsd/scripts/lib/codex-worker-shell.sh`;
`super-gsd/scripts/{codex-exec.sh,codex-executor.sh,codex-patch-executor.sh,
codex-exec.README.md}`; `super-gsd/scripts/lib/{board-dispatch.cjs,
board-dispatch.test.cjs}`; `super-gsd/registry/board-members.yaml`;
`super-gsd/agents/sgsd-{ceo,board-architect,board-moonshot,board-pragmatist}.md`;
`super-gsd/install.sh`; `package.json`;
`super-gsd/tests/codex-worker/{launch.test.cjs,install.test.cjs}`.

Call-site scan extension (same operator-authorized SGSD-only scope):
`super-gsd/tools/codex-rerun/rerun-missing-reviews.cjs`,
`super-gsd/tools/double-agent-executor/run.cjs`,
`super-gsd/tools/provider-health/check.cjs`, and
`super-gsd/docs/CODEX-EXECUTOR.md`. Retire sandbox flags in these shipped
dispatches too. Provider-health's explicit canary is a diagnostic, not a
fallback worker; keep it bounded and require full-access/never there as well.

- [x] Add failing wrapper tests using a fake App Server, asserting an actual
  question/reply round trip and existing validated board output afterward.
- [x] Route real wrapper calls through the new adapter; retain timeout, exit,
  report validation/persistence, provider circuit, gate and Atlas hooks. Bind
  owner/phase/plan/step metadata. No legacy sandboxed or one-shot fallback.
- [x] Retire hardcoded read-only/workspace-write/full-auto runtime flags in these
  paths and update board policy to full-access advisory semantics, without
  deleting advisory roles or allowing the CEO to skip gates.
- [x] Deliver the complete dependency-free runtime on global installation;
  canonical source and installed paths both resolve. WSL prefers native Codex;
  unsupported Windows interop must fail explicitly, not silently lose the bridge.
- [x] Run launch/board/profile/Atlas regression tests and installer path checks.

## Task 4 — orchestration consumer and handoff

Files: `super-gsd/skills/{sgsd-orchestrate,sgsd-deliberate,sgsd-codex-control}/SKILL.md`,
new `super-gsd/skills/sgsd-workers/SKILL.md`,
`super-gsd/tests/codex-worker/orchestration.test.cjs`,
`CLAUDE.md`, `super-gsd/CLAUDE-OVERLAY.md`,
`.planning/STATE.md` and `170-03-EXECUTOR-REPORT.md` beside this plan.

The root/installed Claude contracts also contain the old fixed Opus/GPT-5.5
dispatch instructions. Update their current worker/routing contract so they do
not override the new Fable inbox supervision or operator-selected Codex models.

- [x] Add scenario checks: start background wrapper, poll inbox, answer only
  from authorized task context, escalate operator-only decisions, steer exact
  active turn, stop owned task and await final report; no blocking wait while a
  worker is asking for input. Never launch a second Fable automatically.
- [x] Document exact runtime paths/commands, all orchestration units' ownership
  fields, full-access scope/risk, retained thread resume and content-free Atlas
  separation. Background wrapper completion still uses existing report gates.
- [x] Independent spec then code-quality review. Run focused fresh tests,
  schema/manual no-model smoke, Bash syntax and diff checks. Record exact tests,
  limitations, migration steps and live validation still needed. No phase close.

## Task 5 — operator-requested visual explanation

Added by operator request during implementation, 2026-09-08.
Files: `reports/sgsd/2026-09-08-codex-worker-communication.html`.

- [x] Use the VTP HTML explainer house theme and source-backed inline SVG.
  Show both communication directions, Fable/other owner units, exact-worker
  routing, operator escalation, SGSD gates and separate Atlas telemetry.
- [x] Include a clearly illustrative question/reply/continue example and
  distinguish locally observed adapter behavior from installed integration
  and live validation. Verify static structure and browser rendering if available.
- [x] Operator addition: check VTP harness/orchestration papers and books. Read
  targeted local full text, verify primary paper version metadata, and record
  findings, disagreements and live acceptance gaps in
  `.planning/analyses/2026-09-08-worker-bridge-vtp-crosscheck.md`. Add a cited
  research section to the HTML; do not modify the VTP library or expand gates.

Rollback: retain source/history and use the existing updater to select the prior
revision. Do not delete binaries, evidence, worker sessions or user settings.
