# P167 — bounded failure restored correctly, but the harness now throws and masks it

Your fix landed the important part. `post_passthrough` is gone from both the
hook and the store, the full suite is green (T1 38/38, T2, T3 4/4, T4, four
guard cases, ten P166 suites, frozen P154 evidence), and 2,467 lines went.

The live capture now fails:

```
PROGRESS: active_path FINISH FAIL
P167_T5_CAPTURE FAIL harness_internal_error
EXIT=1
```

## Two things to fix, in this order

### 1. The harness is hiding the real error, which is a defect in itself

`safeFailureReason` only passes a message through when it matches
`/^[a-z0-9_:.-]+$/i`, and otherwise returns `harness_internal_error`. So a
genuine JavaScript exception, which always contains spaces and punctuation, gets
laundered into a tidy contract-shaped label that says nothing.

That is the same disease this phase has fought all the way through: a failure
reported in a form that looks controlled while destroying the information needed
to act on it.

Fix it so an unexpected exception surfaces its real message and the first frames
of its stack, on stderr, redacted for anything secret-shaped. Keep the closed
contract reasons exactly as they are for expected failures. `harness_internal_error`
should mean "we truly could not characterise this", not "the message had a space
in it".

Do this FIRST, then re-run and read what it actually says.

### 2. Then fix whatever it reveals

Most likely your export trim removed something the harness itself still uses. I
confirmed `parseArgs` is no longer exported. That specific one only broke an
orchestrator probe, not production, but check whether any other trimmed export
is referenced internally or by another suite. The ATC flagged "unused new
internal exports"; anything genuinely used is not unused.

Do not restore exports wholesale to make it pass. Restore only what is
referenced, and say which.

## Constraints

- Bounded failure stays. A malformed result, absent or invalid Pre row, or a
  capping failure returns a small `substrate_witness_rewrite_failed` object.
  Never pass the raw result through. This is locked-plan behaviour and the
  reason the last round existed.
- Acceptance stays rewritten-only.
- PreToolUse stays fail-closed and byte-identical in behaviour.
- The cap, composer, broker and v2 schema are unchanged.
- Everything currently green stays green; the orchestrator re-runs all of it
  plus the capture and the independent verify.
- Any hook or store edit invalidates the two pinned digests in
  `repo-settings-overlay.json`, currently
  `5640a8ed92467cde81c80b95b747f3dd55285c2bdc338e26dc1c353db1fc1642`. Refresh
  and say so.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit, and emit the real error message as soon as you
have it.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: the real exception, and what was restored
```
