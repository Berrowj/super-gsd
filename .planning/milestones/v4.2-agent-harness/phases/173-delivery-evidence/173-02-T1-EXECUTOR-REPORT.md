FILES_CHANGED:
super-gsd/tools/codex-worker/mailbox.cjs (modified)
super-gsd/tools/codex-worker/run.cjs (modified)
super-gsd/tools/codex-worker/worker.test.cjs (modified)

VERIFICATION:
`node --test --test-name-pattern='exact owned identity rejects dead and PID-reused workers while unrelated workers remain live|owner-scoped control and inherited fan-out are enforced by the real mailbox path' super-gsd/tools/codex-worker/worker.test.cjs` -> exit 1 (RED)
`node --test --test-name-pattern='exact owned identity rejects dead and PID-reused workers while unrelated workers remain live|owner-scoped control and inherited fan-out are enforced by the real mailbox path' super-gsd/tools/codex-worker/worker.test.cjs` -> exit 0
`node --test super-gsd/tools/codex-worker/worker.test.cjs` -> exit 0 (36 pass, 2 skipped)
`git diff --check` -> exit 0

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Exact Linux worker identity, owner-scoped durable control rejection, and optional owner/workspace fan-out limits are implemented and verified.
