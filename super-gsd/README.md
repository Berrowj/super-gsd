# Super GSD Runtime

This directory contains the SGSD runtime: agents, skills, hooks, gates,
cockpit scripts, Codex wrappers, and setup tools.

Use the repository root `README.md` for end-user setup. The live contract is:

- Claude/Opus orchestrates.
- The active strategic board is Opus-only by default: CEO + Architect +
  Contrarian, with Architect and Contrarian pinned to Opus 4.7/xhigh intent.
- Codex GPT-5.5 with xhigh reasoning owns research, planning, plan review,
  source-changing execution, verification, and SGSD gate checks.
- Sonnet/Haiku Claude agent files are legacy/disabled by default and are not
  Codex fallbacks.
- SGSD memory is `.planning/memory/` plus `MEMORY.md`; legacy `.brv` content is
  migration input only.
- VTP/private KB is optional. Fresh clones use bundled SGSD docs and local
  `.planning/memory/` when private MCP servers are absent.

## Safe Setup

From the project root:

```bash
bash super-gsd/install.sh --doctor
bash super-gsd/install.sh --init-project
```

On Windows PowerShell, avoid the WSL `bash.exe` shim:

```powershell
& "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe" super-gsd/install.sh --doctor
& "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe" super-gsd/install.sh --init-project
```

Global Claude assets are opt-in:

```bash
bash super-gsd/install.sh --install-global --dry-run
bash super-gsd/install.sh --install-global
```

Global Claude auto-approve is a separate explicit opt-in:

```bash
bash super-gsd/install.sh --enable-autoapprove
```

## First Run Checks

```powershell
sgsd -NoOpen
node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test
node super-gsd/tools/provider-health/check.cjs --provider codex
node super-gsd/tools/autopilot-watchdog/check.cjs --self-test
```

`sg` boots the cockpit and starts Claude in the current terminal. The cockpit
and narrator are operator surfaces; Codex execution status is shown through the
Codex monitor/watch panes.
