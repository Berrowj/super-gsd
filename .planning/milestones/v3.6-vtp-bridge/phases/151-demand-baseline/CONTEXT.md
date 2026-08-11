---
phase: "151"
slug: demand-baseline
milestone: v3.6-vtp-bridge
status: PENDING
depends_on: []
---

# P151 Context — Demand Baseline Instrument

## Goal
A zero-VTP-dependency measurement instrument on the existing pre-planning
enrichment gate (Step 6.b.5) that records, per eligible KB-directed query:
the query id, whether the EXISTING path was judged adequate/inadequate
(closed-vocab reason), latency ms, estimated tokens, VTP call count, and the
running denominator (total eligible queries). Append-only, versioned ledger.
This is the baseline the future 4-week demand test measures against.

## Board + Codex conditions baked in (do not relitigate)
- Ledger row schema carries `schema_version` + nullable `artefact_kind`
  (reserved for Phase-B v2) so later records land additively — no rewrite.
- Inadequacy reason is a REQUIRED closed-vocab enum — the demand signal is
  falsifiable, not rubber-stamped.
- Durable correlation: each row carries a `decision_id`; writes are append-only
  and idempotent by decision_id (replay-safe).
- Fire-and-forget: a ledger write failure NEVER blocks a dispatch or phase
  close. Measurement is off the critical path.
- Denominator honesty: eligible queries are predeclared/counted so the 20-query
  numerator has a real denominator.

## Acceptance
- Ledger schema module + validator; self-test proves valid rows accepted,
  malformed rows (missing reason, bad enum, missing schema_version) rejected.
- Instrument records a well-formed row for an eligible query; idempotent on
  replay of the same decision_id; write failure is swallowed (no throw).
- Zero VTP imports anywhere in the diff (grep-verified).
