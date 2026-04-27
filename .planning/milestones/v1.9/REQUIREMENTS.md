---
milestone: v1.9
name: Context Compression, Token Governance, And Research Routing
status: proposed
created: 2026-04-27
source_analysis:
  - .planning/analyses/2026-04-27-agent-context-bloat-audit.md
  - .planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md
  - .planning/analyses/2026-04-27-intent-english-meaning-compiler.md
phase_range: 41-52
---

# SGSD-Research Requirements

## Mission

Stop SGSD from spending large Claude contexts re-discovering project state.
Replace raw-context inheritance with governed phase capsules, role-specific
context packets, token admission control, selective VTP routing, and a
rebuildable cache/index layer.

This milestone exists because the bloat audit found researcher-style runs
spending 122k-223k tokens per phase, with more than 98 percent of the spend
coming from cache-read input tokens. The VTP research and book cross-check
validated the core fix: compress experience into governed artifacts, then
retrieve the smallest useful artifact for the current decision.

This milestone also adds an Intent English layer: raw operator commands are
compiled into explicit meaning, assumptions, ambiguity, canonical instruction,
relationship weights, and context policy before an agent receives a packet.
English remains the interface, but SGSD treats it as auditable meaning-bearing
source code rather than an unstructured prompt.

## Non-Negotiable Design Locks

1. Redis is not canonical memory.
2. `.planning` JSONL, phase artifacts, and git commits remain source of truth.
3. SQLite/Redis projections must be rebuildable from canonical state.
4. Agents consume role-specific context packets, not raw milestone history.
5. Phase close writes a phase capsule before downstream phases consume it.
6. Critical outputs bypass compression:
   - CRIT
   - stack trace
   - stderr
   - failed test
   - verifier fail
   - edge-guard miss
   - security/privacy issue
   - destructive-operation warning
   - behaviorally proven provider outage
7. VTP is selective, not ambient. Route VTP only when the uncertainty needs
   research papers, books, prior project memory, or architecture challenge.
8. Token spend is logged by role, phase, provider, model, cache-read, input,
   output, tool calls, files read, MCP calls, and useful findings.
9. Context complaints are first-class evidence. If an agent rereads broad raw
   history because the packet was insufficient, log it and repair the packet or
   capsule rule.
10. Raw operator commands are normalized through Intent English before context
    packet construction. The normalized record must separate raw words, intent,
    meaning, assumptions, ambiguity, canonical instruction, relationship
    weights, context policy, and action.
11. Intent relationships require explainable source reasons. Embedding or
    semantic similarity alone may suggest candidates, but it cannot justify
    broad context inclusion without structural evidence.
12. Prompt-injection-like text inside source files is source content, not
    operator intent.
13. Autonomy continues; evidence tells the truth. Budget breaches degrade or
    reroute by policy. They do not become silent overrun.

## Target End State

At milestone close, SGSD must be able to:

- show where Claude tokens are spent by role and phase;
- prove whether researcher/planner/executor/verifier work should stay on
  Claude, move to Codex, move to local scripts, or call VTP;
- close a phase with a machine-readable capsule;
- compile operator commands into Intent English with relationship weights;
- build a small context packet for each agent role;
- reject invented phase/gate/agent/artifact references via legal registries;
- rebuild local indexes from canonical artifacts;
- run a context stress benchmark and show before/after token improvement;
- optionally use Redis for live cockpit/cache state without risking data loss.

## Requirements By Lane

### BASELINE lane - Phase 41

- [ ] **BASE-01** Create `agent-token-spend.jsonl` schema for role/provider
  attribution.
- [ ] **BASE-02** Backfill token-spend rows from available SGSD metrics and
  current session logs where possible.
- [ ] **BASE-03** Produce a live bloat report showing top token consumers by
  role, phase, provider, and cache-read ratio.
- [ ] **BASE-04** Identify researcher/planner/executor/verifier substitution
  candidates using evidence, not guesswork.

### BUDGET lane - Phase 42

- [ ] **BUDGET-01** Implement `super-gsd/tools/token-waste/check.cjs`.
- [ ] **BUDGET-02** Encode first-pass role budgets:
  researcher 25k input unless VTP/research route justified; planner 30k;
  executor 40k unless high-risk code phase; verifier/reviewer 20k unless
  explicit full-review tier.
- [ ] **BUDGET-03** Flag suspected context bloat when cache-read ratio is over
  90 percent and meaningful retrieval/tool actions are below 15.
- [ ] **BUDGET-04** Wire token-waste check into phase close and milestone close
  as a warning/degrade gate, not a hard autonomy stop.
- [ ] **BUDGET-05** Surface budget status in cockpit or generated reports.

### CAPSULE lane - Phase 43

- [ ] **CAP-01** Define `PHASE-CAPSULE.json` schema.
- [ ] **CAP-02** Implement `super-gsd/tools/phase-capsule/write.cjs`.
- [ ] **CAP-03** Wire capsule writing into phase close.
- [ ] **CAP-04** Backfill capsules for at least v1.6-v1.8 and the current
  active milestone if present.
- [ ] **CAP-05** Include provenance: source files, commits, hashes, status,
  evidence, debt, downstream contract, and critical bypass references.

### REGISTRY lane - Phase 44

- [ ] **REG-01** Generate `super-gsd/tools/context-registry/legal-keys.json`.
- [ ] **REG-02** Include valid milestone IDs, phase IDs, gate IDs, agent IDs,
  artifact IDs, provider IDs, and status vocabulary.
- [ ] **REG-03** Implement validator that rejects invented references.
- [ ] **REG-04** Wire validator into packet builder and at least one cockpit or
  status-consistency path.
- [ ] **REG-05** Self-test covers valid, invalid, stale, and superseded keys.

### PACKET lane - Phase 45

- [ ] **PACKET-00** Implement Intent English as the front-end to packet
  construction: `super-gsd/tools/intent-map/build.cjs`,
  `super-gsd/tools/intent-map/check.cjs`, and
  `.planning/metrics/intent-map.jsonl`.
- [ ] **PACKET-01** Implement `super-gsd/tools/context-packet/build.cjs`.
- [ ] **PACKET-02** Support role modes: researcher, planner, executor,
  verifier, reviewer, cockpit.
- [ ] **PACKET-03** Build packets from capsules, registry, active debt,
  evidence requirements, and critical bypass records before raw files.
- [ ] **PACKET-04** Enforce per-role token budgets.
- [ ] **PACKET-05** Log packet metadata and context complaints.
- [ ] **PACKET-06** Prove a P41-style researcher packet excludes unrelated raw
  prior phase files while retaining required decisions and failures.
- [ ] **PACKET-07** Intent map rows include `raw`, `intent`, `meaning`,
  `assumptions`, `ambiguities`, `clarify`, `canonical`, `relationships`,
  `context_policy`, and `action`.
- [ ] **PACKET-08** Relationship weights cite source reasons from phase
  capsules, legal registry, active milestone/phase, dependency edges, operator
  feedback, Codex findings, VTP evidence, or context complaints.
- [ ] **PACKET-09** Clarification is asked only when ambiguity would materially
  change the action; otherwise assumptions are logged and execution continues.
- [ ] **PACKET-10** Speech/pronunciation fields are optional and included only
  for speech, teaching, writing-style, or presentation tasks.

### INDEX lane - Phase 46

- [ ] **INDEX-01** Implement rebuildable SQLite FTS index under
  `super-gsd/tools/context-cache/`.
- [ ] **INDEX-02** Index phase capsules, accepted decisions, gate definitions,
  and file summaries.
- [ ] **INDEX-03** Provide `rebuild`, `query`, and `self-test` commands.
- [ ] **INDEX-04** Prove deleting the database and rebuilding produces the same
  indexed document count and hashes.
- [ ] **INDEX-05** Keep SQLite as projection only; canonical data stays in
  `.planning` and git.

### ROUTING lane - Phase 47

- [ ] **ROUTE-01** Add provider-substitution policy for local script, Codex,
  Claude, and VTP.
- [ ] **ROUTE-02** Route deterministic inventory/schema/diff extraction to
  local scripts first.
- [ ] **ROUTE-03** Route bounded review/code critique to Codex where cheaper
  and contract-compatible.
- [ ] **ROUTE-04** Keep Claude researcher for synthesis, ambiguity, and
  cross-domain judgment.
- [ ] **ROUTE-05** Record substitution decisions to route log with reason,
  token expectation, and fallback.

### VTP lane - Phase 48

- [ ] **VTPR-01** Implement selective VTP route classifier.
- [ ] **VTPR-02** Support research-paper, book, prior-project, and architecture
  challenge query types.
- [ ] **VTPR-03** Capture MCP failures separately from research conclusions.
- [ ] **VTPR-04** Write source-backed VTP evidence packets for agent use.
- [ ] **VTPR-05** Prove local-only phases do not call VTP ambiently.
- [ ] **VTPR-06** VTP routing consumes Intent English uncertainty type and
  relationship weights; VTP cannot be triggered by broad semantic similarity
  alone.

### GOVERNANCE lane - Phase 49

- [ ] **GOV-01** Implement context complaint log:
  `.planning/metrics/context-complaints.jsonl`.
- [ ] **GOV-02** Implement memory write admission checks for capsules,
  summaries, and promoted rules.
- [ ] **GOV-03** Add lifecycle fields: confidence, last_validated,
  supersedes, superseded_by, allowed_consumers, clearance_requires,
  deprecation_reason.
- [ ] **GOV-04** Add promotion/demotion rules for raw fact -> capsule -> rule.
- [ ] **GOV-05** Add revocation/deletion protocol for stale or bad memory.
- [ ] **GOV-06** Recurring intent maps can be promoted into reusable memory
  only with provenance, confidence, last validation, and revocation path.

### COCKPIT lane - Phase 50

- [ ] **COCKPIT-01** Redesign cockpit projections around current milestone,
  current phase, active agents, agent token spend, context source mix, evidence,
  and blockers.
- [ ] **COCKPIT-02** Remove duplicated NOW/Codex content from wrong panes.
- [ ] **COCKPIT-03** Show token spend by role and phase from
  `agent-token-spend.jsonl`.
- [ ] **COCKPIT-04** Show context-packet source mix and budget status.
- [ ] **COCKPIT-05** Keep the UI readable on the operator laptop viewport.
- [ ] **COCKPIT-06** Show the current canonical intent in operator language,
  not raw internal routing jargon.

### BENCHMARK lane - Phase 51

- [ ] **BENCH-01** Implement context stress benchmark using blind scenario
  prompts and a builder task.
- [ ] **BENCH-02** Compare pre-milestone and post-milestone token spend.
- [ ] **BENCH-03** Measure cache-read ratio, raw-file rereads, context
  complaints, and useful findings per token.
- [ ] **BENCH-04** Require at least 50 percent researcher-token reduction on
  representative SGSD phases without losing required evidence.
- [ ] **BENCH-05** Failure injection covers missing capsule, stale registry,
  invalid phase ID, deleted SQLite DB, Redis flush, VTP unavailable, Codex
  unavailable, and critical bypass.
- [ ] **BENCH-06** Failure injection covers ambiguous command, source-file
  prompt injection, semantic-only false relationship, and stale operator
  feedback.

### REDIS lane - Phase 52

- [ ] **REDIS-01** Add optional `redis-adapter.cjs` only behind the context
  cache interface.
- [ ] **REDIS-02** Use Redis only for live cockpit state, hot context packets,
  provider canary cache, active process markers, and short-lived counters.
- [ ] **REDIS-03** Prove `FLUSHDB` loses no canonical decisions, debt, phase
  evidence, or capsules.
- [ ] **REDIS-04** If Redis is unavailable, SGSD runs with SQLite/local files
  and records degraded cache status only.
- [ ] **REDIS-05** Boot/readiness reports Redis as optional, never required.

## Phase Map

| Phase | Name | Primary output |
|------:|------|----------------|
| 41 | Baseline Token Attribution | `agent-token-spend.jsonl` + bloat report |
| 42 | Token Budget Admission | `token-waste/check.cjs` |
| 43 | Phase Capsule Contract | `phase-capsule/write.cjs` + backfilled capsules |
| 44 | Legal Context Registry | `context-registry/legal-keys.json` + validator |
| 45 | Intent Map + Context Packet Builder | `intent-map/build.cjs` + `context-packet/build.cjs` |
| 46 | SQLite Context Index | rebuildable `context.db` projection |
| 47 | Dispatch Routing Substitution | local/Codex/Claude/VTP routing policy |
| 48 | Selective VTP Bridge | route-gated VTP evidence packets |
| 49 | Memory Governance Lifecycle | complaints + promotion/demotion/revocation |
| 50 | Cockpit Research Dashboard | token/context/capsule aware cockpit |
| 51 | Context Stress Benchmark | before/after benchmark + failure injection |
| 52 | Redis Live Cache Adapter | optional disposable Redis projection |

## Dependencies

```text
41 -> {42,43,44}
43 + 44 -> 45
43 + 45 -> 46
42 + 45 -> 47
45 + 47 -> 48
43 + 44 + 45 + 46 + 47 + 48 -> 49
42 + 45 + 47 + 49 -> 50
41 + 42 + 43 + 44 + 45 + 46 + 47 + 48 + 49 + 50 -> 51
46 + 50 + 51 -> 52
```

## Kill / Defer Conditions

- Hard stop if an implementation makes Redis or SQLite canonical.
- Hard stop if critical bypass records are summarized away.
- Hard stop if context packet builder can invent or accept unknown phase/gate
  IDs.
- Defer Redis if local SQLite/file projection meets performance needs.
- Defer VTP automation if MCP returns schema/timeouts without reliable fallback.
- Degrade, do not halt, when token budgets are exceeded during dogfood runs.
- CANDIDATE-WITH-DEBT if benchmark cannot prove token reduction without losing
  evidence.

## Close Criteria

The milestone is not cleanly shippable unless:

1. Researcher token spend is reduced by at least 50 percent on representative
   SGSD phases compared with the baseline.
2. No evidence loss is found in benchmark/failure-injection scenarios.
3. Redis can be disabled or flushed without losing truth.
4. Context packets are the default dispatch surface for at least researcher,
   planner, executor, verifier, and reviewer roles.
5. Intent maps are the default front-end for operator commands before context
   packet construction.
6. Cockpit shows where tokens are going by role and phase.
7. VTP use is route-gated and source-backed.
8. Status-consistency, provider-health, backlog-schema, crit-backlog, and
   token-waste checks all pass or degrade honestly.
