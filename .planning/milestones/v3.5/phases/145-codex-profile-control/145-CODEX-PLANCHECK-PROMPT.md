<intent milestone="v3.5">
Governance as runtime mechanism in all session modes; absence of evidence must be loud.
</intent>

# Combined plan-check + final ATC/MUDA review — P145 plan set

You are the plan checker AND final plan reviewer for SGSD phase 145. Read-only.
One plan in the set:
.planning/milestones/v3.5/phases/145-codex-profile-control/145-01-PLAN-LOCKED.md

Also read: CONTEXT.md and 145-RESEARCH.md in the same directory, and the P145
section of .planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md.

## Part 1 — plan-check (goal-backward)

Will executing this plan, exactly as written, achieve AC-145 (a) byte-identical
default invocations, (b) control-skill round-trip into a real dispatch, (c)
danger-set refused without TTY — plus the phase's self-test criteria? Check:
task completeness vs CONTEXT scope (including the wrapper silent-death fix),
acceptance commands actually prove the ACs, files_touched consistent with
allowed_files, no task depends on artifacts nothing produces, semantic ACs are
real-data not structural greps. VTP preflight: the phase has
145-VTP-ENRICHMENT.md (empty_hit) — confirm the plan carries a VTP_STATUS row.

## Part 2 — final review (ATC + MUDA) on the same plan set

- ATC 7-step over the plan as execution contract (first-principles: is any task
  unnecessary? delete/simplify: can task count or file count shrink? 10-point
  anti-slop on the planned artifacts).
- MUDA: transport / inventory / motion / waiting / over-processing /
  overproduction / defects in the planned work.
- Final-draft check: should the plan be edited before an executor touches code?

## Output contract — EXACTLY this structure

PLAN_CHECK_VERDICT: GO|NOGO
PLAN_CHECK_BLOCKERS: none|<list>
ATC_MUDA_REVIEW: <numbered findings, file/task references, max 300 words>
FINAL_VERDICT: PASS|WARN|FAIL
REQUIRED_EDITS: none|<numbered, only if WARN/FAIL>
Then EXACTLY these 5 lines (wrapper transport contract — required):
FINDINGS: <integer count of ATC/MUDA findings>
CRITICAL: <integer>
WARNINGS: <integer>
PASS_RATE: 1/1
ONE_LINER: <one line>
