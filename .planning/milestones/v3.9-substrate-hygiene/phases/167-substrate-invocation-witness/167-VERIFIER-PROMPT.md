# P167 phase verifier — goal-backward

Read only. Not a code review. Judge whether the PHASE achieved its goal, working
backward from the goal rather than forward from the task list.

## The goal

`.../167-substrate-invocation-witness/CONTEXT.md` and the plan `intent`:

> Witness each raw prompt-owned vtp_search_substrate invocation at the Claude
> Code tool boundary, deny a non-v2 payload before transport, cap a valid MCP
> result before model delivery, correlate the real invocation with P166 prompt
> acceptance without an agent-reported identifier, and propagate and audit the
> hook so a missing installation fails loudly instead of silently passing.

P167 exists because P166 closed every Node substrate path but could not close
four markdown-agent prompts, whose compliance was self-reported with nothing
witnessing the real call.

The intent ALSO states plainly, per an operator ruling, that this does NOT
defeat an actor with arbitrary same-user Bash and Write. Judge against the
claim actually made, not a stronger one.

## Evidence

- Plan `.../167-01-PLAN-LOCKED.md` revision 3, all five tasks and six SACs.
- Full phase diff `.../167-PHASE-DIFF.patch` (950422a to HEAD).
- Live evidence `.../167-REAL-MCP-HOOK-EVIDENCE.json`, written by a real Claude
  runtime and re-verified by an independent `--verify` pass.
- Reviews: T1 spec 7/7 and ATC 9/10; T2 spec 7/7 and ATC PASS; T3 spec 9/9 and
  ATC PASS; T4 spec CRITICAL closed then PASS-WITH-FINDINGS, ATC CRITICAL
  closed; T5 spec 7/7 after two rounds, ATC cleanup 442 lines removed.

## Check each SAC, then answer four things

Walk all six `semantic_acceptance_criteria` and mark each MET, PARTIAL or NOT
MET against the shipped system, not against a test name.

Then answer directly:

1. Does a non-compliant substrate call from a prompt surface now get DENIED
   before transport, in production, not only in a fixture?
2. Does an oversized response get capped before the model reads it, and does a
   legitimate response survive intact? Note that a production defect was found
   here: the hook expected `{content:[...]}` while the runtime sends `[...]`,
   and every valid search was being replaced with an error until it was fixed.
   Confirm the repair is real and the fail-safe cannot destroy a good result.
3. Does a machine with the hook absent fail LOUDLY rather than silently
   allowing the call?
4. Did P166, P154 or P152 regress?

## What the live evidence records

```
active_invocations: 1        two calls attempted, the invalid denied pre-transport
absent_invocations: 0        registrations and hook source deleted, tool withdrawn
same_user_bypass_invocations: 2   reached upstream with no witness row
```

Treat that as evidence to audit, not proof. If a number is consistent with a
weaker reading than the phase claims, say so.

## Also state plainly

The residual: a same-user actor with Bash and Write is not stopped. Confirm the
phase records this honestly rather than obscuring it, and that the bypass
characterisation asserts the bypass SUCCEEDS rather than being blocked.

## Output

```
GOAL_MET: YES | PARTIAL | NO
SAC_1: MET | PARTIAL | NOT MET
SAC_2: ...
SAC_3: ...
SAC_4: ...
SAC_5: ...
SAC_6: ...
REMAINING_BYPASS: none | <description>
REGRESSIONS: none | <description>
UNVERIFIED: none | <what you could not check>
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-DEFERRED | FAIL
```

Max 300 words after the contract lines.
