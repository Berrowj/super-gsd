---
phase: 95
phase_name: ACP Adapter Spike
milestone: v2.8
created: 2026-04-29
status: SKIPPED-WAITING-FOR-UPSTREAM
deviation_from_standard: docs phase (no executor dispatch — upstream gate)
---

# Phase 95 -- CONTEXT

Build a prototype ACP adapter ONLY if Warp/client support is testable.
Per roadmap acceptance: if ACP unavailable, record SKIPPED-WAITING-FOR-UPSTREAM
with evidence.

## Locked Scope

- D95.1: Verify Warp ACP support availability (issue #7326 status).
- D95.2: If unavailable, author SKIPPED record with citations.
- D95.3: Reference Phase 94 mapping spec as the precondition that IS ready.
- D95.4: Hard boundary: SGSD does NOT depend on ACP for v2.2-v2.7 correctness.

## Status: SKIPPED-WAITING-FOR-UPSTREAM

Evidence at 2026-04-29:
- Warp issue #7326 (ACP) remains open.
- Warp May-June 2026 roadmap issue #9233 lists ACP as in-progress, not shipped.
- No `acp` client surface available locally to smoke-test against.
- Mapping spec (Phase 94 / SGSD-ACP-MAPPING-SPEC.md) is ready to drive the
  spike when upstream lands.

## Outputs
- 5 Phase 95 standard artifacts (CONTEXT, PLAN, RESEARCH, VERIFICATION, ATC-REVIEW).
- No code shipped. No executor dispatch.

## Acceptance
1. Skip status authored honestly with explicit upstream evidence.
2. Phase 94 spec named as the precondition that unblocks future spike.
3. v2.2-v2.7 correctness explicitly preserved (no ACP dependency).
