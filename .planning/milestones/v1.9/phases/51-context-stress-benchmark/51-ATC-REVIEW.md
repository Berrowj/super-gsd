---
phase: 51
tier: FULL
gate: phase-level-ATC
provider: claude-sonnet
reviewed_at: 2026-04-28T19:30:00Z
verdict: pass
---

# Phase 51: Context Stress Benchmark — Phase-Level ATC Review

## Phase Goal
Prove the v1.9 milestone actually reduced token spend without evidence loss. Build context stress benchmark with blind scenarios + failure injection. Compare baseline vs post-milestone. Require ≥50% researcher token reduction on representative phases.

## Diff Stats
16 files, 6053 lines, 11 commits (cc1b41b^..HEAD). New files: harness.cjs (2203L), replay.cjs (946L), scoring.cjs (815L), failure-injectors.cjs (1050L), SCENARIO.schema.json (200L), BENCHMARK-REPORT.template.md (53L), S1-S6 fixtures + SCHEMA.md (519L), run-self-test.cjs (52L). Modified: sgsd-complete-milestone.cjs (147L), SKILL.md (1 bullet appended).

---

## 7-Step ATC Table

| Step | Result | Notes |
|------|--------|-------|
| 1 First Principles | PASS | Benchmark directly closes the falsifiable-proof gap; 6053 lines all load-bearing |
| 2 Delete | PASS | No dead production code; T1-era stubs noted in findings but bypassed correctly in _runBenchImpl |
| 3 Simplify | PASS | New module only; no brownfield complexity increase; public surface = 5 functions |
| 4 Accelerate | PASS | Sequential scenario iteration required by cumulative token ceiling; no bottleneck |
| 5 Automate | PASS | Milestone-close gate fully automated: SKILL.md → sgsd-complete-milestone.cjs → selfTest() |
| 6 Validate | PASS | 33 assertions, 18 RESEARCH-locked semantic items covered; T3.2 resolves source_event_ids against live ledger |
| 7 Checklist | PASS 8/10 | 2 LOW deviations (postRows deferral, _printSelfTestResults duplication) |

---

## 10-Point Anti-Slop Checklist

| # | Check | Result |
|---|-------|--------|
| 1 | Every new function has a caller | PASS |
| 2 | Every import used | PASS |
| 3 | Every parameter read | WARN — postRows always [] in _runBenchImpl |
| 4 | Could this be less code? | PASS — 7 subsystems, all exercised |
| 5 | New abstractions justified? | PASS |
| 6 | Existing code reused (not duplicated)? | PASS — Phase 41 summarize + Phase 45 buildPacket imported by reference |
| 7 | Senior engineer would mass-delete? | PASS |
| 8 | ΔComplexity ≤ 0? | PASS — zero upstream file changes |
| 9 | YAGNI additions? | PASS — F17 is explicitly documented contract-only stub |
| 10 | Phase does ONE thing? | PASS — falsifiable benchmark |

---

## Severity-Bucketed Findings

### CRITICAL (0)
None.

### HIGH (0)
None.

### MEDIUM (1) — fixed in-loop

- **M1**: Exported `harness.replayScenario` (line 237) delegates to `_replayScenarioImpl` (line 522), the T1-era skeleton stub that always returns `mode_used='ledger-only'` / `tokens_after=null`. Same for `harness.injectFailure` → `_injectFailureImpl`. Production `runBench` is correct (calls `replay.replayScenario` directly via `_runBenchImpl`), but the exported public API permanently stubs out for any external caller. **FIXED in-loop**: rewired `_replayScenarioImpl` and `_injectFailureImpl` to delegate to the real `replay.replayScenario` and `_injectors.injectFailure` modules.

### LOW (3 — deferred to milestone close)

- L1: `postRows` always passed as `[]` to `scoreScenario` in `_runBenchImpl` (line 339). `cache_read_ratio_after` and `useful_findings_per_token_after` silently null in all production runs. Until postRows is keyed per-scenario, those metric columns are permanently em-dash.
- L2: `_printSelfTestResults` in sgsd-complete-milestone.cjs duplicates `_printSelfTest` loop from harness.cjs (15 lines). Future refactor candidate.
- L3: `_sumUsefulFindingsPerToken` returns `0.0` (not null) when tokens present but findings zero. W3 spec reads "when sum_before === 0 ratio is null". Implementation treats sum_before as token sum, not findings sum. Non-breaking divergence.

---

## Lock Invariant Verification

| Lock | Status | Evidence |
|------|--------|---------|
| Lock 4 (upstream byte-untouched, import-by-ref) | PASS | git diff --quiet on 9 upstream tool trees exit 0 (verifier confirmed); tokenAttr.summarize at replay.cjs:214; _phase45.buildPacket at replay.cjs:690 |
| Lock 6 (F8/F16 CRIT byte-verbatim) | PASS | F8 inject() writes byte-verbatim mirror + mutated variant; t4_F8_critical_bypass_byte_verbatim asserts severity=CRITICAL, text='verbatim only', mutated_differs=true |
| Lock 11 (set-membership + byte-equality only) | PASS | NUL-delimited (kind+ref) concat key; assertWorkspaceClean uses indexOf; no levenshtein/cosine/embedding in any .cjs |
| Lock 13 (try/catch on all public APIs; no upward throws) | PASS | harness lines 228/238/250/261/271; replay.replayScenario line 588; scoring scoreScenario/aggregateGate/renderReport wrapped; failure-injectors.injectFailure wrapped; sgsd-complete-milestone outer+inner catch; assertWorkspaceClean intentional throw is documented Lock 13 contract exception |
| ASCII-only .cjs source | PASS | EM_DASH built from — JS escape; F8 payload ASCII; NUL-byte fix landed at 3ee77f8 |

---

## Anti-Cheat Boundary Verification

| Invariant | Status |
|-----------|--------|
| 1. Fixtures at operator-local path | PASS — %LOCALAPPDATA%/sgsd-bench/decks or ~/.local/share/sgsd-bench/decks |
| 2. Prompt is normal task | PASS — _buildNormalPrompt emits "Research Phase N of vX.Y SGSD." only; validated against PROMPT_FORBIDDEN_TOKENS before spawn |
| 3. expected_evidence/anti_cheat_signal never in workspace | PASS — assertWorkspaceClean rejects these literal strings |
| 4. Post-run scoring outside workspace | PASS — post_artifacts derived from Phase 45 packet fields in-process |
| 5. Workspace asserted clean before dispatch | PASS — assertWorkspaceClean(workspaceRoot) called before claude spawn |
| 6. No AKIA/sk-/ghp_ literals | PASS — F10 uses {SECRET_PLACEHOLDER_X} only; T4.5 explicitly scans payload JSON for these prefixes and asserts absence |
| Run_id witness unforgeable | PASS — bench-post-{scenario_id}-{tsMillis} in route-decisions.jsonl |

---

## Goal Achievement Narrative

The harness genuinely and deterministically measures the ≥50% researcher token reduction bar with zero evidence-loss tolerance.

Measurement path: tokens_before from Phase 41 ledger via `tokenAttr.summarize()` (import-by-reference, Lock 4). S2 baseline confirmed at 171,175 tokens (self-test T3.4). tokens_after captured from same ledger post-dispatch by ISO timestamp filter. `pct_reduction = (before - after) / before` per scenario. `evidence_retention = |expected ∩ post_artifacts| / |expected|` via NUL-keyed (kind+ref) byte-equality set membership (Lock 11).

`aggregateGate`: **median** (not mean — Pitfall 2; `_median()` is sort+midpoint) across S1-S6. PASS requires median ≥ 0.50 AND every retention = 1.0 AND every injection fired AND zero ledger-only scenarios. Verdict tree covers all four states; mechanically verified by T6.1-T6.4/T6.6.

When claude CLI is absent, the harness degrades to 'ledger-only — incomplete' and explicitly blocks the PASS verdict — it never silently advances the milestone on absence-of-evidence.

---

## Verdict: PASS

Phase 51 delivers a coherent, falsifiable context stress benchmark. Lock 4/6/11/13 invariants verified. Anti-cheat boundary clean. Median computation correct. All 18 RESEARCH-locked semantic assertions covered. Verifier returned 9/9 must-haves.

One MEDIUM finding (harness.replayScenario/injectFailure exported stubs) **fixed in-loop** by delegating to real implementations. Three LOW findings deferred to milestone close.

**One-liner:** Phase 51 ships a falsifiable benchmark with verified Lock 4/11/13 invariants, median-gate scoring, and anti-cheat boundary; M1 stub-API seam fixed in-loop, 3 LOW deferred.
