# P161 close-fix (sole round) — re-smoke after distribution + SAC name reconcile

Files: super-gsd/install.sh, hook-registration-preflight.cjs, guard test.
Edits-first; no spawns; do NOT commit.

## CRITICAL (close review)

install.sh:715-716 excludes pre-distribution-missing descriptors from smoke.
Distribution then CREATES those local files, but their dependency smoke stays
skipped — an SGSD-owned hook can arrive broken and never fail loud (the D3
protection lost for exactly the update-recovery class).

Fix: AFTER distribution completes, re-evaluate the previously warn-excluded
descriptors: any whose script now exists gets the full smoke (and node --check)
then; failure is loud and fails the install, same contract as everywhere else.
Regression fixture: the recovery case (or a sibling case) distributes a local
hook whose runtime is broken (e.g. requires a missing sibling) — install must
fail naming that hook; the healthy path stays exit 0.

## Change 2

The plan's locked verification_cmd names the case `sgsd-update-clarity-shape`
while the test implements `sgsd-update-clarity-recovery`. Add the locked name
as an accepted alias in the case dispatcher (both names run the same case) so
the plan contract holds without rewriting history.

All eleven cases must stay green.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 120 words.
