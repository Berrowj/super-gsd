<intent milestone="v3.5">
Governance as runtime mechanism in all session modes; absence of evidence must be loud.
</intent>

# Planning task — P145: Codex Profile Registry + /sgsd-codex-control

You are the phase planner for SGSD phase 145. Produce ONE executable plan
document. You have read-only repo access — emit the full plan as output text;
the orchestrator materializes it to `145-01-PLAN-LOCKED.md`.

## Required reading (read these files now)

- .planning/milestones/v3.5/phases/145-codex-profile-control/CONTEXT.md
- .planning/milestones/v3.5/phases/145-codex-profile-control/145-RESEARCH.md
- .planning/milestones/v3.5/phases/145-codex-profile-control/145-VTP-ENRICHMENT.md
- .planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md (P145 section)
- super-gsd/templates/plan-schema-v2.json (the plan MUST validate against this)
- super-gsd/scripts/codex-executor.sh and super-gsd/scripts/codex-exec.sh (refactor targets)
- super-gsd/tools/codex-pro/profile-resolver.cjs (in-repo precedent — reuse/extend, don't duplicate)

VTP_STATUS: empty_hit; reason=corpus_gap_for_cli_registry_mechanics; do not invent VTP findings.

## Plan requirements

Emit a complete PLAN-LOCKED markdown document with plan-schema-v2 YAML
frontmatter (schema_version: 2, model: codex, expected_ATC_tier, tasks[] with
id/type/hypothesis/files_touched/acceptance_commands, and
semantic_acceptance_criteria per SCHEMA-09 — real-data criteria, not
structural greps). Tasks to cover (research-informed; adjust granularity as
evidence dictates, target 4-7 tasks):

1. `super-gsd/registry/codex-profiles.yaml` — executor / review / triage
   profiles capturing today's EXACT flag fragments (research Q1/Q2/Q4:
   executor uses hidden `--full-auto`; keep byte-identical).
2. Resolver: extend or wrap `super-gsd/tools/codex-pro/profile-resolver.cjs`
   (research Q3 precedent) into a helper that prints sanitized KEY=VALUE lines;
   bash reads via `while IFS='=' read` (research-recommended; NO eval). Fail
   OPEN to built-in defaults + loud row to
   .planning/metrics/codex-profile-resolution-log.jsonl.
3. Wrapper refactor: codex-executor.sh + codex-exec.sh resolve flag fragments
   from the resolver. Self-test asserts dry-run command strings byte-identical
   to current output for untouched registry (AC-145a), all 3 profiles × both
   launcher paths.
4. **Wrapper defect fix (observed 2026-08-05, route-decisions row
   codex_report_write_lost):** in codex-exec.sh, the post-run contract parse
   runs under `set -e`; a grep no-match kills the script after "codex-review
   END" with no report write, no JSONL row, exit masked. Fix: guard the parse
   pipeline (set +e or `|| true` collection), ensure REPORT_OUT and the
   codex-log.jsonl row are ALWAYS written on every exit path, and exit 6 fires
   loudly on contract violation instead of silent death.
5. `/sgsd-codex-control` skill at super-gsd/skills/sgsd-codex-control/SKILL.md
   (+ any thin CLI under super-gsd/scripts/): show / set <profile> <field>
   <value> / --profile per-dispatch override plumbing. Danger guard:
   `danger-full-access` or trust fields require `[ -t 0 ] && [ -t 1 ]` AND
   exact typed confirmation phrase (research Q6); refuse otherwise.
6. Self-test registration per house `--self-test` convention (research Q7).

Out of scope: the other 6 hardcoding callers from research Q8 (list them in the
plan's deferred section for a later pass); any behavior change to devcp's
gpt-5.6-sol pin.

## Constraints (binding)

- Zero new runtime deps (js-yaml is already vendored — reuse per research Q3).
- Behaviour-preserving defaults; fail open; loud logging.
- Preserve explicit --timeout precedence (codex-exec.sh:503-517).
- Surgical: every changed line traces to a task.

## Output contract

First: the complete PLAN-LOCKED document in a ```markdown fenced block.
Then EXACTLY these 5 lines (wrapper transport contract — required):
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 1/1
ONE_LINER: <one-line plan summary>
