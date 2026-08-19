---
phase: "156"
slug: state-close-contract
milestone: v3.6-vtp-bridge
status: PENDING
depends_on: ["155"]
carved_from: "155"
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md
---

# P156 Context (seed)

T4c carve-out from P155 per plan-review split: state.write() primitive called at plan close and phase close; DLB-03 gate/cascade alignment on SUMMARY.md (devcp D5+D6). Review change 6 applies: define WHO creates SUMMARY.md, its passing shape and pre-close ordering, then test the actual close route, not just write atomicity.

Full CONTEXT to be authored when the phase opens. Boundaries of the canonical-work-identity memo and addendum apply.
