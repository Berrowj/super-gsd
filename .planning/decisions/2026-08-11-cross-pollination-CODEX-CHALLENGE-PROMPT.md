# CODEX CHALLENGE — SGSD Board Decision Memo (cross-pollination Phase 0)

You are a SEPARATE Codex reviewer challenging the SGSD board's decision before it executes (per the blocker/decision recovery contract: board memo must survive an independent Codex challenge). Be adversarial. Your job is to find the flaw the board missed, not to ratify.

Challenge specifically:
1. Is the CONDITIONAL-GO fork sound, or does it smuggle a build past a real OPPOSE? The Contrarian voted OPPOSE-UNLESS — is the 'unless' genuinely satisfied by a tool-resolves probe, or does the deeper objection (SGSD manufacturing VTP's demand evidence at SGSD cost) survive even a GREEN probe?
2. Is 'extend Step 6.b.5' actually safe, or does bolting an advisory vtp_triage call into the pre-planning enrichment cascade create a hidden critical-path or a double-enrichment (triage route + existing 5-tool cascade both firing)?
3. Is the versioned-ledger + fire-and-forget condition sufficient, or is there a data-integrity or replay hazard in append-only advisory ledgers the board glossed?
4. Is the RED-fork fallback (logging-only) actually distinct from the GREEN branch's skill 1, or is the board proposing to build essentially the same thing either way — meaning the precondition doesn't actually gate anything?
5. Anything the board should have killed outright.

Report contract (exact lines):
CHALLENGE_VERDICT: memo-sound | memo-needs-revision | memo-unsafe
SURVIVING_OBJECTIONS: none | <list the objections that survive the board's reasoning>
BINDING_ADDITIONS: none | <conditions the board must add before executing>
ONE_LINER: <summary>

## Board Decision Memo
---
decision: cross-pollination-engine Phase-0 (SGSD side)
date: 2026-08-11
board: sgsd-ceo synthesis of Architect + Pragmatist + Contrarian
vote: 2 SUPPORT-WITH-CONDITIONS + 1 OPPOSE-UNLESS (all conf 4)
verdict: CONDITIONAL GO — the "unless" and the "conditions" are the same gate
status: PENDING CODEX CHALLENGE
---

# Decision Memo — SGSD↔VTP Cross-Pollination Phase 0

## Verdict
CONDITIONAL GO. The 2-1 split is not a real disagreement: the Contrarian's
OPPOSE-UNLESS is satisfied by the exact precondition the other two seats made
binding. Frame the precondition as a FORK and all three positions merge.

## The unanimous binding precondition (the fork)
No skill code — none — until a LIVE probe in a fresh session/MCP child confirms
`vtp_triage` and `vtp_triage_feedback` resolve AND honour contract:
execution.performed=false, zero writes, reason-required-on-reject. This tool
absence is the harness-vs-production seam that recurred 6x in v3.5; it is a hard
gate, not a warning. (Probe requires a session restart — operator-owned; the
current MCP child predates vtp-triage-v2 per VTP health = healthy but tool absent.)

## The fork
- **Probe GREEN** (tools resolve + honour contract) → BUILD Phase 0 as one
  Codex-executable phase: skill 1 sgsd-triage-first (extend Step 6.b.5, reuse
  its D-08 degraded/timeout path and cached vtp_available; never inline-blocking),
  skill 2 sgsd-taste-feedback (phase-close hook). Architect + Pragmatist path.
- **Probe RED** (tools genuinely unshipped, not stale-child) → fall back to the
  Contrarian's deletion: logging-only extension of Step 6.b.5 — closed-vocab
  override-reason field + route-decisions.jsonl row, NO vtp_triage call — run
  4 weeks, revisit when VTP ships the tools. No skill built on a phantom.

## Binding conditions on the GREEN branch
1. Ledger schema ships with explicit `schema_version` + nullable `artefact_kind`
   → Phase-B v2 records land additively, zero rewrite. (Architect)
2. All triage calls inherit Step 6.b.5's bounded-timeout degraded path; all
   feedback writes are fire-and-forget append-only to
   .planning/metrics/triage-advisory/ — triage absence/latency NEVER blocks a
   dispatch or phase close. (Architect)
3. Override/reject reason is a REQUIRED closed-vocab field, or the 4-week/
   20-query demand falsifier self-corrupts into rubber-stamping. (all 3 seats)
4. skill 1 is a question-formulation wrapper INSIDE the existing cascade — no
   second gate object, no second health check. (Architect + anti-slop, handover:69)
5. Skills 3-4 CONTRACT-STUB ONLY — zero code against unbuilt VTP Phase A/B.
   (all 3 seats)

## Adopted falsifiers (verbatim from handover)
- 4-week demand test: <20 truthfully-recorded inadequate-path queries → Phase C
  does not proceed on schedule.
- 90-day check (after v2 records): <20 decisions, acceptance ~100% or <10%, or
  problems mostly singletons → halt and reassess.
- gold-set human approval (triage-gold-set.v1.json) stays OPEN; not a Phase-0
  build blocker but not to be closed around.

## Zero-VTP-dependency work sanctioned to start NOW (Pragmatist's safe parallel)
The route-decisions.jsonl + taste-ledger schema design (schema_version,
artefact_kind reserved, closed-vocab reason enum) has NO VTP dependency and may
be drafted while the surface is being verified. This is the only sanctioned
pre-probe build.

## Contrarian's standing caution (recorded, honoured)
SGSD is partly manufacturing VTP's demand evidence. Mitigation: the closed-vocab
required reason (condition 3) makes the demand signal falsifiable, not fabricated;
and the RED fork ensures no skill is built until the surface — and via the 4-week
test, the demand — is earned.

## Source handover
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
