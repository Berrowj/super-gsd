---
type: deliberation-rescore
dlb_id: DLB-01
original_brief: .planning/briefs/2026-04-19-memory-topology.md
original_vote: "3-1"
original_decision: SUPPORT
rescored:
  members:
    - role: architect
      position: SUPPORT
      confidence: 4
      rationale_summary: Stable shell-wrapper interface preserved the upgrade path without premature MCP overhead.
    - role: pragmatist
      position: OPPOSE
      confidence: 3
      rationale_summary: Cross-project reuse stayed cheaper short term, but added external coupling.
    - role: contrarian
      position: SUPPORT
      confidence: 5
      rationale_summary: BM25 and MCP were unjustified at the observed corpus size.
    - role: moonshot
      position: SUPPORT
      confidence: 4
      rationale_summary: Git-native memory plus delayed infrastructure matched the evidence-first principle.
  signed_sum: 10
  new_decision: SUPPORT
diverges_from_original: false
---

# DLB-01 Rescore

Signed-sum preserves the original SUPPORT outcome.
