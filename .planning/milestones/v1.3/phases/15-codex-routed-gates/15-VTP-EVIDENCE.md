# Phase 15 — VTP Evidence

**Status:** REAL (replaces prior BYPASS stub from 2026-04-24 stale-MCP incident)
**Generated:** 2026-04-24 by `/sgsd-orchestrate go` after vtp-kb restart + root-resolution fix verified
**Query frame:** `qf_08971fd9c2` | **Retrieval plan:** `rp_7ecb93164e` | **Decision matrix:** `wdm_7ecb93164e`

## Selected Query (preserved for replay / audit)

> Phase 15 wires Codex-CLI reviewer provider into the per-dispatch + phase-level ATC gates (Step 6.5 and 9.5), adds a qualitative MUDA probe shelling to Codex as the 4th audit probe, extends token-log with a provider field, routes the adversarial verifier challenger always to Codex when firing, and defines a milestone-close kill condition that disables codex_enabled if critical-count-delta and claude-tokens-saved fall below thresholds. What prior design evidence, kill-condition precedents, provider-indirection patterns, MUDA qualitative-probe precedents, and dual-vendor review patterns exist that inform CODEX-07 through CODEX-12?

**Interpreted goal:** architecture_reasoning | **Retrieval mode:** architecture_hybrid | **Answer shape:** architecture_proposal | **Confidence:** 0.59

## Evidence Bundle — 4 Citable Documents

### doc:6b62b76ceab5 — Autogenesis: A Self-Evolving Agent Protocol
**Relevance: HIGH.** Protocol-level pattern for provider indirection + kill-condition that directly parallels Phase 15's architecture. Citable principles (8):

- **AGP-P-02** — *"Treat all system components as first-class, versioned resources"* → direct precedent for `review-providers.yaml` registry treating reviewers as versioned, protocol-registered resources (CODEX-07).
- **AGP-P-03** — *"Implement closed-loop improvement with auditable lineage"* → precedent for `token-log.jsonl` with `provider` field + `commit-reviews.jsonl` + divergence trend log (CODEX-10 + W-5).
- **AGP-P-04** — *"Make evolution safe through versioning and rollback"* → direct precedent for `codex_enabled: false` kill switch + single-retry fallback-to-Claude pattern (CODEX-07 + CODEX-12).
- **AGP-P-05** — *"Use protocol-level resource registration to enable discovery and retrieval"* → precedent for `gates.yaml` `reviewer_provider:` field pointing at registry (CODEX-07's `invocation_type` discriminator).
- **AGP-P-07** — *"Make lifecycle management explicit in the protocol"* → precedent for `sgsd-token-audit --milestone-close-check` as an explicit lifecycle event that triggers the kill condition (CODEX-12).
- **AGP-P-08** — *"Separate resource management from core agent reasoning"* → justifies why the registry lives in `providers-registry.cjs` separate from the orchestrator, addressing W-1 semantic gap (shape detection belongs to the registry, not the caller).

### doc:70a3d5757b6a — Shift-Up: A Framework for SE Guardrails in AI-native Development
**Relevance: MEDIUM-HIGH.** Empirical precedent for **dual-vendor review patterns**. The Shift-Up paper describes a workflow using Claude Sonnet 4.5 for the first 4 phases (architectural grounding) and GPT-5.0 Codex for the last 3 (implementation), with acceptance-test validation between them. This is the closest published precedent for CODEX-07's reviewer-vendor routing and CODEX-11's always-Codex adversarial challenger. Key citable fact: *"The first four phases were done utilizing Claude Sonnet 4.5 while the last three were completed using GPT-5.0-Codex."* Validates the dual-vendor approach at workflow granularity; Phase 15 tightens it to gate-granularity.

### doc:5a50cc9b459e — HiveMind: OS-Inspired Scheduling for Concurrent LLM Agent Workloads
**Relevance: MEDIUM.** Precedent for **centralized retry vs per-agent retry** — directly relevant to CODEX-07's single-retry fallback semantics. Citable finding: *"When 10 agents each independently retry after a 429 error, the retries arrive simultaneously—the 'thundering herd'—re-triggering the rate limit. HiveMind's centralised retry serialises retries through the admission gate, preventing amplification."* Phase 15's single-retry cap at the orchestrator (not per-dispatch) is the right shape per this precedent. Also provides the `GATE_PROVIDER_FALLBACK` logging pattern rationale — one retry, centrally logged, no cascading.

### doc:473cb68960a5 — DW-Bench: Benchmarking LLMs on Data Warehouse Graph Topology Reasoning
**Relevance: LOW.** Surfaced via lexical score on "benchmarking/evaluation" terms but not topically aligned to provider-indirection, kill conditions, or MUDA. **Cited for disclosure only — do not use as primary evidence.**

## Reflection Verdict (VTP self-assessment)

**verdict:** `too_generic` (confidence 0.57)
**issue:** *"Retrieved results have weak lexical/concept overlap with the selected retrieval query."*

**Interpretation:** The KB does not contain prior work specifically about multi-vendor LLM-reviewer registries with milestone-close kill conditions, qualitative waste probes shelled to a secondary LLM, or claude-vs-codex token-savings accounting. The AGP protocol principles transfer well *at the architectural-pattern layer*, but the operational specifics (codex-exec.sh + JSONL dashboards + divergence logs) are genuinely novel work for this phase.

**Consequence for planning:** The planner and researcher should treat the AGP principles as strong architectural guidance but NOT expect citable prior art for the mechanical contract shapes (JSONL schema additions, registry field layouts, kill-condition thresholds). Those are Phase 15's original contribution. Research should lean on Phase 14 artifacts (RESEARCH.md, PATTERNS.md, 14-ATC-REVIEW.md) for the mechanical shapes and use these 4 docs only for the architectural *why*.

## Downstream Dispatch Injection Contract

Agents dispatched during Phase 15 research/planning/pattern-mapping/assumptions MUST receive this header block verbatim in their prompts:

```
<vtp_evidence status="real" query_frame="qf_08971fd9c2">
  See .planning/milestones/v1.3/phases/15-codex-routed-gates/15-VTP-EVIDENCE.md
  Primary citable doc_ids:
    - doc:6b62b76ceab5 (Autogenesis — protocol/versioning/rollback — AGP-P-02/03/04/05/07/08)
    - doc:70a3d5757b6a (Shift-Up — dual-vendor workflow precedent)
    - doc:5a50cc9b459e (HiveMind — centralized single-retry pattern)
  Reflection: too_generic (0.57) — use for architectural WHY, not mechanical shapes.
  Mechanical shapes come from Phase 14 artifacts, not VTP.
</vtp_evidence>
```

Phase-close ATC reviewer must verify:
- At least one Phase 15 artifact (RESEARCH.md or PLAN.md) cites at least one of the 3 primary doc-ids with a concrete mapping to an AGP-P-* principle or Shift-Up/HiveMind finding.
- No fabricated doc-IDs appear in downstream artifacts.
- The reflection `too_generic` verdict is acknowledged — downstream work does not claim VTP provides mechanical-shape guidance.

## Memory-rule compliance

Per `feedback_vtp_enriched_dispatch.md`: *"Orchestrator writes VTP-EVIDENCE.md before agent dispatch; agents explicitly instructed to use their VTP tools with doc-ID citations. Silent bypass regresses the primitive."*

This file is real (not a bypass), evidence is citable (doc-IDs above), reflection verdict is surfaced honestly, and the injection contract is declared. **Memory rule satisfied.**
