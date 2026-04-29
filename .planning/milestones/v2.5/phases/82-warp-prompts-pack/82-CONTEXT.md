---
phase: 82
phase_name: Warp Prompts Pack
milestone: v2.5
created: 2026-04-29
status: in-progress
deviation_from_standard: docs phase
---

# Phase 82 -- CONTEXT

7 reusable Warp Agent prompts under SGSD-WARP-PROMPTS.md. Each:
- Frontmatter declares mode (read-only or may-suggest)
- Concrete prompt body operator copies into Warp Agent
- MCP tools / files / docs referenced explicitly
- Cross-references to related artifacts

## 7 prompts

P1: Current Status Explainer (read-only)
P2: Gate Triage (may-suggest)
P3: Token Waste Triage (may-suggest)
P4: Phase Plan Critic (read-only)
P5: Cockpit UX Critic (read-only)
P6: Remote Monitoring Summary (may-suggest)
P7: Release Readiness Explainer (read-only)

## Acceptance

1. 7 prompts in SGSD-WARP-PROMPTS.md
2. Each declares mode
3. Each cites MCP tools + files
4. Mode legend explicit
5. None auto-modify (AGENTS.md hard rule 5)
