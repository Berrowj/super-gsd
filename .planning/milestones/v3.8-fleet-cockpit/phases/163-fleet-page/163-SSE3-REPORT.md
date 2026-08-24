**FILES_CHANGED:** [server.cjs](/C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/fleet-cockpit/server.cjs:680), [run-self-test.cjs](/C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/fleet-cockpit/run-self-test.cjs:1092). `app.js` unchanged by this pass.

**VERIFICATION:** `deltas-across-rebuilds` 46/46; latest deltas 309ms/78ms, max lag 219ms. SSE lifecycle 49/49. Syntax and `git diff --check` pass.

**DEVIATIONS:** Full fleet suite 626/629; three real-Git cases hit managed-sandbox `spawnSync git EPERM`. Two documented skips. Separate cockpit-state suite remains 17/19 on A7/A10 fixture expectations.

**BLOCKERS:** None. No commit made.

**ONE_LINER:** Synchronous lane builds starved the event loop; serialized per-lane yields now let SSE, heartbeats, and fleet requests flush during rebuilds.
