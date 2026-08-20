FILES_CHANGED: `super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs`

VERIFICATION: Cleanup-contract PASS; syntax PASS; diff-check PASS.

DEVIATIONS: None.

BLOCKERS: Exact case blocked by sandbox: `spawnSync bash EPERM`; requires unsandboxed rerun.

ONE_LINER: Native `rmSync` retries protect every fixture teardown; exhausted cleanup warns without masking assertion verdicts.
