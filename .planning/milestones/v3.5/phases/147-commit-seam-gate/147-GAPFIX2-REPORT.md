Changed [assert-real-commit-gate.cjs](/$HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tests/commit-gate/assert-real-commit-gate.cjs:1254) line 1254 only: `GSDedits` now uses `createTempGitRepo`; `devcp` remains bare on line 1255. No hook/libs touched; 204 assertion preserved.

Verification:
- `node --check super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` exit `0`
- `--scenario shadow-report-activation` exit `1`: sandbox blocks Node `spawnSync git` with `EPERM` at `git init`
- `--scenario ac-shadow-report-activation` exit `1`: same sandbox `EPERM`

Host-side rerun should now reach the staged activation branch with a real Git fixture.
