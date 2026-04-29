# Fixture: mid-research

## Kill Point

Researcher subprocess killed AFTER partial RESEARCH.md write but BEFORE the
researcher emits the `RESEARCH.md COMPLETE` sentinel.

## Resume Expectation

The resume probe MUST:
1. Detect that `99-RESEARCH.md` is incomplete (no terminator section).
2. Either re-run researcher OR mark research as needing rerun.
3. Advance to planner dispatch.
4. Reach the synthetic phase close.

## Files

- `checkpoint.md` - synthetic ORCHESTRATOR-CHECKPOINT.md with all 6 required
  fields populated. The validator MUST return `ok: true` on this fixture.
- `state.md` - synthetic STATE.md with `current_phase: 99` and
  `killed_at_step: research` set.

## Acceptance

The harness scenario `mid-research` runs:
1. Copy this fixture into a tmpdir.
2. Spawn a fake-subprocess that begins to "write" the research artifact,
   then SIGTERM/timeout itself partway.
3. Run the resume probe (validateManifest + synthetic close path).
4. Assert: scenario verdict === 'PASS' AND
   reason === 'chaos_pass'.

ASCII-only.
