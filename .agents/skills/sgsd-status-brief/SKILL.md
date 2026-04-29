---
name: sgsd-status-brief
description: |
  Compose a 5-line operator status brief from MCP tools — milestone /
  phase / blockers / token spend / next action. Read-only. No state mutation.
---

# Skill: SGSD Status Brief

Produce a tight 5-line status brief by composing 3-4 MCP tool calls.
Output format: monospace-friendly, suitable for Warp Agent prompt context.

## Procedure

1. Call MCP `sgsd_current_state` → milestone + phase + last_activity.
2. Call MCP `sgsd_watchdog_status` → watchdog_state + last_pulse_age.
3. Call MCP `sgsd_token_spend` → totals.
4. Call MCP `sgsd_recovery_packet` → resume_command.
5. Render:

```
SGSD Status Brief — <ISO ts>
  Milestone: <vX.Y>
  Phase:     <NN> <phase_name> (<status>)
  Watchdog:  <alive|stale|absent> (last pulse Ns ago)
  Tokens:    <total> across <N rows>
  Resume:    <resume_command>
```

## Failure modes

- Any sub-tool returns `_degraded: true` → render that line as `(unavailable: <error_code>)`.
- All sub-tools degraded → render single line `SGSD MCP unavailable; check warp-doctor`.
- Never throw; always emit a 5-line brief, even if mostly `(unavailable)`.

## Out of scope

- Modifying state.
- Running gates.
- Fetching phase artifacts (use `sgsd-cockpit-review` skill instead).

## Related

- `sgsd-warp-operator` skill — superset of this for general operations.
- MCP `sgsd_cockpit_snapshot` — fuller version returning all 10 sections.
