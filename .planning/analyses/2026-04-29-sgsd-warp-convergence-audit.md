# SGSD + Warp Convergence Audit

Date: 2026-04-29
Project: C:\Users\user\GSDedits
Depends on: C:\Users\user\GSDedits\.planning\analyses\2026-04-29-warp-ecosystem-atlas.md

## Purpose

This audit decides how SGSD and Warp should conjoin without duplicating each other.

The goal is an excellent CLI / autopilot / orchestrator / harness:

```text
Warp gives the operator a native, visual, agentic command center.
SGSD gives the system a disciplined autonomous delivery engine.
```

## Core Decision

Warp should lead the experience.
SGSD should lead the execution truth.

That means:

- Use Warp for input, discoverability, native agent conversations, workflows, rules, skills, code review, session sharing, notebooks, plans, and local/cloud agent UX.
- Use SGSD for milestone state, phase state, gates, orchestration, Codex/Claude reviews, MUDA, token telemetry, memory governance, release readiness, and recovery.
- Use MCP as the bridge.
- Use files under `.planning` as the durable audit trail.

## Division Of Responsibility

| Concern | Warp owns | SGSD owns | Shared bridge |
|---|---|---|---|
| Daily launch | workflows, command search, launch config | `sg`, `sgsd`, boot scripts | `.warp/workflows`, boot log |
| Main operator UI | terminal, panes, agent view, code review | cockpit content and status model | launch config, MCP, JSONL ledgers |
| Agent prompt entry | Universal Input, voice/images/files | SGSD command syntax and mission packets | project rules and skills |
| Agent execution | Warp Agent for ad-hoc tasks; Claude/Codex CLI utility bars | SGSD orchestrator dispatch loop | third-party CLI detection, MCP |
| Project understanding | Codebase Context, rules, skills | SGSD docs, roadmap, state | `AGENTS.md`, `WARP.md`, MCP |
| Plans | rich Warp plan editor | SGSD milestone/phase contracts | plan export/import phase |
| Task lists | visible agent task status | SGSD phase/task status | MCP + `.planning` |
| Code review | human diff inspection and comments | ATC, verifier, release readiness | artifact links, code review panel |
| Gates | display gate status | enforce gates and outcomes | MCP `sgsd_gate_status` |
| Tokens | visual questions and summaries | collect/attribute ledgers | MCP `sgsd_token_spend` |
| Memory | user-facing context and rules | governed SGSD memory writes | optional VTP/private KB MCP |
| Remote monitoring | session sharing, Oz web where applicable | watchdog and checkpoint | monitor packet command |
| Cloud automation | Oz scheduled/cloud agents | local SGSD auto-mode unless explicitly ported | cloud-safe skills |
| Native extension | open-source Warp issues/specs | generalizable SGSD needs | ACP/upstream contribution |

## Current Local State

Already present:

- `.warp/workflows/sgsd-start.yaml`
- `.warp/workflows/sgsd-auto.yaml`
- `.warp/workflows/sgsd-cockpit.yaml`
- `.warp/workflows/sgsd-token-current.yaml`
- `.warp/workflows/sgsd-preflight.yaml`
- `WARP.md`
- `docs/reports/SGSD-Warp-Integration-ELI5.html`
- `docs/superpowers/specs/2026-04-11-sgsd-warp-layout-design.md`
- `.planning/analyses/2026-04-29-sgsd-warp-incorporation-plan.md`
- `.planning/analyses/2026-04-29-sgsd-warp-native-research-plan.md`
- `.planning/analyses/2026-04-29-warp-ecosystem-atlas.md`

Current SGSD state:

- Roadmap v1.6 through v2.1 is complete.
- `.planning/STATE.md` reports `ROADMAP COMPLETE`.
- SGSD has rich telemetry in `.planning/metrics`.
- v1.9 introduced token/context benchmarking and Redis adapter work.
- v2.0 introduced failure injection and release readiness.
- v2.1 introduced installer/distribution/onboarding drift work.

Missing today:

- No read-only SGSD MCP server exists at `super-gsd/tools/warp-mcp/server.cjs`.
- No `AGENTS.md` exists yet for tool-neutral Warp project rules.
- No confirmed local Warp launch config exists at `$HOME/.warp/launch_configurations`.
- No formal SGSD Warp skills exist under `.agents/skills/` or `.warp/skills/`.
- No standardized `.planning/ORCHESTRATOR-LIVE.jsonl` event contract exists as a first-class bridge.
- No `sgsd-warp-doctor` exists to verify Warp setup.
- No cockpit 2.0 design is explicitly Warp-native yet.

## Interaction Model

### Daily Start

Operator opens Warp in:

```powershell
C:\Users\user\GSDedits
```

Then either:

- Runs a workflow from Command Search: `SGSD: Start`.
- Or types:

```powershell
sg
```

Expected behavior:

- Claude starts in the same Warp terminal.
- Warp detects Claude Code and shows the third-party utility bar.
- SGSD cockpit opens separately.
- Warp Codebase Context sees the repo.
- `WARP.md` / `AGENTS.md` guide Warp Agent.
- SGSD state remains in `.planning`.

### Daily Auto Mode

Operator uses:

```powershell
sg -Go
```

Expected behavior:

- Main agent remains in the active Warp session.
- Cockpit shows live phase/gate/agent/Codex/token state.
- Warp Agent can be asked questions through MCP:
  - "What is SGSD trying to finish?"
  - "What is blocked?"
  - "What does this unlock?"
  - "What did Codex do?"
  - "Where did tokens go?"
  - "What should I watch next?"

### Daily Review

After SGSD changes files:

- Open Warp Code Review panel.
- Inspect all diffs.
- Leave comments if needed.
- Use SGSD gates as the formal quality signal.
- Use Warp review as the human inspection layer.

### Daily Recovery

If SGSD appears stuck:

1. Run `SGSD: Watchdog Status`.
2. Ask Warp Agent: "Use SGSD MCP to explain the current stuck state."
3. Run `SGSD: Recovery Packet`.
4. Inspect `.planning/ORCHESTRATOR-CHECKPOINT.md`.
5. Resume with `sg -Go` only after the recovery packet is understood.

### Remote Monitoring

For long runs:

- Start in Warp.
- Share the session from Warp.
- Use the web viewer on phone.
- Keep the shared view to the main terminal and cockpit if possible.
- Do not share full scrollback if secrets/private paths may be present.

## Crossover Audit

### 1. Workflows Vs SGSD Commands

Overlap:

- Both represent repeatable commands.

Decision:

- Warp workflows are discoverable buttons.
- SGSD commands are executable truth.

Implementation:

- Every common SGSD command gets a workflow wrapper.
- Workflows should never embed complex logic.
- Workflows should call stable SGSD commands.

Needed:

- More workflows for status/recovery/gates/watchdog.
- YAML validation test.

### 2. Warp Rules Vs CLAUDE.md

Overlap:

- Both instruct agents.

Decision:

- `CLAUDE.md` remains Claude Code's deep orchestrator contract.
- `AGENTS.md` becomes tool-neutral project rules.
- `WARP.md` remains Warp-specific operator guidance and takes priority in Warp if both exist.

Implementation:

- `AGENTS.md` should be compact, stable, and safe for all agents.
- `WARP.md` should link to detailed docs and workflows.
- Avoid copying all of `CLAUDE.md` into Warp rules.

Needed:

- Generate/review `AGENTS.md`.
- Update `WARP.md` to point to the new atlas/audit/roadmap.

### 3. Warp Skills Vs SGSD Skills

Overlap:

- Both are reusable agent procedures.

Decision:

- Warp skills should wrap SGSD operator tasks, not SGSD internal orchestration.
- SGSD skills remain the autonomous engine.

Implementation:

- Put cross-agent skills under `.agents/skills/`.
- Each skill should have one purpose.
- Skills can call MCP tools, inspect files, and produce explanations/plans.

Needed skills:

- `sgsd-warp-operator`
- `sgsd-status-brief`
- `sgsd-gate-triage`
- `sgsd-token-triage`
- `sgsd-roadmap-planner`
- `sgsd-cockpit-review`

### 4. Warp MCP Vs SGSD Metrics Files

Overlap:

- Both represent state.

Decision:

- `.planning` files are source of truth.
- MCP is a query interface over them.

Implementation:

- Read-only server first.
- Tools return concise JSON and human text.
- Strong redaction.
- Stable schema/version.
- Degrade cleanly if no active milestone exists.

Needed:

- `super-gsd/tools/warp-mcp/server.cjs`
- fixtures
- self-test
- Warp MCP config snippet

### 5. Warp Agent Plans Vs SGSD Phases

Overlap:

- Both decompose work.

Decision:

- Warp plans are design/review documents.
- SGSD phases are execution contracts.

Implementation:

- Add a converter from Warp plan Markdown to SGSD phase candidates.
- Require explicit approval before turning a Warp plan into an SGSD milestone.
- Keep generated phase docs under `.planning/milestones/...`.

Needed:

- Plan export convention.
- Plan-to-phase scaffold tool.
- Validation that every phase has acceptance criteria.

### 6. Warp Task Lists Vs SGSD Progress

Overlap:

- Both show progress.

Decision:

- Warp task lists show Warp Agent progress.
- SGSD progress comes from `.planning`.

Implementation:

- Do not try to keep Warp task list as canonical.
- Instead expose SGSD progress through MCP and cockpit.

Needed:

- MCP `sgsd_current_phase` and `sgsd_cockpit_snapshot`.

### 7. Warp Code Review Vs SGSD ATC

Overlap:

- Both review changes.

Decision:

- Warp Code Review is human-facing.
- SGSD ATC is mechanical evidence.

Implementation:

- SGSD should print/open links to ATC and verification reports.
- Warp Code Review should be used before operator accepts/ships larger changes.

Needed:

- Workflow `SGSD: Open Review Artifacts`.
- Possibly command to print latest changed files and artifact links.

### 8. Third-Party CLI Agent Wrapping Vs SGSD Boot

Overlap:

- SGSD starts Claude/Codex. Warp detects Claude/Codex.

Decision:

- SGSD boot must not hide supported agent CLIs from Warp.

Implementation:

- Main Claude stays in current Warp terminal.
- Cockpit is separate.
- Codex runs should stay visible/logged enough for Warp and SGSD.
- If Warp fails to detect `sg`-launched Claude, create an upstream issue or local boot adjustment.

Needed:

- Smoke test matrix:
  - `claude` direct in Warp.
  - `sg` in Warp.
  - `sg -Go` in Warp.
  - Codex direct in Warp.
  - Codex via SGSD.

### 9. Full Terminal Use Vs SGSD Autonomy

Overlap:

- Both can drive terminal activity.

Decision:

- Full Terminal Use is a supervision/debugging tool.
- SGSD orchestrator remains the autonomous runner.

Implementation:

- Use Warp Agent to inspect stuck terminal sessions.
- Do not require Warp Agent to keep auto-mode moving.

Needed:

- Operator guide examples:
  - "Attach Warp Agent to cockpit and explain why it is stuck."
  - "Attach Warp Agent to failed test output and suggest next command."

### 10. Launch Configs Vs SGSD Cockpit

Overlap:

- Both create visible workspace layouts.

Decision:

- Launch configs define Warp window/pane arrangement.
- SGSD cockpit scripts define panel content.

Implementation:

- Start with launch config templates, not a hard dependency.
- Keep `sgsd` cockpit working outside Warp.
- Later, if Warp CLI supports app control, wire one-command workspace launch.

Needed:

- Local smoke test for launch config path and behavior.
- `sgsd-warp-doctor` probe.

### 11. Warp Drive Notebooks Vs SGSD Docs

Overlap:

- Both are documentation/playbooks.

Decision:

- Repo Markdown remains source.
- Warp notebooks are operator-friendly imported copies.

Implementation:

- Author docs in repo.
- Create export/import guide.
- Use notebooks for runbooks with command blocks.

Needed:

- `SGSD Warp Operator Notebook` source markdown.

### 12. Session Sharing Vs SGSD Remote Monitoring

Overlap:

- Both address remote visibility.

Decision:

- Warp session sharing is user-facing remote view.
- SGSD watchdog/recovery is technical truth.

Implementation:

- Provide a "safe share checklist".
- Add workflow to print monitoring packet.

Needed:

- `SGSD: Remote Monitor Packet` workflow.
- Documentation warning about scrollback/secrets.

### 13. Oz Cloud Agents Vs SGSD Auto Mode

Overlap:

- Both run autonomous agents.

Decision:

- Oz cloud agents are for cloud-safe, repo-committed, isolated jobs.
- SGSD local auto-mode remains for local full-context orchestration.

Implementation:

- Use Oz for scheduled audits, docs drift, public repo checks, or clean install checks.
- Do not launch full SGSD local roadmap auto-mode in Oz until state, VTP, Redis, and Windows behavior are portable.

Needed:

- Cloud-safe skill list.
- Environment spec if/when needed.

### 14. Warp Open Source Vs SGSD Native UI

Overlap:

- SGSD wants a better cockpit; Warp can be modified.

Decision:

- Do not fork first.
- Build state bridge and cockpit first.
- Upstream generalizable Warp improvements later.

Implementation:

- Track issues:
  - ACP support.
  - Warp CLI app control.
  - Tmux control mode.
  - third-party wrapper command detection.
  - long-running local agent telemetry.

Needed:

- Upstream issue/spec candidates after local integration proves the need.

## What Warp Should Do Better Than PowerShell In SGSD

1. Let the user launch SGSD commands by search instead of memory.
2. Keep Claude/Codex interactive sessions richer with voice/images/files/diffs.
3. Let the user ask status questions without raw log spelunking.
4. Make code diffs visible immediately.
5. Make plans visible/editable before execution.
6. Attach files/blocks/images to prompts quickly.
7. Share a run for remote monitoring.
8. Keep project-specific rules and skills near the terminal.
9. Provide a single visual workspace with terminal, code, review, and agent.

## What SGSD Should Do Better Than Warp

1. Maintain durable milestone/phase truth.
2. Enforce gates.
3. Preserve evidence.
4. Run multi-step autonomous delivery.
5. Attribute token/context spend.
6. Manage Codex/Claude review contracts.
7. Run MUDA/waste gates.
8. Produce release readiness scores.
9. Survive context resets via checkpoints.
10. Keep local/private knowledge optional and governed.

## Shared Vocabulary

To conjoin cleanly, Warp and SGSD need the same words.

Recommended status vocabulary:

- `idle`
- `starting`
- `running`
- `thinking`
- `dispatching`
- `reviewing`
- `blocked`
- `warning`
- `failed`
- `recoverable`
- `complete`
- `unknown`

Recommended entity vocabulary:

- `milestone`
- `phase`
- `plan`
- `task`
- `agent`
- `provider`
- `gate`
- `review`
- `artifact`
- `blocker`
- `token_bucket`
- `checkpoint`
- `unlock`

Recommended event vocabulary:

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
- `muda_probe_completed`
- `token_threshold_crossed`
- `checkpoint_written`
- `operator_attention_required`
- `run_completed`

## Data Contract Priorities

The integration should standardize these contracts before UI polish:

1. `sgsd_current_state`
2. `sgsd_current_phase`
3. `sgsd_gate_status`
4. `sgsd_agent_roster`
5. `sgsd_codex_status`
6. `sgsd_token_spend`
7. `sgsd_recovery_packet`
8. `sgsd_cockpit_snapshot`
9. `sgsd_artifact_links`
10. `sgsd_warp_doctor`

## UX Target

The user should be able to ask:

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

And get a direct answer from either:

- the cockpit, or
- Warp Agent calling SGSD MCP, or
- a workflow output block.

## Recommended Architecture

```text
Warp UI
  |
  |-- Workflows call SGSD commands
  |-- Rules/Skills guide Warp Agent
  |-- Code Review displays file diffs
  |-- Session sharing displays live run
  |
  |-- MCP calls
        |
        v
SGSD Warp MCP server
  |
  |-- reads .planning state
  |-- reads metrics JSONL
  |-- reads latest milestone artifacts
  |-- redacts private paths/secrets
  |-- returns stable status JSON
        |
        v
SGSD Core
  |
  |-- orchestrator
  |-- gates
  |-- telemetry
  |-- cockpit scripts
  |-- Codex/Claude review
  |-- VTP/private KB optional
```

## Implementation Warnings

### Warning 1: Do Not Build UI Against Raw Logs

Raw JSONL files are evidence, not UI APIs. Build `warp-mcp` and cockpit summary functions that read logs and return stable objects.

### Warning 2: Do Not Make Warp Required

SGSD should run in PowerShell, Windows Terminal, VS Code terminal, and Warp. Warp is the best operator shell, not a hard dependency.

### Warning 3: Do Not Make VTP Required

VTP is the operator’s private knowledge base. Warp integration must prompt for optional knowledge roots and degrade to SGSD's included research/docs.

### Warning 4: Do Not Replace Gates With Agent Confidence

Warp Agent may be persuasive. SGSD evidence should decide close/ship status.

### Warning 5: Be Careful With Session Sharing

Do not share secrets, tokens, full private scrollback, or private KB content unless explicitly intended.

### Warning 6: Cloud Runs Need Committed Context

Oz/cloud agents cannot read local-only uncommitted mission packets. Anything cloud-run needs to be committed or explicitly provided through environment/context.

## Operator Scenarios

### Scenario A: Morning Start

1. Open Warp in repo.
2. Run `SGSD: Status`.
3. Ask Warp Agent "Summarize SGSD status using MCP."
4. Run `SGSD: Start`.

### Scenario B: Full Auto Run

1. Run `SGSD: Full Preflight`.
2. Run `SGSD: Auto Mode`.
3. Share session if leaving desk.
4. Monitor cockpit and Warp Agent status questions.
5. Review diffs in Warp Code Review.

### Scenario C: Gate Failure

1. Cockpit shows blocked/warn.
2. Run `SGSD: Gate Status`.
3. Ask Warp Agent "Explain this gate failure and show artifact links."
4. Use Code Review if fixes touched files.
5. Resume only through SGSD recovery command.

### Scenario D: Design A New SGSD Milestone

1. Use Warp `/plan` to create a rich plan.
2. Edit/review plan in Warp.
3. Export plan to Markdown.
4. Run `SGSD: Plan To Phases`.
5. Claude/SGSD consumes generated milestone scaffolding.

### Scenario E: Remote Monitoring

1. Run `SGSD: Remote Monitor Packet`.
2. Start session sharing without unnecessary scrollback.
3. Monitor from phone.
4. If blocked, use recovery packet and artifact links.

## Claude Handover Rules

When handing this to Claude:

1. Claude must read the atlas first.
2. Claude must read this convergence audit second.
3. Claude must not start by editing Warp source.
4. Claude must implement stable SGSD surfaces first.
5. Claude must treat read-only MCP as the first major bridge.
6. Claude must preserve existing `sg` boot behavior: main Claude in current terminal, cockpit separate.
7. Claude must audit before implementing each milestone to avoid duplicate work.
8. Claude must write acceptance evidence per phase.
9. Claude must not assume VTP exists.
10. Claude must not make Warp required for SGSD core.

## Audit Conclusion

The highest-leverage SGSD/Warp integration path is:

```text
1. Workflows make SGSD discoverable.
2. Rules and skills make SGSD understandable.
3. MCP makes SGSD queryable.
4. Cockpit 2.0 makes SGSD visible.
5. Warp Code Review makes SGSD changes inspectable.
6. Session sharing makes SGSD remotely monitorable.
7. ACP/native Warp work makes SGSD first-class later.
```

This keeps the architecture clean: Warp is the operator cockpit, SGSD is the autonomous engine, and MCP is the bridge between them.
