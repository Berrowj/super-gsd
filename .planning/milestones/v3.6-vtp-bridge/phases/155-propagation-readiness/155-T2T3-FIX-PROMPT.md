# P155-T2-T3 fix pass — three CRITICALs from spec review, nothing else

Fresh context. You CANNOT spawn `claude` (EPERM); child-process harnesses may also be
sandbox-blocked — run what you can, report honestly, the orchestrator re-runs the rest.
Do NOT commit.

Read `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-T2T3-SPECREVIEW.md`
and the task block P155-T2-T3 in `155-01-PLAN-LOCKED.md`. Then fix exactly these three,
verified at these lines:

1. `super-gsd/tools/state-resolver/resolve.cjs:429,619,625` retain private integer-only
   git/activity phase-name regexes. Route them through the already-required
   `phase-name.cjs` (it is imported at line 62) so v-scheme and decimal names parse in
   those evidence tiers too. PRESERVE tier priorities, confidence values, conflict
   handling and repair recommendations bit-for-bit — only the name PARSING changes.
   That boundary was ruled clean so far; keep it clean.
2. `super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs:17` tests five
   tools but omits state-resolver. Add it to the matrix with the same
   layout/name/dedup/absence/sentinel cases, asserting on its JSON output.
3. `super-gsd/scripts/sgsd-distill-milestone.sh:146` — `"$pd"*SUMMARY.md` is missing the
   slash, so the glob matches nothing and the corpus is silently empty. Fix to
   `"$pd/"*SUMMARY.md`, and harden the test at lines 206-208 so an empty corpus FAILS
   (assert document count > 0 for a fixture that has summaries), because the current
   header-only check is how this slipped through.

Touch nothing else. Report format as before, max 200 words:
FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER
