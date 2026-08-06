STATUS: DONE (report reconstructed by orchestrator — see note)

NOTE: codex-executor.sh exited 5 (timeout after 1200s) and wrote a 0-byte
report. The implementation work had already completed on disk before the
timeout; the executor consumed its remaining budget on self-verification.
Fields below are reconstructed from the raw diff + orchestrator host runs,
not from an executor summary.

FILES_CHANGED:
`super-gsd/scripts/merge-settings.js` (modified, +234/-… : --repo-local-hooks mode + --self-test-repo-local-hooks)
`super-gsd/install.sh` (modified, +41 : register_repo_local_hooks wired into init-local and update paths)
`super-gsd/config/repo-settings-overlay.json` (created : repo-local hook entry template)
`.claude/settings.json` (generated at install time; gitignored — machine-specific absolute paths)

VERIFICATION (orchestrator host runs):
`node --check super-gsd/scripts/merge-settings.js` → exit 0 ✓
`bash -n super-gsd/install.sh` → exit 0 ✓
`node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks` → exit 0 ✓
  (temp target with SPACES in path; 3 added then 0 added / 3 already-present = idempotent)
`node merge-settings.js --repo-local-hooks <overlay> .claude/settings.json $(pwd)` → exit 0 ✓
home `~/.claude/settings.json` md5 before == after → UNCHANGED ✓
wiring assert: 3 events present; command "node"; args = absolute target-repo
paths; PostToolUse matcher `Edit|Write|NotebookEdit`; no MultiEdit ✓

DEVIATIONS:
[T02-D1] Executor timed out (exit 5) with an empty report; work was complete.
  Same failure class as the curated codex-exec report-loss anti-pattern, but on
  the codex-executor path (timeout, not write-failure). Report reconstructed.
[T02-D2] Orchestrator parked the UserPromptSubmit and PostToolUse entries in
  this repo's .claude/settings.json after acceptance was proven. Their hook
  scripts land in T146-04/T146-05; until then Claude Code would print a node
  MODULE_NOT_FOUND stack trace on every prompt (exit 1 — non-blocking per
  RESEARCH Q1, but disruptive). Acceptance evidence preserved verbatim in
  146-01-T02-SETTINGS-EVIDENCE.json. Full merge re-runs at phase close.

BLOCKERS: none

SCRIPTS_CREATED:
`super-gsd/scripts/merge-settings.js --repo-local-hooks <overlay> <target-settings> <project-dir>` | idempotent repo-local hook install | exit 0
`super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks` | 7-assertion self-test incl. fixture-home untouched + no sentinel leak | exit 0

ONE_LINER: Added repo-local hook installation (merge-settings --repo-local-hooks + install.sh register_repo_local_hooks + overlay template) targeting <repo>/.claude/settings.json only, with a 7-assertion self-test proving home settings stay untouched and no env sentinel leaks.
