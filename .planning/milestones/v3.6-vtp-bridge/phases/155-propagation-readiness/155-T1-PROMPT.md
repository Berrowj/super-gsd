# P155-T1 — Hook overlay unification

You are the implementer for ONE task. Fresh context, this task only. You CANNOT spawn
`claude` (EPERM, confirmed) — the orchestrator runs live Claude transport separately.

## Read first

- `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md` — task P155-T1 is your contract, quoted below.
- `super-gsd/config/repo-settings-overlay.json` (the ONLY overlay install.sh merges, at install.sh:467)
- `super-gsd/config/claude-ups-overlay.json` (P153's hand-installed overlay — carries the guard entry)
- `super-gsd/tests/hook-transport/assert-registration.cjs`, `assert-block-guard.cjs`
- `super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` (note: plan lists it under hook-transport; the real path is kb-triage-shadow — verify and retarget correctly, report the discrepancy under DEVIATIONS)

## The task, verbatim contract

Move the complete managed secret-guard entry (`user-prompt-secret-leak-guard`, pointing
at `super-gsd/tools/codex-hooks/block-secret-leak.cjs`) into
`repo-settings-overlay.json` alongside the existing classifier entry. Delete
`claude-ups-overlay.json`. Retarget every P153 assertion that references the deleted
overlay path to the unified one. Create
`super-gsd/tests/propagation-readiness/assert-p153-regression.cjs` with an
`--mode executor` flag that runs every check that needs NO Claude spawn:
registration shape (exactly one classifier + one guard on UserPromptSubmit, every
command resolves on disk, other events preserved), block-guard secret/benign/
dual-surface-shared cases, and the kb-triage shadow self-test. Re-run the repo-local
merge with an ABSOLUTE project root:

    node super-gsd/scripts/merge-settings.js --repo-local-hooks \
      super-gsd/config/repo-settings-overlay.json .claude/settings.json "$(pwd)"

## Hard constraints

- NEVER read, print, echo or log any settings `env` block — live API keys. Inspect
  only the hooks section by key. `.claude/settings.json` is gitignored: it is a
  verification side effect, never a committed file.
- Preserve the SessionStart and PostToolUse entries in the overlay untouched.
- Do not modify either hook implementation (`sgsd-intent-classifier.cjs`,
  `block-secret-leak.cjs`).
- No config grep may substitute for behaviour: the executor-safe mode spawns the guard
  as a real process and reads real exit codes.
- Node .cjs only. Surgical. Commit nothing yourself — the orchestrator commits.

## Verification to run before reporting

    node super-gsd/tests/propagation-readiness/assert-p153-regression.cjs --mode executor

Exit 0 required.

## Report format, exactly this, max 250 words, no preamble

```
FILES_CHANGED: path (created|modified|deleted)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```
