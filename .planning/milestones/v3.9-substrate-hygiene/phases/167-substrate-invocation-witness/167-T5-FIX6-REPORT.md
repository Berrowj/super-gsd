FILES_CHANGED: `super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` (modified)

VERIFICATION: PowerShell inline stream-json lifecycle/redaction regression -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `git diff --check -- super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0 (34/34)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0 (4/4)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 1 (sandboxed child process returned status null)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 1 (`spawnSync node.exe EPERM`)

DEVIATIONS: none

BLOCKERS: Live capture was not run because it would invoke `claude`, which was explicitly prohibited. Two surrounding spawn-bound suites remain sandbox-blocked as reported above.

ONE_LINER: Real events use `type: "system"`, `subtype: "hook_started" | "hook_response"`, `hook_event: "PreToolUse" | "PostToolUse"`, and a tool-qualified `hook_name`; attribution now matches `type` plus `hook_event` and splits on `subtype`, retaining the 2/2 PreToolUse assertion.
