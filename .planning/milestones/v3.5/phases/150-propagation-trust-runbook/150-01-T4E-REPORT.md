**FILES_CHANGED**

- [global-snapshot-contract.test.cjs]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tests/propagation/global-snapshot-contract.test.cjs:146) — handles symlink `EPERM` conditionally while retaining capable-host coverage.
- [sgsd-global-snapshot.sh]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/scripts/sgsd-global-snapshot.sh:70) — rejects all unexpanded tilde home paths before normalization.
- [sgsd-devcp-restart-evidence.sh]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/scripts/sgsd-devcp-restart-evidence.sh:72) — captures `/proc/<pid>/cmdline` via `printf -v` and `tr`.

**VERIFICATION**

- T150-04 contracts: 13 passed, 0 failed, 3 Bash-dependent skipped.
- Full P150 suite: 24 passed, 0 failed, 5 environment-skipped.
- Narrow acceptance probes: 3/3 passed.
- JavaScript syntax checks passed.
- Restart-evidence contract test 5 now passes.

**DEVIATIONS**

- Used Node’s in-process test isolation because the managed runner blocks child test processes.
- No scope deviations; unrelated worktree changes were untouched.

**BLOCKERS**

- Managed Windows runner denies Git Bash and WSL, preventing local execution of the three Bash-dependent snapshot cases.

**SCRIPTS_CREATED**

- None.

**ONE_LINER**

Three narrow fixes applied: Windows-safe symlink fixture, fail-closed tilde validation, and explicit process-cmdline evidence capture.

**STATUS**

PASS-WITH-ENVIRONMENTAL-SKIPS — zero observed failures.
