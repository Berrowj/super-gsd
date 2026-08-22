# P167 plan review, round 3, confirmation only

Round 2 returned NOGO on one CRITICAL: the broker and its manifest are
same-user-controlled and the four grant-bearing agents hold Bash and Write, so
they can reach the upstream directly. You named three closures, all requiring
authority the current non-admin operator does not hold.

**The operator has ruled: accept a bounded scope.** That ruling is not yours to
overturn, and re-raising the same-user bypass as a CRITICAL is out of scope for
this round. Your job is to check that revision 3 is HONEST about it.

## Confirm

1. **Does the intent state both halves?** It must say what the phase closes
   (drift, forgetfulness, shortcuts, the deletion case, the response cap) and
   that it does not defeat an actor with arbitrary same-user Bash and Write.
   A reader who sees only the intent must not conclude the path is sealed.

2. **Is the residual visible outside `known_deadends`?** Round 2's concern was
   that an admitted weakness buried in a dead-end note becomes a forgotten one.
   Check it now appears where a summary reader will meet it.

3. **Is the new characterisation SAC written as a positive requirement?** It must
   require both bypass attempts to SUCCEED and be recorded, with no matching
   witness row, and must not be expressible as a skipped, failing, or optional
   test. If it could be satisfied by not running, that is a WARNING.

4. **Does any task text, output_contract, or SAC still overclaim?** Search for
   language elsewhere in the plan that promises stronger protection than the
   bounded ruling supports. Under-claiming is fine. This is the main thing worth
   your attention.

5. **No shrinkage.** Five tasks, six SACs. The deny plus rewrite contract, the
   session-plus-digest correlation, the broker readiness and pre-forward checks,
   T5's live deletion proof from the fixture's append-only log, and the P166
   regression set must all still be there. Revision 3 was permitted to change
   claims and add one SAC, not to reduce the build.

6. **Is the operator ruling recorded** with date and reason, so the bounded scope
   reads as a decision rather than an oversight?

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/6
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
REQUIRED_CHANGES: none | <numbered>
```

CRITICAL only for an overclaim, a shrunk build, or a characterisation SAC that
can pass without running. NOGO is not available for the same-user bypass itself.
Max 200 words after the contract lines.
