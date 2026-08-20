---
milestone: v3.6-vtp-bridge
name: SGSD↔VTP Bridge — Phase 0 Demand Baseline
status: ACTIVE
opened: 2026-08-11
governing_decision: .planning/decisions/2026-08-11-cross-pollination-BOARD-MEMO.md
source_handover: .planning/briefs/2026-08-11-cross-pollination-handover.md
provider_lock: "Claude orchestrates; Codex gpt-5.6-sol/xhigh authors source."
phases: ["151", "152", "153", "154", "155", "156", "157", "158", "159"]
---

# v3.6-vtp-bridge — Intent

## Core value
Instrument the existing enrichment gate so SGSD can PROVE — before building any
VTP-calling skill — whether its dispatch stream produces genuine demand for
better routing (the handover's 4-week / 20-query test). Zero VTP dependency.
The measurement is the deliverable; it makes the later demand test honest
rather than rubber-stamped, and it is the only board+Codex-sanctioned pre-probe
work. Stages 2-3 (triage shadow-mode, route-following) are BLOCKED on the
post-VTP-milestone restart + probe and on gold-set human approval respectively.

## Boundary (do not cross this milestone)
- No call to any VTP tool. No vtp_triage, no vtp_triage_feedback.
- No skill source for sgsd-triage-first / sgsd-taste-feedback / -plan / -match.
- Contract-stub only for the future skills (documentation, not code).
