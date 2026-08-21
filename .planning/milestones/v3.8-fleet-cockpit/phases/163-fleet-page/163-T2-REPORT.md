FILES_CHANGED: [run-self-test.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/fleet-cockpit/run-self-test.cjs), [FLEET-COCKPIT.md](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/docs/FLEET-COCKPIT.md), [server.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/fleet-cockpit/server.cjs).

VERIFICATION: page-http-delivery 93/93; page-data-contract 244/244; page-sort-comparator 41/41; page-render-structure 73/73; page-behaviour-structure 46/46; page-source-constraints 61/61; page-manual-checks-documented 54/54, one manual skip. Non-spawn suite: 1,477 assertions, zero failures. In-process adapter: 19/19. Syntax, ASCII, and diff checks pass.

DEVIATIONS: Added the authorized fixed static-route/CORS fallback because T1 had not served `public/`. Full fleet remains 577/579 and direct adapter 17/19 solely from sandbox `spawnSync` failures; adapter unchanged.

BLOCKERS: None. Phone check remains operator-owned and pending.

ONE_LINER: Production-backed page contracts and manual runbook implemented; no commit created.
