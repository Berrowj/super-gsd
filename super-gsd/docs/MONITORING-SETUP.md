# Super GSD Monitoring — Complete Setup Guide

Three layers of visibility into what Super GSD is doing:

1. **Statusline** (1 line, inside Claude Code)
2. **Task list** (top of Claude Code, native TaskCreate display)
3. **Agent Dashboard** (separate terminal, full mission control)

---

## Layer 1: Statusline (Always Visible)

Shows at the bottom of every Claude Code session:

```
Opus | v1.7 P84/88 ██████░░ 73% | gsd-executor [sonnet] 2.4K | Σ47K | ctx ██░░░ 35%
```

**What each field means:**

| Field | Meaning |
|-------|---------|
| `Opus` | Your current Claude model |
| `v1.7 P84/88 ██████░░ 73%` | Milestone, current phase, progress bar |
| `gsd-executor [sonnet] 2.4K` | Most recent agent + model + its token cost |
| `Σ47K` | Session total tokens (sum of all agents so far) |
| `ctx ██░░░ 35%` | Context window usage |

**Colors by model:**
- **Purple** = Opus
- **Blue** = Sonnet
- **Cyan** = Haiku

**Enable it** — add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/hooks/sgsd-statusline.js"
  }
}
```

Then restart Claude Code. The statusline reads `.planning/STATE.md`, `.planning/metrics/token-log.jsonl`, and the most recent agent dispatch — always up to date.

---

## Layer 2: Native Task List (Top of Claude Code)

Claude Code has a built-in task display for `TaskCreate`. When the orchestrator creates tasks for each agent dispatch, they show up at the top of the screen like this:

```
○ Planning Phase 87... (2m 21s, 2.1k tokens)
  ■ Plan Phase 87
    □ gsd-classifier (haiku) — classifying phase 87 complexity
    □ gsd-planner (sonnet) — creating plan 87-01
    □ gsd-executor (sonnet) — executing plan 87-01
    □ Verify Phase 87 goal achievement
```

This is Claude Code's built-in display. You don't need to configure anything — the orchestrator already uses TaskCreate when it dispatches agents. The task list collapses/expands with Ctrl+O.

**To make agents show up individually** instead of just phase-level:

The sgsd-orchestrate skill calls `TaskCreate` before each agent dispatch with the agent name and model in the `activeForm`. As agents complete, they get marked done in the list.

If you're not seeing agent-level tasks, the orchestrator is probably batching them. You can force granular display by adding this to your next prompt:

```
Create a task for each agent dispatch using TaskCreate.
Set the activeForm to "agent-name (model) — what it's doing".
Mark as in_progress when spawning, completed when the agent returns.
```

---

## Layer 3: Agent Dashboard (Separate Terminal)

The most detailed view — full mission control in a second terminal window. Shows every agent, every dispatch, every token, live git log, checkpoint status.

**Launch it:**

```bash
# WSL / bash / Mac / Linux
bash /path/to/super-gsd/scripts/sgsd-agent-dashboard.sh /path/to/project

# Windows PowerShell
.\super-gsd\scripts\sgsd-agent-dashboard.ps1 -ProjectDir C:\path\to\project
```

Open a second terminal tab (Windows Terminal supports this natively — Ctrl+Shift+T).

**What it shows:**

```
================================================================
              SUPER GSD -- AGENT DASHBOARD
================================================================
2026-04-10 10:30:15 | Refreshes every 3s | Ctrl+C to quit

Milestone: v1.7 | Phase: 87/88 | Status: executing
[##############---] 82/88 phases (93%)

[CHECKPOINT ACTIVE]
  Last: Phase 87 plan 87-01 complete
  Next: Phase 87 plan 87-02

AGENT ACTIVITY (last 10 dispatches)
----------------------------------------------------------------
  10:29:58 sonnet  gsd-executor P87.2                    2.4K
  10:29:12 haiku   gsd-classifier P87                     180
  10:28:45 sonnet  gsd-planner P87                       3.1K
  10:27:33 sonnet  gsd-executor P87.1                    5.8K
  10:25:01 haiku   gsd-classifier P87                     120
  10:24:30 opus    orchestrator P87                       890

  SESSION TOTALS:
  Opus:   12K tokens
  Sonnet: 47K tokens
  Haiku:  2K tokens
  Total:  61K tokens

CURRENT PHASE FILES (87-audit-dashboard)
----------------------------------------------------------------
  [done]    87-01-PLAN
  [pending] 87-02-PLAN

RECENT COMMITS
----------------------------------------------------------------
  a1b2c3d feat(87-01): dashboard score cards + colour coding
  d4e5f6g feat(86-02): L2 contract validation engine
  ...
```

Refreshes every 3 seconds. Reads directly from `.planning/metrics/token-log.jsonl` so no lag.

---

## Recommended Setup

**For casual use:** Just enable the statusline (Layer 1). You'll see the current agent and token usage always visible at the bottom.

**For serious autonomous runs:** Open two terminal tabs in Windows Terminal:

- **Tab 1**: Claude Code (where you type)
- **Tab 2**: `bash sgsd-agent-dashboard.sh` (read-only mission control)

When you start `/sgsd-orchestrate go`, watch the dashboard tab. Every agent dispatch appears in real time. You see which agent is running, on what model, with what token cost, without interrupting your main session.

**For overnight runs with the headless runner:**

```bash
# Terminal 1: Start headless runner (tmux so it persists)
tmux new-session -d -s gsd 'bash super-gsd/scripts/sgsd-headless.sh /path/to/project'

# Terminal 2: Watch the dashboard
bash super-gsd/scripts/sgsd-agent-dashboard.sh /path/to/project

# Go to bed. Dashboard refreshes every 3 seconds.
# Come back in the morning. Project is built. Dashboard shows final state.
```

**For SSH projects using a global SGSD install:**

```bash
# Starts or attaches the remote tmux cockpit.
ssh devcp -t 'bash ~/.claude/super-gsd/scripts/sgsd-remote-tmux.sh --project /opt/clarity/project-clarity-erp --session clarity-sgsd --greet'

# Optional alias on devcp after --install-global:
mkdir -p ~/.local/bin ~/bin
ln -sf ~/.claude/super-gsd/scripts/sgsd-remote-tmux.sh ~/.local/bin/sgclarity
ln -sf ~/.claude/super-gsd/scripts/sgsd-remote-tmux.sh ~/bin/sgclarity
ssh devcp -t '~/.local/bin/sgclarity --greet'
```

The remote tmux launcher opens four panes: operator Claude, mission control,
Codex monitor, and narrative/live logs. If PowerShell Core (`pwsh`) is missing
on the server, it falls back to plain shell log views instead of failing.

---

## Troubleshooting

**Statusline not appearing:**
- Did you add it to `~/.claude/settings.json`?
- Did you restart Claude Code after the change?
- Run `node ~/.claude/hooks/sgsd-statusline.js < /dev/null` manually to check it works

**Statusline shows wrong info:**
- Check `.planning/STATE.md` exists and has valid frontmatter
- Check `.planning/metrics/token-log.jsonl` exists (agents must have run at least once)
- The statusline reads the most recent agent — if nothing has run yet, it falls back to phase status

**Dashboard shows no agent activity:**
- Token log is empty. Agents haven't dispatched yet. Run `/sgsd-orchestrate next` to trigger one.
- Check `.planning/metrics/token-log.jsonl` exists

**Dashboard crashes on Windows:**
- Use the PowerShell version (`.ps1`) instead of bash (`.sh`) on native Windows
- If using WSL, use the `.sh` version from inside WSL

**Task list only shows phase-level, not agent-level:**
- Orchestrator is batching. Prompt Claude: "Use TaskCreate per agent dispatch, show model + role in activeForm"
- Or add this rule to CLAUDE.md

---

## Summary

| View | Location | Detail Level | When to Use |
|------|----------|--------------|-------------|
| Statusline | Bottom of Claude Code | Compact (1 line) | Always on — casual awareness |
| TaskList | Top of Claude Code | Medium (collapsible tree) | Built-in, free, visible by default |
| Dashboard | Separate terminal | Full (every agent, every token) | Serious runs, overnight, debugging |
