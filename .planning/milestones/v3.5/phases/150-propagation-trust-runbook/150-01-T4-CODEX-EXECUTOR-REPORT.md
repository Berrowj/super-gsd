SALVAGE RECORD (T4 chain: T4 tests-only -> T4b deliverables -> T4c -> T4d test-source-inlined -> T4e + 2 codex patch-mode fixes applied by orchestrator)
FILES_CHANGED: PROPAGATION.md + DEVCP-RECONCILIATION.md (phase dir); sgsd-global-snapshot.sh, sgsd-devcp-restart-evidence.sh, sgsd-local-restart-evidence.ps1 (created); install.sh (modified); 3 contract test files (created)
VERIFICATION (host): runbook-contract 5/5; global-snapshot-contract 5/5; restart-evidence-contract 6/6
DEVIATIONS: orchestrator applied two Codex-authored patch-mode diffs (MSYS tilde delivery via quoted bash -c; symlink EPERM skip guard was codex-direct); MSYS argv tilde expansion documented as untestable via direct argv on Windows
ONE_LINER: runbook + reconciliation decision + snapshot/rollback + restart-evidence helpers all contract-tested green
STATUS: DONE (salvaged)
