# One defect left in P168-T1. The product works; the test duplicates the old rule.

Do not redesign anything. The delivery mechanism is CONFIRMED WORKING by the orchestrator:
a real `install.sh --init-project --project-dir <empty project>` run from a decoy cwd with
an isolated HOME now completes, and 9 computed modules land in the project tree including
`sgsd-state.cjs`, `gate-evidence-log.cjs`, `vtp-context-composer.cjs` and
`substrate-invocation-witness-store.cjs`. Do not touch that.

## The remaining failure

`super-gsd/tests/install-contract/assert-install-contract.cjs`, `finalHookExecutions`,
line ~330, still calls `assertSpawn` on every post-install hook execution and so treats any
non-zero exit as failure. It trips on the same gate hook as before:

    [validate-stop-contract] blocked: missing_report        exit 1

You fixed this classification inside `hook-registration-preflight.cjs`'s smoke, but the
test carries its own copy of the old rule.

## Fix, and the constraint matters more than the fix

Make `finalHookExecutions` use the SAME classification the preflight smoke uses. Export the
classifier from `hook-registration-preflight.cjs` and call it from the test.

Do NOT re-implement the `blocked|denied|refused` heuristic in the test. Two copies of one
rule is precisely the drift this phase exists to eliminate: the whole root cause was a
manifest that disagreed with reality because two things were maintained separately. One
classifier, imported by both callers.

While you are there, state in your report how the classifier decides, in one sentence, so
the orchestrator can judge whether the signature test is robust. If a gate hook blocks
WITHOUT printing a recognised word, it will still fail an install; say whether you think
that residual risk is acceptable and why. Do not add a hook-name list to work around it.

## Verify

- node super-gsd/tests/install-contract/assert-install-contract.cjs   (BOTH cases green)
- node --check on every file you modify

Real installs spawn bash; if your sandbox denies spawnSync/mkdtemp, mark DENIED. The
orchestrator re-runs unsandboxed and rejects the change if anything is red. Do not weaken
or delete a case. Do not ask for approval.

Standard block format, max 250 words.
