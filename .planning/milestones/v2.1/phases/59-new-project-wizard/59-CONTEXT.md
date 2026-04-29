---
phase: 59
name: New Project Wizard
milestone: v2.1
depends_on: [58]
unblocks: [60]
synthesized_at: 2026-04-29
---

# Phase 59 Context

## Goal (verbatim 730)

sgsd-configure handles knowledge/memory; new wizard handles project-level (cockpit panes, default boot mode). Must not replace either.

## Locked: 59=C

## Outputs

- Edit: `super-gsd/scripts/sgsd-configure.ps1` (add reference to project wizard)
- New: `super-gsd/scripts/sgsd-new-project-wizard.cjs` (project-level only)
- 59-* artifacts

## Acceptance

- Wizard non-destructively writes config (deep-merge, doesn't clobber existing keys)
- Re-running on same project produces same config (idempotent)

## Hand-off

Single dispatch: build sgsd-new-project-wizard.cjs (deep-merge + idempotent) + sgsd-configure.ps1 surgical edit + 8-12 self-tests.
