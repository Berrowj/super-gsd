# Claude Handover - SGSD Warp Integration

Date: 2026-04-29
Project: C:\Users\user\GSDedits
Mission: begin the SGSD Warp Integration roadmap after completed v2.1.

## Current State

The previous SGSD roadmap is complete:

- v1.6 through v2.1 shipped.
- Phases 26 through 62 shipped.
- `.planning/STATE.md` currently reports `ROADMAP COMPLETE`.

This Warp work is a new roadmap, not a continuation of an active phase.

## Operator Intent

The operator wants to stop using Warp as "just a terminal" and fully use it as an Agentic Development Environment around SGSD.

The target system:

```text
Warp = native operator surface, agent UX, workflows, rules, skills, reviews, sharing
SGSD = autonomous orchestrator, gates, telemetry, memory, recovery, evidence
MCP = structured bridge between them
```

## Mandatory Reading Order

Read these before doing anything:

1. `C:\Users\user\GSDedits\.planning\analyses\2026-04-29-warp-ecosystem-atlas.md`
2. `C:\Users\user\GSDedits\.planning\analyses\2026-04-29-sgsd-warp-convergence-audit.md`
3. `C:\Users\user\GSDedits\.planning\analyses\2026-04-29-sgsd-warp-native-research-plan.md`
4. `C:\Users\user\GSDedits\.planning\analyses\2026-04-29-sgsd-warp-incorporation-plan.md`
5. `C:\Users\user\GSDedits\.planning\milestones\warp-integration\ROADMAP.md`
6. `C:\Users\user\GSDedits\WARP.md`
7. `C:\Users\user\GSDedits\docs\superpowers\specs\2026-04-11-sgsd-warp-layout-design.md`
8. `C:\Users\user\GSDedits\docs\reports\SGSD-Warp-Integration-ELI5.html`
9. `C:\Users\user\GSDedits\.planning\STATE.md`

## First Command Sequence

Do not immediately edit code.

Start with an audit:

```powershell
cd C:\Users\user\GSDedits
git status --short
Get-Content .planning\STATE.md -TotalCount 80
Get-ChildItem .warp\workflows -File | Sort-Object Name
Get-Command sg,sgsd -ErrorAction SilentlyContinue
```

Then begin proposed Phase 63 from:

```text
C:\Users\user\GSDedits\.planning\milestones\warp-integration\ROADMAP.md
```

## Hard Rules

1. Audit before building every phase.
2. Do not make Warp required for SGSD core.
3. Do not make VTP required.
4. Do not start by patching Warp source.
5. Do not duplicate existing SGSD features.
6. Start read-only before write-capable.
7. Preserve `sg`: Claude stays in the current terminal; cockpit opens separately.
8. Keep PowerShell compatibility.
9. Use `.planning` as durable truth.
10. Use Warp for operator UX, not SGSD state truth.
11. If remote/cloud Warp/Oz is considered, remember cloud agents cannot read uncommitted local files.
12. If starting a new roadmap from a completed roadmap, update `.planning\STATE.md` to the new active milestone/phase before or atomically with the first phase scaffold. Do not create new phase artifacts while canonical state still says `ROADMAP COMPLETE`.

## Execution Order

Recommended order:

1. v2.2 Phase 63 - Warp Capability Smoke Test.
2. v2.2 Phase 64 - Workflow Pack Completion.
3. v2.2 Phase 65 - Agent Rules Context Pack.
4. v2.2 Phase 66 - SGSD Warp Operator Guide.
5. v2.2 Phase 67 - Warp Doctor Probe Design.
6. v2.3 Phase 68 onward - Read-only SGSD MCP Bridge.

If time is short, prioritize v2.3 over UI polish. The read-only MCP bridge is the central unlock.

## Newly Discovered Lifecycle Requirement

During Phase 63 bootstrap, the cockpit appeared stale because `.planning\STATE.md`
still reported the previous v1.6-v2.1 roadmap as `ROADMAP COMPLETE` while new
v2.2 / Phase 63 artifacts already existed. The cockpit correctly trusted
`STATE.md`; the bug was the missing new-roadmap activation step.

Carry this forward:

- Phase 64 must define a new-roadmap activation command or workflow.
- Phase 67 `warp-doctor` / `sgsd-doctor` must detect this mismatch.
- Future orchestrator rules must activate `STATE.md` before creating the first
  phase artifacts of a new roadmap.
- Do not treat this as the operator-only; any user can hit it after finishing one
  roadmap and starting another.

## What To Build First

Phase 63 is evidence only. It should produce:

```text
C:\Users\user\GSDedits\.planning\milestones\v2.2\WARP-SMOKE.md
```

It must answer:

- Does Warp see the workflow pack?
- Does Warp detect Claude when launched directly?
- Does Warp detect Claude when launched through `sg`?
- Does `sg` keep Claude in the terminal where the operator typed it?
- Where are launch configs on this machine?
- Can launch configs open active-window layouts or only new windows?
- Is Codebase Context working for this repo?
- What breaks if we use WSL/tmux?

## What Not To Build First

Do not start with:

- Native Warp fork.
- ACP adapter.
- Oz cloud schedule.
- Full write-capable MCP.
- Complex pane automation.
- Replacing cockpit before the state contract is stable.

## The Key Architectural Bet

Build this bridge first:

```text
super-gsd/tools/warp-mcp/server.cjs
```

Read-only tools first:

- `sgsd_current_state`
- `sgsd_current_phase`
- `sgsd_gate_status`
- `sgsd_agent_roster`
- `sgsd_codex_status`
- `sgsd_token_spend`
- `sgsd_recovery_packet`
- `sgsd_cockpit_snapshot`

Once Warp Agent can ask SGSD for truth, every other UX layer becomes easier.

## Operator Questions The Final System Must Answer

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

## Completion Definition

The Warp integration roadmap is successful when:

- SGSD commands are searchable in Warp.
- Warp Agent understands SGSD through rules/skills.
- Warp Agent can query SGSD through MCP.
- Cockpit and MCP share one status model.
- Warp Code Review is part of the human review loop.
- Remote monitoring through Warp session sharing is documented and tested.
- SGSD still works in plain PowerShell.
- VTP remains optional.
- No native Warp fork is required for the baseline.
