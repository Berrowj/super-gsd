---
name: sgsd-release-check
description: |
  Check release readiness for the active milestone — call sgsd-complete-milestone
  gates dry-run, summarize release-readiness score, surface blockers before
  triggering the actual close. Read-only.
---

# Skill: SGSD Release Check

Pre-flight a milestone close. Reports whether `sgsd-complete-milestone`
would PASS today, and what blockers exist.

## Procedure

1. Call MCP `sgsd_current_state` — get active milestone.
2. Call MCP `sgsd_milestone_status` for that milestone — total / completed
   phases / shipped_status.
3. Call MCP `sgsd_gate_status` — verify all latest gates verdict in
   {pass, warn} (no `fail` on the close path).
4. Run release-readiness score (read-only):
   ```
   node super-gsd/tools/release-readiness/score.cjs --milestone <vX.Y>
   ```
5. Read `.planning/metrics/crit-backlog.jsonl` — count rows tagged to
   the active milestone's phases. `edge_guard_miss` rows = hard blocker.
6. Summarize:
   - Score (0-100)
   - Color (GREEN / AMBER / RED)
   - Blockers (edge_guard_miss count)
   - Phases-with-debt (PASS-WITH-DEFERRED-N rows)

## Hard rule (CLAUDE.md / orchestrate skill)

DO NOT trigger sgsd-complete-milestone yourself. This skill REPORTS
readiness; the operator decides whether to close.

## Output template

```
RELEASE CHECK — milestone <vX.Y>
  Phases: <completed>/<total>
  Score:  <N>/100 (<color>)
  Blockers:
    edge_guard_miss: <count>  (hard blocker if > 0)
    crit_open:       <count>
  Phases-with-debt:
    <phase NN>: PASS-WITH-DEFERRED-<N> (<reason>)
Recommended action:
  <one of: ready-to-ship / fix-edge-guard-miss / accept-debt-and-ship-with-N>
```

## Related

- v2.0 Phase 57 — release-readiness/score.cjs (8-bucket scorer).
- v2.0 Phase 53 — failure-injection harness (10 scenarios).
- ROADMAP-AGENT.md — End-of-Run Acceptance.
