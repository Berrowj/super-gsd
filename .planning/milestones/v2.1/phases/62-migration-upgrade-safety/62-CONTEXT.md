---
phase: 62
name: Migration + Upgrade Safety
milestone: v2.1
depends_on: [61]
unblocks: []
synthesized_at: 2026-04-29
---

# Phase 62 Context

## Goal (verbatim 770)

Drift checker (8 probes) reports v1.5→v2.1 markers without modifying files.

## Locked: 62=A

## Outputs

- New: `super-gsd/tools/upgrade-drift/check.cjs`
- New: `super-gsd/docs/UPGRADE-DRIFT.md`
- 62-* artifacts

## Acceptance

- Probe count ≥ 8
- Read-only (no file modifications confirmed by checking git status before/after run)
- Includes migration-notes section enumerating v1.5→v2.1 deltas

## Hand-off

Single dispatch: build check.cjs (8+ probes) + UPGRADE-DRIFT.md (migration deltas v1.5→v2.1) + 62-* artifacts. FINAL phase of full roadmap. Then close v2.1 milestone + roadmap end-of-run acceptance.
