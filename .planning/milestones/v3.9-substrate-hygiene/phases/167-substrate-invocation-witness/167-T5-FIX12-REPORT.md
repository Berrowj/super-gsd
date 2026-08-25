Root cause fixed locally. The authenticated live capture remains pending because this shell lacks Claude auth.

FILES_CHANGED: [capture-live-runtime.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs:1445) (modified)

VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs` -> exit 0  
VERIFICATION: inline red tally regression probe -> exit 1, expected `writer_field=fixture_event_counts`  
VERIFICATION: inline green tally regression probe -> exit 0, `writer_field=event_counts`  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0, 37/37  
VERIFICATION: `git diff --check -- super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: PowerShell SHA-256 comparison -> exit 0, both overlay pins match hook digest `55c1780a82bcd60646fa54f96e507214ec3a70c294d8b8437aa0d412b013f137`  
VERIFICATION: `node ...capture-live-runtime.cjs --capture ...` -> exit 1, `claude_auth_environment_missing`

DEVIATIONS: Fresh live capture could not run; exact real-verifier red/green probe used locally. No evidence file was created or hand-written.

BLOCKERS: Rerun the capture command from an authenticated PowerShell session, then run `--verify`.

ONE_LINER: Cause 2 at the writer/verifier contract boundary: the active writer stored the final tally as `fixture_event_counts` while the verifier read `event_counts`; it now stores `fixtureLogSnapshot`’s final `event_counts` beside the exact `redacted_observations` the verifier recounts.
