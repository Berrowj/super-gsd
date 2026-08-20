# P156-T1 report — ORCHESTRATOR-SALVAGED (Codex stdout lost to wrapper kill)

Provenance: the executor wrapper (task bsksg53pj) was externally killed 4 minutes into
the run at 04:21; the Codex process (PID 34128, gpt-5.6-sol xhigh) survived detached,
completed the task, and exited at 04:47. Its final stdout report died with the pipe.
Everything below is orchestrator-verified from the workspace, not from executor claims.

FILES_CHANGED:
- super-gsd/tools/state-write/write.cjs (created, 21104 bytes)
- super-gsd/tests/state-close-contract/assert-state-write.cjs (created)
- super-gsd/hooks/gsd-phase-boundary.sh (created, repo-owned source; line-25 advisory
  replaced with state.write ownership wording)
- super-gsd/install.sh (modified, hook copy loop extended)
- super-gsd/skills/sgsd-orchestrate/SKILL.md (modified, Step 11 plan-close call +
  Step 6.6.j phase-close call)

VERIFICATION (orchestrator-run, 2026-08-20 04:48-04:53):
- RED (reproduced deterministically: write.cjs moved aside, suite run, restored):
  `node super-gsd/tests/state-close-contract/assert-state-write.cjs --case all`
  -> "FAIL state.write implementation missing: ...write.cjs" / "0/1 assertions passed"
- GREEN: same command -> PASS atomic-idempotent, PASS refuse-backwards,
  PASS orchestrator-hook-wire, "36/36 assertions passed", exit 0 (real 94s)
- `node super-gsd/tools/state-resolver/resolve.cjs --self-test` -> exit 0

DEVIATIONS:
- Codex-authored red run lost with the killed pipe; replaced by the orchestrator's
  deterministic reproduction above (implementation-holdout red). Disclosed, not silent.

BLOCKERS: none

SCRIPTS_CREATED: super-gsd/tools/state-write/write.cjs | atomic STATE projection
writer | writeState(options) + CLI event envelope, exit 0/1/2

ONE_LINER: state.write() shipped red-then-green with projection-ahead refusal keyed on
resolver staleness signals; report salvaged by orchestrator after external wrapper kill.
