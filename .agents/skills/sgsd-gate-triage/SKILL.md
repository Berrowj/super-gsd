---
name: sgsd-gate-triage
description: |
  Explain a gate failure — read gate-value-log + review-ledger, surface the
  failing gate's evidence_path, suggest next repair path. NEVER bypass.
---

# Skill: SGSD Gate Triage

When a gate fails or warns, this skill helps the operator understand WHY
and what to do next. Strictly explanatory; never bypasses gates.

## Procedure

1. Call MCP `sgsd_gate_status` — fetch latest gate verdicts.
2. Identify the failing gate (verdict `warn` or `fail`).
3. Read the gate's `evidence_path` (typically `.planning/.../{NN}-ATC-REVIEW.md`).
4. Summarize the finding:
   - Critical findings (CRIT)
   - Warning findings (WARN)
   - Anti-slop checklist hits
5. Suggest next repair path:
   - In-loop fix (re-dispatch executor with fix scope)
   - Backlog (log to CRIT-BACKLOG.md, advance with degraded status)
   - Design adjustment (next-phase plan addresses)

## Hard rule (from AGENTS.md)

DO NOT recommend bypassing gates. AGENTS.md hard rule 2 forbids
re-implementing gate logic; same applies to bypassing it. If a gate
fails, the failure is real. Either fix the underlying issue or
honestly downgrade the phase status.

## Output template

```
GATE TRIAGE — <gate name> at phase <NN>
  Verdict:    <pass|warn|fail>
  Evidence:   <path>
  Critical:   <count>
  Warnings:   <count>
  Top finding: <one-liner>
Recommended action:
  <one of: in-loop fix / backlog / design adjustment>
Why:
  <2-line justification citing the evidence>
```

## Related

- AGENTS.md hard rule 2.
- super-gsd/registry/gates.yaml — gate definitions.
- v1.7 Phase 33 — repair_instruction contract (mandatory text on all 13 gates).
