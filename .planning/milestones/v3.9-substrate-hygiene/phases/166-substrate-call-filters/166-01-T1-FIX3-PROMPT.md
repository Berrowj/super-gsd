# P166-T1 fix round 3 — one CRITICAL left, recordless api_error is fail-open

Spec review round 2 on commit d63a6e6: PASS_RATE 10/11, VERDICT FAIL.

CRITICAL 2 (caller coverage) is CLOSED and confirmed by fresh adversarial
probes. Do not touch it. Do not touch anything else that passed.

## The one remaining hole

`super-gsd/scripts/lib/vtp-enrichment-gate.cjs` around line 418:

```js
const hasRecord = Object.prototype.hasOwnProperty.call(enrichmentResult, 'substrate_call_record');
if (enrichmentResult.ok !== false && !enrichmentResult.substrate_call_record) {
  throw new Error('vtp_prompt_substrate_contract_invalid:substrate_call_record_missing');
}
if (enrichmentResult.ok !== false || hasRecord) {
  acceptPromptSubstrateCallRecord(...);
}
```

An `enrichmentResult` of `{ok:false}` with NO `substrate_call_record` property
misses the throw (guarded on `ok !== false`) and misses acceptance (both
disjuncts false). It is written out as an `api_error` artifact.

The reviewer confirmed this with a live in-memory production-path probe. Your
acceptance test did not catch it because it only exercises a missing record on
the `ok:true` branch.

Why this matters: an agent that made a raw unfiltered substrate call can report
`{ok:false}` and omit the record entirely, and the gate accepts it. That is the
same bypass as before, wearing an error costume.

## Required

Make the recordless `ok:false` path fail closed. Either:

- require gateway evidence for `ok:false` results the same way you do for
  `ok:true`; or
- require a mechanically verified no-transport state, meaning production can
  tell that no substrate call was attempted, rather than taking the result's
  word for it.

Pick whichever is honest for this seam and say which in ONE_LINER. A genuine
transport failure that never emitted a call must still be reportable; an agent
must not be able to claim that state after actually calling.

Then TEST the wholly absent record branch: `{ok:false}` with no
`substrate_call_record` property at all, driven through the real
`vtp-enrichment-gate.run()` path, not a synthetic stand-in. Also cover
`{ok:false}` WITH an invalid record, so the error branch cannot become a
laundering route for a bad record either.

## Scope

Expect to touch `vtp-enrichment-gate.cjs`, possibly
`vtp-context-composer.cjs`, and
`super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs`.
Nothing else without saying why.

Do not weaken the existing `ok:true` checks. Do not turn any throw into a
warning. Preserve `api_error`, `empty_hit`, and success status selection for
legitimate results, and the rule that only an API failure writes API Error.

Frozen byte-unchanged: `vtp-mcp-input-schemas.v1.json`,
`154-REAL-MCP-EVIDENCE.json`. Do not commit. No emoji, no em dashes. Never
invoke `claude`.

You cannot run `executable-emitters` (`spawnSync EPERM` in your sandbox). Do not
claim it. The orchestrator runs it.

Emit `PROGRESS: <line>` as you go.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: which approach you chose and why it cannot be claimed falsely
```
