# P157-T2 report — ORCHESTRATOR-SALVAGED (wrapper timeout during report write)

Provenance: the executor wrapper hit its 1800s timeout at 09:45 while Codex was
writing its final report; the work itself completed. Everything below is
orchestrator-verified from the workspace.

FILES_CHANGED:
- super-gsd/tools/vtp-readiness/run.cjs (created — three probes, exits 0/1/2)
- super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs (extended — readiness-entrypoints)
- super-gsd/registry/skill-routing.yaml + super-gsd/scripts/lib/skill-routing-registry.cjs
  (on-demand readiness row gains dispatch + compiled fallback)
- super-gsd/skills/sgsd-readiness/SKILL.md, super-gsd/agents/sgsd-milestone-readiness.md,
  super-gsd/agents/sgsd-phase-readiness.md, super-gsd/skills/sgsd-orchestrate/SKILL.md
  (both surfaces wired; agents consume PROBE LOG rows)
- super-gsd/scripts/lib/orchestrator-hooks.cjs (AMENDMENT-1 redaction:
  _redactRenderedProjectDir + spawn-error scrubbing) — NOT in the plan's
  files_touched because AMENDMENT-1 postdated the planner; necessary seam,
  recorded as deviation.

VERIFICATION (orchestrator-run, 2026-08-20 09:46-09:50):
- `assert-vtp-readiness.cjs --case readiness-entrypoints` -> 57/57 assertions, exit 0,
  including AMENDMENT-1 redaction assertions (CLI JSON + every appended row omit
  dispatch.cwd, rendered project_dir, raw errors).
- `skill-routing-registry.cjs --self-test` -> exit 0.
- `orchestrator-hooks.cjs --self-test` -> 18/19; sole failure is pre-existing A1
  (proven on HEAD before this phase).
- Red runs: recorded by the executor pre-implementation per prompt; the report body
  carrying them was lost to the timeout. The test permanently encodes both red
  conditions as fixtures (runner-absent Rule 0; consult row without dispatch).

DEVIATIONS: orchestrator-hooks.cjs modified beyond plan files_touched (see above).
BLOCKERS: none after unsandboxed re-run.
ONE_LINER: Three VTP probes live on both readiness surfaces with path-redacted
manual output; dual red runs encoded as fixtures.
