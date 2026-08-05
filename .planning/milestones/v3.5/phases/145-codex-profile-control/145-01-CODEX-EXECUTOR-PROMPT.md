<intent milestone="v3.5">
Governance as runtime mechanism in all session modes; absence of evidence must be loud.
</intent>

# Executor task — implement plan 145-01 (Codex Profile Registry + /sgsd-codex-control)

You are a fresh SDD implementer with workspace-write access. Implement EXACTLY
the plan at:

.planning/milestones/v3.5/phases/145-codex-profile-control/145-01-PLAN-LOCKED.md

Read it first, in full, plus 145-RESEARCH.md in the same directory. Execute all
tasks T145-01..T145-05 in order. Touch ONLY files in the plan's allowed_files.
Do NOT run git commit — the orchestrator commits.

Key invariants (from the plan; violating any is a failed run):
- Untouched registry → byte-identical codex invocations for both wrappers,
  all three profiles, both launcher paths (direct + cmd). Prove via dry-run
  argv parity self-tests.
- Registry missing/corrupt → fail OPEN to built-in defaults + loud row to
  .planning/metrics/codex-profile-resolution-log.jsonl.
- codex-exec.sh silent-death fix: after the codex run, parse failures must
  still write REPORT_OUT, append the codex-log.jsonl row, and exit 6 loudly.
- danger-full-access / trust fields: require [ -t 0 ] && [ -t 1 ] AND exact
  typed confirmation; refuse otherwise.
- Preserve explicit --timeout precedence (codex-exec.sh:503-517). Zero new
  runtime deps (js-yaml is vendored at tools/plan-schema/node_modules).

SURGICAL CONSTRAINT — every changed line must trace to a specific task
in this wave's plan. Orphan edits (unrelated refactors, comment tweaks,
formatting passes, "while I'm here" fixes) are DEVIATIONS. Report them
in the DEVIATIONS section; do NOT commit them silently. Match the
existing code style even if you'd write it differently. If you notice
pre-existing dead code, mention it in DEVIATIONS — do NOT delete it.
Remove ONLY imports/variables/functions that YOUR changes made unused.

Before reporting: run every acceptance command in the plan yourself and
self-review your diff against the plan tasks.

## Report contract — end your output with EXACTLY these sections

FILES_CHANGED: <path (created|modified)> one per line
VERIFICATION: <cmd> → exit N ✓|✗ one per line
DEVIATIONS: none | list
BLOCKERS: none | list
SCRIPTS_CREATED: none | path | purpose | interface
STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED
ONE_LINER: substantive summary
Then the wrapper transport lines EXACTLY:
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 1/1
ONE_LINER: <repeat the same one-liner>
