FILES_CHANGED: super-gsd/tools/codex-hooks/block-secret-leak.cjs (modified)
FILES_CHANGED: super-gsd/config/claude-ups-overlay.json (modified)
FILES_CHANGED: super-gsd/tests/hook-transport/assert-block-guard.cjs (created)
VERIFICATION: `node super-gsd/tests/hook-transport/assert-block-guard.cjs --case secret` exit 0 pass
VERIFICATION: `node super-gsd/tests/hook-transport/assert-block-guard.cjs --case benign` exit 0 pass
VERIFICATION: `node super-gsd/tests/hook-transport/assert-block-guard.cjs --case dual-surface-shared` exit 0 pass
VERIFICATION: `node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` exit 0 pass
DEVIATIONS: none
BLOCKERS: `assert-live-dispatch.cjs` counts all UserPromptSubmit entries and commands, so it will reject the required second entry after overlay installation.
ONE_LINER: Shared guard now blocks credential prompts with exit 2, emits trigger-only stderr, preserves secret-free ledger rows, and serves both hook surfaces.
