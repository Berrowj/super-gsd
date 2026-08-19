# P153-T2b Rework the isolation precondition for two managed hooks

You are the implementer for ONE narrow task. Change one file.

## Environment constraint

You CANNOT spawn `claude` from your sandbox (`spawn EPERM`, confirmed three times). Do not
attempt it. Verify with `node --check` only. The orchestrator runs every live probe and
will report results back.

## Why this task exists

T2 correctly reported this blocker instead of weakening the assertion:

> `assert-live-dispatch.cjs` counts all UserPromptSubmit entries and commands, so it will
> reject the required second entry after overlay installation.

Confirmed in source at `super-gsd/tests/hook-transport/assert-live-dispatch.cjs`:

- line 115 `assert.strictEqual(entries.length, 1, 'isolation requires exactly one UserPromptSubmit registration')`
- line 117 `assert.strictEqual(commands.length, 1, 'isolation requires exactly one UserPromptSubmit hook command')`
- line 216 `assert.strictEqual(responses.length, 1, 'expected exactly one UserPromptSubmit hook_response for the session')`
- line 356 the confused control fabricates a second entry by duplicating the first

T2 added `block-secret-leak.cjs` as a second UserPromptSubmit entry in
`super-gsd/config/claude-ups-overlay.json`. Once that overlay is installed there will be
two managed entries and two hook_responses per prompt, so all four points above break.

## The property that must be preserved

The whole phase rests on this and three plan-review rounds failed to secure it. Do not
weaken it.

A passing probe must be impossible unless the classifier actually ran under a genuine
Claude dispatch. The original argument was: exactly one UserPromptSubmit hook is
registered, so a UserPromptSubmit hook_response can only be that hook.

With two managed hooks that argument no longer holds as written. Replace it with this one,
which is equally strong:

1. Every registered UserPromptSubmit entry must be a KNOWN managed SGSD entry, identified
   by its `sgsd_hook_id`. The allowlist is exactly two ids: the intent classifier and the
   secret-leak guard. An entry with an unknown or missing `sgsd_hook_id` fails the
   precondition immediately.
2. Exactly ONE of those entries is the classifier.
3. At least one UserPromptSubmit hook_response for the session reports `exit_code` 0 and
   `outcome` success, paired with its `hook_started` under the same `hook_id`.
4. The classifier is the only component that writes `intent_routing_decision` rows, and the
   guard writes only to `.planning/metrics/codex-tool-events.jsonl`. So a routing row
   correlated by `session_id` to a genuine dispatch is attributable to the classifier.

Keep every other existing guarantee unchanged: the byte-offset snapshot, the
`crypto.randomUUID` nonce and its pre-existing-nonce rejection, `--setting-sources project`
on every launch, and inspecting only post-snapshot rows.

## Deliverable, one file

`super-gsd/tests/hook-transport/assert-live-dispatch.cjs`

- Rework `assertOneRegisteredUserPromptSubmit` into an allowlist check implementing points
  1 and 2 above. Rename it to something accurate.
- Relax the single-hook_response assertion (line 216) to point 3, still requiring the
  hook_started and hook_response pairing by `hook_id`. Do not drop the pairing check.
- Rework the `forged-and-confused-must-fail` control. Duplicating an existing entry is no
  longer the right fabrication, because two managed entries are now legitimate. The control
  must instead inject an UNKNOWN UserPromptSubmit entry, one whose `sgsd_hook_id` is absent
  or not on the allowlist, and assert the precondition REJECTS it. Keep the other half of
  the control, the direct forged stdin spawn with no Claude dispatch, unchanged.
- Leave `--control stale-nonce-must-fail` and all four `--probe` modes behaving as they do
  now, other than the precondition change.

Do not modify any other file. Do not install the overlay. Do not touch
`assert-registration.cjs`, the classifier, the guard, or either settings file.

## Hard constraints

- NEVER read, print, echo or log any settings `env` block. Live API keys.
- Node `.cjs` only. No new dependencies.
- Surgical. Every changed line traces to this task.
- Do not create stray files in the repo root.

## Stop rule

Stop when `node --check super-gsd/tests/hook-transport/assert-live-dispatch.cjs` exits 0 and
the four points above are implemented. The orchestrator installs the overlay and runs the
six live modes.

## Report format, exactly this, max 250 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```

Do not claim any probe or control passes. You cannot run them. Report only what you ran.
