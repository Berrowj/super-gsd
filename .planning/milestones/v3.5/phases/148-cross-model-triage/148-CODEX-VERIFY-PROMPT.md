# P148 Phase Verification — Cross-Model Triage (goal-backward)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

PHASE verifier: judge whether the PHASE GOAL is achieved in the codebase.
You MUST read the files listed. Do NOT run self-tests/node/bash/git — the
full 26-scenario suite passes host-side (`all` = 25 scenarios in 4m44s) and
sandbox spawn is EPERM-blocked. Emit the report contract FIRST.

## AC-148 (verbatim)
(a) planning-shaped prompt → triage fires with a Codex verdict row in
`.planning/metrics/vtp-routing-log.jsonl`; (b) forced VTP null-reflection →
fallback search runs and is logged; (c) Codex-unavailable → triage completes
single-model with a logged degradation; (d) a seeded disagreement fixture
surfaces both verdicts to the operator.

## Constraints (binding)
Codex failure/timeout never blocks the operator; dispatch only for
planning-gated triage (P146 route) with observable skip rows otherwise;
closed A-D vocabulary enforced against prompt injection (query travels as
data); rationale MANDATORY on all three disagreement lines; wrapper AND
consumer validate the verdict via the SHARED schema; `--profile triage
--timeout-tier custom:300 --contract triage-verdict-v1`; test isolation via
SGSD_CODEX_COMMAND (no real dispatches in tests — leakage marker guard).

## Read
- .planning/milestones/v3.5/phases/148-cross-model-triage/148-01-PLAN-LOCKED.md
- super-gsd/scripts/sgsd-triage-runtime.cjs
- super-gsd/scripts/lib/triage-verdict-schema.cjs
- super-gsd/scripts/codex-exec.sh (triage-verdict-v1 + SGSD_CODEX_COMMAND additions only)
- super-gsd/scripts/lib/vtp-context-composer.cjs (contained routing-log writes)
- super-gsd/skills/sgsd-triage/SKILL.md

## Host evidence (treat as given)
26/26 scenarios. P145 Probes 1-7 clean after wrapper changes. T148-03 CRIT
(tests burned real gpt-5.5 dispatches; sandbox EPERM masked it) fixed with
override + fixture marker. SKILL.md net -3 lines despite the new step.

## Verify goal-backward — the questions that matter
1. Each AC letter from SOURCE (not fixtures). Name any letter satisfied by
   the harness rather than the code.
2. Hunt the milestone's silent-success class (17 CRITICALs so far — find the
   18th): the reconciliation path when Codex agrees (is agreement logged, or
   only disagreement?); the skip-gate row when trigger source is absent
   entirely (vs non-planning); SKILL.md prose vs runtime behavior drift (the
   prose claims things the runtime must actually do — any mismatch?).
3. Interactive latency honesty: custom:300 means the operator can wait up to
   5 minutes for the second opinion. Does the SKILL.md/runtime surface
   progress or a way to see it (codex-live outputs), or does triage go
   silent for 300s? Judge whether that violates "never blocks the operator"
   in spirit.
4. Cross-task seams: schema lib consumed by BOTH wrapper and runtime (drift
   impossible?); composer's contained writes vs runtime's evidence writes
   (one contract?); SGILL prose CLI invocation vs runtime parseArgs (do the
   documented flags exist?).
5. Mechanically true but semantically vacuous invariants.

## Report contract (exact, FIRST, <300 words)
status: passed | human_needed | gaps_found
goal_achieved: yes | partial | no
evidence: <AC letter → file:line → verdict>
gaps: none | <list>
DEVIATIONS: none | <list>
ONE_LINER: <summary>
