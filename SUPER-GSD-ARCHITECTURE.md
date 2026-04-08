# Super GSD Orchestrator — Architecture Blueprint

> **Date**: 2026-04-08
> **Base**: GSD 1.0 (get-shit-done-cc)
> **Goal**: Token-efficient, multi-agent autonomous orchestrator with strategic decision-making

---

## 1. Design Principles

### Token Efficiency Is The Architecture

Every design decision optimizes for token spend. This isn't a feature bolted on — it's the load-bearing constraint.

| Principle | Implementation |
|-----------|---------------|
| Right model for right task | Opus orchestrates, Sonnet plans/reviews, Haiku classifies/tags |
| Query don't load | ByteRover `brv-query` replaces loading full .md files into context |
| Structured output over prose | XML/JSON task plans, not paragraphs — more info, fewer tokens |
| Sub-agent reports capped | <300 words per agent return — orchestrator stays lean |
| Compress chat history | Checkpoint files replace full conversation replay |
| No preamble, no recap | Agent prompts say "No intro. No summary. Output only." |
| Batch related work | Wave-based parallel execution shares system prompt cost across agents |
| Preprocess inputs | Strip boilerplate before injecting into agent prompts |

### Model Routing Table

| Role | Model | Why | Est. Cost Ratio |
|------|-------|-----|-----------------|
| Orchestrator (main loop) | **Opus** | Judgment, synthesis, dispatch decisions | 1x (baseline) |
| CEO deliberation | **Opus** | Strategic synthesis across board positions | 1x |
| Board members (4) | **Sonnet** | Focused domain analysis, structured output | 0.2x each |
| Phase researcher | **Sonnet** | Domain investigation, web search | 0.2x |
| Planner | **Sonnet** | Task decomposition from clear context | 0.2x |
| Plan checker | **Sonnet** | Verification against requirements | 0.2x |
| Executor | **Sonnet** | Code implementation from detailed plan | 0.2x |
| Verifier | **Sonnet** | Test execution, evidence collection | 0.2x |
| Code reviewer | **Sonnet** | Pattern matching, bug detection | 0.2x |
| Classifier/tagger | **Haiku** | Task complexity scoring, intent routing | 0.05x |
| Context selector | **Haiku** | Pick which files to load for a task | 0.05x |
| Commit message writer | **Haiku** | Structured commit from diff | 0.05x |
| Stuck detector | **Haiku** | Pattern match on last N tool calls | 0.05x |
| Archive/decay scorer | **Haiku** | Score knowledge file relevance | 0.05x |

---

## 2. System Layers

```
                    +-----------------------------------------+
                    |        /gsd-deliberate (CEO/Board)       |  Strategic Layer
                    |  Brief -> Debate -> Decision Memo        |  (Opus + 4x Sonnet)
                    +-------------------+---------------------+
                                        |
                    +-------------------v---------------------+
                    |      SUPER GSD ORCHESTRATOR              |  Orchestration Layer
                    |  Read State -> Classify -> Dispatch      |  (Opus — lean state machine)
                    |  -> Process -> Commit -> Loop            |
                    +---+------+------+------+------+---------+
                        |      |      |      |      |
                   +----v+ +---v--+ +-v----+ +v---+ +v--------+
                   |Rsrch| |Plan  | |Exec  | |Vrfy| |Review   |  Execution Layer
                   |     | |+Chk  | |      | |    | |+Fix     |  (Sonnet per agent)
                   +-----+ +------+ +------+ +----+ +---------+
                        |      |      |      |      |
                    +---v------v------v------v------v---------+
                    |         ByteRover Context Tree           |  Memory Layer
                    |  .brv/context-tree/ + brv-query/curate   |  (Haiku for scoring)
                    |  Selective loading, decay, archival      |
                    +---+------+------+------+------+---------+
                        |      |      |      |      |
                    +---v------v------v------v------v---------+
                    |         .planning/ State Machine          |  State Layer
                    |  STATE.md, ROADMAP.md, CONTEXT.md         |  (GSD 1.0 native)
                    |  config.json, phases/NN-*/                |
                    +-----------------------------------------+
                        |                              |
                    +---v-----------+    +-------------v------+
                    | ATC Quality   |    | Mission Control    |  Quality + Monitoring
                    | 7-step gate   |    | tmux dashboard     |
                    +---------------+    +--------------------+
```

---

## 3. The Orchestrator Loop (Token-Optimized)

The orchestrator is an Opus-powered lean state machine. It NEVER does heavy work itself. It reads, decides, dispatches, processes, commits, loops.

### Loop Steps

```
1. READ STATE        (~200 tokens)   Read .planning/STATE.md frontmatter only
2. CLASSIFY          (~50 tokens)    Haiku: what type of work is next?
3. QUERY CONTEXT     (~100 tokens)   brv-query: get relevant knowledge for this task
4. COMPOSE PROMPT    (~500 tokens)   Build sub-agent prompt with:
                                      - Task plan (XML, compressed)
                                      - Relevant decisions (from brv-query, not full file)
                                      - Relevant patterns (from brv-query)
                                      - Output format spec
                                      - "No intro. No summary. Report format only."
5. DISPATCH          (sub-agent)     Agent(model: "sonnet", prompt: composed)
6. PROCESS RESULT    (~300 tokens)   Parse <300 word structured report
7. CURATE LEARNING   (~50 tokens)    brv-curate any new pattern/decision/failure
8. UPDATE STATE      (~100 tokens)   Write STATE.md, mark phase progress
9. GIT COMMIT        (~50 tokens)    Atomic commit per unit
10. LOOP             (read STATE.md = tool call = loop continues)
```

**Orchestrator budget per unit: ~1,350 tokens + sub-agent cost**
Compare to GSD 1.0 current: ~5,000-10,000 tokens (loads full CONTEXT.md, DECISIONS.md, ROADMAP.md etc.)

### Exit Conditions (4 only)

1. All phases complete
2. Context >70% (write checkpoint, stop)
3. Blocker requiring human input
4. User says stop/pause

### The Golden Rule

Every response includes a tool call. Text-only = loop breaks.
`"Phase 27 complete"` + `[Read STATE.md]` = loop continues.
`"Phase 27 complete!"` alone = loop dies.

---

## 4. ByteRover Integration — The Memory Layer

### Context Tree Structure for GSD

```
.brv/context-tree/
├── decisions/                    # From .planning/ decisions + deliberation memos
│   ├── architecture/
│   │   └── monorepo-choice.md    # importance:85, maturity:core
│   ├── api-design/
│   │   └── rest-over-graphql.md  # importance:72, maturity:validated
│   └── ...
├── patterns/                     # Proven implementation patterns
│   ├── database/
│   │   └── prisma-migrations.md  # importance:90, maturity:core
│   ├── testing/
│   │   └── integration-over-mocks.md
│   └── ...
├── anti-patterns/                # Failures learned the hard way
│   ├── never-mock-db.md          # importance:95, maturity:core
│   ├── no-barrel-exports.md
│   └── ...
├── domain/                       # Business domain knowledge
│   ├── procurement/
│   │   ├── sku-taxonomy.md
│   │   └── supplier-classification.md
│   ├── pipeline/
│   │   └── pricing-wiring.md
│   └── ...
├── error-rules/                  # ERR-0001 through ERR-NNNN
│   ├── err-0001-windows-paths.md # importance:98, maturity:core
│   ├── err-0015-prisma-generate.md
│   └── ...
├── expertise/                    # Domain expertise files for board members
│   ├── gsd-workflow.md
│   ├── vtp-processing.md
│   └── jcl-procurement.md
└── project-state/                # Current project intelligence
    ├── tech-stack.md
    ├── conventions.md
    └── integrations.md
```

### How Agents Use ByteRover

**Before dispatching a sub-agent (orchestrator does this):**
```
brv-query "prisma migration patterns for adding NOT NULL column"
→ Returns: 2 relevant knowledge files, ~400 tokens total
→ Inject into agent prompt (instead of loading full 5KB DECISIONS.md)
```

**After sub-agent completes (orchestrator does this):**
```
brv-curate "Learned: always run prisma generate before prisma migrate"
  domain: patterns/database
  importance: 70
  tags: [prisma, migration, build-step]
```

**Key rules:**
- Orchestrator NEVER reads full .md files from .planning/ into context
- Orchestrator queries ByteRover for relevant chunks only
- Sub-agents curate learnings back into ByteRover via structured report
- Haiku scores and routes curation (classify domain, set initial importance)
- Decay + archival handle staleness automatically

### Migration from Flat Memory

| Current (flat files in ~/.claude/projects/*/memory/) | Super GSD (ByteRover) |
|------------------------------------------------------|----------------------|
| All files load every session (~15-30KB) | Query returns ~400-800 tokens per task |
| No scoring, no decay | importance/recency/maturity lifecycle |
| No archival — grows forever | Auto-archive at importance <35 |
| No domain organization | Hierarchical domain/topic/subtopic |
| Manual curation by user | Agents curate as they work |

---

## 5. Sub-Agent Task Plan Format (Token-Optimized)

GSD 1.0 uses XML task plans. We keep XML but compress hard — every token must justify itself.

### Current GSD 1.0 Plan (~2,000 tokens)

```xml
<objective>Implement user authentication middleware...</objective>
<execution_context>
  <project_state>We're building a Next.js app with Prisma...</project_state>
  <recent_decisions>D001: Use JWT not sessions...</recent_decisions>
</execution_context>
<context>
  <existing_code>Currently there's no auth...</existing_code>
</context>
<tasks>
  <task type="auto">
    <name>Create auth middleware</name>
    <files>src/middleware/auth.ts, src/lib/jwt.ts</files>
    <action>Create JWT verification middleware that...</action>
    <verify>Import resolves, middleware exports verifyToken</verify>
    <done>File exists with correct exports</done>
  </task>
  ...
</tasks>
```

### Super GSD Plan (~800 tokens, same information density)

```xml
<plan phase="27" task="01" model="sonnet">
<goal>Auth middleware — JWT verification + route protection</goal>
<files>src/middleware/auth.ts, src/lib/jwt.ts</files>
<steps>
  <s>Create src/lib/jwt.ts: sign(payload,secret)->token, verify(token,secret)->payload. Use jsonwebtoken pkg.</s>
  <s>Create src/middleware/auth.ts: export verifyToken(req,res,next). Extract Bearer token, verify, attach req.user, call next(). 401 on failure.</s>
  <s>Add JWT_SECRET to .env.example (not .env).</s>
</steps>
<verify>
  <v cmd="npx tsc --noEmit" expect="exit 0"/>
  <v cmd="grep -q 'verifyToken' src/middleware/auth.ts" expect="exit 0"/>
</verify>
<context>
  <d>D001: JWT not sessions — 24h expiry, refresh via /auth/refresh</d>
  <p>Pattern: all middleware in src/middleware/, named exports only</p>
</context>
<rules>No intro. No summary. Code + verify commands only. Report: FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, ONE_LINER.</rules>
</plan>
```

**60% token reduction, same execution quality** — because Sonnet follows structured XML better than prose.

---

## 6. Token Tracking System

### Per-Unit Tracking

Every orchestrator loop iteration logs:

```yaml
# .planning/metrics/token-log.jsonl (append-only)
{"ts":"2026-04-08T14:23:00Z","phase":27,"task":1,"model":"sonnet","role":"executor","est_input":1200,"est_output":800,"total":2000}
{"ts":"2026-04-08T14:24:00Z","phase":27,"task":1,"model":"opus","role":"orchestrator","est_input":400,"est_output":200,"total":600}
```

### Dashboard (generated on demand, not loaded every session)

```markdown
# Token Usage — Last 5 Sessions

| Session | Date | Units | Opus | Sonnet | Haiku | Est. Total |
|---------|------|-------|------|--------|-------|------------|
| S001 | 04-08 | 12 | 8.2K | 24.1K | 1.2K | 33.5K |
| S002 | 04-07 | 8 | 5.1K | 18.3K | 0.8K | 24.2K |

## By Role
| Role | Avg Tokens/Unit | Model |
|------|----------------|-------|
| Orchestrator | 600 | Opus |
| Executor | 2,000 | Sonnet |
| Planner | 1,500 | Sonnet |
| Classifier | 100 | Haiku |

## Context Cost (loaded .md files)
| File | Tokens | Loaded When |
|------|--------|-------------|
| STATE.md frontmatter | ~200 | Every loop |
| ROADMAP.md | ~800 | Phase transitions |
| brv-query results | ~400 | Per dispatch |
```

### Audit (periodic, not cron — triggered by /gsd-token-audit)

The audit skill:
1. Reads token-log.jsonl
2. Identifies: which agents cost most, which phases burned most tokens, context waste
3. Suggests: model downgrades for simple tasks, prompt compression opportunities
4. Writes: .planning/metrics/TOKEN-AUDIT.md

---

## 7. Deliberation Layer (CEO/Board)

Sits BETWEEN discuss-phase and plan-phase. Only triggers for high-stakes decisions.

### Token Budget Per Deliberation

| Component | Model | Est. Tokens | Notes |
|-----------|-------|-------------|-------|
| Brief validation | Opus (orchestrator) | 500 | Parse brief, check sections |
| Context query | brv-query | 400 | Relevant decisions/expertise |
| Board member x4 | Sonnet x4 | 2,000 x4 = 8,000 | Parallel, structured output |
| Round 2 (if needed) | Sonnet x4 | 1,500 x4 = 6,000 | With all positions visible |
| CEO synthesis | Opus | 1,500 | Write decision memo |
| **Total (1 round)** | | **~10,400** | |
| **Total (2 rounds)** | | **~16,400** | |

This is expensive — which is why it only triggers for milestone/architecture decisions, not per-phase.

### Activation Gate (Haiku classifier)

Before deliberation, Haiku scores the decision:
- Affects 3+ phases? → deliberate
- Architecture change? → deliberate
- Budget > $X? → deliberate
- Single-phase feature? → skip, normal plan-phase
- Bug fix? → skip entirely

Cost of gate: ~100 tokens. Saves 10,000+ tokens when skipped.

---

## 8. Quality Layer (ATC) — Token-Aware

### Change Classification (determines ATC depth)

| Tier | Trigger | ATC Steps | Token Cost |
|------|---------|-----------|------------|
| SKIP | <10 lines, 1 file | None | 0 |
| LITE | 10-50 lines, ≤3 files | Delete + Simplify | ~500 |
| FULL | 50+ lines, 4+ files | All 7 steps | ~2,000 |
| GATE | Architecture/API/deps | All + deliberation | ~12,000+ |

Haiku classifies the change tier. Most changes are SKIP or LITE.

---

## 9. Transition Command (/gsd-transition)

For users migrating from Pi/GSD 2.0. One-time command that:

1. Reads `.gsd/DECISIONS.md` → curates into ByteRover `decisions/` domain
2. Reads `.gsd/KNOWLEDGE.md` → curates into ByteRover `patterns/` + `anti-patterns/`
3. Reads `.gsd/REQUIREMENTS.md` → merges into `.planning/REQUIREMENTS.md`
4. Maps `.gsd/milestones/` work → phases in `.planning/ROADMAP.md`
5. Marks completed work as `[x]`
6. Writes migration report

Token cost: one-time ~5,000 tokens. Saves loading 120+ decisions every session forever after.

---

## 10. File Manifest — What We're Building

### New Skills (`.claude/commands/`)

| Skill | Purpose | Model |
|-------|---------|-------|
| `gsd-deliberate` | CEO/Board strategic decisions | Opus + 4x Sonnet |
| `gsd-transition` | Migrate from Pi/GSD 2.0 | Sonnet |
| `gsd-token-audit` | Token usage analysis + optimization suggestions | Haiku |
| `gsd-orchestrate` | Enhanced autonomous loop with token tracking | Opus |

### New Agents (`.claude/agents/`)

| Agent | Purpose | Model |
|-------|---------|-------|
| `gsd-ceo` | Deliberation orchestrator | Opus |
| `board-architect` | Technical feasibility analysis | Sonnet |
| `board-pragmatist` | Execution risk assessment | Sonnet |
| `board-contrarian` | Assumption stress-testing | Sonnet |
| `board-moonshot` | 10x alternative thinking | Sonnet |
| `gsd-classifier` | Task complexity + routing | Haiku |
| `gsd-context-selector` | Pick relevant files for a task | Haiku |

### New Directories (`.planning/`)

```
.planning/
├── briefs/                  # Decision inputs
│   └── BRIEF-TEMPLATE.md
├── deliberations/           # Debate logs
├── decisions/               # Decision memos (DLB-NN-slug.md)
└── metrics/                 # Token tracking
    ├── token-log.jsonl      # Append-only per-unit log
    └── TOKEN-AUDIT.md       # Periodic analysis
```

### ByteRover Setup

```
.brv/context-tree/
├── decisions/
├── patterns/
├── anti-patterns/
├── domain/
├── error-rules/
├── expertise/
└── project-state/
```

### Modified Skills (from GSD 1.0)

| Skill | Change |
|-------|--------|
| `gsd-execute-phase` | Add model routing, compressed XML plans, brv-query context injection, token logging |
| `gsd-discuss-phase` | Add deliberation gate check |
| `gsd-autonomous` | Replace with `gsd-orchestrate` — full auto loop with checkpoints |
| `gsd-plan-phase` | Compress plan output format, add brv-query for relevant decisions |

---

## 11. Implementation Order

### Phase 1: Token Foundation (build first — everything depends on this)
1. Token logging system (token-log.jsonl format + write helper)
2. Model routing table in config.json
3. Compressed XML plan format
4. Sub-agent report format (<300 words, structured)

### Phase 2: Memory Layer (ByteRover integration)
1. Install ByteRover, configure MCP for Claude Code
2. Design context tree domains
3. Migrate existing memory files → ByteRover curated knowledge
4. Wire brv-query into orchestrator dispatch
5. Wire brv-curate into agent post-processing

### Phase 3: Orchestrator Engine
1. Build gsd-orchestrate skill (lean auto loop)
2. Checkpoint protocol (read/write ORCHESTRATOR-CHECKPOINT.md)
3. Dispatch rules (first-match table)
4. Tool-call chaining enforcement
5. Context survival across sessions

### Phase 4: Deliberation Layer
1. Brief template + validation
2. Board member agents (4)
3. CEO agent
4. /gsd-deliberate skill
5. Deliberation gate (Haiku classifier)

### Phase 5: Quality + Monitoring
1. ATC integration (change classification via Haiku)
2. Mission Control dashboard updates
3. /gsd-token-audit skill
4. /gsd-transition command

---

## 12. Script Registry — Reuse Before Rewrite

### The Problem

Agents write utility scripts, hooks, migration scripts, test helpers — then the next agent writes a near-identical one because it doesn't know the first exists. This wastes tokens AND introduces inconsistency.

### The Solution: Script Registry in ByteRover

Every script written by any agent gets curated into `.brv/context-tree/scripts/`:

```
.brv/context-tree/scripts/
├── hooks/
│   ├── pre-commit-lint.md          # Shell: runs eslint on staged files
│   ├── post-commit-state-update.md # Node: updates STATE.md after commit
│   └── context-monitor.md          # Node: warns on context >70%
├── migrations/
│   ├── prisma-add-column.md        # Pattern: add nullable, backfill, make required
│   └── prisma-rename-field.md      # Pattern: shadow field, migrate data, drop old
├── test-helpers/
│   ├── mock-api-response.md        # TS: createMockResponse(status, body)
│   └── test-db-setup.md            # TS: setupTestDb(), teardownTestDb()
├── build/
│   ├── docker-compose-dev.md       # Docker: dev environment with hot reload
│   └── ci-pipeline.md              # GH Actions: test -> lint -> build -> deploy
└── utilities/
    ├── retry-with-backoff.md        # TS: retryWithBackoff(fn, maxRetries, baseDelay)
    ├── batch-processor.md           # TS: processBatch(items, batchSize, fn)
    └── csv-parser.md               # Node: parseCSV(filePath, options)
```

### Knowledge File Format for Scripts

```markdown
---
title: Retry with Exponential Backoff
tags: [utility, async, error-handling]
keywords: [retry, backoff, exponential, resilience]
related:
  - "scripts/utilities/batch-processor"
  - "patterns/error-handling/graceful-degradation"
importance: 78
maturity: core
language: typescript
location: src/lib/utils/retry.ts
hash: a1b2c3d4
---

## Purpose
Generic async retry with exponential backoff + jitter.

## Interface
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; baseDelay?: number; maxDelay?: number }
): Promise<T>
```

## Usage
```typescript
const result = await retryWithBackoff(() => fetch(url), { maxRetries: 3 });
```

## Key Details
- Jitter: random 0-50% added to delay to prevent thundering herd
- Default: 3 retries, 1s base, 30s max
- Throws original error after exhausting retries
```

### How It Works in the Loop

**Before an agent writes a new utility:**
```
Orchestrator: brv-query "retry with backoff utility typescript"
→ Hit: scripts/utilities/retry-with-backoff.md (importance: 78)
→ Inject into agent prompt: "EXISTING: src/lib/utils/retry.ts — import and use, do not recreate"
```

**After an agent writes a new script:**
```
Orchestrator: brv-curate the script metadata
→ Domain: scripts/{category}
→ Include: purpose, interface, location, language, hash
→ Agent prompt: "If you created any new utility functions, report them in your ONE_LINER"
```

**Staleness detection:**
- `hash` field tracks file content hash
- On query hit, Haiku checks if file still exists at `location` and hash matches
- If moved/deleted/changed: update or archive the registry entry
- Cost: ~50 tokens per check via Haiku

### Rules

- **Always query before creating** — if a 70%+ match exists, use or extend it
- **Must be exact fit** — don't force-fit a utility that almost works. If the existing script needs >30% modification to fit, write a new one and curate it
- **Keep the registry honest** — if a script is used 0 times in 30 days, decay drops importance, eventually archived to stub
- **Location is truth** — the registry points to the actual file. If the file is gone, the registry entry is stale

---

## 13. Token Efficiency Rules (Baked Into Every Agent Prompt)

These rules are injected into EVERY sub-agent prompt as a compressed header:

```xml
<rules>
No intro. No recap. No preamble. Output format only.
Report: FILES_CHANGED | VERIFICATION | DEVIATIONS | BLOCKERS | ONE_LINER
Max 300 words. Structured XML/lists over prose.
Do not restate the task. Do not explain what you will do. Just do it.
If reading files, read only the sections you need (offset/limit).
If searching, use Grep not cat|grep. Use Glob not find.
Commit message: feat(PHASE): one-liner. No body unless deviation.
</rules>
```

**Est. cost of rules header: ~80 tokens. Est. savings per agent: ~500-1,500 tokens.**
