---
phase: "168"
slug: install-contract
milestone: v4.0-install-contract
audit_date: 2026-08-25
atc_verdict: FAIL (2 rounds, CRITICAL deferred to P169)
atc_score: 5/10
muda_verdict: WARN
verifier: GOAL_MET YES, PASS (round 2)
spec_t1: PASS (round 3)
spec_t2: PASS (round 2)
deferred: 1
---

# P168 audit

## Verdicts

| Gate | Verdict | Evidence |
| --- | --- | --- |
| Plan review | NOGO then GO (rev 2) | 168-PLANREVIEW.md, 168-PLANREVIEW2.md |
| T1 spec-compliance | PASS after 2 FAIL rounds | 168-T1-SPEC-REVIEW3.md |
| T2 spec-compliance | PASS after 1 FAIL round | 168-T2-SPEC-REVIEW2.md |
| Phase verifier | GOAL_MET YES, PASS (round 2) | 168-VERIFICATION-RAW2.md |
| Phase ATC | FAIL 5/10, 1 CRITICAL, deferred | 168-ATC-REVIEW2.md |
| MUDA | WARN 8/8 | 168-WASTE.md |
| Blocker challenge | REJECT of the cheap fix | 168-CHALLENGE.md |
| install-contract suite | 5/5 | orchestrator, unsandboxed |
| installer-registration-guard | 13/13 one sweep | orchestrator, unsandboxed |
| Real empty-tree install | exit 0, 17 hooks, 9 modules | orchestrator, repeated |

## The deferred CRITICAL, stated plainly

Rejection-capable repair and Codex registration run after publication writes project
bytes. Three bounded fix rounds failed for three mapped reasons: the writers keep their
own refusal paths; the guard inventory is evadable; publication-last breaks P167 witness
readiness, which validates the hook as installed (audit.cjs:1515, :858). The adversarial
challenge then REJECTED journaled-rollback with evidence: the journal is process-memory
only at HEAD, post-publication writes span roots outside the project, crash states are
ambiguous, and the smoke/policy distinction is false. The sound fix is a full multi-root
transaction, which is phase-sized. Deferred to P169 with the challenge's four-part
verification matrix as its spec. Adjudication: 168-BLOCKER-RECOVERY-BRIEF.md,
168-CHALLENGE.md, route-decisions.jsonl.

Scope note: multi-root unjournaled install writes predate this phase; P168 exposed and
bounded the class, it did not introduce it.

## Rework record, honest

~24 executor dispatches. Two wholesale reverts preserved as evidence
(168-ABANDONED-STAGED-INSTALLER.patch; the second recorded in commit 6c54b7b, its patch
deleted per ATC round 2). Three dispatches killed mid-flight (two timeouts, one wrapper
auth-denied false positive). Four defects escaped into commits and were repaired
in-phase; a fifth, the truncation fail-open, was introduced by a repair and caught next
round. MUDA judged the plan-NOGO and spec rounds justified containment, and the
over-reach avoidable; its stop-rule is curated as first-dispatch-stop-rule.

## Outstanding MINORs accepted at close

Dual in-process/CLI publish workflow (tests moved to CLI where feasible; seam retained
for Bash lifetime management). Retained abandoned-design patch judged defensible evidence.
