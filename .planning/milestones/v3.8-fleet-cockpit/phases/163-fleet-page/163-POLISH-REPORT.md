FILES_CHANGED: `public/index.html`, `public/app.js`, `server.cjs`, `run-self-test.cjs`.

VERIFICATION: Syntax 3/3; targeted route/page suites all pass (643 assertions); `git diff --check` clean. No commit created.

DEVIATIONS: Aggregate suite 600/603 with three existing Git-fixture cases blocked by `spawnSync git EPERM`; two documented skips. No browser respawned per constraint.

BLOCKERS: None.

ONE_LINER: SGSD identity restored; selected lanes now expose curated state and a safe, auto-refreshing 16KB Codex live tail.
