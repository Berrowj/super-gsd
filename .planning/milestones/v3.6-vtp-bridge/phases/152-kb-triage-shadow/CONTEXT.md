---
phase: "152"
slug: kb-triage-shadow
milestone: v3.6-vtp-bridge
status: PENDING
depends_on: ["151"]
governing_decision: .planning/decisions/2026-08-12-kb-triage-gate-MEMO.md
---

# P152 Context — KB-Triage Shadow Classifier

## Goal
A text-free SHADOW classifier that records, per prompt, whether a KB-directed
request WOULD have been routed to vtp-query-triage — firing NOTHING. It is the
measurement instrument that (after a 28-day window vs a locked metric) decides
whether a hard KB-triage gate is justified. Board + 2x Codex challenge locked
this design; do not relitigate.

## Hard conditions (board + Codex, baked in)
- SHADOW ONLY: a new enforcement `kind: shadow` that logs and injects NOTHING.
  (report_only is inert at prompt-time — needs its own tested kind.)
- TEXT-FREE telemetry: persist ONLY decision_id (opaque), matcher_version,
  matched signature IDs, soft_path_action, latency_ms, operator_label (nullable).
  NEVER prompt text, excerpt, or entity strings.
- Trigger PURE anchored-lexical. Verb exclusions (build|fix|run|test|file ops)
  are START-ANCHORED and SUBORDINATE to a strong KB positive — "what did Ada
  say about fixing the customs flow" MUST still match.
- Self-invocation of vtp-query-triage is strengthened then FROZEN before the
  window (changing it mid-window confounds the baseline).
- Promote-or-kill metric locked (28d, >=20 fires, FP<=5%, >=5 incremental
  catches, catches/TP>=20%, p95<=1ms). Documented, not enforced this phase.

## Boundary
No hard directive gate this phase. No /triage alias (killed). No raw-query
logging. No KB entity-lookup in the trigger.
