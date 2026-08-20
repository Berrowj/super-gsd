FILES_CHANGED — [install.sh](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh) and [guard test](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs).

VERIFICATION (static) — Syntax, three static cases, exact launch, both status/stderr paths, vendored-nine non-zero/zero-write assertions, and `git diff --check` passed.

DEVIATIONS — Used per-merge capture, preserving unrelated pipeline semantics. Dynamic fixtures blocked by sandbox `spawnSync bash EPERM`.

BLOCKERS — None.

ONE_LINER — Plain `bash install.sh` now terminates on either refused merge with its original exit code and visible stderr.
