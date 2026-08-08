# P149 PHASE VERIFICATION — goal-backward

You are the Codex verifier. Verify P149 delivers its GOAL, not just its tasks: one source of truth (skill-routing.yaml) actually consumed by BOTH the P146 classifier (prompt-time) and the orchestrate loop (phase-close consult), with the SKILL.md prose replaced by table references. Work goal-backward over the diff since commit c75beaa (plan lock).

Read: .planning/milestones/v3.5/phases/149-skill-routing-table/149-01-PLAN-LOCKED.md (SACs), .planning/milestones/v3.5/phases/149-skill-routing-table/149-01-T6-ACCEPTANCE.md (orchestrator acceptance run), the five task reports in .planning/milestones/v3.5/phases/149-skill-routing-table/, and the actual source files: super-gsd/registry/skill-routing.yaml, super-gsd/scripts/lib/skill-routing-registry.cjs, super-gsd/hooks/sgsd-intent-classifier.cjs, super-gsd/scripts/lib/orchestrator-hooks.cjs, super-gsd/skills/sgsd-orchestrate/SKILL.md.

Specifically hunt for: (1) dual-maintenance残留 — any second suggestion lexicon still live; (2) the consult being documented but not actually invokable at the Step 6.6.i->6.7 seam; (3) SACs that are mechanically true but semantically vacuous; (4) the pre-existing A1_lock13_null_opts 9/10 self-test issue — confirm it is pre-existing (Phase 87) and not a P149 regression.

Report contract — emit ALL exact lines:
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <N/M>
ONE_LINER: <summary>
VERIFY_STATUS: passed|gaps_found
Then FINDINGS_DETAIL lines with file:line for any CRITICAL/WARNING.
