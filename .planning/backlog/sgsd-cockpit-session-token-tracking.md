---
id: BACKLOG-001
title: SGSD-Cockpit — show total session tokens + $-converted cost (not just per-model $)
raised: 2026-04-23
raised_during: /gsd-plan-phase 16 session
raised_by: operator
category: tooling / observability
priority: normal
---

# SGSD-Cockpit — Session Token + $ Aggregate

## Observed State (2026-04-23)

Cockpit header block currently reads (see attached screenshot):

```
DLB-04 [reg 19 agents] [sepl idle] [distill --] [g3 unrated]
HEARTBEAT: IDLE
INFERENCE: SLOW  jsonl frozen 1m 7s
UNATTENDED: no readiness manifest — run /gsd-readiness
ctx 132% (264k/200k)  Opus think:ON(2)
SGSD-V2: pulse — gate — tok +X+X@
v1.3 Codex Integration
[##########] 13/15 (87%)
v P13 Governance
left 2 phases 8 waves
O $0.54 H $2.72 H <$0.01 = $3.26
P running <$0.01
```

Issues:
- The `$0.54 H / $2.72 H` line gives per-model $ totals (Haiku-labelled but likely representing something else given both tagged H), but **no aggregate token count** for the session.
- Operator just watched a 118k-token planning run followed by a 177k-token run — neither was captured in the `tok +X+X@` gauge.
- `$3.26` total is the only session-$ signal. No breakdown of: *how many tokens did we actually burn?*

## Desired State

Cockpit should capture and display, for the current session AND any named session:

1. **Total tokens used** (input + output, broken down if easy)
2. **$ cost** (derived from tokens × per-model price, summed across models used)
3. **Per-model subtotals** (already shown) — keep

Display shape (rough):

```
tokens 441k (in 395k · out 46k) · $3.26   ← session total
  Opus    264k  $2.72
  Sonnet   92k  $0.54
  Haiku    85k  <$0.01
```

## Implementation Notes

### Data source
The Claude Code CLI emits per-turn usage metadata: `total_tokens`, `tool_uses`, `duration_ms` per tool call. Each Agent / Bash / Read tool return includes these. The cockpit is likely reading these from a log file (activity log? token log?) — need to identify where these are already persisted.

Candidate sources in the repo:
- `.planning/metrics/activity-log.jsonl` — possibly holds per-turn token counts
- `.planning/metrics/token-log.jsonl` — referenced in CLAUDE.md overlay ("Log all token usage to `.planning/metrics/token-log.jsonl`")
- `.planning/metrics/narrative.md` — the top-right "Narrative" pane shows Read/Write/Bash/Agent events with token figures for Agent calls; suggests the data is there

### Aggregation
Cockpit needs a per-session aggregator:
- Parse the jsonl source for current-session events
- Sum tokens by model
- Apply pricing table → $

### Pricing table

As of 2026-04 — keep this in a config file so it's updatable without re-deploying the cockpit:

| Model | Input $/MTok | Output $/MTok | Cache write $/MTok | Cache read $/MTok |
|---|---|---|---|---|
| Claude Opus 4.7 | ? | ? | ? | ? |
| Claude Sonnet 4.6 | ? | ? | ? | ? |
| Claude Haiku 4.5 | ? | ? | ? | ? |

(Values intentionally left as `?` — operator fills from Anthropic's pricing page at implementation time. Should pull from a JSON config, not hard-coded, because Anthropic updates these.)

### Session scope

Two interpretations of "session":
1. **Single `claude` invocation** — tokens since this specific process started.
2. **Named session** — tokens across all resumes of the same logical thread.

Operator framing suggests both. Implementation: track a `session_id` (maybe `YYYY-MM-DD-{slug}` or the current ORCHESTRATOR-CHECKPOINT slug) and aggregate by that key. Allow filtering by date range too.

## Constraints

- Must not add latency to the cockpit render loop — aggregation should run on log-tail, not full re-parse every tick.
- Must handle the existing `tok +X+X@` signal currently shown (likely a pulse indicator, not a count).
- Must not disturb the existing `$0.54 H / $2.72 O / <$0.01` per-model display — that's useful granularity; the aggregate is ADDITIVE, not a replacement.

## Risks

- Pricing-table drift: Anthropic changes prices → cockpit silently shows wrong $ until config updated. Mitigation: show `pricing_updated: YYYY-MM-DD` somewhere in the cockpit footer so operator sees when the $ calculation is based on stale prices.
- Missing usage data for some tool types: `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash` may not emit `total_tokens` (they're local operations). Only `Agent` and turn-level assistant responses emit tokens. The aggregator needs to sum assistant-response tokens + Agent-call tokens, not try to count every tool use.
- Double-counting: Agent calls nest — if a parent agent's `total_tokens` already includes its children's, don't re-add child token counts.

## Triggered From

Operator side note during `/gsd-plan-phase 16` — 2026-04-23. Quoted:

> "on a side note, i want the SGSD-cockpit to capture how many tokens this sessions or any session is using. You can see in the main coding browser we did 118k then 177k that wasn't captured in the cockpit it says we've spent 0.54 on opus and 2.72 on sonet. Instead i want total tokens spent, and then those tokens converted to $"

## Next Action

Triage via `/gsd-note promote` or `/gsd-add-backlog` to assign to a future milestone (v1.4 tooling?), or `/gsd-insert-phase` if urgent enough to slot into v1.3 alongside Phase 14/15/16.

Not tied to Phase 16 work — this is cockpit tooling, not the VTP enrichment primitive.
