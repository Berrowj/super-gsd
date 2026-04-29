---
phase: 78
phase_name: Launch Configuration Templates
milestone: v2.4
created: 2026-04-29
status: in-progress
deviation_from_standard: docs+yaml templates phase
---

# Phase 78 -- Launch Configuration Templates (CONTEXT)

## Goal

Ship 2 Warp launch config YAML templates under
`super-gsd/docs/templates/warp-launch-configs/` plus a README.md
explaining install + caveats. Operators copy the YAMLs to
`~/.warp/launch_configurations/` for one-click workspace bootstrap.

## Locked Scope

- D78.1: 2 templates: `sgsd-operator-workspace.yaml` (4 panes) and
  `sgsd-cockpit-only.yaml` (3 cockpit + shell). Per Phase 78 roadmap
  acceptance.
- D78.2: All `cwd:` values absolute per Warp docs. Use literal
  `C:\Users\jack.berrow\GSDedits`; README documents how operators on
  other paths edit.
- D78.3: Phase 63 manual check M4 caveat noted in BOTH templates and
  README — opens in NEW Warp window on Windows; active-window targeting
  not yet stable. Operator Rule 14 / Phase 96 upstream-issue candidate.
- D78.4: NO new warp-doctor probe; Phase 67 probe 10 already counts
  YAMLs in launch_config dir.
- D78.5: Existing `sg` shortcut remains primary boot path; templates
  are convenience layouts, not prerequisites.

## Outputs

- super-gsd/docs/templates/warp-launch-configs/sgsd-operator-workspace.yaml (NEW)
- super-gsd/docs/templates/warp-launch-configs/sgsd-cockpit-only.yaml (NEW)
- super-gsd/docs/templates/warp-launch-configs/README.md (NEW)
- 5 Phase 78 standard artifacts

## Acceptance

1. 2 YAMLs ship with name + windows + tabs + cwd (absolute) + commands.
2. README documents install + caveats + verify path.
3. Phase 67 warp-doctor probe 10 (`launch_config_dir_present`) detects
   the YAMLs once operator copies them to ~/.warp/launch_configurations/.
4. Existing `sg` shortcut remains primary; README explicit on this.
5. M4 caveat (new-window vs active-window) documented in templates AND README.
