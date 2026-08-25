# P167-T2 ATC fix, round 2 — your previous run was cut off mid-work

Your wrapper died before writing a report. Part of the work landed and part did
not, and the suite is now broken. The orchestrator ran it.

## What landed correctly

- `testContext` is gone from production. The exported acceptance function takes
  three arguments and derives project, environment and session from the runtime.
- The acceptance-path `findSgsdRoot(cwd) || realpathSync(cwd)` fallback is
  removed. The two remaining occurrences at composer lines 772 and 796 are
  pre-existing P166 CLI argument handling, which the ATC did not flag. Leave
  them.
- The dead `scripts`, `schemas` and `tools` junctions are gone from the fixture.
- T1 still passes 34/34 and all ten P166 regressions are green.

Do not redo any of that.

## What is broken

The correlation suite now fails on its FIRST case, so nothing after it runs:

```
FAIL accepts a matching rewritten witness and returns no hook-only identifier
AssertionError: 'deny' !== 'allow'
  at seedPre   (assert-witness-correlation.cjs:141)
  at seedRewritten (assert-witness-correlation.cjs:164)
  at Object.fn (assert-witness-correlation.cjs:223)
```

`seedPre` drives the hook to create the PreToolUse row that the rest of the test
depends on, and the hook is returning `deny` where the fixture expects `allow`.

The likely cause is the migration you were part-way through: the fixture now
establishes a real `.planning/STATE.md` root, real CWD and real environment, but
`seedPre` is evidently still seeding under conditions the hook refuses. Read the
deny reason rather than guessing. The hook returns a
`permissionDecisionReason` string; get it and let it tell you which precondition
is unmet, for example guard readiness, registration presence, key availability,
or payload validity under the new root.

Finish the migration so every helper, `seedPre` and `seedRewritten` included,
establishes authority the same way the cases do.

## The rule that still applies

Do not reintroduce a production override to make the fixture pass. If the hook
genuinely cannot be driven without one, that is a finding worth reporting, not a
reason to put the seam back. Say so and stop rather than undoing change 1.

Do not weaken the hook, the correlation, or any P166 rejection to make a red
test green.

## Also finish

The duplicate single-witness replay case: the ATC asked for it to be collapsed
into the coverage already provided after two identical calls, and for the
registered-test count claimed in the file to be corrected. The suite currently
reports zero passing cases because it dies on case one, so I cannot confirm
whether that landed. Check and complete it.

## Constraints

Same three files. Frozen byte-unchanged:
`super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

You cannot run the suite (`EPERM` at fixture `mkdtemp`). Do not claim it. The
orchestrator runs it and will report back with exact failures, as it just did.

Emit `PROGRESS: <line>` as you go, and emit one as soon as you have the deny
reason, naming it.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: the deny reason, and what the fixture was missing
```
