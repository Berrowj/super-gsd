# AGENTS.md

Tool-neutral rules for any agent (Warp, Claude Code, Codex, ACP). Compact; defers to specialists.

## Project

Super GSD (SGSD) — autonomous Claude-Code orchestration. Milestones → phases → plans → sub-agents under gates with evidence. Runtime: `sg` (boots cockpit + greets Claude in current Warp tab).

## Truth Locations

- `.planning/STATE.md` — active milestone/phase/plan; `last_activity`. Frontmatter is canonical and cockpit-readable.
- `.planning/milestones/{milestone}/ROADMAP.md` — active per-milestone roadmap.
- `.planning/ORCHESTRATOR-CHECKPOINT.md` — recovery point (absent when no checkpoint open).
- `.planning/metrics/*.jsonl` — append-only evidence ledgers (token, codex, gates, MUDA, edge-guard, route).
- `.planning/milestones/{milestone}/phases/{NN-…}/*.md` — per-phase CONTEXT/RESEARCH/PLAN/VERIFICATION/ATC.

Active roadmap: v2.2-v2.8 at `.planning/milestones/warp-integration/ROADMAP.md`. Prior (v1.6-v2.1, COMPLETE 2026-04-29) preserved in STATE.md `previous_roadmap:`.

## Rule Hierarchy

`AGENTS.md` (this) → `WARP.md` (Warp-specific; wins in Warp per docs) → `CLAUDE.md` (Claude Code orchestrator contract; required for Claude Code, ignored by others). Tool-specific rule files (`.cursorrules`, etc.) derive from this if needed.

## Hard Rules

1. **Read state from `.planning/`, not scrollback or guesswork.** Inventing phase/agent/gate/token data is a correctness violation.
2. **Don't duplicate SGSD gates.** ATC, verifier, MUDA, release-readiness, edge-guard exist in `super-gsd/` + `super-gsd/registry/gates.yaml`. Call existing gates; never re-implement.
3. **VTP / private KB is OPTIONAL.** Code consuming VTP must degrade gracefully when absent (Phase 48 selective-bridge contract).
4. **Preserve `sg` topology.** Claude stays in the terminal where `sg` was typed; cockpit opens separately. No nested launchers that hide Claude from Warp's CLI detector.
5. **No source mutations without a Plan.** Code changes belong in `{NN}-…-PLAN.md` tasks. Doc-only edits to `.planning/` are exempt. Don't touch `super-gsd/`, `.warp/`, or repo-root config outside an active plan.

## Daily Commands

See `WARP.md` § Daily Commands. Quick reference:

- `sg` / `sg -Go` — cockpit + Claude (greet / autonomous).
- `sgsd` / `sgsd -NoOpen` — cockpit only / preflight only.
- `sgsd-setup` — configure knowledge bank + memory roots.
- `node super-gsd/tools/token-attribution/collect.cjs --write --all --agent-spend --summary --current` — token summary.

Don't invent SGSD commands. File a phase plan or `.warp/workflows/` entry.

## Per-Agent Pointers

- **Claude Code**: also load `CLAUDE.md` (loop, dispatch, exit conditions, model routing, checkpoint).
- **Warp Agent**: also load `WARP.md`. Use SGSD MCP for state queries once v2.3 (Phase 68+) ships; until then read `.planning/STATE.md` frontmatter via Codebase Context.
- **Codex / Other CLIs**: this file is your contract. Read `.planning/` directly.
