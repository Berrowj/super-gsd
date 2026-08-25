FILES_CHANGED: [super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs:157) (modified)

VERIFICATION: payload-contract RED probe -> exit 1, `exact_digest_contract_mode_missing`  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: module-load probe -> exit 0  
VERIFICATION: exact-versus-semantic payload probe -> exit 0  
VERIFICATION: `PowerShell ProcessStartInfo: remove CLAUDE_CODE_OAUTH_TOKEN and ANTHROPIC_API_KEY; node capture-live-runtime.cjs --capture ...` -> harness exit 1, stdout 0B, stderr 83B, evidence absent:
`PROGRESS: harness_entry START`
`P167_T5_CAPTURE FAIL claude_auth_environment_missing`  
VERIFICATION: missing-evidence `--verify` -> exit 1  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0, 34/34  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0, 4/4  
VERIFICATION: `git diff --check -- super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0

DEVIATIONS: Semantic-only equality was not adopted. Exact serialization digest identity correlates the composer payload with fixture lookup, both hooks, the witness record, and acceptance consumption. A semantic-only pass would weaken the scenario while later digest checks still failed. GNU `env.exe` could not run inside the sandbox due MSYS `CreateFileMapping` error 5, so case C used an equivalent child environment with both credentials removed.

BLOCKERS: none

ONE_LINER: Git Bash resolved `env` to `C:\Users\jack.berrow\.local\bin\env`, a shell initialization snippet that ignores its arguments and exits 0, so Node never launched and no output streams were destroyed.
