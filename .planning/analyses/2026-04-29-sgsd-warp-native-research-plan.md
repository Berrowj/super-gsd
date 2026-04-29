# SGSD + Warp Native Research Plan

Date: 2026-04-29
Project: C:\Users\jack.berrow\GSDedits
Status: research-backed plan, ready to convert into SGSD phases

## Executive Recommendation

Do not start by forking Warp.

The fastest, cleanest way to get value is to make Warp the native operator surface around SGSD:

```text
Warp = visual ADE, terminal workspace, agent UI, rules, plans, workflows, reviews, sharing
SGSD = orchestration engine, gates, memory, telemetry, cockpit, milestone/phase state
Claude Code = main local execution harness
Codex = review/check provider
VTP/private KB = optional enrichment source, not a required Warp dependency
```

The best first build is a "Warp Operator Layer" for SGSD:

1. Repository workflows for common SGSD commands.
2. Project rules/context files so Warp Agent, Claude Code, Codex, and future agents understand SGSD.
3. A read-only SGSD MCP server so Warp Agent can ask "what is SGSD doing?" without scraping terminal output.
4. Warp-aware cockpit and launch profiles for the user's visible workspace.
5. ACP and native Warp client work only after the current surfaces are proven.

This gets most of the value from Warp without binding SGSD to private Warp internals or unstable open-source contribution timing.

## Research Sources

Official Warp sources reviewed:

- Warp open-source announcement, 2026-04-28: https://www.warp.dev/blog/warp-is-now-open-source
- Warp public repo: https://github.com/warpdotdev/warp
- Warp contribution guide: https://raw.githubusercontent.com/warpdotdev/warp/master/CONTRIBUTING.md
- Warp FAQ: https://raw.githubusercontent.com/warpdotdev/warp/master/FAQ.md
- Warp May-June 2026 roadmap issue: https://github.com/warpdotdev/warp/issues/9233
- ACP support issue: https://github.com/warpdotdev/warp/issues/7326
- Warp workflows docs: https://docs.warp.dev/knowledge-and-collaboration/warp-drive/workflows
- Warp launch configuration docs: https://docs.warp.dev/terminal/sessions/launch-configurations
- Warp project rules docs: https://docs.warp.dev/knowledge-and-collaboration/rules
- Warp MCP docs for local agents: https://docs.warp.dev/agent-platform/capabilities/mcp
- Warp third-party CLI agents docs: https://docs.warp.dev/agent-platform/local-agents/third-party-cli-agents
- Warp planning docs: https://docs.warp.dev/agent-platform/capabilities/planning
- Warp task list docs: https://docs.warp.dev/agent-platform/capabilities/task-lists
- Warp Full Terminal Use docs: https://docs.warp.dev/agent-platform/capabilities/full-terminal-use
- Warp Codebase Context docs: https://docs.warp.dev/agent-platform/capabilities/codebase-context
- Warp Interactive Code Review docs: https://docs.warp.dev/agent-platform/local-agents/interactive-code-review
- Warp Session Sharing docs: https://docs.warp.dev/agent-platform/local-agents/session-sharing

Local SGSD sources reviewed:

- C:\Users\jack.berrow\GSDedits\.planning\analyses\2026-04-29-sgsd-warp-incorporation-plan.md
- C:\Users\jack.berrow\GSDedits\WARP.md
- C:\Users\jack.berrow\GSDedits\docs\reports\SGSD-Warp-Integration-ELI5.html
- C:\Users\jack.berrow\GSDedits\docs\superpowers\specs\2026-04-11-sgsd-warp-layout-design.md
- C:\Users\jack.berrow\GSDedits\.warp\workflows\sgsd-start.yaml
- C:\Users\jack.berrow\GSDedits\.warp\workflows\sgsd-auto.yaml
- C:\Users\jack.berrow\GSDedits\.warp\workflows\sgsd-cockpit.yaml
- C:\Users\jack.berrow\GSDedits\.warp\workflows\sgsd-token-current.yaml
- C:\Users\jack.berrow\GSDedits\.warp\workflows\sgsd-preflight.yaml

## Current Warp Facts That Matter

Warp is now open source, but not all of Warp is open. The client code is public. The cloud services, Drive backend, hosted auth, and Oz orchestration are still separate product surfaces. The repository licensing is also mixed: most of the client is AGPL v3, while `warpui_core` and `warpui` are MIT.

Warp's public roadmap explicitly includes:

- ACP client support, so other coding agents can use Warp's native agent UX.
- Better third-party agent support, including conversation history, best-of-k, and subagents.
- Better project/worktree primitives.
- Remote coding support.
- A future Warp CLI that can control the client app.
- Tmux control mode as a community-driver item.

That roadmap fits SGSD well, but several pieces are not ready to depend on yet. SGSD should build against stable user-facing Warp surfaces first.

## Native Warp Capabilities We Should Use

### 1. Repository Workflows

Warp supports saved parameterized commands. YAML workflows are still supported and repository workflows can live under `.warp/workflows/`.

Use this for:

- `SGSD: Start`
- `SGSD: Auto Mode`
- `SGSD: Cockpit Only`
- `SGSD: Token Summary`
- `SGSD: Full Preflight`
- Future `SGSD: Recovery Packet`
- Future `SGSD: Gate Status`
- Future `SGSD: Warp Doctor`

This is already started in this repo. It is the right first step because it gives Warp users searchable SGSD commands without changing Warp or SGSD internals.

### 2. Project Rules And Context

Warp supports project rules and can generate or link `WARP.md`. It can also use compatible rule files such as `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.clinerules`, `.windsurfrules`, and `.github/copilot-instructions.md`.

Use this for:

- A compact SGSD project guide in `WARP.md`.
- A tool-neutral `AGENTS.md` generated from SGSD's core instructions.
- Rules that tell Warp Agent not to duplicate SGSD's gates.
- Rules that explain where SGSD truth lives: `.planning/STATE.md`, `.planning/ROADMAP-AGENT.md`, `.planning/metrics/*.jsonl`, milestone phase folders, and the checkpoint.

The rule layer should be compact. It should link to the big HTML handbook rather than embedding it.

### 3. Local MCP For SGSD State

Warp local agents can use MCP servers. Warp can launch a CLI MCP server with a command, args, env, and an explicit working directory.

This is the highest-leverage missing piece.

Build:

```text
super-gsd/tools/warp-mcp/server.cjs
```

Expose read-only tools first:

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

Why MCP rather than terminal scraping:

- Warp Agent can ask direct questions.
- Status comes from structured SGSD files.
- It avoids long prompt stuffing.
- It lets the user ask "what is blocked?" from Warp's agent UI without searching panes.
- It keeps private VTP optional.

Hard rule: start read-only. Do not let Warp Agent mutate SGSD state until the status server is trusted.

### 4. Third-Party CLI Agent Support

Warp detects Claude Code, Codex CLI, Gemini CLI, Amp, Droid, and OpenCode. When it detects an agent session, Warp shows a utility bar with voice, image, file, and diff controls.

Use this for:

- Run `sg` from the current Warp terminal so Claude Code stays in the same terminal.
- Keep the cockpit in a separate window/pane.
- Let Warp show Claude/Codex utility bars naturally.
- Avoid hiding Claude behind nested launchers that make Warp fail to detect the agent.

SGSD boot should preserve this invariant:

```text
The main agent runs where the operator typed sg.
The cockpit opens separately.
```

### 5. Full Terminal Use

Warp Agent can attach to an active interactive terminal session, observe live output, and propose commands.

Use this for:

- Let Warp Agent monitor a running SGSD cockpit or long-running `sg -Go`.
- Ask Warp Agent to summarize the current terminal buffer.
- Ask Warp Agent to inspect a stuck preflight, dev server, Redis CLI, PowerShell profile, or test runner.
- Keep the human able to take over and hand back control.

This is useful for supervision. It should not replace SGSD's gates.

### 6. Planning And Task Lists

Warp has native structured plans, version history, reusable plan references, and task lists.

Use this for:

- Operator-facing plans: "How are we integrating Warp?"
- Design review of SGSD milestone batches before dispatch.
- Exporting Warp plans to Markdown and checking them into `.planning/analyses/` or `.planning/milestones/`.

Do not use Warp task lists as the SGSD source of truth. SGSD's source of truth remains `.planning`.

Good pattern:

```text
Warp Plan = human-visible design and review surface
SGSD Milestone/Phase = execution contract and audit trail
```

### 7. Code Review

Warp Interactive Code Review lets a user inspect agent-generated diffs, leave inline comments, and send a batch of feedback back to the agent.

Use this for:

- Human review of SGSD-generated patches.
- Faster correction of cockpit UI, scripts, and docs.
- Operator comments before commit.

Do not use this as a replacement for SGSD ATC, Codex review, verifier, or MUDA gates. It is a human UX improvement, not a formal gate.

### 8. Codebase Context

Warp can index Git-tracked local code and use it for agent context. Warp docs currently state Codebase Context does not work within SSH or WSL sessions.

This matters because the old SGSD Warp layout spec considered WSL/tmux. For this repo on Windows, keeping the main SGSD command in native Windows PowerShell inside Warp is likely better for Warp's codebase context and third-party agent detection.

Use WSL/tmux only where we actually need programmatic split panes or Linux-only tools.

### 9. Session Sharing

Warp can share live agent sessions to a web viewer, including agent prompts, responses, thinking indicators, planning steps, tool use, and credit usage.

Use this for:

- Remote monitoring from phone while SGSD auto mode runs.
- Sharing a live SGSD session if a collaborator needs to see what is happening.

This directly addresses the "I want to monitor it while out" workflow.

### 10. Launch Configurations

Warp launch configurations can save windows, tabs, and panes as YAML. They support split panes and are stored under `$HOME/.warp/launch_configurations/`. The `cwd` field must be an absolute path or the config may not appear.

Use this for:

- A saved SGSD workspace layout.
- A cockpit window layout.
- Multi-pane monitoring layouts.

Caveat: old local SGSD docs observed that Windows Warp did not offer a CLI-triggered current-window split API. The public roadmap now mentions future Warp CLI and tmux control mode. Until that lands, launch configs are a good "open a known workspace" solution, not a guaranteed "script panes into the current tab" solution.

## Best Architecture

```text
┌────────────────────────────────────────────────────────────────┐
│ Warp                                                           │
│                                                                │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │ Main terminal         │  │ Cockpit / monitoring panes      │  │
│  │ where user typed sg   │  │ SGSD1 / SGSD2 / Codex / gates   │  │
│  │                      │  │                                │  │
│  │ Claude Code detected │  │ tails structured SGSD ledgers   │  │
│  │ by Warp utility bar  │  │                                │  │
│  └──────────┬───────────┘  └──────────────┬─────────────────┘  │
│             │                             │                    │
│             │                             │                    │
│  ┌──────────▼─────────────────────────────▼─────────────────┐  │
│  │ Warp Agent                                               │  │
│  │ Uses rules + codebase context + local SGSD MCP tools      │  │
│  └──────────┬───────────────────────────────────────────────┘  │
└─────────────┼──────────────────────────────────────────────────┘
              │ MCP read-only tools
              ▼
┌────────────────────────────────────────────────────────────────┐
│ SGSD                                                           │
│                                                                │
│  .planning/STATE.md                                            │
│  .planning/ROADMAP-AGENT.md                                    │
│  .planning/ORCHESTRATOR-CHECKPOINT.md                          │
│  .planning/metrics/*.jsonl                                     │
│  .planning/milestones/**/{CONTEXT,RESEARCH,PLAN,ATC,WASTE}.md  │
│                                                                │
│  Orchestrator, gates, token ledgers, Codex reviews, MUDA        │
└────────────────────────────────────────────────────────────────┘
```

Key point: Warp should ask SGSD for structured state. It should not infer SGSD state from terminal text.

## Roadmap

### W0: Research And Smoke Test

Goal: verify today's Warp capabilities on this machine.

Tasks:

- Confirm repository workflows appear in Warp command/workflow search.
- Confirm `sg` starts Claude in the current Warp terminal.
- Confirm Warp detects Claude Code and Codex when launched through `sg` and direct commands.
- Confirm where Warp stores launch configs on this Windows install.
- Confirm whether current Windows Warp can open a saved launch configuration into the active window.
- Confirm Codebase Context is enabled for `C:\Users\jack.berrow\GSDedits`.

Acceptance:

- A short `W0-WARP-SMOKE.md` with screenshots or command evidence.
- Any divergence from docs recorded as a local caveat.

### W1: Warp Operator Pack

Goal: make SGSD pleasant to run from Warp without changing SGSD internals.

Tasks:

- Keep and polish `.warp/workflows/*.yaml`.
- Add missing workflows:
  - `SGSD: Recovery Packet`
  - `SGSD: Gate Status`
  - `SGSD: Watchdog Status`
  - `SGSD: Warp Doctor`
- Keep `WARP.md` compact and accurate.
- Add `AGENTS.md` for tool-neutral agent context.
- Add a `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` guide.

Acceptance:

- A new user can open Warp in the repo and find every SGSD daily command from Workflow Search.
- Warp Agent can answer "how do I run SGSD here?" from project rules without reading the HTML handbook.

### W2: Read-Only SGSD MCP

Goal: make Warp Agent able to answer live SGSD status questions.

Tasks:

- Implement `super-gsd/tools/warp-mcp/server.cjs`.
- Read stable files only:
  - `.planning/STATE.md`
  - `.planning/ROADMAP-AGENT.md`
  - `.planning/ORCHESTRATOR-CHECKPOINT.md`
  - `.planning/metrics/autopilot-watchdog.json`
  - `.planning/metrics/codex-live.json`
  - `.planning/metrics/token-attribution.jsonl`
  - `.planning/metrics/agent-token-spend.jsonl`
  - `.planning/metrics/orchestrator-pulse.jsonl`
- Add secret redaction before any output.
- Add a Warp MCP config snippet with explicit `working_directory`.
- Add unit/smoke tests with fixture ledgers.

Acceptance:

- In Warp Agent, the user can ask:
  - "What phase is SGSD on?"
  - "What is blocked?"
  - "What did Codex last review?"
  - "Where are tokens going?"
  - "What should I run to resume?"
- The MCP tools return concise, structured answers.
- No write actions exist yet.

### W3: Warp-Aware Boot And Cockpit

Goal: make SGSD boot smartly inside Warp.

Tasks:

- Add terminal detection to SGSD boot scripts.
- Emit boot facts into `.planning/metrics/boot-log.jsonl`.
- Keep Claude in the invoking terminal.
- Open cockpit separately by default.
- Add `sg -NoCockpit`, `sg -CockpitOnly`, or equivalent if not already stable.
- Add `sgsd-warp-doctor` to test profile, workflow, MCP, and path setup.

Acceptance:

- `sg` behaves correctly from Warp, Windows Terminal, VS Code terminal, and plain PowerShell.
- If Warp is detected, SGSD gives Warp-specific guidance.
- If the cockpit cannot open, failure text says what to fix.

### W4: Live Agent And Gate Visibility

Goal: solve the trust problem: "what is the model doing, what are we trying to complete, what is blocked, what agents were used, what did they do, what is Codex doing?"

Tasks:

- Add or standardize `.planning/ORCHESTRATOR-LIVE.jsonl`.
- Emit stable event types:
  - `phase_started`
  - `agent_dispatched`
  - `agent_progress`
  - `agent_completed`
  - `codex_review_started`
  - `codex_review_completed`
  - `gate_blocked`
  - `gate_passed`
  - `unlock_changed`
  - `operator_attention_required`
- Redesign cockpit panels around user questions:
  - Now: what is running?
  - Why: what does it unlock?
  - Blocked: what is stopping it?
  - Agents: who did what?
  - Codex: current review and last verdict.
  - Gates: current pass/fail/warn.
  - Tokens: where spend is going.
- Add an MCP tool that returns the same cockpit summary.

Acceptance:

- The cockpit can answer the core operator questions in one screen.
- Warp Agent can summarize the same state through MCP.
- No pane requires reading raw JSONL.

### W5: Warp Plans To SGSD Milestones

Goal: make Warp's native planning useful without making it the source of truth.

Tasks:

- Create a template for exporting Warp plans to `.planning/analyses/`.
- Add a converter/checklist that turns an approved Warp plan into draft SGSD milestone/phase scaffolding.
- Add a rule: "Warp plans are design surfaces; SGSD phases are execution contracts."
- Add a validation command that checks plan steps have corresponding phase IDs or explicit non-SGSD reasons.

Acceptance:

- A user can design in Warp Plan, export to Markdown, and convert into SGSD-ready milestones without retyping.
- SGSD still owns execution, gates, and evidence.

### W6: Session Sharing And Remote Monitoring

Goal: make long SGSD runs monitorable from phone or another machine.

Tasks:

- Write a guide for sharing the Warp session safely.
- Define what to share:
  - main SGSD terminal
  - cockpit window
  - code review panel when human review is needed
- Add a "remote monitor packet" workflow that prints:
  - current state
  - share checklist
  - what not to expose
  - recovery command

Acceptance:

- User can start `sg -Go`, share the session, leave the desk, and monitor meaningful progress remotely.

### W7: ACP Adapter Spike

Goal: prepare SGSD to become a native Warp agent once ACP client support lands.

Tasks:

- Track Warp issue #7326 and roadmap #9233.
- Map ACP concepts to SGSD:
  - session -> milestone/phase run
  - plan -> SGSD phase plan
  - tool call -> SGSD command/gate action
  - progress event -> orchestrator live event
  - permission request -> SGSD gate/operator hard stop
- Build a local prototype only if a stable ACP client path exists.
- Keep it optional.

Acceptance:

- A short ACP mapping spec exists.
- No production dependency on ACP until Warp support is available and tested.

### W8: Native Warp Client Contribution

Goal: upstream only the features that belong in Warp itself.

Candidate upstream ideas:

- Better support for wrapper commands like `sg` that launch known third-party agents.
- Long-running local agent telemetry panels.
- Local agent phase/progress vocabulary.
- First-class gate/review status chips.
- Saved "operator workspace" layout primitives.
- Tmux control mode improvements useful to SGSD.
- ACP test fixtures modeled on SGSD milestone/phase workflows.

Contribution process:

1. Search or file a GitHub issue.
2. Wait for readiness label.
3. For feature work, open a spec PR first under `specs/GH/.../product.md` and `tech.md`.
4. Only then implement.
5. Run Warp's bootstrap/run/presubmit flow.

Acceptance:

- SGSD does not carry a long-lived private Warp fork.
- Any upstream work follows Warp's public contribution process.

## What To Avoid

- Do not scrape terminal output as the primary integration.
- Do not make VTP mandatory for Warp users.
- Do not duplicate SGSD gates inside Warp Agent.
- Do not make Warp plans the source of truth for SGSD execution.
- Do not patch Warp internals before an accepted issue/spec path exists.
- Do not move the main Windows workflow into WSL if it breaks Warp Codebase Context or agent detection.
- Do not expose credentials, private KB paths, raw MCP logs, or unredacted metric values through shared sessions.

## Immediate Next Build Sequence

Recommended order:

1. W0 smoke test on this machine.
2. W1 polish the workflow pack and add `AGENTS.md`.
3. W2 build read-only SGSD MCP.
4. W4 redesign cockpit around operator questions.
5. W3 improve boot/cockpit launch once the MCP/cockpit state model is clear.
6. W5 bridge Warp Plans to SGSD phase scaffolding.
7. W6 document and test remote session monitoring.
8. W7/W8 only after Warp ACP/native contribution paths are stable.

This order avoids the main trap: building UI before SGSD has a clean state API. The state API is the center. Warp workflows, cockpit panels, MCP tools, and future ACP can all read the same truth.

## First Phase Candidates

These are ready to become SGSD phases:

### Phase W0-01: Warp Capability Smoke Test

Prove current Warp behavior on this machine. Output `W0-WARP-SMOKE.md`.

### Phase W1-01: Workflow Pack Finish

Add missing workflows and verify all YAML loads.

### Phase W1-02: Agent Context Pack

Create `AGENTS.md` and tighten `WARP.md`.

### Phase W2-01: SGSD MCP Contract

Write the read-only tool contract and fixture schema.

### Phase W2-02: SGSD MCP Implementation

Implement and test `super-gsd/tools/warp-mcp/server.cjs`.

### Phase W4-01: Operator Question Model

Define cockpit 2.0 information architecture around the user's actual questions.

### Phase W4-02: Orchestrator Live Event Contract

Standardize `.planning/ORCHESTRATOR-LIVE.jsonl`.

### Phase W4-03: Cockpit 2.0 Prototype

Build the new cockpit panels from the event contract.

### Phase W6-01: Remote Monitoring Playbook

Document and test Warp session sharing for long SGSD runs.

## Final Position

SGSD should become a first-class Warp resident before it tries to become part of Warp.

The practical unlock is not "fork Warp and build a native SGSD panel" yet. The practical unlock is:

```text
Warp can launch SGSD, understand SGSD, monitor SGSD, review SGSD changes,
share SGSD sessions, and ask SGSD structured status questions through MCP.
```

Once that works, an ACP adapter or native Warp client contribution will have a clear target instead of being speculative UI work.
