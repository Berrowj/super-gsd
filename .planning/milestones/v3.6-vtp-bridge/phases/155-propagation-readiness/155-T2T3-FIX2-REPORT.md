FILES_CHANGED / `super-gsd/scripts/sgsd-distill-milestone.sh` — added both missing phase-directory slashes.

VERIFICATION / `git diff --check` PASS; audit self-test 13/13; resolver self-test 14/14; dual-root audit 49/49; static glob check 3/3. Empty-corpus assertion already exists (`documentCount > 0`). Resolver sites 429, 623/625, and 632/634 route tokens through `phase-name.cjs`; no sibling private phase-name regex found. Priorities/confidence/repairs unchanged.

DEVIATIONS / No test or resolver edits required. No commit created.

BLOCKERS / Full installer/distill child-process matrix blocked by sandbox: Git Bash `CreateFileMapping` Win32 error 5 and `spawnSync` returned `status=null`.

ONE_LINER / Remaining P155-T2-T3 corpus-path defect is fixed; executable verification is clean where sandbox permits.
