---
agent: sgsd-{name}
category: {A-I}  # see registry/agents.yaml categories
model_default: {haiku|sonnet|opus}
handover_contract: v2
created: 2026-04-21
version: 2.0
research_principles:
  - {ID-from-9-paper-corpus}
---

# Expertise — sgsd-{name}

*This file is the **static strategic layer** for this agent (ASS-P-05, PI Framework). Distinct from dynamic memory (`.planning/memory/`). Never auto-edited; SEPL may PROPOSE edits, operator reviews + commits.*

## Seeded Methods

Base operators this agent extends. ASS-P-06: *"balance autonomy with guardrails: seed specialists with proven base methods."* These are the empirically-grounded foundations this agent specializes from.

- **{Method 1}** — one-line description of why this method applies to this agent's domain
- **{Method 2}** — ...
- **{Method 3}** — ...

Example methods by category:
- All agents: CoT, ReAct, Self-Refine
- Execution: TDD cycle, atomic commit, surgical constraint (Karpathy)
- Verification: Nyquist criterion, goal-backward analysis, invariant checking
- Review: ATC 7-step, 10-point anti-slop, ΔComplexity check
- Planning: question-driven decomposition, pattern-mapper lookup, risk elicitation

## Failure Modes

Known ways this agent fails, with detection indicators. LLMS-P-01: *"diagnose failure modes before scaling autonomous systems."*

- **{Failure Mode 1}** — what it looks like in the output, what trigger caused it
- **{Failure Mode 2}** — ...

Cross-reference `.planning/memory/architecture/anti-patterns/` for accumulated examples.

## Output Quality Bar

What "good" looks like for this agent's output. Used by reviewers (LLMS-P-08) and by this agent's self-check.

- **Completeness:** {which output fields must be non-empty}
- **Accuracy:** {how to verify — exit codes, file existence, schema match}
- **Surgical-ness:** {how much diff is "right-sized" vs bloated — Karpathy surgical constraint}
- **Evidence:** {what citations back up claims — brief-section, DLB-ref, file:line}
- **Confidence calibration:** {how this agent should self-rate 1-5 per SEV-P-02}

## Known Pitfalls

Hard boundaries this agent MUST NOT cross. HCC-P-04 dead-ends captured explicitly.

- **DO NOT** {action}. Reason: {invariant violated or past incident reference}.
- **DO NOT** {action}. Reason: ...

Cross-reference `.planning/decisions/DLB-*.md` for governance-level constraints.

## Reference Patterns

Exemplar outputs to pattern-match against. ASS-P-03: *"structured memory: pattern, approach, failure mode, rule."*

- **Pattern {name}** — when to apply, what the output looks like, what rule it embodies
- ...

Link to canonical examples under `.planning/memory/architecture/patterns/` where applicable.

---

## Research Citations

Principles from the 9-paper corpus that shape this expertise:

- **{Paper-ID}-P-NN** — {one-line relevance}

---

## Revision Log

- 2026-04-21 — v2.0 created from `_template.md` during SGSD v2 migration Phase A scaffold.
