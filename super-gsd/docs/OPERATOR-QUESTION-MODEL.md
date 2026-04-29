# Operator Question Model (Cockpit 2.0 / Warp)

The 12 canonical operator questions and how SGSD answers them. Each row maps
a question to its **primary** MCP tool (post-v2.3) and **source files**, plus
**composition mode** (MCP-only / cockpit-pane-only / both) and any **missing
fields** Phase 74 must add to `ORCHESTRATOR-LIVE.jsonl`.

## Questions → sources matrix

| # | Question | Primary MCP tool | Source files | Cockpit pane | Composition | Missing fields (Phase 74) |
|--:|---|---|---|---|---|---|
| 1 | What is the model doing? | `sgsd_current_state` + `sgsd_agent_roster` | STATE.md frontmatter + activity-log.jsonl | SGSD1 mission strip | both | `agent_progress` event with `current_action: "<description>"` |
| 2 | What are we trying to complete? | `sgsd_current_phase` + `sgsd_milestone_status` | STATE.md + `{milestone}_complete:` block + active phase folder | SGSD1 mission strip | both | none (existing source sufficient) |
| 3 | What does this unlock? | `sgsd_current_phase` (extended) | active phase {NN}-CONTEXT.md / {NN}-VERIFICATION.md `unlocks:` field | SGSD1 narrative | both | `phase_unlocks` field on phase frontmatter (semi-additive) |
| 4 | What is blocked? | `sgsd_recovery_packet` + `sgsd_current_state.milestone_status` | STATE.md + ORCHESTRATOR-CHECKPOINT.md | SGSD1 mission strip + SGSD3 codex/gates | both | `operator_attention_required` event type (Phase 74) |
| 5 | What agents were used? | `sgsd_agent_roster` | activity-log.jsonl filtered by phase | SGSD2 narrative + SGSD1 agent lane | MCP-only (cockpit reads same) | none |
| 6 | What did each agent do? | `sgsd_agent_roster.agents[*]` | activity-log.jsonl row text | SGSD2 narrative | both | `agent_completed.summary: "<one-liner>"` (Phase 74) |
| 7 | What is Codex doing? | `sgsd_codex_status` | codex-live.json + codex-log.jsonl | SGSD3 codex/gates pane | both | freshness rule already enforced; no missing fields |
| 8 | What gates ran? | `sgsd_gate_status` | gate-value-log.jsonl + review-ledger.jsonl | SGSD3 codex/gates pane | both | `gate_started` / `gate_passed` / `gate_warned` / `gate_failed` events (Phase 74) |
| 9 | What failed or warned? | `sgsd_gate_status.latest_per_gate` + `sgsd_recovery_packet` | gate-value-log + CRIT-BACKLOG.jsonl + WASTE.md | SGSD3 codex/gates | MCP-only | `gate_warned` distinct from `gate_failed` (Phase 74) |
| 10 | Where are tokens going? | `sgsd_token_spend` | token-attribution.jsonl + agent-token-spend.jsonl | SGSD1 token lane | both | `token_threshold_crossed` event (Phase 74) |
| 11 | What should I read? | `sgsd_artifact_links` | filesystem enumeration of phase folders | SGSD2 narrative bottom | MCP-only | none |
| 12 | What command resumes safely? | `sgsd_recovery_packet.resume_command` | ORCHESTRATOR-CHECKPOINT.md or STATE.md fallback | SGSD3 bottom strip | MCP-only | none |

## Missing fields summary (forwarded to Phase 74)

Phase 74 ships `.planning/ORCHESTRATOR-LIVE.jsonl` with these event types
(closed-vocab, frozen):

- `run_started`
- `phase_started`
- `plan_selected`
- `agent_dispatched`
- `agent_progress` ← carries `current_action: "<description>"` for Q1
- `agent_completed` ← carries `summary: "<one-liner>"` for Q6
- `codex_started`
- `codex_completed`
- `gate_started` ← Q8
- `gate_passed` ← Q8
- `gate_warned` ← Q8 + Q9
- `gate_failed` ← Q8 + Q9
- `token_threshold_crossed` ← Q10
- `checkpoint_written`
- `operator_attention_required` ← Q4
- `run_completed`

16 event types frozen.

## Composition decisions

**MCP-only** (5 questions: 5, 9, 11, 12, plus most of 7): operator's
primary entry point is Warp Agent / cockpit consumer; raw `.planning/`
file read is fallback for power users.

**Both** (7 questions: 1, 2, 3, 4, 6, 8, 10): cockpit pane shows
condensed live view; MCP tool returns full structured envelope; Phase 76
adapter composes from same upstream data.

**Cockpit-pane-only**: none (Phase 73 deliberately keeps MCP as the
canonical query interface; cockpit becomes a UI projection of MCP).

## Gaps to address in Phase 74-76

1. **`ORCHESTRATOR-LIVE.jsonl`** doesn't exist yet (Phase 74 ships).
2. **`agent_progress.current_action`** field not yet in activity-log
   (Phase 74 contract; Phase 75 wires writers).
3. **`agent_completed.summary`** field semi-present (executor reports
   have ONE_LINER) but not consistently captured (Phase 74 + 75).
4. **`gate_warned` vs `gate_failed` distinction** -- gate-value-log has
   `outcome` enum {pass, warn, block, skip} which maps cleanly; Phase 74
   formalizes the event type discrimination.
5. **`token_threshold_crossed` event** -- Phase 42 has BUDGETS frozen
   vocab; Phase 74 wires the threshold detection.
6. **`operator_attention_required` event** -- not consolidated; Phase 74
   ships the canonical type; Phase 87 v2.6 expands attention reasons.
7. **Cockpit-state adapter** (Phase 76) consumes the unified event
   stream + legacy ledgers; both cockpit and MCP read through it.

## Forward references

- Phase 74: ORCHESTRATOR-LIVE.jsonl schema + 16 event types frozen.
- Phase 75: writer integration into orchestrator dispatch points.
- Phase 76: cockpit-state adapter consumes events + legacy ledgers.
- Phase 77: Warp-native cockpit layout panes.
- Phase 87 (v2.6): attention reasons closed-vocab.
