---
milestone: v1.6
status: active
created: 2026-04-26
purpose: Audit-first promotion gate per HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md.
---

# v1.6 Existing-Surface Audit

Cockpit + boot scripts already exist. v1.6 extends, does not rebuild.

## Cockpit scripts (current)

| Path | Lines | Owns |
|------|------:|------|
| `super-gsd/scripts/sgsd-mission-control.ps1` | 1649 | Milestone progress, phase progression, waves/tasks, blockers, SGSD-V2 pulse, Codex line, cost, agents, commits, MCP state |
| `super-gsd/scripts/sgsd-narrative.ps1` | 690 | Cached Haiku narrative, live Claude tool stream, session JSONL aggregation, Codex timeline rows |
| `super-gsd/scripts/sgsd-codex-monitor.ps1` | 620 | Codex state, verdict labels, prompt/report fields, operator brief, review progress |
| `super-gsd/scripts/sgsd-boot.ps1` | 903 | `-SkipPreflight`, `-NoOpen`, `-Claude`, `-Go`, `-Greet`, KB discovery, fallback corpus |
| `super-gsd/scripts/sgsd-dashboard-host.ps1` | 68 | Visible dashboard failure pane (red) when child dies |

## Existing telemetry (`.planning/metrics/`)

13 streams: activity-log, audit-log, codex-live, codex-log, deliberation-outcomes,
edge-guard-log, handoff-log, heartbeat, muda-log, narrative.md, plan-errors,
readiness-log, token-log. Plus the new (this session): crit-backlog.

## Eight Operator Questions → Current Coverage

| # | Question | Current source | Coverage |
|---|----------|----------------|----------|
| 1 | What is the model doing? | `sgsd-narrative.ps1` live stream + Claude session JSONL | partial — not in primary viewport |
| 2 | What are we trying to complete? | `STATE.md` + current phase folder | partial — implied, not labelled |
| 3 | What does completing it unlock? | implicit in phase deps | missing — no explicit unlock field |
| 4 | What is blocked or risky? | mission-control blockers row | partial — not pinned to top |
| 5 | Which agents and what did they do? | `agents.jsonl`, narrative tool stream | partial — flat list |
| 6 | Codex state? | `codex-monitor.ps1`, `codex-live.json`, `codex-log.jsonl` | implemented (separate pane) |
| 7 | What evidence/artifacts? | phase folders, log paths in narrative | partial — links scattered |
| 8 | What should happen next? | implicit | missing — no `next_action` field |

## Duplicate-risk hotspots

1. Telemetry — 13+ metric streams already exist. New cockpit state file allowed only if Q1-Q8 cannot be derived (DISCUSS Q27.1 = NO new state file).
2. Codex monitor — full Codex pane exists. Mission Strip summarizes/links, doesn't copy.
3. Boot scripts — verify, do not rewrite (Phase 30 verification scope).
4. Knowledge tiers — `sgsd-boot.ps1` already discovers VTP/KB.

## Keep / Extend / Add

- **Keep**: 5 cockpit scripts, 13 metric streams, boot+config scripts.
- **Extend**:
  - Mission strip across top of `sgsd-mission-control.ps1` answering Q1-Q4+Q8
  - Status vocabulary normalization (8 closed states per DISCUSS 26.1)
  - Freshness boundaries with no gap (per DISCUSS 26.2)
  - Phase-stamping in activity-logger (per DISCUSS 27.2)
- **Add**:
  - `super-gsd/scripts/lib/sgsd-mission-strip.ps1` (Phase 28 deliverable)
  - Optional `repair_command:` field per DISCUSS 26.3 (safety-allowlisted)

## Final phase names (after dedup)

- Phase 26: Cockpit Operator Question Contract (docs)
- Phase 27: Cockpit Data Source And Objective Tree Audit (docs + small schema)
- Phase 28: Mission Control 2.0 Layout (PowerShell edits)
- Phase 29: Agent And Codex Visibility Lanes (PowerShell edits)
- Phase 30: Startup Verification And Cockpit Acceptance (verification)

## Kill / Defer Conditions

- No web-dashboard work in v1.6
- No new always-on LLM summarization
- No new telemetry stream unless an unanswered Q1-Q8 demands it
- VTP/private-KB never required for normal cockpit operation
