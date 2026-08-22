---
name: plan-accepted-limits-still-fail-goal-backward
description: A design flaw that survives plan review resurfaces at the verifier, because the two ask different questions
metadata:
  type: anti-pattern
---

# A plan-approved limit still fails goal-backward verification

P166 (2026-08-22). Plan review round 1 raised that prompt callers could bypass
the policy. Revision 2 answered with evidence binding. Plan review round 2
returned GO, 0 findings. Three spec-compliance rounds then passed the
implementation 11/11 and 12/12 against that plan.

The phase verifier returned GOAL_MET: NO on the same issue round 1 had raised.

Nothing went wrong procedurally. The gates ask different questions:

- Plan review asks whether the plan is sound and enforceable.
- Spec compliance asks whether the code does what the plan says.
- The verifier asks, goal-backward, whether the phase's reason for existing is
  satisfied.

Code can match its plan perfectly while the plan cannot reach the goal. Both
verdicts were correct at once.

**What to do when it happens:** do not overrule the verifier to protect a GO,
and do not fail a phase that delivered verified work. Adjudicate with a fresh
reviewer asking one question, is this closable in scope, deferred, or a new
phase, then close PASS-WITH-DEFERRED and seed the follow-on with the residual
stated plainly. Record the verifier's FAIL verbatim in the summary rather than
softening it.

**What to do earlier:** when a plan review answers a bypass finding with a
mitigation rather than a closure, note at plan time that the goal will only be
partially reachable. That converts a late surprise into a planned deferral.

Related: [[self-reported-evidence-is-not-a-witness]], [[semantic-vs-structural-verification]].
