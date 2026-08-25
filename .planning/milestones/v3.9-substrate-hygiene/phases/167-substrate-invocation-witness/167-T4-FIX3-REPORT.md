FILES_CHANGED: none; partial edits were removed  
VERIFICATION: `node --check super-gsd/tools/feature-propagation/audit.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 0  
VERIFICATION: `node -e "require('./super-gsd/tools/feature-propagation/audit.cjs')"` -> exit 0  
VERIFICATION: `node -e "require('./super-gsd/tools/substrate-capability-broker.cjs')"` -> exit 0  
DEVIATIONS: none  
BLOCKERS: CRITICAL 1 requires modifying `super-gsd/tools/substrate-capability-broker.cjs`, an eighth file. Claude Code provides the stable invocation root through the spawned server’s `CLAUDE_PROJECT_DIR` environment variable, which the broker itself must read before falling back to `process.cwd()`. Config-argument substitution cannot establish that authority reliably. [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)  
ONE_LINER: No fix retained because invocation-project authority must be selected inside the broker runtime from `process.env.CLAUDE_PROJECT_DIR`, outside the authorized seven-file scope.
