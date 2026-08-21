FILES_CHANGED / `status.cjs`, `fleet.cjs`, `server.cjs`, `run-self-test.cjs`, `noise-artifacts-source.json`, two later-run event fixtures.

VERIFICATION / later-run 45/45; frame-coalescing 41/41; artifacts 42/42; status-precedence 73/73; scheduler 46/46; spawn-free cases 19/19; syntax 4/4; diff-check PASS; adapter untouched.

DEVIATIONS / No commit. Adapter baseline uses an in-process writer seam to honor no-spawn.

BLOCKERS / Default-bind loudly SKIPPED because `127.0.0.1:7777` is occupied. Full suite: 217/219, one skip; two legacy Git-fixture cases blocked because sandbox denies nested `spawnSync git` with `EPERM`.

ONE_LINER / All four fixes landed; unrestricted rerun is needed solely for real default-bind and legacy Git-fixture evidence.
