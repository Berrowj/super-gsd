FILES_CHANGED: super-gsd/tests/hook-transport/assert-live-dispatch.cjs (modified)
VERIFICATION: `node --check super-gsd/tests/hook-transport/assert-live-dispatch.cjs` → exit 0 ✓; `node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe no-match` → exit 1 ✗
DEVIATIONS: none
BLOCKERS: `node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe no-match` produced `live dispatch FAIL: spawn EPERM`; minimal `spawnSync` of `claude.exe --version` also returned `EPERM`. Genuine dispatch cannot run in this environment, so the classifier was not modified.
ONE_LINER: Updated the partial probe toward structural session-correlated attribution, then stopped when the environment blocked Node from spawning Claude.
