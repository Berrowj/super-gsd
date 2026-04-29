---
phase: 78
artifact: research
created: 2026-04-29
authored_by: orchestrator (Opus)
---

# Phase 78 -- Research

## Pattern source

- Phase 63 § C.2 — Warp launch config behavior on Windows (M4 manual check)
- 2026-04-11 SGSD-warp-layout-design spec — original 6-pane layout idea
- Warp docs https://docs.warp.dev/terminal/sessions/launch-configurations

## Key decisions

### D1 — 2 templates, not 1

`sgsd-operator-workspace.yaml` is the daily-driver 4-pane layout; `sgsd-cockpit-only.yaml` is the lightweight monitoring layout. Splitting keeps each YAML readable and lets operators copy whichever fits their session.

### D2 — Literal cwd paths, not placeholders

Per operator brief Rule 13 ("docs phases include concrete file paths"), the templates use the literal `C:\Users\jack.berrow\GSDedits`. README documents how to edit for other installs.

### D3 — No new warp-doctor probe

Phase 67 probe 10 (`launch_config_dir_present`) already counts YAML files. Adding a dedicated "operator-workspace template installed" probe would be over-engineering — operators install or they don't.

### D4 — Reuse existing `sg`/`sgsd` shortcuts in pane commands

Templates call `sgsd` from each pane via PowerShell `. $PROFILE` to load the function. No new orchestrator boot logic. Keeps `sg` as the primary boot path per AGENTS.md hard rule 4.

## Forward references

- Phase 96 upstream candidate: launch config CLI control (Warp roadmap issue #9233 May-Jun 2026).
- Operator manual check M4 verifies behavior; if M4 PASS for active-window targeting, README needs update.
