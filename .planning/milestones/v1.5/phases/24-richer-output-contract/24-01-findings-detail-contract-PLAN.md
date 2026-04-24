---
schema_version: 2
phase: 24
plan: 24-01
plan_name: FINDINGS_DETAIL contract activation (CONTRACT-01..03)
milestone: v1.5
status: ready_to_execute
expected_ATC_tier: LITE
model: sonnet
depends_on: []
created: 2026-04-25
files_touched:
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
tasks:
  - id: T-24-01-1
    hypothesis: |
      Activating the FINDINGS_DETAIL prompt directive at both phase-level-ATC
      (Step 6.5, ~line 580) and per-dispatch-ATC (Step 9.5, ~line 1031) sites
      causes Codex/Claude to optionally emit per-finding detail tuples.
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    action: |
      1. At Step 6.5 (~line 580), uncomment the FINDINGS_DETAIL prompt block
         and integrate it into composedPrompt as active code (not commented).
      2. Same at Step 9.5 (~line 1031) for per-dispatch-ATC.
      3. Strengthen wording: "you SHOULD emit FINDINGS_DETAIL lines for every
         CRIT and WARN finding — operator needs specifics, not interpretations".
      4. Keep "These lines are optional" caveat for backward-compat.
    verification:
      - cmd: grep -c "FINDINGS_DETAIL: \\[severity\\]" super-gsd/skills/sgsd-orchestrate/SKILL.md
        expect: ">= 2"
      - cmd: grep -c "composedPrompt += " super-gsd/skills/sgsd-orchestrate/SKILL.md
        expect: ">= 2"
  - id: T-24-01-2
    hypothesis: |
      Extending validateContract to parse FINDINGS_DETAIL lines into report._findings_detail
      array enables CONTRACT-02. Missing FINDINGS_DETAIL still validates (optional).
      Malformed lines log warning + treat as missing.
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    action: |
      1. After validateContract returns at ~line 578, add a sibling helper
         `parseFindingsDetail(content)` that extracts every line matching
         `^FINDINGS_DETAIL:\s+\[(CRITICAL|WARNING|INFO)\]\s+\[(naming|logic|security|performance|style|architecture)\]\s+(.+)$`
         and returns `[{severity, dimension, description}]`. Lines with FINDINGS_DETAIL prefix
         that don't match the regex log a warning + are skipped.
      2. After validateContract is called, attach `report._findings_detail` from parser.
      3. Document the contract in a comment near validateContract.
    verification:
      - cmd: grep -c "parseFindingsDetail" super-gsd/skills/sgsd-orchestrate/SKILL.md
        expect: ">= 1"
      - cmd: grep -c "_findings_detail" super-gsd/skills/sgsd-orchestrate/SKILL.md
        expect: ">= 1"
  - id: T-24-01-3
    hypothesis: |
      Updating SKILL.md ATC-REVIEW.md write description to render findings_detail
      bullets gives operator specifics-not-interpretations directly in the artifact.
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    action: |
      1. Find the section describing ATC-REVIEW.md write (~line 672 — "Write to
         .planning/phases/{NN}-*/{NN}-ATC-REVIEW.md") and add a sub-bullet:
         "If report._findings_detail is non-empty, render under '## Findings Detail'
         heading: one bullet per tuple as `- **[severity]** [dimension] — description`.
         If empty, omit the section entirely (no empty heading)."
    verification:
      - cmd: grep -c "Findings Detail" super-gsd/skills/sgsd-orchestrate/SKILL.md
        expect: ">= 1"
---

# 24-01 — FINDINGS_DETAIL Contract Activation

## Context

In Phase 20 Round 3, Codex spontaneously emitted per-finding detail tuples beyond the 5-line code-reviewer-v1 contract. The operator wanted those specifics. v1.5 Phase 24 formally adopts that emission as an optional contract footer with structured parsing + dedicated artifact rendering.

## Implementation

Single-file SKILL.md update across 3 surfaces:
1. **T-24-01-1** — Activate prompt directive at phase-level-ATC + per-dispatch-ATC dispatch sites
2. **T-24-01-2** — Extend validateContract with parseFindingsDetail helper, attach to report._findings_detail
3. **T-24-01-3** — Update ATC-REVIEW.md write spec with conditional Findings Detail render

## Verification

- grep counts confirm prompt directive activated at both sites
- grep confirms parseFindingsDetail + _findings_detail wired
- grep confirms "Findings Detail" render heading present in spec

## Out of scope

- Per-dispatch ATC review.md format (this phase scopes phase-level only — per-dispatch carryover deferred to v1.6 if surfaced)
- New severity/dimension vocabulary
- Backward-compat tracking field migration
