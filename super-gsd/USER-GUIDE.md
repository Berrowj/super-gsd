# Super GSD — The Complete User Guide

> **Read this if you've never used Super GSD before.**
> It explains everything from "what is this?" to "how do I make it build my entire project while I sleep?"

> **Current setup note (May 2026):** older SGSD material used
> ByteRover/`.brv`. Current SGSD memory is `.planning/memory/` with
> `MEMORY.md` and `sgsd-recall`. Do not install ByteRover for a fresh SGSD
> project. Use `README.md` and `super-gsd/docs/SGSD-FRIEND-SETUP-WIZARD.md` as
> the canonical fresh-clone setup docs until this full guide is rewritten.

---

## Table of Contents

1. [What Is Super GSD?](#1-what-is-super-gsd)
2. [What Do I Need Before I Start?](#2-what-do-i-need-before-i-start)
3. [Download](#3-download)
4. [Install — Step by Step](#4-install--step-by-step)
5. [Your First Project](#5-your-first-project)
6. [The Commands — What Can I Say?](#6-the-commands--what-can-i-say)
7. [How The Autonomous Loop Works](#7-how-the-autonomous-loop-works)
8. [The Memory System (`.planning/memory`)](#8-the-memory-system-planningmemory)
9. [Strategic Decisions (CEO/Board)](#9-strategic-decisions-ceoboard)
10. [Quality Gates (ATC)](#10-quality-gates-atc)
11. [The Signal Map (Overwatcher)](#11-the-signal-map-overwatcher)
12. [Token Tracking — Watching Your Spend](#12-token-tracking--watching-your-spend)
13. [Pausing and Resuming](#13-pausing-and-resuming)
14. [Migrating From GSD 2.0 (Pi)](#14-migrating-from-gsd-20-pi)
15. [Troubleshooting](#15-troubleshooting)
16. [Glossary](#16-glossary)

---

## 1. What Is Super GSD?

Imagine you could tell your computer "build me a web app" and then walk away. When you come back, it's done — code written, tests passing, git commits clean, quality checked.

That's what Super GSD does.

It's a **framework** that sits on top of [Claude Code](https://claude.ai/code) (Anthropic's AI coding tool). It turns Claude from a "helpful assistant that waits for your next instruction" into a **fully autonomous software engineer** that:

- **Plans its own work** — breaks big goals into phases, phases into tasks
- **Executes tasks** — writes actual code, runs tests, fixes bugs
- **Manages its own memory** — remembers what worked, what didn't, what patterns to follow
- **Checks its own quality** — reviews code before committing, catches problems early
- **Survives crashes** — if it runs out of memory, it saves its place and picks up exactly where it left off
- **Uses the right engine for the right job** — Opus 4.7 stays in xhigh orchestration mode, while Codex handles research, planning, coding, verification, ATC, and gate checks

### How is this different from regular Claude Code?

| Regular Claude Code | Super GSD |
|---|---|
| You tell it what to do, one thing at a time | You say "go" and it does everything |
| It forgets everything when you start a new chat | It remembers decisions, patterns, and scripts across sessions |
| Uses one model for everything | Keeps Opus on orchestration and Codex on delivery work |
| No quality checks | Automatic quality gates before every commit |
| If it crashes, you start over | Checkpoint system — picks up exactly where it stopped |
| Loads entire files into memory (wasteful) | Queries only the relevant bits (80% less token usage) |

### How is this different from GSD 1.0?

Super GSD is built ON TOP of GSD 1.0. Think of GSD 1.0 as the foundation (68 skills, 24 agents) and Super GSD as the upgrade that adds:

- Autonomous orchestrator loop
- Locked Opus/Codex routing
- `.planning/memory` with local recall
- CEO/Board deliberation for big decisions
- ATC quality gates
- Overwatcher signal map visualization
- Token tracking and cost optimization
- Checkpoint crash recovery

You keep everything GSD 1.0 has. Super GSD just adds more.

---

## 2. What Do I Need Before I Start?

### The Must-Haves

1. **Claude Code** — Anthropic's coding CLI
   - You need the **Max plan** ($100/month or $200/month)
   - This is important: Super GSD does NOT use API keys. Everything runs through your Max plan subscription. No surprise bills.
   - Install: https://claude.ai/code

2. **Node.js** — Version 22 or higher
   - Check if you have it: open a terminal and type `node --version`
   - If it says `v22.something` or higher, you're good
   - If not, download from: https://nodejs.org (pick the LTS version)

3. **Git** — Version control
   - Check: `git --version`
   - If it's not installed: https://git-scm.com/downloads

4. **A terminal** — Where you type commands
   - **Windows**: Use Windows Terminal + WSL2 (Windows Subsystem for Linux)
   - **Mac**: Use Terminal.app or iTerm2
   - **Linux**: Any terminal

### The Nice-to-Haves

- **Two terminal windows** — One for Claude Code (where you work), one for the Mission Control dashboard (read-only monitoring)
- **A code editor** — VS Code, Cursor, etc. for browsing the code Super GSD writes

### Windows Users — Important!

Super GSD works on Windows, but through **WSL2** (Windows Subsystem for Linux). This is because Claude Code runs in a Linux-like environment even on Windows.

If you don't have WSL2 set up:
1. Open PowerShell as Administrator
2. Run: `wsl --install`
3. Restart your computer
4. Open Windows Terminal, click the dropdown arrow, select "Ubuntu"

Now you're in Linux land. Everything below works the same on Windows (via WSL), Mac, and Linux.

---

## 3. Download

### Option A: Clone from GitHub (if available)

```bash
git clone https://github.com/YOUR-REPO/super-gsd.git
cd super-gsd
```

### Option B: Copy the files

If you have the `super-gsd/` folder already (maybe someone shared it with you), just copy it into your project directory:

```bash
cp -r /path/to/super-gsd ./super-gsd
```

### What's in the folder?

```
super-gsd/
├── agents/          ← 7 AI agent definitions (the "workers")
├── skills/          ← 8 slash commands you can type
├── hooks/           ← 5 background scripts that run automatically
├── templates/       ← 11 reusable document formats
├── workflows/       ← 4 engine specification documents
├── config/          ← 3 configuration files
├── brv-seed/        ← legacy knowledge seed files for migration only
├── overwatcher/     ← Signal map visualization tools
├── install.sh       ← The one-command installer
├── CLAUDE-OVERLAY.md ← The "brain" — teaches Claude the loop
├── README.md        ← Technical reference
└── USER-GUIDE.md    ← This file!
```

Don't worry about understanding all of this yet. The installer handles everything.

---

## 4. Install — Step by Step

### The One-Command Way

Open your terminal. Navigate to your project directory (the folder with your code). Then run:

```bash
bash super-gsd/install.sh --init-project
```

That's it. The installer will:

1. Check that Node.js is installed (and tell you if it's not)
2. Create `.planning/` directory in your project
3. Create `.planning/memory/` and `MEMORY.md`
4. Create `.planning/config.json` when missing
5. Create `CLAUDE.md` from the SGSD overlay when missing
6. Leave `~/.claude`, global hooks, global commands, global npm packages, and
   Claude `autoApprove` untouched

At the end, it prints a summary of what it installed and what to do next.

### What If Something Goes Wrong?

**"GSD 1.0 not found"** — The installer will try to install it for you. If that fails, run this first:
```bash
npx get-shit-done-cc@latest
```
Then run the installer again.

**"Node.js not found"** — Install Node.js from https://nodejs.org (version 22+)

**"Permission denied"** — You might need to make the installer executable first:
```bash
chmod +x super-gsd/install.sh
```

### The Manual Way (if you prefer)

If you'd rather do it step by step (or the installer doesn't work), here's every command:

```bash
# 1. Initialize your project-local SGSD state
mkdir -p .planning/{phases,metrics,briefs,decisions,deliberations,overwatcher}
mkdir -p .planning/memory/{architecture/patterns,architecture/anti-patterns,architecture/decisions,architecture/expertise,code,domain,project,reference,errors,trajectory/hypothesis,trajectory/candidate,trajectory/lesson}
printf "# Memory Index\n\nFormat: one markdown list item per file, readable by auto-memory and sgsd-recall.\n" > .planning/memory/MEMORY.md
cp super-gsd/config/planning-config-overlay.json .planning/config.json
touch .planning/metrics/token-log.jsonl
cp super-gsd/CLAUDE-OVERLAY.md CLAUDE.md

# 2. Optional global Claude overlay, if you want slash commands/hooks everywhere
bash super-gsd/install.sh --install-global

# 3. Optional global auto-approve, only when you deliberately want it
bash super-gsd/install.sh --enable-autoapprove
```

### After Installing — One More Thing

You need to add the Super GSD hooks to your Claude Code settings. This tells Claude Code to run our background scripts automatically.

The settings file is at `~/.claude/settings.json`. You need to merge in the hook registrations from `super-gsd/config/settings-overlay.json`.

The easiest way: open Claude Code and say:

```
Merge the hook registrations from super-gsd/config/settings-overlay.json into my ~/.claude/settings.json. 
Don't remove any existing hooks — just add the new ones.
```

Claude will do it for you.

Then **restart Claude Code** (close and reopen). The new skills and hooks only load on startup.

### Verify Everything Works

After restarting Claude Code, type these to check:

```
/sgsd-orchestrate status
```

You should see your project state (milestone, phase, progress).

```
/sgsd-token-audit --quick
```

Should show token usage (even if it's empty — that's fine for a new project).

Test the memory system:

```bash
sgsd-recall "orchestrator dispatch loop"
```

Should return ranked results from the knowledge base.

If all three work, you're good to go!

---

## 5. Your First Project

### Starting From Scratch

Open Claude Code in your project directory and type:

```
/gsd-new-project
```

Claude will ask you questions about what you're building. Answer them. It will create:

- `PROJECT.md` — What you're building and why
- `REQUIREMENTS.md` — What the software needs to do
- `ROADMAP.md` — The phases (steps) to build it
- `STATE.md` — Where you are right now

### Starting From an Existing GSD 1.0 Project

If you already have a `.planning/` directory from GSD 1.0, Super GSD works with it automatically. Just install Super GSD and it layers on top.

### The Magic Command

Once your project is set up (PROJECT.md, REQUIREMENTS.md, ROADMAP.md exist), type:

```
go
```

Or:

```
/sgsd-orchestrate go
```

That's it. Claude enters the autonomous loop and starts building your software. It will:

1. Read where it is in the project
2. Figure out what to do next
3. Do it (research, plan, code, test, verify)
4. Commit the work
5. Move to the next thing
6. Repeat until everything is done

You can walk away. Come back later. Check progress with `/sgsd-orchestrate status`.

---

## 6. The Commands — What Can I Say?

### Everyday Commands

| What You Type | What Happens |
|---|---|
| `go` or `/sgsd-orchestrate go` | Start the autonomous loop — builds everything |
| `/sgsd-orchestrate next` | Do ONE thing, then stop and tell me what happened |
| `/sgsd-orchestrate status` | Where am I? What's done? What's next? |
| `stop` or `/sgsd-pause` | Save progress and stop the loop |
| `continue` or `/sgsd-resume` | Pick up where I left off |

### Project Setup

| Command | When to Use |
|---|---|
| `/gsd-new-project` | Starting a brand new project |
| `/gsd-new-milestone` | Starting a new version/milestone in an existing project |
| `/gsd-discuss-phase N` | Talk through how Phase N should work before planning it |
| `/gsd-plan-phase N` | Create detailed task plans for Phase N |
| `/gsd-execute-phase N` | Execute all plans in Phase N |

### Analysis and Monitoring

| Command | When to Use |
|---|---|
| `/sgsd-token-audit --quick` | How many tokens am I using? |
| `/sgsd-token-audit --full` | Deep analysis of token usage across all sessions |
| `/sgsd-token-audit --context-map` | Which files cost the most tokens? |
| `/sgsd-overwatcher scan` | Generate the signal map (project visualization) |
| `/sgsd-overwatcher start` | Signal map + live server in browser |
| `/gsd-progress` | Summary of what's done and what's ahead |

### Big Decisions

| Command | When to Use |
|---|---|
| `/sgsd-deliberate new` | Need help making a hard decision? Run a CEO/Board debate |
| `/sgsd-deliberate path/to/brief.md` | Run debate on a prepared brief |

### Quality and Review

| Command | When to Use |
|---|---|
| `/gsd-verify-work N` | Check if Phase N actually achieved its goal |
| `/gsd-code-review` | Review code for bugs, security issues |
| `/gsd-health` | Is my .planning/ directory healthy? |

### Migration

| Command | When to Use |
|---|---|
| `/sgsd-transition .gsd/` | Migrate from Pi/GSD 2.0 to Super GSD |

### Everything Else From GSD 1.0

All 68 original GSD 1.0 commands still work! `/gsd-help` shows the full list.

---

## 7. How The Autonomous Loop Works

This is the heart of Super GSD. Understanding it helps you trust it (and debug it when things go weird).

### The Simple Version

```
READ → CLASSIFY → QUERY → COMPOSE → DISPATCH → PROCESS → CURATE → COMMIT → LOOP
```

Think of it like a factory assembly line that never stops:

1. **READ** — "Where am I?" (reads STATE.md — just the header, not the whole file)
2. **CLASSIFY** — "What kind of work is next?" (deterministic routing and gate policy)
3. **QUERY** — "What do I already know about this?" (searches memory for relevant patterns)
4. **COMPOSE** — "What should I tell the worker?" (builds a very specific instruction prompt)
5. **DISPATCH** — "Worker, go do this." (hands delivery work to Codex with the prompt and evidence requirements)
6. **PROCESS** — "What did the worker report back?" (reads the structured report)
7. **CURATE** — "Did we learn anything new?" (saves new patterns to memory)
8. **COMMIT** — "Save the work." (git commit — one per task, always)
9. **LOOP** — "Back to step 1." (reads STATE.md again — this is a tool call, so the loop continues)

### Why Does It Keep Going?

Here's the clever trick: Claude Code gives you another turn as long as every response includes a tool call (reading a file, running a command, etc.). The moment Claude sends ONLY text with no tool call, the loop stops.

So the orchestrator makes sure every response includes at least one tool call. "Phase done!" is always paired with `[Read STATE.md]` — the read is the tool call that keeps the loop alive.

### When Does It Stop?

Only 4 things stop the loop:

1. **All phases are done** — Mission accomplished! Nothing left to do.
2. **Memory is 70% full** — Claude saves a checkpoint file and stops. Next time you say "go", it picks up exactly where it left off.
3. **It's stuck** — Something needs a human decision. Claude explains what it needs and waits.
4. **You say "stop"** — Claude saves progress and stops.

Nothing else stops it. Not phase boundaries. Not milestone boundaries. Not "I've been running for a while." Only these 4 things.

### The Three Brains

Super GSD uses a locked current provider split:

| Brain | Name | Cost | Used For |
|---|---|---|---|
| Orchestrator | Claude / Opus | $$$$ | Reads state, decides the next step, composes prompts, and synthesizes results. |
| Delivery worker | Codex GPT-5.5 / xhigh | $$ | Research, planning, plan-check, code execution, verification, ATC, and MUDA gates. |
| Legacy Claude workers | Sonnet / Haiku | n/a | Not used by default in fresh-clone SGSD and not a Codex fallback. |

This keeps Claude focused on orchestration and keeps delivery work on Codex.

---

## 8. The Memory System (`.planning/memory`)

### The Problem It Solves

Regular Claude Code loads ALL memory files into every conversation. If you have 30 knowledge files, that's ~30,000 tokens eaten before Claude even reads your question.

Super GSD is smarter. It **queries** for relevant knowledge — like Google search instead of reading every book in the library.

### How It Works

Your project has a `.planning/memory/` folder. Inside are markdown files organized by topic:

```
.planning/memory/
├── patterns/           ← "How to do X correctly"
├── anti-patterns/      ← "What NOT to do"
├── decisions/          ← "Why we chose X over Y"
├── error-rules/        ← "Always check for this mistake"
├── scripts/            ← "We already built a utility for this"
├── expertise/          ← "Domain knowledge for board members"
└── domain/             ← "Business-specific knowledge"
```

Each file has a header (called "frontmatter") with metadata:

```yaml
---
title: Git Commit Discipline
tags: [git, commit, atomic]
keywords: [commit, git, atomic, never batch]
importance: 90        # 0-100, higher = more relevant
maturity: core        # draft → validated → core
---
```

### Querying (Finding Knowledge)

Before dispatching a worker agent, the orchestrator searches the memory:

```bash
sgsd-recall "auth middleware JWT patterns"
```

This returns the top matches with relevance scores. Only the relevant results (~200-600 tokens) get injected into the worker's prompt — NOT all 30 files.

### Curating (Adding Knowledge)

When a worker discovers something useful (a new pattern, a script it created, a bug it found), the orchestrator saves it to the memory system. Next time a similar task comes up, that knowledge is available.

You can also add knowledge manually — just write a `.md` file with frontmatter and drop it in the right folder.

### No API Key Required!

The current memory path is local markdown plus `MEMORY.md`. `sgsd-recall`
searches the project-local memory catalog; VTP/private KB is optional and
degrades cleanly when absent.

---

## 9. Strategic Decisions (CEO/Board)

### When To Use This

You're building something and you hit a fork in the road. "Should we use a SQL database or NoSQL?" "Should we build the auth system or use a third-party?" These are the kinds of decisions that affect multiple phases.

### How It Works

```
/sgsd-deliberate new
```

Claude asks you what decision you need to make. It creates a "brief" — a structured document with:

- **Situation** — What's happening
- **Stakes** — What's at risk
- **Constraints** — Non-negotiable limits
- **Key Questions** — The specific things to decide

Then it spawns 4 "board members" — each with a different perspective:

| Role | Personality | What They Ask |
|---|---|---|
| **Architect** | Technical, methodical | "Can we actually build this? What breaks at scale?" |
| **Pragmatist** | Skeptical of ambition | "What's the simplest version that ships? What's the 80% solution?" |
| **Contrarian** | Professionally paranoid | "What assumption hasn't been tested? What if this fails?" |
| **Moonshot** | Thinks big | "Are we thinking too small? What's the 10x version?" |

They each give their position (SUPPORT / OPPOSE / MODIFY). If they disagree, they debate (Round 2). The CEO synthesizes everything into a **Decision Memo** with:

- Final recommendation
- Who agreed and who didn't
- Unresolved tensions
- Trade-offs accepted
- Next actions

### The Gate — Don't Waste Tokens

Not every decision needs a 4-person board meeting. The system checks: "Does this affect 3 or more phases?" If not, it tells you to just decide and move on. This saves ~10,000 tokens per skipped deliberation.

---

## 10. Quality Gates (ATC)

### What's ATC?

ATC stands for "Air Traffic Control" — like at an airport. Before every commit gets "cleared for landing," it goes through a quality check. The depth of the check depends on how big the change is.

### The 4 Tiers

| Tier | When | What Happens | Token Cost |
|---|---|---|---|
| **SKIP** | Tiny change (<10 lines, 1 file) | Nothing — just commit | 0 |
| **LITE** | Small change (10-50 lines, 1-3 files) | Quick check: "Is there dead code? Could this be simpler?" | ~200 |
| **FULL** | Medium change (50+ lines, 4+ files) | Full 7-step review + 10-point anti-slop checklist | ~500 |
| **GATE** | Big change (new system, API, architecture) | Full review + "You should probably run /sgsd-deliberate first" | ~500+ |

The gate classifier assigns every change to a tier. If it's small, SGSD can keep checks light. If it's big, SGSD runs the full review path. This saves time on trivial changes while catching problems on important ones.

### The Safety Floor

Even if a change initially looks small, if it touches more than 3 files OR more than 100 lines, it gets bumped up to FULL automatically. This prevents a broad change from slipping through without review.

### The Stuck Detector

If Claude makes the same tool call 3+ times in a row (writing the same file, running the same failing command), a hook fires and says: "You're stuck. Stop, re-read the error, try a different approach." This prevents infinite loops.

---

## 11. The Signal Map (Overwatcher)

### What Is It?

A visual HTML dashboard that shows your entire project structure — phases, plans, dependencies, file collisions, progress.

### How To Generate It

```
/sgsd-overwatcher scan
```

This creates `.planning/overwatcher/signal-map.html`. Open it in your browser:

```
/sgsd-overwatcher open
```

Or double-click the file in your file explorer.

### What It Shows

- **Phase Grid** — Every phase with completion status (done/pending)
- **Plan Status** — How many plans in each phase, how many done
- **Collisions** — Files that multiple plans write to (potential conflicts!)
- **Dependency Graph** — Which plans depend on which
- **Decisions** — Strategic decisions made via /sgsd-deliberate

### Auto-Scan

If you have `"overwatcher": { "auto_scan": true }` in your `.planning/config.json` (it's on by default), the orchestrator regenerates the signal map after every phase completion. So it stays current automatically.

---

## 12. Token Tracking — Watching Your Spend

### Why Track Tokens?

Even on the Max plan (unlimited), tokens = time. More tokens = slower responses. Super GSD is designed to be efficient, but you should know where your tokens go.

### The Token Log

Every agent dispatch gets logged to `.planning/metrics/token-log.jsonl`. Each entry records:

- When it happened
- Which phase and plan
- Which provider/model handled the work (Opus orchestration, Codex delivery)
- What role (executor, planner, classifier, etc.)
- Estimated input and output tokens

### Checking Usage

```
/sgsd-token-audit --quick
```

Shows a quick summary: total tokens this session, most expensive agent, most expensive phase.

```
/sgsd-token-audit --full
```

Deep analysis: trends over time, model distribution, recommendations for optimization.

```
/sgsd-token-audit --context-map
```

Shows every .md file in your project with its token cost and when it gets loaded. Helps you find files that are too big or loaded unnecessarily.

### Where Do Tokens Go?

Typical breakdown:

| Component | % of Tokens | Why |
|---|---|---|
| Codex delivery | ~60% | Research, planning, coding, verification, and gate evidence |
| Plan/context work | ~15% | Creating task plans and context packets |
| Orchestrator (Opus) | ~10% | Making dispatch decisions |
| Gate checks | ~8% | Checking work quality |
| Routing/classification | ~2% | Lightweight deterministic decisions |
| Context injection (`.planning/memory`) | ~5% | Relevant knowledge lookup |

---

## 13. Pausing and Resuming

### Pausing

Say "stop" or "pause" or type `/sgsd-pause`. Claude will:

1. Write a checkpoint file (`.planning/ORCHESTRATOR-CHECKPOINT.md`) with exactly where it is
2. Commit the checkpoint
3. Stop

### Resuming

Next time you open Claude Code, say "go" or "continue" or type `/sgsd-resume`. Claude will:

1. Find the checkpoint
2. Read where it left off
3. Delete the checkpoint (it's been consumed)
4. Jump right back into the loop at the exact point it stopped

You don't need to re-explain anything. The checkpoint IS the context.

### Context Compaction

If the runtime compacts context, SGSD resumes from external state:
`.planning/STATE.md`, `.planning/ORCHESTRATOR-CHECKPOINT.md`, metrics JSONL,
and milestone artifacts. Context percentage is displayed for observability only;
it is not an automatic stop condition.

### What If Claude Crashes Without a Checkpoint?

The hooks write a lightweight checkpoint (`.planning/ORCHESTRATOR-CHECKPOINT.json`) after every git commit. So even if Claude crashes mid-session, there's usually enough breadcrumbs to resume from the last commit.

---

## 14. Migrating From GSD 2.0 (Pi)

If you were using GSD 2.0 with the Pi harness (before Anthropic disabled OAuth), you have a `.gsd/` directory with decisions, knowledge, requirements, and milestone data.

Super GSD can import all of that:

```
/sgsd-transition .gsd/
```

This will:

1. Read your `.gsd/DECISIONS.md` — import decisions into `.planning/memory`
2. Read your `.gsd/KNOWLEDGE.md` — import patterns and anti-patterns
3. Read your `.gsd/REQUIREMENTS.md` — merge into `.planning/REQUIREMENTS.md`
4. Map your milestones — completed work gets marked done, pending work becomes phases
5. Write a migration report

Your `.gsd/` directory is NOT modified or deleted. It's a read-only import.

---

## 15. Troubleshooting

### "The loop stops after one step"

The loop stays alive because every response includes a tool call. If Claude sends text-only, the loop dies. This usually means:

- Claude thinks it hit an exit condition (check STATE.md)
- A hook is crashing and breaking the chain (check `~/.claude/hooks/` for errors)
- The CLAUDE.md file is missing or incomplete (re-copy from `super-gsd/CLAUDE-OVERLAY.md`)

### "Permission denied" errors

Claude Code asks for permission before running tools. The safe installer leaves global permissions alone. Only enable global auto-approval deliberately, and only on machines/projects you trust:

```bash
bash super-gsd/install.sh --enable-autoapprove
```

This changes your global Claude Code config. To disable it again:

```bash
claude config set --global autoApprove ""
```

### "sgsd-recall returns no results"

Check that the memory tree has files:

```bash
find .planning/memory/ -name "*.md" | wc -l
```

Should include at least `MEMORY.md`. If it's empty, re-seed the local project:

```bash
bash super-gsd/install.sh --init-project
```

### "Node.js version too old"

```bash
node --version
```

Needs to be v22+. Update from https://nodejs.org.

### "gsd-tools errors"

GSD 1.0's `gsd-tools.cjs` might warn about "unknown config keys." This is normal — Super GSD adds config keys that GSD 1.0 doesn't know about. The warnings are harmless.

### "Checkpoint won't resume"

Check the checkpoint file exists:

```bash
cat .planning/ORCHESTRATOR-CHECKPOINT.md
```

If it's missing, check the JSON backup:

```bash
cat .planning/ORCHESTRATOR-CHECKPOINT.json
```

If both are missing, check git log for the last commit and resume manually with `/sgsd-orchestrate go`.

### "Signal map won't generate"

```bash
node ~/.claude/get-shit-done/templates/super-gsd/overwatcher/overwatcher-launcher.js
```

If it errors, the most common issue is that `.planning/` is empty (no phases, no plans). Create at least one phase first.

### "Token log is empty"

The token logger hook fires on Agent tool calls. If you haven't dispatched any agents yet, the log will be empty. Run `/sgsd-orchestrate next` to dispatch one agent and check the log after.

---

## 16. Glossary

| Term | What It Means |
|---|---|
| **Agent** | A specialized AI worker with a specific job (executor, planner, verifier, etc.) |
| **ATC** | Air Traffic Control — the quality gate system that checks code before commits |
| **Board** | The 4 debate agents (Architect, Pragmatist, Contrarian, Moonshot) in /sgsd-deliberate |
| **Brief** | A structured decision document given to the CEO/Board for deliberation |
| **SGSD memory** | The local memory system — stores knowledge in `.planning/memory/` |
| **CEO** | The orchestrator agent in /sgsd-deliberate that manages the board debate |
| **Checkpoint** | A saved state file that lets the loop resume after stopping |
| **Claude Code** | Anthropic's AI coding CLI — the foundation Super GSD runs on |
| **Memory tree** | The directory structure in `.planning/memory/` where knowledge lives |
| **Context window** | How much "memory" Claude has in one conversation (~200K tokens for Opus) |
| **Curate** | Save new knowledge to the memory system |
| **Decision Memo** | The output of /sgsd-deliberate — board stances, tensions, recommendation |
| **Dispatch** | Send a task to a worker agent |
| **GSD** | Get Shit Done — the framework name |
| **Haiku** | Legacy Claude small-model route; not used by default in fresh-clone SGSD |
| **Hook** | A background script that runs automatically on certain events |
| **JSONL** | JSON Lines — a log format where each line is a JSON object |
| **Max plan** | Anthropic's subscription plan ($100-200/month) — no per-token billing |
| **Milestone** | A major version of your project (v1.0, v2.0, etc.) |
| **Model routing** | Keeping Opus on orchestration and Codex on research/planning/coding/gates |
| **OAuth** | How Claude Code authenticates — uses your Max plan, no API key |
| **Opus** | The largest/smartest Claude model — used for orchestration and strategy |
| **Orchestrator** | The main loop that reads state, dispatches agents, processes results |
| **Overwatcher** | The signal map visualization tool |
| **Phase** | A chunk of work within a milestone (e.g., "build auth system") |
| **Plan** | A detailed task list within a phase (2-3 tasks per plan) |
| **Query** | Search the memory system for relevant knowledge |
| **ROADMAP.md** | The list of phases with checkboxes showing what's done |
| **Signal map** | HTML visualization showing project health, phases, dependencies |
| **Skill** | A slash command you can type (e.g., `/sgsd-orchestrate`) |
| **Sonnet** | Legacy Claude worker route; not used by default and not a Codex fallback |
| **STATE.md** | Where you are right now — milestone, phase, plan, progress |
| **Token** | A unit of text (~4 characters). More tokens = more cost/time |
| **Wave** | A group of plans that can run in parallel |
| **WSL2** | Windows Subsystem for Linux — how Windows runs Linux tools |

---

## Quick Start Cheat Sheet

```bash
# Install
bash super-gsd/install.sh --init-project
# Optional, global, and deliberately separate:
# bash super-gsd/install.sh --enable-autoapprove
# Restart Claude Code

# Set up project
/gsd-new-project         # or /gsd-new-milestone for existing projects

# Build everything
go                        # starts autonomous loop

# Check progress
/sgsd-orchestrate status   # where am I?
/sgsd-overwatcher scan     # visual signal map
/sgsd-token-audit --quick  # token spend

# Pause and resume
stop                      # or /sgsd-pause
continue                  # or /sgsd-resume

# Big decisions
/sgsd-deliberate new       # CEO/Board debate
```

---

*Super GSD v1.0 — Ship it.*
