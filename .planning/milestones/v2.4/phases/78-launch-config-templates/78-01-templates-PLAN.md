---
plan_id: 78-01
phase: 78
title: Launch config templates + README
type: docs+yaml
expected_ATC_tier: lite
files_touched:
  - super-gsd/docs/templates/warp-launch-configs/sgsd-operator-workspace.yaml
  - super-gsd/docs/templates/warp-launch-configs/sgsd-cockpit-only.yaml
  - super-gsd/docs/templates/warp-launch-configs/README.md
---

# Plan 78-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author sgsd-operator-workspace.yaml | 4 panes (SGSD main + cockpit + token/codex/gate watch + shell); name/windows/tabs/cwd-absolute |
| 2 | Author sgsd-cockpit-only.yaml | 3 cockpit panes + shell |
| 3 | Author README.md | install + caveats + verify path + M4 caveat + Related |
| 4 | Document M4 (new-window vs active-window) caveat | In both YAMLs + README |
| 5 | Atomic commit | feat(p78-01) |
