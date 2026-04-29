---
phase: 74
artifact: research
created: 2026-04-29
authored_by: orchestrator (Opus)
---

# Phase 74 -- Research

## Source inputs

- Phase 73 OPERATOR-QUESTION-MODEL.md — 16 event types enumerated
- Convergence audit § Shared Vocabulary — recommended event names
- Phase 47 route-decisions.jsonl — JSONL append-only pattern source
- Phase 67 warp-doctor / Phase 69 warp-mcp — Lock-13 + frozen vocab pattern

## Key decisions

### D1 — synchronous appendFile

Phase 75 wire-in points are inside the orchestrator dispatch loop;
synchronous write semantics keep the event-emit boundary simple.
Async appendFile would require Promise plumbing through the
synchronous orchestrator skill. Synchronous appendFile is fast
(<1ms typical for <1KB row) and simplifies failure handling.

### D2 — additive, not replacement

Legacy ledgers (activity-log, agent-token-spend, codex-log,
gate-value-log, orchestrator-pulse) stay canonical for their domains.
ORCHESTRATOR-LIVE.jsonl is the unified stream cockpit + MCP read.
Phase 75 writers emit to BOTH legacy AND live during transition.

### D3 — schema version 1 frozen at contract level

Bumping requires successor phase + per-event _v1_to_v2 migration
field. Phase 74 locks the contract; Phase 75-76 build against it.

## Forward references

- Phase 75: writer wire-in at agent_dispatched / agent_completed /
  gate_started / gate_passed/warned/failed / codex_started /
  codex_completed / checkpoint_written / token_threshold_crossed /
  operator_attention_required / run_started / run_completed.
- Phase 76: cockpit-state adapter consumes both legacy + live stream.
- Phase 87 (v2.6): operator_attention_required reason vocab finalized.
