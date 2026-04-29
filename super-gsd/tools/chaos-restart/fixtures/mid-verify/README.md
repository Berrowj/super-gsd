# Fixture: mid-verify

## Kill Point

Verifier subprocess killed AFTER partial VERIFICATION.md write at must-have
section 4 (of 9 expected sections).

## Resume Expectation

The resume probe MUST:
1. Detect that `99-VERIFICATION.md` is incomplete.
2. Re-dispatch verifier OR resume from section 4.
3. Continue to phase-level ATC review.
4. Reach the synthetic phase close.

## Files

- `checkpoint.md` - synthetic ORCHESTRATOR-CHECKPOINT.md with all 6 required
  fields populated.
- `state.md` - synthetic STATE.md with `killed_at_step: verify`.

## Acceptance

Scenario verdict === 'PASS' AND reason === 'chaos_pass'.

ASCII-only.
