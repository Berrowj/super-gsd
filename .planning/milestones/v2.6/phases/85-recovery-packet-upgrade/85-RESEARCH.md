---
phase: 85
artifact: research
authored_by: orchestrator (Opus); code by gsd-executor (Sonnet) agentId a148a4e8b479fa2e2
---

# Phase 85 -- Research

## Sources
- Phase 70 _tool_sgsd_recovery_packet (the substrate)
- Phase 68 contract Tool 11 (target shape)

## Key decisions

### D1 -- Trim current_position to 5 fields
Original packet inlined FULL STATE.md frontmatter (~3 KB). 5-field summary keeps milestone / phase / phase_status + 200-char trims of last_activity + milestone_status. Operator who wants full text reads STATE.md directly.

### D2 -- why_stopped heuristic 3-tier
1. current_phase=complete + COMPLETE/SHIPPED in milestone_status -> "ROADMAP COMPLETE — nothing to resume"
2. ALL-PHASES-CLOSED in status -> "Milestone all phases closed — awaiting operator decision"
3. Extract clause after em-dash in milestone_status -> first 200 chars

### D3 -- artifact_links walks active phase folder
Resolves latest VERIFICATION + ATC-REVIEW paths. Roadmap-complete state references highest-numbered phase folder.

### D4 -- Watchdog tail capped at 3 inside packet
10-row default in sgsd_watchdog_status was ~1.5 KB; capped to 3 inside recovery packet to fit 4 KB envelope. Operators wanting more pulses call sgsd_watchdog_status directly.

## Live results

```
recovery_packet response size:  1818 bytes (was 3668; ceiling 4096) ✓
why_stopped on live STATE:      "ROADMAP COMPLETE -- nothing to resume" ✓
artifact_links populated:       latest_verification + latest_atc_review = phase 67 paths ✓
```

## CRITICAL FINDING — STATE.md staleness contamination

The packet reports "ROADMAP COMPLETE — nothing to resume" because STATE.md
says current_phase=complete (frozen at v2.2 close). Reality:
- STATE.md mtime: 2026-04-29 20:07
- Latest orchestrator-pulse: 2026-04-29 21:19 phase 85 (72 min later)
- 5 commits since STATE.md was last touched (Phases 81-85)

The recovery packet's correctness is contingent on STATE.md freshness.
This phase's verification cannot mark PASS clean — packet is correct
ONLY relative to its declared source-of-truth, but the source-of-truth
is stale. Phase 86 must add staleness detection/reconciliation.
