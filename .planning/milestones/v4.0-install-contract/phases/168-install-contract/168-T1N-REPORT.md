STATUS: IMPLEMENTED — FULL VERIFICATION DENIED

FILE:
[assert-installer-registration-guard.cjs](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:997)

CHANGES:

- Matches the current update-mode preflight block.
- Replaces its body with `:` to preserve valid Bash syntax.
- Retains the production-preflight assertion.
- Runs argv-safe `bash -n` against the completed broken fixture.

VERIFICATION:

- PASS — `node --check`
- PASS — transformation probe
- PASS — `git diff --check`
- DENIED — guard `--all` after 3 static passes: `spawnSync bash EPERM`
- DENIED — install-contract after 1 static pass: `spawnSync bash EPERM`
- DENIED — targeted recovery reached the new syntax check, then `bash EPERM`

Only the guard was changed by me. Existing `install.sh` changes were untouched.
