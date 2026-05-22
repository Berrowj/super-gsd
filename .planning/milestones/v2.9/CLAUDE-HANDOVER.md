# Claude Handover - v2.9 Agentic Harness Evolution

Status: inactive future milestone.

Do not start this milestone until the active v2.7/v2.8 roadmap is paused or complete and the operator explicitly activates v2.9.

## Mission

Implement SGSD's AHE loop:

```text
evaluate -> distill -> predict edit -> apply bounded edit -> evaluate -> attribute -> keep/revert/pivot
```

Use the VTP-enriched paper as the core design source, but implement in SGSD's existing style: local files, JSONL metrics, Lock-13 degradation, hidden benchmark oracles, and git-native rollback.

## First Files To Read

1. `C:\Users\user\GSDedits\.planning\milestones\v2.9\ROADMAP.md`
2. `C:\Users\user\GSDedits\.planning\milestones\v2.9\REQUIREMENTS.md`
3. `C:\Users\user\GSDedits\.planning\milestones\v2.9\VTP-AHE-EVIDENCE.md`
4. `C:\Users\user\Voice-Text-Plan\wiki\research\agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a.md`
5. `C:\Users\user\Voice-Text-Plan\wiki\research\agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a.enrichment.json`

## Execution Rules

1. Audit existing SGSD tools before building a new one.
2. Reuse the blind live controller, deterministic harness benchmark, failure injection harness, state resolver, cockpit adapter, MCP server, and double-agent executor where possible.
3. Do not let the evolution loop modify hidden benchmark decks, hidden scoring oracles, verifier code, model config, or token budget.
4. Every harness edit must write a manifest before evaluation.
5. Every manifest must include predicted fixes and predicted regressions.
6. Every next-run verdict must update attribution metrics.
7. Clean close is blocked if candidate harness edits lack attribution verdicts.

## Suggested Start

```powershell
cd C:\Users\user\GSDedits
/gsd-discuss-phase 98
```

If the operator approves auto-mode after discussion:

```powershell
/sgsd-orchestrate go
```
