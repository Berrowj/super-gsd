---
phase: 60
name: Example Project + Demo
milestone: v2.1
depends_on: [59]
unblocks: [61]
synthesized_at: 2026-04-29
---

# Phase 60 Context

## Goal (verbatim 743)

Scaffolded `examples/hello-world/` runnable directory + walkthrough doc.

## Locked: 60=B

## Outputs

- `examples/hello-world/PROJECT.md`, `ROADMAP.md`, `.planning/STATE.md` skeleton
- `super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md`
- 60-* artifacts

## Acceptance

- Demo runs `node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults` from `examples/hello-world` and produces working config
- Walkthrough doc tested end-to-end (every command in the doc succeeds)

## Hand-off

Single dispatch: scaffold examples/hello-world/ + walkthrough.md + 60-* artifacts.
