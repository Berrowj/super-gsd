FILES_CHANGED: [sgsd-update-contract.test.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tests/propagation/sgsd-update-contract.test.cjs:36) only. Added init/config-first helpers, replaced fixture clones, and removed `.gitattributes`.

VERIFICATION:

- `node --check ...` — PASS
- Direct Git fixture probe — all four repos `core.autocrlf=false`; all worktrees clean; LF confirmed
- Static updater contract checks — PASS
- Exact 19-test suite — blocked before execution by sandbox `spawn EPERM`

DEVIATIONS: Production updater scripts were not changed. Full 19/19 runtime verification was unavailable.

BLOCKERS: Managed Windows sandbox denies Node child processes and MSYS runtime startup.

SCRIPTS_CREATED: None.

ONE_LINER: Fixture repos now disable line-ending conversion before materializing files, so they are born clean on Windows.

STATUS: BLOCKED — implementation complete; 19/19 requires rerunning outside the managed sandbox.
