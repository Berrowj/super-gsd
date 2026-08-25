FILES_CHANGED: super-gsd/agents/sgsd-vtp-enrichment.md (modified)  
FILES_CHANGED: super-gsd/agents/sgsd-board-researcher.md (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs (created)  
FILES_CHANGED: super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs (modified)

VERIFICATION: spawn-free in-memory `auditCallerCoverage` probe via `node -` -> exit 1 before full-line correction, then exit 0 with all eight sites and no missing or unknown occurrences  
VERIFICATION: `node --check super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0  
VERIFICATION: `git diff --check -- <four T3 paths>` -> exit 0  
VERIFICATION: `git diff --exit-code -- <two frozen paths>` -> exit 0

DEVIATIONS: [P167-T3 files_touched] scope expanded by `super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` because T3 removed and replaced registered exact occurrences while its stop rule still requires caller-coverage.

BLOCKERS: caller-coverage and its mutation probes remain orchestrator-required because `mkdtemp` is EPERM in this sandbox.

ONE_LINER: Replaced the stale frontmatter registrations with exact witness-line registrations and re-registered the new enrichment policy text; path-bound full-line matching and single-consumption remain unchanged, so no inventory gap opens.
