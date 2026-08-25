# P167-T4 fix round 1 — your run was cut off and merge-settings.js is broken

Your wrapper hit its 3000s timeout and never wrote a report. All seven files
are on disk. The orchestrator ran the suites.

## Measured state

Syntax and JSON validity all pass:

```
merge-settings.js              node --check ok
audit.cjs                      node --check ok
assert-propagation.cjs         node --check ok
assert-installer-registration-guard.cjs  node --check ok
hook-manifest.json             valid json
repo-settings-overlay.json     valid json
install.sh                     bash -n ok
```

But three suites fail, and two of them fail for the same reason:

```
assert-propagation                     exit 1
feature-propagation audit --self-test  exit 1

ReferenceError: reconcileRepoLocalManagedIds is not defined
    at Object.<anonymous> (super-gsd/scripts/merge-settings.js:812:5)
```

Line 812 is inside the `module.exports = { ... }` literal.

`Object.<anonymous>` is the module top level, so at the point the exports object
is constructed, that identifier is not in scope. The function does appear at
line 624 and is referenced successfully at line 656, so it is visible in at
least one inner scope but not at module scope when exports is evaluated.

Your diff hunks on this file were:

```
@@ -52,8   +52,9   @@ function readJsonOrEmpty(p)
@@ -579,7  +580,7  @@ function restoreEnvVar(name, value)
@@ -589,7  +590,7  @@ function mergeSettingsFiles(overlayPath, targetPath, repoRoot)
@@ -620,6  +621,27 @@ function dedupeExistingHooks(settings, repoLocal)   <-- 21 lines added here
@@ -631,6  +653,7  @@ function isSameStatusLine(a, b)
@@ -775,8  +798,17 @@ function main()
```

The 21-line insertion sits in the hunk whose context header is
`dedupeExistingHooks`. That is the first place to look.

## Severity, so you prioritise correctly

`merge-settings.js` is a SHARED INSTALLER SURFACE. While it throws on load, any
project that imports it is broken, not just this phase. Fix this first, before
anything else.

## Then the third failure

`assert-installer-registration-guard.cjs` exits 64 with a usage message listing
its cases, including a new `brokered-substrate-capability`. That is a
case-dispatching runner, so exit 64 with no `--case` is expected behaviour, not
necessarily a defect. Confirm the orchestrator should invoke it per case, and
tell me the exact command line for the case or cases T4 added.

## Then finish what the timeout interrupted

Check your own work for other incomplete edits: an exported name with no
definition is the signature of a cut-off run, so look for the same pattern
elsewhere across the seven files.

Re-check the coupling I warned about: if T4 added installed-agent substrate
occurrences, P166's exact single-consumption `caller-coverage` inventory must
account for them. Say what you found; do not loosen the inventory.

## Constraints

Seven files. Additive and idempotent in `install.sh` and `merge-settings.js`;
running the installer twice must not double-register.

Do not weaken T1 (34/34), T2 (13/13), T3 (4/4), or any P166 regression.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

You cannot run the fixture suites (`EPERM` at `mkdtemp`), but you CAN run
`node -e "require('./super-gsd/scripts/merge-settings.js')"` to prove the module
loads. Do that; it is the direct proof for the main fix.

Apply the merge-settings repair FIRST and emit `PROGRESS: merge-settings loads`
as soon as it does.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the scoping defect was, plus the exact registration-guard case commands
```
