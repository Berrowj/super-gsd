# P153 gap closure, option 3 — write the limitation into the probe. Comment-only.

Fresh context. Do NOT commit. One file: `super-gsd/tests/hook-transport/assert-live-dispatch.cjs`.

Operator decision 2026-08-20: gap plan option 3. Add a prominent documented-limitation
block at the file head (and a one-line pointer above the no-match assertion):

- The no-match probe CANNOT bind its evidence to the classifier specifically. Claude
  Code stream-json hook events carry hook_id/hook_name/session_id/exit_code/outcome/
  stdout but NOT the hook command (measured 2026-08-18, plan known_deadends).
- What holds instead: registration allowlist + classifier uniqueness + resolve-on-disk
  + full-lifecycle count + matched-probe stdout binding. Residual risk is
  TEST-INTEGRITY only: faking a no-match pass requires the classifier registered,
  resolving, and dispatching — in production that means it ran.
- Option 1 (transcript_path binding) stays contingent: the hook stdin payload field is
  UNVERIFIED; do not build on it without capturing a real payload first.

No behaviour changes. Comments only. Verify: node --check.
Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 60 words.
