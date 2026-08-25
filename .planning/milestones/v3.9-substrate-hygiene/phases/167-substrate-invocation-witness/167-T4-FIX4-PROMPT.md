# P167-T4 fix round 4 — eighth file authorized, close the CRITICAL

You stopped rather than exceed scope and reverted your partial edits. That was
the right call and the tree is confirmed clean.

## Scope decision, made by the orchestrator

**`super-gsd/tools/substrate-capability-broker.cjs` is now authorized as an
eighth file for T4.** Record it as a DEVIATION against `P167-T4 files_touched`,
naming the reason: invocation-project authority can only be resolved inside the
broker runtime, and the plan assigned that file to T1.

This is the second scope deviation of the phase; T3 set the precedent. The
alternative, leaving a CRITICAL open because a file boundary sits in the wrong
place, is worse.

## Your diagnosis is confirmed

`substrate-capability-broker.cjs:392`:

```js
const projectRoot = cliValue(argv, '--project-root') || process.cwd();
```

`--project-root` is baked in at install time, so it names the INSTALLING
project. `process.cwd()` is not reliably the invocation project either. Neither
answers the question the guard must ask: which project is this call actually
coming from?

## Close CRITICAL 1

Resolve invocation-project authority inside the broker from
`process.env.CLAUDE_PROJECT_DIR`, falling back only where that is genuinely
absent, and make the readiness check run against THAT project. A call from
project B must consult B's hooks, key and registrations, never A's.

Decide and state what happens when `CLAUDE_PROJECT_DIR` is absent. Fail closed
unless you can justify otherwise: an unresolvable invocation project should mean
no tool, not a fallback to whichever project happened to install the broker.

Add the two-project denial test the reviewer specified: a user-only upstream,
project A guarded, project B not, and prove B is denied at `tools/list` and at a
forced `tools/call`.

## Also close the two warnings

**Broker identity is too loose.** `isBrokerDefinition` checks command and args
but ignores extra `env`, `cwd`, `type`, URL and header fields, so a drifted
definition audits as current. Require an exact or explicitly allowlisted shape
and add mutation tests for each of those fields.

**Delete-before-archive can lose data.** At `audit.cjs:638-642`, with mixed
supported-stdio and unsupported direct scopes, every direct definition is
deleted before any is archived. You had already begun the right fix: write
supported originals and unsupported recovery definitions to the private manifest
first, return `broker_repair_failed` on archive or scope-write failure, and
restore the original MCP documents. Reinstate that.

You also found a third issue yourself, which stands: withdraw all four derived
grants at repair entry and re-derive only after both audits are current, so an
archive or write failure cannot leave a grant standing. Keep it.

## Constraints

Eight files now. Nothing further without stopping to ask again.

Do not weaken T1 (34/34), T2 (13/13), T3 (4/4), the four registration-guard
cases, or any P166 regression. The broker changes must not break
`assert-hook-contract.cjs`, which exercises broker readiness and forced-call
behaviour.

The P166 caller inventory must still account for every substrate occurrence
exactly. Do not loosen it.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

## Verification reality

You cannot run fixture suites, guard cases, or bash (`EPERM`). You CAN run
`node --check` and `node -e "require(...)"`. Do those and nothing else; the
orchestrator runs the suites and reports exact failures back, as it has all
phase.

Apply edits early, emit `PROGRESS: <line>` per unit. Wrappers have been killed
near twenty and fifty minutes; the broker change is the important one, do it
first.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: [P167-T4 files_touched] eighth file, with reason
BLOCKERS: description | none
ONE_LINER: how invocation-project authority resolves, and what happens when CLAUDE_PROJECT_DIR is absent
```
