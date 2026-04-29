---
phase: 90
tier: full
provider: claude-orchestrator (in-session)
codex_review: SKIPPED -- codex_provider_unavailable; v2.6 codex_unavailable debt row applies
---

# Phase 90 -- ATC FULL (Claude-only)

## First Principles
Operator's expanded CONTEXT (D90.0 + D90.6) made the resolver mandatory before Phase 90 close. Without it, the read-side returns stale data even though Phase 86 detection probes flag the staleness. The detection-without-correction would have been observability theater. Phase 90-02 is the substantive correction. Justified.

## Delete
None — 90-01 ships 3 tools per Phase 89 contract; 90-02 ships 1 new tool (resolver) + 4 caller updates per priority-ordered evidence list. Each is load-bearing.

## Anti-Slop 10/10
1. Lock-13 on resolver public APIs.
2. Priority order honored mechanically (verified by self-test A2-A8).
3. projection_stale + stale_sources + conflicts surfaces drift to consumers.
4. Phase_name fidelity preserved (D3) — STATE.md curated names not corrupted when no drift.
5. v2.3 server SHA preserved across 90-01 (Lock-4).
6. ASCII-only.
7. READ-ONLY scan via banned-via-concat trick.
8. 14 resolver self-test assertions + extension to existing self-tests where wiring affected.
9. No new dependencies.
10. ONE thing per plan: 90-01 ships server; 90-02 ships resolver+wire-in. Single coherent units.

## Cross-Phase Sanity
- 90-01 contract matches Phase 89 verbatim (3 tools / 4 tiers / 5 DENIED_FOREVER / 8 denial reasons).
- 90-02 priority order: checkpoint → pulse → activity-log → phase folders → git → STATE.md legacy. Each source is a real .planning/* artifact.
- Resolver compatible with Phase 86 staleness probes (D86.2 freshness probes still PASS; resolver projection_stale aligns).
- Resolver compatible with Phase 74 ORCHESTRATOR-LIVE.jsonl (potential future source).
- next_unlock.from vocab extension respects A20 closed-vocab discipline.

## Operator override status

| D90.x | Status |
|---|---|
| D90.0 resolver shipped | YES |
| D90.1 separate server | YES |
| D90.2 3 tools | YES |
| D90.3 approval flow | YES |
| D90.4 audit log | YES |
| D90.5 self-test 15+ | YES (21/21) |
| D90.6 read-side wired | YES |

## Verdict: PASS

All 7 D90 acceptance items shipped. Phase 91 unblocked. Resolver is now the canonical truth source for milestone+phase across MCP read-side + cockpit + recovery packet.
