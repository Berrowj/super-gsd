---
doc: sgsd-handover
milestone: cross-pollination-engine
status: QUEUED (Phase 0 active immediately)
date: 2026-08-11
audience: SGSD orchestrator + skill authors (Codex-executed)
governing_inputs:
  - INTENT.md (binding phase plan)
  - BOARD-MEMO.md (3 SUPPORT / 1 OPPOSE, binding sequencing + falsifiers)
  - qmd-docs/meetings/vtp-briefing.md doc:3c53fd7b19f9 Stage 3 (prior design)
consumes_from_vtp:
  - vtp_triage (LIVE, shipped in vtp-triage-v2)
  - vtp_triage_feedback (LIVE, advisory feedback ledger v1)
  - vtp_route_and_retrieve / vtp_search_substrate (LIVE)
  - vtp_cross_pollinate (Phase A, not yet built)
  - problem ledger problems.json (Phase B, not yet built)
---

# SGSD ↔ VTP Communication Infrastructure — Handover

## Why this handover exists

SGSD currently talks to VTP through ONE surface: the pre-planning
enrichment gate (Step 6.b.5, keyword-cascade search). The cross-
pollination milestone gives VTP a triage door, an advisory cluster
tool, a problem ledger, and a taste ledger. This document specifies the
four SGSD skills that consume those surfaces, so SGSD can build the
bridge on its side. The bridge is bidirectional and each half solves
the other's hardest open problem:

- SGSD gets better-routed, cluster-informed, precedent-backed context
  for research, planning, and blocker recovery.
- VTP gets the ORGANIC DEMAND EVIDENCE its Phase 0 gate requires
  (contrarian falsifier: 20+ real cross-idea/problem queries in 4
  weeks). SGSD's dozens of daily dispatch questions are that stream.

## What exists today (build against these, do not wait)

| Surface | Status | Contract |
|---|---|---|
| `vtp_triage` | LIVE | Input: question + optional context. Output: compiled advisory route (archetype, tool plan, BLOCKING_AMBIGUITY first), `execution.performed=false`, zero writes. Classifier-only authority: the caller follows or overrides. |
| `vtp_triage_feedback` | LIVE | Records accept/modify/reject + reason code against a triage_id. Reason REQUIRED for rejected/modified. Ledger confined to `.planning/metrics/triage-advisory/`. |
| VTP enrichment gate | LIVE | Step 6.b.5 in sgsd-orchestrate; 5-tool cascade; enrich-only. |
| Blocker-recovery loop | LIVE | Board + Codex challenge path in sgsd-orchestrate. |

## What is coming (gate skill activation on these)

| Surface | Phase | Gate before SGSD may call it |
|---|---|---|
| `vtp_cross_pollinate` | A | retrieval-quality SHIPPED + benchmark re-frozen. Advisory: ≤8 clustered idea IDs + rationale codes, zero writes, store-untouched digests. |
| `problems.json` ledger | B | Built under cove-claim-integrity. Stable problem IDs, evidence-store embedded, linked to claims/commitments/ideas. External problem = SAME SHAPE as internal. |
| Feedback record v2 | B | Adds `artefact_kind` so ledger rows can label cross-pollination artefacts. NOT a coercion of strict v1 — new schema version. |
| Synthesis write-back | C | CoVe SHIPPED + demand proven + named human gate on every write. |

## The four skills to design

### 1. sgsd-triage-first — BUILDABLE NOW (Phase 0 instrument)

- **Trigger:** before every research, planning, or blocker dispatch
  that formulates a question against the KB.
- **Calls:** `vtp_triage(question, context)` → treat compiled route as
  ADVISORY. Follow it, or override it.
- **Records:** every decision via `vtp_triage_feedback` (accepted /
  modified / rejected + reason code) and a
  `route-decisions.jsonl` row with `boundary='vtp_triage_advisory'`.
- **Why:** SGSD's query volume IS the organic usage stream Phase 0
  needs. The loop gets better retrieval; VTP gets demand evidence.
- **Anti-slop constraint:** this wraps the EXISTING enrichment gate's
  question formulation — extend Step 6.b.5, do not add a parallel gate.

### 2. sgsd-taste-feedback — BUILDABLE NOW (Phase 0 instrument)

- **Trigger:** phase close (hook into sgsd-complete-phase / Step 6.6).
- **Does:** logs which VTP-injected context (enrichment hits, triage
  routes, later clusters/matches) was actually USED in shipped work:
  accepted / modified / unused + reason, keyed by proposal/artefact ID.
- **Writes:** v1 feedback ledger now; migrate to v2 records (with
  `artefact_kind`) when Phase B ships them.
- **Why:** the taste ledger is the defensible asset (board: "the
  matcher is commodity; the labelled preference ledger is not").
  Machine-cadence labels, human-auditable.

### 3. sgsd-problem-match — GATED ON PHASE B

- **Trigger:** when a blocker brief is written
  (`{phaseDir}/{N}-BLOCKER-RECOVERY-BRIEF.md`), BEFORE any board
  convenes.
- **Calls:** problem-ledger lookup (lexical identity + semantic
  candidates): has this failure shape been solved before, in-repo or in
  an ingested precedent? Attach matches to the brief.
- **Writes back:** every RESOLVED blocker back-fills the ledger as a
  problem + solution pair (stage-then-merge, never direct writes).
- **Why:** boards stop re-deriving known solutions; SGSD becomes both
  consumer and contributor of the compounding precedent library.

### 4. sgsd-cross-pollinate-plan — GATED ON PHASE A

- **Trigger:** phase-planning time (before gsd-planner dispatch).
- **Calls:** `vtp_cross_pollinate(phase_goal)` → which enriched ideas,
  prior milestone lessons, and book principles cluster around this
  work? Inject the cluster WITH CITATIONS into the planner prompt.
- **Why:** upgrades the enrichment gate from keyword search to cluster
  reasoning — plans start from the KB's combined position, not one
  lucky hit.
- **Constraint:** advisory only; the planner may discard the cluster.
  Every injection gets a taste-feedback row at phase close (skill 2).

## Build order for SGSD

1. **Now:** sgsd-triage-first + sgsd-taste-feedback (both surfaces are
   live; zero VTP-side work needed). These two ARE Phase 0.
2. **After retrieval-quality ships + Phase A lands:**
   sgsd-cross-pollinate-plan.
3. **After cove-claim-integrity + Phase B lands:** sgsd-problem-match.

## Hard constraints (board-recorded, do not relitigate)

- All new tools are ADVISORY: `execution.performed=false`, zero writes,
  caller decides. Never bypass a named human gate on idea-development
  writes (stage-then-merge; direct writes to idea-developments.json are
  a known clobber hazard).
- Synthesis artefacts carry generation-depth ≤1 (gate-enforced) and
  land UNCONSOLIDATED; promotion only on corroboration.
- Similarity is not transferability: no skill may treat cosine
  proximity as an applicability test; analogy needs the METHOD sources
  (TRIZ, Gentner structure-mapping) ingested in Phase B.
- Precision over volume: five right firings a week beat two hundred
  noisy ones. Emission stays gated by the taste ledger.
- Dead-ends: standalone engine module; board-debate as validation;
  full gsd-graph unpark; fine-tuning on the ledger; autonomous sweeps
  without a precision gate; accretion without corrective feedback.

## Kill-switches and falsifiers SGSD must respect

- Contrarian's demand test: if 4 weeks of sgsd-triage-first usage does
  NOT produce 20+ queries where existing paths were recorded
  inadequate, Phase C does not proceed on schedule.
- Moonshot's 90-day check (after v2 records exist): <20 ledger
  decisions, acceptance ~100% or <10%, or problems mostly singletons →
  halt and reassess the whole loop.
- Operator item still open: gold-set human approval
  (`src/contracts/fixtures/triage-gold-set.v1.json`).
