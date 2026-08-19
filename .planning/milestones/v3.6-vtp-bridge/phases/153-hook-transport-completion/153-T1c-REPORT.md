FILES_CHANGED: super-gsd/hooks/sgsd-intent-classifier.cjs (modified); super-gsd/tests/hook-transport/assert-live-dispatch.cjs (modified)
VERIFICATION: `node --check super-gsd/hooks/sgsd-intent-classifier.cjs` → exit 0 ✓; `node --check super-gsd/tests/hook-transport/assert-live-dispatch.cjs` → exit 0 ✓
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: Classifier now records explicit matched/no_match decisions without no-match injection; probe uses the real session-correlated routing ledger.
