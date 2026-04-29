---
name: sgsd-warp-operator
description: |
  Run SGSD safely from Warp -- daily start, autonomous mode, recovery, off-machine
  monitoring. Calls existing workflows (SGSD: Start / SGSD: Recovery Packet /
  SGSD: Remote Monitor Packet) and MCP tools (sgsd_current_state /
  sgsd_recovery_packet). NEVER mutates SGSD state directly.
---

# Skill: SGSD Warp Operator

You are operating SGSD inside Warp. Your job is to run existing SGSD commands
and read state — NEVER invent state, NEVER bypass gates.

## Read state from these sources first

1. MCP tool `sgsd_current_state` (preferred)
2. Workflow `SGSD: Status` (Phase 64; reads STATE.md frontmatter)
3. Direct read of `.planning/STATE.md` frontmatter (offset 0, limit 30)

## Daily routines (from super-gsd/docs/SGSD-WARP-WORKFLOWS.md)

```
Start session:    SGSD: Start          (or `sg`)
Auto mode:        SGSD: Auto Mode      (or `sg -Go`)
Status check:     SGSD: Status         (cockpit-readable summary)
Token spend:      SGSD: Token Summary
Recovery:         SGSD: Recovery Packet
Doctor:           SGSD: Warp Doctor
Off-machine:      SGSD: Remote Monitor Packet
Self-test MCP:    SGSD: MCP Self-Test
```

## Hard rules (from AGENTS.md hard rules 1-5)

- Read state from `.planning/`, not from terminal scrollback or guesswork.
- Don't duplicate SGSD gates (ATC / verifier / MUDA / release-readiness all exist).
- VTP / private KB is OPTIONAL.
- Preserve `sg` topology — Claude stays in current terminal; cockpit opens separately.
- No source mutations without an active phase plan.

## Examples

**"What is SGSD doing right now?"** → call MCP `sgsd_current_state`; report milestone + phase + last_activity.

**"Is auto-mode stuck?"** → call MCP `sgsd_watchdog_status`; report watchdog_state + last_pulse_age_seconds.

**"How do I resume?"** → call MCP `sgsd_recovery_packet`; report `resume_command` (always `/sgsd-orchestrate go` unless checkpoint says otherwise).

**"What gates ran in this phase?"** → call MCP `sgsd_gate_status`; filter by current phase.

## What NOT to ask this skill

- Don't ask it to MODIFY STATE.md, run sgsd-complete-milestone, or commit changes — those are orchestrator-only operations.
- Don't ask it to override gate verdicts — gates are mechanical evidence.
- Don't ask it to bypass M1-M5 manual checks.

## Related

- `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` — full daily-life guide.
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` — 13 workflows.
- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` — 14 MCP tools.
- `AGENTS.md` — 5 hard rules.
