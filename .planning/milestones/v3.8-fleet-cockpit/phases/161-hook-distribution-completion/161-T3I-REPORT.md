FILES_CHANGED / [hook-registration-preflight.cjs](/C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-registration-preflight.cjs), [guard test](/C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs). No commit.

VERIFICATION / Red→green `preflight-static`; full T3H walk PASS: 3 broken refusals, 12 broken-smoke rows, 3 repaired warnings, 1 repo-smoke row, 13 global event hooks, 15 deployment-smoke rows. Prompt, garbage-command, and foreign operator rows ignored and byte-stable. Syntax, smoke-static, bundled-overlay-static, manifest completeness, and diff-check PASS.

DEVIATIONS / Spawned recovery unavailable: sandbox rejects child `git`/`bash` with EPERM.

BLOCKERS / None for required static proof.

ONE_LINER / Preflight now validates only overlay, `sgsd_managed`, or manifest-identity coverage rows; operator rows remain invisible.
