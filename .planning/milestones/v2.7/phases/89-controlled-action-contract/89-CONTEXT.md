---
phase: 89
phase_name: Controlled Action Contract
milestone: v2.7
created: 2026-04-29
status: in-progress
deviation_from_standard: docs-only design phase (defines write-capable MCP contract; Phase 90 implements)
---

# Phase 89 -- CONTEXT

Define the write-capable MCP tool contract for v2.7. SEPARATE from v2.3 read-only contract — does NOT extend it.

## Locked Scope (D89.1-D89.5)

- D89.1: 4 permission tiers (TIER_OBSERVE / TIER_PREPARE / TIER_OPERATOR / TIER_ESCALATED) frozen.
- D89.2: 5 candidate actions documented with inputs/outputs/audit-log/approval requirements. 2 of 5 already covered by v2.3 read-only contract; 3 are net-new.
- D89.3: 5 BLOCKED actions enumerated as DENIED_FOREVER (sgsd_go / destructive_cleanup / git_reset / credential_write / milestone_close). Adding any requires explicit roadmap phase + deliberation.
- D89.4: Approval flow specified — prompt-and-wait JSON-RPC notification with 60s timeout default-deny.
- D89.5: Audit log schema at .planning/metrics/controlled-actions-log.jsonl (append-only).

## Outputs

- super-gsd/docs/SGSD-WARP-CONTROLLED-ACTION-CONTRACT.md (NEW)
- 5 Phase 89 standard artifacts

## Acceptance

1. Contract authored.
2. 4 tiers + 8 denial reasons + 5 BLOCKED enumerated as closed-vocab frozen lists.
3. Approval flow documented.
4. Audit log schema defined.
5. Implementation order Phase 90-93 cross-referenced.
