# Fixture: mid-plan

## Kill Point

Planner subprocess killed AFTER partial PLAN.md write at task T3 (of an
expected 5-task plan), BEFORE the closing tasks footer.

## Resume Expectation

The resume probe MUST:
1. Detect that `99-01-PLAN.md` is incomplete.
2. Re-dispatch planner OR resume from T3.
3. Advance to plan-check + executor.
4. Reach the synthetic phase close.

## Files

- `checkpoint.md` - synthetic ORCHESTRATOR-CHECKPOINT.md with all 6 required
  fields populated. The validator MUST return `ok: true` on this fixture.
- `state.md` - synthetic STATE.md with `killed_at_step: plan`.

## Acceptance

Scenario verdict === 'PASS' AND reason === 'chaos_pass'.

ASCII-only.
