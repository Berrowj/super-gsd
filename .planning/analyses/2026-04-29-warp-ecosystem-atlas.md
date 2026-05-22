# Warp Ecosystem Atlas For SGSD

Date: 2026-04-29
Project: C:\Users\user\GSDedits
Purpose: understand Warp deeply before deciding how SGSD should integrate with it.

## Executive Summary

Warp is no longer just a nicer PowerShell window. It is an Agentic Development Environment built out of five layers:

1. Terminal UX: blocks, modern input, command search, completions, panes, launch configurations.
2. Code UX: file tree, editor, code review, diff review, Git/worktree awareness.
3. Local agent UX: Warp Agent, third-party CLI agent wrapping, rules, skills, MCP, codebase context, full terminal use, task lists, plans, session sharing.
4. Knowledge/collaboration: Warp Drive, workflows, notebooks, prompts, environment variables, rules, MCP servers, shared/team context.
5. Cloud/Oz platform: cloud agents, schedules, triggers, environments, secrets, remote observability, web/mobile run monitoring.

For SGSD, the important discovery is this:

```text
Warp wraps agents by owning the surrounding experience:
input, context, permissions, plans, diffs, code review, sharing, and observability.

SGSD owns orchestration:
milestones, phases, gates, Codex review, MUDA, telemetry, memory, and recovery.
```

So the integration goal is not "replace SGSD with Warp" or "replace Warp Agent with SGSD". The goal is to make SGSD visible, controllable, and reviewable through Warp's native surfaces.

## Research Scope

Official Warp surfaces reviewed:

- Terminal and Universal Input.
- Blocks, command search, workflows, notebooks, Warp Drive.
- Rules, skills, slash commands, MCP, codebase context, web search.
- Agent profiles and permissions.
- Full Terminal Use and Computer Use.
- Third-party CLI agents.
- Interactive Code Review and Code Review panel.
- Session sharing and cloud-synced conversations.
- Oz cloud agents, skills-as-agents, environments, secrets, scheduled agents.
- Launch configurations.
- Open-source Warp client repository and public roadmap.

Local SGSD surfaces reviewed:

- Current `.warp/workflows/*.yaml` pack.
- `WARP.md`.
- Existing `docs/reports/SGSD-Warp-Integration-ELI5.html`.
- Older SGSD Warp layout design spec.
- Current `.planning/metrics/*` telemetry ledgers.
- Current roadmap-complete state after v2.1.

## Mental Model

### What Warp Is

Warp is a terminal-shaped ADE. Its center is still a terminal, but it adds:

- Structured command/output blocks.
- A rich input editor that can switch between commands and natural-language agent prompts.
- Native code review and file editing.
- A local agent conversation surface.
- A cloud agent orchestration layer through Oz.
- A shared knowledge layer through Warp Drive.
- A plugin-like external data/tool layer through MCP.
- Agent wrapping for third-party CLI agents like Claude Code and Codex.

### What Warp Is Not

Warp is not currently a public plugin host where we can simply register a new arbitrary local agent with the exact same first-party treatment as Claude Code or Codex.

The practical wrapping options today are:

1. Use Warp's native agent as a supervisor.
2. Let Warp detect supported third-party CLI agents.
3. Expose SGSD state and actions through MCP.
4. Encode SGSD behavior as Warp skills/rules/workflows.
5. Use Oz skills-as-agents and schedules where cloud execution is appropriate.
6. Wait for ACP support or contribute upstream when the issue/spec path is ready.

### What SGSD Should Become Inside Warp

SGSD should appear to Warp as:

- A set of workflows the operator can launch.
- A project rule/skill corpus agents can follow.
- A read-only MCP state server.
- Later, a controlled MCP command server.
- Later, an ACP-compatible agent or agent manager if Warp ships ACP client support.
- Later, possible native Warp UI contribution for long-running local orchestrators.

## Layer 1: Terminal UX

### Universal Input

Warp's Universal Input has three modes:

- Terminal Mode: commands.
- Agent Mode: natural language tasks.
- Auto-detection: Warp decides locally whether input is a command or prompt.

What makes this better than plain PowerShell:

- Multi-line editing feels closer to an IDE input.
- Shell commands and agent prompts live in one input surface.
- Context chips show useful repo/runtime status.
- The input toolbelt exposes context, slash commands, voice, images, profiles, and model selection.
- Natural language can become an agent task without opening another app.

SGSD opportunity:

- Use terminal mode for exact SGSD commands: `sg`, `sg -Go`, `sgsd`, token summaries.
- Use Agent Mode for questions about SGSD state once MCP exists.
- Avoid making SGSD boot open a separate Claude window by default; the main agent should stay in the Warp input/session that invoked `sg`.

### Blocks

Warp groups each command and output into a block.

Advantages over PowerShell:

- Copy a command or output as a unit.
- Scroll to command boundaries.
- Re-run or share command blocks.
- Attach blocks to agent prompts as context.
- Error blocks are visually distinct.

SGSD opportunity:

- Make SGSD commands produce clean block-sized outputs.
- Keep preflight, watchdog, token summary, and recovery packet outputs concise enough to attach to Warp Agent.
- Add block-friendly summary commands:
  - `sgsd status`
  - `sgsd recovery-packet`
  - `sgsd gates`
  - `sgsd tokens --current`
  - `sgsd warp-doctor`

### Command Search

Warp's command search spans command history, workflows, environment variables, notebooks, prompts, and agent conversation history.

Advantages over PowerShell:

- You can find saved commands without remembering exact aliases.
- Workflows become discoverable by name and description.
- The user can search `token`, `resume`, `cockpit`, `preflight`, or `go` instead of remembering a command.

SGSD opportunity:

- Give every SGSD workflow a clear searchable title.
- Include synonyms in workflow descriptions:
  - "resume"
  - "auto"
  - "cockpit"
  - "watchdog"
  - "token"
  - "blocked"
  - "recovery"
  - "preflight"

### Completions And Autosuggestions

Warp provides fuzzy completions and autosuggestions.

Advantages over PowerShell:

- More discoverable command entry.
- Shell aliases still benefit from completions.
- Suggestions can be accepted partially.

SGSD opportunity:

- Keep `sg` and `sgsd` aliases, but also add native completions later if practical.
- Provide stable flags:
  - `-Go`
  - `-NoOpen`
  - `-FullPreflight`
  - `-NoCockpit`
  - `-ProjectDir`
  - `-Warp`
  - `-Recovery`
  - `-TokenCurrent`

### Panes And Launch Configurations

Warp launch configurations can define windows, tabs, panes, cwd values, focus, colors, and startup commands. YAML files live in `$HOME/.warp/launch_configurations/`. The `cwd` must be absolute or empty.

Advantages over PowerShell:

- A repeatable workspace can open with the right panes and commands.
- Panes can be nested.
- Tabs can be titled and colored.
- Commands can run automatically per pane.

SGSD opportunity:

- A saved `SGSD Operator Workspace` launch config:
  - Main SGSD/Claude pane.
  - Mission Control.
  - Narrative stream.
  - Codex/Gates.
  - Token/cost pane.
  - Ad-hoc shell.
- A separate `SGSD Cockpit Only` launch config.
- A `Project Clarity + SGSD` launch config later.

Constraint:

- Existing SGSD docs observed Windows Warp did not expose a reliable current-window programmatic split API. Launch configs are Warp-native, but likely still palette/UI launched unless Warp CLI support matures. Treat this as a smoke-test item before relying on it.

### Terminal Editor And File Navigation

Warp's input/editor supports IDE-like text editing, file path opening, and file tree access.

Advantages over PowerShell:

- Less context switching to VS Code for small edits.
- File links from SGSD outputs can open in Warp.
- Clickable artifact paths make phase evidence easier to inspect.

SGSD opportunity:

- Print exact artifact paths in command outputs.
- Use clickable file references where possible.
- Keep SGSD reports under stable locations so Warp file search can find them.

## Layer 2: Code UX

### Built-In Code Editor

Warp has a built-in editor with syntax highlighting, tabs, file tree, find/replace, Vim keybindings, and LSP support for common languages.

How this helps SGSD:

- Small SGSD script/config changes can be inspected inside Warp.
- Agents can open files in context.
- Operator can quickly inspect `STATE.md`, `SUMMARY.md`, `WASTE.md`, or `ATC-REVIEW.md`.

Where it should not replace other tools:

- For larger refactors, VS Code or another IDE is still likely better.
- SGSD should not assume the editor is the only way to edit files.

### Code Review Panel

Warp's Code Review panel shows uncommitted Git diffs, lets the user inspect/edit/revert changes, and can attach diffs as agent context.

How this helps SGSD:

- After an SGSD phase, the operator can inspect all changes in one native panel.
- Human review becomes easier before commit or before accepting an agent's patch.
- Diffs can be attached to Warp Agent for questions like "summarize what changed".

Boundary:

- Warp Code Review is a human review surface.
- It should not replace SGSD Codex ATC, phase verifier, release readiness gates, MUDA, or status consistency checks.

### Interactive Code Review

Warp lets the user leave inline comments on agent-generated diffs and submit them back to the agent in one batch.

SGSD opportunity:

- Good for cockpit UI polish and docs edits.
- Good for reviewing generated wrappers, workflows, and small integrations.
- Could be used as a human-in-loop correction layer before SGSD phase closure.

Boundary:

- Treat it as operator feedback, not mechanical acceptance.
- SGSD gates still decide whether a phase closes.

### Git Worktree Awareness

Warp has Git-aware UI and worktree support.

SGSD opportunity:

- Future SGSD could launch parallel agent branches/worktrees and let Warp display them more naturally.
- SGSD can use worktrees for risky milestones without dirtying the main checkout.

Risk:

- SGSD's current state is `.planning`-centric and local. Worktree mode needs explicit path isolation so metrics and checkpoint files do not collide.

## Layer 3: Local Agent UX

### Warp Agent

Warp Agent is the built-in interactive agent surface. It can write code, debug, run commands, use saved context, use MCP, create plans, show task lists, and interact with terminals.

How this is better than PowerShell:

- Natural language is first-class.
- It has codebase context, rules, MCP, diffs, task lists, plans, and code review all in one app.
- It can supervise or assist terminal workflows rather than just run commands.

SGSD role:

- Warp Agent should be the human-facing assistant/supervisor for SGSD.
- SGSD should be the autonomous delivery engine.

Best use cases:

- "What is SGSD doing right now?"
- "What is blocked?"
- "Explain this phase in plain English."
- "Open the artifacts for the current gate failure."
- "Summarize token spend from the last phase."
- "Create a Warp plan for the next SGSD milestone, but do not edit files yet."

### Agent Conversations

Warp supports multiple conversations, follow-ups, forks, conversation history, and compaction/export slash commands.

SGSD opportunity:

- A conversation per milestone or incident.
- Fork a conversation when exploring alternative integration designs.
- Export important Warp conversations to `.planning/analyses/`.

Risk:

- Long agent conversations degrade. SGSD should not rely on Warp conversation memory as the canonical project memory.

### Slash Commands

Warp has built-in slash commands for actions like:

- Add MCP.
- Add prompt.
- Add rule.
- Start agent/cloud-agent conversation.
- Compact/export/fork conversations.
- Index current codebase.
- Generate AGENTS.md.
- Open code review.
- Open MCP servers.
- Open project rules.

SGSD opportunity:

- Teach users a short operator routine:
  - `/index` before big work.
  - `/open-code-review` after SGSD phase changes.
  - `/open-mcp-servers` to verify SGSD MCP.
  - `/init` only when bootstrapping new repos, then review the generated file.

Potential future:

- Warp skills can be invoked as slash commands. SGSD can define skills like:
  - `/sgsd-status`
  - `/sgsd-phase-brief`
  - `/sgsd-gate-triage`
  - `/sgsd-roadmap-to-phases`

### Rules

Warp supports global and project rules. Project rules live in `AGENTS.md` by default; `WARP.md` is still supported and takes priority if both exist in the same directory.

SGSD opportunity:

- Current `WARP.md` is useful but should be rationalized with future `AGENTS.md`.
- Project rules should tell Warp Agent:
  - SGSD owns execution state.
  - Do not invent phase status; read `.planning/STATE.md`.
  - Use SGSD MCP tools for live status once available.
  - Do not bypass SGSD gates.
  - VTP/private KB is optional.
  - Do not delete or reset `.planning/metrics/*`.

Best division:

- `AGENTS.md`: tool-neutral project rules.
- `WARP.md`: Warp-specific daily usage and workflows.
- `CLAUDE.md`: Claude Code orchestrator contract.

### Skills

Warp skills are markdown instruction sets with frontmatter. They can be project-level or global. Warp scans several directories, including `.agents/skills/`, `.warp/skills/`, `.claude/skills/`, `.codex/skills/`, and more. Skills can have supporting files and can be invoked directly with slash commands.

This answers the "can we wrap our own agents like they do in Warp?" question partially.

What we can do today:

- Package SGSD procedures as Warp skills.
- Make those skills discoverable in Warp's agent.
- Use skills locally and, through Oz, potentially as cloud agents.
- Store skill instructions in repo so they are versioned.

What we likely cannot do today:

- Add SGSD as a first-party third-party CLI agent with the same utility bar identity unless Warp's supported-agent detection/config supports it or we contribute upstream.
- Make Warp natively understand SGSD's internal sub-agent roster without a bridge.

Best SGSD skills to create:

- `sgsd-status`: inspect SGSD state through MCP/files.
- `sgsd-gate-triage`: explain gate failures and next repair path.
- `sgsd-roadmap-planner`: convert a high-level goal into SGSD milestone/phase candidates.
- `sgsd-warp-operator`: run SGSD workflows safely inside Warp.
- `sgsd-cockpit-review`: evaluate cockpit changes against operator questions.
- `sgsd-release-check`: review readiness before shipping an SGSD milestone.

### MCP

Warp local agents can connect to MCP servers. MCP servers act as modular plugins exposing tools or data sources. Warp can launch a CLI MCP server and shut it down on exit. It supports command-based servers and URL-based transports.

This is the most important SGSD integration surface.

SGSD should expose:

- Read-only status tools first.
- Controlled command tools later.
- Zero credential leakage.
- Stable JSON contracts.
- Degraded outputs if files are missing.

Why it matters:

- Warp Agent stops guessing from terminal scrollback.
- SGSD state becomes queryable.
- The cockpit and Warp Agent can share the same state vocabulary.
- Future ACP/native UI can reuse the state contract.

### Codebase Context

Warp indexes Git-tracked local codebases. It does not store code on Warp servers according to docs. It does not currently work inside SSH or WSL sessions.

SGSD opportunity:

- Keep primary SGSD operation in the Windows checkout, not WSL, if we want Warp Codebase Context.
- Use `.warpindexingignore` to exclude huge or noisy generated artifacts from indexing.
- Keep small, high-value docs indexed: `WARP.md`, `AGENTS.md`, `README.md`, key SGSD docs.

Suggested ignore candidates:

- `.planning/metrics/*.jsonl`
- very large reports
- generated cache files
- Redis/SQLite artifacts
- possibly old milestone artifacts if they swamp indexing

### Full Terminal Use

Warp Agent can attach to an active PTY, read live output, write input, and continue inside interactive terminal apps.

How this helps SGSD:

- Monitor a running `sg -Go`.
- Inspect live cockpit panes.
- Help debug a stuck dev server or test runner.
- Interact with shells, REPLs, CLIs, or dashboards.

Boundary:

- This is supervision and debugging. SGSD should not depend on Warp Agent to manually drive its normal auto-loop.

### Computer Use

Warp Computer Use is experimental and only available in sandboxed cloud environments, not local interactive terminal sessions.

SGSD opportunity:

- Later, for cloud validation of GUI/web workflows.
- Could help test cockpit HTML/browser artifacts in cloud if repo and environment are available.

Boundary:

- Not relevant to local Windows cockpit boot today.

### Web Search

Warp Agent can use native web search for supported models and cite sources.

SGSD opportunity:

- Warp Agent can verify current docs, versions, and APIs during planning.
- SGSD research phases can instruct Warp Agent to use web search when recency matters.

Boundary:

- SGSD's official research artifact still needs to record sources and decisions in `.planning`.

### Model Choice

Warp lets users select models or auto modes, including cost-efficient and deeper reasoning modes.

SGSD opportunity:

- Warp Agent can be used as the planning/research assistant with auto-genius or equivalent.
- SGSD can keep its provider routing separate for execution/review.

Boundary:

- SGSD provider contracts should not depend on Warp model names unless using Oz/cloud agents directly.

### Profiles And Permissions

Warp Agent profiles control base/planning models, autonomy, tool access, command permissions, MCP allow/deny behavior, and whether commands/diffs need approval. "Run until completion" can grant full autonomy for a task.

SGSD opportunity:

- Define recommended profiles:
  - `SGSD Observe`: read-only, can call status MCP, cannot write.
  - `SGSD Planner`: can read files and create plans, asks before edits.
  - `SGSD Operator`: can run SGSD read-only commands and preflight commands.
  - `SGSD YOLO Local`: only for trusted local automation; still do not bypass SGSD gates.

Risk:

- Warp's "Run until completion" can bypass denylist behavior for the current task. SGSD docs should warn users not to use this for destructive actions unless the SGSD phase contract is clear.

### Third-Party CLI Agents

Warp currently supports utility bar wrapping for Claude Code, Codex CLI, Amp, Gemini CLI, Droid, and OpenCode. It provides voice, image, file, and diff tools when it detects those agent sessions.

This is central.

What this means for SGSD:

- Running `claude` or `codex` directly inside Warp gets first-class utility UI.
- Running `sg` must preserve detection by keeping the main Claude session in the current Warp terminal.
- If `sg` hides Claude behind another process or opens a new shell, Warp may not detect the agent.

Can we wrap SGSD like Warp wraps Claude/Codex?

Current answer:

- Not fully through public docs alone.
- We can make SGSD wrap Claude/Codex in a way Warp still detects them.
- We can expose SGSD itself through workflows, skills, rules, MCP, launch configs, and later ACP.
- We can file/contribute upstream support for wrapper commands like `sg` if Warp's detection does not handle them.

### Active AI

Warp can proactively suggest prompts, next commands, and code diffs from recent command errors/output.

SGSD opportunity:

- Could help with manual debugging when a command fails.
- Could suggest follow-up commands after preflight errors.

Risk:

- Active AI suggestions may conflict with SGSD's intended recovery path.
- SGSD outputs should include explicit recovery commands to reduce bad suggestions.

## Layer 4: Knowledge And Collaboration

### Warp Drive

Warp Drive stores workflows, notebooks, prompts, environment variables, rules, and MCP servers. Agent Mode can use Warp Drive objects as context.

How this is better than PowerShell:

- Saved knowledge sits next to the terminal.
- Workflows and notebooks are searchable.
- Team sharing is possible.
- Agent can cite/derive from Warp Drive objects.

SGSD opportunity:

- Store SGSD operator notebooks.
- Store common workflows.
- Store prompt templates.
- Store environment variable references.
- Avoid putting secrets or raw private VTP content into shared Drive objects.

### Workflows

Workflows are named parameterized commands.

SGSD current state:

- Existing `.warp/workflows` files:
  - `sgsd-start.yaml`
  - `sgsd-auto.yaml`
  - `sgsd-cockpit.yaml`
  - `sgsd-token-current.yaml`
  - `sgsd-preflight.yaml`

Next workflows:

- `SGSD: Status`
- `SGSD: Recovery Packet`
- `SGSD: Gate Status`
- `SGSD: Watchdog Status`
- `SGSD: Codex Status`
- `SGSD: Current Phase Artifacts`
- `SGSD: Warp Doctor`
- `SGSD: Export Plan To SGSD`
- `SGSD: Open Current Milestone`

### Notebooks

Warp Notebooks are runnable documentation. Command blocks can be inserted into the terminal. Workflows can be embedded inside notebooks.

SGSD opportunity:

- "SGSD Flight Manual" notebook.
- "Recover a stuck auto-mode run" notebook.
- "Start a new SGSD project" notebook.
- "Run SGSD in Warp" notebook.
- "Troubleshoot Claude/Codex/VTP/Redis" notebook.

Best pattern:

- Keep source-of-truth docs in repo Markdown.
- Export/import to Warp Notebooks for operator convenience.

### Prompts

Warp Drive can store prompts.

SGSD opportunity:

- Prompt: "Explain current SGSD state using MCP."
- Prompt: "Review this SGSD phase plan against operator goals."
- Prompt: "Convert this Warp plan into draft SGSD phases."
- Prompt: "Triage this gate failure without making changes."

### Environment Variables

Warp Drive can store environment variables.

SGSD opportunity:

- Non-secret config:
  - `SGSD_PROJECT_DIR`
  - `SGSD_DEFAULT_MODE`
  - `SGSD_COCKPIT_MODE`
  - `SGSD_WARP=1`
- Secrets should remain in dedicated secret stores, not plain shared docs.

### Session Sharing

Warp can share sessions. Agent Session Sharing exposes agent prompts, responses, thinking indicators, tool use, planning steps, credits, and final responses in real time. Viewers can use the web viewer.

SGSD opportunity:

- Monitor long auto-mode sessions from phone.
- Share a live run for collaboration.
- Inspect an agent run remotely.

Risk:

- Secret redaction limitations matter.
- Shared sessions may expose command output, paths, and private repo data.
- Need a "safe share checklist".

## Layer 5: Cloud And Oz Platform

### Oz Cloud Agents

Oz is Warp's orchestration layer for cloud agents. It can run background agents from events, schedules, integrations, or manual starts. Runs have persistent task records and transcripts.

How this relates to SGSD:

- Oz is cloud orchestration.
- SGSD is local repo orchestration.
- They overlap conceptually but at different layers.

Potential SGSD uses:

- Scheduled docs audits.
- Scheduled dependency cleanup.
- Remote issue triage.
- Cloud research tasks against public repos.
- Parallel exploration across clean checkouts.

Boundary:

- SGSD local state, private VTP, Redis, and local Windows cockpit do not automatically exist in Oz cloud runs.
- Any Oz run needs repo-committed mission packets and environment setup.

### Skills As Agents

Warp skills can be run with local or cloud agents. This is the closest native "wrap our own agent behavior" model.

SGSD opportunity:

- Convert SGSD workflows into Warp skills.
- Use local skill invocation for operator assistance.
- Use cloud skill runs for safe, repo-committed, non-private tasks.

Important:

- A skill is instruction packaging, not a replacement for SGSD's orchestrator state machine.

### Scheduled Agents

Warp can schedule cloud agents with cron. Each run starts fresh and has its own task/session history.

SGSD opportunity:

- Nightly "SGSD repo health" audit.
- Weekly "docs drift" audit.
- Scheduled "new Warp docs changes" research.
- Scheduled "open-source Warp roadmap watch" report.

Boundary:

- Do not schedule local SGSD auto-mode through Oz unless environment/state migration is solved.
- Cloud schedules should open PRs or reports, not mutate local `.planning` unseen.

### Environments

Warp cloud environments define Docker image, repositories, setup commands, and runtime configuration.

SGSD opportunity:

- A future `sgsd-cloud-audit` environment could run read-only checks.
- Could verify installability in a clean container.

Boundary:

- Local Windows-specific boot/cockpit behavior cannot be fully tested in Linux cloud containers.

### Secrets

Warp has managed secrets for cloud agents.

SGSD opportunity:

- Use only for cloud tasks needing GitHub/Linear/etc.
- Keep private VTP/local KB credentials out of cloud by default.

Boundary:

- Cloud secrets are not readable after creation. Good for security, but SGSD plans must document what secret names are required.

### Oz Management And Web App

Warp cloud runs can be monitored in the Warp app or Oz web app, including mobile.

SGSD opportunity:

- For future cloud-side SGSD-adjacent jobs, this solves remote monitoring better than local-only terminal sharing.

Boundary:

- Local SGSD cockpit and local Claude Code are not automatically Oz tasks.

## Open Source Warp Client

Warp announced the client is open source on 2026-04-28. The public repo is `warpdotdev/warp`.

Important facts:

- Client code is public and AGPL licensed.
- Warp's public feature tracking now happens through GitHub issues.
- Contribution flow is issue/spec oriented.
- Roadmap includes future surfaces highly relevant to SGSD:
  - ACP client support.
  - Improved third-party agent support.
  - Conversation history.
  - Best-of-k.
  - Subagents.
  - Project/worktree primitives.
  - Remote coding support.
  - Warp CLI to control the app.
  - Tmux control mode.
  - Per-session/pane/tab/window theming.

SGSD implication:

- Do not fork first.
- Track issues and contribute specs where SGSD has a generalizable need.
- The right upstream asks are:
  - Wrapper command detection for tools like `sg`.
  - Long-running local agent/orchestrator telemetry.
  - Gate/status vocabulary for agent sessions.
  - Better ACP support and test fixtures.
  - Launch/workspace control through CLI.

## Feature Map

| Warp feature | What it gives | SGSD use | Priority |
|---|---|---|---|
| Universal Input | command + prompt entry | run `sg`, ask state questions | high |
| Blocks | structured command outputs | attach SGSD outputs to Agent | high |
| Command Search | searchable workflows/history | find SGSD commands | high |
| Workflows | saved parameterized commands | SGSD command pack | high |
| Rules | persistent agent guidance | SGSD operating rules | high |
| Skills | reusable agent procedures | SGSD operator skills | high |
| MCP | external tools/data | SGSD status/control API | highest |
| Codebase Context | local repo semantic context | explain SGSD code/docs | high |
| Third-party CLI agents | utility bar for Claude/Codex | keep main Claude in Warp | high |
| Code Review | diff inspection | human review of SGSD changes | high |
| Planning | rich editable plans | design before SGSD phases | medium-high |
| Task Lists | visible agent progress | operator view, not SGSD truth | medium |
| Full Terminal Use | interact with running tools | monitor/debug SGSD runs | medium-high |
| Session Sharing | remote monitor/collab | phone monitoring | medium-high |
| Launch Configs | saved panes/workspaces | SGSD cockpit workspace | medium-high |
| Warp Drive | knowledge objects | notebooks/prompts/workflows | medium |
| Notebooks | runnable docs | SGSD playbooks | medium |
| Active AI | proactive suggestions | debug failed SGSD commands | medium |
| Computer Use | cloud GUI testing | future remote browser validation | low-now |
| Cloud Agents | scheduled/triggered runs | future repo audits | medium-later |
| Environments | reproducible cloud runs | clean install audits | medium-later |
| Secrets | cloud credentials | future Oz integrations | low-now |
| Open-source client | upstream features | later native integration | later |
| ACP support | agent protocol | future SGSD native agent | later/high |

## PowerShell Vs Warp

### Plain PowerShell Is Better For

- Direct scripting.
- Predictable shell semantics.
- Running SGSD on machines without Warp.
- Minimal dependencies.
- Automation in CI.

### Warp Is Better For

- Long operator sessions.
- Seeing command boundaries.
- Searching reusable commands.
- Asking natural-language questions with repo context.
- Attaching files, blocks, images, URLs, and diffs as context.
- Reviewing code changes without switching tools.
- Using Claude/Codex utility bars.
- Sharing sessions for remote monitoring.
- Saving operator workflows and notebooks.
- Running local or cloud agents with profiles, permissions, and MCP.

### SGSD Design Consequence

SGSD must remain terminal-portable, but Warp should become the premium operator experience.

Do this:

```text
PowerShell compatibility = baseline.
Warp integration = best control room.
```

Do not do this:

```text
Warp-only SGSD core.
```

## What "Wrapping Our Own Agents" Means

There are five meanings, each with a different answer.

### 1. Wrap Claude/Codex Better Inside Warp

Yes, now.

SGSD should launch Claude/Codex in a way Warp detects. This preserves the third-party utility bar.

### 2. Wrap SGSD Procedures As Warp Skills

Yes, now.

Create `.agents/skills/sgsd-*` skills. Warp can discover and invoke them.

### 3. Wrap SGSD State As MCP Tools

Yes, now.

This is the most practical bridge. Warp Agent can call SGSD tools.

### 4. Wrap SGSD As A Cloud/Oz Agent

Partially, later.

SGSD can create skills and cloud environments for SGSD-adjacent tasks. But full local SGSD auto-mode depends on local state and private tools, so cloud runs need careful scoping.

### 5. Wrap SGSD As A Native Warp Agent

Not fully today through stable public docs.

Best route is ACP once Warp supports it, or an upstream contribution for wrapper-command detection / local orchestrator panels.

## Hard Limits And Unknowns

1. Public docs do not show a stable "register arbitrary third-party CLI agent" API equivalent to first-party detected tools.
2. Windows Warp current-window pane automation needs local smoke testing.
3. Codebase Context does not work in WSL/SSH, so WSL/tmux layouts trade away some Warp agent value.
4. Warp cloud/Oz runs do not have local private SGSD state unless committed/configured.
5. Session sharing can expose sensitive scrollback; redaction is not a complete safety net.
6. Warp's open-source client is AGPL; distribution of modified clients needs license care.
7. ACP support is tracked but not done.
8. Warp CLI app control is on roadmap but not available to depend on yet.

## High-Leverage Design Principles

1. Use Warp for operator UX, not SGSD truth.
2. Use SGSD for orchestration truth, not terminal cosmetics.
3. Make state structured before making UI richer.
4. Keep Claude/Codex visible to Warp's third-party agent wrapper.
5. Prefer MCP over scraping terminal output.
6. Prefer workflows/skills/rules before native client changes.
7. Preserve PowerShell compatibility.
8. Make cloud/Oz optional and explicit.
9. Keep private knowledge banks optional.
10. Upstream only generalizable Warp features.

## Atlas Conclusion

The best SGSD/Warp future is:

```text
Warp is the ADE cockpit.
SGSD is the autonomous delivery engine.
MCP is the truth bridge.
Skills are the operator playbooks.
Workflows are the buttons.
Rules are the guardrails.
Code Review is the human diff surface.
Session sharing is remote monitoring.
ACP/native Warp client work is the later first-class integration path.
```

This gives the user the feeling of a custom AI command center without building a brittle Warp fork.
