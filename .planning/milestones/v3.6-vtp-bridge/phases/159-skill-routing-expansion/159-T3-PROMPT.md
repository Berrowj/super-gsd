# P159-T3 — skill-description standard + lint (edits-first; orchestrator owns spawns)

You are the implementer for ONE task. Fresh context. The sandbox denies nested
Node spawns — RUNNING the suites is NOT your job; write the edits, verify with
node --check and static assertions, and report. Do NOT stop on spawnSync EPERM.
Do NOT commit.

Task P159-T3 in `159-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract. Files: super-gsd/docs/SKILL-DESCRIPTION-STANDARD.md (new),
super-gsd/tools/skill-description-lint/lint.cjs (new), super-gsd/CLAUDE-OVERLAY.md
(overlay note pointing devcp-local skills at the standard), and the test's
description-lint case.

Scope essentials from the operator-locked CONTEXT:
- Standard: trigger conditions + boundary against neighbours + when-NOT-to-use,
  modelled on /create-quote's "gated, dry-run first" style.
- Lint: flags description-less and one-noun descriptions across
  super-gsd/skills/*/; stable reason codes; exit 0 clean / 1 findings / 2 error;
  never rewrites files.
- Test case: fixture skills dir with compliant + violating descriptions; red path
  encoded as fixtures (violations must be flagged; compliant must pass).

## Verify statically before reporting

    node --check super-gsd/tools/skill-description-lint/lint.cjs
plus direct in-process invocation of the lint against a temp fixture dir if
possible without spawning.

Report: FILES_CHANGED / VERIFICATION (static, name each check) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 180 words.
