FILES_CHANGED: `super-gsd/install.sh`; P160 installer guard test.

VERIFICATION (static): CJS syntax, preflight-static, smoke-static, bundled-overlay-static, source/order contracts, and `git diff --check` PASS.

DEVIATIONS: Spawn-bound cases deferred; bundled-overlay-current hit expected sandbox EPERM. No commit.

BLOCKERS: None.

ONE_LINER: Restored per-path missing-hook refusals and reduced distribution proof to one bounded, Windows-safe install.
