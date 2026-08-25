PROGRESS: instrumentation FINISH PASS  
PROGRESS: root_cause_capture BLOCKED ORCHESTRATOR_REQUIRED

Added failure-only fd 2 diagnostics to [capture-live-runtime.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs). It now prints redacted expected/actual payloads, key/type/digest comparison, and fixture rows.

Active-path and absent-guard assertions were untouched. No evidence file was fabricated. No commit was made.

The orchestrator must rerun:

```powershell
node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --capture --project-dir . --evidence-file .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json
```

Return the four `PROGRESS: bypass_alternate_payload ...` lines so the evidence-backed repair can be selected.

FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs (modified)  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `git diff --check -- super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs` -> exit 0  
VERIFICATION: `PowerShell hook SHA-256 and two-pin equality check` -> exit 0, hash `55c1780a82bcd60646fa54f96e507214ec3a70c294d8b8437aa0d412b013f137`  
DEVIATIONS: none  
BLOCKERS: Orchestrator-owned live Claude capture is required before judging and implementing either repair branch  
ONE_LINER: The mismatch cause is not yet evidenced; the positive bypass characterisation remains exact and unchanged until the new diagnostics prove whether the model retyped the payload or fixture reachability should be marker-bound.
