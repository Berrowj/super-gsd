# SGSD Boot & Startup Guide

This guide explains the current recommended way to start Super GSD, the cockpit,
Claude Code, project memory, and optional private knowledge banks.

If you are setting this up for someone who has never used SGSD before, start
with [`SGSD-FRIEND-SETUP-WIZARD.md`](SGSD-FRIEND-SETUP-WIZARD.md). This file is
the deeper boot reference.

Use this when you want the practical answer to:

- What command do I type first?
- Does Claude start before SGSD?
- What is the fast boot path?
- How do I configure VTP or another knowledge bank?
- What do I do when the cockpit looks wrong?

---

## Recommended Daily Command

From your project directory, type:

```powershell
sg
```

This is the normal day-to-day boot command.

It does three things:

1. Boots the SGSD cockpit in a separate PowerShell / Windows Terminal window.
2. Starts Claude Code in the same terminal where you typed `sg`.
3. Sends Claude the SGSD greeting prompt so it understands the current project,
   current milestone, active agents, and cockpit state before asking what you
   want to build.

You do not need to start Claude first.

The intended sequence is:

```text
Your terminal / Warp / VS Code terminal
        |
        v
      sg
        |
        +--> SGSD cockpit opens separately
        |
        +--> Claude starts in the current terminal
```

This matters because you may be working from Warp, VS Code, Cursor, Windows
Terminal, or another CLI. `sg` keeps the main Claude session where you already
are instead of opening a surprise extra Claude window.

---

## First-Time Setup

If the shortcut commands are not available yet, run the installer from the repo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force
```

Then either open a new PowerShell terminal, or reload your current profile:

```powershell
. $PROFILE
```

Check the commands exist:

```powershell
Get-Command sg
Get-Command sgsd
Get-Command sgsd-setup
```

---

## Command Cheat Sheet

| Command | Use When | What It Does |
|---|---|---|
| `sg` | Normal daily startup | Fast cockpit boot + Claude greeting in the current terminal |
| `sg -Go` | You want autonomous mode immediately | Fast cockpit boot + Claude receives `go` |
| `sg -FullPreflight` | You want a deeper startup check | Runs full SGSD preflight before starting Claude |
| `sg -NoClaude` | You only want the cockpit | Boots cockpit, does not start Claude |
| `sg -NoCockpit` | You only want Claude greeting | Starts Claude in current terminal, does not open cockpit |
| `sgsd` | Cockpit only | Opens dashboards without starting Claude |
| `sgsd -NoOpen` | Check only | Runs preflight, does not open dashboards |
| `sgsd -Claude -Greet` | Legacy/new-window Claude mode | Opens cockpit and launches Claude in a separate window |
| `sgsd -Claude -Go` | Legacy/new-window auto mode | Opens cockpit and launches Claude in a separate window with `go` |
| `sgsd-setup` | One-time knowledge setup | Configures private knowledge bank, SGSD memory root, fallback corpus |
| `sgsd-refresh` | Refresh cockpit | Reboots cockpit panes |
| `SGSD-Cockpit` | Alias for cockpit boot | Same family as `sgsd` |

PowerShell is case-insensitive, so `SGSD`, `sgsd`, and `SgSd` are the same
command. That is why the short daily boot word is `sg`.

---

## Fast Boot vs Full Preflight

### Fast Boot

```powershell
sg
```

Fast boot skips expensive checks that do not need to run every time. It still
starts the cockpit and Claude correctly.

Use this for normal work.

### Full Preflight

```powershell
sg -FullPreflight
```

Full preflight checks the substrate more deeply:

- `.planning/` exists
- `.planning/memory/MEMORY.md` exists
- memory write-pipe smoke test works
- agents registry is fresh
- gate registry is armed
- Codex CLI self-test passes
- SGSD memory root exists
- private knowledge bank is present if configured

Use this when:

- You just pulled changes.
- You changed SGSD scripts.
- The cockpit looks wrong.
- You are about to run a long autonomous session.
- You want confidence over speed.

The boot process now avoids rebuilding `agents.jsonl` when the agent files have
not changed, so full preflight should be much faster than before.

---

## Cockpit Layout

The cockpit opens in a separate Windows Terminal / PowerShell window.

Current layout:

| Pane | Script | Purpose |
|---|---|---|
| SGSD1 | `sgsd-mission-control.ps1` | Mission Control: phase state, gates, memory, VTP/private KB, overall health |
| SGSD2 | `sgsd-narrative.ps1` | Narrative stream: what SGSD is doing and why |
| SGSD3 | `sgsd-codex-monitor.ps1` | Codex + VTP/MCP detail: reviews, timeouts, findings, enrichment state |

Each pane now runs through:

```text
super-gsd/scripts/sgsd-dashboard-host.ps1
```

That host exists so dashboard crashes are obvious. If a pane fails, it should
show a red `SUPER GSD DASHBOARD FAILURE` screen with the script path and error
instead of silently dropping back to a plain PowerShell prompt.

---

## Knowledge Setup

Run:

```powershell
sgsd-setup
```

It asks for:

1. Private knowledge bank directory
2. SGSD memory directory
3. Fallback corpus

### Private Knowledge Bank

This is optional.

Examples:

- VTP repo
- Obsidian vault
- company docs export
- local research folder
- markdown/PDF notes directory
- synced knowledge repo

If you have one, point SGSD at it.

If you do not have one, leave it blank.

### SGSD Memory Directory

Default:

```text
.planning/memory
```

This is SGSD's own project memory: decisions, lessons, patterns,
anti-patterns, feedback, preferences, and workflow notes.

For most projects, keep the default.

### Fallback Corpus

If no private knowledge bank exists, SGSD can fall back to local SGSD research
and project memory.

Recommended default:

```text
sgsd-bundled-research
```

This uses local SGSD docs, briefs, decisions, milestones, and seeded memory.

There is also an optional public-source mode:

```text
public-software-engineering
```

Treat public sources as discovery targets, not as blindly ingested content.

Useful public sources include:

- arXiv computer science research: https://arxiv.org/
- Google SRE books: https://sre.google/books/
- NASA Systems Engineering Handbook: https://www.nasa.gov/reference/systems-engineering-handbook/
- Microsoft API Guidelines: https://github.com/microsoft/api-guidelines
- Architecture of Open Source Applications: https://aosabook.org/en/

---

## Knowledge Tiers

SGSD should think about knowledge in three tiers:

```text
Tier 1: Private/user knowledge bank
        Example: VTP, Obsidian, company docs, personal research

Tier 2: SGSD project memory
        Example: .planning/memory

Tier 3: Public fallback corpus
        Example: arXiv, Google SRE, NASA handbook, Microsoft guidelines
```

The safest default is:

```text
private KB if configured
else SGSD local memory
else bundled SGSD research
```

Do not assume every user has VTP. VTP is one possible private knowledge bank,
not a required SGSD dependency.

---

## Recommended First Run On A New Project

From the project root:

```powershell
sgsd-setup
```

Choose:

```text
Private knowledge bank directory:  leave blank, or provide your KB path
SGSD memory directory:             .planning/memory
Fallback corpus:                   sgsd-bundled-research
```

Then run:

```powershell
sg -FullPreflight
```

After that, normal daily startup is just:

```powershell
sg
```

---

## Troubleshooting

### `sg` Is Not Recognized

Reload your PowerShell profile:

```powershell
. $PROFILE
```

Or reinstall shortcuts:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force
```

Open a new terminal and try:

```powershell
sg
```

### Cockpit Opens But One Pane Shows A Plain Prompt

This should no longer happen in the guarded boot path.

Run:

```powershell
sgsd-refresh
```

If it still happens, run full preflight:

```powershell
sg -FullPreflight
```

If a dashboard script is crashing, the pane should now show:

```text
SUPER GSD DASHBOARD FAILURE
```

with the failed script and error.

### Boot Feels Slow

Use:

```powershell
sg
```

instead of:

```powershell
sg -FullPreflight
```

Fast boot is the intended daily command.

If full preflight is slow, the most likely causes are:

- agent registry rebuild
- Codex self-test
- Git Bash startup
- large local memory scans
- private knowledge bank health checks

The registry rebuild is now skipped when already fresh.

### Claude Opens In A New Window

You probably used:

```powershell
sgsd -Claude -Greet
```

That is the legacy/new-window mode.

Use this instead:

```powershell
sg
```

`sg` starts Claude in the current terminal.

### Private Knowledge Bank Missing

Run:

```powershell
sgsd-setup
```

Either provide the correct directory, or leave it blank and use the bundled
fallback corpus.

---

## Mental Model

Use `sg` as the front door.

```text
sg
 |
 +-- starts cockpit separately
 |
 +-- starts Claude here
 |
 +-- injects SGSD greeting
 |
 +-- you tell Claude what to build
```

Use `sgsd` when you only care about the cockpit.

Use `sgsd-setup` when you are configuring knowledge and memory.

Use `sg -FullPreflight` when you want a deeper safety check before a serious
autonomous run.
