# SGSD↔VTP Bridge — Phase 0: Demand Baseline

> Status: Stage 1 SHIPPED (v3.6-vtp-bridge / P151). Stages 2–3 GATED.
> Governing decision: `.planning/decisions/2026-08-11-cross-pollination-BOARD-MEMO.md`
> Source handover: `.planning/briefs/2026-08-11-cross-pollination-handover.md`

## Why this exists

The cross-pollination handover asked SGSD to build four skills that call new VTP
surfaces (`vtp_triage`, `vtp_triage_feedback`, `vtp_cross_pollinate`, a problem
ledger). The SGSD Board reviewed it and an independent Codex challenge returned
**memo-unsafe**, reshaping the plan into a **sequence, not a fork**: prove the
demand is real *before* building any VTP-calling skill. Phase 0 is that proof
instrument. It has **zero VTP dependency** and makes **no VTP call**.

## Stage 1 — the demand baseline (SHIPPED)

`super-gsd/scripts/lib/demand-baseline-ledger.cjs` records, per eligible
KB-directed query at the Step 6.b.5 enrichment gate, one append-only JSONL row
to `.planning/metrics/triage-advisory/demand-baseline.jsonl`.

**Row contract** (`validateRow`):
- `schema_version` (integer) — versioned so Phase-B v2 records land additively.
- `decision_id` (non-empty) — writes are **idempotent** by this id (replay-safe).
- `adequate` (boolean) — was the existing enrichment path good enough?
- `reason` (REQUIRED, closed enum below) — makes the demand signal falsifiable,
  not rubber-stamped.
- `latency_ms`, `est_tokens`, `vtp_call_count` (non-negative numbers).
- `artefact_kind` (nullable, RESERVED for Phase-B v2).
- `note` (required only when `reason = other_inadequate`).

**Closed-vocab `reason` enum:** `existing_path_adequate` ·
`enrichment_empty_hit` · `enrichment_off_topic` · `enrichment_stale` ·
`no_enrichment_attempted` · `other_inadequate`.

**Instrument:** `recordEligibleQuery(planningDir, {...})` stamps the version,
maintains an **honest denominator** (unique eligible `decision_id` count) so the
20-query numerator has a real base, validates, and appends. It is
**fire-and-forget** — any failure returns `{ok:false}` and never throws; a write
failure must never block a dispatch or phase close.

Wired advisorily at Step 6.b.5 in `super-gsd/skills/sgsd-orchestrate/SKILL.md`.

## The demand test (the falsifier that gates everything downstream)

Run the baseline for **4 weeks**. If it does **not** produce **20+** queries
where the existing path was truthfully recorded inadequate (i.e. `adequate:false`
with a non-`other`, or justified `other_inadequate`), the VTP-bridge does **not**
proceed to route-following on schedule. Precision over volume: five right firings
a week beat two hundred noisy ones.

## Stages 2–3 (GATED — not built)

| Stage | What | Gate |
|---|---|---|
| **2 — triage shadow-mode** | Call `vtp_triage` for eligible queries but **do not auto-follow**; measure the routing quality delta vs baseline. Requires: one total VTP call budget with mutual exclusion across triage/cascade/bridge/planner; real timeout + cancellation; a durable idempotent `decision_id`/`triage_id` outbox (pending→reconciled, superseding corrections; count only unique reconciled pairs). | **Post-VTP-milestone session restart + tool probe.** `vtp_triage` (zero-write contract) and `vtp_triage_feedback` (write contract, reason-required on modify/reject) must resolve and honour their *different* contracts in a fresh session before any code. |
| **3 — route-following** | Actually follow the triage route. | **Gold-set human approval** (`triage-gold-set.v1.json`, operator-owned) — currently OPEN. |

## Future-skill contract stubs (prose only — NOT BUILT)

These are the handover's four skills, recorded as contracts so the shape is
fixed. **No code exists for any of them.** Do not pre-build against unbuilt VTP
Phase A/B surfaces.

1. **sgsd-triage-first** *(gated on Stage-2 probe)* — Trigger: before every
   research/planning/blocker KB query. Calls: `vtp_triage` (advisory). Writes:
   `vtp_triage_feedback` (accept/modify/reject + closed-vocab reason) + a
   `route-decisions.jsonl` row (`boundary='vtp_triage_advisory'`). Must EXTEND
   Step 6.b.5, not add a parallel gate.

2. **sgsd-taste-feedback** *(deferred until stable artefact IDs + v2 records +
   end-to-end usage provenance)* — Trigger: phase close. Logs which VTP-injected
   context was actually USED in shipped work (accepted/modified/unused + reason),
   keyed by artefact id. The taste ledger is the defensible asset.

3. **sgsd-cross-pollinate-plan** *(gated on VTP Phase A)* — Trigger: phase
   planning. Calls: `vtp_cross_pollinate(phase_goal)` → inject the clustered
   ideas/lessons/principles WITH CITATIONS into the planner prompt. Advisory;
   planner may discard.

4. **sgsd-problem-match** *(gated on VTP Phase B)* — Trigger: when a blocker
   brief is written, before any board convenes. Calls: problem-ledger lookup;
   attaches prior-solution matches. Writes back: every RESOLVED blocker
   back-fills the ledger (stage-then-merge, never direct writes to
   idea-developments.json — named clobber hazard).

## Hard constraints (board + Codex, do not relitigate)

- All future tools ADVISORY: `execution.performed=false`, caller decides; never
  bypass a named human gate on idea-development writes.
- Similarity ≠ transferability: no skill may treat cosine proximity as an
  applicability test.
- Synthesis artefacts: generation-depth ≤1, land UNCONSOLIDATED, promote only on
  corroboration.
- SGSD is partly generating VTP's demand evidence; the required closed-vocab
  reason (Stage 1) is what keeps that evidence falsifiable rather than fabricated.
