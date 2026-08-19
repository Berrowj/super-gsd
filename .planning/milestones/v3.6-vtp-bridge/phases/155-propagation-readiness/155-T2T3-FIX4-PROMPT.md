# P155-T2-T3 final completion — two precise deltas, prior pass timed out after landing most edits

Fresh context. Do NOT commit. Fix ONLY these two, verified just now:

1. `super-gsd/tests/propagation-readiness/assert-install-layout.cjs:121-124` asserts the
   clean-room tmpdir still exists AFTER the run — but clean-room deletes itself on exit,
   so the assertion inspects a ghost. Rework: either use a keep/inspect flag if
   clean-room.sh offers one, or have the fixture capture the legacy-root check DURING
   the run (e.g. clean-room emits a line stating whether .planning/phases was created,
   assert on that output), never on post-exit filesystem state.
2. `distill/missing-corpus` matrix case: sgsd-distill-milestone.sh still exits 0 when
   the corpus is missing. The fail-loud rule that reached the dashboard consumer must
   reach distill's missing-corpus path: no phase documents found => non-zero exit with
   a reason on stderr. Keep the legitimate empty-milestone distinction if one exists.

Everything else is green or accepted-T4b-pending. Touch nothing else. Verify:
  node super-gsd/tests/propagation-readiness/assert-install-layout.cjs --case all
  node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool distill --case full-matrix
Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.
