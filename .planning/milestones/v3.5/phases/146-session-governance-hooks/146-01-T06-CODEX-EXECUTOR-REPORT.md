DONE

FILES_CHANGED: `super-gsd/tools/cockpit-state/adapter.cjs` (modified)

VERIFICATION: `node --check super-gsd/tools/cockpit-state/adapter.cjs` → exit 0 ✓  
VERIFICATION: `node --check super-gsd/tools/warp-mcp/server.cjs` → exit 0 ✓  
VERIFICATION: `T146-06 real-hook row → adapter/MCP exact phase+file_path` → exit 0 ✓  
VERIFICATION: `T146-06 ledger absent full snapshot` → exit 0 ✓  
VERIFICATION: `T146-06 ledger empty full snapshot` → exit 0 ✓  
VERIFICATION: `T146-06 corrupt line then valid row` → exit 0 ✓  
VERIFICATION: `T146-06 reader twice byte-identical hash` → exit 0 ✓  
VERIFICATION: `T146-06 no-governance regression sections` → exit 0 ✓  
VERIFICATION: `T146-06 adapter/MCP governance parity` → exit 0 ✓  
VERIFICATION: `git diff --check -- adapter.cjs` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Added `data.gates.governance.missing_plan` using T146-01 `readGateEvidenceRows` with `limit: 100`; that bounds refresh cost while reliably catching freshly emitted rows, and MCP surfaces the same values through its existing adapter delegation.
