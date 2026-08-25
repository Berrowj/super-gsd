FILES_CHANGED: super-gsd/hooks/sgsd-substrate-invocation-witness.cjs (modified)
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs (modified)
FILES_CHANGED: super-gsd/config/repo-settings-overlay.json (modified; both pins manually refreshed to 55c1780a82bcd60646fa54f96e507214ec3a70c294d8b8437aa0d412b013f137; hook edits silently invalidate these pins and nothing regenerates them automatically)
VERIFICATION: `node --check super-gsd/hooks/sgsd-substrate-invocation-witness.cjs` -> exit 0
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0 (37/37)
VERIFICATION: PowerShell hook-hash and two-pin equality check -> exit 0
VERIFICATION: PowerShell PreToolUse comparison against HEAD -> exit 0
VERIFICATION: `git diff --exit-code -- super-gsd/tools/substrate-capability-broker.cjs super-gsd/scripts/lib/vtp-context-composer.cjs super-gsd/schemas/vtp-mcp-input-schemas.v2.json` -> exit 0
VERIFICATION: `git diff --check -- super-gsd/hooks/sgsd-substrate-invocation-witness.cjs super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs super-gsd/config/repo-settings-overlay.json` -> exit 0
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: PostToolUse now accepts bare content arrays and `{content:[...]}` envelopes, searches all blocks for substrate JSON, preserves the original outer shape, and passes genuinely unparseable responses through untouched while recording a redacted condition row.
