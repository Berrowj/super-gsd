---
phase: 24
phase_name: Richer Output Contract
milestone: v1.5
status: discussed
date: 2026-04-25
discussed_via: fast-track (single SKILL.md update across 3 surfaces)
---

# Phase 24 — Richer Output Contract

## Goal

Adopt the FINDINGS_DETAIL contract footer Codex began emitting spontaneously in v1.4 Phase 20 Round 3. Three concerns:
- CONTRACT-01: Activate the dormant FINDINGS_DETAIL prompt directive (currently commented-out stubs in SKILL.md at lines ~582-587 and ~1031-1036)
- CONTRACT-02: Extend `validateContract` to parse FINDINGS_DETAIL lines into `report._findings_detail` array
- CONTRACT-03: Update SKILL.md ATC-REVIEW.md write description to render findings_detail as a "Findings Detail" section with per-tuple bullets

## Decisions locked

- **Single SKILL.md edit** — all 3 CONTRACT REQs concentrate in `super-gsd/skills/sgsd-orchestrate/SKILL.md`. No new files, no .sh/.cjs changes.
- **Optional, not required** — FINDINGS_DETAIL remains an optional footer; missing detail still validates. Malformed detail → log warning, treat as missing (per existing CONTRACT-02 spec wording).
- **Severity vocabulary** — `CRITICAL | WARNING | INFO` (matches existing CRIT/WARN/INFO usage in code-reviewer-v1).
- **Dimension vocabulary** — `naming | logic | security | performance | style | architecture` (per existing stub comment).
- **Render shape** — under "## Findings Detail" heading, one bullet per tuple: `- **[severity]** [dimension] — description`.

## Files to modify

- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — uncomment + activate prompt directive (2 sites), extend validateContract to parse FINDINGS_DETAIL → `report._findings_detail` array, add ATC-REVIEW.md render instructions

## Out of scope

- Changing existing 5-line contract (FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER stays required)
- New severity/dimension vocabulary
- Per-dispatch ATC review.md format (this phase scopes phase-level only — per-dispatch can land in carryover if needed)

## Next

1 plan: 24-01 covering all 3 CONTRACT REQs.
