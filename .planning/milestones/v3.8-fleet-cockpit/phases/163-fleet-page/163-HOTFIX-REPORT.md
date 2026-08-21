FILES_CHANGED: `server.cjs`, `fleet.cjs`, `run-self-test.cjs`  
VERIFICATION: RED reproduced (0/7); focused 55/55 + 40/40; production-path real-frame probe 7/7; syntax/diff checks clean. Full suite: 584/587, 2 skipped.  
DEVIATIONS: Three `spawnSync git EPERM` failures because the managed sandbox blocks Node→Git; no commit made.  
BLOCKERS: Native `production-discovery` guard needs rerunning outside this sandbox.  
ONE_LINER: Production now performs bounded, stderr-captured, read-only Git discovery every cache cycle and exposes failures through `last_discovery_error` without crashing.
