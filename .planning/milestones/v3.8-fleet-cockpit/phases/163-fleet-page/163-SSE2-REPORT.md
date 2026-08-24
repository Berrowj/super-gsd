FILES_CHANGED: [app.js](/C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/fleet-cockpit/public/app.js), [run-self-test.cjs](/C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/fleet-cockpit/run-self-test.cjs)

VERIFICATION: Syntax/diff checks PASS; structural 50/50; SSE 49/49. Full suite 616/619, 2 skipped.

DEVIATIONS: None. No commit made.

BLOCKERS: Three unrelated discovery tests hit sandbox `spawnSync git EPERM`.

ONE_LINER: EventSource now waits for load; Codex DOM output stays capped at 64KB.
