---
project_name: hello-world
project_kind: super-gsd-demo-fixture
schema_version: 1
created_at: 2026-04-29
phase_origin: 60-example-project-demo
purpose: Reference fixture exercising the SGSD new-project wizard end-to-end
operator_pose: read-only-demo
---

# hello-world - Super GSD Demo Project

This is a fictional reference project used by the Super GSD framework
to demonstrate, exercise, and self-test the new-project bootstrapping
workflow. It is intentionally minimal: one milestone, two phases, no
production code, no runtime dependencies. Its only job is to be a
clean fixture that the wizard can configure on first run and re-run
idempotently.

## What this project does (in-fiction)

The fictional `hello-world` service prints `Hello, world` from a
single Node entrypoint. The point of the project is NOT the service;
it is the SGSD scaffolding around the service: how a new operator
points the wizard at a planning directory, watches the wizard write
`config.json`, runs the orchestrator, and walks through the panes
of the cockpit dashboard.

## Why this fixture exists

Phase 60 of milestone v2.1 (Distribution + Onboarding) ships this
fixture so that:

1. The Phase 59 wizard (`sgsd-new-project-wizard.cjs --defaults`)
   has a deterministic target it can be invoked against in CI,
   in self-tests, and in operator walkthroughs.
2. The walkthrough doc at `super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md`
   has a real directory to `cd` into, run commands against, and
   produce verifiable output from.
3. The Phase 60 third-gate self-test in
   `sgsd-complete-milestone.cjs` (v2.1 milestone close) has a
   fixture to exercise the wizard against without polluting the
   real project root.

## Hard constraints (Lock-driven)

- **Lock 4**: Files in this directory are never imported by the
  Phase 41-59 production code paths. The fixture is a target,
  never a source.
- **Lock 11**: The wizard never overwrites operator-authored keys
  in `.planning/config.json`. If a future operator hand-edits the
  fixture's config, re-running the wizard preserves their edits
  byte-for-byte.
- **Lock 13**: Walkthrough commands degrade gracefully when
  optional pieces are absent (e.g., no real `sgsd-orchestrate`
  session is required to demonstrate the wizard's effect).

## Files in this fixture

| Path                               | Purpose                                       |
| ---------------------------------- | --------------------------------------------- |
| `PROJECT.md`                       | This file - 1-page project description        |
| `ROADMAP.md`                       | Minimal 2-phase example roadmap               |
| `.planning/STATE.md`               | Minimal STATE skeleton (frontmatter + bar)    |
| `.planning/config.json` (created)  | Written by wizard on first `--defaults` run   |

## How a new operator uses this

```
cd examples/hello-world
node ../../super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults
```

After the first run, `.planning/config.json` exists with the
project block populated by sensible defaults. A second run is a
deterministic no-op (idempotent: same bytes, no mtime bump).

The full walkthrough lives at `super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md`.
