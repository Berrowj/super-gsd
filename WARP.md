# WARP.md

This file gives Warp and local agents a compact guide for working in this SGSD
repository.

## Daily Commands

- `sg` - boot SGSD cockpit separately and greet Claude in the current terminal.
- `sg -Go` - boot cockpit and send `go` to Claude for autonomous mode.
- `sgsd` - cockpit only.
- `sgsd -NoOpen` - preflight only.
- `sgsd-setup` - configure private knowledge bank, memory root, and fallback corpus.
- `node super-gsd/tools/token-attribution/collect.cjs --write --all --agent-spend --summary --current` - current token summary.

Warp repository workflows live in `.warp/workflows/`:

- `SGSD: Start`
- `SGSD: Auto Mode`
- `SGSD: Cockpit Only`
- `SGSD: Token Summary`
- `SGSD: Full Preflight`

## Project Shape

- `.planning/STATE.md` - current milestone/phase state.
- `.planning/ROADMAP.md` and `.planning/ROADMAP-AGENT.md` - roadmap and active agent-facing plan.
- `.planning/ORCHESTRATOR-CHECKPOINT.md` - recovery point for autonomous mode.
- `.planning/metrics/` - cockpit, token, Codex, routing, and gate ledgers.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` - main autonomous loop.
- `super-gsd/scripts/sgsd-boot.ps1` - cockpit/shortcut boot path.
- `super-gsd/scripts/sgsd-mission-control.ps1` - SGSD1 dashboard.
- `super-gsd/scripts/sgsd-narrative.ps1` - SGSD2 narrative stream.
- `super-gsd/scripts/sgsd-codex-monitor.ps1` - SGSD3 Codex/gate detail.

## Operating Rules

- Keep Claude in the terminal where `sg` was typed. The cockpit opens separately.
- Do not assume VTP exists for every user; private knowledge banks are optional.
- Treat `.planning/metrics/*.jsonl` as append-only evidence ledgers.
- Do not reset or delete user work to recover SGSD. Use checkpoint/state files.
- For long autonomous sessions, prefer `sg -FullPreflight` before `sg -Go`.

## Warp Integration Direction

Use Warp as the shell and visual ADE around SGSD first. The practical order is:

1. Repository workflows in `.warp/workflows/`.
2. Warp-aware boot/runtime detection in SGSD scripts.
3. Tool-neutral agent context files such as this `WARP.md` and future `AGENTS.md`.
4. ACP adapter once Warp's ACP client support is available.
5. Native Warp client contribution only through Warp's public issue/spec workflow.

The detailed plan is in `.planning/analyses/2026-04-29-sgsd-warp-incorporation-plan.md`.
