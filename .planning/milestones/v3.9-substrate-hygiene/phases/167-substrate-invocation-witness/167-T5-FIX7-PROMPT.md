# P167-T5 fix round 7 — the core claim is now live-proven; one assertion left

Your parser fix worked. The capture now passes every lifecycle check:

```
preHooks  2 started / 2 responses    <- hook fired on BOTH attempts
postHooks 1 started / 1 responses    <- only the valid call reached PostToolUse
denial response containing the expected reason: FOUND
valid tool result: FOUND
```

Read what that means before you change anything. The invalid payload was denied
at PreToolUse and never reached PostToolUse, while the valid one did. That is the
central claim of this entire phase, proven against a real Claude runtime rather
than a fixture. Do not disturb any of it.

## The remaining failure

`capture-live-runtime.cjs:1227`:

```js
requireCondition(validResult.is_error !== true, 'active_valid_tool_result_failed');
```

The VALID call's tool result came back with `is_error === true`.

## Step 1, instrument. Do not guess.

This has been the winning move three times tonight. On failure, write to fd 2,
with anything secret-shaped redacted:

- the full `validResult` object, including its content and any error text;
- the `denialHookResponse` reason for comparison;
- the fixture's own append-only log rows for this scenario (`traffic_class`,
  `tool_name`, `payload_sha256`, `payload_keys`), so we can see whether the
  fixture ever received the call;
- the PostToolUse hook response, since if PostToolUse replaced the result then
  the error may be coming from the replacement rather than the upstream.

## Step 2, then judge. Three readings, needing different fixes.

1. **The fixture rejected the payload.** It now advertises a typed schema; if it
   validates more strictly than it declares, or the scenario expectation does not
   match what was sent, it would return an error. Harness fault.
2. **The broker refused it.** Readiness, digest, or manifest checks may be
   failing inside the disposable project. Harness or setup fault.
3. **PostToolUse produced an error result.** If the cap or replacement path
   errors on this payload, that is a REAL production finding and the most
   important possible outcome. Say so plainly and do not soften the assertion.

State which, with the instrumented output as evidence.

## The rule that has held all phase

Do not weaken the assertion for a green run. A valid, policy-compliant call must
succeed; if it does not, either the harness is wrong or we have found something
that matters.

Do not fabricate `167-REAL-MCP-HOOK-EVIDENCE.json`. Do not touch the hook,
composer, broker, or v2 schema unless reading 3 proves true, in which case stop
and report rather than editing.

## Scope

`capture-live-runtime.cjs`, and the fixture if the evidence points there.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell; Git Bash loses this harness's stdio on this machine.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: which of the three readings is true, and the evidence that decides it
```
