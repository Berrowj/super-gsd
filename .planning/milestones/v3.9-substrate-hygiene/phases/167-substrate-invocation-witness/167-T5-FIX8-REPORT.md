PROGRESS: capture_handoff

Instrumentation is ready. The orchestrator must run:

```powershell
node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --capture --project-dir . --evidence-file .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json
```

It will print `PROGRESS: actual_post_tool_response_shape=<redacted-shape>`. Return that line for the parser and passthrough repair. The capture is expected to remain red at the existing valid-result assertion.

FILES_CHANGED: [super-gsd/hooks/sgsd-substrate-invocation-witness.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/hooks/sgsd-substrate-invocation-witness.cjs) (modified)  
FILES_CHANGED: [super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs) (modified)  
FILES_CHANGED: [super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs) (modified)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0, baseline 34/34  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 1, expected RED: descriptor missing  
VERIFICATION: `node --check super-gsd/hooks/sgsd-substrate-invocation-witness.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0, 35/35  
VERIFICATION: `git diff --check -- super-gsd/hooks/sgsd-substrate-invocation-witness.cjs super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
DEVIATIONS: Parser and failure semantics remain unchanged until the real runtime shape is captured, as required  
BLOCKERS: Orchestrator-owned Claude runtime capture is required before implementing the production parser fix  
ONE_LINER: Real response shape is not yet evidenced; in this instrumentation-only stage an unparseable response still errors, pending the captured shape and fail-safe repair.
