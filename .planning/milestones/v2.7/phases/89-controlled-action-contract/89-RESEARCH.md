---
phase: 89
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 89 -- Research

## Sources

- v2.7 Phase 89 roadmap task list (5 candidate actions enumerated)
- v2.3 Phase 68 SGSD-WARP-MCP-CONTRACT.md (separation pattern)
- Phase 80 warp-plan-converter (sgsd_prepare_phase_scaffold target)
- Phase 42 token-waste check (sgsd_run_token_summary target)
- AGENTS.md hard rule 5 (no source mutations without a plan — controlled actions enforce via approval flow)

## Key decisions

### D1 — Separate server, not extension of v2.3

v2.3 read-only is trust foundation. Mixing write-capable tools muddies. v2.7 ships `super-gsd/tools/warp-mcp-actions/server.cjs` — distinct MCP server operators add to Warp config explicitly.

### D2 — 4-tier model with default-deny

TIER_OBSERVE (no approval) / TIER_PREPARE (draft writes only) / TIER_OPERATOR (.planning/metrics/* writes) / TIER_ESCALATED (runs SGSD commands). Every tier above OBSERVE requires approval. Timeout default deny.

### D3 — 5 BLOCKED actions never get implemented in v2.7

sgsd_go / destructive_cleanup / git_reset / credential_write / milestone_close. Adding any requires explicit roadmap phase + /sgsd-deliberate. Prevents scope creep.

### D4 — 2 of 5 candidates are already in v2.3

`sgsd_recovery_packet` and `sgsd_artifact_links` exist in v2.3 read-only. Phase 89 lists for completeness; Phase 90 only implements 3 net-new (preflight + token_summary + phase_scaffold).

### D5 — Audit log schema mandatory

Every controlled action emits to `.planning/metrics/controlled-actions-log.jsonl`. Operators audit via tail; cockpit may surface in v2.7+ patches.
