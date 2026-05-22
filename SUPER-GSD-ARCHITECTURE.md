# Super GSD Orchestrator — Architecture Blueprint

> **Original date**: 2026-04-08 (GSD 1.0 base)
> **Current as of**: 2026-05-22 — v3.2 SHIPPED (Operator Comprehension System)
> **Base**: GSD 1.0 (get-shit-done-cc)
> **Goal**: A typed, auditable autonomous software-delivery engine — a stateful
> orchestrator that never writes code, and a stateless execution fabric that does
> the bounded work one locked plan at a time, with nothing reaching the main
> branch without re-checkable evidence.

> **What changed since the 2026-04-08 blueprint.** The original design routed
> Opus→Sonnet→Haiku across orchestration / execution / classification, and used
> ByteRover (`.brv/context-tree/`) as the memory tier. Both are obsolete. The
> current architecture (locked through milestones v3.0–v3.2) is:
>
> - **Claude / Opus 4.7 orchestrates ONLY** — judgment, dispatch, synthesis,
>   state, gates, memory, promotion. It never writes code.
> - **Codex GPT-5.5 at xhigh reasoning effort is the execution fabric** — all
>   research, planning, plan-check, source-changing execution, verification,
>   spec-compliance review, ATC, and gate work. Dispatched through
>   `super-gsd/scripts/codex-executor.sh` / `codex-exec.sh`.
> - **Sonnet / Haiku are not default providers.** The legacy Claude worker agent
>   files are disabled for code execution and are not Codex fallbacks.
> - **Memory is a project-local filesystem tier** at `.planning/memory/`
>   (a `MEMORY.md` index + typed entries) with `sgsd-recall` / `sgsd-curate`
>   shell wrappers — ByteRover is removed. v3.0 added **Mesh Memory Lite**
>   (DLB-08), a role-filtered cognitive memory ledger on top.
>
> Sections below have been brought current. Where a section still discusses the
> old provider model in a historical example, it is labelled as history.

---

## 1. Design Principles

### Two Planes, One Rule

The load-bearing architectural rule:

> **The control plane and the execution fabric are two different things.**
> A stateful orchestrator (Claude / Opus) owns state, gates, memory, and
> promotion. A stateless executor (Codex GPT-5.5) does the bounded code work,
> one locked plan at a time. Nothing reaches the main branch without evidence a
> human or a deterministic gate can re-check.

### Token Efficiency Is Still The Architecture

Every design decision optimizes for orchestrator token spend. This isn't a
feature bolted on — it's a load-bearing constraint that sits underneath the
two-plane rule.

| Principle | Implementation |
|-----------|---------------|
| Split control from execution | Opus orchestrates and never writes code; Codex GPT-5.5/xhigh does the bounded work |
| Query don't load | `sgsd-recall` over `.planning/memory/` replaces loading full .md files into context |
| Structured output over prose | XML/JSON task plans, not paragraphs — more info, fewer tokens |
| Sub-agent reports capped | <300 words per agent return — orchestrator stays lean |
| Compress chat history | Checkpoint + external `.planning/` state replace full conversation replay |
| No preamble, no recap | Agent prompts say "No intro. No summary. Output only." |
| Earned execution | Every executor run is rated GREEN/AMBER/RED before it touches a file |
| Preprocess inputs | Strip boilerplate before injecting into agent prompts |

### Model Routing Table (current — v3.0+)

| Role | Provider | Why |
|------|----------|-----|
| Orchestrator (main loop) | **Claude / Opus 4.7, xhigh** | Judgment, synthesis, dispatch decisions, state, gates, promotion. Never writes code. |
| CEO deliberation | **Claude / Opus 4.7, xhigh** | Strategic synthesis across board positions |
| Board members | **Claude / Opus 4.7, xhigh** | Default fresh-clone board is Opus-only: CEO + Architect + Contrarian |
| Phase researcher | **Codex GPT-5.5, xhigh** | Read-only research report via the SGSD Codex wrapper |
| Planner | **Codex GPT-5.5, xhigh** | Plan synthesis and repair |
| Plan checker / plan-final ATC | **Codex GPT-5.5, xhigh** | Gap detection + fast ATC + MUDA challenge before execution |
| Executor | **Codex GPT-5.5, xhigh** | Source-changing code work; serial SDD implementer run; patch mode on Windows read-blocks |
| Spec-compliance reviewer | **Codex GPT-5.5, xhigh** | Independent review of raw PLAN, diff, executor report, verification |
| Verifier / readiness / gates | **Codex GPT-5.5, xhigh** | Verification, readiness, ATC, MUDA, plan-check |
| Classifier / context selection | **Codex / local deterministic** | Derived from plan frontmatter/cache or a Codex/local check — not an Opus call |
| Legacy Claude workers (Sonnet/Haiku) | **disabled** | Not a default provider; not a Codex fallback |

> The 10 typed Codex lanes and the GREEN/AMBER/RED stoplight that route these
> dispatches are **Codex Pro Mode** — see §13.

---

## 2. System Layers

```
                    +-----------------------------------------+
                    |       /sgsd-deliberate (CEO/Board)       |  Strategic Layer
                    |  Brief -> Debate -> Decision Memo        |  (Opus 4.7 — CEO +
                    +-------------------+---------------------+   Architect + Contrarian)
                                        |
                    +-------------------v---------------------+
                    |      SUPER GSD ORCHESTRATOR              |  Control Plane
                    |  Read State -> Classify -> Dispatch      |  (Claude / Opus 4.7 —
                    |  -> Process -> Review -> Commit -> Loop  |   lean state machine,
                    |  Earned-execution stoplight GREEN/AMBER/RED |   never writes code)
                    +---+------+------+------+------+---------+
                        |      |      |      |      |
                   +----v+ +---v--+ +-v----+ +v---+ +v--------+
                   |Rsrch| |Plan  | |Exec  | |Vrfy| |Spec+ATC |  Execution Fabric
                   |     | |+Chk  | |patch | |    | |Review   |  (Codex GPT-5.5/xhigh
                   +-----+ +------+ +------+ +----+ +---------+   via codex-executor.sh
                        |      |      |      |      |             — 10 typed lanes)
                    +---v------v------v------v------v---------+
                    |   Mesh Memory Lite  +  .planning/memory/ |  Memory Layer
                    |  cmbs.jsonl ledger (7 CMB classes,        |  (DLB-08 + DLB-01;
                    |  lineage DAG, echo detection)             |   ByteRover removed)
                    |  MEMORY.md index + sgsd-recall/curate     |
                    +---+------+------+------+------+---------+
                        |      |      |      |      |
                    +---v------v------v------v------v---------+
                    |         .planning/ State Machine          |  State Layer
                    |  STATE.md, ROADMAP.md, CONTEXT.md         |
                    |  config.json, milestones/{v}/phases/NN-*/ |
                    |  decisions/DLB-*.md, mesh/memory/         |
                    +-----------------------------------------+
                        |              |                  |
                    +---v------+ +-----v-------+ +--------v--------+
                    | ATC Gate | | Chronicle   | | Cockpit         |  Quality +
                    | 7-step + | | Layer       | | (answer-first   |  Comprehension
                    | anti-slop| | (validated  | |  operator       |  (DLB-11 + DLB-12)
                    | checklist| |  phase-close| |  surface)       |
                    |          | |  HTML)      | |                 |
                    +----------+ +-------------+ +-----------------+
```

The control plane / execution fabric split is the same picture in two roles:

| The control plane (Claude / Opus) owns | The execution fabric (Codex GPT-5.5) owns |
|---|---|
| State, roadmap, memory, phase order | Repo discovery, planning, bounded edits |
| Locked plans, allowed file surfaces | Patch creation, native + swarm review |
| Quality gates, stoplights, ledgers | Verification, worktree experiments |
| Checkpoints, operator sign-off, promotion | *(no promotion power)* |

---

## 3. The Orchestrator Loop (Token-Optimized)

The orchestrator is an Opus-powered lean state machine. It NEVER writes code or
does heavy work itself. It reads, decides, dispatches, processes, reviews,
commits, loops. The canonical loop and dispatch contract live in `CLAUDE.md`.

### Loop Steps

```
1. READ STATE        (~200 tokens)   Read .planning/STATE.md frontmatter only
2. CLASSIFY          (~50 tokens)    Derive from plan frontmatter/cache or Codex/local check
3. QUERY CONTEXT     (~100 tokens)   sgsd-recall over .planning/memory/ for this task
4. COMPOSE PROMPT    (~500 tokens)   Build Codex dispatch prompt with:
                                      - Task plan (XML, compressed)
                                      - Relevant decisions/patterns (from sgsd-recall)
                                      - Mesh memory CMBs where relevant
                                      - Output format spec
                                      - "No intro. No summary. Report format only."
5. STOPLIGHT         (~50 tokens)    Rate the dispatch GREEN/AMBER/RED (earned execution)
6. DISPATCH          (Codex)         codex-executor.sh / codex-exec.sh [gpt-5.5/xhigh]
7. PROCESS RESULT    (~300 tokens)   Parse <300 word structured report
8. SPEC + ATC REVIEW                 Codex spec-compliance + ATC over raw artifacts
9. CURATE LEARNING   (~50 tokens)    sgsd-curate any new pattern/decision/failure
10. UPDATE STATE     (~100 tokens)   Write STATE.md, mark phase progress
11. CHRONICLE        (phase close)   Build + validate the phase-close chronicle HTML
12. GIT COMMIT       (~50 tokens)    Atomic commit per unit
13. LOOP             (read STATE.md = tool call = loop continues)
```

**Orchestrator budget per unit: ~1,350 tokens + Codex dispatch cost.**
Heavy research/planning/coding/verification tokens land on Codex GPT-5.5, not
on the Opus orchestrator.

### Earned Execution — the GREEN/AMBER/RED stoplight

Before any executor run can write to disk, SGSD rates it GREEN / AMBER / RED on
scope, risk, acceptance commands, and data writes (Codex Pro Mode, §13). A run
with no locked plan, no acceptance command, or a destructive / secrets /
live-data action lands on RED and stops before it touches a file.

### Exit Conditions (3 only)

1. All phases complete
2. Real blocker survives automated recovery (board + Codex challenge cannot
   produce a safe local path; or an operator-only boundary — credentials,
   destructive ambiguity, external access)
3. User says stop/pause

Context percentage is observability only — it is **not** an exit condition.
Runtime compaction plus external `.planning/` state is the context-management
mechanism. Phase and milestone boundaries are not exit conditions either.

### The Golden Rule

Every response includes a tool call. Text-only = loop breaks.
`"Phase 27 complete"` + `[Read STATE.md]` = loop continues.
`"Phase 27 complete!"` alone = loop dies.

---

## 4. The Memory Layer — `.planning/memory/` + Mesh Memory Lite

> **ByteRover is removed.** The 2026-04-08 blueprint used ByteRover
> (`.brv/context-tree/` + `brv-query`/`brv-curate` MCP). Per **DLB-01 memory
> topology**, the SGSD-global memory tier is a project-local filesystem store.
> Legacy `.brv` content is migration input only. There are two tiers.

### Tier 1 — Project-local recall memory (`.planning/memory/`, DLB-01)

A git-tracked filesystem store with a `MEMORY.md` index (one markdown list item
per entry) and typed entries organized by topic:

```
.planning/memory/
├── MEMORY.md             # the index — readable by auto-memory AND sgsd-recall
├── patterns/             # proven implementation patterns
├── anti-patterns/        # failures learned the hard way
├── decisions/            # why we chose X over Y
├── errors/               # error rules — "always check for this mistake"
├── expertise/            # domain expertise for board members
├── code/                 # script registry — "we already built this"
└── trajectory/           # distilled cross-milestone hypotheses/candidates
```

Stable callable interface (shell wrappers, not MCP):

- `sgsd-recall "{terms}"` — grep `MEMORY.md`/`INDEX.md` by query terms, emit
  top-N entry bodies with `<!-- sgsd-recall: type/slug -->` framing
  (~200 tokens per result). Supports `--type`, `--limit`, `--paths-only`. Lives
  at `super-gsd/scripts/sgsd-recall.sh`; auto-walks up from CWD to find
  `.planning/memory/`.
- `sgsd-curate --type T --slug S --summary "<=80 chars" [--tags ...] < body.md`
  — atomic write of a new entry + index update. Types:
  `pattern | anti-pattern | decision | expertise | script`.

Rules: query BEFORE dispatching (inject results into the Codex prompt); curate
AFTER processing (capture learnings from the agent report); always check
`sgsd-recall "scripts {purpose}"` before creating a new utility. BM25 ranking
infrastructure is revisited only at the 40-file tripwire; until then grep +
index-curation discipline is sufficient.

### Tier 2 — Mesh Memory Lite (DLB-08, v3.0)

v3.0 added a lineaged, role-filtered cognitive memory ledger underneath the
control plane. It does not replace tier 1 — it captures *what each role
understood, why, where it came from, and whether it was original, echoed,
disputed, or rejected*. Append-only ledger at `.planning/mesh/memory/cmbs.jsonl`.

**Seven typed CMB (cognitive memory block) classes:**

| CMB type | Class | Emitter | Purpose |
|---|---|---|---|
| `execution_receipt` | observation | SGSD wrapper | What actually changed and what checks ran |
| `review_finding` | claim | ATC / Codex / board reviewer | A claim about risk, correctness, missing coverage |
| `evidence_verdict` | claim-with-authority | evidence_validator | Classify a claim VERIFIED / REFUTED / STALE / UNVERIFIED / GUARDED |
| `decision_recommendation` | decision | pseudo_operator | What SGSD should do, bounded by authority + carve-outs |
| `operator_precedent` | decision | real operator | Make the operator's decisions reusable |
| `context_anchor` | projection | context-authority | Make YAML/MD context searchable while keeping the file canonical |
| `promotion_decision` | decision (terminal) | SGSD | PASS / FAIL_VERIFIED / PASS_WITH_REFUTED_REVIEW / NEEDS_OPERATOR |

**The binding invariant:** SGSD must never treat a claim CMB as an observation
CMB. Claims need validation; observations are derived from facts. Conflating the
two is the reviewer-hallucination failure mode this layer exists to prevent.

Four invariants stolen from the Mesh Memory Protocol paper (arXiv 2604.19540)
and the Pi2Pi operational pattern — implementation copied from neither:

1. **CAT7 envelope** — every CMB has a fixed 7-field cognitive header
   (`focus`, `issue`, `intent`, `motivation`, `commitment`, `perspective`,
   `mood`). It wraps the domain ontology; it does not replace it.
2. **Per-field admission gate** — incoming claims classified
   REDUNDANT / ALIGNED / GUARDED / REJECTED (Tier 0 deterministic + Tier 1
   heuristic; embedding-backed SVAF deferred).
3. **Lineage DAG** — every derived CMB carries `lineage.parents` +
   `lineage.ancestors`; one mechanism gives provenance walking, O(1) echo
   detection, and value-based retention.
4. **Write-time filtering (remix)** — a receiver never persists the raw
   incoming CMB; it writes a new CMB expressing its own role-filtered
   understanding with lineage back to source.

Tooling lives at `super-gsd/tools/mesh-memory/` (`cmb-validate.cjs`,
`cmb-hash.cjs`, `execution-receipt.cjs`, `evidence-validator.cjs`,
`lineage.cjs`, `echo-detector.cjs`, `pseudo-operator-peer.cjs`,
`escalation-gate.cjs`). The CMB schema is `super-gsd/schemas/cmb.schema.json`.

### Hard operator carve-outs (escalation gate)

`escalation-gate.cjs` is a pure-function checker. These conditions force
`real_operator_required: true` regardless of pseudo-operator confidence:
production mutation (SAP / Mongo / Qdrant / Elasticsearch / customer-visible
DB), any credential/security issue, milestone scope change, commercial/legal/
policy implication, confidence < 0.70, or any destructive/irreversible action.
v3.0 Fixture D proved that even at LLM-judge confidence 0.95 a production-SAP
write still escalates — the duty officer knows when to pick up the red phone.

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
<plan phase="27" task="01" provider="codex-gpt-5.5/xhigh">
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

**60% token reduction, same execution quality** — because Codex follows
structured XML better than prose. Note that v3.0 plans validate against
`super-gsd/templates/plan-schema-v2.json`; the YAML-frontmatter v2 plan schema
(see §13) is the current canonical form, with this compressed XML as the
in-prompt projection.

---

## 6. Token Tracking System

### Per-Unit Tracking

Every orchestrator loop iteration logs:

```yaml
# .planning/metrics/token-log.jsonl (append-only)
{"ts":"2026-05-22T14:23:00Z","phase":127,"task":1,"provider":"codex","model":"gpt-5.5","role":"executor","est_input":1200,"est_output":800,"total":2000}
{"ts":"2026-05-22T14:24:00Z","phase":127,"task":1,"provider":"anthropic","model":"opus","role":"orchestrator","est_input":400,"est_output":200,"total":600}
```

### Dashboard (generated on demand, not loaded every session)

```markdown
# Token Usage — Last 5 Sessions

| Session | Date | Units | Opus (orch) | Codex (delivery) | Est. Total |
|---------|------|-------|-------------|------------------|------------|
| S001 | 05-22 | 12 | 8.2K | 24.1K | 32.3K |
| S002 | 05-21 | 8 | 5.1K | 18.3K | 23.4K |

## By Role
| Role | Avg Tokens/Unit | Provider |
|------|----------------|----------|
| Orchestrator | 600 | Opus |
| Executor | 2,000 | Codex GPT-5.5 |
| Planner | 1,500 | Codex GPT-5.5 |
| Verifier / ATC | 800 | Codex GPT-5.5 |

## Context Cost (loaded .md files)
| File | Tokens | Loaded When |
|------|--------|-------------|
| STATE.md frontmatter | ~200 | Every loop |
| ROADMAP.md | ~800 | Phase transitions |
| sgsd-recall results | ~400 | Per dispatch |
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

### The Board (current — Opus-only)

The default fresh-clone board is **CEO + Architect + Contrarian**, all running
as Claude / Opus 4.7 at xhigh intent — there are no Sonnet board members.
Pragmatist and Moonshot remain disabled escalation slots until explicitly
reactivated. The board is resolved at deliberation start from
`super-gsd/registry/board-members.yaml`. Board members self-rate confidence;
the CEO weights votes by confidence rather than raw count.

The board is also the **first step of blocker recovery**: an ordinary Codex
blocker, malformed report, or implementation dead-end invokes the minimal board
roster for a concrete recovery decision, which is then sent to a separate Codex
review/challenge instance before the loop resumes.

### Activation Gate

Before deliberation, the decision is scored deterministically:
- Affects 3+ phases? → deliberate
- Architecture / new dependency / API change? → deliberate
- Single-phase feature? → skip, normal plan-phase
- Bug fix? → skip entirely

This only triggers for milestone/architecture decisions, not per-phase.

---

## 8. Quality Layer (ATC) — Token-Aware

### Change Classification (determines ATC depth)

| Tier | Trigger | ATC Steps | Token Cost |
|------|---------|-----------|------------|
| SKIP | <10 lines, 1 file | None | 0 |
| LITE | 10-50 lines, ≤3 files | Delete + Simplify | ~500 |
| FULL | 50+ lines, 4+ files | All 7 steps | ~2,000 |
| GATE | Architecture/API/deps | All + deliberation | ~12,000+ |

The change tier is derived from plan frontmatter or a Codex/local check. Most
changes are SKIP or LITE. ATC review work (per-dispatch and phase-level) runs
on Codex GPT-5.5/xhigh, never on the Opus orchestrator.

---

## 9. Transition Command (/gsd-transition)

For users migrating from Pi/GSD 2.0. One-time command that:

1. Reads `.gsd/DECISIONS.md` → curates into `.planning/memory/decisions/`
2. Reads `.gsd/KNOWLEDGE.md` → curates into `.planning/memory/patterns/` + `anti-patterns/`
3. Reads `.gsd/REQUIREMENTS.md` → merges into `.planning/REQUIREMENTS.md`
4. Maps `.gsd/milestones/` work → phases in `.planning/ROADMAP.md`
5. Marks completed work as `[x]`
6. Writes migration report

The `.gsd/` directory is a read-only import; it is not modified or deleted.

---

## 10. File Manifest — What We're Building

> **This manifest is the original 2026-04-08 build plan.** It shipped. The
> canonical, current enumeration of skills / agents / gates / scripts / tools is
> the auto-generated `.planning/SYSTEM-MAP.md` (machine view at
> `.planning/SYSTEM-MAP.json`), regenerated from the registries under
> `super-gsd/registry/`. The tables below are kept as build history; the
> provider columns reflect the *original* design, not the current Opus/Codex
> split.

### Skills (`super-gsd/skills/`)

`sgsd-orchestrate` (autonomous loop), `sgsd-deliberate` (CEO/Board),
`sgsd-transition` (migrate from Pi/GSD 2.0), `sgsd-token-audit`, `sgsd-audit`
(evidence-gated audit), `sgsd-pause` / `sgsd-resume`, plus the GSD 1.0 skill
set. Orchestration is Opus; everything execution-shaped routes to Codex.

### Agents (`super-gsd/agents/`)

`sgsd-ceo` + the Opus board (`board-architect`, `board-contrarian`, and the
disabled `board-pragmatist` / `board-moonshot` escalation slots). The legacy
Claude worker agents (`gsd-executor`, `gsd-planner`, `gsd-phase-researcher`,
`gsd-verifier`, `gsd-code-reviewer`, `gsd-classifier`, `gsd-context-selector`)
are present but **disabled for code execution** — their roles are owned by Codex
GPT-5.5/xhigh via `codex-executor.sh` / `codex-exec.sh`.

### Directory layout (`.planning/`)

```
.planning/
├── briefs/                  # Decision inputs
├── deliberations/           # Debate logs
├── decisions/               # Decision memos (DLB-NN-slug.md)
├── memory/                  # Tier-1 recall memory (MEMORY.md + typed entries)
├── mesh/memory/             # Tier-2 Mesh Memory Lite ledger (cmbs.jsonl)
├── milestones/{v}/          # per-milestone INTENT, ROADMAP, phases, SUMMARY
├── chronicles/              # phase-close + milestone chronicle HTML
└── metrics/                 # append-only JSONL evidence ledgers
```

---

## 11. Implementation Order

### Phase 1: Token Foundation (build first — everything depends on this)
1. Token logging system (token-log.jsonl format + write helper)
2. Model routing table in config.json
3. Compressed XML plan format
4. Sub-agent report format (<300 words, structured)

### Phase 2: Memory Layer (`.planning/memory/` — DLB-01)
1. Create the project-local `.planning/memory/` tree + `MEMORY.md` index
2. Migrate existing memory files → typed entries
3. Wire `sgsd-recall` into orchestrator dispatch
4. Wire `sgsd-curate` into agent post-processing
5. (v3.0) Layer Mesh Memory Lite — `cmbs.jsonl` ledger + CMB tooling

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

### The Solution: Script Registry in `.planning/memory/`

Every script written by any agent gets curated into `.planning/memory/code/`
(or `scripts/`) via `sgsd-curate --type script`:

```
.planning/memory/code/
├── hooks/
│   ├── pre-commit-lint.md          # Shell: runs eslint on staged files
│   ├── post-commit-state-update.md # Node: updates STATE.md after commit
│   └── context-monitor.md          # Node: displays context usage
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
Orchestrator: sgsd-recall "retry with backoff utility typescript"
→ Hit: code/utilities/retry-with-backoff.md
→ Inject into Codex prompt: "EXISTING: src/lib/utils/retry.ts — import and use, do not recreate"
```

**After an agent writes a new script:**
```
Orchestrator: sgsd-curate --type script the metadata
→ Include: purpose, interface, location, language, hash
→ Agent prompt: "If you created any new utility functions, report them in SCRIPTS_CREATED"
```

**Staleness detection:**
- `hash` field tracks file content hash
- On a recall hit, a deterministic check confirms the file still exists at
  `location` and the hash matches
- If moved/deleted/changed: update or archive the registry entry

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

---

## 14. Agentic Harness Evolution (v2.9)

v2.9 turned SGSD from a hand-improved orchestrator into an observability-driven
harness that can improve its own components under controlled, measurable,
revertible conditions — the closed AHE loop:

```
component → evidence → predicted edit → measured next-run outcome → keep/revert/pivot
```

Six tools under `super-gsd/tools/harness-*/` implement it:

- **harness-components** — 35-row component registry across 14 frozen classes
  (5 protected); `catalog.cjs` Read API with a path-safety validator.
- **harness-evidence** — `distill.cjs` distils 7 JSONL surfaces into an
  ≤4KB overview + index, against 11 frozen root-cause labels.
- **harness-manifest** — `MANIFEST.schema.json` with falsifiable contracts
  (required `predicted_fixes` ≥1, `predicted_regressions` may be [] but never
  null); append-only, idempotent on `change_id`.
- **harness-attribution** — `attribute.cjs` computes fix and regression
  precision/recall *independently*; 6-verdict closed vocabulary; rollback
  recommendations are structured but never executed by the phase.
- **harness-evolution** — `run.cjs` with 4 modes; never reads protected oracles
  into model context.
- **harness-ablation / harness-transfer** — component swap with workspace
  isolation, 3 interference rules, a frozen-before-run rule, and an
  OOD/transfer evaluator across 8 transfer axes.

**The protected-surface contract** guarantees scoring oracles, verifiers, model
config, and budget cannot be edited by the evolution loop — so any measured
improvement is system-real, not goalpost-shifted.

**Semantic verification gate (P97.5 / DLB-07).** After the Clarity ERP
2026-05-18 incident — six phases closed PASS while end-to-end behaviour was
broken — `plan-schema-v2.json` + `validate.cjs` now mechanically enforce
`semantic_acceptance_criteria` (SCHEMA-09/-10). `sgsd-audit@v2` Layer 4 executes
each plan's `verification_cmd` against real data at phase close, with a
fixture-path guard. Structural pass without a semantic check no longer closes a
phase.

---

## 15. Codex Pro Mode — 10 typed lanes + earned execution (v3.0, DLB-09)

Codex Pro Mode is how the orchestrator routes work to the execution fabric.
Three pieces under `super-gsd/tools/codex-pro/`:

- **`profile-resolver.cjs`** — rule-based mapping of dispatch context to one of
  **10 typed Codex profile envelopes** (`super-gsd/registry/codex-profiles.yaml`).
  Each lane is a bounded contract: research, planning, execution, verification,
  spec-review, ATC, etc.
- **`stoplight.cjs`** — the GREEN / AMBER / RED earned-execution classifier.
  GREEN = locked plan + acceptance command + bounded scope. RED = no locked
  plan, no acceptance command, or a destructive / secrets / live-data action —
  the run stops before touching a file. Routing decisions are logged to
  `.planning/metrics/pro-mode-stoplight.jsonl`.
- **`native-review-runner.cjs`** — emits `review_finding` CMBs into the mesh
  ledger (the DLB-08 wire-in).

**5 fail-CLOSED Codex hooks** (`super-gsd/tools/codex-hooks/`, mapped via
`.codex/hooks.json`): `block-forbidden-write`, `block-secret-leak`,
`log-tool-event`, `validate-stop-contract`, `enforce-allowed-files`. Every hook
fails closed on ambiguity. Hook events are logged to
`.planning/metrics/codex-tool-events.jsonl`.

**PLAN-LOCKED schema.** `super-gsd/schemas/plan-locked.schema.json` extends
plan-schema-v2 with lock metadata — `lock_status`, `locked_at`, `allowed_files`,
`forbidden_files`, `invariants`, `acceptance_commands`, `rollback_plan`,
`risk_rating`, `operator_checkpoints`. A Codex executor dispatch runs against a
locked plan; the hooks enforce the `allowed_files` surface.

**Context Authority (DLB-10).** Six YAML capsule templates per milestone —
`MILESTONE-CONTEXT`, `PERSONA-MATRIX`, `DOMAIN-ONTOLOGY`, `LEXICON`,
`SOURCE-OF-TRUTH`, `NON-GOALS`. `context-anchor-writer.cjs` projects each YAML
into a `context_anchor` CMB with staleness detection; the YAML stays canonical.
This makes milestone WHY + persona priorities + lexicon + source-of-truth +
decision precedents persistent and consumable, so the board escalates to the
real operator far less often.

---

## 16. The Chronicle Layer (v3.1, DLB-11)

The architectural rule: **a phase is not cognitively complete until the operator
can understand it.** Technical completeness (tests pass, gates pass) is
necessary but not sufficient.

Every phase close (and milestone close) ships a validated **Operator
Chronicle** — an HTML projection of SGSD truth: mesh memory CMBs + canonical
artefacts + cockpit logs + git evidence. The pipeline:

```
phase-close → collect artefacts → build CHRONICLE-CONTEXT.json
  → render HTML → validate against evidence → publish → index
```

Binding properties:

- **Projection, never authority.** Every claim links to a CMB key, file path,
  test name, or commit SHA. The mesh ledger stays the single source of truth;
  the chronicle stores CMB references by-ID, not by-value.
- **Deterministic writer.** `super-gsd/tools/chronicle/render-html.cjs` is a
  pure Node.js tool — no agent-driven prose synthesis. Template slots with no
  evidence emit a `MISSING_EVIDENCE` placeholder.
- **Validator before publish, binding gate.** `validate-chronicle.cjs` resolves
  every citation against the live ledger; `REPORT_UNGROUNDED` hard-halts the
  phase close (skip requires explicit `skip_gates` + `skip_reason`).
- **Static, offline-survivable.** Inline SVG, no CDN, no JS deps. Architecture
  diagrams authored as committed PlantUML source, pre-rendered, and inlined
  inside collapsible `<details>` blocks.
- **Denominator panel.** Every chronicle surfaces what was *not* covered —
  scope excluded, carve-outs that could have fired but didn't, alternatives
  rejected, assumptions made, gates skipped — countering agent
  denominator-blindness.

The **Fog Score** is a deterministic 0–100 measure of how cognitively heavy a
phase was (agent dispatches, token spend, files changed, review loops, disputed
claims, plan revisions, unresolved risks, dependency depth). A high score
triggers a "must-read sections X, Y, Z" recommendation. The architectural-family
label is **Deterministic Projection Memory** — the mesh ledger is an append-only
event log; the chronicle context-pack is a task-conditioned projection.

---

## 17. The Operator Comprehension System (v3.2, DLB-12)

v3.1 made SGSD explain a phase after it closes; v3.2 made that explanation
world-class and extended the same answer-first discipline to the **live
cockpit**. The rule: *the chronicle and the cockpit are two views of the same
truth, not two codebases* — one shared design system, two surfaces.

- **One shared design system.** `super-gsd/tools/shared/` holds
  `sgsd-design-system.css` and `design-rules.json` — **12 comprehension rules
  (R01–R12)** mined retrieve-per-book-first from four communication books
  (*The Minto Pyramid Principle*, *Made to Stick*, *Storytelling with Data*,
  *The Back of the Napkin*). A deterministic conformance checker
  (`conformance-check.cjs`) holds both the chronicle and the cockpit to those
  rules; at v3.2 close both surfaces report `binding_fail=0`.
- **The chronicle, upgraded.** `render-html.cjs` rebuilt to the gold reference:
  an Operator Decision Panel first, an 11-section answer-first order, SCQA
  structure, a fog gauge, inline-SVG diagrams with takeaway figcaptions. The
  validator gained 4 book-grounded lints (jargon / takeaway-heading /
  one-primary-action / figcaption≠title). Chronicle self-test: 111/111.
- **The cockpit, answer-first.** `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs`
  evolved from a JSON/text CLI into a glanceable surface: a North-Star banner
  (`north-star.cjs`, a 5-rank cascade returning exactly one North Star), an
  alert grammar (`alert-grammar.cjs`, threshold→duration→channel, rank-then-gate
  so one alert shows and the rest are counted), `--brief` / `--html` modes, and
  preattentive single-focus discipline (colour only on the North-Star and alert
  lines). Cockpit self-test: 18/18. The cockpit evolves the sidecar only — it
  never touches the v2.9 Lock-13 frozen cockpit array.

Both surfaces stay deterministic — no LLM in either render path — and
offline-survivable.

---

## 18. Milestone history (v2.9 → v3.2)

| Milestone | Theme | Phases | Outcome |
|---|---|---|---|
| v2.9 | Agentic Harness Evolution (+ P97.5 semantic gate) | 97.5, 98–105 | ALL-PHASES-CLOSED PASS-WITH-DEFERRED-2 — 131/131 new self-test |
| v3.0 | SGSD-PRO — Mesh Memory Lite + Codex Pro Mode + Context Authority | 106–112 | ALL-PHASES-CLOSED PASS — 4 MVP fixtures green; 0 deferred |
| v3.1 | Chronicle Layer | 113–119 | ALL-PHASES-CLOSED — 96/96 self-test |
| v3.2 | Operator Comprehension System | 120–127 | ALL-PHASES-CLOSED PASS — chronicle 111/111, cockpit 18/18 |

The full per-phase detail lives in each milestone's
`.planning/milestones/{v}/SUMMARY.md`; the design locks are
`.planning/decisions/DLB-08`, `DLB-11`, and `DLB-12` (DLB-09 Codex Pro Mode and
DLB-10 Context Authority are documented inside the v3.0 SUMMARY).
