IMPLEMENTATION / Fixed explicit project destinations so `mkContext()` uses `path.resolve(explicitProjectDir)`; ancestor `.planning` discovery now applies only when no destination is supplied. Shared check/repair detection and refusal text remain unchanged. Pre-writer ordering remains guarded on all entry points.

REGRESSION / Added spaced-path ancestor-`.planning` coverage. RED exit 1 before fix; GREEN exit 0 after fix.

ASSERTIONS / Restored `assert.ok(repoDistribution < …)` against the actual `codexCopy` call. The former target, `codexDistribution`, now represents detector inventory rather than the writer. Assertion statements: 261 → 271; no further removals.

VERIFICATION /

- Exit 0: `node --check` on both modified CJS files, feature-propagation self-test, `git diff --check`.
- Exit 0: `preflight-static`, `smoke-static`, `bundled-overlay-static`, `hook-manifest-completeness`.
- DENIED, exit 256: `bash -n super-gsd/install.sh` — Bash startup blocked with Win32 error 5.
- DENIED, exit 1 (`spawnSync bash/git EPERM`): remaining eight guards, including `vendored-nine-hook` and `node-check-both-sites`.

FILES / [audit.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/feature-propagation/audit.cjs), [guard](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs), [install.sh](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh).
