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
You say "go" -> Claude/Opus orchestrates, Codex researches, plans, writes
code, verifies, runs Codex-owned gates, and SGSD records evidence.
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

2. **Node.js 22 or newer**
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

5. **Codex CLI**
   - Current SGSD uses Codex GPT-5.5/xhigh for phase research, planning,
     plan-check, ATC/MUDA review, source-changing execution, verification,
     per-dispatch ATC, phase-level ATC, and qualitative waste review.
   - Install globally:

   ```powershell
   npm install -g @openai/codex
   codex --version
   codex login
   codex login status
   ```

   Expected login status:

   ```text
   Logged in using ChatGPT
   ```

   If Codex is missing, `sg` can still boot the cockpit, but the install is
   not ready for unattended source-changing automode.

6. **Project Node dependencies**
   - From the project root, run:

   ```powershell
   npm install
   ```

   This installs the local SQLite context database dependency. Without it,
   SGSD can still start in degraded mode, but local knowledge search is weaker.

### Optional

1. **Redis**
   - Optional fast live projection cache.
   - Never canonical truth.
   - Not needed for first boot.
   - SGSD uses the local SQLite context database and files when Redis is absent.

2. **VTP or another private knowledge bank**
   - Optional private research / memory source.
   - VTP is Jack's private knowledge bank, not a required SGSD dependency.
   - If missing, SGSD uses local project memory, the SQLite context database,
     and bundled fallback docs.

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

If they are cloning this repository, the root already contains `super-gsd/`:

```powershell
git clone https://github.com/Berrowj/super-gsd.git
cd super-gsd
npm install
```

If they already have a separate project, copy the `super-gsd/` folder plus the
root `CLAUDE.md`, `AGENTS.md`, `WARP.md`, and `.planning/` starter files into
that project root. Do not copy Jack's private VTP folder or local `.env` files.

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

Run the safe installer checks and local project setup:

```powershell
bash super-gsd/install.sh --doctor
bash super-gsd/install.sh --init-project
```

This creates or verifies only project-local SGSD files: `.planning/`,
`.planning/memory/`, `.planning/config.json`, metrics skeletons, and
`CLAUDE.md`. It does not touch global Claude permissions and it does not
install ByteRover.

Global Claude commands/hooks are separate and optional:

```powershell
bash super-gsd/install.sh --install-global --dry-run
bash super-gsd/install.sh --install-global
```

Global auto-approval is also separate. Do not run this on an unfamiliar
machine unless you want every Claude Code session for that OS user to stop
asking for tool approvals:

```powershell
bash super-gsd/install.sh --enable-autoapprove
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

First boot now seeds safe local defaults automatically:

```text
private knowledge bank: not configured
memory root:            .planning/memory
fallback corpus:        sgsd-bundled-research
project defaults:       cockpit panels + boot mode
```

That means a new friend does not need VTP and does not need to know what VTP
is. SGSD will use local knowledge unless they deliberately configure a private
knowledge bank.

Run `sgsd-setup` during first setup. It configures memory/private knowledge and
prints Claude/Codex readiness. It does not store API keys or login tokens.

```powershell
sgsd-setup
```

Recommended answers for a first-time user:

| Question | Safe answer |
|---|---|
| Private knowledge bank | Leave blank unless they have one |
| SGSD memory root | `.planning/memory` |
| Fallback corpus | `sgsd-bundled-research` |

If they do not have one, leave it blank.

Expected provider readiness lines:

```text
Claude Code CLI: found
Codex CLI: found
Codex login: available
```

If one is missing, run the command printed by setup, usually `claude` to finish
Claude login or `codex login` for Codex.

---

## 5. Initialize Project-Level Defaults

Boot also runs this automatically if the `project` config block is missing.
You can run it manually when checking a setup:

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

MCP setup is optional. If the friend uses Warp Agent or another MCP-capable
client, start from the checked-in template:

```text
super-gsd/templates/onboard/mcp.json.template
```

Replace `{{PROJECT_DIR_FORWARD_SLASH}}` with the clone path using forward
slashes, for example `C:/Users/alex/projects/super-gsd`. The SGSD MCP is
separate from VTP; VTP/private KB MCP servers are never required for a new
operator.

---

## 6. Set Up Codex

Codex is required for the current source-changing SGSD executor path.

Plain English:

```text
Claude/Opus orchestrates and chooses the next action.
Codex GPT-5.5/xhigh researches, plans, edits files, verifies, and runs
Codex-owned gates.
SGSD records the evidence and advances only through the gate path.
```

Install Codex after `npm install` and before the first full preflight:

```powershell
npm install -g @openai/codex
codex --version
codex login
codex login status
```

Then verify SGSD can see it:

```powershell
node .\super-gsd\tools\provider-health\check.cjs --provider codex
```

Expected:

```text
AVAILABLE
```

For a deeper real-call canary:

```powershell
node .\super-gsd\tools\provider-health\check.cjs --provider codex --behavioral
```

That canary may spend a small amount of Codex tokens because it asks Codex to
return a tiny contract response.

If Codex is not installed, SGSD still boots. The cockpit should show the Codex
path as unavailable/degraded, but a friend should not start unattended
source-changing automode until Codex is installed and logged in.

---

## 7. Run A Startup Health Check

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
- Redis/cache behavior changed
- you are about to leave automode running for a while

What boot checks for first-run users:

| Area | Boot behavior |
|---|---|
| Required tools | Fails clearly if Node 22+ or Git is missing |
| Node dependencies | Warns to run `npm install` if local context DB deps are missing |
| Local memory | Requires or bootstraps `.planning/memory` |
| Knowledge config | Seeds local memory + bundled research if missing |
| Project config | Runs the non-destructive project wizard if missing |
| Local database | Checks/builds the SQLite context index when missing |
| Codex | Checks `codex login status`; full preflight can run a real canary |
| Redis | Reports optional availability; never blocks startup |
| VTP/private KB | Reports optional presence; local fallback is normal |

---

## 8. Boot SGSD For Normal Work

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

## 9. What To Type In Claude

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

## 10. How To Read The Cockpit

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

Important: Codex unavailable is a setup problem for source-changing automode.
SGSD should log that Codex evidence is missing or degraded; a new operator
should fix Codex login before leaving automode unattended.

### How The Gates Fit Together

Every phase is trying to answer one question:

```text
Can this phase close honestly, with enough evidence, without hiding debt?
```

The normal close path is:

| Step | Plain name | What it proves |
|---|---|---|
| 1 | Package | Phase docs, plan, changed files, and evidence exist |
| 2 | Claude ATC | Claude reviews whether the work matches the phase contract |
| 3 | Codex ATC | Codex gives an independent review when available |
| 4 | Fixes | Findings are fixed, rejected with evidence, or moved to backlog |
| 5 | Verdict | Phase status is written honestly: PASS, deferred, or candidate |
| 6 | MUDA | Waste review checks needless work, bloat, waits, rework, and dead artifacts |
| 7 | Status consistency | SGSD rejects impossible states, such as PASS with open debt |
| 8 | Milestone close | The milestone runs its final gate set before it is marked shipped |

ATC means "air-traffic-control style review": it checks whether the work is
safe to land. In SGSD it is not only code review; it also checks the plan,
evidence, phase contract, files touched, and closeout status.

MUDA is the waste gate. It uses TIMWOOD:

| Letter | Meaning | Example waste it catches |
|---|---|---|
| T | Transport | needless handoff between tools or agents |
| I | Inventory | stale docs, unused outputs, unconsumed artifacts |
| M | Motion | repeated scanning or file/tool hopping |
| W | Waiting | idle blockers, avoidable waits, queue stalls |
| O | Overproduction | docs or abstractions nobody needs |
| O | Overprocessing | over-complex wrappers, checks, or process bloat |
| D | Defects | repair loops caused by broken contracts or errors |

Codex is used mainly in ATC and qualitative-waste review. If Codex is missing
or times out, SGSD should record the missing evidence separately from the
suspected cause. The fact is "Codex review missing"; the cause might be
"Codex not installed", "not logged in", or "timeout".

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

## 11. The First Demo Run

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

## 12. Recovery Guide

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

If it still fails, do not start unattended source-changing automode. SGSD can
still boot and report the degraded Codex path, but the friend-ready fix is to
repair `codex login` first.

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

## 13. Safe Sharing Checklist

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
1. Install Claude Code, Node 22+, and Git.
2. Open PowerShell in the project.
3. Run npm install.
4. Install Codex and run codex login.
5. Run `bash super-gsd/install.sh --doctor`.
6. Run `bash super-gsd/install.sh --init-project`.
7. Run the shortcut installer.
8. Run sgsd -NoOpen once; boot confirms local defaults.
9. Run sg.
10. Type go in Claude, or run sg -Go.
```

---

## 14. One-Page Copy/Paste

For a Windows user starting in the project root:

```powershell
# 1. Install project dependencies
npm install

# 2. Required for source-changing automode: install Codex
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  npm install -g @openai/codex
}
codex --version
codex login
codex login status
node .\super-gsd\tools\provider-health\check.cjs --provider codex

# 3. Safe SGSD local setup
bash super-gsd/install.sh --doctor
bash super-gsd/install.sh --init-project

# 4. Install SGSD shortcuts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force

# 5. Reload profile or open a new PowerShell window
. $PROFILE

# 6. Full first-run health check
# Seeds local knowledge/project defaults if they are missing.
sg -FullPreflight -NoClaude

# 7. Configure local memory/fallback knowledge and print provider readiness
sgsd-setup -NonInteractive

# 8. Daily boot
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

## 15. Where To Go Next

After this wizard:

- `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` - detailed boot flags
- `super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md` - deterministic demo fixture
- `super-gsd/docs/SGSD-WORKSPACE-GUIDE.md` - richer workspace/cockpit layout
- `super-gsd/USER-GUIDE.md` - full beginner guide
- `docs/reports/SGSD-Token-Usage-Before-After-v1.9.html` - token usage story
- `docs/reports/SGSD-Warp-Integration-ELI5.html` - Warp workflow ideas
