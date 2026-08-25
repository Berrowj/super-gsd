FILES_CHANGED

- [install.sh](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh)
- [audit.cjs](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/feature-propagation/audit.cjs)
- [guard](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs)

IMPLEMENTED

- Capability precheck now mirrors global/init/update repair flags.
- Codex precheck covers init, update, and global-with-project.
- `runAudit` performs shared read-only capability detection before publication.
- Guard explicitly inventories rejection-capable calls and forbids them after publication.
- P167 files untouched.
- `audit.cjs` diff: 99 changed lines; no redesign/staging machinery.

VERIFICATION

- PASS: focused RED/GREEN guard.
- PASS: malformed-capability no-mutation assertion.
- PASS: optional missing upstream exits 0 without writes.
- PASS: audit self-test 15/15.
- PASS: manifest check, both `node --check`, `git diff --check`.
- DENIED FIRST/LAST real install: `spawnSync bash EPERM`; 17/9 delivery not claimed.
- DENIED install-contract: 1 case passed before Bash `EPERM`.
- DENIED guard `--all`: 3/13 passed before Bash `EPERM`.
- DENIED `bash -n`: Git Bash `CreateFileMapping`, Win32 error 5.

Pre-existing untracked planning artifacts were untouched.
