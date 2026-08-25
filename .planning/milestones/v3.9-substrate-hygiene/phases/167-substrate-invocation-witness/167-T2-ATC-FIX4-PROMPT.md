# P167-T2 fixture repair — small, well understood, land it fast

One test file is broken. Everything else in this task is correct and committed.
Three previous runs were killed by the host wrapper before finishing. Make the
edit immediately, then stop.

## File

`super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs`

Expect to touch only this. If you believe another file must change, stop and say
why instead.

## Symptom

```
FAIL accepts a matching rewritten witness and returns no hook-only identifier
AssertionError: 'deny' !== 'allow'
  at seedPre        (assert-witness-correlation.cjs:141)
  at seedRewritten  (assert-witness-correlation.cjs:164)
```

Nothing after case one runs, so the suite reports zero passes.

## Cause, already established

The hook denies with `substrate_witness_denied:guard_unavailable:pretooluse_missing`.

The fixture creates its project nested inside this repository. `findSgsdRoot`
walks upward and does not stop at the fixture, so it resolves to the real
repository root. The hook then looks for its PreToolUse registration in the
repository's settings, does not find the fixture's, and denies.

## Fix

Make the fixture's own directory terminate root discovery, and give that
directory the settings containing the PreToolUse registration the hook needs.

Apply it in the helpers, not just the cases. `seedPre` and `seedRewritten` are
where it is missing.

Compare against the fixture pattern already used by the working P166 CLI test,
which establishes a project the same way; mirror it rather than inventing a new
shape.

## Forbidden

- Do not add or restore any override parameter in production code.
- Do not restore the removed `scripts`, `schemas`, `tools` junctions.
- Do not modify the hook, `findSgsdRoot`, the correlation logic, or any P166
  rejection.
- Do not touch `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` or
  `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

If the fixture cannot be made to work without one of the above, stop and report
that; do not do it anyway.

## Also, if quick

Collapse the duplicate single-witness replay case into the coverage that already
follows two identical calls, and correct any registered-case count stated in the
file. Skip this if it risks the main fix.

## Speed matters

Your wrapper has been killed three times. Apply the edit FIRST, emit
`PROGRESS: edit applied` immediately, then do only `node --check`. The
orchestrator runs the suite; you cannot (EPERM at `mkdtemp`). Do not claim any
suite result.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the fixture now provides so discovery stops at it
```
