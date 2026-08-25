# P167-T5 spec-compliance review, round 2, confirmation only

You returned FAIL 4/7 on 99a8790 with two CRITICAL. A fix landed at ca43513.
Confirm those two. Do not re-open what passed unless the fix regressed it.

## Your round-1 findings

1. `same_user_bypass.boundary_result` said `bypass_succeeded` while the
   alternate call carried `fixture_payload_accepted:false` and
   `result_is_error:true`. The verifier permitted this by disabling fixture
   acceptance and equating acceptance with payload exactness.
2. For an unparseable response the hook returned `null` unchanged but first
   transitioned the Pre row to `rewritten` with zero metrics, and T2 consumed
   that row, weakening the requirement that acceptance prove a real rewrite.

You also warned that T5 exceeded its locked three-file scope.

## What the fix claims

The bypass now requires genuine fixture acceptance and a non-error result, with
a scenario-local `query_marker` match mode; the active path keeps exact
comparison. The store records `post_passthrough` as a distinct terminal state,
`consumeRewrittenWitness` accepts only `rewritten` rows, and a case proves a
passthrough row is refused. The fail-safe passthrough is unchanged. The scope
excess is recorded as a DEVIATION rather than reverted.

## Check

- Diff `.../167-T5-FIX14-DIFF.patch` (99a8790 to ca43513); live tree at ca43513.
- Report `.../167-T5-FIX14-REPORT.md`; evidence `.../167-REAL-MCP-HOOK-EVIDENCE.json`.

1. Does the bypass now FAIL when the call is rejected or errors? Confirm the
   verifier no longer permits an unaccepted or error result to read as success,
   and that the recorded evidence contains neither
   `fixture_payload_accepted:false` nor `result_is_error:true`.
2. Is `query_marker` matching scoped to the bypass scenario ONLY, with the
   active path still exact?
3. Is `post_passthrough` genuinely distinct, and can acceptance consume ONLY a
   rewritten row? Verify a passthrough row is refused, and that the refusal is
   proven by a case rather than asserted.
4. Is the fail-safe intact: an unparseable response still reaches the agent
   unchanged rather than becoming an error?
5. Is PreToolUse still byte-identical in behaviour and fail-closed?
6. No regression: T1, T2, T3, T4, four guard cases, ten P166 suites, frozen
   P154 evidence, plus capture and independent verify.
7. Is the scope DEVIATION recorded honestly?

## Orchestrator evidence, to audit rather than trust

At ca43513, unsandboxed, 19 suites all pass. Capture PASS and `--verify` PASS
with `active_invocations:1, absent_invocations:0,
same_user_bypass_invocations:2`. Direct grep of the evidence shows neither
false-pass marker present. `post_passthrough` appears 4 times in the store and 0
times in the hook.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/7
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 200 words after the contract lines.
