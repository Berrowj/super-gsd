# P167-T2 ATC fix, round 3 — diagnosis already done, just land the fix

Two previous runs were killed by the host wrapper. The second one completed the
diagnosis before it died. Do not rediscover it. Fix and stop.

## Already landed and correct, do not redo

- `testContext` removed from production; acceptance takes three arguments and
  derives project, environment and session from the runtime.
- The acceptance-path `findSgsdRoot(cwd) || realpathSync(cwd)` fallback removed.
  The two occurrences remaining at composer lines 772 and 796 are pre-existing
  P166 CLI argument handling. Leave them alone.
- Dead `scripts`, `schemas`, `tools` junctions removed from the fixture.
- T1 is 34/34 and all ten P166 regressions are green.

## The diagnosis, verbatim from the run that died

> The exact first unmet precondition is
> `substrate_witness_denied:guard_unavailable:pretooluse_missing`. The isolated
> path sits under the repository, so the hook climbs past the fixture to the
> repository root, whose settings do not contain the fixture's PreToolUse
> registration. The missing local composer made the fixture lose project-root
> authority; it did not terminate discovery outright.

So: the fixture's project is nested inside this repository. `findSgsdRoot` walks
upward, does not stop at the fixture, and lands on the real repository root. The
hook then looks for its PreToolUse registration in the repository's settings,
does not find the fixture's, and denies with `guard_unavailable`.

## What to do

Make the fixture own its root so discovery stops there, and make its settings
carry the PreToolUse registration the hook requires. Whatever `findSgsdRoot`
treats as a stopping condition, the fixture must satisfy it locally, and the
fixture's own settings must contain the registration.

Apply it to every helper, `seedPre` and `seedRewritten` included, not only to
the individual cases. The first failure was inside `seedPre` at line 141, called
from `seedRewritten` at 164, so the helpers are where the authority is currently
missing.

## Constraints that decide this

Do NOT restore a production override to make the fixture pass. Do NOT reintroduce
the junctions. Do NOT weaken the hook, `findSgsdRoot`, the correlation, or any
P166 rejection to make a red test green. If the fixture genuinely cannot satisfy
the hook without one of those, stop and report that as a finding rather than
undoing the ATC fix.

Also finish, if not already done: collapse the duplicate single-witness replay
case into the coverage after two identical calls, and correct any registered
test count claimed in the file.

Same three files. Frozen byte-unchanged:
`super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

## Work fast and land early

Your wrapper has been killed twice at around the twenty minute mark. Make the
edit early and keep verification minimal; the orchestrator runs the suites. Emit
`PROGRESS:` the moment the edit is applied, before any checking, so the work is
attributable even if you are killed again.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the fixture now provides so discovery stops at it
```
