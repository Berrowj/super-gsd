---
phase: 7
name: Integration and Installation
---

# Phase 7 Context: Integration and Installation

## Goal
Any Claude Code Max plan user can install Super GSD with one command and start building immediately, including migration from GSD 2.0.

## What Exists

- `super-gsd/install.sh` — 8-step installer with `--init-project`, `--skip-brv`, `--dry-run` flags
- `super-gsd/CLAUDE-OVERLAY.md` — autonomous loop brain, checkpoint protocol, model routing, ByteRover integration
- `super-gsd/skills/gsd-transition/SKILL.md` — 6-step migration from GSD 2.0 (Pi harness)
- `super-gsd/README.md` — install guide with manual steps and verification instructions
- `super-gsd/config/model-routing.json` — model routing config
- `super-gsd/hooks/` — 5 hooks (gsd-checkpoint-writer.js, gsd-context-monitor.js, gsd-session-start.js, gsd-stuck-detector.js, gsd-token-logger.js)
- `super-gsd/agents/` — 7 agents (board members + CEO + classifier + context-selector)
- `super-gsd/skills/` — 9 skills

## Requirements This Phase Closes

- INST-01: One-command install with `--init-project`
- INST-02: Cross-platform (WSL2, macOS, Linux)
- INST-03: No API keys — Max plan OAuth only
- INST-04: CLAUDE-OVERLAY.md teaches Claude Code the orchestrator loop
- TRANS-01: `/gsd-transition` migrates .gsd/ artifacts to .planning/ + .brv/

## Validation Approach

Phase 7 is verification-only — the artifacts already exist. Plans validate correctness, portability, and completeness rather than building new code. Any gaps found during validation are fixed inline.
