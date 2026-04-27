---
status: SUPERSEDED
superseded_at: 2026-04-27
superseded_by: v1.9 SGSD-Research (Context Compression, Token Governance, And Research Routing)
original_phases: [41, 42, 43, 44, 45]
original_locked_decisions: ["41=C", "41.1", "41.2", "41.3", "42=C", "43=A", "44=A", "45=B"]
preservation_intent: "Mine for any scope item not covered by SGSD-Research before retiring permanently."
---

# v1.9 Knowledge + Memory Governance — SUPERSEDED

**Status:** SUPERSEDED 2026-04-27 by SGSD-Research (which is now the active v1.9).

This was the original v1.9 plan: Knowledge Relevance + Memory Governance (5
phases 41-45). It is preserved here for reference and mining; do not treat
it as an active milestone.

## Why superseded

The new v1.9 (SGSD-Research) is evidence-driven from the agent context-bloat
audit and VTP cross-check (`.planning/analyses/2026-04-27-agent-context-bloat-audit.md`,
`.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md`).
SGSD-Research absorbs the original v1.9 scope through:

- **Capsules** (Phase 58 → renumbered 43): governed phase summaries replace
  raw memory provenance writes; covers the spirit of original 44 (Memory
  Provenance + Retention) with a stricter source-of-truth contract.
- **Legal Context Registry** (Phase 59 → renumbered 44): rejects invented
  references; covers the spirit of original 41 fallback chain at a tighter
  scope (registry-validated keys, not provider-routed queries).
- **Context Packet Builder** (Phase 60 → renumbered 45): role-specific
  packets replace ambient knowledge-provider queries; covers the spirit of
  original 42 (relevance/citation filtering) with explicit budget enforcement.
- **Selective VTP Bridge** (Phase 63 → renumbered 48): route-gated VTP
  bridges; covers the spirit of original 43 (typed retrieval failure modes)
  with MCP-failure-vs-research-conclusion separation + Phase 45's
  public-fallback corpus discipline.
- **Memory Governance Lifecycle** (Phase 64 → renumbered 49): promotion /
  demotion / revocation rules + context complaints log; absorbs the lifecycle
  intent of original 44 + 45.

## Items to mine before permanent retirement

Operator review checklist — verify each of the following original v1.9
features is either covered by SGSD-Research or explicitly accepted as
out-of-scope:

| Original feature | SGSD-Research equivalent | Status |
|---|---|---|
| Phase 41: knowledge-providers.yaml registry | Phase 59 legal-keys.json registry | COVERED (different shape; registry rejects invented refs vs route queries) |
| Phase 41: getProvider() shim with fallback chain | Phase 62 dispatch routing substitution | COVERED |
| Phase 41: `fallback: false` opt-out | Phase 62 routing policy + reason logging | COVERED |
| Phase 42: relevance + decision_impact citation schema | Phase 60 context packet builder + Phase 63 VTP evidence packets | COVERED (packets are source-backed; packet metadata logged) |
| Phase 42: citation theater detector | Phase 60 packet metadata + Phase 64 complaint log | PARTIAL (no explicit "theater detector" flag; complaints log catches the pattern) |
| Phase 43: 7-mode taxonomy (empty_hit/noisy_hit/...) | Phase 63 selective VTP bridge MCP failure metadata | COVERED (failure modes captured in MCP error rows) |
| Phase 44: memory provenance schema (source/confidence/privacy/expiry) | Phase 64 lifecycle fields (confidence/last_validated/supersedes/superseded_by/allowed_consumers/clearance_requires/deprecation_reason) | COVERED (richer field set) |
| Phase 44: sgsd-curate enforces schema on new writes | Phase 64 memory write admission checks | COVERED |
| Phase 45: PUBLIC-FALLBACK-CORPUS-POLICY.md | Phase 63 source-backed VTP evidence packets + provider unavailability handling | PARTIAL (selective VTP routing covers the access-pattern intent; explicit licence/expires policy doc may need to be re-added if operator wants public-corpus support beyond VTP) |
| Phase 45: licence:/expires: mandatory in cache entries | Phase 64 lifecycle field design | COVERED via lifecycle fields |
| Phase 45: discovery-only default | Phase 62 routing policy (VTP route disabled unless uncertainty type requires) | COVERED |

**One item to explicitly decide on:** if the operator wants a separately-
maintained PUBLIC-FALLBACK-CORPUS-POLICY.md doc (Phase 45), it can be added
as a v2.0+ phase. SGSD-Research does not include a standalone public-corpus
licence policy; it folds the discipline into Phase 63 selective routing +
Phase 64 lifecycle governance.

## Original mass-discuss locks (now retired)

The original v1.9 had these locked decisions in
`.planning/discussions/2026-04-26-mass-discuss.md`:

- 41=C (full discussion required at phase start)
- 41.1, 41.2, 41.3 (sub-locks for the registry shape)
- 42=C
- 43=A
- 44=A
- 45=B

All retired. Replaced by SGSD-Research's 12-phase scope; new v1.9 phase 41
(Baseline Token Attribution) is auto-defaulted (no interactive discuss
required) per the SGSD-Research handover packet.

## Source

The full original v1.9 plan content is preserved verbatim in
`PHASES-41-45.md` in this directory (extracted from
`.planning/ROADMAP-AGENT.md` lines 456-540 prior to supersession).
