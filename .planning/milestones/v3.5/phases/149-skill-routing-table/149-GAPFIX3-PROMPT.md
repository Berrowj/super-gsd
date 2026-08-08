# P149-gapfix3 — Make the gated-route path reachable (single WARN from verify round 3)

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE narrow fix. Surgical constraint applies.

## Finding
FINDINGS_DETAIL: [WARNING] [logic] super-gsd/scripts/lib/orchestrator-hooks.cjs:200-208 skips a gated route when no gate-value row exists, while its A10 test injects a synthetic MUDA row at :963-967. super-gsd/skills/sgsd-orchestrate/SKILL.md:1480-1491 removed the former `shouldFire`/`logGateValue` arms and only says to “record or consume” a decision, leaving no mechanical producer. The real phase-149 consult at .planning/metrics/gate-evidence.jsonl:41 consequently records `gate_ref_not_observed:MUDA-waste-audit`, `dispatch:null`; a fresh no-gate end-to-end probe likewise dispatched MUDA zero times.

## Fix requirement
In orchestrator-hooks.cjs (~lines 200-208): when a route has gate_ref and NO gate-value row exists for this phase, do not skip as gate_ref_not_observed. Instead evaluate the gate's own trigger mechanically via super-gsd/scripts/lib/gates-registry.cjs shouldFire(gate_ref, ctx) using the consult's --files-changed/--diff-lines/--phase-type context. Trigger true -> route fires (dispatch executes, and log the gate-value outcome row so downstream consumers see the gate result). Trigger false -> skip with reason gate_trigger_not_met. An existing gate-value row for this phase still short-circuits as duplicate (reason gate_already_fired_this_phase). Update the A10 synthetic-row test to also cover the no-row + trigger-true path dispatching for real, and the no-row + trigger-false skip. Update SKILL.md's consult step wording to state the consult evaluates gate triggers itself — no separate producer needed.

## Verify before reporting: hooks --self-test; a no-gate-row end-to-end probe with --files-changed 4 --diff-lines 100 that DISPATCHES MUDA (executed or executed_with_findings), and one with --files-changed 1 --diff-lines 5 that skips with gate_trigger_not_met.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
