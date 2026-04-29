# WARP.md

This file gives Warp and local agents a compact guide for working in this SGSD
repository.

## Rule Hierarchy

Three rule files coexist in this repo. Read in this order:

1. **`AGENTS.md`** — tool-neutral all-agent rules: SGSD truth locations, hard rules
   (read state from `.planning/`, don't duplicate SGSD gates, VTP optional, preserve
   `sg` topology, no source mutations without a plan), and the active-roadmap pointer.
   Read first by every agent.
2. **`WARP.md`** (this file) — Warp-specific operator instructions and daily commands.
   Warp's documented behaviour: when both `AGENTS.md` and `WARP.md` exist in the same
   directory, `WARP.md` takes priority for Warp Agent. So Warp-specific guidance below
   wins inside Warp; tool-neutral rules from `AGENTS.md` still apply for cross-agent
   correctness (state truth, gate non-duplication, etc.).
3. **`CLAUDE.md`** — Claude Code's deep orchestrator contract: autonomous loop,
   dispatch rules, exit conditions, model routing, checkpoint protocol. Required for
   Claude Code; ignored by other agents.

Other tool-specific rule files (`.cursorrules`, `.windsurfrules`, `.codex/agents.md`,
etc.) are not authored in this repo. If a future tool needs them, derive from
`AGENTS.md`.

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
