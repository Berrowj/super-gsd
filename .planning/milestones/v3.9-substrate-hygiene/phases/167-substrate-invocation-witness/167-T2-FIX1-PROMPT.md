# P167-T2 fix round 1 — your suite fails when actually run

You could not run any suite because your sandbox returns EPERM. The orchestrator
ran them. Thirteen of your fourteen correlation assertions pass. One fails.

## What passes, so you know what not to touch

```
PASS accepts a matching rewritten witness and returns no hook-only identifier
PASS rejects a clean record when no witness exists
PASS rejects a pre-only witness
PASS rejects an expired rewritten witness
PASS rejects an HMAC-edited rewritten witness
PASS rejects a witness from a different runtime session
PASS rejects a witness from a different project
PASS rejects a witness for a different hook-computed payload digest
PASS consumes two identical sequential calls once each
PASS rejects replay after a single witness is consumed
PASS rejects agent-supplied correlation fields without consuming the witness
PASS preserves P166 rejection order and does not consume on forged records
```

The correlation design is sound and the orchestrator also confirmed T1 still
holds at 34/34 and all ten P166 regressions are green. Do not redesign anything.

## The failure

```
FAIL CLI inherits runtime session and emits accepted JSON only after consumption
AssertionError: vtp_accept_substrate_call_record_failed:vtp_substrate_record_file_uncontained
1 !== 0
  at assert-witness-correlation.cjs:434
```

The CLI case exits 1 where the test expects 0, because the record file path it
passes is rejected by containment as uncontained.

## Diagnose before fixing, and say which it is

Two possibilities, and they need opposite fixes:

1. **The test is wrong.** It writes its record file to a location outside what
   containment legitimately allows, for example a system temp directory outside
   the isolated project root. Then the production guard is behaving correctly
   and the test must place its fixture inside the contained location the CLI
   really uses.

2. **Containment is wrong.** The CLI's real, documented usage would put a record
   file exactly where this test put it, and containment rejects a path it should
   accept. Then production has a bug that would bite a real caller.

Do not guess. Establish which by reading the containment rule and the CLI's
actual contract. State your conclusion and your evidence in ONE_LINER.

If it is 1, fix the test and say so plainly rather than dressing it up as a
production fix. A test that was wrong is a normal outcome; hiding it is not.

If it is 2, fix production and add the case that proves the legitimate path is
now accepted while an genuinely uncontained path is still refused. Do not widen
containment beyond what the CLI actually needs. P166 spent four review rounds on
containment and `resolveContainedPath`; loosening it casually would undo that.

## Constraints

Same three files as T2. Do not weaken containment, the correlation, the deny
path, the cap, or any P166 rejection. All twelve passing assertions above must
still pass, T1 must stay 34/34, and the ten P166 regressions must stay green.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

You still cannot run the suites. Do not claim them. The orchestrator runs them
and will report back.

Emit `PROGRESS: <line>` as you go.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: which of the two causes it was, with the evidence that decided it
```
