# SGSD Warp Integration Roadmap

Date: 2026-04-29
Project: C:\Users\user\GSDedits
Status: proposed execution roadmap, not yet activated in `.planning/STATE.md`
Previous roadmap: v1.6 through v2.1 complete, phases 26-62 shipped
Proposed next phase range: 63-97

## Mission

Build SGSD into a first-class Warp operator experience without making SGSD dependent on Warp.

Warp should become the best way to run, monitor, ask about, review, and remotely supervise SGSD.
SGSD should remain the source of truth for autonomous execution, gates, telemetry, state, memory, and recovery.

## Required Reading Before Execution

Claude must read these files before starting Phase 63:

1. `C:\Users\user\GSDedits\.planning\analyses\2026-04-29-warp-ecosystem-atlas.md`
2. `C:\Users\user\GSDedits\.planning\analyses\2026-04-29-sgsd-warp-convergence-audit.md`
3. `C:\Users\user\GSDedits\.planning\analyses\2026-04-29-sgsd-warp-native-research-plan.md`
4. `C:\Users\user\GSDedits\.planning\analyses\2026-04-29-sgsd-warp-incorporation-plan.md`
5. `C:\Users\user\GSDedits\docs\superpowers\specs\2026-04-11-sgsd-warp-layout-design.md`
6. `C:\Users\user\GSDedits\docs\reports\SGSD-Warp-Integration-ELI5.html`
7. `C:\Users\user\GSDedits\WARP.md`
8. `C:\Users\user\GSDedits\.planning\STATE.md`
9. `C:\Users\user\GSDedits\.planning\ROADMAP-AGENT.md`

## Global Execution Rules

1. Audit before build in every phase.
2. Do not duplicate existing SGSD features.
3. Keep SGSD runnable in plain PowerShell.
4. Treat Warp as the premium operator shell, not a required runtime.
5. Keep VTP/private KB optional.
6. Start with read-only bridges before write-capable bridges.
7. Do not patch Warp source until local integration proves the upstream need.
8. Preserve `sg` behavior: main Claude session stays in the terminal where the user typed `sg`; cockpit opens separately.
9. Do not make Warp Agent task lists or plans the canonical SGSD state.
10. Use `.planning` as the durable audit trail.
11. Add acceptance tests or smoke checks to every code phase.
12. Redact secrets/private paths from any shared/MCP output unless the path is intentionally local operator evidence.
13. When a new roadmap starts after `STATE.md` reports a completed roadmap, activate the new roadmap in `STATE.md` before or atomically with the first phase scaffold. Do not leave `.planning/milestones/{new}` newer than `STATE.md` while `STATE.md` still says `milestone: complete`.

## Standard Phase Artifacts

Each phase should produce:

- `{NN}-RESEARCH.md`
- `{NN}-CONTEXT.md`
- `{NN}-01-...-PLAN.md`
- `{NN}-VERIFICATION.md`
- `{NN}-ATC-REVIEW.md`
- `WASTE.md` when MUDA trigger applies
- `PHASE-CAPSULE.json` when phase closes

For docs-only phases, code ATC may be docs-only, but phase-level review still applies.

## Milestone Overview

| Milestone | Phases | Theme | Result |
|---|---:|---|---|
| v2.2 | 63-67 | Warp discovery and operator baseline | Warp behaviors proven locally; workflows/rules/docs ready |
| v2.3 | 68-72 | Read-only SGSD MCP bridge | Warp Agent can query SGSD state safely |
| v2.4 | 73-78 | Warp-native cockpit and live status | Cockpit 2.0 and MCP share one event/status model |
| v2.5 | 79-83 | Warp skills, plans, notebooks, and workflows | SGSD becomes usable through Warp-native commands/playbooks |
| v2.6 | 84-88 | Review, recovery, sharing, and remote monitoring | Long SGSD runs become inspectable and recoverable in Warp |
| v2.7 | 89-93 | Optional controlled actions and cloud-safe automation | Safe write-capable bridge and Oz-compatible jobs |
| v2.8 | 94-97 | ACP/native Warp contribution readiness | SGSD ready for first-class native integration when Warp surfaces mature |

---

# Milestone v2.2 - Warp Discovery And Operator Baseline

## Goal

Prove what Warp can actually do on this machine, then finish the operator-facing baseline: workflows, project rules, and user docs.

## Why This Comes First

The old SGSD Warp layout spec recorded Windows-specific uncertainty around programmatic pane control. Warp has also changed since becoming open source. Before building against assumptions, Phase 63 must test the current app behavior.

## Phase 63 - Warp Capability Smoke Test

Goal: verify current Warp behavior on this Windows machine.

Inputs:

- Warp docs.
- Existing `.warp/workflows`.
- Existing `sg` and `sgsd` commands.
- Current PowerShell profile.

Tasks:

- Confirm Warp version.
- Confirm `sg`, `sgsd`, and `sgsd-setup` resolve inside Warp.
- Confirm workflows appear in Command Search / Workflow Search.
- Confirm `sg` keeps Claude in current Warp terminal.
- Confirm Warp detects direct `claude` and `codex` sessions.
- Confirm whether Warp detects `sg`-launched Claude.
- Confirm launch config storage path.
- Confirm whether launch configs can open into the active window or only new windows.
- Confirm Codebase Context status for `C:\Users\user\GSDedits`.
- Confirm whether WSL/tmux would disable Codebase Context.
- Record screenshots only if safe and useful.

Outputs:

- `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-RESEARCH.md`
- `.planning/milestones/v2.2/WARP-SMOKE.md`

Acceptance:

- Matrix records direct evidence for each tested capability.
- Any divergence from docs is recorded as local caveat.
- No implementation proceeds based on untested pane-control assumptions.

## Phase 64 - Workflow Pack Completion

Goal: make every common SGSD command searchable and runnable through Warp workflows.

Inputs:

- Existing `.warp/workflows/*.yaml`.
- SGSD startup guide.
- Token/recovery/gate commands.

Tasks:

- Audit existing workflow YAML.
- Add missing workflows:
  - `SGSD: Status`
  - `SGSD: Recovery Packet`
  - `SGSD: Gate Status`
  - `SGSD: Watchdog Status`
  - `SGSD: Codex Status`
  - `SGSD: Current Phase Artifacts`
  - `SGSD: Warp Doctor`
  - `SGSD: Remote Monitor Packet`
- Add descriptions with searchable operator terms.
- Add defaults for `project_dir`.
- Add YAML validation test.
- Add a small index of workflow names in docs.
- Add or specify a new-roadmap activation command/workflow, such as `SGSD: Start New Roadmap` or `sgsd-start-roadmap`, that updates `.planning/STATE.md` before creating the first phase artifacts.
- Carry forward the Phase 63 state-source mismatch as a product requirement: users starting a new SGSD roadmap after `ROADMAP COMPLETE` must not see the cockpit stuck on the prior completed roadmap.

Outputs:

- New/updated `.warp/workflows/*.yaml`.
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md`.

Acceptance:

- YAML parser validates all workflows.
- Workflow names/descriptions include start, auto, cockpit, token, recovery, gates, watchdog, Codex, blocked, status.
- Workflows call stable SGSD commands, not ad-hoc logic.
- Phase 64 documentation defines how a new roadmap is activated from `ROADMAP COMPLETE` without causing a cockpit/STATE mismatch.

## Phase 65 - Agent Rules Context Pack

Goal: make Warp Agent and other local agents understand SGSD without loading the huge handbook.

Inputs:

- `WARP.md`
- `CLAUDE.md`
- `README.md`
- SGSD boot guide.
- Atlas and convergence audit.

Tasks:

- Create `AGENTS.md` as tool-neutral project rules.
- Keep `WARP.md` as Warp-specific operator instructions.
- Add rule hierarchy:
  - `AGENTS.md` = all-agent project rules.
  - `WARP.md` = Warp-specific daily usage and workflow list.
  - `CLAUDE.md` = Claude Code orchestrator contract.
- Explain that `WARP.md` takes priority in Warp if both exist.
- Add "do not duplicate SGSD gates" guidance.
- Add "read SGSD state from `.planning` or MCP" guidance.
- Add "VTP optional" guidance.

Outputs:

- `AGENTS.md`
- Updated `WARP.md`

Acceptance:

- `AGENTS.md` is under a strict compactness target.
- It does not copy the full `CLAUDE.md`.
- Warp-specific instructions remain in `WARP.md`.
- Rules explain SGSD truth locations.

## Phase 66 - SGSD Warp Operator Guide

Goal: write the practical user guide for using SGSD in Warp.

Inputs:

- Atlas.
- Convergence audit.
- Workflow pack.
- Startup guide.

Tasks:

- Create `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md`.
- Include:
  - What Warp adds over PowerShell.
  - Daily start.
  - Full auto run.
  - Recovery.
  - Gate triage.
  - Code review.
  - Remote monitoring.
  - Safe sharing.
  - VTP/private KB optionality.
  - Plain PowerShell fallback.
- Add "what to ask Warp Agent" examples.
- Add "what not to ask Warp Agent to override" examples.

Outputs:

- `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md`

Acceptance:

- A new user can follow it from blank Warp session to SGSD status.
- It includes exact Windows paths.
- It separates Warp UX from SGSD execution truth.

## Phase 67 - Warp Doctor Probe Design

Goal: design and implement a read-only local diagnostic command for Warp setup.

Inputs:

- Phase 63 smoke findings.
- Existing boot scripts.

Tasks:

- Implement `super-gsd/tools/warp-doctor/check.cjs`.
- Optional wrapper command through PowerShell alias later.
- Probe:
  - Warp detection env facts.
  - `sg` command available.
  - `sgsd` command available.
  - `.warp/workflows` present.
  - workflow YAML parse.
  - `WARP.md` present.
  - `AGENTS.md` present.
  - launch config path exists or missing with guidance.
  - MCP config presence if later phase exists.
  - Codebase Context cannot be checked directly unless Warp exposes local evidence; mark manual check.
  - `STATE.md` lifecycle mismatch: detect when the newest `.planning/milestones/*/phases/*` artifact is newer than `STATE.md` while `STATE.md` still reports `milestone: complete` or `ROADMAP COMPLETE`.
  - New-roadmap activation drift: detect when `.planning/milestones/{latest}` exists but `STATE.md` points at a prior completed roadmap.
- Output concise table.
- Add self-test with fixture repo.

Outputs:

- `super-gsd/tools/warp-doctor/check.cjs`
- `super-gsd/tools/warp-doctor/run-self-test.cjs`

Acceptance:

- `node super-gsd/tools/warp-doctor/run-self-test.cjs` passes.
- `node super-gsd/tools/warp-doctor/check.cjs --project C:\Users\user\GSDedits` exits 0 or warns with actionable instructions.
- No write operations.
- Doctor warns with an explicit repair instruction if new phase artifacts exist but canonical `STATE.md` still says the previous roadmap is complete.

---

# Milestone v2.3 - Read-Only SGSD MCP Bridge

## Goal

Let Warp Agent ask SGSD structured questions without scraping terminal output.

## Phase 68 - SGSD MCP Contract

Goal: define the read-only MCP tool contract before implementation.

Inputs:

- `.planning/STATE.md`
- `.planning/metrics/*`
- current cockpit scripts.
- Atlas and audit.

Tasks:

- Define tool list:
  - `sgsd_current_state`
  - `sgsd_current_phase`
  - `sgsd_milestone_status`
  - `sgsd_watchdog_status`
  - `sgsd_gate_status`
  - `sgsd_agent_roster`
  - `sgsd_codex_status`
  - `sgsd_token_spend`
  - `sgsd_context_bench_status`
  - `sgsd_latest_commits`
  - `sgsd_recovery_packet`
  - `sgsd_cockpit_snapshot`
  - `sgsd_artifact_links`
  - `sgsd_warp_doctor`
- Define response schemas.
- Define redaction rules.
- Define degraded behavior.
- Define max output sizes.
- Define fixture format.

Outputs:

- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md`
- Fixture plan under `super-gsd/tools/warp-mcp/fixtures/README.md`

Acceptance:

- Every tool has inputs, outputs, failure modes, and source files.
- No write-capable tool appears in v2.3.
- Contract names schema version.

## Phase 69 - MCP Server Skeleton

Goal: implement the MCP stdio server shell with no complex business logic yet.

Inputs:

- Phase 68 contract.
- Repo Node conventions.

Tasks:

- Implement `super-gsd/tools/warp-mcp/server.cjs`.
- Add tool registration.
- Add schema version endpoint/tool.
- Add CLI `--self-test`.
- Add fixture loader.
- Add stable error envelope.

Outputs:

- `super-gsd/tools/warp-mcp/server.cjs`
- `super-gsd/tools/warp-mcp/run-self-test.cjs`

Acceptance:

- Server starts over stdio.
- Self-test passes.
- Tool names match contract.
- Bad inputs produce degraded error envelopes, not throws.

## Phase 70 - Core Status Tool Suite

Goal: implement state, phase, milestone, watchdog, and recovery tools.

Inputs:

- `STATE.md`
- `ROADMAP-AGENT.md`
- `ORCHESTRATOR-CHECKPOINT.md`
- `autopilot-watchdog.json`

Tasks:

- Implement parsers that tolerate missing files.
- Implement:
  - `sgsd_current_state`
  - `sgsd_current_phase`
  - `sgsd_milestone_status`
  - `sgsd_watchdog_status`
  - `sgsd_recovery_packet`
- Add fixtures:
  - active phase.
  - roadmap complete.
  - missing checkpoint.
  - degraded/malformed state.

Acceptance:

- Fixture self-test covers all status classes.
- Roadmap-complete state produces helpful answer, not false active phase.
- Recovery packet includes exact resume guidance when available.

## Phase 71 - Gates, Codex, Agents, Tokens Tool Suite

Goal: implement the operational insight tools.

Inputs:

- `codex-live.json`
- `codex-log.jsonl`
- `activity-log.jsonl`
- `orchestrator-pulse.jsonl`
- `token-attribution.jsonl`
- `agent-token-spend.jsonl`
- phase artifact folders.

Tasks:

- Implement:
  - `sgsd_gate_status`
  - `sgsd_agent_roster`
  - `sgsd_codex_status`
  - `sgsd_token_spend`
  - `sgsd_context_bench_status`
  - `sgsd_artifact_links`
  - `sgsd_latest_commits`
- Add tailing/summary readers with row limits.
- Add JSONL parse error tolerance.
- Add stable time/freshness flags.

Acceptance:

- Tools answer the user's key cockpit questions.
- Token tools do not dump huge ledgers.
- Codex status distinguishes active, stale, unavailable, and complete.
- Agent roster groups by phase if phase data exists.

## Phase 72 - MCP Security, Warp Config, And Docs

Goal: make the MCP bridge safe and easy to connect in Warp.

Inputs:

- Implemented server.
- Warp MCP docs.

Tasks:

- Add redaction pass:
  - environment secrets.
  - token-looking strings.
  - Redis URLs.
  - API keys.
  - private KB paths if not explicitly allowed.
- Add config snippet for Warp MCP settings.
- Add `SGSD-WARP-MCP-SETUP.md`.
- Add workflow `SGSD: MCP Self-Test`.
- Add `warp-doctor` MCP detection if feasible.

Acceptance:

- Self-test includes redaction fixtures.
- Setup doc gives exact command and working directory.
- Warp Agent can call at least one SGSD MCP tool in manual smoke test.

---

# Milestone v2.4 - Warp-Native Cockpit And Live Status

## Goal

Redesign SGSD cockpit around the user's actual questions and make cockpit and MCP share the same state model.

## Phase 73 - Operator Question Model Refresh

Goal: lock the cockpit 2.0 question model specifically for Warp.

Questions:

- What is the model doing?
- What are we trying to complete?
- What does this unlock?
- What is blocked?
- What agents were used?
- What did each agent do?
- What is Codex doing?
- What gates ran?
- What failed or warned?
- Where are tokens going?
- What should I read?
- What command resumes safely?

Tasks:

- Audit current cockpit 2.0 artifacts from v1.6.
- Map every question to current data source.
- Identify missing event fields.
- Decide which fields belong in MCP, cockpit, or both.

Outputs:

- `73-OPERATOR-QUESTION-MODEL.md`

Acceptance:

- Every question maps to source file/tool.
- Missing source fields become explicit tasks in later phases.

## Phase 74 - Orchestrator Live Event Contract

Goal: standardize a live event stream for agent/gate/codex/cockpit visibility.

Tasks:

- Define `.planning/ORCHESTRATOR-LIVE.jsonl`.
- Event types:
  - `run_started`
  - `phase_started`
  - `plan_selected`
  - `agent_dispatched`
  - `agent_progress`
  - `agent_completed`
  - `codex_started`
  - `codex_completed`
  - `gate_started`
  - `gate_passed`
  - `gate_warned`
  - `gate_failed`
  - `token_threshold_crossed`
  - `checkpoint_written`
  - `operator_attention_required`
  - `run_completed`
- Define stable entity IDs.
- Define schema version.
- Add event writer helper.

Outputs:

- `super-gsd/docs/ORCHESTRATOR-LIVE-EVENTS.md`
- writer helper path selected by implementation.

Acceptance:

- Contract supports cockpit and MCP without raw log scraping.
- Backward compatibility plan exists for old logs.

## Phase 75 - Live Event Writer Integration

Goal: wire the event contract into SGSD execution points.

Tasks:

- Find actual orchestrator write points.
- Add surgical event writes.
- Preserve old metrics ledgers.
- Add self-test using fixture event writes.
- Add read-only invariant around event parsing.

Acceptance:

- A test run emits representative events.
- Existing dashboards do not break.
- Event writing failure does not crash SGSD; it records degraded warning.

## Phase 76 - Cockpit State Adapter

Goal: build one adapter that both cockpit and MCP can use.

Tasks:

- Implement `super-gsd/tools/cockpit-state/adapter.cjs` or equivalent.
- Read `.planning/ORCHESTRATOR-LIVE.jsonl` and legacy metrics.
- Return normalized cockpit snapshot:
  - now.
  - objective.
  - unlock.
  - blockers.
  - agents.
  - codex.
  - gates.
  - tokens.
  - artifacts.
  - resume command.
- Add fixtures for active, blocked, warning, complete.

Acceptance:

- MCP `sgsd_cockpit_snapshot` uses adapter.
- Cockpit scripts can consume adapter output.
- Fixture self-test passes.

## Phase 77 - Cockpit 2.0 Warp Layout

Goal: redesign cockpit presentation for Warp's operator use.

Tasks:

- Audit existing PowerShell panels.
- Redesign layout around:
  - top mission strip.
  - current model/action.
  - objective/unlock.
  - blockers.
  - agent activity.
  - Codex activity.
  - gate status.
  - token spend.
  - artifact links.
- Keep it readable in a separate PowerShell/Warp pane.
- Avoid huge scrolling dumps.
- Add empty states.

Acceptance:

- Cockpit answers the 12 operator questions on one screen.
- Works outside Warp.
- PowerShell parser check passes.

## Phase 78 - Launch Configuration Templates

Goal: provide Warp-native saved workspace layouts.

Tasks:

- Create example launch config YAML under repo docs/templates.
- Include:
  - SGSD main.
  - cockpit.
  - token/codex/gate pane.
  - shell.
- Document install path `$HOME/.warp/launch_configurations/`.
- Add `warp-doctor` check for installed template if copied.
- Do not assume CLI launch until proven.

Acceptance:

- Template YAML validates.
- Docs explain manual install and limitations.
- Existing `sg` path remains primary.

---

# Milestone v2.5 - Warp Skills, Plans, Notebooks, And Workflows

## Goal

Make SGSD usable through Warp-native reusable knowledge objects.

## Phase 79 - SGSD Warp Skills Pack

Goal: create project skills Warp can discover.

Skills:

- `sgsd-warp-operator`
- `sgsd-status-brief`
- `sgsd-gate-triage`
- `sgsd-token-triage`
- `sgsd-roadmap-planner`
- `sgsd-cockpit-review`
- `sgsd-release-check`

Tasks:

- Create skills under `.agents/skills/`.
- Include frontmatter.
- Keep descriptions precise.
- Reference supporting docs instead of embedding everything.
- Include examples.

Acceptance:

- Each skill has one clear purpose.
- Warp can list skills when asked.
- Skills avoid mutating state unless explicitly scoped.

## Phase 80 - Warp Plan To SGSD Phase Scaffold

Goal: bridge Warp planning to SGSD execution contracts.

Tasks:

- Define export format for Warp plans.
- Implement converter:
  - input: Markdown plan.
  - output: draft milestone folder and phase stubs.
- Include acceptance criteria prompts.
- Require human review before activation.
- Mark generated files as draft.

Acceptance:

- Fixture Warp plan converts into phase stubs.
- Converter never updates `.planning/STATE.md`.
- Generated phase stubs include TODO markers for Claude research.

## Phase 81 - SGSD Operator Notebook Source

Goal: create repo source for a Warp Notebook.

Tasks:

- Create `super-gsd/docs/SGSD-WARP-NOTEBOOK.md`.
- Include runnable command blocks:
  - Start.
  - Auto.
  - Status.
  - Token summary.
  - Gate status.
  - Recovery packet.
  - Remote monitor packet.
- Add import/export instructions.

Acceptance:

- Markdown command blocks are copy/runnable.
- Notebook links to workflows and MCP setup.

## Phase 82 - Warp Prompts Pack

Goal: create reusable prompt templates for Warp Agent.

Tasks:

- Add `super-gsd/docs/SGSD-WARP-PROMPTS.md`.
- Prompts:
  - current status explainer.
  - gate triage.
  - token waste triage.
  - phase plan critic.
  - cockpit UX critic.
  - remote monitoring summary.
  - release readiness explainer.
- Include required MCP/tools context.

Acceptance:

- Prompts are short and operator-friendly.
- Each says whether it is read-only or may suggest edits.

## Phase 83 - Workflow/Skill/Prompt Cross-Index

Goal: make Warp assets discoverable and maintainable.

Tasks:

- Add `super-gsd/docs/SGSD-WARP-ASSET-INDEX.md`.
- Index:
  - workflows.
  - skills.
  - prompts.
  - notebook.
  - MCP tools.
  - launch configs.
- Add validation script that checks indexed paths exist.

Acceptance:

- Index validation passes.
- WARP.md links to asset index.

---

# Milestone v2.6 - Review, Recovery, Sharing, And Remote Monitoring

## Goal

Make long-running SGSD sessions easy to inspect, recover, and monitor remotely through Warp.

## Phase 84 - Code Review Integration Guide And Artifact Links

Goal: connect SGSD artifacts and Warp Code Review.

Tasks:

- Add command/report that prints:
  - changed files.
  - latest ATC review.
  - latest verification.
  - latest WASTE audit.
  - milestone summary.
- Add docs for opening Warp Code Review.
- Add workflow `SGSD: Open Review Artifacts` or equivalent.

Acceptance:

- Operator can get from SGSD phase close to Warp diff review in one minute.
- No automated discard/revert commands.

## Phase 85 - Recovery Packet Upgrade

Goal: make recovery packet Warp-friendly.

Tasks:

- Ensure recovery packet contains:
  - current status.
  - why stopped.
  - last safe command.
  - artifact links.
  - warnings.
  - exact resume command.
- Add MCP `sgsd_recovery_packet` parity.
- Add workflow.

Acceptance:

- Recovery packet is block-sized and attachable to Warp Agent.
- Roadmap-complete state gives "nothing to resume" guidance.

## Phase 86 - Remote Monitor Packet

Goal: support leaving the machine while SGSD runs.

Tasks:

- Implement read-only command/report:
  - current state.
  - session sharing checklist.
  - what not to share.
  - watchdog status.
  - expected next unlock.
  - recovery command.
- Add workflow.
- Add docs for phone monitoring.

Acceptance:

- Packet is concise and safe.
- Docs warn about scrollback/secrets.

## Phase 87 - Watchdog And Attention Alerts

Goal: make "needs operator attention" obvious.

Tasks:

- Audit existing watchdog.
- Define attention reasons:
  - provider unavailable.
  - gate failed after retries.
  - credentials needed.
  - destructive op blocked.
  - privacy judgment needed.
  - no activity.
  - roadmap complete.
- Surface in cockpit and MCP.

Acceptance:

- MCP and cockpit use same attention vocabulary.
- No false "stuck" when roadmap is complete.

## Phase 88 - End-To-End Warp Operator Drill

Goal: run the full operator flow.

Drill:

1. Open Warp.
2. Run `SGSD: Warp Doctor`.
3. Run `SGSD: Status`.
4. Ask Warp Agent for status through MCP.
5. Start SGSD.
6. Open cockpit.
7. Generate or use fixture gate warning.
8. Run gate triage.
9. Open Code Review.
10. Generate recovery packet.
11. Generate remote monitor packet.

Acceptance:

- Drill report records actual pass/fail.
- Any manual steps are documented.
- No secrets exposed.

---

# Milestone v2.7 - Optional Controlled Actions And Cloud-Safe Automation

## Goal

Add carefully scoped write/control actions only after read-only visibility is solid, and define what can safely run in Warp/Oz cloud.

## Phase 89 - Controlled Action Contract

Goal: define write-capable MCP tools before implementing any.

Candidate actions:

- `sgsd_run_preflight`
- `sgsd_generate_recovery_packet`
- `sgsd_run_token_summary`
- `sgsd_open_artifact_index`
- `sgsd_prepare_phase_scaffold`

Not allowed initially:

- `sgsd_go`
- destructive cleanup.
- git reset.
- credential writes.
- milestone close.

Tasks:

- Define permission tiers.
- Define operator confirmation requirements.
- Define audit log rows for action requests.
- Define denial reasons.

Acceptance:

- Contract exists.
- Dangerous actions explicitly excluded.

## Phase 90 - Controlled Action MCP Implementation

Goal: implement safe actions.

Tasks:

- Add only actions from Phase 89.
- Add dry-run mode.
- Add audit log.
- Add command allowlist.
- Add tests proving denied commands stay denied.

Acceptance:

- Self-test covers allow and deny paths.
- No auto-mode start through MCP yet.

## Phase 91 - Cloud-Safe SGSD Skills

Goal: define what SGSD-adjacent jobs can run in Oz/cloud.

Tasks:

- Identify safe cloud tasks:
  - docs drift audit.
  - Warp docs update scan.
  - public repo issue scan.
  - clean install audit in Linux container.
  - generated report PR.
- Identify unsafe tasks:
  - local VTP enrichment.
  - local Redis/live cockpit.
  - local Windows boot validation.
  - full SGSD auto-mode with local state.
- Write cloud-safe skills.

Acceptance:

- Cloud-safe tasks do not require private local state.
- Unsafe tasks are explicitly listed.

## Phase 92 - Oz Environment Spec

Goal: prepare but not require an Oz environment.

Tasks:

- Draft environment requirements:
  - repo clone.
  - Node version.
  - npm.
  - PowerShell availability if needed.
  - setup commands.
  - no private VTP by default.
- Add `super-gsd/docs/SGSD-OZ-ENVIRONMENT-SPEC.md`.

Acceptance:

- Spec can be used later to create Warp environment.
- No secrets hardcoded.

## Phase 93 - Scheduled Audit Design

Goal: define useful scheduled Warp/Oz agents.

Candidate schedules:

- Weekly Warp docs/roadmap scan.
- Weekly SGSD docs drift.
- Nightly install self-test on clean environment.
- Monthly open-source Warp issue scan for ACP/CLI/tmux/agent wrapping.

Tasks:

- Write schedule prompts.
- Define expected outputs.
- Define review/PR behavior.
- Define cost/credit warning.

Acceptance:

- Schedules are documented but not created automatically.
- Each has stop/disable instructions.

---

# Milestone v2.8 - ACP And Native Warp Contribution Readiness

## Goal

Prepare the path for first-class SGSD native integration once Warp's public surfaces are ready.

## Phase 94 - ACP Mapping Spec

Goal: map SGSD to Agent Client Protocol concepts.

Tasks:

- Track Warp ACP issue.
- Map:
  - session -> SGSD milestone/phase run.
  - plan -> phase plan.
  - tool call -> SGSD command/gate action.
  - progress -> live event.
  - permission -> SGSD hard stop / operator approval.
  - artifact -> phase/milestone file link.
- Define what SGSD would expose as an ACP agent.

Acceptance:

- Spec exists.
- No code depends on ACP yet.

## Phase 95 - ACP Adapter Spike

Goal: create a prototype only if Warp/client support is testable.

Precondition:

- Warp ACP support must be available enough to run a local smoke test.

Tasks:

- Build minimal adapter around read-only state.
- Expose current state and plan.
- Do not allow write actions.
- Record findings.

Acceptance:

- If ACP unavailable, phase records SKIPPED-WAITING-FOR-UPSTREAM with evidence.
- If available, minimal read-only smoke passes.

## Phase 96 - Warp Upstream Issue/Spec Pack

Goal: prepare generalizable upstream proposals.

Candidate proposals:

- Wrapper command detection for `sg` launching Claude/Codex.
- Long-running local orchestrator telemetry panel.
- Gate/status chips for local agent sessions.
- Warp CLI support for launching saved workspaces.
- ACP fixture based on SGSD milestone/phase flows.
- Tmux control mode validation for SGSD dashboards.

Tasks:

- Search existing GitHub issues.
- Avoid duplicates.
- Draft issue comments/spec notes.
- Do not open spammy issues.

Acceptance:

- One prioritized upstream target chosen.
- Draft spec packet exists.

## Phase 97 - SGSD Warp Integration Release Gate

Goal: close the Warp integration roadmap with evidence.

Tasks:

- Run all self-tests:
  - warp-doctor.
  - workflows YAML.
  - MCP self-test.
  - cockpit state adapter.
  - skills/index validation.
  - plan converter.
  - recovery/monitor packets.
- Run end-to-end operator drill again.
- Score integration readiness.
- Write final `SUMMARY.md`.

Acceptance:

- Release readiness score exists.
- Critical gaps listed.
- Plain PowerShell fallback still works.
- Warp experience demonstrably better than pre-integration baseline.

---

# Handover Prompt For Claude

Use this as the first message to Claude when ready:

```text
You are continuing SGSD after v2.1 roadmap completion. The next mission is SGSD Warp Integration, proposed phases 63-97.

Read these first, in order:
1. .planning/analyses/2026-04-29-warp-ecosystem-atlas.md
2. .planning/analyses/2026-04-29-sgsd-warp-convergence-audit.md
3. .planning/milestones/warp-integration/ROADMAP.md
4. WARP.md
5. docs/superpowers/specs/2026-04-11-sgsd-warp-layout-design.md

Do not start by patching Warp source.
Do not make Warp required for SGSD core.
Do not make VTP required.
Audit before build in every phase.
Start with Phase 63, Warp Capability Smoke Test.
If current .planning/STATE.md is ROADMAP COMPLETE, create v2.2 milestone scaffolding before execution and record that this is a new roadmap, not a continuation of the completed one.
Use SGSD standard artifacts and gates.
```

## Final Notes

This roadmap is intentionally over-specified. It should be pruned after Phase 63 proves current Warp behavior on the user's machine.

The most important milestone is v2.3. If only one milestone ships, ship the read-only SGSD MCP bridge. Everything else gets easier after Warp Agent can ask SGSD for structured truth.
