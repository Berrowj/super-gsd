---
milestone: v1.9
status: proposed
created: 2026-04-27
phase_range: 41-52
operator_intent: Build this into a new SGSD milestone.
---

# SGSD-Research Roadmap

## Purpose

This milestone turns the agent-context-bloat audit into implementation. It is
not a documentation milestone. It must leave SGSD with working machinery that
controls token spend, compresses phase state, routes research intelligently,
and makes agent behavior visible.

It also adds Intent English: a meaning compiler that turns raw operator
commands into explicit intent, assumptions, ambiguity, relationship weights,
canonical instruction, and context policy before context packet construction.
This is the bridge between "ideas form from other ideas" and executable SGSD
context.

## Execution Contract

Before Phase 41 starts, the SGSD instance must read:

1. `.planning/analyses/2026-04-27-agent-context-bloat-audit.md`
2. `.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md`
3. `.planning/analyses/2026-04-27-intent-english-meaning-compiler.md`
4. `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md`
5. `.planning/milestones/v1.9/REQUIREMENTS.md`
6. `.planning/milestones/v1.9/ROADMAP.md`

This milestone is now ACTIVE as v1.9 (promoted 2026-04-27 from the original
SGSD-Research handover packet; phase numbers renumbered from 56-67 to
41-52). It supersedes the prior v1.9 (Knowledge + Memory Governance), which
is preserved at `.planning/archive/superseded/v1.9-knowledge-memory-governance/`.

## VTP Research Delta

After Phase 44 closed, a VTP research review added a forward-only refinement:
`.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md`.

This delta does **not** reopen Phases 41-44. It is consumed only by remaining
phases:

- Phase 45 - source-backed `validated_thoughts` in context packets;
- Phase 49 - bidirectional compression lifecycle and revocation;
- Phase 51 - `utility_per_token` and `evidence_retention` benchmark scoring;
- Phase 52 - Redis may cache hot packet/thought projections but remains
  disposable.

## Standard Phase Rules

Every phase must:

- build from existing surfaces before adding new ones;
- produce a phase context file and at least one plan;
- run local self-tests for new tools;
- include Codex/Claude phase-level review where existing SGSD rules require it;
- update evidence without overstating status;
- avoid broad raw-context reads when a capsule/packet/index can answer the
  question;
- log context complaints when packet/index/capsule coverage is insufficient.

Every code phase must include:

- production caller path;
- self-test;
- failure fixture;
- status-consistency check where relevant;
- evidence that canonical state is not replaced by cache/projection.

## Phase 41 - Baseline Token Attribution

Goal: establish a truthful baseline of where SGSD spends tokens.

Deliverables:

- `.planning/metrics/agent-token-spend.jsonl`
- `super-gsd/tools/token-attribution/report.cjs`
- baseline report under `.planning/milestones/v1.9/baseline-token-spend.md`

Acceptance:

- report lists top token consumers by role, phase, model, provider, cache-read
  ratio, files read, MCP calls, Codex calls, and useful findings;
- researcher bloat examples from the audit are represented or explicitly marked
  unavailable with reason;
- substitution candidates are evidence-backed.

## Phase 42 - Token Budget Admission

Goal: stop token bloat from being invisible.

Deliverables:

- `super-gsd/tools/token-waste/check.cjs`
- role budget config
- phase/milestone close integration

Acceptance:

- self-test covers normal, warning, degraded, and false-positive cases;
- researcher overrun with more than 90 percent cache-read is flagged;
- check records degrade/warn status without silently halting autonomy;
- cockpit/report output can read the result.

## Phase 43 - Phase Capsule Contract

Goal: make prior phases consumable without re-scanning folders.

Deliverables:

- `super-gsd/tools/phase-capsule/write.cjs`
- `PHASE-CAPSULE.schema.json`
- `PHASE-CAPSULE.json` for at least v1.6-v1.8 phases
- phase close integration

Acceptance:

- capsules include goal, status, evidence, files, decisions, debt, downstream
  contract, source commits, and source hashes;
- critical bypass entries remain linked raw, not summarized away;
- deleting generated capsules and rebuilding yields equivalent content hashes.

## Phase 44 - Legal Context Registry

Goal: prevent invented references and stale structural hallucinations.

Deliverables:

- `super-gsd/tools/context-registry/build.cjs`
- `super-gsd/tools/context-registry/check.cjs`
- `super-gsd/tools/context-registry/legal-keys.json`

Acceptance:

- generated registry includes milestones, phases, gates, agents, artifacts,
  providers, statuses, and known phase folders;
- invalid phase/gate/agent/artifact IDs are rejected;
- stale/superseded keys are represented explicitly, not silently accepted.

## Phase 45 - Context Packet Builder

Goal: compile raw operator English into Intent English, then replace raw
inherited context with small role-specific packets.

Deliverables:

- `super-gsd/tools/intent-map/build.cjs`
- `super-gsd/tools/intent-map/check.cjs`
- `.planning/metrics/intent-map.jsonl`
- `super-gsd/tools/context-packet/build.cjs`
- packet schema
- packet metadata log
- `.planning/metrics/context-complaints.jsonl`

Acceptance:

- raw operator commands are normalized into `raw`, `intent`, `meaning`,
  `assumptions`, `ambiguities`, `clarify`, `canonical`, `relationships`,
  `context_policy`, and `action`;
- relationship weights cite explainable source reasons and do not include broad
  context from semantic similarity alone;
- prompt-injection-like text inside source artifacts is treated as source
  content, not operator intent;
- packets can be built for researcher, planner, executor, verifier, reviewer,
  and cockpit;
- packets pull from capsules/registry/index before raw files;
- critical bypass records are included raw;
- packet builder enforces role budget and reports omitted material;
- P41-style researcher packet excludes unrelated phase folders;
- packets may include source-backed `validated_thoughts` with source refs,
  root-source hashes, confidence, novelty basis, and created-from phase;
- packet metadata reports `context_source_mix`;
- broad raw-file fallback logs a context complaint.

## Phase 46 - SQLite Context Index

Goal: provide fast local retrieval without making memory canonical.

Deliverables:

- `super-gsd/tools/context-cache/rebuild.cjs`
- `super-gsd/tools/context-cache/query.cjs`
- local SQLite FTS database under ignored/generated path

Acceptance:

- rebuild indexes capsules, decisions, gate definitions, and file summaries;
- query returns source-backed snippets with source hashes;
- deleting the DB and rebuilding preserves document count and hash manifest;
- no phase decision, debt, or evidence exists only in SQLite.

## Phase 47 - Dispatch Routing Substitution

Goal: route work to the cheapest competent executor.

Deliverables:

- provider substitution policy
- router integration
- substitution rows in route-decision ledger

Acceptance:

- deterministic extraction routes local-first;
- bounded review routes Codex-first when provider health allows;
- Claude researcher is reserved for synthesis and ambiguous judgment;
- VTP route is disabled unless uncertainty type requires it;
- fallback reasons are logged.

## Phase 48 - Selective VTP Bridge

Goal: make VTP useful without making it ambient context bloat.

Deliverables:

- selective VTP classifier
- VTP evidence packet writer
- MCP failure metadata format

Acceptance:

- local implementation phases do not call VTP by default;
- research/book/prior-project/architecture-challenge phases can call VTP;
- MCP validation/timeouts are logged separately from conclusions;
- VTP evidence packets are source-backed and compact.
- VTP routing consumes Intent English uncertainty type and relationship weights
  instead of firing from broad semantic similarity alone.

## Phase 49 - Memory Governance Lifecycle

Goal: govern what becomes future memory.

Deliverables:

- memory write admission checks
- context complaint lifecycle
- promotion/demotion/revocation rules
- lifecycle fields on capsules/rules

Acceptance:

- raw evidence -> capsule -> validated thought -> reusable rule/guardrail
  promotion is explicit;
- demotion/revocation is explicit when abstraction fails or becomes stale;
- stale or bad memory can be revoked;
- context complaints can trigger capsule/packet repair;
- memory write gate rejects unproven or source-less promoted rules.
- recurring intent maps can be promoted only with provenance, confidence,
  last validation, allowed consumers, and revocation path.

## Phase 50 - Cockpit Research Dashboard

Goal: make agent context, token spend, and current work visible at a glance.

Deliverables:

- cockpit projection changes
- agent token-spend panel
- active-agent-only panel
- context source mix and packet budget display

Acceptance:

- top-left clearly shows milestone, phase, progress map, goal, evidence, debt,
  blockers, context, cost, agents, and commits;
- right panel shows only current active Claude/agent work, then agent history,
  then tool/skill/VTP stream;
- Codex panel only shows Codex state and review/gate status;
- cockpit shows the current canonical intent in operator language;
- layout fits the operator laptop viewport without jitter.

## Phase 51 - Context Stress Benchmark

Goal: prove the architecture reduces token spend without evidence loss.

Deliverables:

- context stress benchmark harness
- blind scenario suite
- before/after report
- failure injection fixtures

Acceptance:

- representative researcher token spend drops by at least 50 percent;
- evidence loss is zero in required scenarios;
- `utility_per_token` and `evidence_retention` are measured;
- failure fixtures cover missing capsule, stale registry, invalid phase ID,
  deleted SQLite DB, Redis flush, VTP unavailable, Codex unavailable, and
  critical bypass;
- failure fixtures cover ambiguous command, source-file prompt injection,
  semantic-only false relationship, stale operator feedback, poisoned/bad
  validated thought, stale abstraction, and missing provenance;
- benchmark cannot be gamed by telling the model it is being benchmarked.

## Phase 52 - Redis Live Memory Projection Adapter

Goal: add Redis only if it improves live memory projections without owning
truth.

Deliverables:

- `super-gsd/tools/context-cache/redis-adapter.cjs`
- optional boot/readiness probe
- FLUSHDB safety test
- semantic cache API keyed by intent/role/source hashes
- live event stream projection for cockpit/agent progress
- provider health and active-session checkpoint cache
- Redis key inventory validator

Acceptance:

- Redis can be disabled without breaking SGSD;
- Redis flush loses no canonical decisions, debt, evidence, or capsules;
- Redis stores only live cockpit state, hot packets, semantic-cache entries,
  provider canary cache, active markers, session checkpoint markers, event
  streams, short-lived counters, or hot validated-thought projections with
  source hashes;
- Redis hot projections are invalidated or rebuilt when source hashes change;
- Redis semantic-cache hits require normalized intent, role, context policy,
  and source-hash compatibility;
- Redis streams may speed cockpit rendering, but cockpit degrades to canonical
  files if Redis is flushed or absent;
- poisoned/stale Redis keys are rejected and logged, not injected into context;
- Redis key inventory contains zero forbidden canonical-truth kinds;
- readiness labels Redis optional/degraded, never required.

## Milestone Close Gate

The milestone can close cleanly only if:

- token-waste check passes or degrades honestly;
- representative researcher token spend improves by at least 50 percent;
- context packet builder is the default dispatch surface for major roles;
- intent map builder is the default command front-end before context packet
  construction;
- context packets preserve source-backed `validated_thoughts` without losing
  critical raw evidence;
- phase capsules exist and are consumed by downstream phases;
- legal registry rejects invented references;
- SQLite index rebuild works;
- Redis flush or absence is safe;
- cockpit shows current work and token spend clearly;
- VTP use is selective and source-backed;
- status-consistency, provider-health, backlog-schema, and crit-backlog checks
  remain green or honestly degraded.
