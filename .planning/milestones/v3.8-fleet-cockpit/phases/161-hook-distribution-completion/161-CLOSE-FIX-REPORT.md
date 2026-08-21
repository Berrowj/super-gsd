FILES_CHANGED / `install.sh`, `hook-registration-preflight.cjs`, guard test. No commit.

VERIFICATION (static) / Node syntax, `preflight-static`, `smoke-static`, `bundled-overlay-static`, `hook-manifest-completeness`, and `git diff --check` PASS.

DEVIATIONS / Spawn-bound eleven-case matrix and `bash -n` unavailable in managed sandbox (`EPERM`).

BLOCKERS / None for static proof; orchestrator must run the full matrix.

ONE_LINER / Post-distribution restored hooks now receive node-check and dependency smoke; broken recovery fails naming the hook, while `sgsd-update-clarity-shape` aliases the recovery case.
