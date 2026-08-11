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

---

# Codex Challenge Result — MEMO-UNSAFE (revises the decision)

An independent Codex instance challenged this memo and returned **memo-unsafe**.
Its surviving objections are load-bearing and are ADOPTED:

1. **Probe contract was internally wrong.** "zero writes" applies to vtp_triage
   but NOT to vtp_triage_feedback — writing IS that tool's purpose. The
   precondition must test the two tools by their DIFFERENT contracts.
2. **GREEN proves availability, not demand / routing-quality / acceptable cost.**
   A resolving tool does not justify a build. (Reinforces Contrarian.)
3. **Step 6.b.5 has no ENFORCED timeout** and can STACK triage on top of the
   existing 5-tool cascade + the per-dispatch bridge + planner MCP calls → an
   unvalidated multi-call critical path. The Architect's "reuse the degraded
   path" assumed a timeout that isn't actually enforced.
4. **Fire-and-forget dual writes lack atomic correlation / idempotency /
   reconciliation** → corruptible evidence stream.
5. **RED fork is instrumentation, not deletion — and its "override" has no route
   to override** (no triage call = nothing to override). The fork does not
   actually gate anything distinct.
6. **Auto phase-close taste labels cannot prove ACTUAL use;** strict v1 cannot
   represent general artefacts.

## Revised decision: SEQUENCE, not fork
- **Stage 1 (baseline, no VTP dep):** predeclare eligible queries; record
  inadequacy + denominator/latency/tokens/call-count BEFORE any triage. Pure
  measurement on the existing gate. This is the real Phase 0.
- **Stage 2 (triage shadow-mode):** once a fresh-session probe confirms
  vtp_triage resolves (zero-write) AND vtp_triage_feedback resolves (writes,
  reason-required on modify/reject), CALL triage but DO NOT auto-follow —
  measure quality delta vs baseline. Requires: one total VTP call budget with
  mutual exclusion across triage/cascade/bridge/planner; real timeout +
  cancellation; a durable idempotent decision_id/triage_id outbox with
  pending/reconciled states + superseding corrections (count only unique
  reconciled pairs).
- **Stage 3 (route-following):** BLOCKED until the gold-set human approval
  (triage-gold-set.v1.json) lands. Operator-owned.
- **Auto taste-feedback (skill 2):** DEFERRED until stable artefact IDs + v2
  records + end-to-end usage provenance exist. Not built now.

## Hard gate before ANY source edit
Activate a milestone + an approved PLAN. No skill source until then.

## Operator-owned gates (cannot proceed without)
- Session restart to expose + probe vtp_triage / vtp_triage_feedback.
- gold-set human approval to unblock Stage 3 route-following.

FINAL: build the Stage-1 measurement baseline (zero VTP dependency) under a
proper milestone+PLAN; everything that calls VTP waits on the probe; route-
following waits on gold-set approval. Do NOT build the two skills as the
handover framed them yet.
