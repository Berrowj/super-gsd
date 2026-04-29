---
phase: 61
name: Public Docs Refresh
milestone: v2.1
depends_on: [60]
unblocks: [62]
synthesized_at: 2026-04-29
---

# Phase 61 Context

## Goal (verbatim 758)

README quick-start + VTP-optional callouts + "What This Repo Is For" preamble distinguishing operator-build (this repo) vs end-user-install.

## Locked: 61=C

## Outputs

- Edit: `README.md` (preamble + VTP-optional everywhere + linked startup guide)
- 61-* artifacts

## Acceptance

- `grep -i "vtp" README.md` shows zero "required" or "must" — only "optional"
- Quick-start `sg` command block tested live
- Preamble paragraph distinguishes the two audiences explicitly

## Hand-off

Single dispatch: surgical README.md edit (preamble + VTP-optional sweep + quick-start) + 61-* artifacts.
