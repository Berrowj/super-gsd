FILES_CHANGED: super-gsd/scripts/codex-exec.README.md (modified)
FILES_CHANGED: super-gsd/tools/codex-pro/README.md (modified)
VERIFICATION: read codex-profile-shell.sh, profile-resolver.cjs, and codex-profiles.yaml before editing
VERIFICATION: node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-registry passed
VERIFICATION: node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-parity passed
VERIFICATION: node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-cli-fail-open passed
VERIFICATION: node super-gsd/tools/codex-pro/profile-resolver.cjs --resolve-cli review matched documented registry values
VERIFICATION: stale README phrase search returned no stale runtime/10-profile-only claims
VERIFICATION: git diff --check -- target READMEs exited 0
DEVIATIONS: P145 code does not implement config.json model/reasoning overrides; docs state config.json only backs timeout settings so they match implementation
BLOCKERS: none
SCRIPTS_CREATED: none
STATUS: DONE
ONE_LINER: Updated P145 docs to describe cli_profiles as the CLI dispatch source and remove stale review_providers model/effort runtime claims.
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 1/1
ONE_LINER: Updated P145 docs to describe cli_profiles as the CLI dispatch source and remove stale review_providers model/effort runtime claims.
