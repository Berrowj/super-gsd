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
- local SQLite context database is present or buildable
- Redis adapter degrades cleanly when Redis is absent

Use this when:

- You just pulled changes.
- You changed SGSD scripts.
- The cockpit looks wrong.
- You are about to run a long autonomous session.
- You want confidence over speed.

The boot process now avoids rebuilding `agents.jsonl` when the agent files have
not changed, so full preflight should be much faster than before.

---

## Codex Setup

Codex is required for the current source-changing automode path. SGSD can boot
without Codex so the cockpit can explain the degraded state, but a fresh friend
install is not ready for unattended coding until `codex login status` works.

Current routing contract:

| Surface | Runtime |
|---|---|
| Orchestration | Claude / Opus |
| Planning | Opus 4.7 / xhigh |
| Phase research | Codex GPT-5.5 / xhigh |
| Plan-final ATC + MUDA challenge | Codex GPT-5.5 / xhigh |
| Source-changing execution | Codex GPT-5.5 / xhigh |
| Per-dispatch and phase-level ATC | Codex CLI reviewer |
| Verifier/checker/readiness/enrichment roles | Sonnet or Haiku where still declared |

Install and log in:

```powershell
npm install -g @openai/codex
codex --version
codex login
codex login status
```

Expected status:

```text
Logged in using ChatGPT
```

Verify SGSD can see Codex:

```powershell
node .\super-gsd\tools\provider-health\check.cjs --provider codex
```

Run a real contract canary when you want full confidence:

```powershell
node .\super-gsd\tools\provider-health\check.cjs --provider codex --behavioral
```

The behavioral canary makes a tiny real Codex call, so it may spend a small
amount of Codex tokens. Normal fast boot uses the cheaper login-status check.

If Codex is not installed or not logged in, SGSD should record the Codex path as
degraded. A backlog row should say what evidence is missing (`Codex review
missing`) separately from the suspected cause (`not installed`, `not logged in`,
`timeout`, etc.). Repair Codex before starting unattended source-changing
automode.

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

## Gate Model

SGSD gates exist to keep automode honest. They do not all mean "stop". Most
gates either prove the phase can close, record missing evidence, or downgrade
status so the operator can see the truth.

The usual phase-close path:

```text
Package ready
  -> Claude ATC
  -> Codex ATC if available
  -> fix/defer findings
  -> write honest verdict
  -> MUDA waste review
  -> status consistency check
  -> milestone close gates when all phases finish
```

The main gates:

| Gate | What it does | If it fails |
|---|---|---|
| Readiness | Checks services, local files, provider setup, and known blockers before automode | Marks unattended state partial/blocked; automode can still use fallback chain |
| ATC | Air-traffic-control style review of contract, code/docs, evidence, and closeout status | Fix in-loop, defer with debt, or mark candidate depending on severity |
| Codex ATC | Independent Codex review for selected ATC tiers | Missing Codex is degraded evidence, not automatically a hard stop |
| MUDA | TIMWOOD waste review: transport, inventory, motion, waiting, overproduction, overprocessing, defects | Logs waste and fix opportunities; can drive pruning phases |
| Status consistency | Rejects impossible status claims such as PASS with open backlog | Fix status/evidence immediately |
| Release readiness | Milestone-level score/check suite | Blocks clean milestone close or marks shipped-with-debt/candidate |

ATC and MUDA are complementary:

```text
ATC asks:  Is this safe and correct enough to land?
MUDA asks: Did we create avoidable waste while landing it?
```

Codex feeds both when available:

- ATC: independent review of the phase package and changed files.
- MUDA: qualitative waste review, especially overproduction and overprocessing.

---

## Using SGSD In Warp

Warp is a good shell for SGSD because `sg` keeps Claude Code in the current
terminal while opening the cockpit separately.

Recommended Warp flow:

```powershell
cd C:\Users\jack.berrow\GSDedits
sg
```

You do not need to boot Claude first. Type `sg` inside Warp and let SGSD start
Claude in that same tab.

This repository also ships Warp workflow files in:

```text
.warp/workflows/
```

Available workflows:

| Workflow | What It Runs |
|---|---|
| `SGSD: Start` | `sg -ProjectDir "{{project_dir}}"` |
| `SGSD: Auto Mode` | `sg -Go -ProjectDir "{{project_dir}}"` |
| `SGSD: Cockpit Only` | `sgsd -ProjectDir "{{project_dir}}"` |
| `SGSD: Token Summary` | Current token attribution summary |
| `SGSD: Full Preflight` | `sg -FullPreflight -ProjectDir "{{project_dir}}"` |

If Warp cannot find `sg`, reload your PowerShell profile in that Warp tab:

```powershell
. $PROFILE
Get-Command sg
```

If Warp starts a different shell profile from your normal PowerShell, rerun:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force
```

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

If no private knowledge bank exists, SGSD falls back to local SGSD research,
project memory, and the local SQLite context database.

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

Boot enforces this distinction. On first run, `sgsd-boot.ps1` seeds a local
knowledge config if `.planning/config.json` has no `knowledge` block:

```text
private_root:     null
memory_root:      .planning/memory
fallback_corpus:  sgsd-bundled-research
```

It also runs the non-destructive project wizard when the `project` block is
missing. This gives a new operator local knowledge and cockpit defaults without
needing VTP.

Redis is separate: it is an optional live projection cache. The local SQLite
context database is the usable local knowledge database; Redis is never
canonical and never required for boot.

---

## Recommended First Run On A New Project

From the project root:

```powershell
npm install
sgsd -NoOpen
```

The first boot check seeds local defaults automatically. Run `sgsd-setup` only
when you want to add a private knowledge bank:

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
