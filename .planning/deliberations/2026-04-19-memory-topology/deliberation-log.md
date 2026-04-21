---
deliberation: memory-topology
brief: .planning/briefs/2026-04-19-memory-topology.md
decision_memo: .planning/decisions/DLB-01-memory-topology.md
agents: [architect, pragmatist, contrarian, moonshot]
rounds: 2
date: 2026-04-19
model: sonnet
---

# Deliberation Log — Memory Topology

## Round 1
- 4 agents in parallel, ~12k tokens each, 24–36s each
- Split: 2 for `sgsd-memory` MCP shim (Architect + Pragmatist), 1 for no-infra INDEX.md (Contrarian), 1 for git-tracked portable CLI (Moonshot)
- Contrarian's challenge substantive → Round 2 warranted

## Round 2
- 4 agents in parallel, each shown all 3 other positions
- Convergence on:
  - Leave 12 files in place (4/4)
  - git-track the corpus (4/4)
  - orchestrator-injected retrieval (4/4)
  - BM25 ranking deferred until corpus earns it (3/4 + Architect concedes)
- Residual split: MCP today vs not (2–2, with divergent implementations on the YES side)

## Token usage (estimated)
- Round 1: ~50,000 tokens (4 × ~12.5k)
- Round 2: ~56,000 tokens (4 × ~14k)
- Total: ~106,000 tokens for this deliberation

## Outcome
Synthesized decision at `.planning/decisions/DLB-01-memory-topology.md`.
