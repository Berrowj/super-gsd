FILES_CHANGED: `super-gsd/hooks/sgsd-intent-classifier.cjs` — red-first fixtures only.

VERIFICATION (RED preserved): `--self-test` failed loud before genuine RED: `spawnSync ... node.exe EPERM`. Pre-gate fixtures remain intact.

DEVIATIONS: Production origin gate not added; strict TDD requires an expected behavioral RED first.

BLOCKERS: Sandbox denies Node child processes. Re-run unsandboxed as specified.

ONE_LINER: Three-direction production-stdin falsifier added; stopped safely at spawn blocker.
