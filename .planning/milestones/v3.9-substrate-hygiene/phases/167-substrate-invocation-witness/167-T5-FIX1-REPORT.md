FILES_CHANGED: [super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs:585) (modified)  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `node -e "require('./super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs')"` -> exit 0  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 1, `P167_T5_HARNESS FAIL choose_exactly_one_mode`  
DEVIATIONS: none  
BLOCKERS: none  
ONE_LINER: `runClaudeProcess` killed timed-out children without rejecting, leaving `main` pending after the last live handle disappeared; timeout settlement, explicit rejection handling, early-exit guards, and persisted evidence parsing and verification now ensure exit 0 implies real evidence exists.
