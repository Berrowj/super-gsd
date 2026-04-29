# Warp Launch Configuration Templates (Phase 78)

Two templates for spawning a Warp workspace with SGSD panes pre-configured.
Drop into `~/.warp/launch_configurations/` to make them available in Warp's
Command Palette.

## Templates

| File | What it opens | When to use |
|---|---|---|
| `sgsd-operator-workspace.yaml` | 4 panes: SGSD main + cockpit + token/codex/gate watch + shell | Daily operator session |
| `sgsd-cockpit-only.yaml` | 3 cockpit panes + shell (no Claude session) | Background monitoring while doing other work |

## Install

```powershell
# Copy templates to Warp's launch config dir:
Copy-Item super-gsd/docs/templates/warp-launch-configs/*.yaml `
          $HOME/.warp/launch_configurations/

# Verify:
node super-gsd/tools/warp-doctor/check.cjs --project C:\Users\jack.berrow\GSDedits
# Expected: launch_config_dir_present probe shows the YAML files counted
```

## Caveats (per Phase 63 manual check M4)

- **New window vs active window**: Warp opens launch configs in a NEW Warp
  window on Windows. Active-window targeting is not yet stable upstream
  (tracked at https://github.com/warpdotdev/warp issue #9233 May-Jun 2026
  roadmap). Phase 78 does NOT promise active-window behavior — operator
  Rule 14 / Phase 63 M4 documents this.
- **cwd must be absolute** or empty per Warp docs. Templates use
  `C:\Users\jack.berrow\GSDedits` literally; edit if your project root differs.
- **`sg` shortcut required**: panes call `sgsd` via the PowerShell profile.
  Templates assume the `sg`/`sgsd` functions are loaded (verify with
  Phase 67 warp-doctor probes 2-4).

## Verify post-install

After copying, open Warp Command Palette (`Ctrl+Shift+P`) and search for
"Launch Configuration: SGSD Operator Workspace". Click to open. The new
window should bring up 4 panes with the names defined above.

If panes don't open or `sgsd` doesn't resolve:

1. Check `node super-gsd/tools/warp-doctor/check.cjs` — verify probes
   2-4 (sg/sgsd/sgsd-setup defined in profile) PASS.
2. If profile didn't auto-load, add `. $PROFILE` to the relevant pane's
   command line (templates already include this).

## Existing `sg` shortcut remains primary

These templates are convenience layouts. The canonical SGSD boot path is
still `sg` from any Warp tab. Templates ship for operators who prefer
saved-workspace ergonomics; they are NOT a prerequisite for SGSD.

## Related

- Phase 63 § C.1 — `~/.warp/launch_configurations/` exists empty (now
  populatable via these templates).
- Phase 63 manual check M4 — operator UI verification of active-window
  vs new-window behavior.
- Phase 67 warp-doctor probe 10 (`launch_config_dir_present`) — checks
  for the dir; counts YAML files inside.
- v2.7 roadmap — controlled actions may add a workflow that copies
  these templates as part of a fresh-install bootstrap.
