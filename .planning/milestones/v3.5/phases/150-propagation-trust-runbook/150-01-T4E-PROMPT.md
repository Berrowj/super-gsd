# P150-T150-04e — FINAL: three narrow fixes

13/16 green. Fix exactly these three:

1. global-snapshot-contract test 3 (line ~110): fixture fails with EPERM creating a symlink — Windows needs elevation/dev-mode for symlinks. Wrap the fixture's symlink creation in try/catch: on EPERM, skip the symlink-specific sub-assertions (t.skip or conditional) while keeping the rest of the round-trip assertions running. Environment guard, standard Windows pattern — do not delete the symlink coverage for capable hosts.
2. global-snapshot-contract test 5: sgsd-global-snapshot.sh accepts literal '~' as a home and exits 0 — its unsafe-home validation must reject '~' (and any unexpanded tilde path) with non-zero fail-closed.
3. restart-evidence-contract test 5: sgsd-devcp-restart-evidence.sh must capture process command lines: the regex requires printf adjacent to cmdline — capture /proc/<pid>/cmdline (tr '\0' ' ' via printf or equivalent) into the evidence JSON.

Files: super-gsd/tests/propagation/global-snapshot-contract.test.cjs (item 1), super-gsd/scripts/sgsd-global-snapshot.sh (item 2), super-gsd/scripts/sgsd-devcp-restart-evidence.sh (item 3).

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
