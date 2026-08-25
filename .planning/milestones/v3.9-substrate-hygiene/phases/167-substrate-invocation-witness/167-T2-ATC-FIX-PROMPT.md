# P167-T2 ATC fix — 2 warnings, VERDICT FAIL

Spec compliance already passed 7/7. Correctness is settled. This round is slop:
a test seam in production, and dead residue in the fixture. Behaviour must not
change.

The ATC confirmed the correlation is in the right module and that moving it now
would be churn. Do not relocate anything.

## Change 1, test authority must not live in production

> Remove the public `testContext` parameter and unsupported no-root fallback;
> tests should establish real CWD, environment and STATE fixtures.
> The override is an ordinary fourth argument on an exported function, so future
> production callers can accidentally redirect project, environment, and session
> authority. The fallback exists only for stateless fixtures; supported SGSD
> execution has a discoverable root.

This matters more than a normal tidy-up. The entire point of T2 is that
correlation authority comes from the runtime and never from a caller. A public
parameter that redirects project, environment and session authority is precisely
that hole, sitting one argument away from any future caller who passes an object
in the wrong position.

Remove it. Make the tests do what the fix round already proved works: establish a
real fixture with its own `.planning/STATE.md` root marker, real CWD and real
environment. The fix round showed the correct fixture shape; apply it to every
case that currently relies on the override.

Remove the `findSgsdRoot(cwd) || realpathSync(cwd)` fallback with it. If some
case genuinely cannot establish a root, say which and why rather than keeping a
production branch alive for it.

## Change 2, dead residue and a false count

> Remove unused production-tree junctions, deduplicate replay coverage, and
> correct the 14/14 claim.

- The fixture links `scripts`, `schemas` and `tools`, but every module executes
  through absolute repository paths, so those links do nothing. Remove them.
  This is the P166 lesson again: do not copy or link the production tree into a
  test.
- The single-witness replay test covers the same consumed-row branch already
  covered after two identical calls. Collapse the duplicate, keeping whichever
  states the intent more clearly.
- There are 13 registered tests, not 14. Correct any count claimed in the file
  or its output. A test suite that miscounts itself invites exactly the kind of
  false confidence this phase exists to remove.

## Do not fix

The O(total spool files) scan on acceptance. The ATC judged it non-blocking at
current substrate-call frequency and said pruning or indexing needs a threshold
before higher-volume use. That is a real forward-looking note, not this task's
work. Leave it; the orchestrator is recording it as a deferred item.

## Constraints

Same three files. Behaviour unchanged. After your change the orchestrator will
re-run: the correlation suite, T1 at 34/34, and ten P166 regressions including
`caller-coverage`, `prompt-record-acceptance`, `executable-emitters`,
`megachunk-degraded-artifact`, `cap-shapes` and `repair-safe-t2`. All must stay
green.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

You cannot run the suites; `EPERM` at fixture `mkdtemp`. Do not claim them.

Emit `PROGRESS: <line>` as you go.

## Report

```
FILES_CHANGED: path (modified)
LINES_REMOVED: <int>
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what went, and how the tests now establish authority without the override
```
