# P167-T5 — two scenarios PASS live. One characterisation left.

Your parser fix worked. Against a real Claude runtime:

```
PROGRESS: active_path      FINISH PASS
PROGRESS: absent_guard     FINISH PASS
PROGRESS: same_user_bypass FINISH FAIL
P167_T5_CAPTURE FAIL bypass_alternate_payload_mismatch
```

The deny-then-rewrite path and the absent-guard withdrawal are both proven
against production. That is the phase's central claim, live. Do not touch either.

## The remaining failure

`bypass_alternate_payload_mismatch` in the same-user bypass scenario.

Remember what that scenario is FOR. It is a positive characterisation of the
residual the operator accepted: a same-user actor with Bash and Write reads the
private manifest, registers an alternate `vtp-kb-bypass` server, and gets a call
through with no witness row. It PASSES only when the bypass SUCCEEDS. It is not
a protection test.

## Most likely cause, and the precedent

The active path hit exactly this earlier: the harness embedded
`JSON.stringify(payload)` in prose, the model retyped it, and `source_types`
arrived as a JSON string with `limit` as `"5"`. You fixed it by having the
fixture advertise the real typed schema and by asking the prompt for JSON types.

The bypass scenario deliberately sends a NON-v2 payload, so it may still be
handing the model a blob to reconstruct, or comparing against an exact shape the
model will not reproduce byte-for-byte.

## Step 1, instrument. This has resolved four rounds in one shot each.

On failure, print to fd 2 with secrets redacted:

- the expected bypass payload and the actual one;
- the same key-order, value-type and digest comparison you built for the active
  path;
- the fixture log rows for this scenario, so we can see whether the call landed.

## Step 2, then judge

- If the model retyped the payload, fix the harness the same way you fixed the
  active path: declare types, ask for JSON, keep the comparison exact.
- If the comparison itself is too strict for a deliberately malformed payload,
  say so and compare on what the characterisation actually needs: that a call
  reached the fixture through the alternate registration, with a distinguishing
  marker, and left no witness row. The point is that the bypass WORKED, not that
  it carried one exact byte sequence.

State which, with the instrumented output as evidence.

## Do not

- Do not weaken the active-path or absent-guard assertions. They pass live.
- Do not make the bypass scenario assert that the bypass FAILS. It must succeed;
  that is the honest record of the accepted residual.
- Do not fabricate the evidence file.
- Do not touch the hook, composer, broker, cap, or v2 schema. Production is
  correct as of your last fix.

## Scope

`capture-live-runtime.cjs` and `fixture-vtp-mcp-server.cjs`.

Remember: any hook edit invalidates the two pinned digests in
`repo-settings-overlay.json`. You are not editing the hook, so they should stay
valid; confirm they still match before finishing.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: why the bypass payload mismatched, and what the characterisation now asserts
```
