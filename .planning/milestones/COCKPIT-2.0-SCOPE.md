---
status: proposed-scope
created: 2026-04-26
source:
  - .planning/milestones/v1.6-PROPOSED-REQUIREMENTS.md
  - .planning/milestones/VIO-ROADMAP-ENRICHMENT.md
  - VTP UX/book search
---

# Cockpit 2.0 Scope

Cockpit 2.0 is not a cosmetic repaint. It is an operator intelligence redesign
for the existing terminal cockpit.

## Current Surface

Current cockpit pieces:

- `super-gsd/scripts/sgsd-mission-control.ps1`
- `super-gsd/scripts/sgsd-narrative.ps1`
- `super-gsd/scripts/sgsd-codex-monitor.ps1`
- `super-gsd/scripts/sgsd-dashboard-host.ps1`
- `super-gsd/scripts/sgsd-boot.ps1`

Current signal already exists for progress, blockers, agents, gates, Codex,
cost, tokens, MCP state, live tool stream, and recent artifacts. The gap is not
"no data." The gap is that the information is still partly system-led instead
of operator-question-led.

## Design Principle

Answer the operator's questions first. Put raw telemetry second.

The cockpit should answer:

1. What is the model doing right now?
2. What are we trying to complete?
3. What does completing it unlock?
4. What is blocked or risky?
5. Which agents were used and what did each do?
6. What is Codex doing or what did Codex conclude?
7. What evidence/artifacts were produced?
8. What should happen next?

## VTP UX Sources Used

Books surfaced by the VTP MCP UX/GUI search:

- The Design of Everyday Things: cockpit is the system image.
- Don't Make Me Think: the first viewport should remove inference work.
- Writing Effective Use Cases: visible lanes should map to actor goals, success
  outcomes, failure alternatives, and repair paths.
- Software Architecture for Developers: use just enough live architecture view.
- A Philosophy of Software Design: keep the top layer small and hide detail.

VIO-derived rules:

- show workflow as a tree,
- hide detail until needed,
- validate one thin path before broadening,
- show enough current AI activity for a collaborator to help,
- classify context before acting.

Research guardrails:

- Shift-Up: executable guardrails beat narrative confidence.
- Skill-RAG: classify failure before retrying.
- HiveMind: expose provider contention and timeout state.
- ISO-Bench: link claims to artifacts.

## Proposed Cockpit Architecture

```text
+----------------------------------------------------------------------------+
| Mission Strip                                                              |
| Objective | Unlock | Blocker/Risk | Next Action | Freshness                |
+----------------------------------+-----------------------------------------+
| Objective Tree                   | Model Activity                          |
| Milestone                        | Current tool/command/file               |
|   Phase                          | Last meaningful model status            |
|     Objective                    | Latest artifact                         |
|       Gate/Agent/Artifact        | Recent live tool stream                 |
|       Blocker/Unlock             |                                         |
+----------------------------------+-----------------------------------------+
| Agents Used                      | Codex Review                            |
| Role | Task | Status | Artifact  | State | Scope | CRIT/WARN | Report      |
+----------------------------------+-----------------------------------------+
| Evidence / Diagnostics                                                     |
| Freshness, costs, tokens, MCP/private KB, commits, warnings, repair paths   |
+----------------------------------------------------------------------------+
```

This is a conceptual layout, not a mandate to use box drawing in PowerShell. The
implementation should fit the current terminal rendering style.

## Lane Contracts

### Mission Strip

Purpose: answer the most important questions without scanning.

Fields:

- current objective,
- unlock,
- blocker or risk,
- next action,
- freshness.

Empty states:

- `unavailable`: no readable state source,
- `stale`: source exists but is older than threshold,
- `waiting`: no active model/tool event,
- `blocked`: hard halt or unresolved critical,
- `reviewing`: Codex/ATC currently owns the next action.

### Objective Tree

Purpose: give the operator the shape of the work.

Target model:

```text
milestone_id
phase_id
objective_id
gate_id
agent_id
artifact_path
blocker_id
unlock_text
```

Only add this as a new state file if existing sources cannot answer it.

### Model Activity

Purpose: explain what Claude is doing now.

Sources:

- live Claude session JSONL,
- `sgsd-narrative.ps1` tool stream,
- cached Haiku narrative where available,
- latest activity log row.

Show:

- current tool or command,
- current file/path if known,
- last artifact,
- last meaningful model status.

### Agents Used

Purpose: show who helped and what they did.

Show:

- agent role/name,
- task,
- status,
- artifact/result,
- stale/missing state if unknown.

Do not show raw agent spam in the primary viewport.

### Codex Review

Purpose: make Codex legible.

Show:

- idle/running/timed-out/blocked/stale/complete,
- scope,
- report path,
- critical count,
- warning count,
- latest conclusion,
- current reviewer attention.

Codex timeout should be visible as a state, not repeated as generic event rows.

### Evidence / Diagnostics

Purpose: keep the cockpit trustworthy without overwhelming the operator.

Show:

- artifact links,
- gate warnings,
- token/cost health,
- MCP/private KB availability,
- commit/review status,
- repair commands,
- hidden raw counts or diagnostic detail only when useful.

## Data Sources First

Read these before adding new telemetry:

- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/milestones/**`
- `.planning/metrics/activity-log.jsonl`
- `.planning/metrics/codex-log.jsonl`
- `.planning/metrics/token-log.jsonl`
- `.planning/metrics/muda-log.jsonl`
- `.planning/metrics/edge-guard-log.jsonl`
- `.planning/metrics/readiness-log.jsonl`
- current Claude session JSONL files

New state is allowed only if it answers a named operator question that existing
sources cannot answer reliably.

## Acceptance Scenarios

Cockpit 2.0 should be verified in these scenarios:

- normal active SGSD work,
- blocked gate,
- Codex timed out,
- Codex completed with warnings,
- no private KB/VTP available,
- stale dashboard source,
- forced restart/resume,
- no active Claude tool event.

## Non-Goals

- Do not build a web dashboard in v1.6.
- Do not add always-on LLM summarization just to make the cockpit sound smart.
- Do not duplicate the narrative pane and Codex monitor inside Mission Control.
- Do not add new telemetry until existing sources have been audited.
- Do not make VTP required for normal cockpit use.

## Promotion Rule

Before code changes, Claude should produce:

```text
.planning/milestones/v1.6/phases/26-*/26-EXISTING-SURFACE-AUDIT.md
.planning/milestones/v1.6/phases/27-*/27-01-cockpit-data-contract-PLAN.md
.planning/milestones/v1.6/phases/28-*/28-01-mission-control-layout-PLAN.md
.planning/milestones/v1.6/phases/29-*/29-01-agent-codex-lanes-PLAN.md
.planning/milestones/v1.6/phases/30-*/30-VERIFICATION.md
```
