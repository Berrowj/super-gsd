# P161 Audit — evidence gate record

Audited 2026-08-21 at phase close, orchestrator-verified.

- Plan GO 5/5 first round; validate.cjs exit 0.
- T1 (23de93b): .cjs glob fix (25 hooks land); measured installer profile
  (bash -x aggregation: cp 165s, mkdir 159s, tests 234s) led to batched copies:
  global install 6m04 -> 1m49. Four dispatches; 9/9 cases.
- T2 (a39549d): hook-manifest.json (surface-aware, reasoned native surfaces);
  five missing registrations added; manifest-vs-overlay tripwire; 10/10.
- T3 (71f940f, nine rounds): the REAL sgsd-update Clarity-recovery case (broken
  exit 5 with held pin -> repaired exit 0 with pin advance, dead rows preserved
  for operator-ordered removal). Converged on the governing principle: SGSD
  validates ONLY rows it owns; operator rows byte-preserved, never parsed.
  Along the way: args-form launches, tolerant global enumeration, coverage-
  conditional warn-downgrade, smoke-set correctness, native-surface exclusion,
  self-diagnosing assertions.
- Close review: BLOCKED (1 CRIT: distribution-created files skipped smoke) ->
  two fix rounds: post-distribution re-smoke with fail-loud broken-runtime
  regression; fixture ships the real sibling runtime; SAC name aliased.
- Final verification of record: all TWELVE case invocations exit 0
  (ten core cases + both recovery case names), 2026-08-21.

Verification command of record:

    node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case <any of 11 cases; sgsd-update-clarity-shape aliases the recovery case>
