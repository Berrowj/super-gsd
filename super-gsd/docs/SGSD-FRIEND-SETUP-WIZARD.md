# SGSD Friend Setup Wizard

This is the "send this to someone who has never used SGSD" guide.

It explains:

- what SGSD is
- what they need installed
- how to install it
- how to boot the cockpit
- what the cockpit means
- how to start autonomous mode
- how to recover when something looks wrong

Use this as the first document for a new operator. The deeper docs can stay
behind it.

---

## 0. The Simple Mental Model

SGSD is a control system for Claude Code.

Normal Claude Code:

```text
You ask one thing -> Claude does one thing -> waits.
```

SGSD:

```text
You say "go" -> SGSD plans, dispatches agents, writes code,
runs checks, commits, and keeps going.
```

The cockpit is the dashboard. It is read-only. It tells you:

- what milestone is active
- what phase is active
- what Claude is doing
- what agents are running
- what Codex / ATC / MUDA gates are doing
- whether automode can continue
- where tokens are being spent
- what just committed

You work in the main Claude terminal. You watch the cockpit.

---

## 1. What You Need Installed

### Required

1. **Claude Code**
   - Install from: https://claude.ai/code
   - SGSD expects you to be logged into Claude Code.
   - SGSD does not need Anthropic API keys for normal use.

2. **Node.js 20 or newer**
   - Check:

   ```powershell
   node --version
   ```

3. **Git for Windows**
   - Check:

   ```powershell
   git --version
   bash --version
   ```

   SGSD expects Git Bash, not WSL bash, for Windows path handling.

4. **PowerShell**
   - Windows PowerShell 5.1 works.
   - PowerShell 7 is also fine.

### Optional

1. **Codex CLI**
   - Used for independent review when available.
   - If Codex is unavailable, SGSD records a degraded review path and continues.

2. **Redis**
   - Optional fast live projection cache.
   - Never canonical truth.
   - SGSD must still work without Redis.

3. **VTP or another private knowledge bank**
   - Optional private research / memory source.
   - If missing, SGSD uses local project memory and bundled fallback docs.

---

## 2. Put SGSD In The Project

The easiest friend-safe layout is:

```text
my-project/
  super-gsd/
  .planning/
  CLAUDE.md
  README.md
  src/
```

If they already have a project, copy the `super-gsd/` folder into the project
root.

If they are cloning this repository, the root already contains `super-gsd/`.

Then open PowerShell in the project root:

```powershell
cd C:\path\to\my-project
```

Check the boot script exists:

```powershell
Test-Path .\super-gsd\scripts\sgsd-boot.ps1
```

Expected:

```text
True
```

---

## 3. Install The Shortcuts

Run this once:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force
```

Reload your PowerShell profile:

```powershell
. $PROFILE
```

If that errors because the profile does not exist, open a new PowerShell
window instead.

Check the commands exist:

```powershell
Get-Command sg
Get-Command sgsd
Get-Command sgsd-setup
```

What these commands mean:

| Command | Meaning |
|---|---|
| `sg` | Normal daily startup: cockpit plus Claude in this terminal |
| `sg -Go` | Start cockpit and launch Claude directly into automode |
| `sg -FullPreflight` | Slower startup with deeper health checks |
| `sgsd` | Cockpit only |
| `sgsd -NoOpen` | Preflight only, no windows |
| `sgsd-setup` | Configure memory and private knowledge paths |
| `sgsd-refresh` | Reboot cockpit panes if they look stale |

Important: `sg` starts Claude with the intended SGSD permissions mode. The
operator should not need to manually type `claude --dangerously-skip-permissions`
unless debugging the launcher itself.

---

## 4. Configure Knowledge And Memory

Run:

```powershell
sgsd-setup
```

Recommended answers for a first-time user:

| Question | Safe answer |
|---|---|
| Private knowledge bank | Leave blank unless they have one |
| SGSD memory root | `.planning/memory` |
| Fallback corpus | `sgsd-bundled-research` |

If they have VTP, Obsidian, a company docs repo, or a research folder, point
the private knowledge bank at that folder.

If they do not, leave it blank.

---

## 5. Initialize Project-Level Defaults

Run the project wizard:

```powershell
node .\super-gsd\scripts\sgsd-new-project-wizard.cjs --defaults
```

This writes project-level SGSD config only. It does not overwrite existing
operator settings.

Self-test the wizard:

```powershell
node .\super-gsd\scripts\sgsd-new-project-wizard.cjs --self-test
```

Expected final line:

```text
wizard_self_test: 13/13 assertions passed
```

---

## 6. Run A Startup Health Check

Fast check:

```powershell
sgsd -NoOpen
```

Deep check before a long autonomous run:

```powershell
sg -FullPreflight -NoClaude
```

Use full preflight when:

- SGSD was just installed
- the repo was just pulled
- the cockpit looks wrong
- Codex or VTP paths changed
- you are about to leave automode running for a while

---

## 7. Boot SGSD For Normal Work

Daily command:

```powershell
sg
```

What happens:

1. SGSD opens the cockpit in another window.
2. SGSD starts Claude Code in the current terminal.
3. Claude reads the SGSD greeting and waits for your instruction.

If you already know you want automode:

```powershell
sg -Go
```

That opens the cockpit and tells Claude to start the autonomous loop.

---

## 8. What To Type In Claude

Inside the Claude terminal:

```text
go
```

or:

```text
/sgsd-orchestrate go
```

Useful commands:

| Command | What it does |
|---|---|
| `go` | Start or continue automode |
| `/sgsd-orchestrate go` | Explicit automode entry |
| `/sgsd-orchestrate next` | Do one unit, then stop |
| `/sgsd-orchestrate status` | Report current state |
| `/sgsd-resume` | Resume from checkpoint |
| `/sgsd-pause` | Write checkpoint and pause |
| `/sgsd-readiness` | Generate unattended-readiness manifest |
| `/sgsd-token-audit --quick` | Quick token-spend view |

---

## 9. How To Read The Cockpit

The cockpit is a dashboard, not a place to type.

### Mission Control

Use this first.

It should answer:

- what milestone am I on?
- what phase am I on?
- how many phases are complete?
- what is the current goal?
- what evidence is done?
- what debt exists?
- is automode safe to continue?
- when was the last heartbeat?
- what agents are active?
- what just committed?

Common lines:

| Line | Meaning |
|---|---|
| `MISSION v1.9 P49 (9/12)` | Active milestone and phase progress |
| `CURRENT P49 ...` | The phase being worked right now |
| `NEXT P50 ...` | The next phase |
| `EVIDENCE done ... left ...` | What sign-off artifacts exist and what remains |
| `DEBT phase 0 / milestone 0 / edge 0` | Open backlog count |
| `AUTOMODE partial/go/blocked` | Whether the run can continue unattended |
| `<3 30s since last beat` | Last orchestrator heartbeat |
| `CTX 32% ...` | Context usage |
| `COST ...` | Estimated spend |
| `AGENTS ...` | Active, idle, recent agent count |
| `COMMITS` | Latest git commits |

### Gates / Codex / Review Panel

Use this to understand quality review.

It should answer:

- is Codex currently reviewing this phase?
- did Codex time out?
- did Claude ATC run?
- did MUDA run?
- what did each gate catch?
- what still needs review?

Important: Codex unavailable is not automatically a hard stop. SGSD should log
that Codex evidence is missing or degraded, then continue with the fallback
route unless the milestone explicitly requires Codex.

### Claude + Agents Panel

Use this to understand where tokens are going.

It should answer:

- what is Claude doing now?
- which agent is active?
- what did the last researcher/planner/executor decide?
- how much token spend belongs to agents vs main context?
- what tool calls just happened?

This panel is useful when you ask: "Why is this taking so long?"

---

## 10. The First Demo Run

If someone wants to try SGSD without risking a real project, use the fixture:

```powershell
cd C:\path\to\repo
cd examples\hello-world
node ..\..\super-gsd\scripts\sgsd-new-project-wizard.cjs --defaults
sg
```

Then in Claude:

```text
/sgsd-orchestrate status
```

This proves:

- the project config can be written
- the cockpit can boot
- Claude can read project state
- SGSD commands are visible

---

## 11. Recovery Guide

### Cockpit looks stale

Run:

```powershell
sgsd-refresh
```

or:

```powershell
sgsd
```

### Claude closed but cockpit is still open

Go back to the project root:

```powershell
cd C:\path\to\my-project
sg
```

Then in Claude:

```text
/sgsd-resume
```

### Automode seems paused

Ask Claude:

```text
/sgsd-orchestrate status
```

If there is a checkpoint:

```text
/sgsd-resume
```

### Cockpit pane shows a red failure screen

That means the dashboard crashed but stayed visible.

Copy the error text, then run:

```powershell
sgsd-refresh
```

### Codex says timeout or unavailable

This is usually not fatal.

Run:

```powershell
node .\super-gsd\tools\provider-health\check.cjs --provider codex --behavioral
```

If it still fails, continue. SGSD should mark Codex review as degraded and use
fallback review.

### Redis is missing

That is fine.

Redis is optional. SGSD should fall back to SQLite and local files.

### VTP/private knowledge is missing

Run:

```powershell
sgsd-setup
```

Either point it at the right folder or leave it blank.

---

## 12. Safe Sharing Checklist

Before sharing a project with someone else:

- Do not include `.env`.
- Do not include `.claude/`.
- Do not include private API keys.
- Do not include private VTP/company docs unless intended.
- Keep `super-gsd/`.
- Keep `CLAUDE.md`.
- Keep `.planning/STATE.md` and `.planning/ROADMAP.md` if you want them to resume the same project state.
- If you want a clean new project, keep `super-gsd/` and delete old project-specific `.planning/metrics/` logs.

Recommended friend handover:

```text
1. Install Claude Code, Node 20+, and Git.
2. Open PowerShell in the project.
3. Run the shortcut installer.
4. Run sgsd-setup.
5. Run node .\super-gsd\scripts\sgsd-new-project-wizard.cjs --defaults.
6. Run sg.
7. Type go in Claude.
```

---

## 13. One-Page Copy/Paste

For a Windows user starting in the project root:

```powershell
# 1. Install SGSD shortcuts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force

# 2. Reload profile or open a new PowerShell window
. $PROFILE

# 3. Configure knowledge/memory
sgsd-setup

# 4. Write project defaults
node .\super-gsd\scripts\sgsd-new-project-wizard.cjs --defaults

# 5. Full first-run health check
sg -FullPreflight -NoClaude

# 6. Daily boot
sg
```

Then in Claude:

```text
go
```

For immediate automode:

```powershell
sg -Go
```

---

## 14. Where To Go Next

After this wizard:

- `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` - detailed boot flags
- `super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md` - deterministic demo fixture
- `super-gsd/docs/SGSD-WORKSPACE-GUIDE.md` - richer workspace/cockpit layout
- `super-gsd/USER-GUIDE.md` - full beginner guide
- `docs/reports/SGSD-Token-Usage-Before-After-v1.9.html` - token usage story
- `docs/reports/SGSD-Warp-Integration-ELI5.html` - Warp workflow ideas

