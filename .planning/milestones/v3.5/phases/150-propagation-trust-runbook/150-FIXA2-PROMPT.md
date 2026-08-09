# P150-fixA2 — CONTINUE killed fixA

Partial state: sgsd-update-contract expanded to 24 tests (origin-validation cases added) but 14 RED (below); global-snapshot-contract untouched (still 5 tests — C3/C4 requirements NOT yet implemented); .orig files NOT yet deleted. FINISH the original fixA scope (.planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-FIXA-PROMPT.md): make sgsd-update 24/24, implement C3 (unknown-mutation detection + get-shit-done guard) and C4 (symlink-resolve-first + tar membership verification) with their new tests, delete both .orig files.

## Current sgsd-update reds
not ok 1 - Bash: check rejects a repointed origin before remote access or mutation
not ok 2 - Bash: update rejects a repointed origin before remote access or mutation
not ok 12 - PowerShell: check rejects a repointed origin before remote access or mutation
not ok 13 - PowerShell: update rejects a repointed origin before remote access or mutation
not ok 14 - PowerShell: clean behind source fast-forwards to captured SHA and installs globally
not ok 15 - PowerShell: tracked dirt fails before fetch, merge, pin, or install
not ok 16 - PowerShell: untracked dirt fails before fetch, merge, pin, or install
not ok 17 - PowerShell: locally-ahead source fails without changing HEAD
not ok 18 - PowerShell: diverged source fails without changing HEAD
not ok 19 - PowerShell: origin advance after fetch cannot change captured target or project pin
not ok 20 - PowerShell: installer failure preserves an existing project pin
not ok 21 - PowerShell: no-install mode fast-forwards but neither installs nor pins
not ok 22 - PowerShell: check mode is read-only and compares refs/heads/master, not remote HEAD
not ok 24 - updaters validate the resolved origin before any remote check or fetch

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
