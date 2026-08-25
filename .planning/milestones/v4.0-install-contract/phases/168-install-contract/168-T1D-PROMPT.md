# The new smoke is RIGHT. Eight guard fixtures are stale. Fix the fixtures, not the smoke.

Do not weaken the smoke. Do not redesign delivery. Both are confirmed working:

    [install-contract] generated-transitive-manifest       PASS
    [install-contract] empty-module-tree-real-install      PASS
    [install-contract] unresolved-module-refuses-before-write PASS

A real `install.sh --init-project` into an empty project tree from a decoy cwd now
completes and delivers 9 computed modules. That is the phase's core deliverable and it
works.

## What is failing and why it is correct

8 of 12 `assert-installer-registration-guard.cjs` cases now fail. The reason, taken from
`bundled-overlay-current`:

    {"ok":false,"reason":"hook_smoke_failed","underlying_error":{
      "code":"MODULE_NOT_FOUND","request":"ajv","path":null,
      "message":"hooks/sgsd-substrate-invocation-witness.cjs: required package is missing: ajv"}}

The witness hook requires the npm package `ajv`. The guard fixtures deliberately exclude
`node_modules` (P166/P167 trimmed fixture copying to ~402 files for speed). So in those
fixtures the hook genuinely cannot load, and the install correctly refuses rather than
registering a hook that would die at first fire.

Failing here is CORRECT product behaviour. A hook that cannot resolve a bare package in a
target project is as broken as one that cannot resolve a repo-owned module. Keep it fatal.

Failing cases: bundled-overlay-current, vendored-nine-hook, node-check-both-sites,
deployed-hook-smoke, hook-distribution-all-types, brokered-substrate-capability,
sgsd-update-clarity-shape, sgsd-update-clarity-recovery.

## What to build

`computeHookDependencyGraph` already classifies bare packages separately from repo-owned
modules (`packages` in its output). Use that.

Make the guard fixture builder provide exactly the bare packages the closure classifies.

IMPORTANT, verified by the orchestrator, do not assume otherwise: this repository has NO
node_modules directory of its own. `ajv` is declared in the repo package.json
(dependencies: ajv, ajv-errors, ajv-formats, better-sqlite3, gray-matter, js-yaml,
playwright) but resolves from a hoisted location OUTSIDE the repo, under the user's home
directory. Confirm for yourself with:

    node -e "console.log(require.resolve('ajv'))"

So locate each package with require.resolve(pkg) from the repository, walk up to its
node_modules/<pkg> root, and link or junction THAT into the fixture. Do not assume a
./node_modules exists.

Derive the package list from the closure's `packages` output. Do not hardcode `ajv`:
today it is ajv, tomorrow it is something else, and a hardcoded name is the staleness
trap this phase exists to remove.

Do NOT copy whole package trees where a link will do; the fixture trimming was a
deliberate MUDA fix and re-inflating it is a regression. If linking is unavailable on this
platform, copy only the resolved package root.

If a package cannot be resolved at all, the fixture must fail loudly naming it, not skip
the case.

## Constraints

- Never weaken or delete a guard assertion. Removals require a per-assertion reason.
- Fixture paths contain SPACES.
- Do not touch delivery, the closure computation, or the classifier.

## Verify

- All 12 cases of assert-installer-registration-guard.cjs, each with exit code
- node super-gsd/tests/install-contract/assert-install-contract.cjs (must stay 3/3)
- node --check on every file you modify

If your sandbox denies spawnSync/mkdtemp/bash, mark DENIED. The orchestrator re-runs
unsandboxed and rejects the change if anything is red. Do not ask for approval.

Standard block format, max 300 words.
