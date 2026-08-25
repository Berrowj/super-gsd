FILES_CHANGED: [super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs:1163) (modified)

VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs` -> exit 0  
VERIFICATION: `git diff --check -- super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0

DEVIATIONS: none

BLOCKERS: Step 2 awaits the orchestrator-owned live capture output.

ONE_LINER: On lifecycle failure, fd 2 now reveals both complete hook summaries, distinct hook event types, and target tool-use count while leaving both assertions unchanged.
