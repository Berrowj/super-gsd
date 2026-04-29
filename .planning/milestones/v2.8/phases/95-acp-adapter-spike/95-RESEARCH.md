---
phase: 95
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 95 -- Research

## Sources
- Warp issue #7326 (ACP) -- status: open as of 2026-04-29
- Warp May-June 2026 roadmap issue #9233 -- ACP listed in-progress, not shipped
- Phase 94 SGSD-ACP-MAPPING-SPEC.md (this milestone, commit 649898d)
- Operator brief Rule 8 (no Warp patching until upstream need proven)
- Roadmap acceptance line 1037: "If ACP unavailable, phase records
  SKIPPED-WAITING-FOR-UPSTREAM with evidence."

## Key decisions

### D1 -- Honor the SKIPPED branch
The roadmap explicitly designs for upstream unreadiness. Authoring a phantom
spike against an unshipped protocol would violate Rule 8 (no premature Warp
patching) and yield code that cannot be exercised.

### D2 -- Phase 94 spec is the durable artifact
The 7-concept mapping + 11-row event table ships in commit 649898d. When
Warp ACP lands, Phase 95's spike has a finished blueprint waiting. The spec
is concept-level, so version-specific ACP changes do not invalidate it.

### D3 -- No executor dispatch needed
Docs phase. Orchestrator authors all 5 artifacts. No double-agent routing
applies (Step 7.6 is for code-shipping executor work).

### D4 -- Hard boundary preserved
SGSD v2.2-v2.7 correctness is independent of ACP. Skipping Phase 95 does
not block v2.8 close; it is a recorded deferral with explicit re-entry
conditions (Warp ships ACP -> reopen as PASS-WITH-DEFERRED-0).
