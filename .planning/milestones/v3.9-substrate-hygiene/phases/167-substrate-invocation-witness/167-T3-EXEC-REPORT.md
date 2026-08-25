FILES_CHANGED:
- super-gsd/agents/sgsd-vtp-enrichment.md (modified)
- super-gsd/agents/sgsd-board-researcher.md (modified)
- super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs (created)

VERIFICATION:
- `node --check super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0
- `git diff --check -- super-gsd/agents/sgsd-vtp-enrichment.md super-gsd/agents/sgsd-board-researcher.md` -> exit 0

DEVIATIONS:
- [P167-T3 red/green stop_rule] Suites were not executed per sandbox instruction. Pre-edit static inspection established unmet assertions; runtime green remains orchestrator-owned.

BLOCKERS:
- Orchestrator should inspect `caller-coverage` results, especially `missingOccurrences` and `unknown`. Its current exact-line inventory still names the two removed frontmatter grants and the replaced enrichment policy line.

ONE_LINER: Removed both canonical raw grants and added the shared fail-closed witness contract plus separate four-surface assertions; no commit, T4, or T5 work performed.
