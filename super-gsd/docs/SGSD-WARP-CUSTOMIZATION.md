# SGSD Warp Customization Guide

Every customization surface Warp exposes to SGSD on this machine, what it
buys you, and the install command. Use as a menu — pick the items that
match your workflow.

> **Phase 63 audit constraint (B6):** `~/.warp/` only exposes
> `launch_configurations/` for operator-editable YAML. Themes, keybindings,
> prompts, notebooks, and Codebase Context settings live in Warp's SQLite
> database and the Settings UI — they cannot be installed from the CLI.
> The lines below distinguish file-driven (shippable from this repo) from
> UI-only (operator action required).

---

## 1. File-driven customization (already shipped or one command away)

### 1a. Workflows — `.warp/workflows/*.yaml` (20 ready)

| Workflow | When to use |
|---|---|
| `SGSD: Start` | Boot SGSD: cockpit window + Claude in current tab |
| `SGSD: Auto Mode` | Boot + send "go" to Claude for autonomous loop |
| `SGSD: Cockpit Only` | Just the dashboards; no Claude session |
| `SGSD: Status` | One-shot STATE.md frontmatter (where am I?) |
| `SGSD: Codex Status` | Latest Codex CLI dispatch + freshness |
| `SGSD: Gate Status` | Latest gate verdicts (ATC / verifier / review) |
| `SGSD: Watchdog Status` | Autopilot pulse + stall detection |
| `SGSD: Token Summary` | Refresh + print token attribution |
| `SGSD: Recovery Packet` | Resume command for a paused session |
| `SGSD: Remote Monitor Packet` | Concise share-safe status for off-machine |
| `SGSD: Current Phase Artifacts` | List active phase's CONTEXT/PLAN/etc. |
| `SGSD: Open Review Artifacts` | ATC-REVIEW + VERIFICATION + WASTE + diff |
| `SGSD: Warp Doctor` | 18-probe Warp setup diagnostic |
| `SGSD: MCP Self-Test` | 47/47 assertion run on the MCP server |
| `SGSD: Full Preflight` | Full preflight before opening cockpit |
| `SGSD: Harness Evolution Status` | v2.9 AHE run state (component, prediction, attribution) |
| `SGSD: Live Pulse Tail` | Last 20 ORCHESTRATOR-LIVE.jsonl events |
| `SGSD: Route Decisions Recent` | Last 10 double-agent execution_route decisions |
| `SGSD: Resume` | Print checkpoint + next-action command |
| `SGSD: PR Branch (filter .planning)` | Show commits suitable for a clean PR |

Use: `Ctrl+Shift+P` → type `SGSD:` → run any.

### 1b. Launch configurations — `~/.warp/launch_configurations/*.yaml` (6 ready)

Open multi-pane workspaces from `Ctrl+Shift+P` → `Launch Configuration:`.

| Config | Layout | Use case |
|---|---|---|
| `SGSD Operator Workspace` | 4-pane: Main + Cockpit + Token watch + Shell | Daily driver |
| `SGSD Cockpit Only` | 3-pane: cockpit + narrative + Codex/gate | Watch a run; don't touch |
| `SGSD Debug Session` | 4-pane: warp-doctor + STATE + live tail + shell | Diagnose a stuck/failing run |
| `SGSD Codex Watch` | 3-pane: codex-status + route-decisions + shell | Watch double-agent executor |
| `SGSD Token Audit` | 3-pane: attribution + waste-status + shell | Investigate token spend |
| `SGSD Review` | 3-pane: git log + ATC artifacts + shell | Pre-merge code review |

⚠️ Phase 63 finding: launch configs open in a **new Warp window** on Windows,
not the active window. Treat them as workspace launchers, not panel injectors.

### 1c. MCP server config — `~/.warp/mcp_servers.json` (written; UI may need confirm)

15 read-only SGSD tools become Warp Agent tools. Confirm via
**Settings → MCP** in Warp; if `sgsd` isn't listed, add manually
(name `sgsd`, command `node`, args path to `warp-mcp/server.cjs`,
transport `stdio`). Restart Warp. Then the Agent answers
"What's the current SGSD phase?" via `sgsd_current_phase` instead of scraping.

### 1d. Codebase Context exclusions — `.warpindexingignore` (active)

Warp Agent indexes the repo for context-aware answers. The
`.warpindexingignore` file at repo root excludes generated artifacts
(metrics ledgers, AHE run output, build artifacts, archived planning,
HTML reports) so the index focuses on docs and source. Verify in Warp
Agent panel — Codebase Context status should be "indexed", and asking
about `.planning/metrics` should return "not indexed".

### 1e. Agent rules — `AGENTS.md` / `WARP.md` / `CLAUDE.md` (in place)

| File | Audience | Priority |
|---|---|---|
| `AGENTS.md` | All agents (Warp, Claude, Codex, ACP) | First |
| `WARP.md` | Warp-specific operator instructions | Wins inside Warp |
| `CLAUDE.md` | Claude Code orchestrator contract | Claude Code only |

Verify: ask Warp Agent *"What rules apply in this repo?"* — should reference
all three with the priority hierarchy.

### 1f. Custom secret regex — `settings.toml` (already comprehensive)

`agents.profiles.agent_mode_coding_permissions = "always_allow_reading"` is
already set. The `privacy.custom_secret_regex_list` already covers IPv4/IPv6,
JWT, Slack, GitHub PATs, Google API keys, OpenAI keys, **Anthropic keys**,
Stripe, AWS, etc. If you want SGSD-specific patterns added (e.g., redact
private VTP paths from terminal output), I can extend the list — but
modifying `settings.toml` while Warp is running is risky; do it from
Warp UI instead.

---

## 2. PowerShell profile snippets (copy-paste into `$PROFILE`)

These add at-a-glance status to your terminal that Warp will surface.

### 2a. Tab title with current SGSD milestone/phase

```powershell
# Add to your $PROFILE. Sets terminal title to "SGSD vX.Y / P{N}" so the
# Warp tab name is always your current SGSD position.
function Update-SgsdTitle {
    $statePath = "C:\Users\jack.berrow\GSDedits\.planning\STATE.md"
    if (-not (Test-Path $statePath)) { return }
    $front = Get-Content $statePath -TotalCount 30 -Encoding UTF8 | Out-String
    $milestone = if ($front -match 'milestone:\s*(\S+)') { $Matches[1] } else { '?' }
    $phase = if ($front -match 'roadmap_run:[\s\S]*?current_phase:\s*(\S+)') {
        $Matches[1]
    } else { '?' }
    $Host.UI.RawUI.WindowTitle = "SGSD $milestone / P$phase"
}
# Run once on profile load and update before every prompt:
Update-SgsdTitle
function global:prompt {
    Update-SgsdTitle
    "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
}
```

### 2b. Auto-detect SGSD repo and offer `sg`

```powershell
# Add to your $PROFILE. When you `cd` into the SGSD repo, prints a one-line
# hint with current state.
$global:__SgsdLastDir = $null
function Test-SgsdRepoCue {
    $cwd = (Get-Location).Path
    if ($cwd -ne $global:__SgsdLastDir -and (Test-Path "$cwd\.planning\STATE.md")) {
        $global:__SgsdLastDir = $cwd
        $front = Get-Content "$cwd\.planning\STATE.md" -TotalCount 8 -Encoding UTF8 | Out-String
        if ($front -match 'milestone:\s*(\S+)') {
            Write-Host "[SGSD] $($Matches[1]) — type 'sg' to boot cockpit + Claude" -ForegroundColor Cyan
        }
    }
}
# Run after cd by overriding Set-Location:
$ExecutionContext.InvokeCommand.LocationChangedAction = { Test-SgsdRepoCue }
```

### 2c. Quick-launch aliases

```powershell
# Add to your $PROFILE.
function sgsd-status { Get-Content C:\Users\jack.berrow\GSDedits\.planning\STATE.md -TotalCount 30 -Encoding UTF8 }
function sgsd-doctor { node C:\Users\jack.berrow\GSDedits\super-gsd\tools\warp-doctor\check.cjs --project C:\Users\jack.berrow\GSDedits }
function sgsd-pulse  { Get-Content C:\Users\jack.berrow\GSDedits\.planning\ORCHESTRATOR-LIVE.jsonl -Tail 20 -Encoding UTF8 }
function sgsd-route  { Get-Content C:\Users\jack.berrow\GSDedits\.planning\metrics\route-decisions.jsonl -Tail 10 -Encoding UTF8 }
```

---

## 3. UI-only customization (operator action required)

These cannot be shipped from the CLI on the new opensource Warp build.

### 3a. Themes

Open Warp **Settings → Appearance → Themes**. Pick or create. The cockpit's
v2.6 colour scheme uses standard ANSI: blue=Codex, yellow=Claude,
green=local-script, cyan=MCP — any theme that respects ANSI 16-colour
mapping will render the cockpit correctly. If you want a fully branded
"SGSD" theme, create one via the UI; SGSD doesn't ship one because Warp
stores themes in SQLite.

### 3b. Keybindings

Open **Settings → Keybindings**. Useful additions:
- Bind `Ctrl+Alt+S` to run workflow `SGSD: Status` (1-key state check)
- Bind `Ctrl+Alt+D` to `SGSD: Warp Doctor`
- Bind `Ctrl+Alt+R` to `SGSD: Resume`
- Bind `Ctrl+Alt+P` to `SGSD: Live Pulse Tail`

### 3c. Pinned workflows

Right-click a workflow in Command Palette → **Pin**. Recommended pins:
- `SGSD: Status` (every session)
- `SGSD: Recovery Packet` (when you're back from a pause)
- `SGSD: Warp Doctor` (when something feels off)
- `SGSD: Live Pulse Tail` (auto runs)

### 3d. Saved Prompts

`Ctrl+Shift+P` → `Add Prompt`. Paste each prompt block from
`super-gsd/docs/SGSD-WARP-PROMPTS.md`. Name them `SGSD: P1` etc. Searchable
by the same `SGSD:` prefix as workflows.

### 3e. Notebooks

`Ctrl+Shift+P` → `Notebook: New`. Copy each block from
`super-gsd/docs/SGSD-WARP-NOTEBOOK.md` into cells. Save as
"SGSD Operator Notebook".

### 3f. Codebase Context

**Settings → AI → Codebase Context**. Confirm:
- Auto-indexing: ON (matches `settings.toml:agent_mode_codebase_context_auto_indexing = true`)
- Repo path: `C:\Users\jack.berrow\GSDedits` is in the indexed list
- Excluded patterns: `.warpindexingignore` is being honoured (verify by
  asking Agent about `.planning/metrics` — it should say not indexed)

### 3g. Agent profile / coding permissions

`settings.toml:agent_mode_coding_permissions = "always_allow_reading"` is
already set. Tightening to `"manual_approval"` for writes is sensible for
SGSD work; don't loosen to `"always_allow_all"`.

### 3h. Notifications

All four already enabled in `settings.toml` (task completed, long-running,
needs attention, password prompt). The 30-second long-running threshold
fits SGSD agent dispatches.

---

## 4. Full inventory check — run this anytime

```powershell
node C:\Users\jack.berrow\GSDedits\super-gsd\tools\warp-doctor\check.cjs --project C:\Users\jack.berrow\GSDedits
```

Healthy state today:
- 16 PASS / 1 MISSING (`state_md_freshness` — internal SGSD sync) / 1 MANUAL (Codebase Context UI)
- 20 workflows
- 6 launch configurations
- MCP file present at `~/.warp/mcp_servers.json`

If the count drops, `warp-doctor` tells you which probe regressed.

---

## 5. What to add when

| Situation | Customization |
|---|---|
| New v2.x phase ships a feature you want quick access to | Add a workflow under `.warp/workflows/` |
| You repeat the same multi-pane setup | Add a launch config |
| You keep typing the same status query | Add a PowerShell alias from §2c |
| You want one-key common actions | Configure keybindings (§3b) |
| You want Warp Agent to answer SGSD questions natively | Wire MCP via §1c then verify in §3f |
| You want to share an SGSD operator setup | Commit the workflow + launch config templates |

The repo is the source of truth for everything in §1. The operator is the
source of truth for everything in §3.
