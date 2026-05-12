# Super GSD

**Say "go" and it runs the SGSD orchestration loop.**

Super GSD is a token-efficient, multi-agent autonomous orchestrator for [Claude Code](https://claude.ai/code). It turns Claude from a helpful assistant into a controlled autonomous engineering loop that plans, dispatches Codex, runs checks, records evidence, and keeps moving.

Built on top of [GSD 1.0](https://github.com/gsd-build/get-shit-done) (68 skills, 24 agents). The current SGSD path uses Claude Code OAuth plus Codex CLI OAuth. It does not require Anthropic or OpenAI API keys for normal use.

---

## What This Repo Is For

Two distinct audiences read this README, and the difference matters:

- **Operator-build (this repo):** You are the SGSD developer / operator. You clone `Berrowj/super-gsd`, hack on the orchestrator + skills + tools, run the milestone-close gates, and ship the framework itself. The directory tree below (`super-gsd/scripts/`, `super-gsd/tools/`, `.planning/milestones/`) is the build surface. Everything in `examples/hello-world/` is a fixture you exercise as part of the v2.1 third-gate; it is not your project.
- **End-user-install:** Someone using SGSD on **their own** project. They run `install.sh --init-project` from inside their project directory; the installer copies the agents, skills, hooks, templates, and `CLAUDE-OVERLAY.md` into their workspace; they then say `go` and Claude builds their thing. They never edit anything inside `super-gsd/` -- that is library code.

If you are reading this from a fresh checkout of `Berrowj/super-gsd`, you are operator-build. If you are reading this from `super-gsd/README.md` symlinked into your own project's `node_modules` or `.claude/super-gsd/`, you are end-user-install. The Quick Start below covers the end-user-install path; the [Operator Build Workflow](#operator-build-workflow) section near the bottom covers the operator-build path.

---

## What It Does

```
You: "go"
Super GSD: *builds your entire project autonomously*
```

The orchestrator reads your project state, figures out what to do next, dispatches the right AI agent, processes the result, commits the code, and loops — until everything is done or you say stop.

### The Runtime Roles

| Role | Runtime | Does What |
|-------|---------|-----------|
| Orchestration | **Claude / Opus** | Reads `.planning/`, decides next step, composes prompts, synthesizes results, never authors executor code. |
| Planning | **Opus 4.7 / xhigh** | Produces and repairs phase plans from research, VTP status, and current repo state. |
| Research / plan-final review / code execution / Codex-owned gates | **Codex GPT-5.5 / xhigh** | Performs phase research, ATC + MUDA plan challenge, file-mutating executor work, per-dispatch ATC, phase-level ATC, and qualitative waste review. |
| Bounded non-code checks | **Sonnet / Haiku where still declared** | Verifier, checker, classifier, readiness, and enrichment roles only. Sonnet is not the code executor. |

For a new install, make sure both `claude` and `codex` are installed and logged in before expecting unattended automode to edit code.

### Key Features

| Feature | What It Means |
|---------|--------------|
| **Autonomous Loop** | Read → classify → dispatch → process → commit → loop. Runs until done. |
| **Checkpoint Survival** | Memory full? Saves its place, picks up next session. No lost work. |
| **Smart Memory** | Queries relevant knowledge per task (~200 tokens) instead of loading everything (~5,000 tokens). |
| **CEO/Board Deliberation** | Big decision? 4 AI agents debate it from different angles. Architect, Pragmatist, Contrarian, Moonshot. |
| **Quality Gates** | Every commit classified (skip/lite/full/gate) and reviewed at the right depth. |
| **Script Registry** | Already wrote that utility? The system finds and reuses it instead of recreating. |
| **Signal Map** | Interactive HTML visualization of your project — phases, dependencies, collisions. |
| **Token Tracking** | Per-unit logging. Know exactly where your tokens go. |
| **Codex Executor Lock** | Source-changing executor work runs through Codex GPT-5.5/xhigh, with read-pack patch fallback for Windows host read blocks. |
| **Stuck Detection** | Looping on the same error? Gets warned and tries a different approach. |
| **No API Keys** | Normal setup uses Claude Code and Codex CLI OAuth. Do not paste Anthropic/OpenAI API keys into SGSD setup. |

---

## Quick Start

### 1. Prerequisites

- **Claude Code** logged in with a plan that can run Opus - [get it here](https://claude.ai/code)
- **Node.js 22+** - [download](https://nodejs.org)
- **Git** - [download](https://git-scm.com)
- **Codex CLI** logged in. SGSD's current executor/gate path expects Codex:

```bash
npm install -g @openai/codex
codex login
codex login status
```

If Codex is missing, SGSD can still boot and show the cockpit, but source-changing automode is not friend-ready. Install/log in to Codex before asking SGSD to build unattended.

### 2. Install

```bash
# Clone the repo
git clone https://github.com/Berrowj/super-gsd.git
cd super-gsd

# Install local Node dependencies
npm install

# Install PowerShell shortcuts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force
```

For a fresh clone of this repository, those commands install dependencies and register the `sg`, `sgsd`, `sgsd-setup`, and `sgsd-watch-codex` PowerShell helpers. The checked-in repo already contains `super-gsd/`, `.planning/`, `CLAUDE.md`, `AGENTS.md`, and the Warp workflow files.

### 3. First-Run Setup Check

Open a new PowerShell window, then run:

```powershell
cd C:\path\to\super-gsd
sgsd-setup -NonInteractive
node .\super-gsd\scripts\sgsd-new-project-wizard.cjs --defaults
node .\super-gsd\scripts\sgsd-new-project-wizard.cjs --self-test
sg -FullPreflight -NoClaude
```

Expected wizard result:

```text
wizard_self_test: 13/13 assertions passed
```

VTP/private knowledge is optional. If setup asks for a private knowledge bank and you do not have one, leave it blank.

### 4. Go

```
go
```

That's it. Claude enters the SGSD loop, orchestrates the run, and dispatches Codex for the current code/research/gate surfaces.

### 5. (Optional) Install the `sg` shortcut

Once installed, you can boot the cockpit and Claude greeting from any directory with a one-letter shortcut:

```powershell
# One-time install (PowerShell)
powershell -File super-gsd/scripts/Install-SgsdShortcut.ps1
```

Then anywhere on the system:

```
sg            # boot cockpit dashboards + greet Claude in current terminal
sgsd          # boot cockpit only (preflight + 3 dashboards)
sgsd -Help    # show all flags
```

The bash fallback (macOS / Linux / Git Bash on Windows) prints the launch commands instead of opening windows directly:

```bash
bash super-gsd/scripts/sgsd-boot.sh --skip-preflight
# exit 0; prints SGSD1 / SGSD2 / SGSD3 launch lines
```

For an end-to-end first-run walkthrough including the new-project wizard and the example fixture, see [`super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md`](super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md) (11 steps, every command tested live, expected exit codes documented).

For the friend-safe "start here" setup wizard, see [`super-gsd/docs/SGSD-FRIEND-SETUP-WIZARD.md`](super-gsd/docs/SGSD-FRIEND-SETUP-WIZARD.md).

For the cockpit boot startup guide (preflight checks, dashboard layout, `sg` flag matrix), see [`super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md`](super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md).

---

## Commands

### Core

| Command | What It Does |
|---------|-------------|
| `go` | Start autonomous loop — builds everything |
| `/gsd-orchestrate next` | Do one thing, then stop |
| `/gsd-orchestrate status` | Where am I? What's next? |
| `stop` or `/gsd-pause` | Save progress and stop |
| `continue` or `/gsd-resume` | Pick up where I left off |

### Strategic

| Command | What It Does |
|---------|-------------|
| `/gsd-deliberate new` | Run a CEO/Board debate on a big decision |
| `/gsd-token-audit --quick` | Check token spend |
| `/gsd-overwatcher scan` | Generate project signal map |

### Project Lifecycle

| Command | What It Does |
|---------|-------------|
| `/gsd-new-project` | Initialize a new project |
| `/gsd-new-milestone` | Start next milestone/version |
| `/gsd-discuss-phase N` | Gather context for phase N |
| `/gsd-plan-phase N` | Create task plans |
| `/gsd-execute-phase N` | Execute all tasks |
| `/gsd-verify-work N` | Check if it actually works |
| `/gsd-autonomous` | Run all remaining phases |

### Migration

| Command | What It Does |
|---------|-------------|
| `/gsd-transition .gsd/` | Migrate from GSD 2.0 (Pi harness) |

Plus all **68 original GSD 1.0 commands** still work.

---

## Double-Agent Executor

SGSD now has a bounded execution router for tasks that do not need the full milestone ceremony.

For the main SGSD phase executor, the current contract is stricter: source-changing
work runs through `super-gsd/scripts/codex-executor.sh` with Codex GPT-5.5/xhigh.
The double-agent router below is still useful for bounded task capsules and
route evidence, but it is not permission for Claude/Sonnet to author executor
code in the SGSD orchestrator loop.

Instead of always sending every implementation task through Claude, SGSD can build a small **task capsule** and route the work:

```text
Task capsule
   |
   +-- deterministic extraction/inventory -> local-script
   +-- bounded code edit/refactor/test fix -> Codex, when healthy
   +-- ambiguous/high-risk/private context -> Claude
```

The goal is simple: use each worker for what it is best at.

| Worker | Best For | Why |
|--------|----------|-----|
| `local-script` | deterministic checks, inventory, schema validation | cheapest and exact |
| `codex` | bounded code edits, test repair, refactors, schema/config fixes | strong scoped code worker |
| `claude` | intent, architecture, ambiguity, private context, final judgment | best reasoning and operator-facing synthesis |

The contract is in [`super-gsd/tools/double-agent-executor/`](super-gsd/tools/double-agent-executor/):

- `task-capsule.schema.json` defines the execution surface.
- `run.cjs` routes and optionally executes the task.
- `scorecard.cjs` audits provider usage, fallbacks, accepted tasks, timeouts, scope violations, and estimated token movement.
- route evidence is written to `.planning/metrics/route-decisions.jsonl` with boundary `execution_route`.

Codex execution is sandboxed:

```text
task capsule -> temporary git worktree -> Codex workspace-write -> diff capture
             -> allowed_files check -> acceptance commands -> patch/report
```

It does **not** silently mutate the main worktree. Use `--apply` only when you want an accepted patch applied.

Smoke tests:

```bash
node super-gsd/tools/double-agent-executor/run.cjs --self-test
node super-gsd/tools/double-agent-executor/scorecard.cjs --self-test
node super-gsd/scripts/lib/route-ledger.cjs --self-test
```

Route-only example:

```bash
node super-gsd/tools/double-agent-executor/run.cjs \
  --capsule .planning/tasks/example-task.json \
  --route-only --json
```

Live bounded Codex execution, patch only:

```bash
node super-gsd/tools/double-agent-executor/run.cjs \
  --capsule .planning/tasks/example-task.json \
  --execute
```

Audit routing outcomes:

```bash
node super-gsd/tools/double-agent-executor/scorecard.cjs
```

---

## How The Loop Works

```
┌─────────────────────────────────────────────────────────┐
│                  ORCHESTRATOR (Opus)                      │
│                                                           │
│  1. Read STATE.md ──────── "Where am I?"                 │
│  2. Classify (Haiku) ──── "What kind of task?"           │
│  3. Query Memory ──────── "What do I know about this?"   │
│  4. Compose Prompt ────── Build agent instruction         │
│  5. Dispatch Codex ───── Research/review/code as needed  │
│  6. Process Report ───── Parse structured result         │
│  7. Curate Learnings ──── Save new patterns to memory    │
│  8. Quality Gate ──────── ATC check before commit         │
│  9. Git Commit ────────── Atomic, per task, always        │
│  10. Loop ─────────────── Read STATE.md again → repeat    │
│                                                           │
│  EXIT only for: all done | blocker/runtime fail | stop    │
└─────────────────────────────────────────────────────────┘
```

**Token budget per loop iteration: ~1,350 tokens** (vs 5,000-10,000 in GSD 1.0)

---

## The CEO/Board — Strategic Decisions

For big decisions that affect 3+ phases, Super GSD runs a multi-agent debate:

```
Brief (your question) → 4 Board Members debate → CEO synthesizes → Decision Memo
```

| Role | Perspective |
|------|-------------|
| **Architect** | "Can we build it? What breaks at scale?" |
| **Pragmatist** | "What's the simplest version that ships?" |
| **Contrarian** | "What assumption hasn't been tested?" |
| **Moonshot** | "Are we thinking too small?" |

The gate checks: does this decision affect 3+ phases? If not, it skips the debate and saves ~10,000 tokens.

---

## Memory System

Super GSD replaces flat file loading with **query-based knowledge retrieval**:

```
Old way: Load ALL 30 knowledge files = ~30,000 tokens wasted
New way: Query for relevant 3 results = ~600 tokens used
```

Knowledge lives in `.brv/context-tree/` as markdown files with scored metadata. The local BM25 search engine runs in <1ms with **no API key**.

Agents curate new patterns as they work — the knowledge base grows automatically.

---

## Permissions — Fully Autonomous

The installer automatically sets Claude Code to **never ask for permission** during autonomous mode:

```bash
# What the installer sets (you don't need to run this)
claude config set --global autoApprove "Bash,Read,Write,Edit,Glob,Grep,Agent"
```

To toggle:
```bash
# Disable auto-approve (back to asking)
claude config set --global autoApprove ""

# Re-enable
claude config set --global autoApprove "Bash,Read,Write,Edit,Glob,Grep,Agent"
```

---

## What's In The Box

```
super-gsd/
├── agents/          7 AI agent definitions
├── skills/          8 slash commands
├── hooks/           5 background automation scripts
├── templates/       11 reusable document formats
├── workflows/       4 engine specifications
├── config/          3 configuration files
├── brv-seed/        9 knowledge seed files
├── overwatcher/     Signal map visualization
├── install.sh       One-command installer
├── CLAUDE-OVERLAY.md   The orchestrator brain
├── USER-GUIDE.html     Complete HTML guide (open in browser)
├── USER-GUIDE.md       Same guide in markdown
└── README.md           Technical reference
```

**Total: 56 files. Zero external dependencies. Zero API keys.**

---

## Docs

- **[USER-GUIDE.html](super-gsd/USER-GUIDE.html)** — Complete guide from download to deploy. Open in your browser.
- **[ARCHITECTURE.html](super-gsd/docs/ARCHITECTURE.html)** — Full technical architecture blueprint (v1.1 + DLB-04 layer). Interactive Mermaid diagrams.
- **[ARCHITECTURE-v1.2.html](super-gsd/docs/ARCHITECTURE-v1.2.html)** — Deep dive on DLB-04 (resource substrate, SEPL, trajectory distillation with triple hallucination gate) + live v1.1 distillation results.
- **[super-gsd/README.md](super-gsd/README.md)** — Technical reference with file manifest

---

## DLB-04 — Self-Evolving Resource Substrate (v1.2)

After the `v1.1` close, the CEO/Board ran a 2-round deliberation on adopting the RSPL/SEPL patterns from *Autogenesis* (arXiv 2604.15034) and the trajectory-distillation pattern from *EvolveR* (arXiv 2510.16079). Decision: **3-1 ADOPT (narrow synthesis)**.

### What got added

| Wave | Component | Purpose |
|------|-----------|---------|
| **Day 0** | `sgsd-curate.sh` slug guard + installer smoke-test | Fixes FINDING-18 — no curation loop ships on a broken write-pipe. |
| **Wave A** | `sgsd-registry-sync.sh` + `agents.jsonl` | Scoped Agents resource manifest — one JSONL record per agent with sha/model/tools. |
| **Wave B** | `sgsd-sepl-propose.sh` + `sgsd-sepl-commit.sh` | Operator-gated propose→commit loop at resource grain. Never auto-commits. |
| **Wave C** | `sgsd-distill-milestone.sh` | Milestone-close Haiku extraction over phase trajectories (SUMMARY + VERIFICATION + WASTE). |

### Triple hallucination gate (stacked)

Three independent safeguards on the distillation pipeline — each proposed by a different board member, each targeting a different failure mode:

| # | Gate | Author | Target failure |
|---|------|--------|----------------|
| 1 | `type=trajectory-hypothesis` + classifier firewall | Architect | Premature surfacing of uncalibrated patterns into dispatch decisions |
| 2 | Two-phase-citation Haiku validation | Moonshot | Single-phase coincidences hallucinated as cross-cutting patterns |
| 3 | Operator novelty rating 1-3; median < 2/3 retires | Contrarian | The mechanism itself — obvious-lessons dressed as insights |

### Usage

```bash
# Rebuild the Agents registry from super-gsd/agents/
bash super-gsd/scripts/sgsd-registry-sync.sh

# Propose a resource-grain improvement (sub-agents emit these)
echo "append text" | bash super-gsd/scripts/sgsd-sepl-propose.sh \
  --type rule --target CLAUDE.md \
  --description "..." --rationale "..."

# Operator reviews + applies or rejects
bash super-gsd/scripts/sgsd-sepl-commit.sh .planning/proposals/<file>.md --apply

# At milestone close: distil trajectories → hypothesis tier (classifier-firewalled)
bash super-gsd/scripts/sgsd-distill-milestone.sh v1.1 --exclude-phase-type self-audit > prompt.txt
# orchestrator dispatches Haiku with prompt.txt → hypotheses.json
cat hypotheses.json | bash super-gsd/scripts/sgsd-distill-milestone.sh v1.1 --ingest

# Operator rates each hypothesis (Gate 3)
# On PowerShell, pipe the ratings since /dev/tty can't be reached:
printf '3\n2\n3\n3\n3\n2\n3\n' | bash super-gsd/scripts/sgsd-distill-milestone.sh v1.1 --rate
```

### Live v1.1 results

First production pass distilled phases 01-07 (self-audit excluded): **7 hypotheses** passed Gate 2 (≥2 phase citations) → `.brv/context-tree/trajectory-hypothesis/`; **3 singletons** quarantined → `candidate/`. Gate 3 rating pending operator input.

Full rationale + four DLB memos in [`.planning/decisions/`](.planning/decisions/).

---

## Starting the Cockpit

```powershell
# One-command boot — preflights + launches all 3 dashboards
bash super-gsd/scripts/sgsd-boot.sh
# or (Windows Terminal native):
powershell -File super-gsd/scripts/sgsd-boot.ps1
```

`sgsd-boot` runs a curate-pipe smoke test, refreshes the agents manifest, and opens the three live dashboards:

- **SGSD1** Mission Control — milestone progress, session cost, agent roster, DLB-04 one-liner
- **SGSD2** Narrative — Haiku-generated paragraph of what Claude is currently doing + live Ctrl+O tool stream
- **SGSD3** Gate Verdict — ATC + Browser + Nyquist + Security gates per phase + full DLB-04 substrate panel. The VTP/MCP projection panel is **optional**: if no VTP MCP server is configured, the panel renders an empty-state sentinel and the dashboard exits 0 (Phase 48 selective-VTP-bridge wires VTP as a route-gated whitelist; Phase 52 redis-adapter ships VTP-free as the canonical context-cache path).

Each dashboard auto-refreshes via FileSystemWatcher on the files it reads — no polling flicker.

---

## Optional Add-Ons

These integrations are **optional** -- SGSD ships and runs end-to-end without any of them. If your project benefits from one, opt in; otherwise the canonical path is VTP-free.

| Add-On | Status | When To Enable | Default Path Without It |
|--------|--------|----------------|-------------------------|
| **VTP / MCP bridge** | optional | Research / book / prior-project / architecture-challenge phases that need external validation. The Phase 48 selective-VTP-bridge ships a 4-entry frozen route whitelist (3 active + 1 reserved); local-impl phases NEVER call VTP. | Local-only knowledge resolution via ByteRover. The redis-adapter (Phase 52) is VTP-free and is the canonical context-cache path. |
| **Redis live cache** | optional | Multi-process cockpit runs that share context-bench across operators. | In-memory context-bench harness (Phase 51). Single-operator runs never need Redis. |
| **Codex panel** | optional | Operators who want a side-by-side Codex monitor in SGSD3. | The Gate Verdict dashboard renders without it; the Codex pane is an additive panel. |

The milestone-close gates (`sgsd-complete-milestone.cjs --milestone v1.9 / v2.0 / v2.1`) treat all three add-ons as optional: a missing MCP server, a missing Redis socket, or a missing Codex binary degrade gracefully via Lock 13 (skipped sentinel + exit 0) rather than blocking close.

---

## Operator Build Workflow

This section is for **operator-build** readers (you cloned `Berrowj/super-gsd` and are hacking on the framework itself). End-user-install readers can skip it.

```bash
# 1. Run the milestone-close gates (must all exit 0 before tagging a release)
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9   # dual-gate (context-bench + redis-adapter)
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0   # sept-gate (failure injection + chaos + provider-circuit + scenario-suite + release-readiness)
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1   # quad-gate (installer-audit + wizard + example-walkthrough + docs-refresh)

# 2. Exercise the example fixture (third-gate target; observation-only)
node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir examples/hello-world

# 3. Self-test the installer surface (12+ probes, ASCII-only, READ-ONLY invariant)
node super-gsd/tools/installer-audit/audit.cjs --self-test

# 4. Run the wizard self-test (13/13 assertions; deep-merge non-clobber + idempotent + Lock 13)
node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test
```

The example fixture under `examples/hello-world/` is the canonical wizard target; its `.planning/config.json` sha256 is anchored at `fe16729a...` and any drift in the wizard's `_buildProjectAdditions()` shape (panel reorder, schema bump, key rename) red-fails the v2.1 third-gate. See [`.planning/milestones/v2.1/`](./.planning/milestones/v2.1/) for the full milestone trail.

---

## Built With

- [Claude Code](https://claude.ai/code) — Anthropic's AI coding CLI
- [GSD 1.0](https://github.com/gsd-build/get-shit-done) — The foundation framework (68 skills, 24 agents)
- [ByteRover](https://github.com/campfirein/byterover-cli) — Context tree structure (local query engine, no API)

---

## Requirements

| Requirement | Details |
|-------------|---------|
| Claude Code | Max plan ($100-200/month) |
| Node.js | v22 or higher |
| Git | Any recent version |
| OS | Windows (WSL2), macOS, Linux |
| API keys | **None** — everything via Max plan OAuth |

---

## License

MIT

---

*Super GSD v1.0 — Ship it.*
