---
plan_id: 98-02
phase: 98
title: Hardwire SGSD executor work to Codex GPT-5.5 xhigh
type: code+runtime-routing
expected_ATC_tier: full
files_touched:
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/scripts/codex-executor.sh
  - super-gsd/scripts/codex-exec.sh
  - super-gsd/docs/CODEX-EXECUTOR.md
  - super-gsd/agents/sgsd-executor.md
  - super-gsd/scripts/lib/sgsd-codex-status.ps1
  - super-gsd/scripts/sgsd-boot.ps1
  - super-gsd/scripts/sgsd-mission-control.ps1
  - super-gsd/scripts/sgsd-codex-monitor.ps1
  - super-gsd/scripts/sgsd-watch-codex.ps1
  - super-gsd/scripts/sgsd-profile-extensions.ps1
  - super-gsd/scripts/Install-SgsdShortcut.ps1
  - super-gsd/scripts/sgsd-boot.sh
  - super-gsd/scripts/sgsd-headless.sh
  - super-gsd/install.sh
  - super-gsd/registry/gates.yaml
  - super-gsd/tools/feature-propagation/audit.cjs
  - super-gsd/tests/cockpit-regression/check.cjs
  - C:/Users/user/.claude/commands/sgsd-orchestrate/SKILL.md
  - C:/Users/user/.claude/agents/sgsd-executor.md
  - C:/Users/user/.claude/agents/gsd-executor.md
---

# Plan 98-02

| # | Task | Acceptance |
|--:|---|---|
| 1 | Replace optional executor routing with Codex-only routing | `/sgsd-orchestrate` instructions require Codex for every code-mutating executor dispatch |
| 2 | Remove runnable Claude `gsd-executor` dispatch examples | Live command contains no `Agent(subagent_type: "gsd-executor"` string |
| 3 | Pin Codex executor runtime | `codex-executor.sh` ignores model/effort config overrides and always uses `gpt-5.5` with `xhigh` |
| 4 | Sync live Claude slash command | `~/.claude/commands/sgsd-orchestrate/SKILL.md` matches the canonical SGSD skill |
| 5 | Disable Claude executor agent as a safety net | If accidentally spawned, `gsd-executor` reports a blocker and cannot write/edit/bash |
| 6 | Surface Codex executor status in cockpit | Main cockpit and Codex monitor read `codex-executor-live.txt` / `codex-executor-log.jsonl` |
| 7 | Add operator-readable Codex narration | SG boot opens a separate raw+narrator Codex watch window; narrator uses Claude Haiku to summarize bounded live Codex chunks |
| 8 | Verify with static checks | Search proves no live Sonnet executor dispatch remains; wrapper dry-run shows `gpt-5.5` + `xhigh`; cockpit regression covers executor reader and narrator pane |
| 9 | SSH parity hardening | Non-login SSH shells can find node/codex/claude; stale global `gsd-executor.md` is replaced with the disabled Codex-reroute blocker; per-dispatch ATC cannot skip test-only repairs |

## Stop Rule

Do not resume Clarity `/sgsd-orchestrate go` until the live slash command under
`~/.claude/commands/sgsd-orchestrate/SKILL.md` has been verified. The canonical
repo copy alone is not sufficient.
