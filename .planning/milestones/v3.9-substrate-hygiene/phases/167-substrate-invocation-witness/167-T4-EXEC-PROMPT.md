# P167-T4 executor — propagation, registration and the absence gate

You are the implementer for ONE task: P167-T4. T1, T2 and T3 are complete and
committed at `386d027`. Do not start T5.

## Source of truth

`.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md`
revision 3, task `P167-T4`. Its `input_contract` is your specification. Read
`falsifier`, `stop_rule` and `known_deadends` first.

## Why T4 is the task that makes the rest real

Research established the failure this closes: feature propagation copies agent
prompts to a user profile but never registers Claude hooks, and a missing hook
is non-blocking. So without T4, a fresh machine gets the four agents with no
guard and nothing complains. Every protection T1 to T3 built would be
decorative there.

T4 also owns the derived installed grants. T3 removed the raw substrate tool
from the canonical sources; T4 may add it back to the installed copies, but only
after making the broker the sole vtp-kb definition and verifying both hooks are
current. Grant follows guard, never the reverse.

## Method

Work red-first in `assert-propagation.cjs` with a disposable project and isolated
HOME and USERPROFILE. The plan enumerates the seeds: unrelated settings entries,
old P166 planner and researcher patches, missing hook registrations, stale
commands, duplicate hook IDs, a mismatched source file, missing and malformed
keys, and the rest of its list. Get them failing before you change anything.

## The property that decides this task

Absence must be LOUD, not logged. When the hook is not registered, or its source
does not match, something must refuse. A warning written to a file is not
refusal. If your implementation's answer to "what happens on a machine with no
hook" is "it records that", you have built the P166 defect again.

## Constraints

- Seven files per `files_touched`. An eighth fails the task.
- `install.sh` and `merge-settings.js` are shared installer surfaces used by
  other projects. Changes there must be additive and idempotent; running the
  installer twice must not double-register anything.
- Do not weaken T1 (34/34), T2 (13/13), T3 (4/4), or any P166 regression.
  `caller-coverage` is single-consumption and exact: if you add installed-agent
  substrate occurrences, its inventory must account for them or it will go red.
  Check that before you finish, and say what you found.
- Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
  `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.
- Tests use isolated HOME and USERPROFILE only. Never touch the real profile.
- No new package, no network, never invoke `claude`. Do not commit.
- No emoji, no em dashes.

## Honesty bound

Per an operator ruling the plan under-claims: this does not defeat a same-user
actor with Bash and Write. Do not write wording implying otherwise.

## Three lessons from this phase, learned expensively

1. A test that omits an argument production always supplies proves nothing.
   Drive the real path.
2. You cannot run these suites (`EPERM` at `mkdtemp`). Four fix rounds were
   burned earlier on a confident root cause that measurement disproved. If
   something fails, say what you would measure rather than why you think it
   failed.
3. T3 shipped a scope deviation because removing registered lines broke an exact
   inventory the plan had not given it access to. If you hit the same coupling,
   say so early rather than silently exceeding scope.

## Speed

Wrappers have been killed repeatedly near twenty minutes. Apply edits early,
emit `PROGRESS: <line>` per unit starting with the first edit, keep verification
to `node --check` and read-only inspection.

## Report

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: [plan rule] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary, including what refuses when the hook is absent
```
