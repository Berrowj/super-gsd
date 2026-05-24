---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P133-01-monitor-migration
phase_id: 133-cockpit-monitor-migration
phase_number: 133
milestone: v3.3
workstream: core
title: PowerShell Monitor Keep/Kill Migration (Terminal Fallback)
created_by: sgsd-write-plan (operator + Claude Opus 4.7)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on:
  - P132-01-localhost-live
tasks:
  - id: P133-T1
    agent: sgsd-exec-config
    model: codex
    files_touched:
      - super-gsd/scripts/sgsd-codex-monitor.ps1
    input_contract: |-
      Reads existing sgsd-codex-monitor.ps1 (2446 lines, post-P131 with the
      Duarte arc in the ELI5 prompt). Reads 133-CONTEXT.md "What ships /
      sgsd-codex-monitor.ps1" section.
    output_contract: |-
      Surgical edits, no refactoring:
        (a) REMOVE the Write-GateSavingsBlock function and ALL call sites
            referencing it (the function around line 1053 + 1-3 call sites
            elsewhere in the file).
        (b) ADD a -Drill switch parameter to the script's top-level param()
            block. If there's no top-level param() block, ADD a minimal
            CmdletBinding + param block at the very top of the file (after
            any header comments).
        (c) GATE the 4 DRILL-IN panel call sites (Get-MudaStats, Get-AtcStats,
            Write-AtcReviewSteps, Write-GateStepLine) behind `if ($Drill) {...}`.
            If a panel is called from multiple places, gate ALL call sites.
        (d) ADD 3 banner comment lines marking BAND 1, BAND 2, BAND 3 regions.
            Format: `# ─── BAND N · {visceral|behavioral|reflective} ────`.
            Place them as visual section markers before whichever panel groups
            best correspond — your judgement on placement.
      PS file MUST still parse cleanly (run `powershell -NoProfile -Command
      '[System.Management.Automation.Language.Parser]::ParseFile(...)'` if
      possible to check).
      Zero other changes to the file.
    hypothesis: |-
      Surgical KILL + flag + comments is a much lower-risk migration than
      panel-by-panel restructuring. Operator gets the keep/kill audit's
      top-priority outcome (Write-GateSavingsBlock dead, drill-in noise
      gated) without touching the actually-useful panels.
    falsifier: |-
      If the PS file fails to parse after the edits (syntax break), or any
      KEEP-verdict panel stops rendering because we accidentally moved
      something, the surgical-only invariant is broken.
    stop_rule: |-
      grep for 'Write-GateSavingsBlock' returns 0 matches.
      grep for '\$Drill' returns ≥2 matches (param decl + ≥1 conditional).
      grep for 'BAND 1', 'BAND 2', 'BAND 3' each returns ≥1 match.
      File parses cleanly. SAC-P133-01..03 pass.

  - id: P133-T2
    agent: sgsd-exec-test
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Reads existing run-self-test.cjs (post-P132; 50/50 SACs green). Reads
      133-CONTEXT.md SAC-P133-01..03.
    output_contract: |-
      EXTEND run-self-test.cjs (pure append). Append 3 SAC tests after the
      SAC-P132-08 block.

      SAC-P133-01: read sgsd-codex-monitor.ps1; assert content.match(/Write-GateSavingsBlock/g) is null OR length===0.

      SAC-P133-02: read PS file; assert each of 'BAND 1', 'BAND 2', 'BAND 3' is in content.

      SAC-P133-03: read PS file; assert occurrences of literal '$Drill' >= 2.
    hypothesis: |-
      Grep-based assertions are sufficient for the surgical contract.
    falsifier: |-
      Test pollution.
    stop_rule: |-
      Full self-test: 53/53 PASS exit 0.

  - id: P133-T3
    agent: sgsd-exec-docs
    model: codex
    files_touched:
      - .planning/milestones/v3.3/phases/133-cockpit-monitor-migration/133-VERIFICATION.md
      - .planning/milestones/v3.3/phases/133-cockpit-monitor-migration/PHASE-CAPSULE.json
    input_contract: |-
      Green self-test + git log. Mirror P132 VERIFICATION/CAPSULE shape.
    output_contract: |-
      VERIFICATION verdict=PASS, 3/3 SACs.
      CAPSULE with SHA-256 hashes.
    hypothesis: |-
      Deterministic projection.
    falsifier: |-
      Self-test not green.
    stop_rule: |-
      Both files exist; verdict=PASS; valid JSON.
    depends_on:
      - P133-T1
      - P133-T2
semantic_acceptance_criteria:
  - id: SAC-P133-01
    input: "grep sgsd-codex-monitor.ps1 for 'Write-GateSavingsBlock'"
    expected_outcome: "0 matches — function removed and no call sites remain"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P133-01"
  - id: SAC-P133-02
    input: "grep sgsd-codex-monitor.ps1 for 'BAND 1' AND 'BAND 2' AND 'BAND 3' banner comments"
    expected_outcome: "all 3 band banners present in the file"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P133-02"
  - id: SAC-P133-03
    input: "grep sgsd-codex-monitor.ps1 for '$Drill' references"
    expected_outcome: ">=2 occurrences (param declaration + >=1 conditional usage)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P133-03"
---

# P133-01 PowerShell Monitor Keep/Kill Migration PLAN

## Scope

Surgical edits to sgsd-codex-monitor.ps1: KILL Write-GateSavingsBlock, add -Drill switch gating the 4 drill-in panels, add band-region banner comments. Re-scoped from original heavy migration after P132 made localhost-live the primary surface.

## Authoritative Inputs

133-CONTEXT.md, 132-VERIFICATION.md (baseline 50/50), sgsd-codex-monitor.ps1, v3.3 brief lines 168-189 (original keep/kill table).

## Binding Invariants

Per 133-CONTEXT.md (4 invariants).

## File Operations

3 task-level ops.

## Tasks

3 tasks; full contracts in frontmatter.

## Phase Verification

`node run-self-test.cjs` → exit 0; 53/53 PASS (50 pre + 3 SAC-P133).

## Out of Scope

Per 133-CONTEXT.md.

## References

133-CONTEXT.md; v3.3 brief; P132 (now primary surface).
