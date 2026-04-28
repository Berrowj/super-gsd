---
phase: 50-cockpit-research-dashboard
tier: FULL
gate: phase-level-ATC
provider: claude-sonnet
reviewed_at: 2026-04-28
verdict: warn
---

# Phase 50: Cockpit Research Dashboard — ATC Review

**Phase Goal:** Make current work, active agents, Codex state, evidence, blockers, token spend, and context source mix obvious at a glance. Improve the existing cockpit (no second cockpit), fit operator viewport, remove repeated info across panes.

**Diff Stats:** 12 files changed, 4885 lines added, 121 lines deleted (range `868077a^..302be20`)

---

## 7-Step ATC Framework

| Step | Status | Notes |
|------|--------|-------|
| 1. First Principles | PASS | Phase goal is genuinely load-bearing operator observability. No speculative features introduced. |
| 2. Delete | PASS | Codex one-liner block removed (comment at line 1845). Mission-strip codex column collapses to placeholder. Net deletion is real. |
| 3. Simplify | PASS | Each panel is a single-responsibility renderer. No new abstractions not justified by the panel isolation constraint. |
| 4. Accelerate | PASS | Fingerprint-keyed snapshot cache (Get-CockpitDataSnapshot) and mtime+size keyed tail cache (Get-CachedTail) prevent redundant node spawns and file reads per render frame. |
| 5. Automate | PASS | Node bridge invoked once per render frame; snapshot cached; FileSystemWatcher drives redraws. No over-automation. |
| 6. Validate | PASS | 8/8 selfTest in cockpit-shell.cjs; Test-CockpitReadOnlyInvariant fingerprint harness; 14-fixture acceptance suite covering all viewport sizes and codex states. |
| 7. Checklist | WARN | 8/10 anti-slop points pass. One medium defect found (see below). |

---

## 10-Point Anti-Slop Checklist

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every new function/class has a caller (no orphans) | PASS | All 5 exported functions wired in sgsd-mission-control.ps1; verifier link table confirms. |
| 2 | Every import is used (no dead imports) | PASS | cockpit-shell.cjs: tokenAttr, tokenWaste, memGov all called in buildSnapshot. |
| 3 | Every parameter is read (no unused args) | FAIL | Line 1885: Format-SgsdActiveAgentPanel called with -History $activeAgents (same as -Active) and -ToolStream @() in compact path. Full-render path (1885 region) appears symmetric — see M1 below. |
| 4 | Could this be less code? | PASS | Panel files are 138-215 lines each. All lines load-bearing. |
| 5 | New abstractions justified? | PASS | Bridge + 3 panel files mirror Phase 45 isolation pattern; justified by the phase goal. |
| 6 | Does existing code do 80% of this? | PASS | Bridge imports Phase 41/42/49 tools by reference; panels render snapshot data only. |
| 7 | Would a senior engineer mass-delete this? | PASS | No TODO/FIXME/PLACEHOLDER/HACK; no dead exports. |
| 8 | ΔComplexity ≤ 0? | WARN | sevenKeysOK label says "7 top-level keys" but asserts 8 — minor internal skew. _SgsdTokenVerdictColor and _SgsdSourceMixVerdictColor structurally identical (deliberate panel isolation, acceptable). |
| 9 | Any "just in case" additions? | PASS | Frozen consts mirror Phase 45 lock requirement. |
| 10 | Does this phase do ONE thing? | PASS | All 6 SGSD commits are cockpit observability additions. No scope creep. |

---

## Severity-Bucketed Findings

### CRITICAL (0)
None.

### HIGH (0)
None.

### MEDIUM (1 — WARNING)
- **M1 [compact-path A2 param defect]** `super-gsd/scripts/sgsd-mission-control.ps1` ~line 1885: compact-render path calls `Format-SgsdActiveAgentPanel -Active $activeAgents -History $activeAgents -ToolStream @()`. The `-History` param receives the same value as `-Active` (not a distinct history roster), and `-ToolStream` is always empty. Full-render path passes `$history` (IDLE/RECENT agents) and `$toolStream` (last MCP result). Compact mode is the default on a 1366×768 laptop — the primary target viewport — so this regresses the phase goal of making active agents obvious at a glance there.

### LOW (3)
- **L1 [selfTest label skew]** `cockpit-shell.cjs` ~line 214: check label says "7 top-level keys" but the assertion validates 8. No behavioral impact.
- **L2 [fixture mutation risk]** `run-acceptance-fixtures.ps1` `Substitute-TsTokens` mutates `$Path` via `Set-Content`. Path is a temp-dir copy so safe at runtime; mid-run restart could corrupt without cleanup. Low probability.
- **L3 [stale header comment]** `run-acceptance-fixtures.ps1` line 4 reads "Phase 30 T1" — leftover from prior harness.

---

## Lock Invariant Verification

| Lock | Requirement | Status |
|------|-------------|--------|
| Lock 11 | No embedding/cosine/similarity/vtp_search in panel scripts | PASS — grep confirmed only in prohibition comments |
| Lock 13 | Never throws upward; degrade-to-unavailable | PASS — all panels + bridge wrapped in try/catch |
| Read-only invariant | No writes under .planning/ or super-gsd/tools/ from render frame | PASS — grep writeFile/appendFile on cockpit-shell.cjs: no matches |
| Phase 41/42/49 untouched | require() by reference only | PASS — `git diff --quiet` on locked tool trees: exit 0 |
| Single-pane Codex | No duplicate Codex renders | PASS — one-liner block removed (line 1845 comment); A3 tile is sole Codex source |
| 40-row compact threshold | Compact triggers at <40 rows | PASS — confirmed at line 1495 |

---

## Verdict: WARN

One medium defect (M1) degrades the compact-render path's A2 panel — the very viewport the phase was optimised for. No lock violations, no critical issues, no data loss. **M1 to be fixed in-loop per Phase 41-49 precedent before milestone close.** L1-L3 deferred to milestone close polish.

**One-liner:** Phase 50 ATC PASS-WITH-WARN — locks clean, 0 critical; M1 compact-path A2 panel passes duplicate Active/History + empty ToolStream, fixing in-loop.
