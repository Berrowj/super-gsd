---
phase: "147"
artifact: VTP-ENRICHMENT
gate: Step 6.b.5
status: success
vtp_available: true
tool_used: mcp__vtp-kb__vtp_search_substrate
queries: 1
empty_hit: false
---

# P147 VTP Enrichment — Commit-Seam Gate

## Hit 1 — flag-before-block is an already-adjudicated pattern here (score 0.52)
`wiki/meetings/call-with-stephani-andersen.md`, "Block procurement until TBC
explicitly confirmed — MODIFY (DK 18)".

The JCL triage verdict on a structurally identical proposal:

> "MODIFY — strong direction, but **blocking is risky without graceful failure
> mode. The correct first step is *flag* not *block***: TBC-laden sales orders
> enter procurement queue with a visible warning + designer must explicitly tick
> 'release ... despite TBCs'. **Build trust in the flag first, then promote to
> hard block once false-positive rate is known.**"

This is P147's warn→earned-block design arrived at independently in a different
domain, and it validates the board's ≥200-payload / <5%-false-block falsifier as
the promotion criterion rather than a gut call.

**The sharper transferable idea — granularity.** That verdict's decisive move was
"the gate is **per-line not per-order**; non-TBC lines flow normally", with the
Stripe payment-method-pending pattern cited as the cleanest analog: proceed for
verified items, hold for unverified, surface both states distinctly —
"**avoids the false binary of 'block everything' vs 'block nothing'**".

Applied to the commit seam: the natural implementation is per-COMMIT binary
(any unbacked source path → warn/block the whole commit). The precedent argues
for per-PATH reporting — name the specific staged paths lacking phase evidence
rather than condemning the commit wholesale. This matters for false-block rate:
a commit touching 30 files where 1 lacks evidence is a very different signal
from one where 30 do, and a binary verdict throws that information away right
when `--shadow-report` needs it to compute a meaningful rate.

**Override must be explicit and logged.** The verdict pairs blocking with "override
available with documented ... reason logged for audit". P147's `.sgsd-gate-off`
sentinel is the analogue and CONTEXT already requires it be logged — keep that
binding, and record WHICH paths the override waived.

## Hit 4 — Swiss cheese model (Reason 1990), Design of Everyday Things (score 0.10)
Layered redundant protection: no single barrier is expected to catch everything.
Directly relevant to RESEARCH Q9's honest finding that `--no-verify` and some
IDE/GUI clients bypass hooks entirely. The commit seam is ONE layer beside
P146's PostToolUse observation and the orchestrator's own gates — it should be
designed and described as such, never as a guarantee. Overclaiming here would
be its own governance defect.

## Hits 2-3 — not relevant (pipeline-status tables). Discarded.

## Planner directives
1. Record per-PATH evidence in shadow rows, not just a per-commit verdict, so
   `--shadow-report` can compute a defensible false-block rate.
2. Keep block-mode promotion mechanical (the board falsifier), never a judgment
   call — the precedent's whole point is that trust is earned from measured
   false-positive rate.
3. `.sgsd-gate-off` must log the waived paths, not merely that it fired.
4. Describe the gate as one layer among several. RESEARCH Q9 shows `--no-verify`
   bypasses it; the phase must not claim coverage it does not have.
