FILES_CHANGED: `super-gsd/registry/vtp-services.yaml`, `super-gsd/tools/vtp-readiness/registry.cjs`, `super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs`.

VERIFICATION (RED preserved): Initial command exited 1: missing registry/loader, `0/1 assertions passed`. Final command exited 0: `39/39 assertions passed`. Syntax, whitespace, and three-file scope checks passed.

DEVIATIONS: No implementation deviations. No commit created, per explicit instruction overriding the plan’s commit stop rule.

BLOCKERS: None. Full `npm test` remains sandbox-limited by existing `spawnSync bash EPERM` failures.

SCRIPTS_CREATED: `registry.cjs`; `assert-vtp-readiness.cjs`.

ONE_LINER: Added a names-only VTP topology registry and strict pinned-YAML loader with value-safe rejection reasons and home-expanded paths.
