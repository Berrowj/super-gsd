---
plan_id: 98-09
phase: 98
title: Install Cleanup Contract
status: active
owner: codex
created: 2026-05-13
---

# Plan 98-09 - Install Cleanup Contract

## Goal

Make the current SGSD checkout and user-level install match the operator contract:
Opus orchestrates, Codex handles research/planning/execution/gates, Sonnet is
not an active fresh-clone/default route, and legacy BRV assets are removed from
the live install surface.

## Tasks

- [ ] Back up user-level Claude/Codex/profile assets before global cleanup.
- [ ] Remove stale global BRV command, hook, and template files without changing
      Claude global permission settings.
- [ ] Normalize Git Bash installer HOME handling so Windows installs target the
      real `%USERPROFILE%\.claude`, not an accidental `/h/.claude`.
- [ ] Update PowerShell shortcut help text to describe `.planning/memory` instead
      of `.brv/context-tree`.
- [ ] Change agent registry sync so Sonnet/Haiku Claude agents are not active
      default routes unless explicitly allowed, while Codex contract agents remain
      visible.
- [ ] Align `.planning/config.json` planner/context settings with Codex-first
      and `.planning/memory`.
- [ ] Refresh global shortcut block, rebuild context cache, and run SGSD
      self-tests/preflight.

## Non-Goal

Do not reset or alter Claude global permission mode / auto-approval settings in
`~/.claude/settings.json`.
