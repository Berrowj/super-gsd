# SGSD + Warp Incorporation Plan

Date: 2026-04-29
Project: C:\Users\user\GSDedits

## Current Warp Facts

- Warp announced the client is open source on 2026-04-28.
- The public repository is https://github.com/warpdotdev/warp.
- The client app is AGPL v3. The `warpui_core` and `warpui` crates are MIT.
- Warp's server, Warp Drive backend, hosted auth, and Oz orchestration are not open source.
- Warp already detects third-party CLI agents including Claude Code, Codex, Gemini CLI, Amp, Droid, and OpenCode.
- Warp's May-June 2026 roadmap includes ACP client support, improved third-party agent support, conversation history, best-of-k, subagents, project/worktree primitives, and remote coding support.

## Best Mental Model

SGSD should not start as a Warp fork.

The lowest-risk path is:

```text
Warp = operator shell + visual ADE surface
Claude Code = local agent harness
SGSD = orchestration, gates, memory, telemetry, cockpit, and auto-loop
Codex = review/check provider
VTP/private KB = optional enrichment substrate
```

In other words, Warp should become the ergonomic shell around SGSD first.
Only after that is proven should SGSD attempt native Warp client changes.

## Integration Ladders

### Level 1: Warp Workflow Pack

Status: started in this repo.

Files:

- `.warp/workflows/sgsd-start.yaml`
- `.warp/workflows/sgsd-auto.yaml`
- `.warp/workflows/sgsd-cockpit.yaml`
- `.warp/workflows/sgsd-token-current.yaml`
- `.warp/workflows/sgsd-preflight.yaml`

What this gives:

- Searchable Warp commands for SGSD.
- No fork of Warp.
- No dependency on Warp internals.
- Works immediately because Warp supports repository-scoped YAML workflows.

Operator flow:

```powershell
cd C:\Users\user\GSDedits
# In Warp Command Search / Workflow Search:
# SGSD: Start
# SGSD: Auto Mode
# SGSD: Cockpit Only
# SGSD: Token Summary
# SGSD: Full Preflight
```

### Level 2: Warp-Friendly SGSD Runtime

Goal: make SGSD detect Warp and improve presentation without depending on Warp source.

Candidate work:

- Detect `$env:TERM_PROGRAM`, Warp-specific env vars, and Windows Terminal fallback.
- Prefer current tab for Claude and separate window/pane for cockpit.
- Emit OSC 777/agent-session notifications if Warp exposes stable hooks for local agents.
- Add `sg -Warp` only if detection is unreliable.
- Make cockpit panes degrade cleanly when Warp cannot open multiple panes itself.

Acceptance criteria:

- `sg` works the same from Warp, Windows Terminal, VS Code, and plain PowerShell.
- Warp users get searchable workflow commands.
- Claude remains in the Warp tab where the operator typed `sg`.
- Cockpit remains separate unless Warp exposes stable pane APIs.

### Level 3: Agent Context Interop

Goal: let Warp and SGSD share enough context that local agents feel first-class.

Candidate work:

- Generate `AGENTS.md` or Warp-readable context from `CLAUDE.md` + SGSD docs.
- Add a compact `WARP.md` for SGSD operators.
- Add a `/.warp/` docs surface that explains SGSD commands and daily boot.
- Map SGSD command envelopes to Warp-friendly summaries.
- Keep VTP/private KB optional and explicitly configured.

Acceptance criteria:

- Warp's built-in agent can explain the SGSD project without loading the full handbook.
- Claude Code, Codex, and Warp Agent all find the same project rules.
- No VTP-specific assumption blocks non-operator installs.

### Level 4: ACP Bridge

Goal: expose SGSD as an Agent Client Protocol-compatible agent or manager when Warp ships ACP client support.

Why this matters:

- Warp's FAQ says direct use of other model subscriptions in Warp's native agent harness is not open today.
- Warp's roadmap says ACP client support is committed.
- ACP is the cleanest route for SGSD to appear as a native local agent without reverse-engineering Warp internals.

Candidate work:

- Build `sgsd-acp-adapter` as a local Node or Rust process.
- Map ACP sessions to SGSD milestones/phases.
- Map ACP prompt turns to `/sgsd-triage`, `/sgsd-orchestrate next`, `/sgsd-orchestrate go`, and `/sgsd-token-audit`.
- Stream SGSD status from `.planning/metrics/*.jsonl`.
- Surface permission/gate requests as ACP plan/tool events.

Acceptance criteria:

- Warp can start an SGSD session as a local ACP agent.
- SGSD exposes plan, progress, blocked state, gates, and artifact links.
- The adapter is optional and does not break normal Claude Code operation.

### Level 5: Native Warp Client Contribution

Goal: contribute Warp client improvements that benefit SGSD and other long-running local agents.

Do this only through Warp's contribution model:

1. File or find a GitHub issue.
2. Wait for `ready-to-spec` or `ready-to-implement`.
3. For features, open a spec PR under `specs/GH*/product.md` and `specs/GH*/tech.md`.
4. Implement only after spec acceptance.
5. Run `./script/presubmit`.

Good SGSD-aligned issue/spec ideas:

- Long-running local agent dashboard panel.
- Local agent phase/progress API.
- Multi-pane cockpit layout primitive.
- Token/telemetry sidecar panel for CLI agents.
- Local-agent gate/review status vocabulary.
- Better third-party agent detection for wrapper commands like `sg`.
- ACP support test cases using SGSD-like milestone/phase workflows.

Do not start by patching Warp internals before issue/spec readiness. That would fight Warp's public contribution workflow.

## Recommended SGSD Roadmap

### Milestone W1: Warp Workflow Pack

Phase W1.1: Repository workflow files

- Add `.warp/workflows/*.yaml`.
- Validate commands appear in Warp Workflow Search.
- Verify `SGSD: Start` keeps Claude in the current Warp tab.

Phase W1.2: Windows path and profile validation

- Confirm `sg`, `sgsd`, and `sgsd-setup` are visible inside Warp's PowerShell.
- Add troubleshooting if Warp starts a different PowerShell profile.

Phase W1.3: Docs update

- Add Warp section to `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md`.
- Link workflow pack paths.

### Milestone W2: Warp-Aware Boot

Phase W2.1: Terminal detection

- Detect Warp vs Windows Terminal vs VS Code vs plain PowerShell.
- Emit a boot facts row into `.planning/metrics/boot-log.jsonl`.

Phase W2.2: Cockpit launch policy

- Keep Claude in current terminal.
- Open cockpit separately by default.
- Add optional no-new-window cockpit fallback for non-Windows platforms.

Phase W2.3: Failure UX

- If a cockpit pane exits, show actionable failure text.
- If Warp workflow cannot find `sg`, point to `. $PROFILE`.

### Milestone W3: Shared Agent Context

Phase W3.1: Generate `AGENTS.md`

- Derive compact multi-agent instructions from `CLAUDE.md`, `README.md`, and SGSD command docs.
- Keep it tool-neutral for Warp Agent, Codex, Claude Code, and future ACP clients.

Phase W3.2: Generate `WARP.md`

- Add SGSD-specific local engineering guide for Warp.
- Include boot commands, cockpit files, metrics ledgers, and current milestone lookup.

Phase W3.3: Context budget guard

- Keep generated context under a strict token budget.
- Cross-link to large HTML handbooks rather than embedding them.

### Milestone W4: ACP Feasibility Spike

Phase W4.1: ACP protocol audit

- Map ACP concepts to SGSD: session, prompt turn, plan, tool call, terminal, filesystem, slash command.

Phase W4.2: Minimal adapter prototype

- Implement read-only adapter first: status, plan, current phase, recent gates.

Phase W4.3: Write-capable adapter

- Add controlled commands: status, next, go, pause, token summary.
- Keep destructive operations behind SGSD gates.

### Milestone W5: Warp OSS Contribution Track

Phase W5.1: Issue scouting

- Track Warp issues for ACP, third-party agent support, project/worktree primitive, local telemetry panels.

Phase W5.2: Spec draft

- Draft product and tech specs for the best aligned issue.

Phase W5.3: Contribution

- Fork Warp.
- Build locally with `./script/bootstrap` and `./script/run`.
- Run `./script/presubmit`.
- Open PR only against a ready issue.

## First Practical Test

Open Warp in this repo and run:

```powershell
Get-Command sg
Get-Command sgsd
```

Then open Workflow Search and run:

```text
SGSD: Start
```

Expected result:

- SGSD cockpit opens separately.
- Claude starts in the current Warp tab.
- Warp detects Claude Code as a third-party CLI agent and shows its utility bar.
- Token monitoring continues through `.planning/metrics/token-attribution.jsonl`.

## Hard Boundary

Do not build against Warp's private surfaces:

- Oz is proprietary.
- Warp server is proprietary.
- Drive backend is proprietary.
- Hosted auth is proprietary.

Use:

- Repository workflows now.
- CLI agent detection now.
- Warp public client/spec contribution path for native changes.
- ACP bridge when Warp's ACP client support lands.
