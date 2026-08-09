# P150-fixA3 — CONTINUE: finish fixA scope; you have a 40-minute window this time

Two prior rounds were killed at 20min. Current reds (14 total):
not ok 14 - PowerShell: clean behind source fast-forwards to captured SHA and installs globally
not ok 17 - PowerShell: locally-ahead source fails without changing HEAD
not ok 18 - PowerShell: diverged source fails without changing HEAD
not ok 19 - PowerShell: origin advance after fetch cannot change captured target or project pin
not ok 20 - PowerShell: installer failure preserves an existing project pin
not ok 21 - PowerShell: no-install mode fast-forwards but neither installs nor pins
not ok 22 - PowerShell: check mode is read-only and compares refs/heads/master, not remote HEAD
---snapshot---
not ok 3 - snapshot round trip preserves exact pre-install manifest and quarantines candidate
not ok 4 - restore keeps a target that was absent before install absent
not ok 5 - unsafe homes and an installer contract mismatch fail closed
not ok 6 - unknown installer mutation targets fail the snapshot contract
not ok 7 - create fails closed before bootstrap when get-shit-done is absent
not ok 8 - restore rejects a symlinked failed-candidate directory before live-target mutation
not ok 9 - restore rejects an archive with out-of-bound membership before extraction

Original scope: .planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-FIXA-PROMPT.md (origin allowlist validation both shells; snapshot unknown-mutation detection + get-shit-done guard; symlink-resolve-first + tar membership verification; delete the two .orig files — STILL PRESENT, delete them). Do not restart green work.

## PROGRESS CONTRACT (mandatory)
Append stage lines to .planning/metrics/dispatch-progress.txt: fixA3|<utc>|started, |edits-done, |verifying, |reporting, and FINAL: |done. If short on time: skip polish, write the report EARLY, mark done — partial report beats a timeout kill.

## Verify: both suites fully green; report exact counts.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
