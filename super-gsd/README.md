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
- GSD 1.0: `npx get-shit-done-cc@latest`
- ByteRover: `npm install -g byterover-cli`
- Node.js >= 20

### Setup

```bash
# 1. Install GSD 1.0 base
npx get-shit-done-cc@latest

# 2. Install ByteRover + Claude Code connector
brv
brv connectors install "Claude Code" --type mcp

# 3. Copy Super GSD files
cp -r super-gsd/agents/*.md ~/.claude/agents/
cp -r super-gsd/skills/gsd-* ~/.claude/commands/
cp -r super-gsd/hooks/*.js ~/.claude/hooks/
cp -r super-gsd/templates/ ~/.claude/get-shit-done/templates/super-gsd/
cp super-gsd/config/model-routing.json ~/.claude/get-shit-done/config/

# 4. Seed ByteRover context tree
for f in super-gsd/brv-seed/domains/*.md; do
  brv curate --file "$f"
done

# 5. Add hooks to settings.json (see hooks section below)
```

## Files

```
super-gsd/
├── README.md                          # This file
├── CLAUDE-OVERLAY.md                  # Drop into project CLAUDE.md — teaches the engine
├── install.sh                         # One-command installation
│
├── agents/                            # 7 agent definitions
│   ├── gsd-classifier.md              # Haiku: task complexity + model routing
│   ├── gsd-context-selector.md        # Haiku: pick relevant context per task
│   ├── gsd-ceo.md                     # Opus: deliberation orchestrator
│   ├── board-architect.md             # Sonnet: technical feasibility
│   ├── board-pragmatist.md            # Sonnet: execution risk
│   ├── board-contrarian.md            # Sonnet: assumption stress-testing
│   └── board-moonshot.md              # Sonnet: 10x alternatives
│
├── skills/                            # 7 slash commands
│   ├── gsd-orchestrate/SKILL.md       # /gsd-orchestrate — autonomous loop engine
│   ├── gsd-deliberate/SKILL.md        # /gsd-deliberate — CEO/Board decisions
│   ├── gsd-transition/SKILL.md        # /gsd-transition — migrate from Pi/GSD 2.0
│   ├── gsd-token-audit/SKILL.md       # /gsd-token-audit — usage analysis
│   ├── gsd-brv-setup/SKILL.md         # /gsd-brv-setup — ByteRover initialization
│   ├── gsd-pause/SKILL.md             # /gsd-pause — checkpoint + stop
│   └── gsd-resume/SKILL.md            # /gsd-resume — restore from checkpoint
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
/gsd-orchestrate go

# Execute one unit
/gsd-orchestrate next

# Check position
/gsd-orchestrate status

# Strategic decision
/gsd-deliberate new
/gsd-deliberate .planning/briefs/2026-04-08-architecture.md

# Token analysis
/gsd-token-audit --quick
/gsd-token-audit --full
/gsd-token-audit --context-map

# Migrate from Pi/GSD 2.0
/gsd-transition .gsd/
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

## Model Routing

| Role | Model | Cost Ratio | When |
|------|-------|-----------|------|
| Orchestrator | Opus | 1x | Always — lean state machine |
| CEO | Opus | 1x | /gsd-deliberate only |
| Board members | Sonnet | 0.2x each | /gsd-deliberate only |
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
