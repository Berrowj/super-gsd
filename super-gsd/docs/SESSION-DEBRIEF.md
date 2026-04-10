# Session Debrief — Super GSD & PI Framework Migration
**Dates**: 2026-04-08 to 2026-04-09
**Objective**: Process reference material for building multi-agent strategic decision capabilities into Claude Code / GSD 1.0, following the death of PI harness (OAuth disabled)

---

## The Situation

Anthropic disabled OAuth. This killed:
- **PI agent harness** — the custom runtime that powered GSD 2.0
- **GSD 2.0** — which depended on PI for multi-agent orchestration, custom system prompts, expertise files, constraint engines

**What survives**: GSD 1.0 running natively in Claude Code (27/30 phases shipped on VTP, 85/88 plans completed). All 68 skills, 24 agents, 10 hooks intact.

**The goal**: Replicate PI's strategic decision-making capabilities (CEO/Board adversarial debate, brief templates, expertise files) using Claude Code's existing primitives.

---

## Documents Processed

### 1. PI CEO Agents: Claude 1M Context Multi-Agent Teams
- **Meeting ID**: `9ccfc34b-4e57-49f1-9ab1-99de470d4a7e`
- **Source**: YouTube transcript (~32 min) — multi-agent-framework.docx
- **VTP Pipeline**: Full benchmark processing

| Extraction | Count |
|-----------|-------|
| Decisions | 6 |
| Actions | 6 |
| Problems | 5 |
| Key Info | 20 |
| Ideas (developed) | 10 (9 kept, 1 rejected) |
| Questions | 3 |
| Claims | 6 |
| Skeptic Challenges | 3 |

**Three innovations identified**:
1. Claude 1M context at flat pricing
2. Customizable agent harness (PI) — **now dead**
3. Expertise files — persistent domain-specific patterns

**Key ideas kept**:
| # | Idea | Dumb Score | Verdict |
|---|------|-----------|---------|
| 0 | CEO Agent Orchestration (3-agent core) | 8 | KEEP (modified) |
| 1 | Expertise File System | 5 | KEEP |
| 2 | Brief Template System | 6 | KEEP |
| 3 | Moonshot Agent (milestone-gated) | 10 | KEEP (modified) |
| 4 | Mermaid Diagram Support | 15 | KEEP (modified) |
| 5 | Constraint Engine | 8 | KEEP |
| 6 | Backroom/Private Channels | 45 | **REJECTED** |
| 7 | Decision Memo Format | 7 | KEEP |
| 8 | Template Library | 12 | KEEP (modified) |
| 9 | Board Member Configurations | 9 | KEEP |

**HTML Report**: `Transcripts/pi-ceo-agents-framework-report.html`

---

### 2. LangChain vs LangGraph: A Tale of Two Frameworks
- **Meeting ID**: `ce7ccd77-b737-4cb1-b76b-19f9aa1769dc`
- **Source**: YouTube transcript (~10 min)
- **VTP Pipeline**: Full benchmark processing

| Extraction | Count |
|-----------|-------|
| Decisions | 3 |
| Actions | 2 |
| Problems | 2 |
| Key Info | 12 |
| Ideas (developed) | 5 (all kept) |
| Questions | 3 |
| Claims | 4 |
| Skeptic Challenges | 2 |

**Core insight**: GSD already contains both patterns:
- **LangChain-like** (sequential DAG): phase execution pipeline (discuss → plan → execute)
- **LangGraph-like** (cyclic graph with shared state): orchestrator loop, CEO/Board deliberation

**Key ideas kept**:
| # | Idea | Dumb Score | Verdict |
|---|------|-----------|---------|
| 0 | Graph mental model for GSD | 15 | KEEP (modified) |
| 1 | Hub-and-spoke return pattern | 20 | KEEP (modified) |
| 2 | Shared deliberation state file | 10 | KEEP |
| 3 | Explicit model routing docs | 22 | KEEP (modified) |
| 4 | Overwatcher graph view panel | 12 | KEEP |

**HTML Report**: `Transcripts/langchain-vs-langgraph-report.html`

---

## Claude Code Capabilities Audit — Honest Assessment

### What Works for Multi-Agent

| Capability | Status |
|-----------|--------|
| Spawn multiple agents in parallel | YES |
| Custom agent definitions (.claude/agents/) | YES |
| Different prompts per agent | YES |
| Different models per agent | YES |
| Agents write to shared files | YES |
| Skills enforce workflows | YES |
| Memory persists across sessions | YES |
| Hooks validate/gate actions | YES |
| GSD state machine integration | YES |
| Team communication (SendMessage) | YES |

### What Doesn't Work

| Capability | Status | Why |
|-----------|--------|-----|
| Real-time multi-round debate | NO | Each round = re-spawn all agents with full context |
| Cost/budget constraints | NO | Zero per-agent token tracking |
| Time constraints on agents | NO | No timeout on Agent tool |
| System prompt overwrite | NO | CLAUDE.md adds to, doesn't replace |
| Custom front-matter parsing | NO | Fixed schema in .claude/agents/ |
| Dynamic variable injection | NO | Workaround: construct full prompt dynamically |
| Per-agent expertise persistence | NO | Subagents start fresh every time |
| Automatic domain detection | NO | All memory loads every session |

### The Fundamental Constraint

PI was a **custom runtime that controlled everything**. Claude Code is an **opinionated runtime you customize at the edges**. The CEO/Board pattern in Claude Code will always be:
- Orchestrator-driven (parent controls flow)
- Spawn-collect-synthesize (not live debate)
- File-system coordinated (agents write files, parent reads them)
- Prompt-customized (personality via prompt text, not harness config)

---

## Deliverables Produced

### Documents
| File | Description |
|------|-------------|
| `Transcripts/GSD-CEO-BOARD-BLUEPRINT.md` | 13-section implementation blueprint — PI→Claude Code mapping, agent definitions, skill design, expertise patterns, hard limits, implementation sequence |
| `Transcripts/pi-ceo-agents-framework-report.html` | Full VTP HTML report for PI Framework meeting |
| `Transcripts/langchain-vs-langgraph-report.html` | Full VTP HTML report for LangChain vs LangGraph |
| `Transcripts/super-gsd-user-guide.html` | Complete Super GSD user guide (Vercel-deployable) |
| `Transcripts/SESSION-DEBRIEF-2026-04-08-09.md` | This file |

### KB Data
| Store | Items Added |
|-------|------------|
| Meetings | 2 new meetings ingested |
| Idea Developments | 15 ideas fully developed (10 + 5) |
| Speaker Signals | 2 speakers profiled |
| Claims | 10 claims verified |
| Skeptic Results | 5 challenges documented |
| Knowledge Graph | 2 meetings added with edges |
| QMD Index | 2 meetings indexed for search |

### Memory Updated
| File | Content |
|------|---------|
| `project_pi_oauth_death.md` | PI harness is dead — replicate capabilities in Claude Code / GSD 1.0 |

---

## What To Build — Priority Stack

Based on both VTP extractions, the capabilities audit, and the blueprint:

### P0 — Build First (Foundation)

| Component | Source | Effort | Why First |
|-----------|--------|--------|-----------|
| **Brief Template System** | PI idea #2 | Low | No dependencies. Immediately useful. Forces structured thinking. |
| **Expertise Memory Files** | PI idea #1 | Low | No dependencies. Extend existing memory system. Improves every session. |
| **4 Board Agent Definitions** | PI idea #9 | Medium | Needed before deliberation skill. Full specs in blueprint Section 6. |

### P1 — Build Second (Core)

| Component | Source | Effort | Why |
|-----------|--------|--------|-----|
| **`/sgsd-deliberate` skill** | PI idea #0 | High | Core deliverable. Orchestrates board, produces memos. Full spec in blueprint Section 7. |
| **Deliberation State File** | LangGraph idea #2 | Low | Adds crash recovery + observability to deliberation. Simple JSON. |
| **Decision Memo Format** | PI idea #7 | Low | Template only. Fills gap between PLAN.md (what) and rationale (why). |

### P2 — Build Third (Enhancement)

| Component | Source | Effort | Why |
|-----------|--------|--------|-----|
| **Moonshot Perspective** | PI idea #3 | Low | Milestone-gated activation. Prevents incrementalism. |
| **Overwatcher Graph View** | LangGraph idea #4 | Medium | Mermaid.js node-edge rendering of phases. Visual improvement. |
| **Model Routing Docs** | LangGraph idea #3 | Low | Document what already works. |

### Not Worth Building

| Component | Why |
|-----------|-----|
| Backroom/Private Channels | Rejected (dumb score 45). O(n^2) complexity, unproven. |
| Constraint Engine | No Claude Code primitives. Would be faking it. |
| Full Graph Execution Engine | Sequential works. /gsd-insert-phase handles revisits. |
| LangGraph Python Library Integration | Wrong ecosystem (Python vs Node/TS). Adopt patterns, not library. |

---

## Cross-Domain Research Highlights (Across Both Meetings)

These validate the architectural choices:

| Pattern | Source | Validation |
|---------|--------|------------|
| Multi-agent debate | Military OODA loops | Parallel analysts → single decision-maker is battle-tested |
| Structured input templates | Amazon 6-page memo | Forced structured input improves decision quality at scale |
| Assigned reasoning roles | De Bono Six Thinking Hats | Decades of evidence for perspective diversity |
| Decision documentation | Architecture Decision Records | Industry standard for capturing decision rationale |
| Hub-and-spoke routing | Event-driven architecture | Proven pattern in distributed systems |
| Shared state across agents | Redux state store | Single source of truth, all consumers read from it |
| Cyclic workflows | Apache Airflow + Petri nets | DAGs are limiting for iterative workflows |
| Adversarial roles | Red Team / Blue Team | Assigned adversarial roles surface hidden issues |

---

## Next Steps

1. **Read the blueprint**: `Transcripts/GSD-CEO-BOARD-BLUEPRINT.md` — Section 6 has copy-ready agent definitions, Section 7 has the full skill spec
2. **Start with P0**: Brief template + expertise files + board agent definitions
3. **Then P1**: Wire up `/sgsd-deliberate` skill and test with a real decision
4. **Test on a real brief**: Pick a pending decision from VTP or JCL and run it through the board

---

*Generated from VTP session processing 2 meetings, 15 ideas developed, 1 implementation blueprint, and 1 Claude Code capabilities audit.*
