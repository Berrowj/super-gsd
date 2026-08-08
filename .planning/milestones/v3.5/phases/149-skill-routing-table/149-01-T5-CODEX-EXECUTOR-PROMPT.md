# P149-T5 — Replace sgsd-orchestrate SKILL.md routing prose with table references

<intent milestone="v3.5">SGSD governance must be a runtime mechanism, not prose.</intent>

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE file: super-gsd/skills/sgsd-orchestrate/SKILL.md. SURGICAL: replace only the neglected-skill ROUTING PROSE with references to the runtime table + consult command; do not restructure unrelated sections.

## Task contract (from locked plan)
  - id: "P149-T5"
    type: "orchestrate-doc-runtime-reference"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/skills/sgsd-orchestrate/SKILL.md"
    input_contract: >
      Edit only `super-gsd/skills/sgsd-orchestrate/SKILL.md`; replace hardcoded routing prose with references to `skill-routing.yaml` and the orchestrator hook.
    output_contract: >
      The orchestrate skill preserves operator-readable guidance while making runtime routing a table/helper decision and documents the phase-close consult before Step 6.7.
    hypothesis: "Replacing hardcoded routing prose with references to the registry prevents policy drift while preserving operator-readable workflow instructions."
    falsifier: >
      The orchestrate skill still contains prose-only routing trigger rules, omits the registry/helper reference, or fails to document the phase-close consult placement.
    stop_rule: >
      Stop after the two Select-String verification commands find registry/helper references and the Step 6.7 or phase-close placement.
    verification:
      commands:
        - >-
          Select-String -Path "super-gsd/skills/sgsd-orchestrate/SKILL.md" -Pattern "skill-routing.yaml|skill-routing"
        - >-
          Select-String -Path "super-gsd/skills/sgsd-orchestrate/SKILL.md" -Pattern "Step 6.7|phase-close"

## Task-specific prompt from plan
### P149-T5

Edit `super-gsd/skills/sgsd-orchestrate/SKILL.md` only. Replace routing prose cited by research with references to `skill-routing.yaml` and the orchestrator hook. Keep operator guidance, but make runtime routing a table/helper decision.

### P149-T6

## Prose sites to excise (research finding 13, verified file:line): SKILL.md:670 (memory recall/context selection routing), :1475 (MUDA phase-close routing), :1767 (memory-governance phase-close), :2548 (curate-learnings routing), :2565 (token-waste routing). Replace each embedded routing rule with a short pointer: the runtime consult (node super-gsd/scripts/lib/orchestrator-hooks.cjs --skill-routing-consult --phase N) + skill-routing.yaml as source of truth. KEEP gate mechanics (gates.shouldFire etc.) — only skill-SUGGESTION/scheduling prose moves.

## Plan-review W2 requirement (negative check)
After editing, verify NO stale embedded neglected-skill routing rules remain: grep for the old suggestion lexicon phrases and report counts; positive grep for skill-routing + phase-close references must also pass.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
