# P150-T150-01b — CONTINUE killed T150-01: make the red contract tests green

Prior dispatch killed mid-task in TDD-red state: sgsd-update.sh/.ps1/SKILL.md modified, contract test file written, 6/19 passing. These 13 are RED:

not ok 1 - Bash: clean behind source fast-forwards to captured SHA and installs globally
not ok 4 - Bash: locally-ahead source fails without changing HEAD
not ok 5 - Bash: diverged source fails without changing HEAD
not ok 6 - Bash: origin advance after fetch cannot change captured target or project pin
not ok 7 - Bash: installer failure preserves an existing project pin
not ok 8 - Bash: no-install mode fast-forwards but neither installs nor pins
not ok 10 - PowerShell: clean behind source fast-forwards to captured SHA and installs globally
not ok 13 - PowerShell: locally-ahead source fails without changing HEAD
not ok 14 - PowerShell: diverged source fails without changing HEAD
not ok 15 - PowerShell: origin advance after fetch cannot change captured target or project pin
not ok 16 - PowerShell: installer failure preserves an existing project pin
not ok 17 - PowerShell: no-install mode fast-forwards but neither installs nor pins
not ok 19 - static updater and skill contract forbids pull and documents restart boundaries

Finish the implementation so all 19 pass. Do NOT restart or rewrite green parts. Original contract: .planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-01-T1-CODEX-EXECUTOR-PROMPT.md (clean-source, fetched-SHA and --ff-only guards; exit non-zero before writing .super-gsd-version on dirty/local-only/non-ff/fetch-fail/SHA-mismatch/installer-fail; call --update --install-global; preserve project config).

## Verify: node --test super-gsd/tests/propagation/sgsd-update-contract.test.cjs -> 19/19.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
