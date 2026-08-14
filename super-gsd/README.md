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
bash super-gsd/install.sh --init-project                  # cockpit deps NOT downloaded
bash super-gsd/install.sh --init-project --setup-cockpit-deps  # + Chromium for ATC visual gate
bash super-gsd/install.sh --update                         # refresh existing install after `git pull`
```

`--init-project` runs `npm install` (Playwright is now a required dep for the
ATC visual gate). `--setup-cockpit-deps` additionally downloads the ~112MB
Chromium binary via `npx playwright install chromium`. Without it the cockpit
itself still works but the ATC visual gate cannot run. To skip both, pass
`--skip-cockpit-deps`.

`--update` is the in-place refresh path after a `git pull`. It re-runs
`npm install`, re-syncs the agent registry, and ensures the memory taxonomy
exists — but it never overwrites your `CLAUDE.md`, `.planning/config.json`,
or any state under `.planning/`. If those files have drifted from the bundled
defaults the script tells you, but leaves the merge to you.

On Windows PowerShell, avoid the WSL `bash.exe` shim:

```powershell
& "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe" super-gsd/install.sh --doctor
& "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe" super-gsd/install.sh --init-project --setup-cockpit-deps
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
npm test                                                     # chronicle + cockpit self-tests (128 SACs)
node super-gsd/tools/cockpit-sidecar/playwright-audit.cjs --spawn-server --port 0   # real-browser audit (38 checks)
```

`sg` boots the cockpit and starts Claude in the current terminal. The cockpit
and narrator are operator surfaces; Codex execution status is shown through the
Codex monitor/watch panes.

## Visual gates (ATC Step 6)

Two gates run at phase close for any UI-touching phase. Both write verdict JSON
under `.planning/runtime/` and print paste-ready blocks for `PHASE-CAPSULE.json`:

```bash
# Existing — JSDOM render + DOM + SSE timing (~25s, 18 checks)
node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase <N>

# Real Chromium — catches CSS layout, real EventSource semantics, console errors,
# multi-client SSE, ARIA, 4 viewport widths (~50s, 38 checks).
node super-gsd/tools/cockpit-sidecar/atc-playwright-gate.cjs --phase <N>
# Defaults to cockpit. Point at any localhost target:
node super-gsd/tools/cockpit-sidecar/atc-playwright-gate.cjs --phase <N> --target http://127.0.0.1:8080
```

The Playwright gate auto-skips when the phase's git diff touched no UI files
(verdict: `SKIPPED-NO-UI-FILES`). Mandatory for any UI phase — see
`.planning/memory/workflow/feedback/feedback_playwright_atc_gate.md`.

## Clarity Control Plane

The Phase 1 local safety plane for worktree ownership, Git anchor reporting,
long-running job protection, and commit-pinned deploy preflight lives in
[`control-plane/`](control-plane/README.md). Start with
`control-plane/clarity-cp doctor`; it reports only and does not deploy or repair
the host.
