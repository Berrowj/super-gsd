# Milestone v2.9 - Agentic Harness Evolution

Status: draft, inactive, not wired into `.planning/STATE.md`
Created: 2026-04-30
Phase range: 98-105
Source paper: Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses, arXiv 2604.25850v1
VTP slug: `agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a`

## Mission

Turn SGSD from a hand-improved orchestrator into an observability-driven harness that can improve its own harness components under controlled, measurable, revertible conditions.

This milestone does not mean "let the agent rewrite itself freely". It means:

1. Make editable harness components explicit.
2. Distill long runs into layered evidence before changing the harness.
3. Require every harness edit to declare a prediction.
4. Measure the next run against that prediction.
5. Keep, revert, or pivot based on evidence.

The paper's central warning applies directly to SGSD: if we only add more gates, prompts, and dashboards, we create bloat. The better move is to make every change falsifiable and attributable.

## Current SGSD Baseline

SGSD already has several AHE ingredients:

- `super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs`
- `super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs`
- `super-gsd/tools/failure-injection/harness.cjs`
- `super-gsd/tools/state-resolver/resolve.cjs`
- `super-gsd/scripts/lib/orchestrator-hooks.cjs`
- `super-gsd/tools/double-agent-executor/run.cjs`
- `.planning/metrics/orchestrator-pulse.jsonl`
- `.planning/metrics/activity-log.jsonl`
- `.planning/metrics/context-packet-log.jsonl`
- `.planning/metrics/route-decisions.jsonl`
- `.planning/metrics/token-attribution.jsonl`
- `.planning/metrics/failure-injection-log.jsonl`
- `.planning/metrics/controlled-actions-log.jsonl`

The missing piece is the closed loop:

```text
run evidence -> distilled root causes -> predicted harness edit -> next run verdict -> keep/revert/pivot
```

## Required Reading Before Execution

Claude/SGSD must read these before Phase 98:

1. `C:\Users\user\Voice-Text-Plan\wiki\research\agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a.md`
2. `C:\Users\user\Voice-Text-Plan\wiki\research\agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a.enrichment.json`
3. `C:\Users\user\GSDedits\.planning\milestones\v2.9\VTP-AHE-EVIDENCE.md`
4. `C:\Users\user\GSDedits\super-gsd\tools\harness-benchmark\README.md`
5. `C:\Users\user\GSDedits\super-gsd\tools\double-agent-executor\README.md`
6. `C:\Users\user\GSDedits\super-gsd\tools\state-resolver\resolve.cjs`
7. `C:\Users\user\GSDedits\super-gsd\scripts\lib\orchestrator-hooks.cjs`
8. `C:\Users\user\GSDedits\.planning\milestones\warp-integration\ROADMAP.md`

## Non-Negotiable Rules

1. Keep the base model, budget, verifier, and benchmark oracle fixed while evaluating harness changes.
2. Active decks, hidden expected failures, and scoring oracles must stay outside the model-visible workspace.
3. No harness edit may change the verifier, hidden oracle, model, reasoning effort, token budget, or scoring script unless a separate operator-approved milestone says so.
4. Every harness edit must name the component class it changes: prompt, tool, middleware/hook, skill, agent config, memory, workflow, MCP bridge, gate, or dashboard.
5. Every harness edit must include predicted fixes and predicted regressions before the next evaluation run.
6. No clean milestone close if predicted outcomes were never evaluated.
7. Reverts are normal. A reverted change is a useful result, not a failure.
8. Component stacking must be tested. Do not assume locally-good gates combine well.

## Milestone Phases

| Phase | Name | Goal |
|---:|---|---|
| 97.5 | Semantic Verification Gate | Mechanically reject plans whose acceptance criteria are 100% structural. Adds required `semantic_acceptance_criteria` array to plan schema v2 + SCHEMA-09/-10 validator errors. Inserted 2026-05-18 in response to Clarity ERP audit-gate incident (DLB-07). |
| 98 | Harness Component Substrate | Make SGSD harness components explicit, file-addressable, owned, and rollbackable. |
| 99 | Trajectory Evidence Corpus | Distill long SGSD runs into layered evidence: overview, per-task reports, drill-down traces. |
| 100 | Change Manifest Prediction Ledger | Require every harness edit to declare evidence, root cause, expected fixes, and regression risks. |
| 101 | Attribution And Rollback Gate | Compare predictions with next-run outcomes, then keep, revert, or pivot by evidence. |
| 102 | Harness Evolution Runner | Build the safe outer loop that runs evaluation, distillation, proposal, bounded edit, and commit. |
| 103 | Component Ablation And Interference | Measure which components carry value and where stacked controls duplicate or interfere. |
| 104 | Transfer And OOD Benchmark | Freeze candidate harness changes and test them on held-out tasks/providers/workspaces. |
| 105 | Release Gate And Cockpit Integration | Add milestone-close enforcement and make harness evolution visible in cockpit/MCP. |

## What This Should Unlock

- SGSD can tell whether a new gate, hook, prompt rule, or MCP tool actually improves runs.
- Claude can stop adding process because it "sounds right" and start adding process because it predicts and proves a measurable effect.
- Cockpit can show harness health: active hypothesis, predicted fixes, regression risk, last verdict, and revert candidates.
- Future SGSD milestones can use the same AHE loop to evolve without burning millions of tokens blindly.

## First Execution Command

When the operator activates v2.9 later, start with:

```powershell
cd C:\Users\user\GSDedits
/sgsd-orchestrate go
```

If SGSD does not auto-detect v2.9, run discussion first:

```powershell
/gsd-discuss-phase 98
```

Do not activate v2.9 while v2.7/v2.8 is still in progress unless the operator explicitly pauses the active roadmap.
