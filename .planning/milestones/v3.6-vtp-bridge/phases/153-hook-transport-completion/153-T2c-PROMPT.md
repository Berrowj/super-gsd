# P153-T2c Apply the managed allowlist to assert-registration.cjs

One narrow task, one file. You CANNOT spawn `claude` (spawn EPERM). Verify with
`node --check` and by running the assertion itself, which needs no Claude session.

## Why

T2b reworked `assert-live-dispatch.cjs` from a single-entry isolation check to an
`sgsd_hook_id` allowlist, because T2 added the secret-leak guard as a legitimate second
UserPromptSubmit entry. `assert-registration.cjs` was deliberately excluded from that task
and still assumes a single entry, so it now fails against the correctly installed overlay:

    hook registration FAIL: overlay must contain exactly one UserPromptSubmit entry
    2 !== 1
    exit 1

The overlay and the installed settings are CORRECT. The assertion is stale.

## Single-entry assumptions to replace, in `super-gsd/tests/hook-transport/assert-registration.cjs`

- line 40 `'overlay must declare exactly one event: UserPromptSubmit'` KEEP THIS. The overlay
  must still declare exactly one EVENT. Only the entry count changes.
- line 45 `assert.strictEqual(overlayEntries.length, 1, ...)`
- line 50 `'overlay must map UserPromptSubmit to exactly one command'`
- line 72 `assert.strictEqual(installedEntries.length, 1, 'exactly one managed UserPromptSubmit classifier entry must be installed')`
- line 95 the PASS line hardcodes `events_added=1`

## Required behaviour after the change

1. The overlay still declares exactly ONE event, UserPromptSubmit. Unchanged.
2. Every overlay entry and every installed UserPromptSubmit entry must carry an
   `sgsd_hook_id` on the known allowlist: the intent classifier and the secret-leak guard.
   An unknown or missing id fails. Reuse the same two ids `assert-live-dispatch.cjs` uses;
   read them from there rather than inventing new strings, or export and import them so the
   two files cannot drift apart.
3. Exactly ONE installed entry is the classifier.
4. Every command in the hooks section still resolves to a file that exists on disk. Keep this.
5. Keep printing the sha256 of the hooks section. Keep the counts in the PASS line accurate
   rather than hardcoded.

## Hard constraints

- NEVER read, print, echo or log any settings `env` block. Live API keys. Touch only the
  hooks section by key.
- Do not modify any other file. Do not touch the overlay, either settings file, the
  classifier, the guard, or `assert-live-dispatch.cjs`.
- Do not weaken the resolve-on-disk check or drop the hash.
- Node `.cjs` only. No new dependencies. No stray files in the repo root.

## Verification to run

    node --check super-gsd/tests/hook-transport/assert-registration.cjs
    node super-gsd/tests/hook-transport/assert-registration.cjs

The second must exit 0 against the currently installed two-entry settings.

## Report format, exactly this, max 200 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```
