# P160-T3C — one deterministic fixture-cleanup failure (Windows EBUSY)

Single file: `super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs`.
Edits-first; no spawns; do NOT commit; touch nothing else.

`--case canonical-sixteen-hook` now passes ALL assertions but fails
deterministically at teardown:
`Error: EBUSY: resource busy or locked, rmdir '...\sgsd-registration-canonical-sixteen-...\target project'`
A spawned child (or Windows indexing) still holds the temp dir when rmSync runs.

Fix in the test's cleanup only:
1. Retry rmSync with backoff (e.g. up to 5 attempts over ~2s, fs.rmSync
   {recursive, force, maxRetries, retryDelay} already supports this natively —
   prefer the native options).
2. If cleanup STILL fails after retries, WARN with the path and continue with
   the case verdict from its assertions — cleanup failure must never mask a
   passing case (nor a failing one). Apply the same cleanup helper to every
   fixture in this file so the flake class is closed once.

This mirrors the survive-Windows-EPERM-on-rename precedent (commit 0657c68).

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 80 words.
