---
name: sgsd-cockpit-review
description: |
  Review SGSD cockpit + adapter snapshot for completeness — verify all 10
  sections render, flag empty sections, surface section-degraded paths.
  Read-only.
---

# Skill: SGSD Cockpit Review

Verify the cockpit snapshot is healthy and answer "is the cockpit telling
me everything?"

## Procedure

1. Call MCP `sgsd_cockpit_snapshot` (Phase 71/76 unified adapter).
2. Verify all 10 sections present: now / objective / unlock / blockers /
   agents / codex / gates / tokens / artifacts / resume_command.
3. For each section:
   - PRESENT + non-empty data → OK
   - PRESENT + empty data → "(empty)" — verify whether expected
   - `_section_degraded: true` → flag; report `error_code`
4. Cross-check key fields:
   - objective.milestone matches MCP `sgsd_current_state.milestone`
   - codex.live_state in {absent / stale / running / idle / complete}
   - gates.latest_per_gate has at least one row if any phase has closed in last 24h
5. Report any drift between adapter output and direct .planning/ reads.

## Output template

```
COCKPIT REVIEW — <ISO ts>
  10 sections:
    now: <status>
    objective: <status>
    unlock: <status>
    blockers: <status>
    agents: <status>
    codex: <status>
    gates: <status>
    tokens: <status>
    artifacts: <status>
    resume_command: <status>

  Status legend: OK | (empty) | DEGRADED:<error_code>

Cross-check:
  objective.milestone vs current_state.milestone: <MATCH|MISMATCH>
  codex.live_state: <enum value> (valid|invalid)
  gates.latest_per_gate: <count> rows

Recommendations:
  - <bullet>
```

## Hard rule

DO NOT modify the adapter or any section data. This skill is purely diagnostic.

## Related

- v2.4 Phase 76 — cockpit-state adapter (the data source).
- v2.4 Phase 73 — operator question model (10 sections rationale).
- super-gsd/scripts/lib/render-cockpit-snapshot.ps1 — Warp PowerShell renderer.
