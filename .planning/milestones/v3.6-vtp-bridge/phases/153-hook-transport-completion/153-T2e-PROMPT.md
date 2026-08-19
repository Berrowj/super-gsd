# P153-T2e Close the guard-lifecycle bypass in the live dispatch probe

One narrow task, one file. You CANNOT spawn `claude` (spawn EPERM, confirmed). Verify with
`node --check` only. The orchestrator runs every live mode and reports back.

## The bypass, found by spec-compliance review

`SPEC_VERDICT: fix_required`, `RELAXATION_SAFE: no`:

> a successful guard hook pair plus a forged session-correlated routing row passes without
> classifier lifecycle

Concretely. Two managed hooks are now registered on UserPromptSubmit: the intent classifier
and the secret-leak guard. T2d relaxed the lifecycle check to "at least one hook_response for
UserPromptSubmit with exit_code 0 and outcome success". The GUARD satisfies that on its own.
So a run in which the guard dispatched and the classifier did not, combined with a routing row
carrying the matching session_id, passes. The classifier never ran.

This reopens the exact harness-green/production-dead hole P153 exists to close. It is the
ninth instance of that class in this repo.

Why the orchestrator's control missed it: the existing
`--control forged-and-confused-must-fail` removes the classifier ENTRY, which
`assert-registration.cjs` catches on classifier uniqueness. It never exercises the case where
the classifier is registered but did not dispatch.

## Required fix, in `super-gsd/tests/hook-transport/assert-live-dispatch.cjs`

**1. Require a complete lifecycle for EVERY registered managed hook, not just one.**

Count the registered managed UserPromptSubmit entries (the allowlist check already resolves
them). Require exactly that many `hook_response` events for the session, each with
`exit_code` 0 and `outcome` success, and each paired to its `hook_started` by `hook_id`.
"At least one" is the defect; replace it with "all of them".

This closes the bypass directly: if the classifier does not dispatch, its `hook_response` is
either absent or non-zero, and the count no longer matches.

**2. For matched probes, additionally require classifier-specific stream evidence.**

On a matched route the classifier writes its directive to stdout, and Claude echoes that in
the `hook_response` event's `stdout` field. Measured example from a real run:

    "stdout":"SGSD directive: /sgsd-triage\n"

The guard emits nothing on a benign prompt. So for `--probe planning` and
`--probe p149-skill-routing`, require at least one `hook_response` whose `stdout` contains the
expected classifier directive text. A forged ledger row cannot fabricate Claude's own
stream-json `hook_response.stdout`.

Do NOT add any new marker to the classifier's stdout. Hook stdout is injected into the model's
prompt context, so a correlation token would pollute every production prompt. Use only the
directive text the classifier already emits.

**3. Add a control that reproduces the exact bypass and MUST fail.**

New mode `--control guard-only-lifecycle-must-fail`:
- construct the evidence state the reviewer described: a UserPromptSubmit lifecycle pair
  attributable to the guard only, plus a routing row carrying the same session_id that the
  classifier did not write
- assert the probe REJECTS it

This control must fail against the pre-fix logic and pass after. If it passes before your
change, it does not reproduce the bypass and the task is not done.

Keep the existing `--control forged-and-confused-must-fail` and
`--control stale-nonce-must-fail` behaving as they do. They test different holes.

## Do not weaken

Keep the isolation allowlist, classifier uniqueness, `crypto.randomUUID` nonce freshness with
pre-existing-nonce rejection, ledger byte-offset snapshots, post-snapshot-only inspection,
`--setting-sources project`, and the T2d property that post-hook API failure
(`rate_limit_event`, `api_retry`, non-zero child exit) does not fail a probe once the required
evidence is present. Only `spawn_error` stays fatal.

## Hard constraints

- NEVER read, print, echo or log any settings `env` block. Live API keys.
- Modify only `super-gsd/tests/hook-transport/assert-live-dispatch.cjs`.
- Node `.cjs` only. No new dependencies. No stray files in the repo root.
- Surgical. Every changed line traces to this task.

## Stop rule

Stop when `node --check` passes, the lifecycle check requires all registered managed hooks,
matched probes require classifier directive stdout, and the new control exists.

## Report format, exactly this, max 250 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```

Do not claim any probe or control passes. You cannot run them.
