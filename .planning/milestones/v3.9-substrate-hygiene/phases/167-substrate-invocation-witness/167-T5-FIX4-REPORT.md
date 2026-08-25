PROGRESS: report FINISH

FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs (modified)  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: combined module load -> exit 0  
VERIFICATION: typed descriptor and prompt contract probe -> exit 0  
VERIFICATION: exact typed comparison retention probe -> exit 0  
VERIFICATION: `git diff --check -- <two scoped files>` -> exit 0  
VERIFICATION: PowerShell no-token `--capture` case -> exit 1, printed `PROGRESS: harness_entry START` then `P167_T5_CAPTURE FAIL claude_auth_environment_missing`  
DEVIATIONS: none  
BLOCKERS: none  
ONE_LINER: The fixture now declares strict string, enum-array, and bounded-integer inputs, while the prompt explicitly requires `source_types` as a JSON array and `limit` as a JSON integer.
