---
phase: "156"
slug: state-close-contract
milestone: v3.6-vtp-bridge
status: ACTIVE
depends_on: ["155"]
carved_from: "155"
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md
opened: 2026-08-20
---

# P156 Context — State-Close Contract (devcp D5+D6)

## Goal

Make STATE.md's close contract honest. Today the template promises "SGSD will update
this automatically" while the only enforcement is an advisory echo at
`gsd-phase-boundary.sh:25`, and the DLB-03 cascade requires a SUMMARY.md that the
phase-close gate does not — devcp's v30-06.8 closed PASS with AUDIT.md and no
SUMMARY.md, a guaranteed dead-end handover.

## Scope (T4c carve-out from P155, plan-review split)

### T1 — state.write() primitive
A write-side primitive the orchestrator calls at plan close and phase close. It updates
the STATE.md projection (current_phase, progress row, last_updated) deterministically.
Constraints:
- decision-state.cjs is a RENDERING boundary and must never write STATE; state.write()
  is a separate write-side tool. Do not merge the two.
- Atomic write (tmp + rename), idempotent re-run, and it must refuse to write when the
  resolver reports the projection is ahead of the evidence it would write (no backwards
  re-sync — same rule the P155 resolver enforces).
- The advisory echo path at gsd-phase-boundary.sh:25 either calls the primitive or is
  updated to state that STATE is written by the orchestrator via state.write().

### T2 — SUMMARY.md close-gate alignment (review change 6, verbatim requirement)
"Define who creates phase SUMMARY.md, its passing shape and pre-close ordering, then
test the actual close route, not just write atomicity."
- Decide and encode: SUMMARY.md is authored by the orchestrator at phase close, BEFORE
  the close commit, with required frontmatter (phase, slug, milestone, status, closed,
  commits, gates) — the shape P154/P155 SUMMARYs already use.
- Align the gate: add SUMMARY.md presence + frontmatter-shape to the phase-close gate
  alongside AUDIT.md (chosen over dropping it from the cascade: capsules and DLB-03
  cascade reads both consume it).
- The falsifier must exercise the ACTUAL close route: a fixture phase closed without
  SUMMARY.md must be refused by the gate; the same phase with a well-shaped SUMMARY.md
  must pass. Testing write atomicity alone is a known-insufficient AC (review change 6).

## Boundaries

- No canonical registry, no alias map, no renumbering (canonical-work-identity memo).
- Resolver/parser stay read-side; phase-name.cjs remains the sole name parser.
- Claude orchestrates; Codex gpt-5.6-sol authors all source.
- Each task independently git-revert-able. Real-data SACs per DLB-07/SCHEMA-09.
- Do not modify P155's resolver semantics; consume them.

## Evidence available to the planner

- P155 SUMMARY + PHASE-CAPSULE for house shape; P154/P155 SUMMARY frontmatter as the
  passing shape template.
- devcp defect report D5 (STATE auto-update is a false promise) and D6 (SUMMARY
  required by cascade, not by gate; v30-06.8 dead-end).
- `super-gsd/tools/state-resolver/resolve.cjs` (projection_stale), `decision-state.cjs`
  (render-only), `gsd-phase-boundary.sh` (advisory echo).
