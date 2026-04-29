# Fixture: mid-execute

## Kill Point

Executor subprocess killed AFTER partial commit (T1 and T2 committed but
T3 was killed mid-write, before commit).

## Resume Expectation

The resume probe MUST:
1. Detect last good commit hash.
2. Re-stage T3 changes OR rollback cleanly.
3. Advance executor to remaining tasks.
4. Reach the synthetic phase close.

## Files

- `checkpoint.md` - synthetic ORCHESTRATOR-CHECKPOINT.md with all 6 required
  fields populated AND `last_good_commit: synthetic-abc1234`.
- `state.md` - synthetic STATE.md with `tasks_committed: [T1, T2]`,
  `tasks_in_progress: [T3]`.

## Acceptance

Scenario verdict === 'PASS' AND reason === 'chaos_pass'.

ASCII-only.
