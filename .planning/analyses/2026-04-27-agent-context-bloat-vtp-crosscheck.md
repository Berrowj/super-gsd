---
title: Agent Context Bloat Audit - VTP Research And Book Cross-Check
date: 2026-04-27
source_audit: .planning/analyses/2026-04-27-agent-context-bloat-audit.md
status: draft
method: VTP MCP cross-check over research corpus and book corpus
---

# Agent Context Bloat Audit - VTP Research And Book Cross-Check

## Executive Verdict

The original bloat audit is directionally correct: SGSD is spending too many
tokens re-reading broad internal context, especially in researcher-style roles,
and the fix should be architectural rather than prompt-only.

The VTP cross-check strengthens the conclusion, but also tightens the design:

- Do not make Redis the canonical memory.
- Do build phase capsules, context packets, legal registries, and token admission
  control first.
- Do treat Redis, if used, as a live cache or projection behind an interface.
- Do make raw logs and git-backed artifacts the source of truth.
- Do make memory writes governed transitions with provenance, clearance rules,
  and rollback.
- Do route agents by uncertainty type instead of giving every role the whole
  project context.

The core principle from both research and books is:

> Compress experience into governed artifacts, then retrieve the smallest
> useful artifact for the current decision.

## MCP Run Log

Input report:

`C:\Users\user\GSDedits\.planning\analyses\2026-04-27-agent-context-bloat-audit.md`

Research pass:

- Listed 74 research-paper resources with `vtp_list_research`.
- Tried all-paper `vtp_research_gate` first.
- `vtp_research_gate` full mode failed after roughly 55 seconds because the MCP
  relevance stage generated a `scores[0].reason` longer than the server schema
  allows. This is a VTP MCP validation bug, not an SGSD result.
- Retried `vtp_research_gate` lite mode with a shorter problem; it timed out
  after 120 seconds.
- Fallback path used:
  - `vtp_search_research`
  - `vtp_get_research`
  - `vtp_search_substrate`
  - `vtp_get_evidence_bundle`

Books pass:

- `source_type=book` returned zero rows.
- VTP stores books as `wiki_page` resources under `wiki/books/...`.
- Listed book resources with `vtp_list_resources(source_type="wiki_page")`.
- Searched books with `vtp_search_substrate(source_types=["wiki_page"])`.
- Pulled evidence with `vtp_get_evidence_bundle`.
- Read compact book resources with `vtp_get_document`.

Important limitation:

Some compact book documents are mostly frontmatter, title pages, or table of
contents because of the way the source PDFs/EPUBs were extracted. For books,
the synthesis therefore weights search hits and evidence bundles more heavily
than title-page-only compact chunks.

## Starting Evidence From The Audit

The original audit found:

- `gsd-phase-researcher` spent 122k to 223k tokens per phase.
- More than 98 percent of those tokens were cache-read input tokens.
- Phase 40 used 122,437 tokens, including 120,416 cache-read tokens, while only
  reading 8 files and writing a 519-line research artifact.
- That Phase 40 researcher run did not use VTP/MCP.
- Current v1.9/P41 loop used about 1.24M tokens across 4 turns with no
  sub-agent calls.

Interpretation:

The waste is not mainly from output. It is from broad inherited context and
re-reading heavy internal artifacts for roles whose actual task is narrower
than the prompt context they receive.

## Research Corpus - What It Validates

### 1. Context packets are the right move, but they are compression artifacts

Relevant research:

- `self-evolving-framework-for-efficient-terminal-agents`
- `experience-compression-spectrum`

The TACO/self-evolving terminal-agent research validates compression at the
observation boundary. Agents should not repeatedly ingest the whole workspace
when their next decision only needs a small state packet.

For SGSD:

- The context packet is not a convenience summary.
- It is the controlled observation surface for a dispatch.
- It should include only facts relevant to the role, phase, gate, and current
  uncertainty.
- It must preserve critical exceptions without compression.

Required critical bypass:

- CRIT findings
- stack traces
- stderr
- failed tests
- verifier FAIL
- edge-guard miss
- security or privacy concern
- destructive-operation warning
- provider outage with behavioral evidence

If an agent has to reread the full phase folder after receiving a packet, that
is not "agent diligence"; it is a packet failure. Log it as a context complaint.

### 2. Phase capsules are right, but static summaries are not enough

Relevant research:

- `experience-compression-spectrum`
- `thought-retriever`
- `mesh-memory-protocol`

The research supports a lifecycle:

- raw event
- compacted phase fact
- validated capsule
- reusable rule
- deprecated or demoted rule

For SGSD:

- Phase close should produce a capsule.
- The capsule should not be a long narrative recap.
- It should be a reusable state transition record:
  - what changed
  - why it changed
  - what evidence proves it
  - what remains unresolved
  - what downstream phase should inherit
  - which facts are valid only for this phase

Capsules need lifecycle fields:

- source files
- source commits
- source hashes
- confidence
- last validated
- supersedes
- superseded_by
- allowed_consumers
- clearance_requires
- deprecation_reason

### 3. Redis is not canonical memory

Relevant research:

- `stateless-decision-memory-for-enterprise-ai-agents`
- `security-of-long-term-memory-llm-agents-survey`
- `mesh-memory-protocol`

The research does not support making Redis the source of truth. It supports
stateless projection over durable logs, with caches rebuilt from canonical
state.

For SGSD:

- `.planning/*.jsonl`, phase artifacts, and git commits remain canonical.
- SQLite can be a local durable index over capsules and file summaries.
- Redis can be a fast live cache for cockpit and hot context packets.
- Redis must be disposable and rebuildable.

The rule should be:

If deleting Redis loses history, decisions, or auditability, the design is
wrong.

### 4. Write-time filtering matters more than retrieval-time search

Relevant research:

- `mesh-memory-protocol`
- `security-of-long-term-memory-llm-agents-survey`

The report was too optimistic about "better retrieval" as the main fix. Better
retrieval helps, but the bigger issue is that SGSD lets too much ungoverned
material become future context.

For SGSD:

- Agent outputs should be admitted field by field.
- Raw transcripts should not become future context by default.
- A researcher should write accepted findings and rejected paths, not the whole
  thinking trail.
- A planner should write decision structure and constraints, not every scanned
  file.
- An executor should write touched surface, exact artifacts, and tests, not a
  broad prose log.

### 5. More context becomes actively harmful after a peak

Relevant research:

- `schema-constrained-generation-agent-memory`
- `architecture-matters-more-than-scale`

The VTP research challenges the assumption that "more context means safer."
Beyond the useful peak, extra context increases confusion, stale references,
and invented associations.

For SGSD:

- Each agent role needs a budgeted context packet.
- Role prompts should not inherit the whole milestone and all prior phase docs.
- The packet builder should enforce legal references:
  - valid milestone IDs
  - valid phase IDs
  - valid gate IDs
  - valid agent IDs
  - valid artifact IDs
  - valid provider IDs

This argues for a `context-registry/legal-keys.json` or generated equivalent.

### 6. Token budgets need central scheduling, not vibes

Relevant research:

- `hivemind-os-inspired-scheduling`
- `kairos-stateful-context-aware-agentic-inference`

The current architecture relies too much on prompt discipline. The research
points toward central admission control:

- budget by role
- budget by phase risk
- budget by retrieval type
- require justification for budget escalation
- track actual token use against expected use
- downgrade or route to Codex/local scripts when cheaper

For SGSD:

- `gsd-phase-researcher` should not get 120k+ cache-read tokens by default.
- A researcher budget breach should trigger a narrower packet or a local scan,
  not a larger inherited prompt.
- The cockpit should show agent token spend by role and phase.

### 7. Persistent memory is dangerous without provenance and deletion

Relevant research:

- `security-of-long-term-memory-llm-agents-survey`

Memory writes are privileged state transitions. Compression can amplify bad
information. Deletion is a protocol, not a best-effort cleanup.

For SGSD:

- Every capsule and file summary needs provenance.
- Every promoted rule needs source hashes.
- Every stale or bad capsule needs a revocation path.
- Memory consumers need to know if a fact is current, superseded, or degraded.

## Research Corpus - What It Challenges

The original audit should be amended in these areas:

1. It was too soft on memory governance.

   Add privileged write gates before Redis, vector memory, or any automatic
   memory promotion.

2. It needs a critical-output bypass.

   Do not summarize away CRITs, stack traces, verifier failures, edge-guard
   misses, security concerns, or destructive-operation warnings.

3. It needs complaint rollback.

   If an agent rereads full raw files, asks for full history, or ignores a
   packet because it lacks necessary facts, log a `context_complaint` and revise
   the capsule or packet rule.

4. It needs compression levels.

   Treat raw logs, capsules, and reusable rules as different layers with
   promotion and demotion.

5. It needs legal registries.

   Constrain generated references to known phase IDs, gate IDs, agent IDs,
   artifact IDs, provider IDs, and file IDs.

6. VTP should not be enabled broadly.

   Route VTP only when the uncertainty type needs external knowledge,
   literature, books, prior project memory, or architectural challenge.
   Local implementation checks should use local files, summaries, tests, and
   Codex where useful.

## Book Corpus - Conclusions

### A Philosophy of Software Design

Relevant ideas:

- reduce complexity
- prefer deep modules
- different layers should have different abstractions
- avoid pass-through variables and shallow interfaces
- comments that repeat the code add little value

SGSD implication:

The current full-context pattern behaves like a giant pass-through variable.
It pushes raw state through every agent instead of exposing a deep interface
that answers the role's actual questions.

Action:

Build a deep `context-packet` module. It should hide where the facts came from
and expose only the facts needed for the agent role.

### Clean Architecture

Relevant ideas:

- boundaries have cost
- unnecessary decoupling creates waste
- details should be hidden behind policy-facing interfaces

SGSD implication:

Redis as a default first move would be an unnecessary detail leak. A cache can
help, but the architecture should first define the interface:

- `getPhaseCapsule(phase)`
- `getContextPacket(role, phase, task)`
- `recordContextComplaint(row)`
- `recordTokenSpend(row)`

Redis can sit behind that later.

### Domain-Driven Design

Relevant ideas:

- bounded contexts
- context maps
- explicit translation between models
- avoid leaking one bounded context's internal model into another

Suggested SGSD bounded contexts:

- Canonical State: STATE.md, ROADMAP.md, phase metadata, backlog
- Execution Runtime: tool events, agent events, shell/Codex process markers
- Knowledge/Retrieval: VTP, memory, book/research retrieval, source citations
- Live Cockpit: projections for operator understanding
- Audit/Compliance: evidence, reviews, gates, debt status
- Provider Scheduling: Claude/Codex/router budgets and availability

Agents should consume published language between contexts, not raw folder
layouts.

### Balancing Coupling in Software Design

Relevant ideas:

- exposing internal event models across boundaries creates model coupling
- shared models become friction when each side evolves differently

SGSD implication:

Later agents should not parse arbitrary prior phase folder structures. They
should consume a stable capsule contract. Raw phase folders are an internal
model, not an API.

### Designing Data-Intensive Applications And Fundamentals of Data Engineering

Relevant ideas:

- caches and indexes are projections
- durable logs and databases are where correctness lives
- Redis is useful for speed, not as the sole historical record

SGSD implication:

Use:

- JSONL/git artifacts as canonical log
- SQLite FTS as durable local index
- Redis as optional live cache

Do not use Redis for unrecoverable memory.

### The LLM Mesh

Relevant ideas:

- prompt compression
- context caching
- monitoring
- source-backed claims
- agent-level oversight

SGSD implication:

The cockpit should show:

- current phase and task
- active agents only
- agent token spend by role
- context source mix
- current provider/canary state
- evidence status

The report's cockpit critique is aligned with this: the UI should make agent
behavior inspectable at a glance.

### Don't Make Me Think

Relevant ideas:

- interfaces should answer the user's obvious questions immediately
- labels should match user intent, not system internals

SGSD implication:

The cockpit should answer:

- What milestone are we on?
- What phase are we on?
- What is Claude doing right now?
- Which agents are active?
- What evidence is complete?
- What will block autonomy?
- What did Codex last say about this phase?
- Where are tokens being spent?

Raw labels like `R#`, `old live`, `cascade`, or `checkpoint present` need
translation into operator language.

### The Mythical Man-Month

Relevant ideas:

- conceptual integrity matters
- adding more people/process does not automatically accelerate delivery
- sharper architecture beats more coordination overhead

SGSD implication:

More agents, more docs, and more memory stores will not fix bloat unless SGSD
has one clear context architecture. The fix is not "add Redis and more agents."
The fix is fewer, sharper surfaces.

### Writing Effective Use Cases

Relevant ideas:

- name scope and boundaries
- identify actors and goals
- capture preconditions, guarantees, and extension conditions

SGSD implication:

Every phase capsule should read like a use-case closeout:

- scope
- primary actor
- goal
- preconditions
- success guarantee
- extensions/failures
- downstream guarantee

That makes later phases consume the phase outcome instead of scanning the phase
history.

## Amended SGSD Memory Architecture

### Layer L0 - Raw Canonical Artifacts

Examples:

- `.planning/metrics/*.jsonl`
- phase PLAN/VERIFICATION/ATC files
- commit history
- provider logs
- test output

Rules:

- append-only where possible
- git-backed
- never replaced by Redis
- critical bypass records stay raw

### Layer L1 - Phase Event Facts

Generated facts extracted from L0:

- phase opened
- agent dispatched
- file touched
- test run
- review produced
- debt row opened/closed
- provider canary passed/failed

Implementation:

- `phase-events/extract.cjs`
- deterministic
- rebuildable

### Layer L2 - Phase Capsules

One capsule per phase close:

- phase id
- milestone id
- goal
- shipped status
- files changed
- evidence list
- active debt
- decisions made
- downstream inheritance
- source hashes

Implementation:

- `super-gsd/tools/phase-capsule/write.cjs`
- output: `.planning/milestones/{id}/phases/{phase}/PHASE-CAPSULE.json`

### Layer L3 - Reusable Rules And Policies

Promoted only from repeated evidence:

- gate policy
- provider routing rule
- cockpit display rule
- token budget rule
- memory retrieval rule

Rules:

- require provenance
- require confidence
- require last validation
- can be demoted
- can be superseded

### Layer L4 - Projections

For cockpit and agent dispatch:

- compact cockpit state
- context packet
- token spend dashboard
- provider health dashboard

Implementation:

- SQLite FTS for summaries and capsules
- optional Redis for hot live views
- both rebuildable from L0/L1/L2

## Concrete Files To Add

### `super-gsd/tools/token-waste/check.cjs`

Purpose:

- read token logs
- classify spend by role, phase, provider, cache-read/input/output
- fail or warn when a role exceeds its budget

First rules:

- researcher hard warning above 25k input tokens unless VTP/book/research route
  is explicitly justified
- executor hard warning above 40k input tokens unless high-risk code phase
- planner hard warning above 30k input tokens
- any agent with more than 90 percent cache-read and fewer than 15 meaningful
  file/tool reads is suspected context bloat

### `super-gsd/tools/phase-capsule/write.cjs`

Purpose:

- produce the phase-close capsule
- make prior phases consumable without re-scanning phase folders

Required fields:

- milestone
- phase
- title
- goal
- status
- current_debt
- evidence
- files_changed
- decisions
- downstream_contract
- source_commits
- source_hashes
- generated_at

### `super-gsd/tools/context-packet/build.cjs`

Purpose:

- build role-specific dispatch packets
- enforce token budget
- pull from capsules first
- pull from raw files only when a required fact is missing

Modes:

- `--role researcher`
- `--role planner`
- `--role executor`
- `--role verifier`
- `--role reviewer`
- `--phase N`

### `super-gsd/tools/context-registry/legal-keys.json`

Purpose:

- valid milestone IDs
- phase IDs
- gate IDs
- agent IDs
- artifact IDs
- provider IDs
- status vocabulary

Used by:

- packet builder
- cockpit
- verifier
- status consistency
- Codex reviewer prompt construction

### `super-gsd/tools/context-cache/context.db`

Purpose:

- SQLite FTS index over:
  - phase capsules
  - file summaries
  - gate definitions
  - accepted decisions

Rules:

- rebuildable
- no canonical-only data
- schema versioned

### `super-gsd/tools/context-cache/redis-adapter.cjs`

Only after the interface exists.

Purpose:

- hot live cockpit state
- recent context packet cache
- provider canary cache
- active process markers

Rules:

- optional
- disposable
- never canonical
- safe to delete

### `.planning/metrics/context-complaints.jsonl`

Purpose:

Log when the context system failed an agent.

Example row:

```json
{"ts":"2026-04-27T00:00:00Z","phase":41,"role":"researcher","complaint":"packet_missing_required_prior_decision","agent_action":"read_full_milestone_folder","packet_id":"...","fix_required":"add downstream_contract to phase capsule"}
```

## Redis Verdict

Redis can help SGSD, but not in the way originally implied.

Good Redis uses:

- live cockpit state
- active agent markers
- heartbeat state
- hot provider health cache
- latest context packet cache
- short-lived token counters

Bad Redis uses:

- canonical memory
- only copy of phase decisions
- only copy of debt rows
- only copy of agent findings
- long-term ungoverned memory

Recommended sequence:

1. Build the interface and SQLite projection first.
2. Add Redis adapter only when repeated live refresh or multi-process state
   needs it.
3. Make Redis deletion part of the self-test.

If SGSD cannot rebuild after `redis-cli FLUSHDB`, Redis is being used wrong.

## Agent Token Governance

The audit question was not just "how do we save tokens?" It was:

Can we tell whether a role should be Claude, Codex, local script, or VTP?

Recommended fields for `.planning/metrics/agent-token-spend.jsonl`:

```json
{
  "ts": "2026-04-27T00:00:00Z",
  "milestone": "v1.9",
  "phase": 41,
  "role": "gsd-phase-researcher",
  "provider": "claude",
  "model": "claude-opus-4-7",
  "task": "knowledge-provider-fallback",
  "input_tokens": 1000,
  "cache_read_tokens": 120000,
  "output_tokens": 5000,
  "tool_calls": 8,
  "files_read": 8,
  "mcp_calls": 0,
  "codex_calls": 0,
  "artifact_written": "41-RESEARCH.md",
  "artifact_bytes": 24000,
  "useful_findings_count": 6,
  "review_findings_count": 2,
  "reroute_candidate": true,
  "recommended_next_provider": "local-script-plus-codex"
}
```

Derived metrics:

- tokens per useful finding
- tokens per artifact byte
- cache-read ratio
- MCP use ratio
- repeated-file-read count
- role budget delta
- provider substitution candidate

Substitution rules:

- Local script first when the task is inventory, diff, schema, or deterministic
  extraction.
- Codex first when the task is bounded review, code critique, or alternate
  implementation.
- Claude researcher only when the task requires synthesis, ambiguity handling,
  or cross-domain judgment.
- VTP only when the task needs external research, books, prior project memory,
  or architectural challenge.

## Live Analysis Of Researcher Bloat

What the researcher appears to be spending tokens on:

- inherited session history
- milestone roadmap context
- prior phase artifacts
- skill instructions
- broad internal files
- repeated source scans
- large cached prompt context

What it is not spending enough on:

- targeted VTP retrieval
- structured capsule reads
- compact source indexes
- explicit uncertainty routing
- source-backed reusable findings

Likely failure mode:

The researcher is being used as a general-purpose context rehydration role. It
is paying to rediscover the project state that the system should already have
packaged.

Better role split:

- Local scanner: inventory files, extract headings, count evidence.
- VTP retriever: pull only if the question needs research/books/memory.
- Claude researcher: synthesize the retrieved packet.
- Codex reviewer: challenge the synthesis and spot contradictions.

This should cut the researcher context footprint dramatically while improving
auditability.

## Implementation Order

1. Add `token-waste/check.cjs` and agent token spend logging.

   This stops the runaway pattern from being invisible.

2. Add `phase-capsule/write.cjs` at phase close.

   Every completed phase should leave one stable downstream contract.

3. Add `context-packet/build.cjs` with legal registries.

   Agents get packets, not raw milestone history.

4. Route bounded roles through isolated dispatch and Codex.

   Planners, verifiers, and reviewers often need less Claude context than the
   current flow gives them.

5. Add SQLite FTS over capsules and file summaries.

   This gives fast local retrieval without making memory canonical.

6. Add Redis only for live cockpit and hot caches.

   Redis should improve refresh and coordination, not own truth.

7. Enable VTP selectively by phase type.

   Do not make every researcher call VTP. Make VTP the route for external
   knowledge, architectural challenge, book/research lookup, and prior-project
   memory.

## Acceptance Tests For The Fix

Minimum tests:

- Build a context packet for P41 researcher under a fixed token budget.
- Prove the packet contains current milestone, current phase, prior phase
  capsule, active debt, evidence requirements, and task goal.
- Prove the packet excludes raw unrelated prior phase files.
- Run researcher and record token spend.
- Fail if cache-read ratio remains above 90 percent with fewer than 15
  meaningful retrieval/tool actions.
- Prove deleting Redis does not lose any decision or evidence.
- Prove deleting SQLite and rebuilding from `.planning` recreates the same
  capsule index.
- Prove a CRIT bypass appears raw in the packet even when summaries are enabled.
- Prove an invented phase ID is rejected by legal-key validation.

## Final Decision

The original audit is broadly right, but incomplete.

Keep:

- phase capsules
- context packets
- token-waste checks
- file-summary cache
- isolated dispatch
- Codex substitution analysis

Add:

- memory write governance
- provenance and source hashes
- compression lifecycle with promotion/demotion
- critical-output bypass
- context complaint rollback
- legal registries
- central token scheduling
- SQLite projection before Redis
- Redis only as disposable live cache

The highest-leverage next action is not Redis. It is to stop passing raw
context through agents and make phase capsules plus context packets the only
normal dispatch surface.

