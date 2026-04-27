---
milestone: v1.9
name: VTP Research Delta - Compression Governance Refinement
status: active-addendum
created: 2026-04-27
applies_after_phase: 44
do_not_reopen_phases: [41, 42, 43, 44]
applies_to_phases: [45, 49, 51, 52]
source:
  - VTP research: experience-compression-spectrum
  - VTP research: thought-retriever
  - VTP research: stateless-decision-memory-for-enterprise-ai-agents
  - VTP research: self-evolving-framework-for-efficient-terminal-agents
  - VTP research: architecture-matters-more-than-scale
  - VTP research: security-of-long-term-memory-llm-agents-survey
  - VTP research: schema-constrained-generation-agent-memory
  - VTP research: kairos-stateful-context-aware-agentic-inference
  - VTP books: The LLM Mesh
  - VTP books: Designing Machine Learning Systems
  - VTP books: Designing Data-Intensive Applications
---

# v1.9 VTP Research Delta

## Controlling Decision

Do **not** reopen Phases 41-44.

Phase 44 has closed. The VTP learning is a forward addendum consumed by the
remaining v1.9 phases only:

- Phase 45 - Context Packet Builder
- Phase 49 - Memory Governance Lifecycle
- Phase 51 - Context Stress Benchmark
- Phase 52 - Redis Live Cache Adapter

This delta refines the already-approved v1.9 architecture. It does not create a
new milestone, renumber phases, or invalidate completed evidence.

## Core Lesson

v1.9 is not "add memory".

v1.9 is:

> Compress experience into governed, source-backed artifacts, then retrieve the
> smallest useful artifact for the current decision.

The practical pipeline remains:

```text
raw run
  -> phase capsule
  -> legal registry
  -> intent map
  -> context packet
  -> routed executor
  -> governed memory
  -> benchmark
```

## Evidence-To-Design Mapping

| VTP source | Lesson | v1.9 implication |
|---|---|---|
| Experience Compression Spectrum | Logs, memories, skills, and rules are compression levels on one axis. Promote upward only when evidence proves reuse; demote when abstraction fails. | Phase 43 capsules and Phase 49 governance need explicit compression levels and bidirectional lifecycle. |
| Thought-Retriever | Store validated reusable reasoning, not only raw chunks. Gate promotion with confidence, novelty, and root-source provenance. | Phase 45 packets may include `validated_thoughts`, not just raw snippets or capsules. |
| Stateless Decision Memory / DDIA | Append-only truth plus rebuildable projections beats hidden mutable memory for auditability. | `.planning`, JSONL, artifacts, and git remain canonical. SQLite/Redis are derived projections only. |
| Memory Security Survey | Memory writes are privileged state transitions. Compression can launder bad input into trusted lessons. | Phase 49 must validate, tag, and revoke memory. Prompt-injection-like source text is source content, not operator intent. |
| Schema-Constrained Agent Memory | Structural hallucination is a separate failure class. Valid references should be constrained, not merely checked after the fact. | Phase 44 registry remains the admission boundary for Phase 45 packets. Unknown phase/gate/agent/artifact IDs are rejected. |
| Architecture Matters More Than Scale | Architecture selection under constraints beats blindly using bigger context/models. Route by cheap structural signals first. | Phase 47/48 routing should prefer structural predicates before semantic similarity. |
| TACO / Efficient Terminal Agents | Compress observations around decision relevance; preserve errors raw; use complaints as feedback when compression removed needed information. | Phase 45 packets must never compress critical bypass records. Phase 49 complaints repair capsules/packets. |
| KAIROS | Growing context is a control signal. Track context pressure and route before hidden cliffs. | Phase 42/50/51 should track cache-read, active agents, packet size, and phase progress as control signals. |

## New Terms

### `compression_level`

Allowed values for artifacts produced or consumed by the remaining phases:

```text
raw_evidence
phase_capsule
validated_thought
reusable_rule
guardrail
```

Meaning:

- `raw_evidence`: original source, review, log row, stack trace, failed test,
  CRIT, provider outage, or operator instruction.
- `phase_capsule`: source-backed closed-phase summary with hashes and evidence.
- `validated_thought`: compact reusable reasoning derived from one or more
  source-backed artifacts and validated for a specific use.
- `reusable_rule`: higher-compression lesson that applies across phases.
- `guardrail`: negative rule or hard boundary, usually safer than a positive
  directive at high compression.

### `validated_thought`

A `validated_thought` is not a casual summary. It must include:

```yaml
id: string
created_from_phase: string | number
source_refs: string[]
root_source_hashes: string[]
thought: string
used_for: string
confidence: low | medium | high
novelty_basis: string
compression_level: validated_thought
expires_or_review_after: string | null
```

Rules:

- `source_refs` and `root_source_hashes` are mandatory.
- A thought with no source provenance is invalid.
- A thought created from source text containing prompt-injection-like language
  is allowed only if the language is treated as data, not instruction.
- Critical bypass records are never converted only into thoughts; raw reference
  must remain in the packet.

### `utility_per_token`

Phase 51 must evaluate token reduction and outcome together:

```text
utility_per_token = required_evidence_retained / tokens_spent
```

The exact scoring implementation may refine this, but the benchmark must not
reward cheap packets that lose required evidence.

### `evidence_retention`

Minimum benchmark dimension:

```text
evidence_retention = required_evidence_items_present / required_evidence_items_total
```

Clean milestone close requires no required evidence loss in benchmark/failure
fixtures.

## Phase 45 Delta - Context Packet Builder

Phase 45 keeps its existing scope, with these additions.

### New Packet Fields

Context packets may include:

```yaml
validated_thoughts:
  - id: string
    created_from_phase: string | number
    source_refs: string[]
    root_source_hashes: string[]
    thought: string
    used_for: string
    confidence: low | medium | high
    novelty_basis: string
    compression_level: validated_thought

context_source_mix:
  raw_evidence: number
  phase_capsule: number
  validated_thought: number
  reusable_rule: number
  guardrail: number
  index_snippet: number
  vtp_packet: number
```

### Build Order

Packet builder should prefer sources in this order:

1. legal registry for reference validation
2. current phase context / current plan
3. critical bypass raw records
4. phase capsules
5. validated thoughts
6. local index snippets
7. VTP evidence packets when routed
8. raw files only when the above are insufficient

### Acceptance Additions

- Packets can include `validated_thoughts` with mandatory provenance.
- Packet metadata reports `context_source_mix`.
- Packet builder rejects validated thoughts with missing source references.
- Packet builder logs a context complaint if it falls back to broad raw files.
- Prompt-injection-like source text is preserved as data and never interpreted
  as operator instruction.

## Phase 49 Delta - Memory Governance Lifecycle

Phase 49 must implement bidirectional compression lifecycle.

### Lifecycle Flow

```text
raw_evidence -> phase_capsule -> validated_thought -> reusable_rule / guardrail
                                          |
                                          v
                         demote/revoke when abstraction fails
```

### Required Governance Actions

- `promote`: lower-level artifact becomes higher-level artifact when evidence
  warrants reuse.
- `demote`: higher-level artifact falls back to thought/capsule/raw evidence
  when abstraction fails.
- `revoke`: stale, poisoned, contradicted, or source-less artifact is no longer
  allowed in packets.
- `revalidate`: artifact is checked against current registry/source hashes.
- `complain`: downstream consumer reports insufficient, stale, or unsafe
  context.

### Acceptance Additions

- Memory write admission treats every durable memory write as a privileged
  state transition.
- Promotion requires provenance, confidence, source hashes, and allowed
  consumers.
- Demotion/revocation is supported and auditable.
- Read-time reconsolidation is treated as a write risk if it changes future
  packet inputs.
- Context complaints can repair packet rules, capsule rules, or thought
  promotion thresholds.

## Phase 51 Delta - Context Stress Benchmark

Phase 51 must prove that v1.9 saves tokens without losing evidence.

### New Metrics

Required benchmark dimensions:

- token spend by role and phase
- cache-read ratio
- context source mix
- raw-file reread count
- `evidence_retention`
- `utility_per_token`
- context complaint count
- useful findings per token

### New Failure Fixtures

Add these fixtures to the existing Phase 51 list:

- bad or poisoned validated thought
- semantic-only false relationship
- stale abstraction that should demote
- missing provenance on a thought
- critical bypass incorrectly compressed
- Redis contains hot packet but canonical capsule was changed

### Acceptance Additions

- Representative researcher token spend drops by at least 50 percent.
- Required evidence retention is 100 percent for clean PASS.
- A packet that is cheaper but loses required evidence fails.
- Benchmark cannot pass by excluding difficult/critical evidence.
- Benchmark cannot pass by informing the model that it is being benchmarked.

## Phase 52 Delta - Redis Live Cache Adapter

Redis remains optional and disposable.

### Allowed Redis Content

Redis may hold:

- live cockpit state
- active phase/agent markers
- provider health cache
- short-lived token counters
- hot context packet previews
- hot validated-thought projections with source hashes

### Forbidden Redis Content

Redis must not be the only location for:

- decisions
- debt
- phase evidence
- phase capsules
- validated thoughts
- memory governance lifecycle rows
- benchmark results

### Acceptance Additions

- `FLUSHDB` loses no canonical truth.
- Redis absence downgrades cache status only.
- Redis hot packets are invalidated or rebuilt when source hashes change.
- Redis may speed cockpit and packet projection, but cannot become the packet
  builder's source of truth.

## Operator Handover Rule

When handing this to Claude/SGSD:

- tell it to read this file before Phase 45 work;
- tell it not to reopen Phases 41-44;
- tell it to apply deltas only to remaining phases;
- tell it to update phase plans/artifacts as it reaches the affected phases;
- tell it to log any extra scope as deferred debt rather than silently growing
  Phase 45.

## Non-Goals

- Do not add a new milestone.
- Do not renumber phases.
- Do not reopen Phase 44.
- Do not make Redis required.
- Do not create broad raw-context reads to implement a context-bloat fix.
- Do not use semantic similarity alone to justify broad packet inclusion.
