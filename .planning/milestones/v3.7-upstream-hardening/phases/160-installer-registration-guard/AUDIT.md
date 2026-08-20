# P160 Audit — evidence gate record

Audited 2026-08-20 at phase close, orchestrator-verified.

- Plan: 3 tasks, GO 5/5 first round; validate.cjs exit 0.
- T1 (e0b3d75): preflight lib + merge-boundary guard; four cases green including
  the exact Clarity vendored-nine-hook refusal (zero writes, byte-identical
  settings, per-path naming).
- T2 (1cf9a5a): bundled overlay refreshed to gpt-5.6-sol/DLB-01 contracts;
  mutation-proven stale-marker tripwire; five cases green.
- T3 (three dispatches: timeout-interrupted, completion, EBUSY-cleanup): shared
  dependency smoke in installer + test; per-hook budget with 15s Windows floor.
- Close review CRITICAL (the decisive catch): sed pipe swallowed preflight
  refusals under production `set -e` while the fixture injected pipefail —
  harness-production seam instance 14. Fixed by per-merge exit capture at both
  sites; fixtures now launch exactly `bash install.sh`; injected pipefail count 0.
- Final: all EIGHT guard cases exit 0, twice consecutively, under the exact
  production launch.

Verification command of record (each case, all exit 0, 2026-08-20):

    node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case <preflight-static|smoke-static|bundled-overlay-static|bundled-overlay-current|vendored-nine-hook|node-check-both-sites|canonical-sixteen-hook|deployed-hook-smoke>
