# Fix pass 2 — finish interrupted docs fix (3 precise items, docs only)

Fresh implementer, workspace-write. A prior fix pass was interrupted. Finish
EXACTLY these three items and nothing else:

1. super-gsd/scripts/codex-exec.README.md line ~13: the flag/default table
   still claims runtime model/effort come from `review_providers.codex_model` /
   `codex_reasoning_effort`. Correct to the post-P145 resolution order:
   codex-profiles.yaml `cli_profiles` (via codex-profile-shell.sh) → config
   `review_providers.*` overrides → CLI `--model/--reasoning`. Fail-open to
   built-in defaults with a row in codex-profile-resolution-log.jsonl.
2. super-gsd/scripts/codex-exec.README.md "## Operator control" section:
   fix typo "Use ash" → "Use bash" and backtick the command.
3. super-gsd/tools/codex-pro/README.md: add a short section documenting the
   `cli_profiles` block of codex-profiles.yaml as the default source for CLI
   dispatch profiles (executor / review / triage), referencing
   codex-profile-shell.sh and profile-resolver.cjs resolution.

Read codex-profiles.yaml + codex-profile-shell.sh first so docs match reality.
Touch ONLY the two README files. No git commit.

End output with EXACTLY:
FILES_CHANGED: <path (modified)> one per line
VERIFICATION: <check performed> one per line
DEVIATIONS: none|list
BLOCKERS: none|list
SCRIPTS_CREATED: none
STATUS: DONE|BLOCKED
ONE_LINER: <summary>
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 1/1
ONE_LINER: <repeat>
