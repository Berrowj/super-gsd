FILES_CHANGED: super-gsd/tests/hook-transport/assert-registration.cjs (modified)
VERIFICATION: `node --check super-gsd/tests/hook-transport/assert-registration.cjs` exit 0 pass; `node super-gsd/tests/hook-transport/assert-registration.cjs` exit 0 pass
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: Registration now validates both managed hook IDs, requires one classifier, preserves disk/hash checks, and reports dynamic counts.
