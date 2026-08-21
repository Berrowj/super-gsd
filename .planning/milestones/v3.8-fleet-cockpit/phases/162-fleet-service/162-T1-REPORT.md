FILES_CHANGED: `fleet.cjs`, `run-self-test.cjs`, and five `fixtures/lanes/*.json` snapshots.

VERIFICATION: PASS — 2/2 `node --check`; seven-file scope, require allowlists, read-only/no-CLI, ASCII, adapter untouched, case names, exact Git command; in-process parser/cache/fixture loads.

DEVIATIONS: Git/spawn cases authored but not run; no suites or commit, per instruction.

BLOCKERS: None.

ONE_LINER: Git-authoritative discovery now feeds a four-worker, timer-only, failure-isolated, row-first fleet cache.
