# P167-T2 fixture repair — exact cause measured, apply the fix

Four previous attempts failed because the diagnosis was wrong. The orchestrator
has now measured the real cause by instrumenting the hook. Do not re-diagnose.
Apply the fix and stop.

## The earlier diagnosis was WRONG

A previous run concluded the deny reason was
`guard_unavailable:pretooluse_missing` and that root discovery was climbing to
the repository root. That is not what happens. Discard it.

## Measured facts

Instrumenting `processHookPayload` and running the suite gives, on the very first
call:

```
event   : PreToolUse
decision: deny
reason  : substrate_witness_denied:project_runtime_unavailable
cwd     : <repo>/.planning/tmp/p167-t2-XXXXXX/project-a
```

`project_runtime_unavailable` is returned at hook lines 229-231 when
`loadProjectRuntime(projectRoot)` throws. That function is:

```js
function loadProjectRuntime(projectRoot) {
  return {
    composer: require(path.join(projectRoot, COMPOSER_RELATIVE_PATH)),
    store:    require(path.join(projectRoot, STORE_RELATIVE_PATH)),
  };
}
```

So the fixture project cannot load the composer. Walking that dependency chain
in an isolated fixture-shaped directory gives, in order:

1. `Cannot find module './sgsd-state.cjs'` when only the composer and store are
   linked. The fixture's `installRuntimeSources` does link `STATE_PATH`, so this
   one may already be satisfied in the suite.
2. With `sgsd-state.cjs` present, the next failure is:

```
Cannot find module '<fixture>/super-gsd/tools/plan-schema/node_modules/ajv'
```

The composer resolves Ajv relative to ITS OWN project root. Inside the fixture
project that path does not exist, because `node_modules` is gitignored and
`installRuntimeSources` does not provide it. `require` throws,
`loadProjectRuntime` throws, and the hook denies before readiness, registration,
key or payload checks are ever reached.

This is the same class of problem the P166 revert proof hit: a fixture project
without the Ajv dependency cannot run composer code.

## Fix

Make the fixture project able to resolve Ajv from
`super-gsd/tools/plan-schema/node_modules`, in the same style
`installRuntimeSources` already uses for the other runtime sources. A directory
junction or symlink to the real `node_modules` is acceptable; copying the tree is
not, because it is large and this must stay fast.

Do not change `loadProjectRuntime`, the composer's Ajv resolution, or any
production file. This is a fixture gap, not a production defect: real SGSD
projects have that directory.

Verify your reasoning by confirming the composer requires cleanly from a
fixture-shaped project once Ajv resolves.

## Forbidden

- No production changes of any kind.
- Do not restore any override parameter.
- Do not restore the removed `scripts`, `schemas`, `tools` junctions; add only
  what Ajv resolution needs.
- Do not touch `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` or
  `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

## Also, if quick

Collapse the duplicate single-witness replay case, and correct any registered
case count stated in the file. Skip if it risks the main fix.

## Speed

Your wrapper has been killed repeatedly. Apply the edit FIRST, emit
`PROGRESS: edit applied`, then only `node --check`. You cannot run the suite
(EPERM at `mkdtemp`); do not claim it. The orchestrator runs it.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: how the fixture now resolves Ajv
```
