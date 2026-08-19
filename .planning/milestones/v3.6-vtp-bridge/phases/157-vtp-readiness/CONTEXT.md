---
phase: "157"
slug: vtp-readiness
milestone: v3.6-vtp-bridge
status: PENDING
depends_on: ["155"]
carved_from: "155"
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md
---

# P157 Context (seed)

T5 carve-out from P155 per plan-review split: vtp-services.yaml contract (env NAMES only, never values), three readiness probes (dist-vs-src freshness with reconnect-not-rebuild note, Qdrant reachability, evidence-store presence), SessionStart pending-ledger depth, single-writer ingest.lock rule. Review change 7 applies: exercise through automatic Rule 0 AND manual readiness, not only the checker.

Full CONTEXT to be authored when the phase opens. Boundaries of the canonical-work-identity memo and addendum apply.
