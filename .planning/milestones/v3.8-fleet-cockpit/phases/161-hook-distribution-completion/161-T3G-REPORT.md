FILES_CHANGED / [hook-registration-preflight.cjs](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-registration-preflight.cjs), [install.sh](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh)

VERIFICATION / Repaired shape PASS: 3 warned excluded, 2 existing smoked, uncovered dead row refused. Syntax, 3 static guards, diff-check PASS.

DEVIATIONS / `install.sh` required for cross-process threading; no tests changed or commit.

BLOCKERS / None.

ONE_LINER / Warn-downgraded dead project hooks now bypass dependency smoke; existing rows still smoke.
