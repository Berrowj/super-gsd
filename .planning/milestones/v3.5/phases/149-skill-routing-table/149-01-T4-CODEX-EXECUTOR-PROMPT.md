# P149-T4 — Orchestrate phase-close consult hook (AC-149c)

<intent milestone="v3.5">SGSD governance must be a runtime mechanism, not prose.</intent>

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE task: add the phase-close skill-routing consult to super-gsd/scripts/lib/orchestrator-hooks.cjs (new CLI command, house style like --token-waste-check). SURGICAL CONSTRAINT applies. Do NOT edit SKILL.md in this task (that is T5).

## Task contract (from locked plan)
  - id: "P149-T4"
    type: "orchestrator-phase-close"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/lib/orchestrator-hooks.cjs"
      - "super-gsd/scripts/lib/skill-routing-registry.cjs"
    input_contract: >
      Add the orchestrator scheduled consult API using loader-provided scheduled rows. Place the phase-close seam after phase completion and before Step 6.7 milestone completion.
    output_contract: >
      Phase-close dry run enumerates applicable scheduled routes and appends gate-evidence envelope rows for fired and skipped decisions with concrete reasons.
    hypothesis: "Auto-mode phase close can consult scheduled routing rows after phase completion and before milestone-close logic, logging fired/skipped decisions for every applicable skill."
    falsifier: >
      The phase-close hook omits applicable rows, reads copied predicates from `gates.yaml`, runs after milestone-close logic, or fails to append fired/skipped evidence rows.
    stop_rule: >
      Stop after the phase-close dry-run command and gate-evidence ledger tail show scheduled skill-routing rows with skill, moment, mode, phase, decision, and reason.
    verification:
      commands:
        - >-
          node super-gsd/scripts/lib/orchestrator-hooks.cjs skill-routing --moment phase-close --mode auto --phase 149 --files-changed 4 --diff-lines 100 --dry-run
        - >-
          Select-String -Path ".planning/metrics/gate-evidence.jsonl" -Pattern '"event":"skill-routing"' | Select-Object -Last 10

## Task-specific prompt from plan
### P149-T4

Add the orchestrator scheduled consult API. The phase-close seam is after “Mark phase complete, advance to next phase” and before Step 6.7 milestone completion. For each applicable scheduled route, append a gate-evidence envelope row with `event=skill-routing`, `decision=fired|skipped`, and a concrete reason.

### P149-T5

## Constraints
- Use skill-routing-registry.cjs getScheduledRoutes for moment=phase-close; evaluate cooldowns by referencing gate names/route policy (no predicate re-implementation).
- Log one fired-or-skipped row PER scheduled route to the gate-evidence ledger (gate-evidence-log.cjs envelope) — the log row IS the AC-149c enforcement.
- Lock 13: never throw upward; malformed anything -> degradation row + exit 0.
- Extend orchestrator-hooks self-test coverage for the new command.

## Verify before reporting: run the new command against this repo (--skill-routing-consult or similar naming, --phase 149) + orchestrator-hooks self-test + registry self-test.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
