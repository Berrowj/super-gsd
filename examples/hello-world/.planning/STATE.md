---
gsd_state_version: 1.0
project: hello-world
project_kind: super-gsd-demo-fixture
milestone: H1
milestone_name: Greeting (queued)
milestone_status: queued (fixture, not executed)
status: SCAFFOLDED 2026-04-29 - example fixture for SGSD wizard. Phases 01 and 02 are illustrative only and are NOT executed by SGSD against this fixture.
stopped_at: 2026-04-29 - fixture scaffolded by Phase 60 of milestone v2.1. Awaiting wizard --defaults invocation.
last_updated: "2026-04-29T05:30:00Z"
last_activity: "Fixture created for examples/hello-world/. Wizard has not yet been invoked. config.json does not exist yet."
progress:
  H1:
    total_phases: 2
    completed_phases: 0
    completed_plans: 0
    percent: 0
    phase_01: "queued - Greeting Core (illustrative)"
    phase_02: "queued - Greeting CLI (illustrative)"
backlog:
  total_unresolved: 0
---

# hello-world STATE

This is a minimal STATE skeleton for the SGSD demo fixture. It
exists so that the wizard's `runWizard()` precondition check
(planning_dir_exists) is satisfied when the operator runs:

```
cd examples/hello-world
node ../../super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults
```

## Progress bar

```
H1 Greeting     [..........]  0% (0/2 phases queued)
```

## Notes

- Phases 01 and 02 are illustrative only. They demonstrate
  the shape of a real project's roadmap; they are not run.
- The wizard reads only `.planning/` directory existence, not
  this STATE file. This file is here so the fixture resembles
  a real SGSD-managed project.
- After running the wizard with `--defaults`, the file
  `.planning/config.json` will exist with the project block
  populated. Re-running is idempotent (no mtime bump, no diff).
