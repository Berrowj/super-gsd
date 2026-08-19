# P155-T2-T3 ATC fix pass — 1 CRITICAL + 2 WARNINGS, nothing else

Fresh context. Do NOT commit. Read `155-T2T3-ATC-REVIEW.md` in the phase dir, then fix:

1. CRITICAL, fail-loud discovery. `super-gsd/scripts/lib/phase-name.cjs` must
   distinguish "root absent" (legitimately empty, exit 0) from "discovery fault"
   (fs error other than ENOENT, unreadable dir, realpath failure): faults return a
   structured error and the CLI exits non-zero with a reason on stderr. The four shell
   consumers must check the CLI's exit status (and use pipefail where piped) so
   dashboard/distill FAIL on missing phase or corpus data instead of succeeding empty.
   Extend the matrix with a fault-injection case (unreadable dir) asserting non-zero.
2. WARNING, numeric-aware comparator. comparePhases must compare numeric segments
   numerically within each scheme: 14.2 < 14.10, v30-06.8 < v30-06.10, v30-6 < v30-10.
   Add exactly these three pairs to the parser self-test.
3. WARNING, missed creation site: remove the legacy `.planning/phases` creation from
   clean-room.sh (locate it; it was named by review). Same preserve-existing rule as
   install.sh. Add clean-room to assert-install-layout if it is executable in a fixture.
   For the duplication note: where assert-install-layout/assert-dual-root-resolvers
   repeat logic an existing owner has, call the owner; if non-trivial, leave and record
   under DEVIATIONS.

Tier semantics of resolve.cjs stay untouched. Report: FILES_CHANGED / VERIFICATION /
DEVIATIONS / BLOCKERS / ONE_LINER, max 150 words.
