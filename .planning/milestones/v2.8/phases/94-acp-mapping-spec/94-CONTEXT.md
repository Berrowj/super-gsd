---
phase: 94
phase_name: ACP Mapping Spec
milestone: v2.8
created: 2026-04-29
status: in-progress
deviation_from_standard: docs phase
---

# Phase 94 -- CONTEXT

Map SGSD execution concepts to Agent Client Protocol (ACP) primitives.
Preparation for Phase 95 spike; preparation for native Warp client
contribution; preparation for v2.8+ enhancement.

## Locked Scope

- D94.1: SGSD-ACP-MAPPING-SPEC.md authored.
- D94.2: 7 ACP concepts mapped to SGSD analogs (session, plan, tool call, progress event, permission request, artifact, session_resume).
- D94.3: 11-row event-mapping table (ACP event names ↔ ORCHESTRATOR-LIVE.jsonl 16 types).
- D94.4: Phase 95 precondition documented (ACP unavailable → SKIPPED-WAITING-FOR-UPSTREAM).
- D94.5: Hard boundary: SGSD does NOT depend on ACP for v2.2-v2.7 correctness.

## Outputs
- super-gsd/docs/SGSD-ACP-MAPPING-SPEC.md
- 5 Phase 94 standard artifacts

## Acceptance
1. 7 ACP concepts mapped.
2. 11-row event mapping.
3. Phase 95 precondition documented.
4. Hard boundary explicit.
