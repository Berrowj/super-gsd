# Super GSD Orchestrator

Token-efficient, multi-agent autonomous orchestrator built on GSD 1.0.

## What's New Over GSD 1.0

| Feature | GSD 1.0 | Super GSD |
|---------|---------|-----------|
| Model routing | Single model | Opus orchestrates, Sonnet executes, Haiku classifies |
| Memory | Flat files, all load every session | ByteRover context tree, query-based, scored + decaying |
| Plan format | ~2,000 token prose | ~800 token compressed XML |
| Agent reports | Unbounded | 300 word max, structured format |
| Strategic decisions | Manual | CEO/Board deliberation (4 agents + adversarial debate) |
| Token tracking | None | Per-unit JSONL logging + audit skill |
| Script reuse | None | ByteRover script registry, query before create |
| Stuck detection | None | Hook tracks tool call patterns, warns on loops |
| Crash recovery | None | Checkpoint protocol, resume from last commit |
| Context loading | Full files | Frontmatter + brv-query (~80% token reduction) |

## Installation

### Prerequisites
- **Claude Code** on Max plan (no API keys — everything runs via OAuth)
- **GSD 1.0**: `npx get-shit-done-cc@latest`
- **Node.js** >= 20

### Quick Install

```bash
# Clone or download super-gsd/
cd your-project
bash super-gsd/install.sh
```

### Manual Install (step by step)

```bash
# 1. Install GSD 1.0 base (if not already installed)
npx get-shit-done-cc@latest

# 2. Install Super GSD agents (7 agents)
cp super-gsd/agents/*.md ~/.claude/agents/

# 3. Install Super GSD skills (8 slash commands)
for d in super-gsd/skills/gsd-*/; do
  name=$(basename "$d")
  mkdir -p ~/.claude/commands/$name
  cp "$d/SKILL.md" ~/.claude/commands/$name/
done

# 4. Install hooks (5 hooks)
cp super-gsd/hooks/*.js ~/.claude/hooks/

# 5. Install templates, workflows, overwatcher, config
mkdir -p ~/.claude/get-shit-done/templates/super-gsd/overwatcher
mkdir -p ~/.claude/get-shit-done/workflows
mkdir -p ~/.claude/get-shit-done/config
cp super-gsd/templates/* ~/.claude/get-shit-done/templates/super-gsd/
cp super-gsd/workflows/* ~/.claude/get-shit-done/workflows/
cp super-gsd/config/model-routing.json ~/.claude/get-shit-done/config/
cp super-gsd/overwatcher/*.js ~/.claude/get-shit-done/templates/super-gsd/overwatcher/

# 6. Set up ByteRover memory layer (API-free — no external LLM needed)
npm install -g byterover-cli
brv vc init
brv connectors install "Claude Code" --type mcp
# Remove the nested git repo ByteRover creates (we track it in project git)
rm -rf .brv/context-tree/.git .brv/context-tree/.gitignore

# 7. Seed the context tree with domain knowledge
mkdir -p .brv/context-tree/patterns .brv/context-tree/anti-patterns \
         .brv/context-tree/expertise .brv/context-tree/decisions \
         .brv/context-tree/error-rules .brv/context-tree/scripts \
         .brv/context-tree/domain
for f in super-gsd/brv-seed/domains/*.md; do
  name=$(basename "$f" .md)
  if echo "$name" | grep -q "anti-pattern"; then
    cp "$f" .brv/context-tree/anti-patterns/
  elif echo "$name" | grep -q "expertise\|deliberation"; then
    cp "$f" .brv/context-tree/expertise/
  else
    cp "$f" .brv/context-tree/patterns/
  fi
done

# 8. Install the local query engine (no API key required)
cp super-gsd/overwatcher/brv-query-local.js ~/.claude/hooks/

# 9. Initialize .planning/ for your project
mkdir -p .planning/{phases,metrics,briefs,decisions,deliberations,overwatcher}
cp super-gsd/config/planning-config-overlay.json .planning/config.json
touch .planning/metrics/token-log.jsonl

# 10. Add CLAUDE.md to your project
cp super-gsd/CLAUDE-OVERLAY.md CLAUDE.md
# Or append to existing: cat super-gsd/CLAUDE-OVERLAY.md >> CLAUDE.md

# 11. Add hooks to ~/.claude/settings.json (merge with existing)
# See "Hook Configuration" section below

# 12. Restart Claude Code to pick up MCP + new skills
```

### ByteRover Memory — How It Works (No API Keys)

Super GSD uses ByteRover's context tree structure (`.brv/context-tree/`) for
structured knowledge storage, but uses a **local query engine** instead of
ByteRover's LLM-powered curation pipeline. This means:

- **No external API keys needed** — works entirely on Claude Code Max plan
- **No per-query cost** — BM25 text search runs locally in ~0ms
- **No provider setup** — skip `brv providers connect`, you don't need it
- **Same file format** — standard markdown with YAML frontmatter (importance, tags, maturity)
- **Same directory structure** — `.brv/context-tree/{domain}/{topic}.md`

**To query knowledge** (orchestrator does this before each dispatch):
```bash
node ~/.claude/hooks/brv-query-local.js "dispatch rules autonomous loop" --max 3
```

**To add knowledge** (agents do this after execution — just write a file):
```bash
# No API call needed — just write markdown to the context tree
cat > .brv/context-tree/patterns/new-pattern.md << 'EOF'
---
title: New Pattern Name
tags: [pattern, domain]
keywords: [relevant, search, terms]
importance: 70
maturity: validated
---

## What it does
Description here.
EOF
```

The local query engine picks up new files immediately — no indexing step.

### Verify Installation

```bash
# Check agents installed
ls ~/.claude/agents/sgsd-*.md

# Check skills registered (restart Claude Code first)
# You should see: sgsd-orchestrate, sgsd-deliberate, sgsd-pause, sgsd-resume,
#   sgsd-token-audit, sgsd-brv-setup, sgsd-overwatcher, sgsd-transition

# Check hooks installed
ls ~/.claude/hooks/gsd-*.js ~/.claude/hooks/brv-query-local.js

# Test the query engine
node ~/.claude/hooks/brv-query-local.js "model routing opus sonnet"

# Check .planning/ initialized
ls .planning/STATE.md .planning/ROADMAP.md .planning/config.json

# Check context tree seeded
find .brv/context-tree/ -name "*.md" | wc -l
# Should show 9 files
```

## Files

```
super-gsd/
├── README.md                          # This file
├── CLAUDE-OVERLAY.md                  # Drop into project CLAUDE.md — teaches the engine
├── install.sh                         # One-command installation
│
├── agents/                            # 7 agent definitions
│   ├── sgsd-classifier.md              # Haiku: task complexity + model routing
│   ├── sgsd-context-selector.md        # Haiku: pick relevant context per task
│   ├── sgsd-ceo.md                     # Opus: deliberation orchestrator
│   ├── sgsd-board-architect.md             # Sonnet: technical feasibility
│   ├── sgsd-board-pragmatist.md            # Sonnet: execution risk
│   ├── sgsd-board-contrarian.md            # Sonnet: assumption stress-testing
│   └── sgsd-board-moonshot.md              # Sonnet: 10x alternatives
│
├── skills/                            # 7 slash commands
│   ├── sgsd-orchestrate/SKILL.md      # /sgsd-orchestrate — autonomous loop engine
│   ├── sgsd-deliberate/SKILL.md       # /sgsd-deliberate — CEO/Board decisions
│   ├── sgsd-transition/SKILL.md       # /sgsd-transition — migrate from Pi/GSD 2.0
│   ├── sgsd-token-audit/SKILL.md      # /sgsd-token-audit — usage analysis
│   ├── sgsd-brv-setup/SKILL.md        # /sgsd-brv-setup — ByteRover initialization
│   ├── sgsd-pause/SKILL.md            # /sgsd-pause — checkpoint + stop
│   └── sgsd-resume/SKILL.md           # /sgsd-resume — restore from checkpoint
│
├── workflows/                         # Engine internals
│   ├── orchestrate-loop.md            # The auto loop — step-by-step engine spec
│   ├── dispatch-table.md              # Quick reference: condition → agent → model
│   └── atc-gate.md                    # Quality gate: Haiku classifies, tier determines checks
│
├── templates/                         # 11 reusable formats
│   ├── compressed-plan.xml            # Token-efficient plan format (~800 tokens)
│   ├── agent-report-format.md         # 300-word structured report spec
│   ├── efficiency-header.xml          # 80-token rules injected into every agent
│   ├── executor-brv-overlay.xml       # ByteRover-aware executor injection
│   ├── planner-brv-overlay.xml        # ByteRover-aware planner injection
│   ├── verifier-brv-overlay.xml       # ByteRover-aware verifier injection
│   ├── orchestrator-prompt-composer.md# How to build agent prompts
│   ├── brief-template.md              # Deliberation brief template
│   ├── decision-memo.md               # Deliberation output format
│   ├── checkpoint.md                  # Context survival checkpoint format
│   └── token-log-entry.jsonl          # Token logging format
│
├── hooks/                             # 5 runtime hooks
│   ├── gsd-session-start.js           # SessionStart: checkpoint detection + resume briefing
│   ├── gsd-context-monitor.js         # PostToolUse: context % + elapsed time warnings
│   ├── gsd-token-logger.js            # PostToolUse: estimate + log token usage
│   ├── gsd-stuck-detector.js          # PostToolUse: detect tool call loops
│   └── gsd-checkpoint-writer.js       # PostToolUse: write checkpoint on git commit
│
├── config/                            # 3 config files
│   ├── model-routing.json             # Model selection per agent role
│   ├── settings-overlay.json          # Merge into ~/.claude/settings.json
│   └── planning-config-overlay.json   # Merge into .planning/config.json
│
└── brv-seed/                          # 9 ByteRover seed files
    ├── README.md                      # Setup instructions
    └── domains/
        ├── gsd-workflow-expertise.md
        ├── token-efficiency-expertise.md
        ├── orchestrator-patterns.md
        ├── cold-start-runbook.md
        ├── commit-discipline.md
        ├── script-registry-patterns.md
        ├── deliberation-expertise.md
        ├── model-routing-rules.md
        └── anti-patterns-premature-stopping.md
```

## Usage

```bash
# Autonomous mode — runs until done or exit condition
/sgsd-orchestrate go

# Execute one unit
/sgsd-orchestrate next

# Check position
/sgsd-orchestrate status

# Strategic decision
/sgsd-deliberate new
/sgsd-deliberate .planning/briefs/2026-04-08-architecture.md

# Token analysis
/sgsd-token-audit --quick
/sgsd-token-audit --full
/sgsd-token-audit --context-map

# Migrate from Pi/GSD 2.0
/sgsd-transition .gsd/
```

## Hook Configuration

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Agent",
        "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/gsd-token-logger.js", "timeout": 3 }]
      },
      {
        "matcher": "Bash|Edit|Write",
        "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/gsd-stuck-detector.js", "timeout": 3 }]
      },
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/gsd-checkpoint-writer.js", "timeout": 3 }]
      }
    ]
  }
}
```

## Post-install: patch gsd-tools KNOWN_TOP_LEVEL

After installing Super GSD, run this one-time patch so the 7 SGSD v2 top-level config
keys (`safety`, `model_routing`, `token_efficiency`, `deliberation`, `atc`,
`browser_verify`, `overwatcher`) no longer emit "unknown config key" warnings when
present in `.planning/config.json`.

```bash
bash super-gsd/scripts/patch-gsd-tools-known-keys.sh -y
```

**Note — separate repo:** `core.cjs` lives in the `~/.claude/get-shit-done/` repo, not
in your project repo. The script detects this automatically and prints the commit command
to run in that repo after patching:

```bash
cd ~/.claude && git add bin/lib/core.cjs && git commit -m 'feat: add SGSD v2 top-level keys to KNOWN_TOP_LEVEL'
```

The script is **idempotent** — running it twice is safe (second run exits 0 with
`ALREADY_PATCHED`). Use `--dry-run` to preview the diff without writing anything.

---

## Model Routing

| Role | Model | Cost Ratio | When |
|------|-------|-----------|------|
| Orchestrator | Opus | 1x | Always — lean state machine |
| CEO | Opus | 1x | /sgsd-deliberate only |
| Board members | Sonnet | 0.2x each | /sgsd-deliberate only |
| Researcher | Sonnet | 0.2x | Phase research |
| Planner | Sonnet | 0.2x | Plan creation |
| Executor | Sonnet | 0.2x | Code implementation |
| Verifier | Sonnet | 0.2x | Phase verification |
| Classifier | Haiku | 0.05x | Every dispatch |
| Context selector | Haiku | 0.05x | Every dispatch |

## Token Budget Per Unit

| Step | Tokens | Source |
|------|--------|--------|
| Read STATE.md frontmatter | ~200 | Direct read |
| Classify (Haiku) | ~50 | Agent call |
| Query ByteRover | ~100 | MCP tool |
| Compose prompt | ~500 | String build |
| Process report | ~300 | Parse response |
| State + commit | ~150 | Write + bash |
| Curate learning | ~50 | MCP tool |
| **Total per unit** | **~1,350** | |

vs GSD 1.0: ~5,000-10,000 tokens per unit (loads full files into context)
