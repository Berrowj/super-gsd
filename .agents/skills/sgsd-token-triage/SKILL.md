---
name: sgsd-token-triage
description: |
  Investigate token spend — read sgsd_token_spend grouped by role/phase/provider,
  surface anomalies vs budgets, suggest where to compress.
---

# Skill: SGSD Token Triage

Investigate where tokens are going and whether spend matches Phase 42 budgets.

## Procedure

1. Call MCP `sgsd_token_spend` with `scope: "current"` and `group_by: "role"` — top consumers per role.
2. Call MCP `sgsd_token_spend` with `group_by: "phase"` — per-phase distribution.
3. Call MCP `sgsd_token_spend` with `group_by: "provider"` — Claude vs Codex split.
4. Compare against Phase 42 BUDGETS frozen vocab (per-role thresholds).
5. Flag anomalies:
   - Role exceeded budget by >2x
   - Cache-read ratio <40%
   - Provider skew (e.g., Claude doing what Codex should)
6. Recommend compression:
   - Tighten executor prompts
   - Migrate Claude work to Codex (or vice versa)
   - Trim research-phase scope

## Hard rule

DO NOT recommend bypassing the Phase 42 token-waste check. Budgets are
warning gates; they degrade phase status (PASS-WITH-DEFERRED-N) but
don't halt autonomy.

## Output template

```
TOKEN TRIAGE — milestone <vX.Y> phase <NN>
  Total: <count> across <N> roles
  Top consumer (role): <role> (<count>, <pct>%)
  Top consumer (phase): <phase> (<count>, <pct>%)
  Provider split: claude=<count> codex=<count> ratio=<X.Y>
Anomalies:
  - <anomaly 1>
  - <anomaly 2>
Recommended action:
  <one of: tighten X prompts / migrate Y to provider Z / scope-trim research>
```

## Related

- v1.9 Phase 41 — token-attribution baseline.
- v1.9 Phase 42 — BUDGETS frozen vocab.
- super-gsd/tools/token-attribution/collect.cjs — raw collector.
