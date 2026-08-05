<intent milestone="v3.5">
Governance as runtime mechanism in all session modes; absence of evidence must be loud.
</intent>

# Spec-compliance review — plan 145-01 implementation (SDD first reviewer stage)

You are the spec reviewer. Read-only. Question: did the executor implement the
PLAN exactly — nothing missing, nothing extra? Do NOT judge elegance (ATC does
that next). Inspect RAW artifacts, not summaries:

1. Plan: .planning/milestones/v3.5/phases/145-codex-profile-control/145-01-PLAN-LOCKED.md
2. Executor report: .planning/milestones/v3.5/phases/145-codex-profile-control/145-01-CODEX-EXECUTOR-REPORT.md
   (report BLOCKERS about Bash self-tests are resolved — orchestrator re-ran on
   host: all three exit 0; see the report's addendum)
3. Raw diff: run `git diff HEAD -- super-gsd/` and
   `git status --porcelain super-gsd/` yourself. The working tree currently
   holds the UNCOMMITTED implementation (9 modified + 3 new files under
   super-gsd/ plus the plan's rollback_plan frontmatter addition).
4. Verification: the plan's acceptance commands — re-run any read-only Node
   ones yourself if you doubt the report (profile-resolver self-test CLIs).

Check per plan task T145-01..T145-05: every required artifact exists with the
required behavior; files_touched stayed inside allowed_files; the three
executor DEVIATIONS (PowerShell edit fallback, rollback_plan addition,
run-self-test.cjs in-process conversion) are acceptable adaptations vs scope
violations; no unrequested behavior changes (especially: default invocations
byte-identical — verify the parity self-test actually asserts today's exact
flag fragments, and explicit --timeout precedence preserved).

## Output contract — EXACTLY this structure

SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<plan task ids / acceptance criteria not met>
EXTRA_SCOPE: none|<unrequested changes or behavior>
VERIFICATION_MAPPING: <which raw command/diff evidence proves each acceptance criterion, one line each>
ONE_LINER: <short operator-readable summary>
Then EXACTLY these 5 lines (wrapper transport contract — required):
FINDINGS: <integer>
CRITICAL: <integer>
WARNINGS: <integer>
PASS_RATE: 1/1
ONE_LINER: <repeat>
