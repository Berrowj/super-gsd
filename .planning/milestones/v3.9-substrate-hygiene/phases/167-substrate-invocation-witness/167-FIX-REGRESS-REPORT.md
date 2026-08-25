FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs (modified)  
FILES_CHANGED: super-gsd/agents/sgsd-board-researcher.md (modified)  
FILES_CHANGED: super-gsd/agents/sgsd-vtp-enrichment.md (modified)  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 0  
VERIFICATION: production dependency load check -> exit 0  
VERIFICATION: prompt/protected-path static load check -> exit 0  
VERIFICATION: frozen-file SHA-256 load check -> exit 0  
DEVIATIONS: none  
BLOCKERS: none  
ONE_LINER: Kept the condensed prompt sentence and updated T3 to assert it exactly; protection remains on `~/.claude/settings.json` because the host runtime only churns its sibling `.claude.json`, repo `.mcp.json` and `.claude/settings.json` because they are read-only configuration during a live session, and the witness hook and capability broker source files because the host executes but does not rewrite them.
