---
phase: 133
phase_name: PowerShell Monitor Keep/Kill Migration (Terminal Fallback)
milestone: v3.3
ws: core
created: 2026-05-24
status: queued-planning
implementation_status: not-started
source: v3.3 plan P133 scoped summary (re-scoped lighter post-P132)
predecessor: P132 PASS (localhost-live is now the PRIMARY surface)
unlocks: [P134 (conformance covers the PS fallback among 4 surfaces)]
---

# Phase 133 — PowerShell Monitor Keep/Kill Migration

> **Scope re-narrowed post-P132.** Originally a heavy panel-by-panel rewrite of the 2446-line monitor. With localhost-live shipping as the primary surface (P132), the PS monitor is now the TERMINAL FALLBACK only. P133 ships the minimum changes that align the fallback with the v3.3 band grammar: KILL one stale panel, add a `--Drill` switch to gate noisy drill-in panels, add band-region banner comments.

## Goal

After P133:
- `Write-GateSavingsBlock` (line 1053) is REMOVED (KILL verdict).
- A `--Drill` (or `-Drill`) switch parameter on the PS monitor's main entry-point hides the DRILL-IN panels by default and shows them only when `-Drill` is passed.
- Three banner comment blocks added marking Band 1, Band 2, Band 3 regions for future readers.
- Light edits only — no panel re-ordering, no merging, no rewriting. PS file remains parse-clean.
- 3 SAC tests via grep on the PS file.

## Binding invariants

1. **Lock-13 untouched** — only `super-gsd/scripts/sgsd-codex-monitor.ps1` modified.
2. **Light touch** — surgical KILL + flag + comments. No refactoring.
3. **Parse-clean** — modified PS still parses without syntax error.
4. **Backward compatible** — existing invocations (no `-Drill` flag) work; drill-in panels just hidden by default.

## What ships

### `super-gsd/scripts/sgsd-codex-monitor.ps1` (modified)

1. KILL `Write-GateSavingsBlock` function (the `function Write-GateSavingsBlock {...}` block around line 1053). Remove all call sites referencing it (search the file for `Write-GateSavingsBlock`).

2. Add to the script's `param()` block (or top-level args) a `-Drill` switch parameter. If the monitor doesn't currently have a CmdletBinding/param block at top level, add a minimal one.

3. Wrap calls to the four DRILL-IN panels in a conditional:
   ```powershell
   if ($Drill) {
       Get-MudaStats ...
       Get-AtcStats ...
       Write-AtcReviewSteps ...
       Write-GateStepLine ...
   }
   ```
   Find each call site for `Get-MudaStats`, `Get-AtcStats`, `Write-AtcReviewSteps`, `Write-GateStepLine` and gate them. If a call site already has its own conditional logic, wrap or add to it.

4. Add 3 comment banners marking the visceral / behavioral / reflective regions:
   ```powershell
   # ─── BAND 1 · GOVERNING THOUGHT (visceral) ────────────────────
   # ─── BAND 2 · MECE SUPPORTING (behavioral) ────────────────────
   # ─── BAND 3 · RATIONALE (reflective · drill-in) ───────────────
   ```
   Place them before the panel-render groups that match each band (use your judgement on placement; the goal is reader-orientation, not a perfect mapping).

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (extended, pure append)

SAC-P133-01..03 appended.

## Semantic acceptance criteria

```yaml
semantic_acceptance_criteria:
  - id: SAC-P133-01
    input: "grep sgsd-codex-monitor.ps1 for the literal 'Write-GateSavingsBlock'"
    expected_outcome: "0 matches — function removed and no call sites remain"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P133-01"
  - id: SAC-P133-02
    input: "grep sgsd-codex-monitor.ps1 for 'BAND 1' AND 'BAND 2' AND 'BAND 3' band-banner comments"
    expected_outcome: "all 3 band banners present"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P133-02"
  - id: SAC-P133-03
    input: "grep sgsd-codex-monitor.ps1 for '$Drill' parameter reference"
    expected_outcome: "at least 1 $Drill reference (param block) AND at least 1 conditional gate on $Drill"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P133-03"
```

## Files touched

| Operation | Path |
|---|---|
| MODIFY | `super-gsd/scripts/sgsd-codex-monitor.ps1` (T1) |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (T2) |
| CREATE | `133-VERIFICATION.md` + `PHASE-CAPSULE.json` (T3) |

## Out of scope

- No panel re-ordering. No function merging. No band-renderer rewriting.
- No new panels. No new helpers.
- All MERGE/DECLUTTER work from the original brief is deferred to a future maintenance phase (P135+).
- Conformance gate changes (P134).

## Source references

- v3.3 brief lines 168-189 (original keep/kill table — now re-scoped lighter)
- P132 VERIFICATION (localhost-live now primary; PS is fallback)
- Krug declutter principle (Knaflic declutter-or-highlight) — KILL Write-GateSavingsBlock
