---
phase: 94
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 94 -- Research

## Sources
- Warp issue #7326 (ACP — open as of 2026-04-29)
- Warp May-June 2026 roadmap issue #9233
- Phase 74 ORCHESTRATOR-LIVE.jsonl 16 event types
- Phase 71 sgsd_artifact_links MCP tool
- Phase 89 controlled-action contract (4-tier permission model)
- Phase 86 attention reasons 7-vocab
- Operator brief Rule 8 (no Warp patching until upstream need proven)

## Key decisions

### D1 — Map concepts not implementations
ACP versions evolve; concept-level mapping is durable. Phase 95 spike fills in version-specific details when upstream is ready.

### D2 — Phase 95 SKIPPED-WAITING-FOR-UPSTREAM until ACP available
Per roadmap acceptance: "If ACP unavailable, phase records SKIPPED-WAITING-FOR-UPSTREAM with evidence." Honest deferral.

### D3 — 11-row event mapping leverages Phase 74 contract
Phase 74's 16 EVENT_TYPES → 11 ACP event categories (some collapse: gate_started+passed+warned+failed → ACP gate_evaluated). Easy adapter at spike time.

### D4 — Hard boundary: ACP optional, never required
SGSD must remain functional without ACP. v2.2-v2.7 correctness is independent. ACP is v2.8+ enhancement when ready.
