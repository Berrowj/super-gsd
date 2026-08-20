FILES_CHANGED: [write.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/state-write/write.cjs), [assert-state-write.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/state-close-contract/assert-state-write.cjs).

VERIFICATION: RED preserved: `seeded-future-dirs` failed 1/2 with `evidence_ahead` before implementation. GREEN: both new fixtures pass; atomic 8/8, backwards 12/12. Full command: 39/41—every writer case passed. Syntax and diff checks passed.

DEVIATIONS: None. Resolver untouched; no commit.

BLOCKERS: Unchanged `orchestrator-hook-wire` cannot spawn Bash in the managed Windows sandbox (`EPERM`), causing its two install assertions to fail.

ONE_LINER: Pending CONTEXT-only folder-tier evidence is now explicitly discounted and reported, while SUMMARY-backed ahead evidence and backward projection remain refused.
