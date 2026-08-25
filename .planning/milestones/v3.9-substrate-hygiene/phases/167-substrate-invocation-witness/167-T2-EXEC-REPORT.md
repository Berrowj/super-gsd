FILES_CHANGED: super-gsd/scripts/lib/vtp-context-composer.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs (created)  
FILES_CHANGED: super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs (modified)

VERIFICATION: `node --check super-gsd/scripts/lib/vtp-context-composer.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` -> exit 0  
VERIFICATION: `git diff --check -- <three T2 files>` -> exit 0  
VERIFICATION: `git diff --exit-code -- <two frozen files>` -> exit 0

DEVIATIONS: none

BLOCKERS: Fixture, nested-Node, red/green, and full regression suites remain ORCHESTRATOR_REQUIRED because the sandbox returns EPERM. They were not run here.

ONE_LINER: Acceptance now correlates only runtime project/session and composer-computed payload digest with an atomically consumed rewritten store row; two identical real calls produce two consumable rows and pass twice, while any acceptance beyond that count is rejected as replayed.
