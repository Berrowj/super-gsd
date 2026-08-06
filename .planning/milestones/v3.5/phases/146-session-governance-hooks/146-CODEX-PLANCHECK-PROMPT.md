# P146 Plan-Check + Final ATC/MUDA Review (combined gate)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

BUDGET DISCIPLINE (hard): read ONLY the files named below. Do NOT run any
command, self-test, or benchmark. Do NOT explore the wider repo. Emit the
5 contract lines FIRST, then detail, then stop.

You are performing THREE checks in one pass over the plan set:
(A) Plan-check — goal-backward: will executing this plan achieve AC-146?
(B) ATC 7-step applied to the PLAN as execution contract (esp. delete /
    simplify / anti-slop: is any task speculative, over-abstracted, or
    duplicating existing capability?)
(C) MUDA waste review: transport, inventory, motion, waiting, over-processing,
    overproduction, defects.

## Read
1. .planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md
2. .planning/milestones/v3.5/phases/146-session-governance-hooks/CONTEXT.md
3. .planning/milestones/v3.5/phases/146-session-governance-hooks/146-RESEARCH.md
4. .planning/milestones/v3.5/phases/146-session-governance-hooks/146-VTP-ENRICHMENT.md
(That is the complete reading list. The plan already validated against
plan-schema-v2 — do NOT re-verify schema mechanics.)

## Specifically interrogate
1. Do the 6 semantic_acceptance_criteria actually prove AC-146 (a)(b)(c)(d),
   or do any of them pass while the real behavior is broken? Name any AC whose
   verification_cmd is satisfiable by a stub.
2. Board-binding constraint violations anywhere in the plan: edit-seam
   blocking, home-settings writes, env-block reads, hardcoded machine paths,
   non-zero exits in a non-SGSD repo, LLM in the classifier.
3. RESEARCH open decisions — did the plan actually DECIDE them (STATE phase
   key, gate-evidence stream vs gate-value-log extension, install-time paths
   vs ${CLAUDE_PROJECT_DIR}, real mutation tool names) or defer them into
   execution where the executor will improvise?
4. VTP directives honored? (registry-driven rule shape for the P149 swap;
   latency bench as a real task with a recorded number; classifier routes and
   does not judge; cockpit reader inside this phase.)
5. Task sizing/ordering: is T146-05 (quality gate + cockpit consumer) too
   large for one dispatch? Any DAG/file-collision hazard across tasks
   (allowed_files overlap)?
6. Waste: is anything in the plan overproduction (built before a consumer
   exists), inventory (artifacts nobody reads), or over-processing?

## Verdict rules
- GO only if the plan is executable as-is.
- NOGO if any board-binding constraint is violated, any AC is stub-satisfiable,
  or an open decision was punted into execution.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <verdict GO|NOGO + one-line reason>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
