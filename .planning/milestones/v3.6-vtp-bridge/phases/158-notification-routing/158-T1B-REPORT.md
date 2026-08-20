FILES_CHANGED: `super-gsd/hooks/sgsd-intent-classifier.cjs`

VERIFICATION: `node --check` PASS; direct four-direction smoke PASS; P152 shadow test PASS; `git diff --check` PASS; independent review found no functional issues.

DEVIATIONS: Full self-test attempted but sandbox blocked `spawnSync` with `EPERM`; orchestrator must run it unsandboxed.

BLOCKERS: None.

ONE_LINER: Structural origin gate now silently records one text-free, zero-evaluation `automated_turn_skip` while preserving human, quoted-human, and `no_match` routing.
