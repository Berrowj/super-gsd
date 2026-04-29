---
phase: 58
name: Installer Portability Audit
milestone: v2.1
depends_on: []
unblocks: [59]
synthesized_at: 2026-04-29
---

# Phase 58 Context

## Goal (verbatim ROADMAP-AGENT.md:716)

Read-only probes + clean-room install test (fresh dir, captures every step that requires manual intervention).

## Locked: 58=B

## Outputs

- `super-gsd/tools/installer-audit/audit.cjs` (≥9 dependency probes)
- `super-gsd/tools/installer-audit/clean-room.sh` (tmp dir end-to-end install)
- `INSTALLER-AUDIT.md` (probe + friction log)
- 58-* artifacts

## Acceptance

- Audit reports ≥9 dependency probes
- Clean-room test runs end-to-end on a temp dir; captures every prompt / manual step
- INSTALLER-AUDIT.md includes both probe results and clean-room friction log

## Hand-off

Single executor dispatch: build audit.cjs + clean-room.sh + 9 probes + 58-* artifacts. Audit is READ-ONLY (no file mutation; no installer changes). Clean-room creates tmpdir + simulates fresh install + captures every interactive step.
