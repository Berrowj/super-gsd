---
phase: 63
artifact: research
created: 2026-04-29
operator: user
machine: Windows 11 Pro 10.0.26100
shell: Windows PowerShell 5.1
warp_install_path: C:\Users\user\AppData\Local\Programs\Warp\Warp.exe
warp_env_observed: TERM_PROGRAM=WarpTerminal
session_topology: sg-launched-Claude (this Phase 63 session is the live evidence)
---

# Phase 63 — Research: Warp Capabilities On This Machine

This document is the deep evidence pack. The condensed operator-facing matrix
lives in `.planning/milestones/v2.2/WARP-SMOKE.md`.

## Section A — Command Resolution

### A.1 sg / sgsd / sgsd-setup

| Command | Resolves in non-interactive `powershell.exe -Command`? | Resolves in interactive Warp PowerShell? | Source |
|---|---|---|---|
| `sg` | NO (function defined in profile; profile not loaded by `-Command`) | YES (verified by this very session being the result of `sg`) | profile lines 86-122 |
| `sgsd` | NO (same reason) | YES (per profile + cockpit alleged-open per session-start handover) | profile lines 15-66 |
| `sgsd-setup` | NO | YES | profile lines 124-167 |

**Profile path**:
`C:\Users\user\OneDrive - John Cullen Lighting\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`

**Implication**: `Get-Command sg` returning NOTFOUND under `-Command` is **not
a defect**; it is the expected behavior of non-interactive PowerShell. Warp
launches an interactive PowerShell that loads `$PROFILE`, so `sg` resolves
inside Warp as expected.

**Test commands**:
```powershell
Get-Command sg,sgsd,sgsd-setup -ErrorAction SilentlyContinue   # NOTFOUND under -Command
. $PROFILE; Get-Command sg                                     # OK after dot-sourcing
```

### A.2 sg Function Body (verbatim, lines 86-122)

```powershell
function sg {
    [CmdletBinding()]
    param(
        [switch]$FullPreflight,
        [switch]$Go,
        [switch]$NoCockpit,
        [switch]$NoClaude,
        [string]$ProjectDir = $null
    )

    if (-not $NoCockpit) {
        $bootArgs = @{}
        if ($ProjectDir) { $bootArgs.ProjectDir = $ProjectDir }
        if (-not $FullPreflight) { $bootArgs.SkipPreflight = $true }
        sgsd @bootArgs
    }

    if ($NoClaude) { return }

    $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claudeCmd) {
        Write-Host 'Claude Code CLI not on PATH - cockpit is open, but Claude was not started.' -ForegroundColor Yellow
        Write-Host 'Install/check Claude Code, then run: claude' -ForegroundColor DarkGray
        return
    }

    if ($ProjectDir) {
        Set-Location -LiteralPath $ProjectDir
    }

    if ($Go) {
        & claude --dangerously-skip-permissions 'go'
    } else {
        $greetMsg = 'You are booting in Super GSD mode. Do these four things ...'
        & claude --dangerously-skip-permissions $greetMsg
    }
}
```

**Critical observation**: `& claude --dangerously-skip-permissions ...` is a
**synchronous, in-place invocation** (the `&` call operator runs in the
current shell, not a new window). This is the behavioral contract operator
Rule 3 protects. Claude stays where the user typed `sg`. The cockpit's
separate window is opened by `sgsd @bootArgs` on line 100, which delegates
to `sgsd-boot.ps1`.

### A.3 claude / codex / node / wsl / tmux

| Command | Type | Path | Notes |
|---|---|---|---|
| `claude` | ExternalScript | `~/AppData/Roaming/npm/claude.ps1` | npm-installed Claude Code CLI |
| `codex` | ExternalScript | `~/AppData/Roaming/npm/codex.ps1` | npm-installed Codex CLI |
| `node` | Application | `C:\Program Files\nodejs\node.exe` | Node.js for SGSD tools |
| `wsl` | Application | `C:\WINDOWS\system32\wsl.exe` | WSL2 available |
| `tmux` | NOTFOUND | — | Not installed natively on Windows; would require WSL |

## Section B — Warp Environment Detection

### B.1 Env Vars Observed In Active Session

```
TERM_PROGRAM=WarpTerminal
WARP_HONOR_PS1=0
WARP_USE_SSH_WRAPPER=1
```

`TERM_PROGRAM=WarpTerminal` is the documented canonical Warp marker. SGSD
boot scripts can rely on this env var to detect Warp.

### B.2 Claude Code Detection Env Vars (also observed in this session)

```
CLAUDECODE
CLAUDE_CODE_ENTRYPOINT
CLAUDE_CODE_GIT_BASH_PATH
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
```

These prove that **Claude Code CLI is the active agent in this Warp tab**.
Warp's third-party CLI agent detection is documented to surface a utility
bar when these env vars (or equivalents) are present, but the utility-bar
appearance itself is a UI fact and is recorded as MANUAL-CHECK-REQUIRED.

### B.3 Warp Install Path

```
C:\Users\user\AppData\Local\Programs\Warp\Warp.exe   EXISTS
C:\Program Files\Warp\Warp.exe                               MISSING
C:\Program Files\WarpDotDev\WarpDotDev.exe                   MISSING
```

Warp on this machine is a per-user install under `LOCALAPPDATA\Programs\Warp`.

## Section C — Launch Configurations

### C.1 Directory

`C:\Users\user\.warp\launch_configurations` — **EXISTS, EMPTY**.

The 2026-04-11 layout spec referenced
`C:/Users/user/.warp/launch_configurations/gsdedits-workspace.yaml`
as the trial config. That file is no longer present. No saved launch
configurations exist on this machine today.

### C.2 Active-Window vs New-Window Question

Per official Warp docs, launch configurations open **new windows** by
default; whether they can target the active window via the palette is
itself a UI fact. The 2026-04-11 spec recorded that on Windows Warp the
"open into current window" behavior was unreliable. As of 2026-04-29, the
operator-brief notes that "Warp CLI" (which would be the programmatic
launch path) is on the May-June 2026 roadmap (Warp issue #9233) but **not
yet shipped**. This row is therefore MANUAL-CHECK-REQUIRED until either
(a) the operator confirms via Warp palette behavior, or (b) Warp ships
CLI control.

### C.3 ~/.warp Subdirectories

```
~/.warp/launch_configurations/  (only subdir present)
```

No `themes/`, `keybindings/`, or other Warp config subdirs were observed
under `~/.warp`. Warp likely keeps app-managed config under
`%APPDATA%\warp\Warp` or similar; only `launch_configurations/` is
operator-editable through the documented YAML path.

## Section D — Workflow Pack Audit

### D.1 Files Present

```
.warp/workflows/sgsd-auto.yaml
.warp/workflows/sgsd-cockpit.yaml
.warp/workflows/sgsd-preflight.yaml
.warp/workflows/sgsd-start.yaml
.warp/workflows/sgsd-token-current.yaml
```

### D.2 Lint Results

| File | name | command | tags | no_tabs | arguments | Verdict |
|---|---|---|---|---|---|---|
| sgsd-auto.yaml | ✓ | ✓ | ✓ | ✓ | ✓ | OK |
| sgsd-cockpit.yaml | ✓ | ✓ | ✓ | ✓ | ✓ | OK |
| sgsd-preflight.yaml | ✓ | ✓ | ✓ | ✓ | ✓ | OK |
| sgsd-start.yaml | ✓ | ✓ | ✓ | ✓ | ✓ | OK |
| sgsd-token-current.yaml | ✓ | ✓ | ✓ | ✓ | **MISSING** | FAIL |

**`sgsd-token-current.yaml` defect** (deferred to Phase 64):

```yaml
name: "SGSD: Token Summary"
description: Refresh token attribution and print the current milestone/phase token summary.
command: node super-gsd/tools/token-attribution/collect.cjs --write --all --agent-spend --summary --current
tags:
  - sgsd
  - tokens
  - metrics
```

Missing `arguments:` block → no `project_dir` parameter. Means: this
workflow runs `node ...` against whichever cwd Warp is in when invoked. If
the operator launches it from outside the GSDedits repo, the relative path
`super-gsd/tools/token-attribution/collect.cjs` resolves wrong. **Phase 64
fix**: add the `arguments:` block matching the other four workflows.

### D.3 Searchability — UI-Bound

Whether these workflows actually appear in Warp Command Search /
Workflow Search requires UI inspection. Recorded as MANUAL-CHECK-REQUIRED
in `MANUAL-CHECKS.md`. From terminal, all five YAMLs sit at the documented
repository path (`.warp/workflows/`) so per Warp's documented behavior they
**should** be discovered.

## Section E — Codebase Context

### E.1 .warpindexingignore

`MISSING` from repo root.

**Implication**: Warp will index the entire repository by default,
including:

- `.planning/metrics/*.jsonl` (large append-only ledgers)
- `.planning/archive/superseded/*` (superseded milestones)
- `docs/reports/*.html` (large generated visualizations)
- `super-gsd/tools/failure-injection/fixtures/` (fixture trees)

**Recommendation** (Phase 65 or new ignore-pack phase): add
`.warpindexingignore` so Codebase Context indexes high-value docs (`WARP.md`,
`README.md`, `super-gsd/docs/*.md`, `super-gsd/skills/**/SKILL.md`) and skips
metrics ledgers and archives.

### E.2 WSL/SSH Codebase Context Behavior

Per official Warp docs (`https://docs.warp.dev/agent-platform/capabilities/codebase-context`),
Codebase Context is **disabled** in WSL/SSH sessions. SGSD on this machine
runs natively in Windows PowerShell inside Warp, so Codebase Context is
expected to apply. Whether it has actually indexed THIS repository requires
UI verification — recorded as MANUAL-CHECK-REQUIRED.

## Section F — Third-Party CLI Agent Detection

### F.1 Direct claude / codex Launch

`claude` is `ExternalScript` at `~/AppData/Roaming/npm/claude.ps1` —
a PowerShell wrapper that ultimately runs the npm-installed Claude Code
binary. Same for `codex`. Both should produce env vars Warp's third-party
agent detector recognizes (`CLAUDECODE`, etc.).

### F.2 sg-Launched Claude

**Empirically TRUE on this machine**: this Phase 63 session is itself
proof. The `sg` function (profile line 86-122) runs `& claude
--dangerously-skip-permissions $greetMsg` synchronously in the same
PowerShell. The current process has all the Claude Code env vars set
AND has `TERM_PROGRAM=WarpTerminal`. So the third-party-agent detection
**should** fire. UI confirmation (does the utility bar actually appear?)
is recorded as MANUAL-CHECK-REQUIRED.

### F.3 sg-Launched Codex

Not directly tested in this session. SGSD's primary Codex invocation is
through `super-gsd/scripts/codex-exec.sh` (a bash subprocess), not
interactive Warp. If/when an operator runs `codex` directly in Warp, the
same detection should apply. Recorded as NOT-IN-SCOPE for this phase.

## Section G — sg / Cockpit Topology

### G.1 Empirical Topology In This Session

```
Warp PowerShell tab (TERM_PROGRAM=WarpTerminal)
└─ user typed: sg
   └─ profile sg() ran:
      ├─ sgsd @bootArgs           → opens cockpit windows separately
      └─ & claude --dangerously-skip-permissions $greetMsg
                                  → THIS Claude session, same tab
```

**Claim**: "`sg` keeps Claude in the current terminal and opens the
cockpit separately." **Verdict**: PASS (direct empirical evidence —
this session exists in the originating PowerShell tab).

### G.2 Cockpit Window Separation

The session-start system reminder asked the operator to confirm "the SGSD
cockpit dashboards are open in the other window." The cockpit invocation
mechanism is `sgsd-boot.ps1` (see `WARP.md` line 33). Whether the cockpit
panes are CURRENTLY visible is the operator's manual check. Recorded as
MANUAL-CHECK-REQUIRED in MANUAL-CHECKS.md, but the wiring itself
(`sgsd @bootArgs` from `sg`) is verified PASS.

## Section H — git State

```
Branch: master
HEAD: ca96a3e 2026-04-29 docs(token): freeze pre-double-agent benchmark
Modified: 4 metrics ledgers (activity-log.jsonl, narrative.md,
          token-attribution.jsonl, token-waste-status.jsonl) — ambient
          telemetry churn from cockpit boot, not in-progress work.
```

These uncommitted changes are normal SGSD telemetry side-effects from the
cockpit running. Phase 63 will not commit them — they are unrelated to the
Warp smoke test. Whoever commits these next should commit them as
`chore(metrics): cockpit telemetry churn`.

## Section I — Open Questions Forwarded To Phase 64+

1. **Phase 64**: fix `sgsd-token-current.yaml` missing `arguments:` block.
2. **Phase 64**: add the missing workflows enumerated in roadmap (`SGSD:
   Status`, `SGSD: Recovery Packet`, `SGSD: Gate Status`, `SGSD: Watchdog
   Status`, `SGSD: Codex Status`, `SGSD: Current Phase Artifacts`, `SGSD:
   Warp Doctor`, `SGSD: Remote Monitor Packet`).
3. **Phase 65 or new dedicated ignore-pack phase**: author
   `.warpindexingignore` to keep Codebase Context focused on high-value
   docs.
4. **Phase 67**: warp-doctor must replicate the probes performed in this
   phase (env scan, command resolution, launch config dir, workflow lint,
   `.warpindexingignore` presence).
5. **Phase 78**: launch configuration templates must NOT assume
   active-window opening until either Warp CLI ships or the operator
   confirms current Warp behavior.
6. **Phase 96 (much later)**: Warp open-source repo at
   `https://github.com/warpdotdev/warp` is the canonical upstream
   contribution surface — track issues #7326 (ACP) and #9233 (May-June
   2026 roadmap including Warp CLI / tmux control mode / wrapper command
   detection).

## Section J — Audit Snapshot Provenance

| Artifact | Value | Captured |
|---|---|---|
| Date | 2026-04-29 | this session |
| Project root | `C:\Users\user\GSDedits` | this session |
| OS | Windows 11 Pro 10.0.26100 | system info |
| PowerShell | 5.1 (Windows PowerShell) | session |
| Warp install | `~/AppData/Local/Programs/Warp/Warp.exe` | filesystem probe |
| Warp version | not exposed via env or filesystem | requires UI check |
| Warp process | not enumerated in audit (parent walk needed pwsh 7+) | optional follow-up |
| HEAD commit | `ca96a3e` | `git log -1` |

The audit is a snapshot. Re-run probes if Warp is updated or the SGSD
profile changes.
