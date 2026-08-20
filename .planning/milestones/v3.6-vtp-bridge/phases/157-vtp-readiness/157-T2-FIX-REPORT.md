# P157-T2 fix report — ORCHESTRATOR-SALVAGED (Codex killed at operator pause)

The fix-round Codex (PID 47464) was killed at operator user-stop 10:09; inspection
on resume showed its edits were already complete: run.cjs resolves vtp_root,
source_dir, and cli_entry via fs.realpathSync with containment checks, and the test
carries ancestor-symlink/junction fixtures.

VERIFICATION (orchestrator-run on resume, 2026-08-20 10:40):
`node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case all`
-> 107/107 assertions passed (was 57 pre-fix; ancestor fixtures included).

DEVIATIONS: red proof for the ancestor fixture was lost with the killed stdout;
the fixture itself permanently encodes the rejection condition.
ONE_LINER: Freshness probe now realpath-contained; symlinked/junction ancestors
rejected without path output.
