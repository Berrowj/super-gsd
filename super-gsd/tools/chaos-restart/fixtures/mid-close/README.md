# Fixture: mid-close

## Kill Point

Close subprocess killed AFTER STATE.md edit but BEFORE the close-phase
atomic commit fired.

## Resume Expectation

The resume probe MUST:
1. Detect uncommitted STATE.md modifications.
2. Re-stage and commit close-phase atomic.
3. Advance current_phase counter.
4. Reach synthetic next-phase ready state.

## Files

- `checkpoint.md` - synthetic ORCHESTRATOR-CHECKPOINT.md with all 6 required
  fields populated.
- `state.md` - synthetic STATE.md with `state_md_modified: true` and
  `close_commit_pending: true`.

## Acceptance

Scenario verdict === 'PASS' AND reason === 'chaos_pass'.

ASCII-only.
