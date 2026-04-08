# Feature Landscape: Super GSD Autonomous Orchestrator

**Domain:** Autonomous AI coding agent framework
**Researched:** 2026-04-08
**Confidence:** MEDIUM (training data, no live web verification)

## Competitive Landscape Summary

| Tool | Model | Autonomy | Token Awareness | Planning | Context Mgmt |
|------|-------|----------|-----------------|----------|--------------|
| Cursor | Claude/GPT | Low (editor-assist) | Poor | None | Tab-scoped |
| Windsurf | Claude | Low-medium | Poor | None | Cascade flow |
| Cline | Any | Medium | Poor | None | Manual |
| Devin | Proprietary | High | Unknown | Basic | Opaque |
| OpenHands | Any | High | Poor | Basic | Session-scoped |
| SWE-Agent | GPT/Claude | High | Poor | None | Task-scoped |
| **Super GSD** | Routed | High | **Native** | **Structured** | **BRV tree** |

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Existing? |
|---------|--------------|------------|-----------|
| Multi-step task execution | Core autonomous loop | Med | Yes (orchestrate skill) |
| File read/write/edit | Baseline coding agent | Low | Yes (Claude tools) |
| Shell command execution | Test, build, debug | Low | Yes (Bash tool) |
| Session continuity | Can't restart mid-task | Med | Yes (checkpoint-writer hook) |
| Pause/resume | Human oversight required | Med | Yes (pause/resume skills) |
| Structured output | Downstream parsing | Low | Yes (XML plan format) |
| Error recovery/retry | Fragile agents are unusable | Med | Partial (stuck-detector) |
| Progress visibility | Human trust in autonomy | Med | Yes (overwatcher) |
| Token usage tracking | Cost control | Med | Yes (token-audit, token-logger) |

## Differentiators

Features that set Super GSD apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Existing? |
|---------|-------------------|------------|-----------|
| Token-aware context selection | Other tools blow context blindly; Super GSD prunes | High | Yes (context-selector, BRV) |
| Multi-agent deliberation (CEO + board) | Better decisions via structured debate, not single LLM guess | High | Yes (deliberate skill) |
| Model routing by task type | Use cheap models for cheap tasks; premium for hard ones | Med | Yes (model routing config) |
| BM25 local semantic search | No API cost for codebase queries; fast, offline | Med | Yes (BRV + query engine) |
| Compressed XML plan format | Fewer tokens per plan; faster parse | Low | Yes |
| Planning-reader + HTML renderer | Visual plan inspection without IDE | Low | Yes (overwatcher) |
| ATC quality gate integration | Built-in code quality enforcement, not bolted on | Med | Yes (CLAUDE.md hooks) |
| Overwatcher anomaly detection | Catch stuck/looping agents before waste compounds | High | Partial |
| Classifier agent for task routing | Right agent for the job, not one-size-fits-all | Med | Yes (classifier agent) |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| GUI code editor (Cursor-style) | Wrong layer — GSD works in terminal/CLI | Keep terminal-native; integrate with existing editors |
| Cloud execution environment | Devin's model — opaque, expensive, lock-in | Stay local; user owns execution environment |
| Full PR/issue management UI | GitHub CLI + gh already handle this well | Thin wrappers only; don't rebuild what exists |
| Monolithic agent (one LLM does all) | Token-inefficient, error-prone, no specialization | Multi-agent routing is the differentiator — protect it |
| Always-on background daemon | Resource waste, permission complexity | Event-driven via hooks; spawn on demand |
| Custom vector DB | Overkill for codebase context at this scale | BM25 + BRV tree is sufficient; validate before adding embeddings |

## Feature Dependencies

```
BRV context tree → context-selector → CEO deliberation
classifier agent → model routing → orchestrate skill
token-audit → token-logger → overwatcher anomaly detection
checkpoint-writer → pause/resume → session continuity
stuck-detector → error recovery → overwatcher alerts
```

## MVP Recommendation for This Milestone

Already-built features cover table stakes well. Priority gaps:

1. **Stuck-detector + auto-recovery** — Partial only; completing this closes the biggest reliability gap vs competitors
2. **Overwatcher anomaly alerts** — Partial; HTML renderer exists but alerting logic needs depth
3. **Model routing validation** — Config exists; needs integration tests to confirm routing fires correctly

Defer: Custom embeddings/vector DB — BM25 sufficient until proven otherwise at scale.

## Sources

- Training knowledge: Cursor, Windsurf, Cline, Devin, OpenHands, SWE-Agent (as of Aug 2025)
- Confidence: MEDIUM — competitive landscape accurate as of training cutoff; verify Devin/OpenHands current feature set before roadmap finalization
