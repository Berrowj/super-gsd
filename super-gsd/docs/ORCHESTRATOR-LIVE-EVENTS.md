# Orchestrator Live Events Contract (v2.4)

`.planning/ORCHESTRATOR-LIVE.jsonl` is the canonical live event stream for the
SGSD orchestrator. Every dispatch / gate fire / checkpoint write / token
threshold crossing emits a row. Cockpit + MCP `sgsd_cockpit_snapshot` consume
the same stream.

**Schema version**: `1`
**Writer helper**: `super-gsd/scripts/lib/orchestrator-live-writer.cjs` (Phase 74)
**Reader**: cockpit-state adapter (Phase 76) + MCP tools (Phase 70/71 reuse)
**Wire-in points**: orchestrator skill (Phase 75 wires)

## Universal Event Envelope

```json
{
  "schema_version": 1,
  "ts": "<ISO 8601>",
  "type": "<one of 16 EVENT_TYPES>",
  "milestone": "v2.4",
  "phase": "74",
  "plan": "74-01",
  "data": { /* event-type-specific payload */ }
}
```

Events are append-only newline-delimited JSON. Never updated; never deleted.
Stream is part of the audit trail.

## 16 EVENT_TYPES (closed-vocab, frozen)

```
run_started
phase_started
plan_selected
agent_dispatched
agent_progress
agent_completed
codex_started
codex_completed
gate_started
gate_passed
gate_warned
gate_failed
token_threshold_crossed
checkpoint_written
operator_attention_required
run_completed
```

selfTest A1 verifies frozen + len=16.

## Per-Event Schemas

### `run_started`
```json
{ "type": "run_started", "data": { "mode": "auto" | "next" | "interactive", "user_command": "<verbatim>", "session_id": "<opaque>" } }
```

### `phase_started`
```json
{ "type": "phase_started", "data": { "phase": "74", "phase_name": "...", "milestone": "v2.4" } }
```

### `plan_selected`
```json
{ "type": "plan_selected", "data": { "plan_id": "74-01", "title": "...", "expected_atc_tier": "lite|full|gate" } }
```

### `agent_dispatched`
```json
{ "type": "agent_dispatched", "data": { "agent": "gsd-executor", "model": "sonnet", "task_id": "<opaque>", "purpose": "<one-liner>" } }
```

### `agent_progress`
```json
{ "type": "agent_progress", "data": { "task_id": "<opaque>", "current_action": "<description>", "files_touched": ["..."] } }
```
Optional. Long-running agents may emit periodic progress.

### `agent_completed`
```json
{ "type": "agent_completed", "data": { "task_id": "<opaque>", "agent": "gsd-executor", "outcome": "pass" | "fail" | "warn" | "blocker", "summary": "<one-liner from report>", "files_changed": [...] } }
```

### `codex_started`
```json
{ "type": "codex_started", "data": { "step": "6.5" | "9.5" | "9.6", "scope": "phase-level" | "per-dispatch" | "adversarial-verifier", "prompt_chars": 12345 } }
```

### `codex_completed`
```json
{ "type": "codex_completed", "data": { "verdict": "pass" | "warn" | "fail", "critical_count": 0, "warning_count": 0, "duration_ms": 0 } }
```

### `gate_started` / `gate_passed` / `gate_warned` / `gate_failed`
```json
{ "type": "gate_passed", "data": { "gate": "phase-level-ATC", "phase": "74", "verdict": "pass", "evidence_path": "...{NN}-ATC-REVIEW.md" } }
```
Outcome enum {pass, warn, block, skip} maps to type {gate_passed, gate_warned, gate_failed, gate_skipped} — wait, only 4 outcomes, only 4 types. `skip` doesn't get an event (silent skip).

### `token_threshold_crossed`
```json
{ "type": "token_threshold_crossed", "data": { "role": "executor" | "researcher" | ..., "threshold_kind": "soft" | "hard" | "cache_ratio_low", "actual_value": 12345, "threshold_value": 10000 } }
```

### `checkpoint_written`
```json
{ "type": "checkpoint_written", "data": { "path": ".planning/ORCHESTRATOR-CHECKPOINT.md", "next_unit": "<text>", "reason": "<text>" } }
```

### `operator_attention_required`
```json
{ "type": "operator_attention_required", "data": { "reason": "provider_unavailable" | "gate_failed_after_retries" | "credentials_needed" | "destructive_op_blocked" | "privacy_judgment_needed" | "no_activity" | "roadmap_complete", "context": "<text>" } }
```
7 attention reasons; v2.6 Phase 87 will enforce the closed-vocab list.

### `run_completed`
```json
{ "type": "run_completed", "data": { "outcome": "all_phases_complete" | "blocker" | "user_stop", "duration_seconds": 0 } }
```

## Stable Entity IDs

- `task_id`: opaque string (orchestrator generates; correlates dispatched + progress + completed events)
- `session_id`: opaque string per `/sgsd-orchestrate go` invocation
- `phase` / `plan_id` / `milestone`: always per active context

## Writer Helper

`super-gsd/scripts/lib/orchestrator-live-writer.cjs` exports:

- `appendEvent({type, data, milestone?, phase?, plan?, projectDir?})` -> `{ok: bool, error?: string}`
- `getEventTypes()` -> `EVENT_TYPES` (frozen)
- `selfTest()` -> `{ok, results:[]}`

Lock-13 wrapped: failure to write degrades silently (returns `{ok: false}`)
rather than throwing across the orchestrator boundary. Per Phase 75
acceptance: "event writing failure does not crash SGSD; it records degraded warning."

## Backward Compatibility

`ORCHESTRATOR-LIVE.jsonl` is ADDITIVE; existing `.planning/metrics/*.jsonl`
ledgers stay intact:

- `activity-log.jsonl` (Phase 26+) — pre-existing detail log; remains canonical for raw activity.
- `agent-token-spend.jsonl` (Phase 41) — token attribution; remains canonical.
- `codex-log.jsonl`, `codex-live.json` — Codex specific; remain canonical.
- `gate-value-log.jsonl` (Phase 36) — per-gate value; remains canonical.
- `orchestrator-pulse.jsonl` — heartbeat; remains canonical.

`ORCHESTRATOR-LIVE.jsonl` is the **unified** stream that combines what
cockpit + MCP need without duplicating these ledgers' content. Phase 75
writers write to BOTH legacy ledger AND live-events stream where applicable
(transition period).

## Schema Versioning Plan

Bumping `schema_version` to 2 requires:
- A successor phase explicitly authoring the migration.
- A `_v1_to_v2_migration` field in the per-event data block during transition.
- Cockpit + MCP readers extended to handle both versions.

Phase 74 locks `schema_version: 1`.

## Forward References

- Phase 75: writers wired into orchestrator at agent-dispatch / gate-fire / checkpoint-write / token-threshold points.
- Phase 76: cockpit-state adapter consumes ORCHESTRATOR-LIVE.jsonl + legacy ledgers via unified `_buildSnapshot()`.
- Phase 87 (v2.6): operator_attention_required reason vocab finalized.
- v2.8 ACP mapping: events 1-16 → ACP plan/progress/permission stream.
