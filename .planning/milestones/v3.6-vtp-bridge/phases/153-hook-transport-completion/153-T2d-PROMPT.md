# P153-T2d Probe must not require the Claude session to succeed

One narrow task, one file. You CANNOT spawn `claude` (spawn EPERM). Verify with
`node --check` only. The orchestrator runs the live modes.

## The defect, with measured evidence

`super-gsd/tests/hook-transport/assert-live-dispatch.cjs` treats a non-zero or null exit of
the `claude -p` child as a probe failure. That is wrong, because a UserPromptSubmit hook
fires BEFORE the model turn. The hook can dispatch, run, and write its ledger row, and the
session can then fail for reasons that have nothing to do with the hook.

Observed on `--probe p152-shadow` and `--probe p149-skill-routing`:

    rate_limit_event  overageStatus "rejected"  overageDisabledReason "out_of_credits"
    api_retry x10     error_status 529 "overloaded"
    child result      {"status":null,"signal":"SIGTERM"}

In that same run BOTH hooks dispatched correctly:

    hook_started   hook_id 25cbdd78  UserPromptSubmit
    hook_started   hook_id 7063103d  UserPromptSubmit
    hook_response  hook_id 7063103d  exit_code 0  outcome success
    hook_response  hook_id 25cbdd78  exit_code 0  outcome success

And the P152 shadow row WAS written, text-free, at 16:27:41.883Z with
matched_signature_ids ["kb-lookup-triage"] and soft_path_action
"would_route_vtp_query_triage".

So the transport worked and the probe reported failure. The probe is measuring the wrong
thing.

## Required change

Separate hook evidence from session outcome.

1. A probe PASSES on hook evidence plus ledger evidence alone:
   - a `hook_response` for `hook_name` UserPromptSubmit with `exit_code` 0 and `outcome`
     success, paired to its `hook_started` by `hook_id`
   - the expected post-snapshot ledger row, correlated by `session_id`
   - the existing isolation precondition, nonce freshness and snapshot rules, all unchanged
2. The child's exit status, signal, `rate_limit_event`, `api_retry` and any post-hook API
   error MUST NOT fail the probe once the evidence in point 1 is present. Only a
   `spawn_error`, meaning Claude could not be started at all, is still fatal.
3. Stop waiting as soon as the required evidence is present. Parse the stream-json
   incrementally and terminate the child once the hook_response and the ledger row are
   observed. Do not sit through ten API retries. This makes the probe faster and stops it
   consuming model quota it does not need.
4. If the evidence never arrives, keep failing, and put the reason in the message: no
   `hook_started`, no `hook_response`, non-zero hook `exit_code`, or no correlated row. Do
   not collapse those into one generic failure.

Do not weaken the isolation allowlist, the `hook_id` pairing, the nonce replay rejection, or
the two `--control` modes. Those must keep discriminating. In particular
`--control forged-and-confused-must-fail` must still fail on a forged direct spawn, and it
must not start passing merely because session outcome is no longer checked.

## Hard constraints

- NEVER read, print, echo or log any settings `env` block. Live API keys.
- Modify only `super-gsd/tests/hook-transport/assert-live-dispatch.cjs`.
- Node `.cjs` only. No new dependencies. No stray files in the repo root.
- Surgical. Every changed line traces to this task.

## Stop rule

Stop when `node --check` passes and the four points above are implemented.

## Report format, exactly this, max 200 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```

Do not claim any probe passes. You cannot run them.
