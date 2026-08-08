# P150-T150-01c — Fix ROOT CAUSE in test fixtures: line-ending smudge makes fixture repos born-dirty

Diagnosis (orchestrator-verified): 'clean behind source' test fails with '[sgsd-update] Canonical source is dirty before fetch' — git status in the freshly created fixture repo shows 'M .gitattributes, M tracked.txt' from Windows line-ending smudging (host has core.autocrlf interplay). The dirty-guard WORKS; the fixtures are wrong. Fix the fixture/helper setup in super-gsd/tests/propagation/sgsd-update-contract.test.cjs: create every fixture repo with 'git init' + 'git config core.autocrlf false' (and commit files with LF, no .gitattributes text rules that re-smudge), so fixture repos are genuinely clean at birth on Windows. Then re-run the suite; fix any REMAINING reds that are real script defects (do not weaken guards). Target: 19/19.

Files: super-gsd/tests/propagation/sgsd-update-contract.test.cjs (primary); super-gsd/scripts/sgsd-update.sh / sgsd-update.ps1 only if remaining reds prove real defects.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
