FILES_CHANGED: [write.cjs](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/state-write/write.cjs:334); [assert-state-write.cjs](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/state-close-contract/assert-state-write.cjs:19).

VERIFICATION: Resolver self-test PASS 14/14. Writer non-installer cases PASS 22/22. Full suite: 35/37. Red proof captured pre-fix: ambiguity fixture failed 0/2, returning `state_updated` and modifying STATE.

DEVIATIONS: None; no commit.

BLOCKERS: Managed sandbox denies all Node child-process spawning. Installer case correctly fails loudly with `spawn EPERM: spawnSync bash EPERM`; no self-copy occurs, so the required all-case pass cannot be produced here.

ONE_LINER: Duplicate ROADMAP identities now fail closed byte-identically, and the installer test can no longer self-fulfil SAC-3.
