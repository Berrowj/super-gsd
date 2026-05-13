# SGSD Workspace — Install & Use Guide

> **Who this is for:** New users on Windows + Warp who want the full Super GSD
> workspace: main Claude Code pane, live dashboards (sgsd1/2/3), mechanical
> phase gates (ATC + browser verify), and the Warp launch config that opens
> it all in one shortcut.
>
> **What this is NOT:** the orchestrator basics. For "what is sgsd-orchestrate,
> how does the loop work, how does `.planning/memory` work" — read `super-gsd/USER-GUIDE.md`
> first. This guide assumes you've done that and now want the full
> observability + gate-check stack running.

---

## TL;DR

1. Run SGSD doctor (`bash super-gsd/install.sh --doctor`)
2. Initialize the project-local SGSD files (`bash super-gsd/install.sh --init-project`)
3. Install global Claude overlay only if you want global slash commands/hooks (`bash super-gsd/install.sh --install-global`)
4. Install `gsd-browser` — Linux/macOS native, Windows via WSL + wrapper
5. Install `phase-verifier.mjs` (part of this repo, Node >= 18)
6. Install dashboard scripts (`sgsd1`, `sgsd2`, `sgsd3`) as .cmd wrappers on PATH
7. Add `browser_verify` + `atc` blocks to your project's `.planning/config.json`
8. Add `data-loaded` / `data-empty-reason` attributes to every page component
9. Add Warp launch configuration for your project
10. Open Warp palette → Launch Configuration → your project → you're done

Total time first install: ~30 minutes. Every project after that: ~5 minutes.

---

## 1. Prerequisites

Check each box before continuing. Missing any of these means install steps
below will silently skip things or fail in ways that are hard to diagnose.

| Requirement | Version | Check command |
|---|---|---|
| **Claude Code CLI** | any | `claude --version` |
| **Node.js** | >= 22 | `node --version` |
| **Git** | any recent | `git --version` |
| **Windows PowerShell** | 5.1 or later | `$PSVersionTable.PSVersion` |
| **WSL2 (Windows only)** | Ubuntu 22.04+ | `wsl --status` |
| **Warp terminal** | latest | downloaded from warp.dev |
| **A project with `.planning/`** | created by GSD init | `ls .planning/` |

### Recommended but optional

- **VTP/private KB** for richer research context. Without it, SGSD uses
  project-local `.planning/memory` and bundled SGSD docs.
- **Vite / Next.js dev server** — needed for the browser verify gate on
  frontend phases

### Claude Code Max plan vs API

This entire stack is designed for the Max plan (OAuth, no API keys). The token
cost displayed in Mission Control is shown as "API-equivalent" so you can
compare against what you would have paid on the API, but no actual API billing
is happening. There is no configuration to change for this.

---

## 2. Install GSD 1.0 base

If you don't already have GSD 1.0 installed:

```powershell
npx get-shit-done-cc --claude --global
```

Verify it landed:

```powershell
ls $HOME\.claude\get-shit-done\VERSION
cat $HOME\.claude\get-shit-done\VERSION
```

You should see a version like `1.34.2`. If the directory doesn't exist, the
install failed — re-run and watch for errors.

> **Already installed?** Run `/gsd-update` inside a Claude session to get the
> latest, or re-run the same npx command. It's safe to run against an existing
> install.

---

## 3. Install the Super GSD overlay

Clone or copy this repo (GSDedits) to your machine. You don't need to put it
anywhere special — anywhere you can `cd` to is fine.

```powershell
git clone https://github.com/YOUR-ORG/GSDedits C:\Users\YOU\GSDedits
cd C:\Users\YOU\GSDedits\super-gsd
bash install.sh --doctor
bash install.sh --init-project
```

> **Note for Windows:** `install.sh` needs bash. Use the bash shell shipped
> with Git for Windows. From PowerShell, prefer:
> `& "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe" install.sh --doctor`.
> Do not use the `C:\Windows\System32\bash.exe` WSL shim for SGSD install;
> it has a separate Linux home and may not have Node/Codex. The installer
> normalizes Git Bash `HOME` to `%USERPROFILE%` before touching `.claude`.

What the safe local installer does:
- Creates `.planning/` scaffolding in the current project.
- Creates `.planning/memory/` and `MEMORY.md`.
- Copies `CLAUDE-OVERLAY.md` to `CLAUDE.md` only if no `CLAUDE.md` exists.
- Leaves `~/.claude`, global hooks, global commands, global npm packages, and
  Claude `autoApprove` untouched.

Global install is separate and explicit:

```powershell
bash install.sh --install-global
```

Global auto-approve is separate and dangerous:

```powershell
bash install.sh --enable-autoapprove
```

Verify:

```powershell
ls .planning\config.json
ls .planning\memory\MEMORY.md
ls CLAUDE.md
```

If you also chose `--install-global`, verify the global overlay separately:

```powershell
ls $HOME\.claude\agents\sgsd-*.md
ls $HOME\.claude\commands\sgsd-*
```

If expected files are missing, re-run the relevant mode with `-x` to see what's
happening, for example `bash -x install.sh --init-project`.

---

## 4. Install gsd-browser

This is the mechanical browser driver used by the Step 6.6 frontend verify
gate. Without it, the gate halts your orchestrator on any frontend phase.

### On Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/gsd-build/gsd-browser/main/install.sh | bash
```

Installs to `~/.gsd-browser/bin/gsd-browser`. Auto-adds it to PATH.

Verify:
```bash
gsd-browser --help
```

### On Windows (via WSL)

gsd-browser has no native Windows binary. Install it inside WSL Ubuntu:

```powershell
wsl -e bash -c 'curl -fsSL https://raw.githubusercontent.com/gsd-build/gsd-browser/main/install.sh | bash'
```

Then create a Windows wrapper at `%APPDATA%\npm\gsd-browser.cmd`:

```cmd
@echo off
setlocal
wsl.exe -e /home/YOUR_WSL_USER/.gsd-browser/bin/gsd-browser %*
endlocal
```

Replace `YOUR_WSL_USER` with your WSL username (find it with `wsl -e whoami`).

> This wrapper is already created if you ran `super-gsd/install.sh` on Windows.
> Check with `where.exe gsd-browser`.

Verify:
```powershell
gsd-browser --help
```

You should see the CDP command list. If `wsl.exe` isn't on PATH, install WSL:
`wsl --install --distribution Ubuntu`

### Networking gotcha (Windows + WSL)

When gsd-browser runs inside WSL and tries to reach `http://localhost:5173`
on the Windows host, WSL2 without **mirrored networking** routes localhost
to a different address. Two fixes:

**Option A — enable WSL2 mirrored networking** (recommended, one-time):
1. Edit `%USERPROFILE%\.wslconfig`:
   ```ini
   [wsl2]
   networkingMode=mirrored
   ```
2. Restart WSL: `wsl --shutdown` then reopen any terminal.

**Option B — use the Windows host IP in config**:
1. Find it: `wsl -e cat /etc/resolv.conf | grep nameserver`
2. Use that IP in `.planning/config.json` → `browser_verify.base_url`.

If neither works, the gate will block with `Gate 4: base_url unreachable` —
that's the expected failure mode, not a bug.

---

## 5. Install the phase verifier tool

The verifier lives in `super-gsd/tools/phase-verifier/`. It's a single-file
Node script with **no dependencies**. You don't need to install it — the
orchestrator calls it directly by path:

```bash
node /path/to/super-gsd/tools/phase-verifier/phase-verifier.mjs --project-dir PATH --phase NN
```

But for convenience, add the tools directory to `NODE_PATH` or create an
alias. On Windows, create `%APPDATA%\npm\phase-verifier.cmd`:

```cmd
@echo off
node "C:\Users\YOU\GSDedits\super-gsd\tools\phase-verifier\phase-verifier.mjs" %*
```

Verify:

```powershell
phase-verifier --help
```

You should see usage output. Exit 2 on a missing `--phase` is expected.

---

## 6. Install dashboard scripts

The workspace has three live dashboard panes:

| Pane | Script | Purpose |
|---|---|---|
| **P3 Mission Control** | `sgsd1` / `sgsd-mission-control.ps1` | milestone · phase · waves · agents · cost |
| **P4 Narrative** | `sgsd2` / `sgsd-narrative.ps1` | live summary + live Ctrl+O tool stream |
| **P5 Gate Verdict** | `sgsd3` / `sgsd-gate-verdict.ps1` | ATC · browser verify · deferral ledger |

The PowerShell scripts live in `super-gsd/scripts/`. The `.cmd` wrappers live
on `%APPDATA%\npm\` (which is already on your PATH via npm).

### Create the wrappers

```cmd
:: sgsd1.cmd
@echo off
setlocal
set "PROJECT_DIR=%~1"
if "%PROJECT_DIR%"=="" set "PROJECT_DIR=%CD%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\YOU\GSDedits\super-gsd\scripts\sgsd-mission-control.ps1" -ProjectDir "%PROJECT_DIR%"
endlocal
```

Repeat for `sgsd2.cmd` (→ `sgsd-narrative.ps1`) and `sgsd3.cmd`
(→ `sgsd-gate-verdict.ps1`). Save them in `%APPDATA%\npm\`.

Verify each runs:

```powershell
sgsd1 C:\path\to\project-with-.planning
```

You should see Mission Control render. Press Ctrl+C to exit.

> **On Linux/macOS:** the scripts are PowerShell. Either install PowerShell
> for Linux (`sudo snap install powershell --classic`) or wait for the bash
> port (tracked in the workspace design spec).

---

## 7. Project setup — add the gate configs

For each project you want to run SGSD against, edit `.planning/config.json`
to add two blocks:

```json
{
  "...existing workflow / git / model_routing blocks...",

  "atc": {
    "enabled": true,
    "classify_model": "codex-local",
    "skip_threshold_lines": 10,
    "lite_threshold_lines": 50,
    "lite_threshold_files": 3,
    "full_threshold_files": 4,
    "complexity_floor_files": 3,
    "complexity_floor_lines": 100
  },
  "browser_verify": {
    "enabled": true,
    "base_url": "http://localhost:5173",
    "routes": ["/", "/dashboard"],
    "required_endpoints": [],
    "min_rows_per_route": 1,
    "load_timeout_ms": 15000,
    "approved_fallbacks": ["puppeteer"],
    "frontend_globs": [
      "src/**/*.tsx",
      "src/**/*.ts",
      "src/**/*.jsx",
      "src/**/*.css",
      "src/**/*.html"
    ],
    "fail_on_console_errors": true,
    "fail_on_network_errors": true,
    "block_on_failure_auto_mode": false,
    "deferral_ledger_auto_reopen_after_phases": 3
  }
}
```

Tune these per-project:
- `base_url` → your dev server (Vite 5173, Next 3000, Rails 3000, etc.)
- `routes` → the actual critical pages of your app. Start with 3–5, add as
  you catch more routes.
- `frontend_globs` → where your frontend files live. If you have a
  `frontend/` or `web/` subdir, add it.
- `required_endpoints` → backend endpoints that MUST be live for the gate
  to even attempt verification. Backend liveness precheck hits these before
  touching the browser.

---

## 8. Project setup — the `data-loaded` page contract

This is the anti-hallucination anchor. Without it, the verifier can't tell
the difference between a page that loaded and a page that's stuck on a
spinner.

Add ONE attribute to every page component's root element:

```tsx
// Loaded with data:
export function DashboardPage() {
  const { data, isLoading } = useDashboardData();
  if (isLoading) {
    return <div data-loaded="false"><Spinner /></div>;
  }
  if (!data || data.length === 0) {
    return (
      <div data-empty-reason="no-data-for-current-filter">
        <EmptyState />
      </div>
    );
  }
  return (
    <div data-loaded="true" data-row-count={data.length}>
      {data.map(row => (
        <Row key={row.id} data-row data-row-id={row.id} data={row} />
      ))}
    </div>
  );
}
```

Three rules:
1. **`data-loaded="true"`** means "I have data on screen, take the screenshot".
2. **`data-empty-reason="..."`** means "the backend returned zero rows for a
   legitimate reason" (the reason string is for debugging, any non-empty
   value counts as valid).
3. **`data-loaded="false"`** (or no attribute at all) means "still loading,
   don't take the screenshot yet, wait longer".

Also add `data-row` to every data row — it's what the verifier counts.

**Without these attributes**, the verifier will always report `LOAD_TIMEOUT`
on your pages. The tool is mechanical; it won't guess.

---

## 9. Warp launch configuration

The whole workspace opens in one click via a Warp launch configuration. One
YAML file per project.

### Create the config

Save to `%USERPROFILE%\.warp\launch_configurations\sgsd-PROJECT.yaml`:

```yaml
---
name: SGSD · PROJECT
windows:
  - tabs:
      - title: "SGSD · PROJECT"
        color: Blue
        layout:
          cwd: C:\Users\YOU\projects\PROJECT
          split_direction: Vertical
          panes:
            - cwd: C:\Users\YOU\projects\PROJECT
              commands:
                - exec: "claude --dangerously-skip-permissions"
            - split_direction: Horizontal
              panes:
                - cwd: C:\Users\YOU\projects\PROJECT
                  commands:
                    - exec: "sgsd1 C:\\Users\\YOU\\projects\\PROJECT"
                - split_direction: Horizontal
                  panes:
                    - cwd: C:\Users\YOU\projects\PROJECT
                      commands:
                        - exec: "sgsd3 C:\\Users\\YOU\\projects\\PROJECT"
                    - cwd: C:\Users\YOU\projects\PROJECT
                      commands:
                        - exec: "sgsd2 C:\\Users\\YOU\\projects\\PROJECT"
```

Replace `PROJECT` and `C:\Users\YOU\projects\PROJECT` with your real project
name + absolute path.

### Invoke it

In Warp: **Ctrl+Shift+P** → type "Launch Configuration" → pick "SGSD · PROJECT".

A new Warp window opens with 4 panes:
- **Left (wide)**: Main Claude Code session
- **Right-top**: P3 Mission Control
- **Right-middle**: P5 Gate Verdict (sgsd3)
- **Right-bottom**: P4 Narrative + Ctrl+O stream

### Bind a shortcut (optional)

Warp Settings → Keybindings → search "Launch Configuration". Bind your
project's config to a hotkey (e.g. `Ctrl+Alt+C` for clarity).

> **Why is the dashboard not a cross-project tool?** Because every project
> has different paths, config, and dev server port. One YAML per project is
> the cost of not having to type arguments every time.

---

## 10. First run — verify it all works

1. Open the Warp launch config for your project.
2. In the Main pane, wait for Claude to start, then type `/sgsd-orchestrate go`.
3. Watch the three right panes come alive:
   - Mission Control shows milestone + active phase + waves
   - Gate Verdict shows any existing `*-VERIFICATION.md` / `*-ATC-REVIEW.md`
   - Narrative's top half populates from `activity-log.jsonl`, bottom half
     tails the live session JSONL
4. Let it run one unit. You should see:
   - A new git commit appear
   - Mission Control's cost ticker advance
   - An Agent row appear in the roster (ACTIVE → IDLE)
   - A new line in `.planning/metrics/token-log.jsonl`

**If any of these don't happen**, see §13 Troubleshooting.

---

## 11. Daily workflow

### Start of day
```
sgsd-PROJECT (via Warp palette or hotkey)
→ 4-pane workspace opens
→ In main pane: /sgsd-orchestrate go
```

### When a phase wraps
- Mission Control turns the wave green with a timestamp.
- Gate Verdict shows ATC and browser verify cards lighting up.
- If browser verify fails, Gate Verdict card turns red — check
  `.planning/phases/{NN}-*/{NN}-BROWSER-REVIEW.md` for specifics.

### Pausing
- In main pane: `/sgsd-pause` (or Ctrl+C and type `pause`).
- A checkpoint is written to `.planning/ORCHESTRATOR-CHECKPOINT.md`.
- Close the Warp window safely.

### Resuming
- Reopen the launch config.
- In main pane: `/sgsd-resume` — picks up from the checkpoint.

---

## 12. Quick reference — file locations

| What | Where |
|---|---|
| GSD base skills | `$HOME\.claude\commands\gsd-*\` |
| SGSD skills | `$HOME\.claude\commands\sgsd-*\` |
| Sub-agents | `$HOME\.claude\agents\gsd-*.md`, `sgsd-*.md` |
| Hook scripts | `$HOME\.claude\hooks\gsd-*.js` |
| Dashboard scripts | `GSDedits\super-gsd\scripts\sgsd-*.ps1` |
| Phase verifier tool | `GSDedits\super-gsd\tools\phase-verifier\` |
| Launch configs | `%USERPROFILE%\.warp\launch_configurations\` |
| .cmd wrappers | `%APPDATA%\npm\sgsd*.cmd`, `gsd-browser.cmd`, `phase-verifier.cmd` |
| Per-project state | `<project>\.planning\STATE.md` |
| Per-project config | `<project>\.planning\config.json` |
| Activity log | `<project>\.planning\metrics\activity-log.jsonl` |
| Token log | `<project>\.planning\metrics\token-log.jsonl` |
| Deferral ledger | `<project>\.planning\DEFERRAL-LEDGER.md` |
| Phase gate reports | `<project>\.planning\phases\{NN}-*\{NN}-*.md` |

---

## 13. Troubleshooting

### "stale hooks — run /gsd-update" in status bar

Fresh cache needed. Run `/gsd-update` once; if it says you're already on the
latest, manually clear: `rm $HOME\.claude\cache\gsd-update-check.json`
and `rm $HOME\.cache\gsd\gsd-update-check.json`. Then open a new Warp tab.

### Dashboard pane is blank / doesn't refresh

The dashboard is FileSystemWatcher-reactive. It needs to see new events
happen to redraw. If your session is idle, the dashboard stays frozen.
That's correct behaviour — not a bug.

If it's frozen even during active work:
- Check the pane is actually running the script (`ps` / Task Manager → find
  `powershell.exe` with `sgsd-*.ps1`)
- Close the pane and rerun `sgsd1` / `sgsd2` / `sgsd3`

### Ctrl+O stream in P4 is empty

Means the script can't find the active session JSONL. Two common causes:
1. You're in a project dir that doesn't match any
   `~/.claude/projects/<encoded>/` subdirectory — the encoding uses
   `C--Users-YOU-projects-NAME` style. Check the projects dir manually.
2. No tool calls have happened yet in the session. Type anything to Claude
   and P4 should populate.

### gsd-browser: `Unsupported OS: MINGW64_NT (Windows users: use WSL)`

You're running the Linux `install.sh` under Git Bash instead of WSL. Re-run
inside WSL: `wsl -e bash -c '<curl command>'`.

This applies only to `gsd-browser`. SGSD's own `super-gsd/install.sh` should
use Git Bash on Windows so it targets the Windows Claude/Codex install.

### Gate 1 blocker: "gsd-browser unavailable"

`gsd-browser --help` fails. Install gsd-browser (§4 above). If it's installed
but the wrapper doesn't resolve, check PATH: `where.exe gsd-browser`.

If the tool is genuinely unavailable and you need to proceed anyway:
1. Commit `.planning/phases/{NN}-*/TOOL-FALLBACK.md`:
   ```markdown
   # TOOL-FALLBACK for Phase N
   substitute: puppeteer
   reason: Explain why
   declared_by: you
   declared_at: YYYY-MM-DD
   ```
2. Ensure `puppeteer` is in `config.browser_verify.approved_fallbacks`.
3. Rerun the verifier.

### Gate 4 blocker: "base_url unreachable"

Your dev server isn't running. Start it (`npm run dev` in a separate Warp
tab or dedicated pane). Verify manually: `curl http://localhost:PORT/` → 200.

### Every route reports LOAD_TIMEOUT

Your pages don't have `data-loaded` attributes. Add them (§8). The verifier
cannot guess when a page is done loading — that's the whole point of the
contract.

### P89 browser verify never completes — always "running"

The sub-agent is stuck or the load_timeout_ms is too short. Check
`.planning/phases/89-*/evidence/` for HAR files. If none, the browser never
navigated. Rerun with `phase-verifier --project-dir . --phase 89` directly
for clearer output.

### Mission Control shows wrong phase

Check `.planning/STATE.md` frontmatter. The dashboard reads `current_phase`
from there. If it's wrong, either the orchestrator wrote wrong state or
something modified STATE.md out of band. Fix STATE.md, the dashboard will
pick it up within 1 second via FileSystemWatcher.

### Cost box shows $0

No entries in `.planning/metrics/token-log.jsonl` yet. The orchestrator
writes one line per unit. Let it run one full loop and the number should
appear.

---

## 14. Uninstall

```powershell
# Remove .cmd wrappers
del %APPDATA%\npm\sgsd1.cmd %APPDATA%\npm\sgsd2.cmd %APPDATA%\npm\sgsd3.cmd
del %APPDATA%\npm\gsd-browser.cmd %APPDATA%\npm\phase-verifier.cmd

# Remove Warp launch configs
del "%USERPROFILE%\.warp\launch_configurations\sgsd-*.yaml"

# Remove SGSD skills, agents, hooks (base GSD stays)
del $HOME\.claude\agents\sgsd-*.md
del $HOME\.claude\commands\sgsd-*
del $HOME\.claude\hooks\gsd-context-monitor.js  # if you only want Super GSD gone

# Remove per-project state (CAREFUL — this wipes your .planning)
# rd /s /q <project>\.planning   # DO NOT run unless you mean it

# Remove gsd-browser (WSL)
wsl -e rm -rf /home/YOU/.gsd-browser
```

The main `get-shit-done` base stays installed. To remove it too, follow the
uninstall section of `super-gsd/USER-GUIDE.md`.

---

## 15. Where to get help

- **Discord** — `/gsd-join-discord` (runs from any Claude session)
- **Spec docs** — `GSDedits/docs/superpowers/specs/` (the design spec for
  this workspace)
- **Design mockups** — `GSDedits/.superpowers/mockups/sgsd-workspace-v*.html`
  (open in browser for the target visual)
- **Upstream issues** — GitHub Issues on the GSDedits repo

---

## 16. What this guide does NOT cover (read the other docs)

- **The orchestrator loop** — `super-gsd/USER-GUIDE.md` §7
- **SGSD memory** — `.planning/memory/MEMORY.md` plus `sgsd-recall`
- **CEO/Board deliberation** — `super-gsd/USER-GUIDE.md` §9
- **ATC 7-step framework** — `super-gsd/USER-GUIDE.md` §10, or
  `C:\Users\YOU\.claude\atc\*.md`
- **Overwatcher signal map** — `super-gsd/USER-GUIDE.md` §11
- **Phase planning, discuss, research workflows** — run `/gsd-help` from
  any Claude session
- **Migration from GSD 2.0 (Pi harness)** — `sgsd-transition` skill

If this guide is missing something you expected to find, open an issue — it
probably belongs here.
