# One stale fixture marker. Everything else is green. Do not change install.sh.

Verified green by the orchestrator on the current tree:

- Real install from a different cwd into an empty project: exit 0, 17 hooks and 9
  `scripts/lib` modules delivered.
- install-contract 3/3.
- installer-registration-guard: 11 cases PASS, then one failure below.
- `bash -n install.sh` clean. P167 hook contract 38/38, prompt contracts 4/4.

## The failure

    FAIL: AssertionError: production installer lost existing-project preflight
      at removeBrokenGlobalCoverage (assert-installer-registration-guard.cjs:1011)
      at commitClarityUpdateSource (:2170)
      at createClarityUpdateGitFixture (:2237)
      at runSgsdUpdateClarityRecovery (:2770)

Guard line 1010-1012 expects this exact text in install.sh:

    '  preflight_existing_repo_local_hooks || return $?\n'

and then string-replaces it with '' to build a deliberately broken control.

## Why the marker is stale, and why install.sh is CORRECT

The spec-review fix moved the preflight out of a function and up to the top-level
pre-write block, which is exactly what "run rejection-capable checks before the first
write" required. It now reads:

    if [ "$INIT_LOCAL" = true ] || [ "$UPDATE_MODE" = true ] || [ "$INSTALL_GLOBAL" = true ]; then
      precheck_installation_refusals
      if [ "$INSTALL_GLOBAL" = true ]; then
        precheck_global_installation
      fi
      if [ "$UPDATE_MODE" = true ]; then
        preflight_existing_repo_local_hooks
      fi
      ...

`|| return $?` was dropped because the call is no longer inside a function. `set -e` is
active at install.sh:7, so a non-zero return still aborts the whole script. Failure
propagation is preserved, arguably more strictly than before. Do NOT re-add `|| return $?`
at top level and do NOT move the call back into a function.

## Fix the fixture only

Update `removeBrokenGlobalCoverage` to locate and neutralise the CURRENT call.

The subtlety that will bite you: the call now sits inside
`if [ "$UPDATE_MODE" = true ]; then ... fi`. Deleting just the call line leaves an empty
`if` body, which is a bash syntax error, and the broken control would then fail for the
wrong reason. Neutralise it in a way that keeps install.sh syntactically valid, for
example by replacing the whole `if` block or substituting a no-op body.

After building the broken control, assert it is still syntactically valid bash before
using it, so a future marker drift fails loudly with a clear message instead of producing
a control that is broken for an unintended reason.

Keep the existing assertion's intent: the fixture must still fail loudly if the
production installer ever genuinely loses its existing-project preflight.

## Constraints

- Only the guard file. Do not touch install.sh or any production file.
- Never weaken or delete an assertion.
- Fixture paths contain SPACES.

## Verify

- installer-registration-guard `--all` 13/13
- install-contract 3/3
- `node --check` on the guard file

Sandbox denials: mark DENIED, never as passing. The orchestrator re-runs unsandboxed.
Do not ask for approval.

Standard block format, max 200 words.
