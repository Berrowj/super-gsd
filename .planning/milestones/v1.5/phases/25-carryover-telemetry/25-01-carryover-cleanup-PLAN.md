---
schema_version: 2
phase: 25
plan: 25-01
plan_name: Carryover cleanup (CARRY-01..03)
milestone: v1.5
status: shipped
expected_ATC_tier: LITE
model: sonnet
depends_on: []
created: 2026-04-25
files_touched:
  - super-gsd/scripts/sgsd-muda-audit.sh
  - .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md
tasks:
  - id: T-25-01-1
    hypothesis: |
      Replacing the `/^\| git_spawn_pct/` awk anchor with a `<!-- qual-row-insert -->`
      sentinel marker in compose_waste_md + grep verification stops silent row drops
      when probe ordering changes. (CARRY-01)
    files_touched:
      - super-gsd/scripts/sgsd-muda-audit.sh
    action: |
      1. In compose_waste_md, emit `<!-- qual-row-insert -->` directly after $PROBE_TABLE.
      2. In qualitative-row insert block, change awk anchor from `/^\| git_spawn_pct/`
         to `/<!-- qual-row-insert -->/`. Insert order: `print newrow; print` (sentinel
         stays after row so subsequent inserts are still anchored).
      3. After mv, grep for `codex_qualitative_waste` in WASTE.md; if absent, log a
         stderr warning ("sentinel missing in WASTE.md").
    verification:
      - cmd: bash -n super-gsd/scripts/sgsd-muda-audit.sh
        expect: exit 0
      - cmd: grep -c "qual-row-insert" .planning/milestones/v1.5/phases/22-security-hardening/WASTE.md
        expect: ">= 1"
  - id: T-25-01-2
    hypothesis: |
      Auditing providers-registry.cjs for stale `reviewer_agent` literals confirms
      Phase 17 T1 swap was thorough. (CARRY-02)
    files_touched: []
    action: |
      1. Run `grep -n "reviewer_agent\|reviewer-shaped\|reviewer_provider" providers-registry.cjs`.
      2. Confirm 0 instances of `reviewer_agent` literal.
      3. Confirm "reviewer-shaped" prose consistently describes the post-fix predicate.
      4. No code change needed; verification is the deliverable.
    verification:
      - cmd: grep -c "reviewer_agent" super-gsd/scripts/lib/providers-registry.cjs
        expect: "0"
  - id: T-25-01-3
    hypothesis: |
      Appending explicit 4-criterion methodology block to 18-DOGFOOD-AUDIT.md
      documents the strict filter. (CARRY-03)
    files_touched:
      - .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md
    action: |
      1. Insert "### Methodology (CARRY-03 strictness — v1.5 Phase 25)" block
         after the cross-reference table.
      2. List 4 criteria: provider:openai-codex, fallback_triggered:false, exit:0,
         valid 5-line FINDINGS contract.
      3. State retroactive verification: 5-row count unchanged.
    verification:
      - cmd: grep -c "Methodology (CARRY-03 strictness" .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md
        expect: ">= 1"
---

# 25-01 — Carryover Cleanup (CARRY-01..03)

Three small carryover items from v1.4 phases 17/18.

## Implementation

- T-25-01-1 (CARRY-01): sentinel marker for qual-row insert anchor + post-insert grep verification
- T-25-01-2 (CARRY-02): audit providers-registry.cjs for stale reviewer_agent references (none found — Phase 17 T1 was thorough)
- T-25-01-3 (CARRY-03): document strict 4-criterion methodology in 18-DOGFOOD-AUDIT.md

## Verification

- bash -n + smoke-run audit confirms sentinel works end-to-end
- grep verifies no reviewer_agent literals remain
- grep verifies methodology block landed in dogfood audit
