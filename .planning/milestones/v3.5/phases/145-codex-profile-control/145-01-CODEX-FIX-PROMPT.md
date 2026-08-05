# Fix pass — plan 145-01 spec-review finding (docs only)

Fresh SDD implementer, workspace-write. ONE finding to fix from the spec
review (T145-06 docs acceptance):

1. `super-gsd/scripts/codex-exec.README.md` — still claims runtime model/effort
   come from `review_providers.codex_model` / `codex_reasoning_effort`. Update
   to document the actual post-P145 resolution order: codex-profiles.yaml
   `cli_profiles` registry (via codex-profile-shell.sh / profile-resolver.cjs)
   → config.json overrides → CLI `--model/--reasoning` overrides, with
   fail-open to built-in defaults + codex-profile-resolution-log.jsonl row.
2. `super-gsd/tools/codex-pro/README.md` — still frames codex-profiles.yaml as
   only the 10 codex-pro profiles. Document the `cli_profiles` section as the
   default source for CLI dispatch profiles (executor / review / triage).

Read the implementations first (codex-profile-shell.sh, profile-resolver.cjs,
codex-profiles.yaml) so the docs match reality exactly. Touch ONLY these two
README files. Do NOT git commit.

End your output with EXACTLY:
FILES_CHANGED: <path (modified)> one per line
VERIFICATION: <how you checked docs match code> one per line
DEVIATIONS: none | list
BLOCKERS: none | list
SCRIPTS_CREATED: none
STATUS: DONE|BLOCKED
ONE_LINER: <summary>
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 1/1
ONE_LINER: <repeat>
