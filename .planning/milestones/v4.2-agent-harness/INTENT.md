---
milestone: v4.2-agent-harness
status: SEEDED
seeded: 2026-09-14
core_value: SGSD knows what an agent actually delivered, whether the checks exercised the requirement, and whether the intended version reached the running system.
---

# v4.2 Agent Harness

## Why this exists

The operator received the agent harness programme on 2026-09-14 and ordered a
dedicated milestone for the SGSD lane (handoff HARNESS-DOCS-20260914). The
programme's finding is one problem seen in several places: a system reports
success without proving the intended result. Clarity fixes its side in its own
repository (items C1 to C7). SGSD owns the reusable framework side (items S1 to
S7), which must work for Clarity and for any other project.

Source documents, preserved unchanged under
`.planning/briefs/2026-09-14-harness-programme/`:

- `2026-09-14-harness-ownership-and-sequence.md`: who builds what, and the order.
- `2026-09-14-sgsd-harness-build-plan.md`: the seven SGSD work items with
  acceptance checks. This is the authority for phase scope.
- `2026-09-14-clarity-harness-handoff.md` and
  `2026-09-14-agent-harness-programme.md`: supporting references only.

## The core invariant

A green result means the requirement was exercised against the delivered
artifact on the version that is actually running. Process exit, report
validity, observed delivery and independent verification stay separate, and an
invalid or missing piece of evidence is never coerced to success.

## What v4.2 must deliver

1. Delivery evidence: the exact owned worker is waited on, dead or silent
   workers are detected within the configured bound, and delivered artifacts
   survive a nonzero exit (S1).
2. Falsifiable gates: a deliberately broken case fails and a valid case passes
   through the production gate caller; model approval cannot clear a mechanical
   failure (S3).
3. Deployed-version proof: a read-only check compares the intended revision
   with each running service, and existing job protection covers every normal
   deploy entry point (S2).
4. Measurable requirements: every criterion has an executable observable,
   protected contracts need a reviewed amendment, and project-owned rules load
   only for the project that owns them (S4).
5. Independent verification: the verifier never sees the executor's success
   narrative, failures produce a located diagnosis, and retries stop at a bound
   without a changed hypothesis (S5).
6. Gate accuracy and cost: false alarms and missed faults are counted out of a
   stated reviewed total, joined to Atlas run identity, without double-counting
   spend (S6).
7. Harness change evidence: one harness change is traceable from prediction to
   invocation to observed result, with original traces retained (S7).

## Ownership and boundaries

- SGSD owns S1 to S7. Clarity owns C1 to C7 and its runtime protections.
  `clarity-cp` code stays identifiable inside SGSD; unrelated projects must not
  acquire a SAP or Clarity dependency.
- Every shared feature is also run against a small fixture repository with no
  SAP, VTP or Clarity installation.
- Existing components are the starting point: worker adapter, gates registry,
  failure injection, plan schema v2, dispatch router, evidence writers, Atlas,
  harness registry and manifest. Source presence is not proof of production
  use; every change traces the real caller.
- The 14 harness component classes and the frozen evidence contracts stay
  frozen; any amendment is a GATE-tier task.

## Relationship to v4.1

v4.1 Token Economics Atlas is parked, not closed. Phase 170 stays at plan
170-15 implemented and verified; phases 171 and 172 stay pending. Phase 178
(S6) coordinates its attribution work with 171 and 172 through the milestone
process and does not start a second accounting implementation.

## Out of scope

Clarity product rules, SAP writes, screen tests and business-value freshness
(C1 to C7). VTP store corrections and idea-gate changes. Business agents that
prepare quotes or help Clarity users. The source brief's proposed research
board and its token or time budgets.

## Open questions for research

- Which of the S1 death, timeout, missing-report and completion cases does the
  current `codex-worker/run.cjs` and `control.cjs` path already handle, and
  does every production caller consume that result?
- Does every normal Clarity deploy entry point already pass through the
  `clarity-cp` preflight, or is there a bypass to close before adding a guard?
- Can the brief's `verifiable_by` requirement map onto the existing
  `verification_cmd` field without a plan-schema amendment?
- The ownership guide records the devcp Harness checkout at `476cfef8`; this
  worktree is at `2c0cfa12`. Confirm which is the build base before phase 173
  changes source.
