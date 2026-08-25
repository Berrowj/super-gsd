FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs (modified)  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `PowerShell inline Node bypass payload-choice regression` -> exit 0  
VERIFICATION: `PowerShell scenario contract-preservation scan` -> exit 0  
VERIFICATION: `git diff --check -- super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs` -> exit 0  
VERIFICATION: `PowerShell hook SHA-256 and two-pin equality check` -> exit 0, hash `55c1780a82bcd60646fa54f96e507214ec3a70c294d8b8437aa0d412b013f137`  
DEVIATIONS: none  
BLOCKERS: Orchestrator-owned live capture and subsequent evidence verification remain; no evidence file was fabricated  
ONE_LINER: The bypass characterisation now proves marker-bound alternate-registration and direct stdio fixture reachability with zero matching witness rows, and no longer requires the model's alternate payload to byte-match the requested non-v2 payload or be fixture-accepted.
