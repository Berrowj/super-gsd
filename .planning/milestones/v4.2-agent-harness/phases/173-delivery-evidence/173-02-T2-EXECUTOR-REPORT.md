FILES_CHANGED: super-gsd/tools/codex-worker/run.cjs (modified)  
super-gsd/tools/codex-worker/mailbox.cjs (modified)  
super-gsd/tools/codex-worker/worker.test.cjs (modified)

VERIFICATION: `node --test --test-name-pattern='delivery observation keeps process outcome report validity observed delivery and independent verification separate|empty malformed and unacknowledged reports never complete while nonzero exit preserves delivery evidence|retained continuation binds its exact owned instance and result' super-gsd/tools/codex-worker/worker.test.cjs` -> exit 1 (RED)  
`node --test --test-name-pattern='delivery observation keeps process outcome report validity observed delivery and independent verification separate|empty malformed and unacknowledged reports never complete while nonzero exit preserves delivery evidence|retained continuation binds its exact owned instance and result' super-gsd/tools/codex-worker/worker.test.cjs` -> exit 0  
`node --test super-gsd/tools/codex-worker/worker.test.cjs` -> exit 0  
`git diff --check` -> exit 0

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: T2 persists and exposes separate, bounded delivery evidence while retaining observed metadata across non-success outcomes.
